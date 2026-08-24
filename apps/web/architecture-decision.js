import { validateRequirementIntelligence } from './requirement-intelligence.js';

const MAX_TEXT_LENGTH = 12000;
const MAX_EVIDENCE_ITEMS = 3;
const MAX_FACTORS = 9;
const MAX_ALTERNATIVES = 5;
const MAX_PROTOCOLS = 4;

export const TOPOLOGY_IDS = Object.freeze([
  'llm-feature',
  'workflow',
  'single-agent',
  'temporary-subagents',
  'external-agent-network'
]);

const TOPOLOGIES = Object.freeze({
  'llm-feature': {
    label: 'LLM feature with deterministic wrapper',
    architectureKind: 'LLM feature with deterministic wrapper',
    rank: 0,
    summary: 'Use one bounded model call inside deterministic input, output, and policy controls.',
    autonomy: 'No autonomous loop. The application owns sequencing, validation, permissions, and retries.'
  },
  workflow: {
    label: 'Deterministic workflow',
    architectureKind: 'Deterministic workflow with bounded reasoning steps',
    rank: 1,
    summary: 'Use a fixed execution graph and introduce reasoning only at explicitly uncertain steps.',
    autonomy: 'No open-ended control loop. Every transition, retry, and failure path is predefined.'
  },
  'single-agent': {
    label: 'Single bounded agent',
    architectureKind: 'Single orchestrator with bounded tools',
    rank: 2,
    summary: 'Use one orchestrator when the system must choose tools, revise a plan, or recover within strict limits.',
    autonomy: 'One bounded loop with maximum turns, typed tools, explicit deadlines, and approval-gated writes.'
  },
  'temporary-subagents': {
    label: 'Orchestrator with temporary subagents',
    architectureKind: 'Adaptive orchestrator with temporary subagents',
    rank: 3,
    summary: 'Spawn isolated specialists only for independent workstreams that benefit from parallelism or independent review.',
    autonomy: 'Depth one, fixed worker cap, minimum context, no child spawning, structured artifacts, and deterministic judging.'
  },
  'external-agent-network': {
    label: 'Interoperating external agents',
    architectureKind: 'External agent network with A2A trust boundaries',
    rank: 4,
    summary: 'Use authenticated agent-to-agent exchange only when separately operated agents must exchange tasks and artifacts.',
    autonomy: 'No transitive authority. Every peer has an explicit identity, capability grant, artifact contract, and revocation path.'
  }
});

