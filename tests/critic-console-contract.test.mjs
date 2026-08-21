import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, consoleModule, consoleCss, criticClient, workerContract] = await Promise.all([
  readFile('apps/web/index.html', 'utf8'),
  readFile('apps/web/critic-console.js', 'utf8'),
  readFile('apps/web/critic-console.css', 'utf8'),
  readFile('apps/web/critic-client.js', 'utf8'),
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

test('console clearly exposes the worker lifecycle and non-capabilities', () => {
  assert.match(consoleModule, /One worker/);
  assert.match(consoleModule, /One provider call/);
  assert.match(consoleModule, /No tools/);
  assert.match(consoleModule, /No child agents/);
  assert.match(consoleModule, /No external actions/);
  assert.match(consoleModule, /temporary_agent/);
  assert.match(consoleModule, /Save local version/);
  assert.match(consoleModule, /harnesslab:analysis-result/);
  assert.match(consoleModule, /harnesslab:critic-result/);
  assert.equal(/OPENROUTER_API_KEY|OLLAMA_DEFAULT_MODEL|authorization\s*:/i.test(consoleModule), false);
});

test('critic client calls only the gateway worker endpoint without provider selection', () => {
  assert.match(criticClient, /\/v1\/critique/);
  assert.match(criticClient, /JSON\.stringify\(\{ result \}\)/);
  assert.equal(/provider\s*:|model\s*:|tools\s*:/i.test('JSON.stringify({ result })'), false);
  assert.match(criticClient, /WORKER_REQUIRES_GATEWAY/);
  assert.equal(/authorization\s*:/i.test(criticClient), false);
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
