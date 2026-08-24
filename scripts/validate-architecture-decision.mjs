import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const requiredFiles = [
  'apps/web/architecture-decision.js',
  'apps/web/architecture-decision-panel.js',
  'apps/web/architecture-decision-panel.css',
  'tests/architecture-decision.test.mjs',
  'tests/architecture-decision-panel-contract.test.mjs'
];

for (const path of requiredFiles) await access(path, constants.R_OK);

const [html, decision, panel, css, engine, resultContract, packageJson] = await Promise.all([
  readFile('apps/web/index.html', 'utf8'),
  readFile('apps/web/architecture-decision.js', 'utf8'),
  readFile('apps/web/architecture-decision-panel.js', 'utf8'),
  readFile('apps/web/architecture-decision-panel.css', 'utf8'),
  readFile('apps/web/engine.js', 'utf8'),
  readFile('apps/web/result-contract.js', 'utf8'),
  readFile('package.json', 'utf8')
]);

const decisionPanelIndex = html.indexOf('src="./architecture-decision-panel.js"');
const readinessIndex = html.indexOf('src="./requirement-intelligence-panel.js"');
const appIndex = html.indexOf('src="./app.js"');

const checks = [
  [decisionPanelIndex > 0 && decisionPanelIndex < readinessIndex && readinessIndex < appIndex, 'topology advisor must subscribe before retained analysis events'],
  [html.includes('agent-necessity and topology guidance'), 'page description must expose topology guidance'],
  [decision.includes("'llm-feature'"), 'LLM feature topology is required'],
  [decision.includes("'workflow'"), 'workflow topology is required'],
  [decision.includes("'single-agent'"), 'single-agent topology is required'],
  [decision.includes("'temporary-subagents'"), 'temporary-subagent topology is required'],
  [decision.includes("'external-agent-network'"), 'external-agent topology is required'],
  [decision.includes('risk never grants autonomy'), 'risk must not justify more autonomy'],
  [decision.includes("id: 'typed-functions'"), 'typed-function responsibility is required'],
  [decision.includes("id: 'mcp'"), 'MCP responsibility is required'],
  [decision.includes("id: 'retrieval'"), 'retrieval responsibility is required'],
  [decision.includes("id: 'a2a'"), 'A2A responsibility is required'],
  [decision.includes('A2A cannot be recommended without an external-agent-network topology'), 'A2A fit must be validated'],
  [decision.includes('sourcePolicy'), 'source-evidence policy is required'],
  [!decision.includes('fetch('), 'topology decision must not perform network access'],
  [!decision.includes('OPENROUTER_API_KEY'), 'topology decision must not reference provider credentials'],
  [panel.includes('HarnessLabArchitectureDecision'), 'topology advisor custom element is required'],
  [panel.includes('harnesslab:analysis-result'), 'advisor must consume retained decisions'],
  [panel.includes('textarea.value !== this.requirement'), 'advisor must synchronize programmatic composer updates'],
  [panel.includes('this.retainedDecision = null'), 'advisor must clear stale legacy decisions'],
  [panel.includes('setBackgroundInert(true)') && panel.includes('setBackgroundInert(false)'), 'advisor must manage background inertness'],
  [panel.includes("event.key === 'Escape'") && panel.includes("event.key !== 'Tab'"), 'advisor must implement modal keyboard behavior'],
  [panel.includes('aria-modal="true"'), 'advisor must expose modal semantics'],
  [panel.includes('Functions, MCP, retrieval, and A2A are not interchangeable'), 'advisor must teach protocol responsibility'],
  [!panel.includes('fetch('), 'topology advisor must not perform network access'],
  [css.includes('z-index: 110'), 'advisor must layer above the existing assistant launchers'],
  [css.includes('.factor-grid') && css.includes('.alternative-list') && css.includes('.protocol-grid'), 'advisor evidence layouts are required'],
  [css.includes('@media (max-width: 760px)'), 'advisor must support phone layouts'],
  [css.includes('prefers-reduced-motion'), 'advisor must respect reduced motion'],
  [engine.includes("from './architecture-decision.js'"), 'planner must import the topology decision engine'],
  [engine.includes('architectureDecision,'), 'planner must retain the topology decision'],
  [engine.includes("type: 'TopologyDecision'"), 'planner must retain a topology decision artifact'],
  [engine.includes("'topology.decided'"), 'planner trace must record the topology decision'],
  [engine.includes("topologyId !== 'temporary-subagents'"), 'temporary workers must require the selected topology'],
  [resultContract.includes("from './architecture-decision.js'"), 'HarnessResult must import topology validation'],
  [resultContract.includes("'architectureDecision' in value"), 'legacy results without a topology decision must remain readable'],
  [packageJson.includes('validate-architecture-decision.mjs'), 'package validation must include topology contracts']
];

for (const [condition, message] of checks) {
  if (!condition) throw new Error(message);
}

const openings = [...css.matchAll(/\{/g)].length;
const closings = [...css.matchAll(/\}/g)].length;
if (openings !== closings) throw new Error('architecture decision stylesheet braces are unbalanced');
if (/url\s*\(\s*["']?https?:|data:image\//i.test(css)) {
  throw new Error('architecture decision stylesheet must not embed remote or data-image artwork');
}

console.log('Validated deterministic topology selection, protocol responsibilities, retained HarnessResult integration, modal UI, and responsive boundaries.');
