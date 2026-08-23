import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [
  html,
  consoleModule,
  consoleCss,
  criticClient,
  browserRuntime,
  criticCore,
  workerContract
] = await Promise.all([
  readFile('apps/web/index.html', 'utf8'),
  readFile('apps/web/critic-console.js', 'utf8'),
  readFile('apps/web/critic-console.css', 'utf8'),
  readFile('apps/web/critic-client.js', 'utf8'),
  readFile('apps/web/browser-critic-runtime.js', 'utf8'),
  readFile('apps/web/critic-core.js', 'utf8'),
  readFile('apps/web/temporary-worker-contract.js', 'utf8')
]);

test('loads the bounded critic console before the main React application', () => {
  assert.equal((html.match(/id="root"/g) || []).length, 1);
  const criticIndex = html.indexOf('src="./critic-console.js"');
  const appIndex = html.indexOf('src="./app.js"');
  assert.ok(criticIndex > 0);
  assert.ok(appIndex > criticIndex);
  assert.match(html, /one bounded executable temporary critic/i);
});

test('console clearly exposes local and gateway execution with the same non-capabilities', () => {
  assert.match(consoleModule, /One worker/);
  assert.match(consoleModule, /One local invocation/);
  assert.match(consoleModule, /One provider call/);
  assert.match(consoleModule, /No tools/);
  assert.match(consoleModule, /No child agents/);
  assert.match(consoleModule, /No external actions/);
  assert.match(consoleModule, /Browser local · no network/);
  assert.match(consoleModule, /zero network requests/i);
  assert.match(consoleModule, /Executed temporary intelligence/);
  assert.match(consoleModule, /Lifecycle artifact/);
  assert.match(consoleModule, /Accepted findings/);
  assert.match(consoleModule, /Rejected findings/);
  assert.match(consoleModule, /Save local version/);
  assert.match(consoleModule, /harnesslab:analysis-result/);
  assert.match(consoleModule, /harnesslab:critic-result/);
  assert.match(consoleModule, /freshWorkspaceStore/);
  assert.equal(/OPENROUTER_API_KEY|OLLAMA_DEFAULT_MODEL|authorization\s*:/i.test(consoleModule), false);
});

test('critic client executes browser mode locally and keeps model-backed modes on the gateway endpoint', () => {
  assert.match(criticClient, /executeBrowserDeterministicCritic/);
  assert.match(criticClient, /settings\.mode === RuntimeModes\.BROWSER/);
  assert.match(criticClient, /browserCritic\(result/);
  assert.match(criticClient, /\/v1\/critique/);
  assert.match(criticClient, /JSON\.stringify\(\{ result \}\)/);
  assert.equal(/authorization\s*:/i.test(criticClient), false);
  assert.match(browserRuntime, /execution: 'browser-local'/);
  assert.match(browserRuntime, /networkRequests: 0/);
  assert.match(browserRuntime, /provider: 'deterministic'/);
});

test('portable critic core enforces minimum context and deterministic merge gates', () => {
  assert.match(criticCore, /MAX_CRITIC_CONTEXT_BYTES = 48 \* 1024/);
  assert.match(criticCore, /tools: \[\]/);
  assert.match(criticCore, /externalActions: false/);
  assert.match(criticCore, /childSpawning: false/);
  assert.match(criticCore, /modelCallBudget: 1/);
  assert.match(criticCore, /ACCEPTANCE_CONFIDENCE = 0\.7/);
  assert.match(criticCore, /Temporary critic findings cannot weaken permissions/);
});

test('worker contract enforces one call, no tools, no children, and no external actions', () => {
  assert.match(workerContract, /callBudget must equal 1/);
  assert.match(workerContract, /callsUsed must equal 1/);
  assert.match(workerContract, /childSpawning must be false/);
  assert.match(workerContract, /externalActions must be false/);
  assert.match(workerContract, /tools must be an empty array/);
});

test('critic console visual includes responsive and reduced-motion behavior', () => {
  assert.match(consoleCss, /\.critic-launcher/);
  assert.match(consoleCss, /\.critic-drawer/);
  assert.match(consoleCss, /\.finding-card/);
  assert.match(consoleCss, /@media \(max-width: 760px\)/);
  assert.match(consoleCss, /prefers-reduced-motion/);
});
