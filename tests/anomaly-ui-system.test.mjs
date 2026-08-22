import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, shell, desktopCss, mobileCss, layoutGuard, baseCss] = await Promise.all([
  readFile('apps/web/index.html', 'utf8'),
  readFile('apps/web/anomaly-shell.js', 'utf8'),
  readFile('apps/web/anomaly-ui.css', 'utf8'),
  readFile('apps/web/anomaly-mobile.css', 'utf8'),
  readFile('apps/web/anomaly-layout-guard.css', 'utf8'),
  readFile('apps/web/react-app.css', 'utf8')
]);

const paletteIds = [
  'midnight', 'slate', 'warm', 'light',
  'verizon', 'att', 'tmobile', 'nvidia', 'meta', 'google',
  'cfo-navy', 'emerald', 'copper', 'royal', 'solar', 'arctic', 'plum', 'monochrome'
];

const functionalSelectors = [
  '.sidebar', '.topbar', '.mission-hero', '.workspace-layout', '.runtime-panel',
  '.composer-panel', '.metric-grid', '.result-tabs', '.architecture-map',
  '.agent-card', '.permission-table', '.trace-entry', '.evaluation-ring', '.artifact-card'
];

test('replaces the prior active theme with the anomaly product template', () => {
  const baseIndex = html.indexOf('href="./react-app.css"');
  const desktopIndex = html.indexOf('href="./anomaly-ui.css"');
  const mobileIndex = html.indexOf('href="./anomaly-mobile.css"');
  const guardIndex = html.indexOf('href="./anomaly-layout-guard.css"');
  assert.ok(baseIndex > 0);
  assert.ok(desktopIndex > baseIndex);
  assert.ok(mobileIndex > desktopIndex);
  assert.ok(guardIndex > mobileIndex);
  assert.equal(html.includes('neuronest-theme.css'), false);
  assert.match(html, /product-owned visual system adapted from yashumani\/drill-down-anamoly/i);
  assert.match(html, /data-theme="midnight"/);
  assert.match(html, /data-layout="desktop"/);
});

test('ships the same 18 palette identifiers and presentation groups', () => {
  for (const id of paletteIds) {
    assert.ok(shell.includes(`id: '${id}'`), `missing palette ${id}`);
    assert.ok(desktopCss.includes(`html[data-theme="${id}"]`), `missing CSS mapping ${id}`);
  }
  assert.equal((shell.match(/id: '/g) || []).length, 18);
  for (const group of ['Editorial', 'Brand-inspired', 'Executive']) {
    assert.ok(shell.includes(`'${group}'`));
  }
  assert.match(shell, /harnesslab\.anomaly-palette\.v1/);
  assert.match(shell, /Theme persistence is optional/);
});

test('ports the anomaly answer-first shell across every functional HarnessLab region', () => {
  for (const selector of functionalSelectors) {
    assert.ok(baseCss.includes(selector), `${selector} is not a functional HarnessLab selector`);
    assert.ok(desktopCss.includes(selector), `${selector} is not redesigned by anomaly-ui.css`);
  }
  assert.match(desktopCss, /3px solid var\(--edge\)/);
  assert.match(desktopCss, /--shadow: 7px 8px 0 var\(--edge\)/);
  assert.match(desktopCss, /AGENT HARNESS CONTROL ROOM/);
  assert.match(desktopCss, /REQUIREMENTS.*ARCHITECTURE.*TEMPORARY AGENTS/s);
  assert.match(shell, /Design → Validate → Deploy → Observe → Improve/);
});

test('keeps phone composition explicit rather than scaling desktop', () => {
  assert.match(mobileCss, /@media \(max-width: 640px\)/);
  assert.match(mobileCss, /grid-template-areas:\s*"brand theme"\s*"nav nav"/s);
  assert.match(mobileCss, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(mobileCss, /\.workspace-layout, \.evidence-layout, \.metric-grid, \.agent-card-grid/);
  assert.match(mobileCss, /min-height: 44px/);
  assert.match(mobileCss, /overflow-x: clip/);
  assert.match(mobileCss, /@media \(max-width: 390px\)/);
});

test('neutralizes the former off-canvas shell and full-width navigation inheritance', () => {
  assert.match(layoutGuard, /transform: none !important/);
  assert.match(layoutGuard, /\.nav-button\s*\{[^}]*width: auto/s);
  assert.match(layoutGuard, /\.mission-hero::after\s*\{[^}]*width: calc\(100% \+ 6px\)/s);
  assert.match(layoutGuard, /\.run-mini-button\s*\{[^}]*width: auto !important/s);
  assert.match(layoutGuard, /@media \(max-width: 640px\)/);
});

test('retains keyboard, reduced-motion, and browser credential boundaries', () => {
  assert.match(desktopCss, /:focus-visible/);
  assert.match(desktopCss, /prefers-reduced-motion/);
  assert.match(mobileCss, /prefers-reduced-motion/);
  assert.equal(/OPENROUTER_API_KEY|OLLAMA_DEFAULT_MODEL|authorization\s*:/i.test(shell), false);
  assert.equal(/url\s*\(\s*["']?https?:|data:image\//i.test(desktopCss), false);
  assert.equal(/url\s*\(\s*["']?https?:|data:image\//i.test(mobileCss), false);
  assert.equal(/url\s*\(\s*["']?https?:|data:image\//i.test(layoutGuard), false);
});

test('provides an executable viewport audit contract', () => {
  assert.match(shell, /ui-audit/);
  assert.match(shell, /data\.uiOverflow/);
  assert.match(shell, /data\.uiUndersized/);
  assert.match(shell, /data\.uiClipped/);
  assert.match(shell, /ui-audit-output/);
  assert.match(shell, /layoutForWidth/);
  assert.match(shell, /phone/);
  assert.match(shell, /tablet/);
  assert.match(shell, /desktop/);
});
