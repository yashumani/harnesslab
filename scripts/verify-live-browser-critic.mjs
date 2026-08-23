import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';

const [, , url, outputPath = 'live-critic-verification/result.json'] = process.argv;
const debugPort = Number(process.env.CHROME_DEBUG_PORT || 9224);

if (!url) {
  console.error('Usage: node scripts/verify-live-browser-critic.mjs <url> [output-path]');
  process.exit(64);
}

async function waitForDebugger() {
  let lastError;
  for (let attempt = 1; attempt <= 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`, {
        signal: AbortSignal.timeout(1000)
      });
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Chrome debugging endpoint was unavailable: ${lastError?.message || 'unknown error'}`);
}

async function createTarget() {
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent('about:blank')}`, {
    method: 'PUT',
    signal: AbortSignal.timeout(3000)
  });
  if (!response.ok) throw new Error(`Unable to create a Chrome target (${response.status}).`);
  return response.json();
}

class CdpClient {
  constructor(webSocketUrl) {
    this.socket = new WebSocket(webSocketUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket.addEventListener('message', (event) => this.onMessage(event));
    this.socket.addEventListener('close', () => {
      for (const { reject } of this.pending.values()) reject(new Error('Chrome debugging connection closed.'));
      this.pending.clear();
    });
  }

  async open() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out opening Chrome debugging connection.')), 5000);
      this.socket.addEventListener('open', () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      this.socket.addEventListener('error', () => {
        clearTimeout(timeout);
        reject(new Error('Chrome debugging WebSocket failed.'));
      }, { once: true });
    });
  }

  onMessage(event) {
    const message = JSON.parse(String(event.data));
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result || {});
      return;
    }
    for (const callback of this.listeners.get(message.method) || []) callback(message.params || {});
  }

  on(method, callback) {
    const callbacks = this.listeners.get(method) || [];
    callbacks.push(callback);
    this.listeners.set(method, callbacks);
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { method, resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const callbacks = this.listeners.get(method) || [];
      const handler = (params) => {
        clearTimeout(timeout);
        this.listeners.set(method, callbacks.filter((callback) => callback !== handler));
        resolve(params);
      };
      const timeout = setTimeout(() => {
        this.listeners.set(method, callbacks.filter((callback) => callback !== handler));
        reject(new Error(`Timed out waiting for ${method}.`));
      }, timeoutMs);
      callbacks.push(handler);
      this.listeners.set(method, callbacks);
    });
  }

  close() {
    this.socket.close();
  }
}

function evaluationValue(result, label) {
  if (result.exceptionDetails) {
    throw new Error(`${label} failed: ${result.exceptionDetails.text || 'browser evaluation error'}`);
  }
  return result.result?.value;
}

await mkdir(outputPath.split('/').slice(0, -1).join('/') || '.', { recursive: true });
await waitForDebugger();
const target = await createTarget();
const client = new CdpClient(target.webSocketDebuggerUrl);
await client.open();

const requestsDuringCritic = [];
let captureNetwork = false;
client.on('Network.requestWillBeSent', ({ request, type }) => {
  if (!captureNetwork) return;
  requestsDuringCritic.push({
    url: request?.url || '',
    method: request?.method || '',
    type: type || ''
  });
});

try {
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Network.enable');

  const loaded = client.once('Page.loadEventFired');
  await client.send('Page.navigate', { url });
  await loaded;

  const readyResult = await client.send('Runtime.evaluate', {
    expression: `new Promise((resolve, reject) => {
      const started = Date.now();
      const poll = () => {
        const element = document.querySelector('harnesslab-critic-console');
        if (document.body?.dataset?.taskzenReady === 'true' && element?.latestResult) {
          resolve({
            title: document.title,
            runId: element.latestResult.runId,
            runtimeMode: element.getRuntimeSettings().mode
          });
          return;
        }
        if (Date.now() - started > 15000) {
          reject(new Error('Public HarnessLab plan and critic console did not become ready.'));
          return;
        }
        setTimeout(poll, 100);
      };
      poll();
    })`,
    awaitPromise: true,
    returnByValue: true
  });
  const ready = evaluationValue(readyResult, 'Public application readiness');

  captureNetwork = true;
  const criticResult = await client.send('Runtime.evaluate', {
    expression: `new Promise(async (resolve, reject) => {
      const element = document.querySelector('harnesslab-critic-console');
      if (!element) {
        reject(new Error('Temporary critic element is missing.'));
        return;
      }
      try {
        await element.runCritic();
        const worker = element.worker;
        const result = element.reviewedResult;
        resolve({
          execution: element.execution,
          message: element.message,
          worker: worker ? JSON.parse(JSON.stringify(worker)) : null,
          artifactRetained: Boolean(result?.artifacts?.some((artifact) => artifact.id === worker?.artifactId)),
          completionTraced: Boolean(result?.trace?.some((entry) => entry.event === 'temporary_agent.completed')),
          evaluationUpdated: Boolean(result?.evaluation?.dimensions?.some((dimension) => dimension.name === 'Architecture critique'))
        });
      } catch (error) {
        reject(error);
      }
    })`,
    awaitPromise: true,
    returnByValue: true
  });
  captureNetwork = false;
  const critic = evaluationValue(criticResult, 'Browser-local critic execution');

  const prohibitedRequests = requestsDuringCritic.filter((request) =>
    request.method.toUpperCase() === 'POST'
    || request.url.includes('/v1/critique')
    || request.url.includes('openrouter.ai')
    || request.url.includes('11434')
  );
  const worker = critic?.worker;
  const valid = ready?.runtimeMode === 'browser'
    && critic?.execution === 'browser-local'
    && worker?.status === 'completed'
    && worker?.provider === 'deterministic'
    && worker?.liveModel === false
    && worker?.callBudget === 1
    && worker?.callsUsed === 1
    && worker?.childSpawning === false
    && worker?.externalActions === false
    && Array.isArray(worker?.tools)
    && worker.tools.length === 0
    && critic?.artifactRetained === true
    && critic?.completionTraced === true
    && critic?.evaluationUpdated === true
    && prohibitedRequests.length === 0;

  const evidence = {
    url,
    ready,
    critic,
    requestsDuringCritic,
    prohibitedRequests,
    valid
  };
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
  if (!valid) process.exitCode = 2;
} finally {
  client.close();
}
