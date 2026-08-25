import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, hardeningCss, captureViewport] = await Promise.all([
  readFile('apps/web/guide/index.html', 'utf8'),
  readFile('apps/web/guide/guide-responsive-hardening.css', 'utf8'),
  readFile('scripts/capture-learning-guide-viewport.mjs', 'utf8')
]);

test('loads the responsive containment layer after the primary guide theme', () => {
  const themeIndex = html.indexOf('href="./guide.css"');
  const hardeningIndex = html.indexOf('href="./guide-responsive-hardening.css"');

  assert.ok(themeIndex > 0);
  assert.ok(hardeningIndex > themeIndex);
});

test('contains every top-level guide region within tablet and phone widths', () => {
  for (const selector of [
    '.guide-shell',
    '.guide-topbar',
    '.guide-layout',
    '.slide-rail',
    '.rail-list',
    '.deck',
    '.slide',
    '.guide-controls',
    '.progress-group',
    '.guide-brand',
    '.guide-actions'
  ]) {
    assert.ok(hardeningCss.includes(selector), `missing width containment for ${selector}`);
  }

  assert.match(hardeningCss, /max-width:\s*100vw/);
  assert.match(hardeningCss, /overflow-x:\s*clip/);
  assert.match(hardeningCss, /contain:\s*inline-size/);
});

test('uses an intentional small-phone chapter pattern instead of an overflowing rail', () => {
  assert.match(hardeningCss, /@media \(max-width: 430px\)/);
  assert.match(hardeningCss, /\.guide-actions #overviewButton\s*\{[^}]*display:\s*inline-flex/s);
  assert.match(hardeningCss, /\.rail-button:not\(\[aria-current="true"\]\)\s*\{[^}]*display:\s*none/s);
  assert.match(hardeningCss, /\.rail-button\[aria-current="true"\]/);
});

test('exact phone evidence requires touch, zero overflow, zero offset, and unclipped controls', () => {
  assert.match(captureViewport, /touchPoints < 1/);
  assert.match(captureViewport, /diagnostics\.pageOverflowX/);
  assert.match(captureViewport, /diagnostics\.bodyScroll\.x !== 0/);
  assert.match(captureViewport, /diagnostics\.clippedInteractive\.length/);
  assert.match(captureViewport, /consoleMessages\.some/);
});
