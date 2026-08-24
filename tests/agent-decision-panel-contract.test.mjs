import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, engine, panel, css, resultContract] = await Promise.all([
  readFile('apps/web/index.html', 'utf8'),
  readFile('apps/web/agent-decision.js', 'utf8'),
  readFile('apps/web/agent-decision-panel.js', 'utf8'),
  readFile('apps/web/agent-decision-panel.css', 'utf8'),
  readFile('apps/web/result-contract.js', 'utf8')
]);

test('loads the decision advisor before critic and React result events', () => {
  const requirementIndex = html.indexOf('src="./requirement-intelligence-panel.js"');
  const decisionIndex = html.indexOf('src="./agent-decision-panel.js"');
  const criticIndex = html.indexOf('src="./critic-console.js"');
  const appIndex = html.indexOf('src="./app.js"');

  assert.ok(requirementIndex > 0);
  assert.ok(decisionIndex > requirementIndex);
  assert.ok(criticIndex > decisionIndex);
  assert.ok(appIndex > criticIndex);
  assert.match(html, /explicit agent-necessity decisions/i);
});

test('advisor exposes factors, alternatives, protocols, autonomy, and readiness', () => {
  assert.match(panel, /Agent necessity advisor/);
  assert.match(panel, /Nine topology factors/);
  assert.match(panel, /Alternatives and upgrade conditions/);
  assert.match(panel, /Functions, MCP, retrieval, and A2A/);
  assert.match(panel, /Autonomy guidance/);
  assert.match(panel, /Requirement readiness/);
  assert.match(panel, /Live requirement/);
  assert.match(panel, /Generated result/);
  assert.match(panel, /harnesslab:analysis-result/);
  assert.match(panel, /this\.retainedDecision = null/);
});

test('advisor implements modal focus, inert background, and programmatic synchronization', () => {
  assert.match(panel, /setBackgroundInert\(true\)/);
  assert.match(panel, /setBackgroundInert\(false\)/);
  assert.match(panel, /event\.key === 'Escape'/);
  assert.match(panel, /event\.key !== 'Tab'/);
  assert.match(panel, /aria-modal="true"/);
  assert.match(panel, /data-action="close"/);
  assert.match(panel, /data-action="toggle"/);
  assert.match(panel, /characterData: true/);
  assert.match(panel, /textarea\.value !== this\.requirement/);
});

test('decision engine and panel remain local and credential-free', () => {
  assert.equal(/fetch\s*\(/i.test(engine), false);
  assert.equal(/fetch\s*\(/i.test(panel), false);
  assert.equal(/OPENROUTER_API_KEY|OLLAMA_DEFAULT_MODEL|authorization\s*:/i.test(`${engine}\n${panel}`), false);
  assert.match(engine, /Risk reduces autonomy and adds approval gates; it never justifies more agency/);
  assert.match(engine, /Internal temporary workers stay inside the orchestrator and do not need A2A/);
  assert.match(resultContract, /validateAgentDecision/);
  assert.match(resultContract, /architecture\.kind must match the retained agentDecision selection/);
});

test('advisor has deliberate responsive and reduced-motion behavior', () => {
  assert.match(css, /\.decision-launcher/);
  assert.match(css, /\.decision-drawer/);
  assert.match(css, /\.factor-grid/);
  assert.match(css, /\.alternative-list/);
  assert.match(css, /\.protocol-grid/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 430px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.equal(/url\s*\(\s*["']?https?:|data:image\//i.test(css), false);
});
