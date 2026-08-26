import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, legacyTheme, responsiveCss, workspaceTheme, shell, baseCss, criticCss] = await Promise.all([
  readFile('apps/web/index.html', 'utf8'),
  readFile('apps/web/taskzen-theme.css', 'utf8'),
  readFile('apps/web/taskzen-responsive.css', 'utf8'),
  readFile('apps/web/openwebui-theme.css', 'utf8'),
  readFile('apps/web/taskzen-shell.js', 'utf8'),
  readFile('apps/web/react-app.css', 'utf8'),
  readFile('apps/web/critic-console.css', 'utf8')
]);

test('loads functional, compatibility, responsive, and workspace styles in a safe order', () => {
  const baseIndex = html.indexOf('href="./react-app.css"');
  const themeIndex = html.indexOf('href="./taskzen-theme.css"');
  const responsiveIndex = html.indexOf('href="./taskzen-responsive.css"');
  const workspaceIndex = html.indexOf('href="./openwebui-theme.css"');
  assert.ok(baseIndex > 0);
  assert.ok(themeIndex > baseIndex);
  assert.ok(responsiveIndex > themeIndex);
  assert.ok(workspaceIndex > responsiveIndex);
  assert.match(html, /src="\.\/taskzen-shell\.js"/);
  assert.match(html, /data-design="taskzen"/);
  assert.match(html, /data-workspace="openwebui-inspired"/);
  assert.match(html, /theme-color" content="#F7F8FC"/);
  assert.match(html, /AI Agent Harness Builder Workspace/);
  assert.equal(html.includes('neuronest-theme.css'), false);
});

test('uses an original neutral workspace palette instead of the former marketing hierarchy', () => {
  for (const token of ['#ffffff', '#f9f9f9', '#171717', '#e5e5e5']) {
    assert.ok(workspaceTheme.toLowerCase().includes(token), `missing workspace visual token ${token}`);
  }
  assert.match(workspaceTheme, /color-scheme: light/);
  assert.match(workspaceTheme, /--owui-sidebar-width:/);
  assert.match(workspaceTheme, /--owui-inspector-width:/);
  assert.match(workspaceTheme, /No Open WebUI source code, artwork, logo, icon asset, or stylesheet is copied/);
  assert.equal(workspaceTheme.toLowerCase().includes('#070707'), false);
});

test('replaces the landing-page composition with a complete application workspace', () => {
  for (const selector of [
    '.app-shell.owui-app',
    '.sidebar.owui-sidebar',
    '.main-content.owui-main',
    '.topbar.owui-header',
    '.owui-chat-scroll',
    '.owui-result-tabs',
    '.owui-agent-grid',
    '.owui-permission-table',
    '.owui-trace-list',
    '.owui-artifact-list',
    '.owui-composer-wrap',
    '.owui-inspector'
  ]) assert.ok(workspaceTheme.includes(selector), `${selector} is not covered by the workspace visual system`);
  assert.ok(baseCss.includes('.app-shell'));
  assert.ok(baseCss.includes('.sidebar'));
  assert.doesNotMatch(workspaceTheme, /Product-first hero|floating SaaS navigation bar|mission-hero/i);
});

test('provides intentional desktop, tablet, and phone compositions', () => {
  assert.match(workspaceTheme, /@media \(max-width: 1280px\)/);
  assert.match(workspaceTheme, /@media \(max-width: 1120px\)/);
  assert.match(workspaceTheme, /@media \(max-width: 760px\)/);
  assert.match(workspaceTheme, /@media \(max-width: 430px\)/);
  assert.match(workspaceTheme, /\.sidebar\.owui-sidebar\.sidebar-open/);
  assert.match(workspaceTheme, /\.owui-inspector-overlay\[data-open="true"\]/);
  assert.match(workspaceTheme, /\.owui-composer-wrap \{ padding: 6px 9px 8px; \}/);
  assert.match(responsiveCss, /\.result-tabs button/);
  assert.match(responsiveCss, /white-space: normal/);
});

test('keeps accessibility, motion, and asset boundaries', () => {
  assert.match(workspaceTheme, /:focus-visible/);
  assert.match(workspaceTheme, /prefers-reduced-motion/);
  assert.match(criticCss, /prefers-reduced-motion/);
  assert.match(criticCss, /@media \(max-width: 760px\)/);
  assert.equal(/url\s*\(\s*["']?https?:|data:image\//i.test(workspaceTheme), false);
  assert.equal(/url\s*\(\s*["']?https?:|data:image\//i.test(responsiveCss), false);
  assert.match(criticCss, /\.critic-drawer/);
  assert.match(criticCss, /\.finding-card/);
});

test('retains the executable viewport audit and accessible navigation drawer', () => {
  assert.match(shell, /const DESIGN_ID = 'taskzen'/);
  assert.match(shell, /const DRAWER_BREAKPOINT = 1120/);
  assert.match(shell, /if \(width <= 760\) return 'phone'/);
  assert.match(shell, /if \(width <= DRAWER_BREAKPOINT\) return 'tablet'/);
  assert.match(shell, /return 'desktop'/);
  assert.match(shell, /dataset\.uiOverflow/);
  assert.match(shell, /dataset\.uiUndersized/);
  assert.match(shell, /dataset\.uiClipped/);
  assert.match(shell, /ui-audit-output/);
  assert.match(shell, /drawer && isDrawerLayout\(\)/);
});

test('keeps all retained and replacement visual layers bounded and structurally valid', () => {
  for (const [name, css, limit] of [
    ['legacy theme', legacyTheme, 85000],
    ['responsive', responsiveCss, 12000],
    ['workspace', workspaceTheme, 85000]
  ]) {
    const openings = [...css.matchAll(/\{/g)].length;
    const closings = [...css.matchAll(/\}/g)].length;
    assert.equal(openings, closings, `${name} stylesheet braces must balance`);
    assert.ok(css.length < limit, `${name} stylesheet should remain reviewable`);
    assert.ok((css.match(/!important/g) || []).length <= 12, `${name} stylesheet should not depend on broad specificity overrides`);
  }
});