const FACTOR_DEFINITIONS = Object.freeze([
  {
    id: 'interpretation-uncertainty',
    label: 'Interpretation uncertainty',
    impact: 'increase-agency',
    patterns: [
      /\b(natural language|unstructured|interpret|summari[sz]e|classify|extract|compare|explain|recommend|synthesi[sz]e|root[- ]cause|contradictory claims?)\b/i
    ],
    present: 'The use case contains an interpretation step that cannot be represented entirely as fixed rules.',
    absent: 'No explicit interpretation uncertainty was found; deterministic logic may be sufficient.'
  },
  {
    id: 'deterministic-sequence',
    label: 'Deterministic sequence strength',
    impact: 'decrease-agency',
    patterns: [
      /\b(deterministic|fixed (sequence|steps?|workflow|pipeline)|predefined|rule[- ]based|checklist|exactly these steps|validate then|always (first|next|then))\b/i,
      /\b(before|after)\b[^.!?;]{0,80}\b(run|return|write|send|deploy|publish|approve)\b/i
    ],
    present: 'The requirement describes a stable sequence or explicit transition rule that a workflow can own.',
    absent: 'No sufficiently explicit fixed sequence was supplied.'
  },
  {
    id: 'iterative-planning',
    label: 'Iterative planning or recovery',
    impact: 'increase-agency',
    patterns: [
      /\b(retry|recover|replan|re-plan|iterate|until resolved|adapt|revise the plan|debug|investigate|explore alternatives?|multi[- ]step reasoning|root[- ]cause)\b/i
    ],
    present: 'The system must revise a plan, investigate, or recover based on intermediate evidence.',
    absent: 'No iterative planning or recovery loop was explicitly requested.'
  },
  {
    id: 'tool-boundaries',
    label: 'Tool and system boundaries',
    impact: 'increase-agency',
    patterns: [
      /\b(mcp|api|database|sql|warehouse|github|gitlab|drive|slack|email|calendar|filesystem|snowflake|bigquery|jira|linear|salesforce|tool|repository|browser|web search)\b/i
    ],
    present: 'The use case crosses one or more explicit tool or system boundaries.',
    absent: 'No external tool or system boundary was explicitly requested.'
  },
  {
    id: 'parallel-workstreams',
    label: 'Independent parallel workstreams',
    impact: 'increase-agency',
    patterns: [
      /\b(in parallel|parallel|independent workstreams?|independent specialists?|multiple specialists?|several specialists?|temporary subagents?|subagents?|agent swarm|compare dimensions|fan[- ]out)\b/i
    ],
    present: 'The requirement identifies work that can be isolated and evaluated independently.',
    absent: 'No independent parallel workstream was explicitly identified.'
  },
  {
    id: 'external-agent-boundary',
    label: 'External-agent trust boundary',
    impact: 'increase-agency',
    patterns: [
      /\b(a2a|agent[- ]to[- ]agent|remote agent|partner agent|external agent|independent agent|separately operated agent|third[- ]party agent)\b/i
    ],
    present: 'The requirement crosses a separately operated agent trust boundary.',
    absent: 'All requested workers can remain internal to one harness; A2A is not justified.'
  },
  {
    id: 'write-risk',
    label: 'Write or destructive action risk',
    impact: 'guardrail',
    patterns: [
      /\b(write|modify|update|delete|deploy|merge|send|publish|purchase|payment|transfer|production|execute code|credential|secret|customer data|medical|financial)\b/i
    ],
    present: 'The use case includes consequential actions or sensitive boundaries that require containment and approval.',
    absent: 'No consequential write, destructive action, or sensitive boundary was explicitly requested.'
  },
  {
    id: 'evidence-evaluation',
    label: 'Evidence and evaluation requirement',
    impact: 'confidence',
    patterns: [
      /\b(evidence|cite|citation|source|audit|trace|evaluate|evaluation|test|validate|confidence|accuracy|precision|recall|score|acceptance criteria)\b/i
    ],
    present: 'The requirement explicitly asks for evidence, validation, testing, or measurable acceptance.',
    absent: 'No explicit evidence or evaluation contract was supplied.'
  },
  {
    id: 'requirement-readiness',
    label: 'Requirement readiness',
    impact: 'confidence',
    derived: true,
    present: 'The requirement assessment is sufficiently complete for a draft topology decision.',
    absent: 'Requirement gaps or contradictions reduce decision confidence; the topology remains a draft.'
  }
]);

const INTEGRATION_PATTERNS = Object.freeze([
  ['mcp', /\bmcp\b/i],
  ['api', /\bapi\b/i],
  ['database', /\b(database|sql|warehouse|snowflake|bigquery)\b/i],
  ['github', /\b(github|gitlab|repository)\b/i],
  ['drive', /\bdrive\b/i],
  ['slack', /\bslack\b/i],
  ['email', /\bemail\b/i],
  ['calendar', /\bcalendar\b/i],
  ['filesystem', /\b(filesystem|files?)\b/i],
  ['jira-linear', /\b(jira|linear)\b/i],
  ['salesforce', /\bsalesforce\b/i],
  ['browser-web', /\b(browser|web search|internet)\b/i]
]);

