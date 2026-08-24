import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, decision, panel, css, resultContract] = await Promise.all([
  readFile('apps/web/index.html', 'utf8'),
  readFile('apps/web/architecture-decision.js', 'utf8'),
  readFile('apps/web/architecture-decision-panel.js', 'utf8'),
  readFile('apps/web/architecture-decision-panel.css', 'utf8'),
  readFile('apps/web/result-contract.js', 'utf8')
]);

test('loads the topology advisor before requirement readiness and the main application', () => {
  const decisionIndex = html.indexOf('src="./architecture-decision-panel.js"');
  const readinessIndex = html.indexOf('src="./requirement-intelligence-panel.js"');
  const appIndex = html.indexOf('src="./app.js"');
  assert.ok(decisionIndex > 0 && decisionIndex < readinessIndex && readinessIndex < appIndex);
  assert.match(html, /agent-necessity and topology guidance/i);
});

test('keeps the decision engine deterministic, evidence-backed, and network-free', () => {
  assert.match(decision, /TOPOLOGY_IDS/);
  assert.match(decision, /smallest topology justified/i);
  assert.match(decision, /risk never grants autonomy/i);
  assert.match(decision, /typed-functions/);
  assert.match(decision, /MCP tool\/resource layer/);
  assert.match(decision, /Retrieval \/ context service/);
  assert.match(decision, /A2A interoperability/);
  assert.match(decision, /external-agent-network/);
  assert.match(decision, /temporary-subagents/);
  assert.equal(/fetch\s*\(/.test(decision), false);
  assert.equal(/OPENROUTER_API_KEY|authorization\s*:/i.test(decision), false);
});

test('exposes live and retained decisions with modal accessibility and programmatic sync', () => {
  assert.match(panel, /HarnessLabArchitectureDecision/);
  assert.match(panel, /harnesslab:analysis-result/);
  assert.match(panel, /textarea\.value !== this\.requirement/);
  assert.match(panel, /characterData: true/);
  assert.match(panel, /this\.retainedDecision = null/);
  assert.match(panel, /setBackgroundInert\(true\)/);
  assert.match(panel, /setBackgroundInert\(false\)/);
  assert.match(panel, /event\.key === 'Escape'/);
  assert.match(panel, /event\.key !== 'Tab'/);
  assert.match(panel, /aria-modal="true"/);
  assert.match(panel, /Live draft/);
  assert.match(panel, /Generated result/);
  assert.match(panel, /Functions, MCP, retrieval, and A2A are not interchangeable/);
  assert.equal(/fetch\s*\(/.test(panel), false);
});

test('keeps the topology advisor responsive and above the existing assistant launchers', () => {
  assert.match(css, /z-index: 110/);
  assert.match(css, /bottom: 152px/);
  assert.match(css, /\.factor-grid/);
  assert.match(css, /\.alternative-list/);
  assert.match(css, /\.protocol-grid/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.equal(/url\s*\(\s*["']?https?:|data:image\//i.test(css), false);
});

test('validates retained topology decisions without breaking legacy HarnessResults', () => {
  assert.match(resultContract, /validateArchitectureDecision/);
  assert.match(resultContract, /'architectureDecision' in value/);
  assert.match(resultContract, /architecture\.kind must match architectureDecision/);
});
