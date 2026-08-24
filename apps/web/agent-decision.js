const MAX_TEXT_LENGTH = 12000;
const MAX_EVIDENCE_ITEMS = 3;
const MAX_FACTORS = 9;
const MODES = Object.freeze([
  'llm-feature',
  'workflow',
  'single-agent',
  'temporary-subagents',
  'external-agent-network'
]);

const MODE_LABELS = Object.freeze({
  'llm-feature': 'LLM feature with deterministic wrapper',
  workflow: 'Deterministic workflow with one reasoning step',
  'single-agent': 'Single bounded agent',
  'temporary-subagents': 'Orchestrator with temporary subagents',
  'external-agent-network': 'Interoperating external-agent network'
});

const TOP_LEVEL_FIELDS = new Set([
  'schemaVersion', 'decisionId', 'sourcePolicy', 'selected', 'factors',
  'alternatives', 'protocols', 'autonomy', 'readiness'
]);

const FACTORS = Object.freeze([
  {
    id: 'interpretation',
    label: 'Interpretation uncertainty',
    weight: 14,
    patterns: [
      /\b(interpret|reason|research|compare|investigate|diagnose|recommend|ambiguous|contradictory|root[- ]cause)\b/i,
      /\b(propose|review|evaluate|explain|rank|prioriti[sz]e|synthesi[sz]e)\b/i
    ],
    effect: 'Reasoning is useful when the request cannot be reduced to fixed transforms or lookups.'
  },
  {
    id: 'determinism',
    label: 'Deterministic sequence strength',
    weight: 13,
    patterns: [
      /\b(fixed|exact|predefined|step[- ]by[- ]step|template|schema|rules?|classification|extract|convert|format|three action items|single response)\b/i,
      /\b(always|only after|in this order|must follow)\b/i
    ],
    effect: 'Strong fixed sequencing favors a workflow over an autonomous control loop.'
  },
  {
    id: 'iteration',
    label: 'Iterative planning and recovery',
    weight: 14,
    patterns: [
      /\b(retry|recover|iterate|plan|debug|monitor|until|replan|investigate|root[- ]cause|test candidate|failure|fallback)\b/i,
      /\b(run tests?|propose changes?|patch|pull request|review feedback|next action|intermediate results?)\b/i
    ],
    effect: 'A bounded agent becomes useful when the next action depends on observed intermediate results.'
  },
  {
    id: 'tools',
    label: 'Tool and system boundaries',
    weight: 12,
    patterns: [
      /\b(database|sql|warehouse|snowflake|bigquery|data source)\b/i,
      /\b(github|gitlab|repository|filesystem|jira|linear)\b/i,
      /\b(drive|slack|email|calendar|salesforce)\b/i,
      /\b(api|mcp|tool|integration|external system)\b/i
    ],
    effect: 'Typed tools or MCP are needed only for explicitly required capabilities.'
  },
  {
    id: 'parallelism',
    label: 'Independent parallel workstreams',
    weight: 13,
    patterns: [
      /\b(parallel|independent workstreams?|independent specialists?|multiple specialists?|separate analyses|concurrently|in parallel|fan[- ]out|map[- ]reduce)\b/i
    ],
    effect: 'Temporary subagents are justified only when workstreams are genuinely independent.'
  },
  {
    id: 'externalBoundary',
    label: 'External-agent trust boundary',
    weight: 14,
    patterns: [
      /\b(a2a|agent[- ]to[- ]agent|remote agent|partner agent|external agent|independent agent service|separately operated agent)\b/i
    ],
    effect: 'A2A is for separately operated agents, not internal temporary workers.'
  },
  {
    id: 'risk',
    label: 'Irreversible or sensitive actions',
    weight: 9,
    patterns: [
      /\b(delete|production|deploy|payment|purchase|transfer|credential|secret|customer data|medical|health|write|modify|send|publish|merge)\b/i
    ],
    effect: 'Risk reduces autonomy and adds approval gates; it never justifies more agency.'
  },
  {
    id: 'evidence',
    label: 'Evidence and evaluation burden',
    weight: 7,
    patterns: [
      /\b(evidence|cite|citation|validate|verify|audit|trace|confidence|evaluation|score|acceptance criteria|trusted sources?)\b/i
    ],
    effect: 'Evidence-heavy work benefits from structured artifacts and an independent judge.'
  },
  {
    id: 'knowledge',
    label: 'External knowledge or retrieval',
    weight: 4,
    patterns: [
      /\b(document|knowledge|policy|manual|runbook|historical|web search|retrieval|rag|source material|trusted sources?)\b/i
    ],
    effect: 'Retrieval supplies evidence; it does not replace orchestration or agent communication.'
  }
]);

