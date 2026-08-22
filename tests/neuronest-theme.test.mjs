import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, theme, baseCss] = await Promise.all([
  readFile('apps/web/index.html', 'utf8'),
  readFile('apps/web/neuronest-theme.css', 'utf8'),
  readFile('apps/web/react-app.css', 'utf8')
]);

test('loads the original modular theme after the functional base stylesheet', () => {
  const baseIndex = html.indexOf('href="./react-app.css"');
  const themeIndex = html.indexOf('href="./neuronest-theme.css"');
  assert.ok(baseIndex > 0);
  assert.ok(themeIndex > baseIndex);
  assert.match(html, /theme-color" content="#070707"/);
  assert.match(html, /no source artwork is embedded/i);
});

test('uses the selected calm modular palette and workspace shell', () => {
  for (const token of ['#070707', '#ccb8eb', '#b8d2ac', '#f9e893', '#d9dbdd']) {
    assert.ok(theme.toLowerCase().includes(token), `missing palette token ${token}`);
  }
  for (const selector of [
    '.sidebar',
    '.topbar',
    '.mission-hero',
    '.hero-console',
    '.workspace-layout',
    '.runtime-panel',
    '.composer-panel',
    '.metric-grid',
    '.result-tabs',
    '.architecture-map',
    '.agent-card',
    '.permission-table',
    '.trace-entry'
  ]) {
    assert.ok(theme.includes(selector), `missing themed selector ${selector}`);
    assert.ok(baseCss.includes(selector), `selector ${selector} is not part of the functional base UI`);
  }
});

test('does not copy or depend on external Dribbble artwork', () => {
  assert.equal(/url\s*\(\s*["']?https?:/i.test(theme), false);
  assert.equal(/cdn\.dribbble\.com|userupload|data:image\//i.test(theme), false);
  assert.match(theme, /original implementation/i);
  assert.match(theme, /No Dribbble artwork/i);
});

test('retains responsive, focus, reduced-motion, and critic-console boundaries', () => {
  assert.match(theme, /@media \(max-width: 1240px\)/);
  assert.match(theme, /@media \(max-width: 1040px\)/);
  assert.match(theme, /@media \(max-width: 860px\)/);
  assert.match(theme, /@media \(max-width: 760px\)/);
  assert.match(theme, /prefers-reduced-motion/);
  assert.match(theme, /:focus-visible/);
  assert.match(theme, /harnesslab-critic-console/);
  assert.match(theme, /--critic-violet: #ccb8eb/);
  assert.match(theme, /--critic-amber: #f9e893/);
});

test('has a balanced stylesheet structure and bounded override scope', () => {
  const openings = [...theme.matchAll(/\{/g)].length;
  const closings = [...theme.matchAll(/\}/g)].length;
  assert.equal(openings, closings);
  assert.ok(theme.length < 75000, 'theme layer should remain reviewable and bounded');
  assert.equal((theme.match(/!important/g) || []).length, 12, 'only critic custom-property overrides may use !important');
});
