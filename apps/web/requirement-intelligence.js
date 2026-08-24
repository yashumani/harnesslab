const MAX_TEXT_LENGTH = 12000;
const MAX_EVIDENCE_ITEMS = 3;
const MAX_QUESTIONS = 8;
const MAX_CONTRADICTIONS = 6;
const MAX_DIMENSIONS = 10;

const DIMENSIONS = Object.freeze([
  {
    id: 'objective',
    label: 'Objective',
    weight: 15,
    question: 'What exact outcome must the agent system accomplish?',
    strong: [
      /\b(build|create|design|develop|implement|make)\s+(an?|the)\s+(agent|assistant|system|workflow|copilot)\b/i,
      /\b(agent|assistant|system|workflow|copilot)\s+that\b/i,
      /\bgoal\s+is\s+to\b/i
    ],
    partial: [
      /\b(investigate|analy[sz]e|compare|generate|produce|review|monitor|classify|summari[sz]e|recommend|answer|automate)\b/i
    ]
  },
  {
    id: 'users',
    label: 'Users and stakeholders',
    weight: 8,
    question: 'Who will use the result, and who owns the decision or workflow?',
    strong: [
      /\b(for|used by|serves?|supports?)\s+(executives?|analysts?|operators?|admins?|developers?|engineers?|customers?|users?|teams?|managers?|researchers?|clinicians?|students?|employees?|stakeholders?)\b/i,
      /\b(user group|audience|stakeholder|owner)\b/i
    ],
    partial: [
      /\b(executives?|analysts?|operators?|admins?|developers?|engineers?|customers?|users?|teams?|managers?|researchers?|clinicians?|students?|employees?)\b/i
    ]
  },
  {
    id: 'inputs',
    label: 'Inputs and data',
    weight: 11,
    question: 'What inputs, data, or source material will the system receive?',
    strong: [
      /\b(input|data|dataset|database|sql|warehouse|documents?|files?|issues?|tickets?|emails?|messages?|metrics?|kpis?|logs?|sources?|repository|github issue|telemetry|records?)\b/i
    ],
    partial: [
      /\b(context|knowledge|information|content|request|prompt)\b/i
    ]
  },
  {
    id: 'output',
    label: 'Output and deliverable',
    weight: 11,
    question: 'What exact deliverable or structured output must the system return?',
    strong: [
      /\b(report|briefing|recommendation|answer|artifact|pull request|patch|code changes?|dashboard|summary|explanation|notification|draft|plan|result|json|schema)\b/i,
      /\b(return|produce|generate|create|deliver)\s+(an?|the)\b/i
    ],
    partial: [
      /\b(explain|notify|respond|show|present|write)\b/i
    ]
  },
  {
    id: 'systems',
    label: 'Systems, tools, and integrations',
    weight: 9,
    question: 'Which systems, tools, APIs, or repositories are available, and how may each be accessed?',
    strong: [
      /\b(mcp|a2a|api|database|sql|warehouse|github|gitlab|drive|slack|email|calendar|filesystem|snowflake|bigquery|jira|linear|salesforce|openrouter|ollama|web|browser|repository)\b/i,
      /\b(no|without)\s+(external|network|api|tool)\s+(access|calls?|connections?)\b/i
    ],
    partial: [
      /\b(tool|integration|system|service|source)\b/i
    ]
  },
  {
    id: 'allowedActions',
    label: 'Allowed actions',
    weight: 10,
    question: 'Which actions may the system perform autonomously or through approved tools?',
    strong: [
      /\b(read|query|search|retrieve|analy[sz]e|compare|validate|generate|propose|draft|run tests?|create files?|update|write|send|deploy)\b/i
    ],
    partial: [
      /\b(use|access|inspect|check|review|monitor)\b/i
    ],
    coveredMin: 2
  },
  {
    id: 'prohibitedActions',
    label: 'Prohibited actions',
    weight: 9,
    question: 'What must the system never do, even when a user asks?',
    strong: [
      /\b(never|must not|do not|don't|cannot|can't|deny|denied|prohibited|forbidden|read[- ]only|no writes?|no deletion|no deploy|without modifying)\b/i
    ],
    partial: [
      /\b(restricted|limited|guardrail|approval-gated|safe|reversible)\b/i
    ]
  },
  {
    id: 'autonomy',
    label: 'Autonomy and approval',
    weight: 10,
    question: 'Which actions may run without approval, and which require a named human approver?',
    strong: [
      /\b(autonomous|autonomously|full autonomy|human approval|manual approval|approval required|ask for approval|human-in-the-loop|recommend only|draft only|read[- ]only)\b/i
    ],
    partial: [
      /\b(approval|approve|permission|authorize|human review|review gate)\b/i
    ]
  },
  {
    id: 'successCriteria',
    label: 'Success criteria',
    weight: 10,
    question: 'What measurable acceptance criteria define a successful run?',
    strong: [
      /\b(success|acceptance criteria|accuracy|precision|recall|sla|service level|pass tests?|quality score|confidence threshold|within \d+|\d+\s*(ms|seconds?|minutes?|hours?|%|percent))\b/i
    ],
    partial: [
      /\b(evidence-backed|cited|trusted sources?|correct|accurate|concise|complete|validated|ranked|root-cause)\b/i
    ]
  },
  {
    id: 'constraints',
    label: 'Reliability, cost, privacy, and compliance',
    weight: 7,
    question: 'What latency, cost, reliability, privacy, security, and compliance constraints apply?',
    strong: [
      /\b(latency|timeout|budget|cost|free tier|rate limit|privacy|pii|personal data|security|compliance|hipaa|gdpr|sox|audit|retention|data residency|availability|recovery|production|sensitive)\b/i,
      /\b(under|within|max(?:imum)?|no more than)\s+\$?\d+/i
    ],
    partial: [
      /\b(reliable|secure|private|safe|fast|cheap|low cost|high availability)\b/i
    ],
    coveredMin: 2
  }
]);

