import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';

const [, , name, widthValue, heightValue, url, outputDirectory = 'academy-caching-evidence'] = process.argv;
const width = Number(widthValue);
const height = Number(heightValue);
const debugPort = Number(process.env.CHROME_DEBUG_PORT || 9229);

if (!name || !Number.isInteger(width) || !Number.isInteger(height) || !url) {
  console.error('Usage: node scripts/capture-academy-caching-viewport.mjs <name> <width> <height> <url> [output-directory]');
  process.exit(64);
}
if (width < 320 || width > 2560 || height < 480 || height > 2400) {
  console.error('Viewport dimensions are outside the supported audit range.');
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
    this.socket.addEventListener('close', () => {
      for (const { reject } of this.pending.values()) reject(new Error('Chrome debugging connection closed.'));
      this.pending.clear();
    });
  }

  async open() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out opening Chrome debugging connection.')), 5000);
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
    mobile: false,
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
  await client.send('Emulation.setScrollbarsHidden', { hidden: true });

  const loaded = client.once('Page.loadEventFired');
  await client.send('Page.navigate', { url });
  await loaded;

  const readiness = await client.send('Runtime.evaluate', {
    expression: `new Promise((resolve, reject) => {
      const started = Date.now();
      const poll = () => {
        const ready = document.body?.dataset?.moduleReady === 'true';
        const audit = document.getElementById('academy-module-audit-output');
        if (document.readyState === 'complete' && ready && audit?.textContent) {
          scrollTo(0, 0);
          setTimeout(() => resolve({
            title: document.title,
            audit: JSON.parse(audit.textContent)
          }), 150);
          return;
        }
        if (Date.now() - started > 15000) {
          reject(new Error('Academy caching module did not become ready.'));
          return;
        }
        setTimeout(poll, 80);
      };
      poll();
    })`,
    awaitPromise: true,
    returnByValue: true
  });
  const ready = valueOf(readiness, 'Academy caching readiness');

  const diagnosticsResult = await client.send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.documentElement;
      const header = document.querySelector('.module-topbar');
      const sidebar = document.querySelector('.module-sidebar');
      const hero = document.querySelector('.module-hero');
      const activeLink = document.querySelector('[data-chapter-link].active');
      const audit = JSON.parse(document.getElementById('academy-module-audit-output').textContent);
      const rect = (element) => element ? (() => {
        const box = element.getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
      })() : null;
      return {
        title: document.title,
        viewport: { width: innerWidth, height: innerHeight },
        touchPoints: navigator.maxTouchPoints,
        bodyScroll: { x: scrollX, y: scrollY },
        pageOverflowX: root.scrollWidth > innerWidth + 1,
        scrollWidth: root.scrollWidth,
        chapterCount: document.querySelectorAll('.lesson-section[data-chapter]').length,
        interactiveLabs: document.querySelectorAll('[data-lab]').length,
        moduleReady: document.body.dataset.moduleReady,
        moduleAudit: document.body.dataset.moduleAudit,
        headerRect: rect(header),
        sidebarRect: rect(sidebar),
        heroRect: rect(hero),
        activeChapter: activeLink?.dataset.chapterLink || null,
        audit
      };
    })()`,
    returnByValue: true
  });
  const diagnostics = valueOf(diagnosticsResult, 'Academy caching diagnostics');

  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false
  });
  await writeFile(`${outputDirectory}/${name}.png`, Buffer.from(screenshot.data, 'base64'));

  const errors = [];
  if (diagnostics.viewport.width !== width || diagnostics.viewport.height !== height) errors.push('viewport dimensions do not match the requested CSS viewport');
  if (width <= 760 && diagnostics.touchPoints < 1) errors.push('phone viewport does not expose touch input');
  if (diagnostics.chapterCount !== 16) errors.push('chapter count is not 16');
  if (diagnostics.interactiveLabs < 5) errors.push('interactive lab count is below 5');
  if (diagnostics.moduleReady !== 'true' || diagnostics.moduleAudit !== 'complete') errors.push('module readiness or audit contract did not complete');
  if (diagnostics.pageOverflowX || diagnostics.audit?.overflow) errors.push(`page horizontally overflows: ${diagnostics.scrollWidth}px for ${width}px viewport`);
  if (diagnostics.audit?.clipped?.length) errors.push(`${diagnostics.audit.clipped.length} primary controls are horizontally clipped`);
  if (diagnostics.audit?.undersized?.length) errors.push(`${diagnostics.audit.undersized.length} primary controls are undersized`);
  if (!diagnostics.headerRect || Math.abs(diagnostics.headerRect.top) > 1) errors.push('module top bar is not aligned to the viewport');
  if (!diagnostics.heroRect || diagnostics.heroRect.width <= 0) errors.push('module hero is not rendered');
  if (consoleMessages.some((entry) => entry.type === 'error' || entry.type === 'exception')) errors.push('browser console contains errors');

  const evidence = { name, url, ready, diagnostics, consoleMessages, valid: errors.length === 0, errors };
  await writeFile(`${outputDirectory}/${name}.json`, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
  if (errors.length) process.exitCode = 2;
} finally {
  client.close();
}
