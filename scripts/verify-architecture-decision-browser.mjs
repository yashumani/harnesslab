import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';

const [, , url, outputPath = 'architecture-decision-verification/result.json'] = process.argv;
const debugPort = Number(process.env.CHROME_DEBUG_PORT || 9226);

if (!url) {
  console.error('Usage: node scripts/verify-architecture-decision-browser.mjs <url> [output-path]');
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

const requestsDuringDecision = [];
let captureNetwork = false;
client.on('Network.requestWillBeSent', ({ request, type }) => {
  if (!captureNetwork) return;
  requestsDuringDecision.push({
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
        const element = document.querySelector('harnesslab-architecture-decision');
        if (document.body?.dataset?.taskzenReady === 'true' && element?.liveDecision) {
          resolve({
            title: document.title,
            selected: element.liveDecision.selectedTopology.id,
            confidence: element.liveDecision.confidence,
            factors: element.liveDecision.factors.length,
            protocols: element.liveDecision.protocols.length
          });
          return;
        }
        if (Date.now() - started > 15000) {
          reject(new Error('Public HarnessLab topology advisor did not become ready.'));
          return;
        }
        setTimeout(poll, 100);
      };
      poll();
    })`,
    awaitPromise: true,
    returnByValue: true
  });
  const ready = evaluationValue(readyResult, 'Topology advisor readiness');

  captureNetwork = true;
  const decisionResult = await client.send('Runtime.evaluate', {
    expression: `new Promise((resolve, reject) => {
      const requirement = 'Coordinate with a separately operated partner agent through A2A, exchange authenticated tasks, and validate every returned artifact.';
      const textarea = document.querySelector('textarea[aria-label="Agent system requirement"]');
      const element = document.querySelector('harnesslab-architecture-decision');
      if (!textarea || !element) {
        reject(new Error('Requirement composer or topology advisor is missing.'));
        return;
      }
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(textarea, requirement);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      const started = Date.now();
      const poll = () => {
        const decision = element.liveDecision;
        if (decision?.selectedTopology?.id === 'external-agent-network') {
          const a2a = decision.protocols.find((protocol) => protocol.id === 'a2a');
          element.openDrawer();
          setTimeout(() => {
            const dialog = element.shadowRoot.querySelector('.drawer-panel');
            const focused = element.shadowRoot.activeElement;
            const excluded = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT']);
            const background = [...document.body.children].filter((child) => child !== element && !excluded.has(child.tagName));
            const openState = {
              open: element.open,
              ariaModal: dialog?.getAttribute('aria-modal'),
              backgroundInert: background.length > 0 && background.every((child) => child.hasAttribute('inert')),
              closeFocused: focused?.getAttribute?.('data-action') === 'close'
            };
            element.closeDrawer();
            setTimeout(() => {
              resolve({
                selected: decision.selectedTopology.id,
                confidence: decision.confidence,
                a2aDecision: a2a?.decision,
                temporaryWorkers: decision.selectedTopology.id === 'temporary-subagents',
                evidenceBacked: decision.factors.filter((factor) => factor.status === 'present').every((factor) => factor.evidence.length > 0),
                openState,
                closed: !element.open,
                focusRestored: element.shadowRoot.activeElement?.getAttribute?.('data-action') === 'toggle'
              });
            }, 0);
          }, 0);
          return;
        }
        if (Date.now() - started > 10000) {
          reject(new Error('Topology advisor did not update after programmatic composer input.'));
          return;
        }
        setTimeout(poll, 100);
      };
      poll();
    })`,
    awaitPromise: true,
    returnByValue: true
  });
  captureNetwork = false;
  const decision = evaluationValue(decisionResult, 'Topology decision interaction');

  const prohibitedRequests = requestsDuringDecision.filter((request) =>
    request.method.toUpperCase() === 'POST'
    || request.url.includes('/v1/')
    || request.url.includes('openrouter.ai')
    || request.url.includes('11434')
  );
  const valid = ready?.factors === 9
    && ready?.protocols === 4
    && decision?.selected === 'external-agent-network'
    && decision?.a2aDecision === 'Recommended'
    && decision?.evidenceBacked === true
    && decision?.openState?.open === true
    && decision?.openState?.ariaModal === 'true'
    && decision?.openState?.backgroundInert === true
    && decision?.openState?.closeFocused === true
    && decision?.closed === true
    && decision?.focusRestored === true
    && prohibitedRequests.length === 0;

  const evidence = {
    url,
    ready,
    decision,
    requestsDuringDecision,
    prohibitedRequests,
    valid
  };
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
  if (!valid) process.exitCode = 2;
} finally {
  client.close();
}
