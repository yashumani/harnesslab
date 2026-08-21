import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [page, app, css] = await Promise.all([
  readFile('apps/web/index.html', 'utf8'),
  readFile('apps/web/app.js', 'utf8'),
  readFile('apps/web/react-app.css', 'utf8')
]);

test('mounts exact pinned no-build React runtimes', () => {
  assert.match(page, /id="root"/);
  assert.match(page, /react@18\.3\.1\/umd\/react\.production\.min\.js/);
  assert.match(page, /react-dom@18\.3\.1\/umd\/react-dom\.production\.min\.js/);
  assert.match(page, /htm@3\.1\.1\/dist\/htm\.umd\.js/);
  assert.match(page, /type="module" src="\.\/app\.js"/);
  assert.match(app, /HtmRuntime\.bind\(ReactRuntime\.createElement\)/);
  assert.match(app, /ReactDomRuntime\.createRoot\(rootElement\)/);
  assert.doesNotMatch(page, /text\/babel|babel-standalone/i);
  assert.doesNotMatch(page, /(?:src|href)="\.\/(?:dist|build)\//i);
});

test('preserves the existing engine, gateway, and workspace seams', () => {
  assert.match(app, /from '\.\/engine\.js'/);
  assert.match(app, /from '\.\/analysis-client\.js'/);
  assert.match(app, /from '\.\/workspace-store\.js'/);
  assert.match(app, /createAnalysisClient/);
  assert.match(app, /createWorkspaceStore/);
  assert.match(app, /RuntimeModes\.AUTOMATIC/);
  assert.match(app, /RuntimeModes\.GATEWAY/);
  assert.match(app, /saveRun/);
  assert.match(app, /exportWorkspace/);
});

test('keeps worker execution and provider credentials outside the browser', () => {
  assert.match(app, /planned, not executed/i);
  assert.match(app, /0 live workers/i);
  assert.match(app, /No provider keys in browser/);
  assert.doesNotMatch(page, /type="password"/i);
  assert.doesNotMatch(`${page}\n${app}`, /OPENROUTER_API_KEY/);
  assert.doesNotMatch(app.toLowerCase(), /authorization:\s*bearer/);
});

test('ships the responsive command-center visual system', () => {
  for (const selector of [
    '.sidebar',
    '.mission-hero',
    '.workspace-layout',
    '.runtime-panel',
    '.composer-panel',
    '.architecture-map',
    '.result-tabs',
    '.agent-card-grid',
    '.permission-table',
    '.trace-timeline',
    '.evaluation-ring'
  ]) {
    assert.ok(css.includes(selector), `missing visual selector ${selector}`);
  }
  assert.match(css, /@media\s*\(max-width:\s*1040px\)/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.equal((css.match(/{/g) || []).length, (css.match(/}/g) || []).length);
});
