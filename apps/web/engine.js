import {
  analyzeArchitectureDecision,
  architectureFromDecision,
  protocolsFromDecision
} from './architecture-decision.js';
import { analyzeRequirementIntelligence } from './requirement-intelligence.js';

const examples = [
  {
    label: 'BI anomaly investigation',
    value: 'Build an agent that investigates telecom KPI anomalies, validates data quality, queries a SQL warehouse, compares dimensions in parallel, and produces an evidence-backed root-cause report for executives.'
  },
  {
    label: 'Safe software delivery',
    value: 'Design an agent that reads a GitHub issue, proposes code changes, runs tests, asks for human approval before deployment, and never pushes directly to production.'
  },
  {
    label: 'Research assistant',
    value: 'Create a research agent that compares trusted sources, extracts contradictory claims, cites evidence, and returns a concise market briefing.'
  }
];

const TERMS = {
  data: ['sql', 'database', 'warehouse', 'dashboard', 'kpi', 'metric', 'analytics', 'data', 'telecom', 'revenue', 'anomaly', 'root cause', 'forecast'],
  code: ['code', 'repository', 'github', 'pull request', 'test', 'deploy', 'application', 'software', 'api', 'bug', 'frontend', 'backend'],
  research: ['research', 'web', 'compare', 'source', 'market', 'literature', 'document', 'knowledge', 'policy', 'evidence'],
  communication: ['email', 'slack', 'message', 'notify', 'calendar', 'meeting', 'teams', 'send'],
  integrations: ['mcp', 'api', 'database', 'sql', 'warehouse', 'github', 'drive', 'slack', 'email', 'calendar', 'filesystem', 'tool', 'snowflake', 'bigquery', 'jira', 'linear', 'salesforce'],
  externalAgents: ['a2a', 'agent-to-agent', 'remote agent', 'partner agent', 'independent agent', 'external agent'],
  parallel: ['parallel', 'multiple', 'several', 'compare', 'investigate', 'root cause', 'anomaly', 'review', 'validate', 'security', 'audit', 'independent', 'specialist', 'complex'],
  highRisk: ['delete', 'production', 'payment', 'financial', 'medical', 'health', 'customer data', 'credential', 'secret', 'deploy', 'write', 'modify', 'send', 'approve', 'purchase', 'transfer', 'execute code'],
  retrieval: ['document', 'knowledge', 'policy', 'drive', 'search', 'research', 'historical', 'context', 'wiki', 'manual', 'runbook']
};

const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));
const count = (text, terms) => terms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);

