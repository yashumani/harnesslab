import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';

const [, , name, widthValue, heightValue, url, outputDirectory = 'learning-guide-evidence'] = process.argv;
const width = Number(widthValue);
const height = Number(heightValue);
const debugPort = Number(process.env.CHROME_DEBUG_PORT || 9226);

if (!name || !Number.isInteger(width) || !Number.isInteger(height) || !url) {
  console.error('Usage: node scripts/capture-learning-guide-viewport.mjs <name> <width> <height> <url> [output-directory]');
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
        const active = document.querySelector('.slide.is-active');
        if (document.readyState === 'complete' && active && document.querySelectorAll('.slide[data-slide]').length === 18) {
          window.scrollTo(0, 0);
          active.scrollTop = 0;
          setTimeout(() => resolve({ slide: active.dataset.slide, title: active.dataset.title }), 150);
          return;
        }
        if (Date.now() - started > 12000) {
          reject(new Error('Learning guide did not become ready.'));
          return;
        }
        setTimeout(poll, 80);
      };
      poll();
    })`,
    awaitPromise: true,
    returnByValue: true
  });
  const ready = valueOf(readiness, 'Learning guide readiness');

  const diagnosticsResult = await client.send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.documentElement;
      const active = document.querySelector('.slide.is-active');
      const topbar = document.querySelector('.guide-topbar');
      const rail = document.querySelector('.slide-rail');
      const controls = document.querySelector('.guide-controls');
      const rect = (element) => element ? (() => {
        const box = element.getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
      })() : null;
      const clippedInteractive = [...document.querySelectorAll('button,a[href]')]
        .filter((element) => {
          const style = getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden' || element.closest('[hidden]')) return false;
          const box = element.getBoundingClientRect();
          return box.width > 0 && box.height > 0 && (box.left < -1 || box.right > innerWidth + 1);
        })
        .map((element) => ({ text: element.textContent.trim().slice(0, 60), rect: rect(element) }));
      return {
        title: document.title,
        viewport: { width: innerWidth, height: innerHeight },
        touchPoints: navigator.maxTouchPoints,
        bodyScroll: { x: scrollX, y: scrollY },
        pageOverflowX: root.scrollWidth > innerWidth + 1,
        scrollWidth: root.scrollWidth,
        activeSlide: active?.dataset.slide || null,
        activeTitle: active?.dataset.title || null,
        activeRect: rect(active),
        topbarRect: rect(topbar),
        railRect: rect(rail),
        controlsRect: rect(controls),
        slideCount: document.querySelectorAll('.slide[data-slide]').length,
        clippedInteractive
      };
    })()`,
    returnByValue: true
  });
  const diagnostics = valueOf(diagnosticsResult, 'Learning guide diagnostics');

  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false
  });
  await writeFile(`${outputDirectory}/${name}.png`, Buffer.from(screenshot.data, 'base64'));

  const expectedSlide = new URL(url).hash.match(/^#slide-(\d+)$/)?.[1] || '1';
  const errors = [];
  if (diagnostics.viewport.width !== width || diagnostics.viewport.height !== height) errors.push('viewport dimensions do not match the requested CSS viewport');
  if (width <= 760 && diagnostics.touchPoints < 1) errors.push('phone viewport does not expose touch input');
  if (diagnostics.slideCount !== 18) errors.push('slide count is not 18');
  if (diagnostics.activeSlide !== expectedSlide) errors.push(`expected slide ${expectedSlide}, received ${diagnostics.activeSlide}`);
  if (diagnostics.pageOverflowX) errors.push(`page horizontally overflows: ${diagnostics.scrollWidth}px for ${width}px viewport`);
  if (diagnostics.bodyScroll.x !== 0 || diagnostics.bodyScroll.y !== 0) errors.push(`initial document scroll is ${diagnostics.bodyScroll.x},${diagnostics.bodyScroll.y}`);
  if (!diagnostics.topbarRect || Math.abs(diagnostics.topbarRect.top) > 1) errors.push('top bar is not aligned to the top of the viewport');
  if (diagnostics.clippedInteractive.length) errors.push(`${diagnostics.clippedInteractive.length} interactive controls are horizontally clipped`);
  if (consoleMessages.some((entry) => entry.type === 'error' || entry.type === 'exception')) errors.push('browser console contains errors');

  const evidence = { name, url, ready, diagnostics, consoleMessages, valid: errors.length === 0, errors };
  await writeFile(`${outputDirectory}/${name}.json`, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
  if (errors.length) process.exitCode = 2;
} finally {
  client.close();
}
