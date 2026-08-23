import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';

const [, , name, widthValue, heightValue, url, outputDirectory = 'ui-audit'] = process.argv;
const width = Number(widthValue);
const height = Number(heightValue);
const debugPort = Number(process.env.CHROME_DEBUG_PORT || 9222);

if (!name || !Number.isInteger(width) || !Number.isInteger(height) || !url) {
  console.error('Usage: node scripts/capture-ui-viewport.mjs <name> <width> <height> <url> [output-directory]');
  process.exit(64);
}

if (width < 320 || width > 2560 || height < 480 || height > 2400) {
  console.error('Viewport dimensions are outside the supported audit range.');
  process.exit(64);
}

async function waitForDebugger() {
  let lastError;
  for (let attempt = 1; attempt <= 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
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
    const callbacks = this.listeners.get(message.method) || [];
    for (const callback of callbacks) callback(message.params || {});
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { method, resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const callbacks = this.listeners.get(method) || [];
      const timeout = setTimeout(() => {
        this.listeners.set(method, callbacks.filter((callback) => callback !== handler));
        reject(new Error(`Timed out waiting for ${method}.`));
      }, timeoutMs);
      const handler = (params) => {
        clearTimeout(timeout);
        this.listeners.set(method, callbacks.filter((callback) => callback !== handler));
        resolve(params);
      };
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

await mkdir(outputDirectory, { recursive: true });
await waitForDebugger();
const target = await createTarget();
const client = new CdpClient(target.webSocketDebuggerUrl);
await client.open();

try {
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 760,
    screenWidth: width,
    screenHeight: height,
    positionX: 0,
    positionY: 0,
    dontSetVisibleSize: false
  });
  await client.send('Emulation.setTouchEmulationEnabled', {
    enabled: width <= 760,
    maxTouchPoints: width <= 760 ? 5 : 1
  });

  const loaded = client.once('Page.loadEventFired', 15000);
  await client.send('Page.navigate', { url });
  await loaded;

  const auditResult = await client.send('Runtime.evaluate', {
    expression: `new Promise((resolve, reject) => {
      const started = Date.now();
      const poll = () => {
        if (document.body?.dataset?.uiAudit === 'complete') {
          resolve({
            body: { ...document.body.dataset },
            output: document.getElementById('ui-audit-output')?.textContent || '',
            design: document.documentElement.dataset.design,
            layout: document.documentElement.dataset.layout
          });
          return;
        }
        if (Date.now() - started > 10000) {
          reject(new Error('Viewport audit did not complete.'));
          return;
        }
        setTimeout(poll, 100);
      };
      poll();
    })`,
    awaitPromise: true,
    returnByValue: true
  });
  const audit = evaluationValue(auditResult, 'Viewport audit');

  const domResult = await client.send('Runtime.evaluate', {
    expression: 'document.documentElement.outerHTML',
    returnByValue: true
  });
  const dom = evaluationValue(domResult, 'DOM capture');

  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false
  });

  const detailsResult = await client.send('Runtime.evaluate', {
    expression: `({
      innerWidth,
      innerHeight,
      devicePixelRatio,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      title: document.title,
      taskzenReady: document.body.dataset.taskzenReady,
      appMounted: Boolean(document.querySelector('.app-shell')),
      criticMounted: Boolean(document.querySelector('harnesslab-critic-console'))
    })`,
    returnByValue: true
  });
  const details = evaluationValue(detailsResult, 'Browser details');

  const parsedOutput = audit.output ? JSON.parse(audit.output) : null;
  const evidence = { name, requestedViewport: { width, height }, details, audit, parsedOutput };
  await Promise.all([
    writeFile(`${outputDirectory}/${name}.png`, Buffer.from(screenshot.data, 'base64')),
    writeFile(`${outputDirectory}/${name}.html`, dom),
    writeFile(`${outputDirectory}/${name}.json`, `${JSON.stringify(evidence, null, 2)}\n`)
  ]);

  const valid = audit.body.uiAudit === 'complete'
    && audit.body.uiDesign === 'taskzen'
    && audit.body.uiLayout === name
    && audit.body.uiOverflow === 'false'
    && audit.body.uiUndersized === '0'
    && audit.body.uiClipped === '0'
    && details.appMounted
    && details.criticMounted;

  console.log(JSON.stringify(evidence, null, 2));
  if (!valid) process.exitCode = 2;
} finally {
  client.close();
}
