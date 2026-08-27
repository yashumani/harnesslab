import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';

const [, , name, widthValue, heightValue, url, outputDirectory = 'copilotkit-evidence', expectedMode = 'connected'] = process.argv;
const width = Number(widthValue);
const height = Number(heightValue);
const debugPort = Number(process.env.CHROME_DEBUG_PORT || 9230);

if (!name || !Number.isInteger(width) || !Number.isInteger(height) || !url) {
  console.error('Usage: node scripts/verify-copilotkit-browser.mjs <name> <width> <height> <url> [output-directory] [connected|setup]');
  process.exit(64);
}

async function waitForDebugger() {
  let lastError;
  for (let attempt = 1; attempt <= 80; attempt += 1) {
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
  if (!response.ok) throw new Error(`Unable to create Chrome target (${response.status}).`);
  return response.json();
}

class CdpClient {
  constructor(webSocketUrl) {
    this.socket = new WebSocket(webSocketUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket.addEventListener('message', (event) => this.onMessage(event));
  }
  async open() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out opening Chrome debugging WebSocket.')), 6000);
      this.socket.addEventListener('open', () => { clearTimeout(timeout); resolve(); }, { once: true });
      this.socket.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Chrome debugging WebSocket failed.')); }, { once: true });
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
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { method, resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  once(method, timeoutMs = 18000) {
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
  close() { this.socket.close(); }
}

function valueOf(result, label) {
  if (result.exceptionDetails) throw new Error(`${label}: ${result.exceptionDetails.text || 'browser evaluation failed'}`);
  return result.result?.value;
}

await mkdir(outputDirectory, { recursive: true });
await waitForDebugger();
const target = await createTarget();
const client = new CdpClient(target.webSocketDebuggerUrl);
await client.open();

const consoleMessages = [];
client.on('Runtime.consoleAPICalled', ({ type, args = [] }) => {
  consoleMessages.push({ type, text: args.map((item) => item.value ?? item.description ?? '').join(' ') });
});
client.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
  consoleMessages.push({ type: 'exception', text: exceptionDetails?.text || 'uncaught exception' });
});

try {
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 680,
    screenWidth: width,
    screenHeight: height,
    positionX: 0,
    positionY: 0,
    dontSetVisibleSize: false
  });
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: width <= 680, maxTouchPoints: width <= 680 ? 5 : 1 });
  await client.send('Emulation.setScrollbarsHidden', { hidden: true });

  const loaded = client.once('Page.loadEventFired');
  await client.send('Page.navigate', { url });
  await loaded;

  const readiness = await client.send('Runtime.evaluate', {
    expression: `new Promise((resolve, reject) => {
      const started = Date.now();
      const poll = () => {
        const root = document.querySelector('[data-copilotkit-root="ready"]');
        if (root) {
          if (${JSON.stringify(expectedMode)} === 'connected' && document.body.dataset.copilotkitMode === 'setup') {
            const button = document.querySelector('.runtime-form button[type="submit"]');
            if (button && !button.disabled && !button.dataset.auditClicked) {
              button.dataset.auditClicked = 'true';
              button.click();
            }
          }
          const audit = globalThis.__HARNESSLAB_COPILOTKIT_AUDIT__;
          const correctMode = audit?.mode === ${JSON.stringify(expectedMode)};
          const resultReady = ${JSON.stringify(expectedMode)} === 'setup' || audit?.resultReady === true;
          if (correctMode && resultReady) {
            window.scrollTo(0, 0);
            setTimeout(() => resolve(audit), 300);
            return;
          }
        }
        if (Date.now() - started > 30000) {
          reject(new Error('HarnessLab Copilot did not reach the expected state.'));
          return;
        }
        setTimeout(poll, 100);
      };
      poll();
    })`,
    awaitPromise: true,
    returnByValue: true
  });
  const ready = valueOf(readiness, 'CopilotKit readiness');

  const diagnosticsResult = await client.send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.documentElement;
      const visible = (element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
      };
      const clipped = [...document.querySelectorAll('button,a[href],input,textarea,select')]
        .filter(visible)
        .filter((element) => {
          const box = element.getBoundingClientRect();
          return box.left < -1 || box.right > innerWidth + 1;
        })
        .map((element) => ({ tag: element.tagName.toLowerCase(), label: (element.ariaLabel || element.textContent || '').trim().slice(0,80) }));
      const undersized = [...document.querySelectorAll('button,a[href],input')]
        .filter(visible)
        .filter((element) => {
          const box = element.getBoundingClientRect();
          return box.width < 40 || box.height < 40;
        })
        .map((element) => ({ tag: element.tagName.toLowerCase(), label: (element.ariaLabel || element.textContent || '').trim().slice(0,80), width: Math.round(element.getBoundingClientRect().width), height: Math.round(element.getBoundingClientRect().height) }));
      return {
        title: document.title,
        viewport: { width: innerWidth, height: innerHeight },
        pageOverflowX: root.scrollWidth > innerWidth + 1,
        scrollWidth: root.scrollWidth,
        bodyScroll: { x: scrollX, y: scrollY },
        mode: document.body.dataset.copilotkitMode,
        rootReady: Boolean(document.querySelector('[data-copilotkit-root="ready"]')),
        resultState: document.querySelector('[data-copilotkit-result]')?.dataset.copilotkitResult || null,
        clipped,
        undersized,
        audit: globalThis.__HARNESSLAB_COPILOTKIT_AUDIT__ || null
      };
    })()`,
    returnByValue: true
  });
  const diagnostics = valueOf(diagnosticsResult, 'CopilotKit diagnostics');

  const screenshot = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  await writeFile(`${outputDirectory}/${name}.png`, Buffer.from(screenshot.data, 'base64'));

  const errors = [];
  if (diagnostics.viewport.width !== width || diagnostics.viewport.height !== height) errors.push('viewport dimensions do not match');
  if (diagnostics.pageOverflowX) errors.push(`page horizontally overflows: ${diagnostics.scrollWidth}px for ${width}px viewport`);
  if (diagnostics.bodyScroll.x !== 0) errors.push(`initial horizontal scroll is ${diagnostics.bodyScroll.x}`);
  if (!diagnostics.rootReady) errors.push('CopilotKit workspace root is not ready');
  if (diagnostics.mode !== expectedMode) errors.push(`expected ${expectedMode} mode, received ${diagnostics.mode}`);
  if (expectedMode === 'connected' && diagnostics.resultState !== 'ready') errors.push('connected audit did not produce a structured harness result');
  if (diagnostics.clipped.length) errors.push(`${diagnostics.clipped.length} primary controls are horizontally clipped`);
  if (width <= 680 && diagnostics.undersized.length) errors.push(`${diagnostics.undersized.length} phone controls are undersized`);
  if (consoleMessages.some((entry) => entry.type === 'error' || entry.type === 'exception')) errors.push('browser console contains errors');

  const evidence = { name, url, ready, diagnostics, consoleMessages, valid: errors.length === 0, errors };
  await writeFile(`${outputDirectory}/${name}.json`, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
  if (errors.length) process.exitCode = 2;
} finally {
  client.close();
}