const CONTRADICTION_RULES = Object.freeze([
  {
    id: 'autonomy-vs-every-action-approval',
    severity: 'high',
    statement: 'The requirement asks for full autonomy while also requiring human approval for every action.',
    question: 'Which actions are genuinely autonomous, and which exact actions require approval?',
    left: /\b(fully autonomous|full autonomy|without human intervention|no human involvement)\b/i,
    right: /\b(?:(?:human|manual)\s+approval(?:\s+is)?\s+(?:required\s+)?(?:before|for)\s+(?:every|any|all)\s+(?:action|step|operation)|(?:every|any|all)\s+(?:action|step|operation)\s+(?:requires?|needs?)\s+(?:human|manual)\s+approval|approve\s+(?:every|all)\s+(?:action|step|operation))\b/i
  },
  {
    id: 'read-only-vs-required-mutation',
    severity: 'high',
    statement: 'The requirement declares the system read-only while also requiring a write, update, deletion, deployment, or send action.',
    question: 'Should the system remain read-only, or which explicit mutation is approval-gated?',
    left: /\b(must remain read[- ]only|read[- ]only only|never (write|modify|update|delete|deploy|send)|no (writes?|modifications?|updates?|deletions?|deployments?))\b/i,
    right: /\b(must|required to|shall)\s+(write|modify|update|delete|deploy|send|publish|merge)\b/i
  },
  {
    id: 'no-external-access-vs-external-integration',
    severity: 'high',
    statement: 'The requirement prohibits external or network access while requiring an external integration.',
    question: 'Is external access prohibited, or which named integration is allowlisted?',
    left: /\b(no|without)\s+(external|network|internet|api)\s+(access|calls?|connections?)|must not access (the )?(internet|network|external systems?)\b/i,
    right: /\b(openrouter|slack|email|calendar|salesforce|jira|linear|github api|external api|web search|remote service|cloud model)\b/i
  },
  {
    id: 'no-credentials-vs-hosted-provider',
    severity: 'medium',
    statement: 'The requirement prohibits accounts or credentials while requiring a hosted provider that normally needs authentication.',
    question: 'Should the solution be fully local, or may a server-side account credential be configured?',
    left: /\b(no account|without (an )?account|no sign[- ]?up|without sign[- ]?up|no api key|without (an )?api key|no credentials?)\b/i,
    right: /\b(openrouter|hosted api|cloud model|hosted model|external provider api)\b/i
  },
  {
    id: 'no-data-access-vs-data-query',
    severity: 'high',
    statement: 'The requirement denies data access while requiring the system to query or analyze that data.',
    question: 'Which data source is available, and should access be read-only rather than prohibited?',
    left: /\b(no access to (the )?(data|database|warehouse)|cannot access (the )?(data|database|warehouse)|must not access (the )?(data|database|warehouse))\b/i,
    right: /\b(query|read|analy[sz]e|inspect)\s+(the )?(data|database|sql|warehouse|tables?|records?)\b/i
  },
  {
    id: 'no-persistence-vs-memory',
    severity: 'medium',
    statement: 'The requirement prohibits retention while also requiring memory, history, or persistence.',
    question: 'What state may be retained, for how long, and in which storage boundary?',
    left: /\b(do not store|don't store|never retain|no retention|no persistence|must not persist|stateless only)\b/i,
    right: /\b(memory|remember|history|persist|persistence|retain previous|previous sessions?|long-term state)\b/i
  }
]);

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
  const segments = requirement.match(/[^.!?;\n]+[.!?;]?/g) || [requirement];
  return segments
    .map((segment) => segment.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .slice(0, 64);
}

function matchingEvidence(segments, patterns) {
  const matches = [];
  for (const segment of segments) {
    if (patterns.some((pattern) => pattern.test(segment))) {
      matches.push(segment.slice(0, 420));
      if (matches.length >= MAX_EVIDENCE_ITEMS) break;
    }
  }
  return [...new Set(matches)];
}

function countPatternMatches(text, patterns) {
  return patterns.reduce((total, pattern) => total + (pattern.test(text) ? 1 : 0), 0);
}

function dimensionAssessment(definition, requirement, segments) {
  const strongEvidence = matchingEvidence(segments, definition.strong);
  const partialEvidence = matchingEvidence(segments, definition.partial);
  const evidence = [...new Set([...strongEvidence, ...partialEvidence])].slice(0, MAX_EVIDENCE_ITEMS);
  const strongMatches = countPatternMatches(requirement, definition.strong);
  const partialMatches = countPatternMatches(requirement, definition.partial);
  const coveredMinimum = definition.coveredMin || 1;

  let status = 'missing';
  if (strongMatches >= coveredMinimum || (strongMatches > 0 && partialMatches > 0)) status = 'covered';
  else if (strongMatches > 0 || partialMatches > 0) status = 'partial';

  return {
    id: definition.id,
    label: definition.label,
    weight: definition.weight,
    status,
    summary: evidence[0] || 'Not specified in the supplied requirement.',
    evidence
  };
}

function contradictionAssessment(requirement, segments) {
  return CONTRADICTION_RULES
    .filter((rule) => rule.left.test(requirement) && rule.right.test(requirement))
    .slice(0, MAX_CONTRADICTIONS)
    .map((rule) => ({
      id: rule.id,
      severity: rule.severity,
      statement: rule.statement,
      evidence: [...new Set([
        ...matchingEvidence(segments, [rule.left]),
        ...matchingEvidence(segments, [rule.right])
      ])].slice(0, MAX_EVIDENCE_ITEMS),
      question: rule.question
    }));
}

function prioritizedQuestions(dimensions, contradictions) {
  const contradictionQuestions = contradictions.map((contradiction) => ({
    id: `Q-${contradiction.id}`,
    dimension: 'contradiction',
    priority: 'high',
    question: contradiction.question,
    reason: contradiction.statement
  }));

  const dimensionQuestions = dimensions
    .filter((dimension) => dimension.status !== 'covered')
    .sort((left, right) => right.weight - left.weight || left.label.localeCompare(right.label))
    .map((dimension) => {
      const definition = DIMENSIONS.find((candidate) => candidate.id === dimension.id);
      return {
        id: `Q-${dimension.id}`,
        dimension: dimension.id,
        priority: dimension.status === 'missing' && dimension.weight >= 10 ? 'high' : 'medium',
        question: definition.question,
        reason: dimension.status === 'missing'
          ? `${dimension.label} is not supported by the supplied text.`
          : `${dimension.label} is only partially specified.`
      };
    });

  return [...contradictionQuestions, ...dimensionQuestions].slice(0, MAX_QUESTIONS);
}

function readinessStatus(score, contradictions) {
  if (contradictions.some((item) => item.severity === 'high')) return 'needs-input';
  if (score >= 80) return 'ready';
  if (score >= 55) return 'draft';
  return 'needs-input';
}

function readinessSummary(status, score, missingCount, contradictionCount) {
  if (status === 'ready') {
    return `The requirement is ready for a draft harness (${score}/100) with ${missingCount} remaining information gap${missingCount === 1 ? '' : 's'}.`;
  }
  if (status === 'draft') {
    return `The requirement can produce a draft harness (${score}/100), but targeted questions should be resolved before live execution.`;
  }
  return `The requirement needs additional input (${score}/100) before the architecture should be treated as execution-ready${contradictionCount ? `; ${contradictionCount} contradiction${contradictionCount === 1 ? '' : 's'} require resolution` : ''}.`;
}

export function analyzeRequirementIntelligence(rawRequirement) {
  const requirement = normalizeRequirement(rawRequirement);
  const normalized = requirement.toLowerCase().replace(/\s+/g, ' ');
  const segments = splitEvidenceSegments(requirement);
  const dimensions = DIMENSIONS.map((definition) => dimensionAssessment(definition, requirement, segments));
  const contradictions = contradictionAssessment(requirement, segments);
  const earnedWeight = dimensions.reduce((total, dimension) => {
    if (dimension.status === 'covered') return total + dimension.weight;
    if (dimension.status === 'partial') return total + dimension.weight * 0.5;
    return total;
  }, 0);
  const contradictionPenalty = contradictions.reduce(
    (total, contradiction) => total + (contradiction.severity === 'high' ? 14 : 7),
    0
  );
  const score = clampScore(earnedWeight - contradictionPenalty);
  const status = readinessStatus(score, contradictions);
  const questions = prioritizedQuestions(dimensions, contradictions);
  const missingCount = dimensions.filter((dimension) => dimension.status === 'missing').length;
  const partialCount = dimensions.filter((dimension) => dimension.status === 'partial').length;
  const coveredCount = dimensions.filter((dimension) => dimension.status === 'covered').length;

  const brief = Object.fromEntries(dimensions.map((dimension) => [dimension.id, {
    status: dimension.status,
    summary: dimension.summary,
    evidence: [...dimension.evidence]
  }]));

  const result = {
    schemaVersion: 1,
    analysisId: `REQI-${hashText(normalized)}`,
    sourcePolicy: 'Evidence is quoted only from the supplied requirement; unsupported details remain missing.',
    score,
    status,
    summary: readinessSummary(status, score, missingCount, contradictions.length),
    counts: { covered: coveredCount, partial: partialCount, missing: missingCount },
    dimensions,
    brief,
    contradictions,
    questions
  };

  assertRequirementIntelligence(result);
  return result;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isText(value, { allowEmpty = false } = {}) {
  return typeof value === 'string'
    && value.length <= MAX_TEXT_LENGTH
    && (allowEmpty || value.trim().length > 0);
}

export function validateRequirementIntelligence(value) {
  const errors = [];
  if (!isRecord(value)) return { valid: false, errors: ['requirementAnalysis must be an object.'] };
  if (value.schemaVersion !== 1) errors.push('requirementAnalysis.schemaVersion must equal 1.');
  if (!isText(value.analysisId)) errors.push('requirementAnalysis.analysisId must be text.');
  if (!isText(value.sourcePolicy)) errors.push('requirementAnalysis.sourcePolicy must be text.');
  if (!Number.isFinite(value.score) || value.score < 0 || value.score > 100) errors.push('requirementAnalysis.score must be between 0 and 100.');
  if (!['ready', 'draft', 'needs-input'].includes(value.status)) errors.push('requirementAnalysis.status is invalid.');
  if (!isText(value.summary)) errors.push('requirementAnalysis.summary must be text.');

  if (!isRecord(value.counts)) {
    errors.push('requirementAnalysis.counts must be an object.');
  } else {
    for (const field of ['covered', 'partial', 'missing']) {
      if (!Number.isInteger(value.counts[field]) || value.counts[field] < 0 || value.counts[field] > MAX_DIMENSIONS) {
        errors.push(`requirementAnalysis.counts.${field} is invalid.`);
      }
    }
  }

  if (!Array.isArray(value.dimensions) || value.dimensions.length !== MAX_DIMENSIONS) {
    errors.push(`requirementAnalysis.dimensions must contain ${MAX_DIMENSIONS} entries.`);
  } else {
    const ids = new Set();
    value.dimensions.forEach((dimension, index) => {
      if (!isRecord(dimension)) {
        errors.push(`requirementAnalysis.dimensions[${index}] must be an object.`);
        return;
      }
      if (!isText(dimension.id) || ids.has(dimension.id)) errors.push(`requirementAnalysis.dimensions[${index}].id is invalid.`);
      ids.add(dimension.id);
      if (!isText(dimension.label)) errors.push(`requirementAnalysis.dimensions[${index}].label must be text.`);
      if (!Number.isFinite(dimension.weight) || dimension.weight <= 0 || dimension.weight > 100) errors.push(`requirementAnalysis.dimensions[${index}].weight is invalid.`);
      if (!['covered', 'partial', 'missing'].includes(dimension.status)) errors.push(`requirementAnalysis.dimensions[${index}].status is invalid.`);
      if (!isText(dimension.summary)) errors.push(`requirementAnalysis.dimensions[${index}].summary must be text.`);
      if (!Array.isArray(dimension.evidence) || dimension.evidence.length > MAX_EVIDENCE_ITEMS || dimension.evidence.some((item) => !isText(item))) {
        errors.push(`requirementAnalysis.dimensions[${index}].evidence is invalid.`);
      }
      if (dimension.status === 'missing' && dimension.evidence.length !== 0) {
        errors.push(`requirementAnalysis.dimensions[${index}] cannot include evidence when missing.`);
      }
    });
  }

  if (!isRecord(value.brief)) {
    errors.push('requirementAnalysis.brief must be an object.');
  } else {
    for (const definition of DIMENSIONS) {
      const entry = value.brief[definition.id];
      if (!isRecord(entry) || !['covered', 'partial', 'missing'].includes(entry.status) || !isText(entry.summary) || !Array.isArray(entry.evidence)) {
        errors.push(`requirementAnalysis.brief.${definition.id} is invalid.`);
      }
    }
  }

  if (!Array.isArray(value.contradictions) || value.contradictions.length > MAX_CONTRADICTIONS) {
    errors.push('requirementAnalysis.contradictions is invalid.');
  } else {
    value.contradictions.forEach((contradiction, index) => {
      if (!isRecord(contradiction)
        || !isText(contradiction.id)
        || !['medium', 'high'].includes(contradiction.severity)
        || !isText(contradiction.statement)
        || !Array.isArray(contradiction.evidence)
        || contradiction.evidence.length === 0
        || contradiction.evidence.length > MAX_EVIDENCE_ITEMS
        || contradiction.evidence.some((item) => !isText(item))
        || !isText(contradiction.question)) {
        errors.push(`requirementAnalysis.contradictions[${index}] is invalid.`);
      }
    });
  }

  if (!Array.isArray(value.questions) || value.questions.length > MAX_QUESTIONS) {
    errors.push('requirementAnalysis.questions is invalid.');
  } else {
    value.questions.forEach((question, index) => {
      if (!isRecord(question)
        || !isText(question.id)
        || !isText(question.dimension)
        || !['high', 'medium', 'low'].includes(question.priority)
        || !isText(question.question)
        || !isText(question.reason)) {
        errors.push(`requirementAnalysis.questions[${index}] is invalid.`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

export class RequirementIntelligenceValidationError extends Error {
  constructor(errors) {
    super(`Requirement intelligence failed validation: ${errors.slice(0, 4).join(' ')}`);
    this.name = 'RequirementIntelligenceValidationError';
    this.code = 'INVALID_REQUIREMENT_INTELLIGENCE';
    this.errors = [...errors];
  }
}

export function assertRequirementIntelligence(value) {
  const validation = validateRequirementIntelligence(value);
  if (!validation.valid) throw new RequirementIntelligenceValidationError(validation.errors);
  return value;
}

export { DIMENSIONS as requirementDimensions };