function hashText(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

function makeSubagents(flags, complexity, risk, id, topologyId) {
  if (topologyId !== 'temporary-subagents') return [];
  const agents = [];

  if (risk >= 55) {
    agents.push(['Safety and Policy Critic', 'Challenge permissions, irreversible actions, data exposure, and missing approval gates.', 'artifact read only', `CRIT-${id}`]);
  }
  if (flags.data) {
    agents.push(
      ['Data Quality Analyst', 'Check freshness, completeness, metric definitions, and comparison-period validity before interpretation.', 'read-only dataset profile', `DATA-${id}`],
      ['Diagnostic Investigator', 'Segment the problem, test candidate drivers, and rank explanations by measured contribution.', 'read-only query interface', `DIAG-${id}`]
    );
  }
  if (flags.code) {
    agents.push(
      ['Implementation Planner', 'Map the behavior to bounded code changes, interfaces, and rollback seams.', 'repository read', `PLAN-${id}`],
      ['Test Strategist', 'Design happy-path, failure, regression, and permission tests before implementation is accepted.', 'test metadata read', `TEST-${id}`]
    );
  }
  if (flags.research) {
    agents.push(['Evidence Researcher', 'Collect relevant claims, source metadata, contradictions, and freshness signals.', 'approved source retrieval', `EVID-${id}`]);
  }
  if (flags.communication) {
    agents.push(['Communication Risk Reviewer', 'Verify recipient scope, sensitive content, reversibility, and approval requirements.', 'draft-only communication preview', `COMM-${id}`]);
  }
  if (risk < 55) {
    agents.push(['Independent Evidence Critic', 'Challenge unsupported assumptions, missing evidence, and unnecessary agent complexity.', 'artifact read only', `CRIT-${id}`]);
  }

  const maximum = complexity >= 86 ? 4 : complexity >= 72 ? 3 : 2;
  return agents.slice(0, maximum).map(([role, objective, tool, returnArtifact], index) => ({
    id: `TEMP-${index + 1}-${id.slice(0, 4)}`,
    role,
    objective,
    context: 'Minimum task-specific requirement, relevant policy clauses, and referenced artifacts only.',
    tools: [tool],
    permissions: 'Read-only unless the parent harness explicitly introduces an approval-gated action.',
    timeoutSeconds: 60 + index * 30,
    childSpawning: false,
    returnArtifact
  }));
}

function makeStages(subagents, architectureDecision) {
  const topologyId = architectureDecision.selectedTopology.id;
  const stages = [
    ['Request gateway', 'Validate input, establish a run identifier, and reject malformed requirements.', 'Deterministic'],
    ['Requirement intelligence', 'Score requirement readiness, preserve source evidence, identify gaps, and flag conservative contradictions.', 'Deterministic + evidence contract'],
    ['Topology decision', 'Choose the smallest justified architecture and explain alternatives, protocols, and autonomy limits.', 'Deterministic + typed decision contract'],
    ['Requirement compiler', 'Convert natural language into goals, constraints, risks, success criteria, and unresolved questions.', 'Reasoning + schema validation'],
    ['Context compiler', 'Assemble only the context, tools, policies, and artifacts needed by each task.', 'Deterministic']
  ];
  if (topologyId === 'single-agent') {
    stages.push(['Bounded orchestrator loop', 'Choose typed tools and revise a plan within fixed turn, time, and action limits.', 'One bounded coordinator']);
  }
  if (subagents.length) {
    stages.push(['Temporary subagent execution', `Run ${subagents.length} bounded specialist tasks with isolated context and structured returns.`, 'Parallel only when independent']);
  }
  if (topologyId === 'external-agent-network') {
    stages.push(['External agent exchange', 'Exchange authenticated tasks and validated artifacts across explicit A2A trust boundaries.', 'Planned protocol boundary']);
  }
  stages.push(
    ['Artifact judge', 'Validate schemas, compare claims, resolve conflicts, and reject unsupported conclusions.', 'Deterministic + evaluator'],
    ['Policy gate', 'Apply permissions, approval requirements, budgets, timeouts, and prohibited-action rules.', 'Deterministic'],
    ['Result synthesizer', 'Return a concise recommendation with evidence, uncertainty, artifacts, and trace references.', 'Reasoning + output validation']
  );
  return stages.map(([name, purpose, mode]) => ({ name, purpose, mode }));
}

function uniqueQuestions(...groups) {
  return [...new Set(groups.flat().filter(Boolean))].slice(0, 8);
}

export function analyzeRequirement(rawRequirement) {
  if (typeof rawRequirement !== 'string') throw new TypeError('Requirement must be a string.');
  const requirement = rawRequirement.trim();
  if (requirement.length < 8) throw new Error('Describe the agent use case in at least 8 characters.');

  const requirementAnalysis = analyzeRequirementIntelligence(requirement);
  const architectureDecision = analyzeArchitectureDecision(requirement, requirementAnalysis);
  const normalized = requirement.toLowerCase().replace(/\s+/g, ' ');
  const words = normalized.split(' ').filter(Boolean);
  const matches = Object.fromEntries(Object.entries(TERMS).map(([key, terms]) => [key, count(normalized, terms)]));
  const flags = Object.fromEntries(Object.keys(TERMS).map((key) => [key, matches[key] > 0]));
  const id = hashText(normalized);
  const domainKeys = ['data', 'code', 'research', 'communication'].filter((key) => flags[key]);
  const complexity = clamp(18 + Math.min(words.length, 80) * 0.9 + domainKeys.length * 7 + Math.min(matches.integrations, 5) * 5 + matches.parallel * 6 + (flags.externalAgents ? 10 : 0));
  const risk = clamp(12 + matches.highRisk * 13 + (flags.communication ? 8 : 0) + (flags.code && normalized.includes('deploy') ? 12 : 0) + (normalized.includes('production') ? 18 : 0));
  const architecture = architectureFromDecision(architectureDecision);
  const topologyId = architectureDecision.selectedTopology.id;
  const subagents = makeSubagents(flags, complexity, risk, id, topologyId);
  const protocols = protocolsFromDecision(architectureDecision);

  const permissions = [
    ['Read submitted requirement', 'Allow', 'Always available to the run'],
    ['Read approved context sources', flags.integrations || flags.retrieval ? 'Allowlist' : 'Not requested', flags.integrations || flags.retrieval ? 'Source-by-source grant with trace entry' : 'No external context is opened'],
    ['Spawn temporary subagents', subagents.length ? `Allow up to ${subagents.length}` : 'Disabled', 'Depth 1; no child spawning; per-worker timeout'],
    ...(topologyId === 'external-agent-network'
      ? [['Exchange tasks with external agents', 'Allowlist', 'Named peer identity, explicit capability grant, expiry, and artifact validation']]
      : []),
    ['Write or modify external systems', flags.highRisk || flags.communication || flags.code ? 'Human approval' : 'Denied by default', 'Separate action token issued only after approval'],
    ['Production deployment or deletion', 'Deny', 'Tool is not exposed in this skeleton harness'],
    ['Paid model usage', 'Deny', 'Local or explicitly free route only until human authorization']
  ].map(([capability, policy, enforcement]) => ({ capability, policy, enforcement }));

  const artifacts = [
    { id: `REQ-${id}`, type: 'RequirementSpec', status: 'Validated', retained: true },
    { id: `REQI-${id}`, type: 'RequirementAssessment', status: requirementAnalysis.status === 'ready' ? 'Validated' : 'Draft', retained: true },
    { id: architectureDecision.decisionId, type: 'TopologyDecision', status: requirementAnalysis.status === 'ready' ? 'Validated' : 'Draft', retained: true },
    { id: `HNS-${id}`, type: 'HarnessSpec', status: 'Validated', retained: true },
    ...subagents.map((agent) => ({ id: agent.returnArtifact, type: 'TemporaryAgentResult', status: 'Planned in demo', retained: true })),
    { id: `TRC-${id}`, type: 'TraceBundle', status: 'Complete', retained: true },
    { id: `EVAL-${id}`, type: 'EvaluationSummary', status: 'Complete', retained: true }
  ];

  const traceTuples = [
    ['+000ms', 'request.accepted', `Run DEMO-${id} created`],
    ['+012ms', 'requirement.assessed', `${requirementAnalysis.status} · ${requirementAnalysis.score}/100 · ${requirementAnalysis.contradictions.length} contradictions`],
    ['+024ms', 'topology.decided', `${topologyId} · ${architectureDecision.confidence}/100 · smallest justified architecture`],
    ['+038ms', 'requirement.compiled', 'Goals, supported evidence, missing dimensions, constraints, and prioritized questions compiled'],
    ['+061ms', 'architecture.selected', architecture.kind],
    ['+083ms', 'context.compiled', 'Minimum context envelopes produced'],
    ['+108ms', subagents.length ? 'subagents.planned' : 'subagents.skipped', subagents.length ? `${subagents.length} bounded temporary workers selected` : 'Additional workers did not justify their cost'],
    ['+139ms', 'artifacts.validated', 'Requirement, topology, harness, trace, and evaluation artifacts checked'],
    ['+165ms', 'policy.checked', 'Permissions, approval gates, denied actions, topology guardrails, and contradiction safeguards applied'],
    ['+191ms', 'response.ready', 'Draft harness plan rendered']
  ];
  const trace = traceTuples.map(([offset, event, detail], index) => ({ sequence: index + 1, offset, event, detail, status: 'Complete' }));

  const legacyQuestions = [];
  if (!domainKeys.length) legacyQuestions.push('Which business domain and user group will own the result?');
  if (matches.integrations) legacyQuestions.push('Which exact systems are available, and which operations must remain read-only?');
  if (!/success|acceptance|accurate|correct|quality|metric|score/.test(normalized)) legacyQuestions.push('What measurable acceptance criteria define a successful run?');
  if (words.length < 24) legacyQuestions.push('What failure consequences, latency expectation, and execution budget apply?');
  if (flags.highRisk) legacyQuestions.push('Which actions require approval, and who is authorized to approve them?');
  const unresolvedQuestions = uniqueQuestions(
    requirementAnalysis.questions.map((question) => question.question),
    legacyQuestions
  );

  const completeness = requirementAnalysis.score;
  const architectureFit = architectureDecision.confidence;
  const safety = clamp(96 - Math.max(0, risk - 65) * 0.18 - requirementAnalysis.contradictions.length * 6);
  const efficiency = clamp(97 - subagents.length * 4 - Math.max(0, complexity - 80) * 0.15);
  const traceability = 98;
  const overall = clamp((completeness + architectureFit + safety + efficiency + traceability) / 5);
  const evaluation = {
    overall,
    dimensions: [
      { name: 'Requirement completeness', score: completeness },
      { name: 'Architecture fit', score: architectureFit },
      { name: 'Safety boundary coverage', score: safety },
      { name: 'Execution efficiency', score: efficiency },
      { name: 'Traceability', score: traceability }
    ],
    verdict: requirementAnalysis.status === 'needs-input'
      ? 'Draft topology only; resolve requirement questions before live execution'
      : requirementAnalysis.status === 'draft'
        ? 'Usable draft topology with targeted requirement questions'
        : architectureDecision.confidence < 70
          ? 'Topology needs targeted evidence before implementation'
          : overall >= 90
            ? 'Strong deploy-first harness plan'
            : 'Requirement-ready plan with targeted implementation questions'
  };

  const capabilities = [];
  if (flags.data) capabilities.push('data validation and analysis');
  if (flags.code) capabilities.push('software lifecycle reasoning');
  if (flags.research) capabilities.push('evidence retrieval and synthesis');
  if (flags.communication) capabilities.push('approval-gated communication');
  if (flags.integrations) capabilities.push('permission-aware tool access');
  if (flags.externalAgents) capabilities.push('cross-agent interoperability');
  if (!capabilities.length) capabilities.push('structured interpretation and response generation');

  const confidence = clamp((requirementAnalysis.score + architectureDecision.confidence) / 2 - requirementAnalysis.contradictions.length * 4);
  const domain = domainKeys.length ? domainKeys.map((value) => value[0].toUpperCase() + value.slice(1)).join(' + ') : 'General operations';
  const readinessNote = requirementAnalysis.status === 'ready'
    ? 'The requirement is ready for a draft architecture.'
    : 'Treat this architecture as a draft until the prioritized requirement questions are resolved.';
  const executionNote = topologyId === 'temporary-subagents'
    ? `Use ${subagents.length} temporary specialists with isolated context and structured returns.`
    : topologyId === 'external-agent-network'
      ? 'Use authenticated A2A exchanges only for named external peers; do not model internal workers as A2A agents.'
      : 'Do not add temporary subagents unless evaluation evidence demonstrates a measurable gain.';

  return {
    mode: 'Deterministic demo — no live model or external tool execution',
    runId: `DEMO-${id}`,
    requirement: requirement.length > 170 ? `${requirement.slice(0, 167).trimEnd()}…` : requirement,
    domain,
    scores: { complexity, risk, confidence },
    requirementAnalysis,
    architectureDecision,
    architecture,
    recommendation: `${architectureDecision.selectedTopology.summary} ${executionNote} Preserve structured artifacts and keep external writes approval-gated. ${readinessNote}`,
    capabilities,
    protocols,
    subagents,
    stages: makeStages(subagents, architectureDecision),
    permissions,
    artifacts,
    trace,
    evaluation,
    unresolvedQuestions,
    constraints: [
      'Temporary agents receive task-specific context only.',
      'Temporary agents cannot spawn child agents in this slice.',
      'Production mutation, deletion, and paid model usage remain disabled.',
      'All retained knowledge is represented as validated artifacts and trace events.',
      'Requirement intelligence and topology factors quote only supplied evidence; unsupported details remain absent.',
      ...architectureDecision.guardrails,
      ...requirementAnalysis.contradictions.map((contradiction) => `Resolve requirement contradiction before live execution: ${contradiction.statement}`),
      'This deployed skeleton plans and critiques deterministically; it does not execute external tools.'
    ].filter((item, index, items) => items.indexOf(item) === index).slice(0, 64)
  };
}

export { examples };