const RETRIEVAL_PATTERN = /\b(document|knowledge|policy|manual|runbook|wiki|historical|source|web search|research|retrieval|rag|vector|embedding|drive|files?)\b/i;
const ALLOWED_FACTOR_STATUS = new Set(['present', 'absent', 'uncertain']);
const ALLOWED_ALTERNATIVE_STATUS = new Set(['selected', 'simpler-option', 'upgrade-path', 'not-justified']);
const ALLOWED_PROTOCOL_DECISIONS = new Set(['Recommended', 'Foundation', 'Optional', 'Not yet']);
const TOP_LEVEL_FIELDS = new Set([
  'schemaVersion', 'decisionId', 'sourcePolicy', 'selectedTopology', 'confidence',
  'summary', 'readiness', 'factors', 'alternatives', 'protocols', 'guardrails'
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isText(value, { allowEmpty = false } = {}) {
  return typeof value === 'string'
    && value.length <= MAX_TEXT_LENGTH
    && (allowEmpty || value.trim().length > 0);
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hashText(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

function normalizeRequirement(value) {
  if (typeof value !== 'string') throw new TypeError('Requirement must be a string.');
  const requirement = value.trim();
  if (requirement.length < 8) throw new Error('Describe the agent use case in at least 8 characters.');
  if (requirement.length > MAX_TEXT_LENGTH) throw new Error(`Requirement must be ${MAX_TEXT_LENGTH} characters or fewer.`);
  return requirement;
}

function splitEvidenceSegments(requirement) {
  return (requirement.match(/[^.!?;\n]+[.!?;]?/g) || [requirement])
    .map((segment) => segment.trim())
    .filter(Boolean)
    .slice(0, 64);
}

function matchingEvidence(segments, patterns) {
  const evidence = [];
  for (const segment of segments) {
    if (patterns.some((pattern) => pattern.test(segment))) {
      evidence.push(segment.slice(0, 420));
      if (evidence.length >= MAX_EVIDENCE_ITEMS) break;
    }
  }
  return [...new Set(evidence)];
}

function factorAssessment(definition, segments, requirementAnalysis) {
  if (definition.derived) {
    const contradictionEvidence = requirementAnalysis.contradictions
      .flatMap((contradiction) => contradiction.evidence)
      .slice(0, MAX_EVIDENCE_ITEMS);
    const supportedEvidence = requirementAnalysis.dimensions
      .flatMap((dimension) => dimension.evidence)
      .slice(0, MAX_EVIDENCE_ITEMS);
    const ready = requirementAnalysis.status === 'ready';
    return {
      id: definition.id,
      label: definition.label,
      status: ready ? 'present' : 'uncertain',
      impact: definition.impact,
      summary: ready ? definition.present : definition.absent,
      evidence: ready ? supportedEvidence : (contradictionEvidence.length ? contradictionEvidence : supportedEvidence)
    };
  }

  const evidence = matchingEvidence(segments, definition.patterns);
  return {
    id: definition.id,
    label: definition.label,
    status: evidence.length ? 'present' : 'absent',
    impact: definition.impact,
    summary: evidence.length ? definition.present : definition.absent,
    evidence
  };
}

function countIntegrations(requirement) {
  return INTEGRATION_PATTERNS.filter(([, pattern]) => pattern.test(requirement)).length;
}

function factorPresent(factors, id) {
  return factors.find((factor) => factor.id === id)?.status === 'present';
}

function selectTopology(factors, integrationCount) {
  const external = factorPresent(factors, 'external-agent-boundary');
  const parallel = factorPresent(factors, 'parallel-workstreams');
  const iterative = factorPresent(factors, 'iterative-planning');
  const tools = factorPresent(factors, 'tool-boundaries');
  const interpretation = factorPresent(factors, 'interpretation-uncertainty');
  const deterministic = factorPresent(factors, 'deterministic-sequence');
  const evidence = factorPresent(factors, 'evidence-evaluation');

  if (external) return 'external-agent-network';
  if (parallel && (iterative || tools || interpretation || evidence)) return 'temporary-subagents';
  if (iterative && (tools || interpretation || evidence)) return 'single-agent';
  if (tools && interpretation && !deterministic) return 'single-agent';
  if (tools && integrationCount >= 2 && !deterministic) return 'single-agent';
  if (deterministic) return 'workflow';
  if (interpretation) return 'llm-feature';
  return 'workflow';
}

function selectedRationale(topologyId, factors) {
  const present = factors.filter((factor) => factor.status === 'present');
  const labels = present
    .filter((factor) => factor.id !== 'write-risk' && factor.id !== 'requirement-readiness')
    .slice(0, 3)
    .map((factor) => factor.label.toLowerCase());
  const basis = labels.length ? labels.join(', ') : 'the absence of a justified autonomous control loop';
  return `${TOPOLOGIES[topologyId].summary} The decision is based on ${basis}.`;
}

function alternativeStatus(candidateId, selectedId) {
  if (candidateId === selectedId) return 'selected';
  const candidateRank = TOPOLOGIES[candidateId].rank;
  const selectedRank = TOPOLOGIES[selectedId].rank;
  if (candidateRank < selectedRank) return 'simpler-option';
  if (candidateRank > selectedRank) return 'upgrade-path';
  return 'not-justified';
}

function alternativeReason(candidateId, selectedId, factors) {
  if (candidateId === selectedId) return 'Selected because the supplied evidence best matches this topology.';
  if (candidateId === 'external-agent-network' && !factorPresent(factors, 'external-agent-boundary')) {
    return 'Not justified: no separately operated agent trust boundary was supplied.';
  }
  if (candidateId === 'temporary-subagents' && !factorPresent(factors, 'parallel-workstreams')) {
    return 'Not justified now: independent parallel workstreams were not explicitly identified.';
  }
  if (candidateId === 'single-agent' && !factorPresent(factors, 'iterative-planning') && !factorPresent(factors, 'tool-boundaries')) {
    return 'Not justified now: no bounded planning loop or tool-choice problem was supplied.';
  }
  if (candidateId === 'workflow' && factorPresent(factors, 'iterative-planning')) {
    return 'A workflow is a viable simplification only if planning and recovery can be converted into fixed transitions.';
  }
  if (candidateId === 'llm-feature' && factorPresent(factors, 'tool-boundaries')) {
    return 'A single model feature is too narrow while the requirement still crosses tool or system boundaries.';
  }
  return TOPOLOGIES[candidateId].rank < TOPOLOGIES[selectedId].rank
    ? 'Viable as a simpler option if the higher-agency factors can be removed or made deterministic.'
    : 'Use only after measured evidence shows the selected topology cannot meet accuracy, latency, or coverage requirements.';
}

function upgradeCondition(candidateId) {
  if (candidateId === 'llm-feature') return 'Use when one uncertain transformation is needed and the application can own every other step.';
  if (candidateId === 'workflow') return 'Use when sequencing, retries, and tool calls can be represented as fixed transitions.';
  if (candidateId === 'single-agent') return 'Upgrade when one bounded coordinator must choose tools or revise a plan from intermediate results.';
  if (candidateId === 'temporary-subagents') return 'Upgrade only when at least two independent workstreams show a measurable quality or latency gain.';
  return 'Upgrade only when a separately operated agent must exchange authenticated tasks and validated artifacts.';
}

function protocolAdvisor(requirement, segments, factors, selectedId, integrationCount) {
  const toolEvidence = factors.find((factor) => factor.id === 'tool-boundaries')?.evidence || [];
  const externalEvidence = factors.find((factor) => factor.id === 'external-agent-boundary')?.evidence || [];
  const retrievalEvidence = matchingEvidence(segments, [RETRIEVAL_PATTERN]);
  const explicitMcp = /\bmcp\b/i.test(requirement);
  const mcpRecommended = explicitMcp || integrationCount >= 2;
  const a2aRecommended = selectedId === 'external-agent-network';

  return [
    {
      id: 'typed-functions',
      label: 'Typed functions',
      decision: toolEvidence.length ? (mcpRecommended ? 'Foundation' : 'Recommended') : 'Optional',
      responsibility: 'Expose narrow, schema-validated operations inside one application or service boundary.',
      rationale: toolEvidence.length
        ? 'Start with explicit typed operations so permissions, arguments, errors, and audit events remain deterministic.'
        : 'No tool boundary is required yet; introduce typed functions before any broader protocol.',
      evidence: toolEvidence.slice(0, MAX_EVIDENCE_ITEMS)
    },
    {
      id: 'mcp',
      label: 'MCP tool/resource layer',
      decision: mcpRecommended ? 'Recommended' : toolEvidence.length ? 'Optional' : 'Not yet',
      responsibility: 'Standardize discoverable tools, resources, prompts, and capability boundaries for model-facing integrations.',
      rationale: mcpRecommended
        ? 'Multiple integrations or an explicit MCP requirement justify a permission-aware standard interface.'
        : 'A direct typed interface is simpler until multiple reusable model-facing integrations exist.',
      evidence: explicitMcp ? matchingEvidence(segments, [/\bmcp\b/i]) : toolEvidence.slice(0, MAX_EVIDENCE_ITEMS)
    },
    {
      id: 'retrieval',
      label: 'Retrieval / context service',
      decision: retrievalEvidence.length ? 'Recommended' : factorPresent(factors, 'evidence-evaluation') ? 'Optional' : 'Not yet',
      responsibility: 'Select, source, freshness-check, and cite knowledge without granting action authority.',
      rationale: retrievalEvidence.length
        ? 'The use case depends on documents, knowledge, historical context, or trusted sources.'
        : 'Add retrieval only when the harness needs evidence beyond the submitted requirement and current artifacts.',
      evidence: retrievalEvidence
    },
    {
      id: 'a2a',
      label: 'A2A interoperability',
      decision: a2aRecommended ? 'Recommended' : 'Not yet',
      responsibility: 'Exchange tasks and artifacts across separately operated agent identities and trust boundaries.',
      rationale: a2aRecommended
        ? 'A separately operated agent boundary is explicit; use authenticated peer identity, capability grants, and artifact validation.'
        : 'Internal temporary workers are orchestration details and do not require A2A.',
      evidence: externalEvidence.slice(0, MAX_EVIDENCE_ITEMS)
    }
  ];
}

function buildGuardrails(selectedId, factors, requirementAnalysis) {
  const guardrails = [
    TOPOLOGIES[selectedId].autonomy,
    'All model or agent outputs remain advisory until schema, policy, and evidence validation succeeds.',
    'Provider choice cannot expand tool, data, write, or production permissions.'
  ];
  if (factorPresent(factors, 'write-risk')) {
    guardrails.push('Risk evidence never increases autonomy; writes and irreversible actions require explicit approval or remain denied.');
  }
  if (selectedId === 'temporary-subagents') {
    guardrails.push('Temporary workers receive minimum context, no child-spawning authority, fixed budgets, and structured return artifacts only.');
  }
  if (selectedId === 'external-agent-network') {
    guardrails.push('External peers receive no transitive authority; each task exchange requires identity, allowlisted capability, expiry, and revocation.');
  }
  if (requirementAnalysis.status !== 'ready') {
    guardrails.push('This is a draft topology decision until prioritized requirement gaps and contradictions are resolved.');
  }
  return [...new Set(guardrails)].slice(0, 12);
}

function decisionConfidence(selectedId, factors, requirementAnalysis) {
  const selectedSupport = factors.filter((factor) => factor.status === 'present' && factor.impact === 'increase-agency').length;
  let score = 82 + Math.min(10, selectedSupport * 3);
  if (selectedId === 'workflow' && factorPresent(factors, 'deterministic-sequence')) score += 5;
  if (requirementAnalysis.status === 'draft') score -= 10;
  if (requirementAnalysis.status === 'needs-input') score -= 20;
  score -= requirementAnalysis.contradictions.length * 6;
  return clampScore(Math.max(35, Math.min(98, score)));
}

export function analyzeArchitectureDecision(rawRequirement, requirementAnalysis) {
  const requirement = normalizeRequirement(rawRequirement);
  const requirementValidation = validateRequirementIntelligence(requirementAnalysis);
  if (!requirementValidation.valid) {
    throw new ArchitectureDecisionValidationError([
      'A validated requirement assessment is required before topology selection.',
      ...requirementValidation.errors.slice(0, 3)
    ]);
  }

  const segments = splitEvidenceSegments(requirement);
  const factors = FACTOR_DEFINITIONS.map((definition) => factorAssessment(definition, segments, requirementAnalysis));
  const integrationCount = countIntegrations(requirement);
  const selectedId = selectTopology(factors, integrationCount);
  const topology = TOPOLOGIES[selectedId];
  const confidence = decisionConfidence(selectedId, factors, requirementAnalysis);
  const protocols = protocolAdvisor(requirement, segments, factors, selectedId, integrationCount);
  const decision = {
    schemaVersion: 1,
    decisionId: `TOPO-${hashText(requirement.toLowerCase().replace(/\s+/g, ' '))}`,
    sourcePolicy: 'Topology factors quote only the supplied requirement; absent evidence remains absent and risk never grants autonomy.',
    selectedTopology: {
      id: selectedId,
      label: topology.label,
      architectureKind: topology.architectureKind,
      summary: topology.summary,
      rationale: selectedRationale(selectedId, factors),
      autonomy: topology.autonomy
    },
    confidence,
    summary: `${topology.label} is the smallest topology justified by the current evidence (${confidence}/100 decision confidence).`,
    readiness: {
      status: requirementAnalysis.status,
      score: requirementAnalysis.score,
      contradictions: requirementAnalysis.contradictions.length
    },
    factors,
    alternatives: TOPOLOGY_IDS.map((candidateId) => ({
      id: candidateId,
      label: TOPOLOGIES[candidateId].label,
      status: alternativeStatus(candidateId, selectedId),
      reason: alternativeReason(candidateId, selectedId, factors),
      upgradeCondition: upgradeCondition(candidateId)
    })),
    protocols,
    guardrails: buildGuardrails(selectedId, factors, requirementAnalysis)
  };

  assertArchitectureDecision(decision);
  return decision;
}

function validateAllowedFields(value, allowed, path, errors) {
  if (!isRecord(value)) return;
  const unexpected = Object.keys(value).filter((field) => !allowed.has(field));
  if (unexpected.length) errors.push(`${path} contains unsupported field ${unexpected[0]}.`);
}

export function validateArchitectureDecision(value) {
  const errors = [];
  if (!isRecord(value)) return { valid: false, errors: ['architectureDecision must be an object.'] };
  validateAllowedFields(value, TOP_LEVEL_FIELDS, 'architectureDecision', errors);
  if (value.schemaVersion !== 1) errors.push('architectureDecision.schemaVersion must equal 1.');
  if (!isText(value.decisionId)) errors.push('architectureDecision.decisionId must be text.');
  if (!isText(value.sourcePolicy)) errors.push('architectureDecision.sourcePolicy must be text.');
  if (!Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 100) errors.push('architectureDecision.confidence must be between 0 and 100.');
  if (!isText(value.summary)) errors.push('architectureDecision.summary must be text.');

  if (!isRecord(value.selectedTopology)) {
    errors.push('architectureDecision.selectedTopology must be an object.');
  } else {
    validateAllowedFields(value.selectedTopology, new Set(['id', 'label', 'architectureKind', 'summary', 'rationale', 'autonomy']), 'architectureDecision.selectedTopology', errors);
    const topology = TOPOLOGIES[value.selectedTopology.id];
    if (!topology) errors.push('architectureDecision.selectedTopology.id is invalid.');
    for (const field of ['label', 'architectureKind', 'summary', 'rationale', 'autonomy']) {
      if (!isText(value.selectedTopology[field])) errors.push(`architectureDecision.selectedTopology.${field} must be text.`);
    }
    if (topology && (value.selectedTopology.label !== topology.label || value.selectedTopology.architectureKind !== topology.architectureKind)) {
      errors.push('architectureDecision.selectedTopology metadata is inconsistent.');
    }
  }

  if (!isRecord(value.readiness)
    || !['ready', 'draft', 'needs-input'].includes(value.readiness.status)
    || !Number.isFinite(value.readiness.score)
    || value.readiness.score < 0
    || value.readiness.score > 100
    || !Number.isInteger(value.readiness.contradictions)
    || value.readiness.contradictions < 0) {
    errors.push('architectureDecision.readiness is invalid.');
  }

  if (!Array.isArray(value.factors) || value.factors.length !== MAX_FACTORS) {
    errors.push(`architectureDecision.factors must contain ${MAX_FACTORS} entries.`);
  } else {
    const expectedIds = new Set(FACTOR_DEFINITIONS.map((factor) => factor.id));
    const seen = new Set();
    value.factors.forEach((factor, index) => {
      if (!isRecord(factor)) {
        errors.push(`architectureDecision.factors[${index}] must be an object.`);
        return;
      }
      validateAllowedFields(factor, new Set(['id', 'label', 'status', 'impact', 'summary', 'evidence']), `architectureDecision.factors[${index}]`, errors);
      if (!expectedIds.has(factor.id) || seen.has(factor.id)) errors.push(`architectureDecision.factors[${index}].id is invalid.`);
      seen.add(factor.id);
      if (!isText(factor.label) || !isText(factor.summary) || !isText(factor.impact)) errors.push(`architectureDecision.factors[${index}] text fields are invalid.`);
      if (!ALLOWED_FACTOR_STATUS.has(factor.status)) errors.push(`architectureDecision.factors[${index}].status is invalid.`);
      if (!Array.isArray(factor.evidence) || factor.evidence.length > MAX_EVIDENCE_ITEMS || factor.evidence.some((item) => !isText(item))) {
        errors.push(`architectureDecision.factors[${index}].evidence is invalid.`);
      }
      if (factor.status === 'present' && factor.evidence.length === 0) errors.push(`architectureDecision.factors[${index}] requires evidence when present.`);
      if (factor.status === 'absent' && factor.evidence.length !== 0) errors.push(`architectureDecision.factors[${index}] cannot include evidence when absent.`);
    });
  }

  if (!Array.isArray(value.alternatives) || value.alternatives.length !== MAX_ALTERNATIVES) {
    errors.push(`architectureDecision.alternatives must contain ${MAX_ALTERNATIVES} entries.`);
  } else {
    const seen = new Set();
    let selectedCount = 0;
    value.alternatives.forEach((alternative, index) => {
      if (!isRecord(alternative)) {
        errors.push(`architectureDecision.alternatives[${index}] must be an object.`);
        return;
      }
      validateAllowedFields(alternative, new Set(['id', 'label', 'status', 'reason', 'upgradeCondition']), `architectureDecision.alternatives[${index}]`, errors);
      if (!TOPOLOGY_IDS.includes(alternative.id) || seen.has(alternative.id)) errors.push(`architectureDecision.alternatives[${index}].id is invalid.`);
      seen.add(alternative.id);
      if (!isText(alternative.label) || !isText(alternative.reason) || !isText(alternative.upgradeCondition)) errors.push(`architectureDecision.alternatives[${index}] text fields are invalid.`);
      if (!ALLOWED_ALTERNATIVE_STATUS.has(alternative.status)) errors.push(`architectureDecision.alternatives[${index}].status is invalid.`);
      if (alternative.status === 'selected') {
        selectedCount += 1;
        if (alternative.id !== value.selectedTopology?.id) errors.push('Selected alternative does not match selectedTopology.');
      }
    });
    if (selectedCount !== 1) errors.push('architectureDecision.alternatives must contain exactly one selected topology.');
  }

  if (!Array.isArray(value.protocols) || value.protocols.length !== MAX_PROTOCOLS) {
    errors.push(`architectureDecision.protocols must contain ${MAX_PROTOCOLS} entries.`);
  } else {
    const expected = new Set(['typed-functions', 'mcp', 'retrieval', 'a2a']);
    const seen = new Set();
    value.protocols.forEach((protocol, index) => {
      if (!isRecord(protocol)) {
        errors.push(`architectureDecision.protocols[${index}] must be an object.`);
        return;
      }
      validateAllowedFields(protocol, new Set(['id', 'label', 'decision', 'responsibility', 'rationale', 'evidence']), `architectureDecision.protocols[${index}]`, errors);
      if (!expected.has(protocol.id) || seen.has(protocol.id)) errors.push(`architectureDecision.protocols[${index}].id is invalid.`);
      seen.add(protocol.id);
      if (!isText(protocol.label) || !isText(protocol.responsibility) || !isText(protocol.rationale)) errors.push(`architectureDecision.protocols[${index}] text fields are invalid.`);
      if (!ALLOWED_PROTOCOL_DECISIONS.has(protocol.decision)) errors.push(`architectureDecision.protocols[${index}].decision is invalid.`);
      if (!Array.isArray(protocol.evidence) || protocol.evidence.length > MAX_EVIDENCE_ITEMS || protocol.evidence.some((item) => !isText(item))) {
        errors.push(`architectureDecision.protocols[${index}].evidence is invalid.`);
      }
    });
    const a2a = value.protocols.find((protocol) => protocol.id === 'a2a');
    if (a2a?.decision === 'Recommended' && value.selectedTopology?.id !== 'external-agent-network') {
      errors.push('A2A cannot be recommended without an external-agent-network topology.');
    }
  }

  if (!Array.isArray(value.guardrails) || value.guardrails.length === 0 || value.guardrails.length > 12 || value.guardrails.some((item) => !isText(item))) {
    errors.push('architectureDecision.guardrails must be a bounded non-empty text array.');
  }

  return { valid: errors.length === 0, errors };
}

export class ArchitectureDecisionValidationError extends Error {
  constructor(errors) {
    super(`Architecture decision failed validation: ${errors.slice(0, 4).join(' ')}`);
    this.name = 'ArchitectureDecisionValidationError';
    this.code = 'INVALID_ARCHITECTURE_DECISION';
    this.errors = [...errors];
  }
}

export function assertArchitectureDecision(value) {
  const validation = validateArchitectureDecision(value);
  if (!validation.valid) throw new ArchitectureDecisionValidationError(validation.errors);
  return value;
}

export function architectureFromDecision(decision) {
  assertArchitectureDecision(decision);
  return {
    kind: decision.selectedTopology.architectureKind,
    reason: decision.selectedTopology.rationale
  };
}

export function protocolsFromDecision(decision) {
  assertArchitectureDecision(decision);
  return decision.protocols.map((protocol) => ({
    name: protocol.label,
    decision: protocol.decision,
    rationale: `${protocol.responsibility} ${protocol.rationale}`
  }));
}

export { TOPOLOGIES as topologyDefinitions, FACTOR_DEFINITIONS as architectureFactorDefinitions };
