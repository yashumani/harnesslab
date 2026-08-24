import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const COMPOSER_SELECTOR_LITERAL = 'textarea[aria-label="Agent system requirement"]';
const requiredFiles = [
  'apps/web/requirement-intelligence.js',
  'apps/web/requirement-intelligence-panel.js',
  'apps/web/requirement-intelligence-panel.css',
  'tests/requirement-intelligence.test.mjs',
  'tests/requirement-contradictions.test.mjs'
];

for (const path of requiredFiles) await access(path, constants.R_OK);

const [html, intelligence, panel, css, engine, resultContract] = await Promise.all([
  readFile('apps/web/index.html', 'utf8'),
  readFile('apps/web/requirement-intelligence.js', 'utf8'),
  readFile('apps/web/requirement-intelligence-panel.js', 'utf8'),
  readFile('apps/web/requirement-intelligence-panel.css', 'utf8'),
  readFile('apps/web/engine.js', 'utf8'),
  readFile('apps/web/result-contract.js', 'utf8')
]);

const panelIndex = html.indexOf('src="./requirement-intelligence-panel.js"');
const criticIndex = html.indexOf('src="./critic-console.js"');
const appIndex = html.indexOf('src="./app.js"');

const checks = [
  [panelIndex > 0 && panelIndex < criticIndex && criticIndex < appIndex, 'requirement coach must subscribe before the app emits its first result'],
  [html.includes('evidence-backed requirement readiness'), 'page description must disclose requirement readiness'],
  [intelligence.includes('const DIMENSIONS'), 'intelligence engine must define requirement dimensions'],
  [intelligence.includes('MAX_DIMENSIONS = 10'), 'intelligence engine must retain ten dimensions'],
  [intelligence.includes('sourcePolicy'), 'intelligence engine must disclose source-only evidence'],
  [intelligence.includes('contradictionAssessment'), 'intelligence engine must evaluate contradictions'],
  [intelligence.includes('prioritizedQuestions'), 'intelligence engine must prioritize follow-up questions'],
  [intelligence.includes('validateRequirementIntelligence'), 'intelligence engine must expose a typed validator'],
  [intelligence.includes('Evidence is quoted only from the supplied requirement'), 'unsupported facts must remain missing'],
  [!intelligence.includes('fetch('), 'requirement intelligence must not make network requests'],
  [!intelligence.includes('OPENROUTER_API_KEY'), 'requirement intelligence must not reference provider credentials'],
  [panel.includes('HarnessLabRequirementIntelligence'), 'requirement coach custom element is required'],
  [panel.includes('harnesslab:analysis-result'), 'requirement coach must consume retained result assessments'],
  [panel.includes(COMPOSER_SELECTOR_LITERAL), 'requirement coach must observe the existing composer'],
  [panel.includes('Live draft') && panel.includes('Generated result'), 'coach must distinguish live and retained assessments'],
  [panel.includes('Ten requirement dimensions'), 'coach must expose the complete evidence map'],
  [panel.includes('Explicit contradictions'), 'coach must expose contradictions'],
  [panel.includes('Prioritized questions'), 'coach must expose guided interview questions'],
  [!panel.includes('fetch('), 'requirement coach must not make network requests'],
  [css.includes('.readiness-launcher'), 'coach launcher styling is required'],
  [css.includes('.readiness-drawer'), 'coach drawer styling is required'],
  [css.includes('.dimension-grid'), 'dimension evidence styling is required'],
  [css.includes('.contradiction-card'), 'contradiction styling is required'],
  [css.includes('.question-card'), 'guided-question styling is required'],
  [css.includes('@media (max-width: 760px)'), 'coach must support phone layouts'],
  [css.includes('prefers-reduced-motion'), 'coach must respect reduced-motion preferences'],
  [engine.includes("from './requirement-intelligence.js'"), 'planner must import requirement intelligence'],
  [engine.includes('requirementAnalysis,'), 'planner must retain the assessment in HarnessResult'],
  [engine.includes("type: 'RequirementAssessment'"), 'planner must retain a requirement assessment artifact'],
  [engine.includes("'requirement.assessed'"), 'planner trace must record requirement assessment'],
  [resultContract.includes("from './requirement-intelligence.js'"), 'result contract must validate assessment when present'],
  [resultContract.includes("'requirementAnalysis' in value"), 'legacy results without an assessment must remain readable']
];

for (const [condition, message] of checks) {
  if (!condition) throw new Error(message);
}

const openings = [...css.matchAll(/\{/g)].length;
const closings = [...css.matchAll(/\}/g)].length;
if (openings !== closings) throw new Error('panel stylesheet braces are unbalanced');
if (/url\s*\(\s*["']?https?:|data:image\//i.test(css)) {
  throw new Error('panel stylesheet must not embed remote or data-image artwork');
}

console.log('Validated deterministic requirement intelligence, retained result contract, coach UI, and responsive boundaries.');
