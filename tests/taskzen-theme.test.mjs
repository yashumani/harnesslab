import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, theme, shell, baseCss, criticCss] = await Promise.all([
  readFile('apps/web/index.html', 'utf8'),
  readFile('apps/web/taskzen-theme.css', 'utf8'),
  readFile('apps/web/taskzen-shell.js', 'utf8'),
  readFile('apps/web/react-app.css', 'utf8'),
  readFile('apps/web/critic-console.css', 'utf8')
]);

const functionalSelectors = [
  '.app-shell',
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
  '.agent-card-grid',
  '.permission-table',
  '.trace-timeline',
  '.evaluation-ring',
  '.artifact-grid'
];

test('activates the Taskzen-inspired layer after the functional stylesheet', () => {
  const baseIndex = html.indexOf('href="./react-app.css"');
  const themeIndex = html.indexOf('href="./taskzen-theme.css"');
  assert.ok(baseIndex > 0);
  assert.ok(themeIndex > baseIndex);
  assert.match(html, /src="\.\/taskzen-shell\.js"/);
  assert.match(html, /data-design="taskzen"/);
  assert.match(html, /theme-color" content="#F7F8FC"/);
  assert.match(html, /AI Agent Harness Builder/);
  assert.equal(html.includes('neuronest-theme.css'), false);
});

test('uses a restrained light SaaS palette rather than the former cyber theme', () => {
  for (const token of ['#f7f8fc', '#ffffff', '#635bff', '#0e9384', '#e4e7ec', '#111827']) {
    assert.ok(theme.toLowerCase().includes(token), `missing visual token ${token}`);
  }
  assert.match(theme, /color-scheme: light/);
  assert.match(theme, /--shadow-soft:/);
  assert.equal(theme.toLowerCase().includes('#070707'), false);
  assert.equal(theme.toLowerCase().includes('#ccb8eb'), false);
});

test('redesigns the full application hierarchy rather than only colors', () => {
  for (const selector of functionalSelectors) {
    assert.ok(baseCss.includes(selector), `${selector} is not part of the functional UI`);
    assert.ok(theme.includes(selector), `${selector} is not covered by the replacement visual system`);
  }
  assert.match(theme, /floating SaaS navigation bar/i);
  assert.match(theme, /Product-first hero/i);
  assert.match(theme, /Shared content hierarchy and cards/i);
  assert.match(theme, /Result dashboard/i);
  assert.match(theme, /Temporary agents and controls/i);
  assert.match(theme, /Evidence and artifacts/i);
});

test('provides intentional desktop, tablet, and phone compositions', () => {
  assert.match(theme, /@media \(max-width: 1120px\)/);
  assert.match(theme, /@media \(max-width: 860px\)/);
  assert.match(theme, /@media \(max-width: 760px\)/);
  assert.match(theme, /@media \(max-width: 520px\)/);
  assert.match(theme, /\.sidebar-open \{ transform: translateX\(0\); \}/);
  assert.match(theme, /\.mission-hero \{ min-height: 0; grid-template-columns: 1fr;/);
  assert.match(theme, /\.metric-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(theme, /\.permission-row \{ grid-template-columns: 1fr;/);
  assert.match(theme, /\.analyze-button \{ width: 100%; min-width: 0; \}/);
});

test('keeps accessibility, motion, and asset boundaries', () => {
  assert.match(theme, /:focus-visible/);
  assert.match(theme, /prefers-reduced-motion/);
  assert.match(criticCss, /prefers-reduced-motion/);
  assert.match(criticCss, /@media \(max-width: 760px\)/);
  assert.equal(/url\s*\(\s*["']?https?:|data:image\//i.test(theme), false);
  assert.match(theme, /No Framer source, artwork/);
  assert.match(criticCss, /\.critic-drawer/);
  assert.match(criticCss, /\.finding-card/);
});

test('ships an executable viewport audit for all responsive modes', () => {
  assert.match(shell, /const DESIGN_ID = 'taskzen'/);
  assert.match(shell, /if \(width <= 760\) return 'phone'/);
  assert.match(shell, /if \(width <= 1120\) return 'tablet'/);
  assert.match(shell, /return 'desktop'/);
  assert.match(shell, /dataset\.uiOverflow/);
  assert.match(shell, /dataset\.uiUndersized/);
  assert.match(shell, /dataset\.uiClipped/);
  assert.match(shell, /ui-audit-output/);
  assert.match(shell, /drawer && globalThis\.innerWidth <= 1120/);
});

test('keeps the replacement visual layer bounded and structurally valid', () => {
  const openings = [...theme.matchAll(/\{/g)].length;
  const closings = [...theme.matchAll(/\}/g)].length;
  assert.equal(openings, closings);
  assert.ok(theme.length < 85000, 'replacement theme should remain reviewable');
  assert.ok((theme.match(/!important/g) || []).length <= 8, 'replacement theme should not depend on broad specificity overrides');
});