function normalizeRequirement(value) {
  if (typeof value !== 'string') throw new TypeError('Requirement must be a string.');
  const requirement = value.trim();
  if (requirement.length < 8) throw new Error('Describe the agent use case in at least 8 characters.');
  if (requirement.length > MAX_TEXT_LENGTH) throw new Error(`Requirement must be ${MAX_TEXT_LENGTH} characters or fewer.`);
  return requirement;
}

function normalizeForMatch(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function segmentsFrom(requirement) {
  return (requirement.match(/[^.!?;\n]+[.!?;]?/g) || [requirement])
    .map((segment) => segment.trim())
    .filter(Boolean)
    .slice(0, 64);
}

function evidenceFor(segments, patterns) {
  return segments
    .filter((segment) => patterns.some((pattern) => pattern.test(normalizeForMatch(segment))))
    .slice(0, MAX_EVIDENCE_ITEMS);
}

function factorAssessment(definition, requirement, segments) {
  const normalized = normalizeForMatch(requirement);
  const matchedPatterns = definition.patterns.filter((pattern) => pattern.test(normalized)).length;
  const evidence = evidenceFor(segments, definition.patterns);
  const score = Math.min(100, matchedPatterns * 55 + Math.max(0, evidence.length - 1) * 20);
  return {
    id: definition.id,
    label: definition.label,
    weight: definition.weight,
    state: score >= 75 ? 'strong' : score > 0 ? 'present' : 'absent',
    score,
    evidence,
    effect: definition.effect
  };
}

function byId(factors, id) {
  return factors.find((factor) => factor.id === id);
}

function chooseMode(factors) {
  const external = byId(factors, 'externalBoundary').score;
  const parallel = byId(factors, 'parallelism').score;
  const iteration = byId(factors, 'iteration').score;
  const tools = byId(factors, 'tools').score;
  const interpretation = byId(factors, 'interpretation').score;
  const deterministic = byId(factors, 'determinism').score;

  if (external > 0) return 'external-agent-network';
  if (parallel >= 55 && (iteration > 0 || tools > 0 || interpretation >= 55)) return 'temporary-subagents';
  if (iteration >= 55 || (tools >= 55 && interpretation > 0)) return 'single-agent';
  if (deterministic >= 55 && iteration === 0 && parallel === 0) return 'workflow';
  return 'llm-feature';
}

function rationaleFor(mode, factors) {
  const present = factors.filter((factor) => factor.state !== 'absent').map((factor) => factor.label.toLowerCase());
  const evidenceSummary = present.slice(0, 3).join(', ') || 'a narrow interpretation task';
  const rationales = {
    'llm-feature': `The requirement mainly needs ${evidenceSummary}; a deterministic wrapper should own validation, policy, and output shape.`,
    workflow: `The requirement shows ${evidenceSummary} without a material iterative control loop, so a fixed workflow is simpler and more testable.`,
    'single-agent': `The requirement needs ${evidenceSummary}; one bounded coordinator can choose the next step without multi-agent overhead.`,
    'temporary-subagents': `The requirement contains ${evidenceSummary}; bounded temporary specialists can work independently and return structured artifacts to one orchestrator.`,
    'external-agent-network': 'The requirement explicitly crosses an external-agent trust boundary; a local orchestrator should validate every A2A task and returned artifact.'
  };
  return rationales[mode];
}

function alternativesFor(selected) {
  return MODES.map((mode) => {
    if (mode === selected) {
      return {
        mode,
        label: MODE_LABELS[mode],
        status: 'selected',
        reason: 'This is the least complex topology that satisfies the detected decision factors.',
        upgradeCondition: 'Increase agency only when evaluation evidence shows a measurable accuracy, coverage, or latency gain.'
      };
    }
    const rank = MODES.indexOf(mode);
    const selectedRank = MODES.indexOf(selected);
    if (rank < selectedRank) {
      return {
        mode,
        label: MODE_LABELS[mode],
        status: 'insufficient',
        reason: 'This option does not cover all detected iteration, parallelism, tool, or trust-boundary needs.',
        upgradeCondition: 'Use it only after removing the factors that require the selected topology.'
      };
    }
    return {
      mode,
      label: MODE_LABELS[mode],
      status: 'deferred',
      reason: 'This option adds coordination, context, evaluation, and failure complexity without current evidence of benefit.',
      upgradeCondition: 'Adopt it only after a benchmark proves the simpler selected topology is insufficient.'
    };
  });
}

function protocolGuidance(factors, selected) {
  const tools = byId(factors, 'tools');
  const knowledge = byId(factors, 'knowledge');
  const external = byId(factors, 'externalBoundary');
  const typedDecision = tools.score >= 75 ? 'optional' : 'recommended';
  const mcpDecision = tools.score >= 75 ? 'recommended' : tools.score > 0 ? 'optional' : 'not-needed';
  const retrievalDecision = knowledge.score > 0 ? 'recommended' : 'optional';
  const a2aDecision = selected === 'external-agent-network' ? 'required' : 'not-needed';

  return [
    {
      id: 'typed-functions',
      label: 'Native typed functions',
      decision: typedDecision,
      responsibility: 'Expose a small known capability directly with a strict input/output schema.',
      rationale: tools.score >= 75 ? 'Use direct functions for the narrowest local capabilities even when MCP coordinates the broader tool layer.' : 'Start here before introducing a protocol layer.',
      evidence: tools.evidence
    },
    {
      id: 'mcp',
      label: 'Model Context Protocol',
      decision: mcpDecision,
      responsibility: 'Standardize model-to-tool and model-to-context access behind permission-aware servers.',
      rationale: mcpDecision === 'recommended'
        ? 'Multiple named system classes justify a consistent discovery and permission boundary.'
        : mcpDecision === 'optional'
          ? 'One named system can begin as a typed function; adopt MCP when the capability becomes reusable or multiple servers appear.'
          : 'A separate MCP server is unnecessary until reusable external capabilities need standardization.',
      evidence: tools.evidence
    },
    {
      id: 'retrieval',
      label: 'Retrieval / context service',
      decision: retrievalDecision,
      responsibility: 'Select, source, and freshness-check knowledge supplied to reasoning stages.',
      rationale: retrievalDecision === 'recommended' ? 'The request depends on documents, policies, history, or trusted sources.' : 'Add retrieval only when external knowledge is required.',
      evidence: knowledge.evidence
    },
    {
      id: 'a2a',
      label: 'Agent-to-Agent protocol',
      decision: a2aDecision,
      responsibility: 'Exchange tasks and structured artifacts across separately operated agent trust boundaries.',
      rationale: a2aDecision === 'required' ? 'The requirement explicitly names an independent or remote agent boundary.' : 'Internal temporary workers stay inside the orchestrator and do not need A2A.',
      evidence: external.evidence
    }
  ];
}

function autonomyGuidance(mode, riskFactor) {
  const baseLevels = {
    'llm-feature': 'none',
    workflow: 'none',
    'single-agent': 'bounded',
    'temporary-subagents': 'coordinated',
    'external-agent-network': 'coordinated'
  };
  const highRisk = riskFactor.score > 0;
  return {
    level: baseLevels[mode],
    approvalRequired: highRisk,
    guidance: [
      highRisk
        ? 'Require a separate human-issued action token before any external write, deployment, send, payment, or destructive action.'
        : 'Keep external writes denied until the use case explicitly requires and authorizes them.',
      'Run every reasoning or agent stage behind typed inputs, structured outputs, timeouts, budgets, and trace events.',
      mode === 'temporary-subagents' || mode === 'external-agent-network'
        ? 'Limit fan-out, prevent child spawning, and validate every returned artifact before synthesis.'
        : 'Do not add temporary workers unless an evaluation proves a material benefit.'
    ]
  };
}

function confidenceFor(factors, requirementAnalysis) {
  const evidenceCoverage = factors.filter((factor) => factor.state !== 'absent').length / MAX_FACTORS;
  const readiness = Number(requirementAnalysis?.score ?? 50) / 100;
  const contradictions = Number(requirementAnalysis?.contradictions?.length ?? 0);
  return Math.max(35, Math.min(98, Math.round(55 + evidenceCoverage * 25 + readiness * 20 - contradictions * 8)));
}

function hashText(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

export function analyzeAgentDecision(rawRequirement, requirementAnalysis = null) {
  const requirement = normalizeRequirement(rawRequirement);
  const segments = segmentsFrom(requirement);
  const factors = FACTORS.map((definition) => factorAssessment(definition, requirement, segments));
  const mode = chooseMode(factors);
  const riskFactor = byId(factors, 'risk');
  const contradictionCount = Array.isArray(requirementAnalysis?.contradictions) ? requirementAnalysis.contradictions.length : 0;
  const decision = {
    schemaVersion: 1,
    decisionId: `AGD-${hashText(normalizeForMatch(requirement).toLowerCase())}`,
    sourcePolicy: 'Decision factors quote only the supplied requirement; missing signals remain absent.',
    selected: {
      mode,
      label: MODE_LABELS[mode],
      rationale: rationaleFor(mode, factors),
      confidence: confidenceFor(factors, requirementAnalysis)
    },
    factors,
    alternatives: alternativesFor(mode),
    protocols: protocolGuidance(factors, mode),
    autonomy: autonomyGuidance(mode, riskFactor),
    readiness: {
      status: requirementAnalysis?.status ?? 'unknown',
      score: Number.isFinite(requirementAnalysis?.score) ? requirementAnalysis.score : null,
      contradictionCount,
      executionReady: requirementAnalysis?.status === 'ready' && contradictionCount === 0
    }
  };
  assertAgentDecision(decision);
  return decision;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isText(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_TEXT_LENGTH;
}

export function validateAgentDecision(value) {
  const errors = [];
  if (!isRecord(value)) return { valid: false, errors: ['agentDecision must be an object.'] };

  const unexpected = Object.keys(value).filter((field) => !TOP_LEVEL_FIELDS.has(field));
  if (unexpected.length) errors.push(`agentDecision contains unsupported field ${unexpected[0]}.`);
  if (value.schemaVersion !== 1) errors.push('agentDecision.schemaVersion must equal 1.');
  if (!isText(value.decisionId) || !/^AGD-[A-F0-9]{8}$/.test(value.decisionId)) errors.push('agentDecision.decisionId is invalid.');
  if (!isText(value.sourcePolicy)) errors.push('agentDecision.sourcePolicy must be text.');
  if (!isRecord(value.selected) || !MODES.includes(value.selected.mode) || value.selected.label !== MODE_LABELS[value.selected.mode] || !isText(value.selected.rationale) || !Number.isFinite(value.selected.confidence) || value.selected.confidence < 0 || value.selected.confidence > 100) {
    errors.push('agentDecision.selected is invalid.');
  }

  if (!Array.isArray(value.factors) || value.factors.length !== MAX_FACTORS) {
    errors.push(`agentDecision.factors must contain ${MAX_FACTORS} entries.`);
  } else {
    value.factors.forEach((factor, index) => {
      const definition = FACTORS[index];
      const validShape = isRecord(factor)
        && factor.id === definition.id
        && factor.label === definition.label
        && factor.weight === definition.weight
        && ['absent', 'present', 'strong'].includes(factor.state)
        && Number.isFinite(factor.score)
        && factor.score >= 0
        && factor.score <= 100
        && Array.isArray(factor.evidence)
        && factor.evidence.length <= MAX_EVIDENCE_ITEMS
        && factor.evidence.every((item) => isText(item))
        && isText(factor.effect);
      if (!validShape) {
        errors.push(`agentDecision.factors[${index}] is invalid.`);
        return;
      }
      if (factor.state === 'absent' && (factor.score !== 0 || factor.evidence.length !== 0)) {
        errors.push(`agentDecision.factors[${index}] absent state is inconsistent.`);
      }
      if (factor.state === 'present' && (factor.score <= 0 || factor.score >= 75)) {
        errors.push(`agentDecision.factors[${index}] present state is inconsistent.`);
      }
      if (factor.state === 'strong' && factor.score < 75) {
        errors.push(`agentDecision.factors[${index}] strong state is inconsistent.`);
      }
    });
  }

  if (!Array.isArray(value.alternatives) || value.alternatives.length !== MODES.length) {
    errors.push('agentDecision.alternatives is invalid.');
  } else {
    value.alternatives.forEach((alternative, index) => {
      const mode = MODES[index];
      if (!isRecord(alternative) || alternative.mode !== mode || alternative.label !== MODE_LABELS[mode] || !['selected', 'insufficient', 'deferred'].includes(alternative.status) || !isText(alternative.reason) || !isText(alternative.upgradeCondition)) {
        errors.push(`agentDecision.alternatives[${index}] is invalid.`);
      }
    });
    const selectedAlternatives = value.alternatives.filter((item) => item.status === 'selected');
    if (selectedAlternatives.length !== 1) errors.push('agentDecision.alternatives must contain one selected mode.');
    if (selectedAlternatives.length === 1 && selectedAlternatives[0].mode !== value.selected?.mode) {
      errors.push('agentDecision.alternatives selected mode must match agentDecision.selected.');
    }
  }

  const protocolIds = ['typed-functions', 'mcp', 'retrieval', 'a2a'];
  if (!Array.isArray(value.protocols) || value.protocols.length !== protocolIds.length) {
    errors.push('agentDecision.protocols is invalid.');
  } else {
    value.protocols.forEach((protocol, index) => {
      if (!isRecord(protocol) || protocol.id !== protocolIds[index] || !isText(protocol.label) || !['required', 'recommended', 'optional', 'not-needed'].includes(protocol.decision) || !isText(protocol.responsibility) || !isText(protocol.rationale) || !Array.isArray(protocol.evidence) || protocol.evidence.length > MAX_EVIDENCE_ITEMS || protocol.evidence.some((item) => !isText(item))) {
        errors.push(`agentDecision.protocols[${index}] is invalid.`);
      }
    });
  }

  if (!isRecord(value.autonomy) || !['none', 'bounded', 'coordinated'].includes(value.autonomy.level) || typeof value.autonomy.approvalRequired !== 'boolean' || !Array.isArray(value.autonomy.guidance) || value.autonomy.guidance.length !== 3 || value.autonomy.guidance.some((item) => !isText(item))) {
    errors.push('agentDecision.autonomy is invalid.');
  }

  if (!isRecord(value.readiness) || !['ready', 'draft', 'needs-input', 'unknown'].includes(value.readiness.status) || (value.readiness.score !== null && (!Number.isFinite(value.readiness.score) || value.readiness.score < 0 || value.readiness.score > 100)) || !Number.isInteger(value.readiness.contradictionCount) || value.readiness.contradictionCount < 0 || typeof value.readiness.executionReady !== 'boolean') {
    errors.push('agentDecision.readiness is invalid.');
  } else {
    const shouldBeReady = value.readiness.status === 'ready' && value.readiness.contradictionCount === 0;
    if (value.readiness.executionReady !== shouldBeReady) errors.push('agentDecision.readiness.executionReady is inconsistent.');
  }

  if (value.selected?.mode === 'external-agent-network' && value.protocols?.find((item) => item.id === 'a2a')?.decision !== 'required') {
    errors.push('agentDecision external-agent networks require A2A guidance.');
  }
  if (value.autonomy?.approvalRequired && value.autonomy?.guidance?.every((item) => !/approval|human-issued action token/i.test(item))) {
    errors.push('agentDecision high-risk autonomy must include an approval boundary.');
  }

  return { valid: errors.length === 0, errors };
}

export class AgentDecisionValidationError extends Error {
  constructor(errors) {
    super(`Agent decision failed validation: ${errors.slice(0, 4).join(' ')}`);
    this.name = 'AgentDecisionValidationError';
    this.code = 'INVALID_AGENT_DECISION';
    this.errors = [...errors];
  }
}

export function assertAgentDecision(value) {
  const validation = validateAgentDecision(value);
  if (!validation.valid) throw new AgentDecisionValidationError(validation.errors);
  return value;
}

export { MODES as agentDecisionModes, MODE_LABELS as agentDecisionLabels };