import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const requiredFiles = [
  'apps/web/agent-decision.js',
  'apps/web/agent-decision-panel.js',
  'apps/web/agent-decision-panel.css',
  'tests/agent-decision.test.mjs',
  'tests/agent-decision-panel-contract.test.mjs'
];

for (const path of requiredFiles) await access(path, constants.R_OK);

const [html, engine, planner, panel, css, contract] = await Promise.all([
  readFile('apps/web/index.html', 'utf8'),
  readFile('apps/web/agent-decision.js', 'utf8'),
  readFile('apps/web/engine.js', 'utf8'),
  readFile('apps/web/agent-decision-panel.js', 'utf8'),
  readFile('apps/web/agent-decision-panel.css', 'utf8'),
  readFile('apps/web/result-contract.js', 'utf8')
]);

const readinessIndex = html.indexOf('src="./requirement-intelligence-panel.js"');
const decisionIndex = html.indexOf('src="./agent-decision-panel.js"');
const criticIndex = html.indexOf('src="./critic-console.js"');
const appIndex = html.indexOf('src="./app.js"');

const checks = [
  [readinessIndex > 0 && decisionIndex > readinessIndex && criticIndex > decisionIndex && appIndex > criticIndex, 'decision advisor must load after readiness and before result events'],
  [html.includes('explicit agent-necessity decisions'), 'page description must disclose the decision advisor'],
  [engine.includes("'llm-feature'") && engine.includes("'workflow'") && engine.includes("'single-agent'") && engine.includes("'temporary-subagents'") && engine.includes("'external-agent-network'"), 'all five topology decisions are required'],
  [engine.includes('const FACTORS'), 'decision factors are required'],
  [engine.includes('alternativesFor'), 'bounded alternatives are required'],
  [engine.includes('protocolGuidance'), 'protocol responsibility guidance is required'],
  [engine.includes('Risk reduces autonomy and adds approval gates; it never justifies more agency.'), 'risk must not increase agency'],
  [engine.includes('Internal temporary workers stay inside the orchestrator and do not need A2A.'), 'A2A boundary guidance is required'],
  [engine.includes('validateAgentDecision'), 'typed decision validation is required'],
  [!engine.includes('fetch('), 'decision analysis must not perform network requests'],
  [!engine.includes('OPENROUTER_API_KEY'), 'decision analysis must not reference provider credentials'],
  [planner.includes("from './agent-decision.js'"), 'planner must import agent decisions'],
  [planner.includes('agentDecision,'), 'HarnessResult must retain the decision'],
  [planner.includes("type: 'AgentDecision'"), 'AgentDecision artifact is required'],
  [planner.includes("'agency.decided'"), 'decision trace evidence is required'],
  [planner.includes("name: 'Topology fit'"), 'topology evaluation is required'],
  [planner.includes('cannot justify a more agentic topology'), 'planner must preserve the risk rule'],
  [contract.includes("from './agent-decision.js'"), 'result contract must import decision validation'],
  [contract.includes("'agentDecision' in value"), 'legacy results without decisions must remain readable'],
  [contract.includes('architecture.kind must match the retained agentDecision selection'), 'architecture and decision must agree'],
  [panel.includes('HarnessLabAgentDecision'), 'decision advisor custom element is required'],
  [panel.includes('Nine topology factors'), 'factor view is required'],
  [panel.includes('Alternatives and upgrade conditions'), 'alternative view is required'],
  [panel.includes('Functions, MCP, retrieval, and A2A'), 'protocol view is required'],
  [panel.includes('Autonomy guidance'), 'autonomy view is required'],
  [panel.includes('setBackgroundInert(true)') && panel.includes('setBackgroundInert(false)'), 'modal background lifecycle is required'],
  [panel.includes("event.key === 'Escape'") && panel.includes("event.key !== 'Tab'"), 'modal keyboard lifecycle is required'],
  [panel.includes('aria-modal="true"'), 'modal semantics are required'],
  [panel.includes('this.retainedDecision = null'), 'legacy result state must be cleared'],
  [panel.includes('characterData: true') && panel.includes('textarea.value !== this.requirement'), 'programmatic input changes must refresh the decision'],
  [!panel.includes('fetch('), 'decision advisor must not perform network requests'],
  [css.includes('.decision-launcher') && css.includes('.decision-drawer'), 'decision visual entry and drawer are required'],
  [css.includes('.factor-grid') && css.includes('.alternative-list') && css.includes('.protocol-grid'), 'decision visual detail layouts are required'],
  [css.includes('@media (max-width: 760px)') && css.includes('@media (max-width: 430px)'), 'phone decision layouts are required'],
  [css.includes('prefers-reduced-motion'), 'decision visual must respect reduced motion']
];

for (const [condition, message] of checks) {
  if (!condition) throw new Error(message);
}

const openings = [...css.matchAll(/\{/g)].length;
const closings = [...css.matchAll(/\}/g)].length;
if (openings !== closings) throw new Error('Agent decision stylesheet braces are unbalanced.');
if (/url\s*\(\s*["']?https?:|data:image\//i.test(css)) throw new Error('Agent decision stylesheet must not embed remote or data-image artwork.');

console.log('Validated local agent necessity decisions, retained HarnessResult integration, protocol guidance, modal UI, and safety boundaries.');
