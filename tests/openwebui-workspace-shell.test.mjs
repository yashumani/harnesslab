import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [page, app, theme, responsiveHardening, consoleBridge] = await Promise.all([
  readFile('apps/web/index.html', 'utf8'),
  readFile('apps/web/app.js', 'utf8'),
  readFile('apps/web/openwebui-theme.css', 'utf8'),
  readFile('apps/web/openwebui-responsive-hardening.css', 'utf8'),
  readFile('apps/web/openwebui-console-bridge.js', 'utf8')
]);

test('loads the Open WebUI-inspired workspace layer after compatibility styles', () => {
  assert.match(page, /data-workspace="openwebui-inspired"/);
  assert.ok(page.indexOf('href="./openwebui-theme.css"') > page.indexOf('href="./taskzen-responsive.css"'));
  assert.ok(page.indexOf('href="./openwebui-responsive-hardening.css"') > page.indexOf('href="./openwebui-theme.css"'));
  assert.match(page, /src="\.\/openwebui-console-bridge\.js"/);
  assert.match(page, /No Open WebUI source, branding, artwork, or assets are bundled/);
});

test('replaces the marketing page with one chat-centered application shell', () => {
  assert.match(app, /data-ui-pattern="openwebui"/);
  assert.match(app, />New harness</);
  assert.match(app, /Search projects and runs/);
  assert.match(app, /owui-chat-scroll/);
  assert.match(app, /owui-composer/);
  assert.match(app, /owui-inspector/);
  assert.match(app, /MAIN_VIEWS\.CHAT/);
  assert.doesNotMatch(app, /MissionHero|mission-hero/);
});

test('preserves projects, runtime controls, artifacts, and critic integration', () => {
  for (const pattern of [
    /createWorkspaceStore/,
    /createAnalysisClient/,
    /RuntimeModes\.AUTOMATIC/,
    /RuntimeModes\.GATEWAY/,
    /saveRun/,
    /exportWorkspace/,
    /harnesslab:analysis-result/,
    /Blueprint/,
    /temporary agents planned/,
    /Controls/,
    /Evidence/,
    /Harness JSON/
  ]) assert.match(app, pattern);
  assert.match(app, /No provider keys in browser/);
  assert.match(app, /planned, not executed/i);
  assert.match(app, /0 live workers/i);
});

test('uses an original responsive workspace visual system without remote artwork', () => {
  for (const selector of [
    '.sidebar.owui-sidebar',
    '.topbar.owui-header',
    '.owui-chat-scroll',
    '.owui-composer-wrap',
    '.owui-inspector',
    '.owui-page-scroll',
    '.owui-page-heading',
    '.owui-settings-card'
  ]) assert.ok(theme.includes(selector), `missing workspace selector ${selector}`);
  assert.match(theme, /@media \(max-width: 1280px\)/);
  assert.match(theme, /@media \(max-width: 1120px\)/);
  assert.match(theme, /@media \(max-width: 760px\)/);
  assert.match(theme, /prefers-reduced-motion/);
  assert.doesNotMatch(theme, /url\s*\(\s*["']?https?:|data:image\//i);
  assert.equal((theme.match(/{/g) || []).length, (theme.match(/}/g) || []).length);
});

test('keeps phone controls reachable and embedded consoles off the composer', () => {
  assert.match(responsiveHardening, /menu-button\.owui-icon-button/);
  assert.match(responsiveHardening, /min-height: 42px/);
  assert.match(consoleBridge, /harnesslab-requirement-intelligence/);
  assert.match(consoleBridge, /harnesslab-critic-console/);
  assert.match(consoleBridge, /top: 128px/);
  assert.match(consoleBridge, /top: 184px/);
  assert.match(consoleBridge, /MutationObserver/);
  assert.doesNotMatch(consoleBridge, /fetch\(|XMLHttpRequest|WebSocket/);
});
