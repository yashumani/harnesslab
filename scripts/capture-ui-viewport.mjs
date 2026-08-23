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

async function evaluate(client, expression, label, { awaitPromise = false } = {}) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true
  });
  return evaluationValue(result, label);
}

function drawerSnapshotExpression() {
  return `(() => {
    const sidebar = document.querySelector('.sidebar');
    const main = document.getElementById('main-content');
    const menu = document.querySelector('.menu-button');
    return {
      exists: Boolean(sidebar && main && menu),
      open: Boolean(sidebar?.classList.contains('sidebar-open')),
      inert: Boolean(sidebar?.inert),
      ariaHidden: sidebar?.getAttribute('aria-hidden') ?? null,
      role: sidebar?.getAttribute('role') ?? null,
      ariaModal: sidebar?.getAttribute('aria-modal') ?? null,
      backgroundInert: Boolean(main?.inert),
      menuExpanded: menu?.getAttribute('aria-expanded') ?? null,
      menuControls: menu?.getAttribute('aria-controls') ?? null,
      activeClass: typeof document.activeElement?.className === 'string' ? document.activeElement.className : '',
      activeLabel: document.activeElement?.getAttribute?.('aria-label') ?? document.activeElement?.textContent?.trim?.() ?? ''
    };
  })()`;
}

async function waitForDrawerState(client, open, label) {
  return evaluate(client, `new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = () => {
      const sidebar = document.querySelector('.sidebar');
      const main = document.getElementById('main-content');
      const menu = document.querySelector('.menu-button');
      const isOpen = Boolean(sidebar?.classList.contains('sidebar-open'));
      const ready = ${open}
        ? isOpen && sidebar?.inert === false && main?.inert === true && menu?.getAttribute('aria-expanded') === 'true'
        : !isOpen && sidebar?.inert === true && main?.inert === false && menu?.getAttribute('aria-expanded') === 'false';
      if (ready) {
        resolve(${drawerSnapshotExpression()});
        return;
      }
      if (Date.now() - started > 5000) {
        reject(new Error('${label} did not reach the expected state.'));
        return;
      }
      setTimeout(poll, 50);
    };
    poll();
  })`, label, { awaitPromise: true });
}

async function auditResponsiveDrawer(client) {
  const initial = await evaluate(client, drawerSnapshotExpression(), 'Initial drawer state');
  if (width > 1120) return { initial, interactionRequired: false };

  await evaluate(client, `document.querySelector('.menu-button')?.click(); true`, 'Open navigation drawer');
  const opened = await waitForDrawerState(client, true, 'Open navigation drawer');

  const focusTrap = await evaluate(client, `(() => {
    const sidebar = document.querySelector('.sidebar');
    const selector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const focusable = [...sidebar.querySelectorAll(selector)].filter((element) => {
      const style = getComputedStyle(element);
      return !element.closest('[inert]') && style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
    });
    const first = focusable[0];
    const last = focusable.at(-1);
    last?.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    const forwardWrapped = document.activeElement === first;
    first?.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    const backwardWrapped = document.activeElement === last;
    return { controls: focusable.length, forwardWrapped, backwardWrapped };
  })()`, 'Drawer focus trap');

  await client.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27
  });
  await client.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27
  });
  const closed = await waitForDrawerState(client, false, 'Close navigation drawer');
  await new Promise((resolve) => setTimeout(resolve, 50));
  const restored = await evaluate(client, drawerSnapshotExpression(), 'Restored drawer focus');

  return {
    initial,
    interactionRequired: true,
    opened,
    focusTrap,
    closed,
    restored
  };
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

  const audit = await evaluate(client, `new Promise((resolve, reject) => {
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
  })`, 'Viewport audit', { awaitPromise: true });

  const navigationDrawer = await auditResponsiveDrawer(client);
  const dom = await evaluate(client, 'document.documentElement.outerHTML', 'DOM capture');
  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false
  });

  const details = await evaluate(client, `({
    innerWidth,
    innerHeight,
    devicePixelRatio,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    title: document.title,
    taskzenReady: document.body.dataset.taskzenReady,
    appMounted: Boolean(document.querySelector('.app-shell')),
    criticMounted: Boolean(document.querySelector('harnesslab-critic-console'))
  })`, 'Browser details');

  const parsedOutput = audit.output ? JSON.parse(audit.output) : null;
  const evidence = {
    name,
    requestedViewport: { width, height },
    details,
    audit,
    parsedOutput,
    navigationDrawer
  };
  await Promise.all([
    writeFile(`${outputDirectory}/${name}.png`, Buffer.from(screenshot.data, 'base64')),
    writeFile(`${outputDirectory}/${name}.html`, dom),
    writeFile(`${outputDirectory}/${name}.json`, `${JSON.stringify(evidence, null, 2)}\n`)
  ]);

  const baseValid = audit.body.uiAudit === 'complete'
    && audit.body.uiDesign === 'taskzen'
    && audit.body.uiLayout === name
    && audit.body.uiOverflow === 'false'
    && audit.body.uiUndersized === '0'
    && audit.body.uiClipped === '0'
    && details.appMounted
    && details.criticMounted;

  const drawerValid = width > 1120
    ? navigationDrawer.initial.exists
      && navigationDrawer.initial.inert === false
      && navigationDrawer.initial.ariaHidden === null
      && navigationDrawer.initial.backgroundInert === false
    : navigationDrawer.initial.exists
      && navigationDrawer.initial.open === false
      && navigationDrawer.initial.inert === true
      && navigationDrawer.initial.ariaHidden === 'true'
      && navigationDrawer.initial.backgroundInert === false
      && navigationDrawer.initial.menuExpanded === 'false'
      && navigationDrawer.opened.open === true
      && navigationDrawer.opened.inert === false
      && navigationDrawer.opened.ariaHidden === null
      && navigationDrawer.opened.role === 'dialog'
      && navigationDrawer.opened.ariaModal === 'true'
      && navigationDrawer.opened.backgroundInert === true
      && navigationDrawer.opened.menuExpanded === 'true'
      && navigationDrawer.opened.activeClass.includes('sidebar-close')
      && navigationDrawer.focusTrap.controls > 0
      && navigationDrawer.focusTrap.forwardWrapped === true
      && navigationDrawer.focusTrap.backwardWrapped === true
      && navigationDrawer.closed.open === false
      && navigationDrawer.closed.inert === true
      && navigationDrawer.closed.ariaHidden === 'true'
      && navigationDrawer.closed.backgroundInert === false
      && navigationDrawer.closed.menuExpanded === 'false'
      && navigationDrawer.restored.activeClass.includes('menu-button');

  console.log(JSON.stringify(evidence, null, 2));
  if (!baseValid || !drawerValid) process.exitCode = 2;
} finally {
  client.close();
}
