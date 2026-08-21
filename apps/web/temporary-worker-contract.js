const MAX_FINDINGS = 6;
const MAX_TEXT = 12000;
const ALLOWED_STATUS = new Set(['completed', 'failed', 'timed_out', 'cancelled']);
const ALLOWED_CATEGORIES = new Set([
  'missing_requirement',
  'reliability',
  'overcomplexity',
  'evidence_gap',
  'safety_gap',
  'protocol_fit'
]);
const ALLOWED_SEVERITIES = new Set(['low', 'medium', 'high']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isText(value, { allowEmpty = false } = {}) {
  return typeof value === 'string'
    && value.length <= MAX_TEXT
    && (allowEmpty || value.trim().length > 0);
}

function isNonNegativeNumber(value) {
  return Number.isFinite(value) && value >= 0;
}

function validateFinding(value, path, errors) {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return;
  }
  if (!isText(value.id)) errors.push(`${path}.id must be non-empty text.`);
  if (!ALLOWED_CATEGORIES.has(value.category)) errors.push(`${path}.category is unsupported.`);
  if (!ALLOWED_SEVERITIES.has(value.severity)) errors.push(`${path}.severity is unsupported.`);
  if (!Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1) {
    errors.push(`${path}.confidence must be between 0 and 1.`);
  }
  if (!isText(value.observation)) errors.push(`${path}.observation must be non-empty text.`);
  if (!isText(value.recommendation)) errors.push(`${path}.recommendation must be non-empty text.`);
  if (value.question !== null && value.question !== undefined && !isText(value.question)) {
    errors.push(`${path}.question must be text or null.`);
  }
}

function validateReview(value, path, errors) {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return;
  }
  if (!['pass', 'revise'].includes(value.verdict)) errors.push(`${path}.verdict must be pass or revise.`);
  if (!isText(value.summary)) errors.push(`${path}.summary must be non-empty text.`);
  if (!Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1) {
    errors.push(`${path}.confidence must be between 0 and 1.`);
  }
  if (!Array.isArray(value.findings) || value.findings.length > MAX_FINDINGS) {
    errors.push(`${path}.findings must contain at most ${MAX_FINDINGS} entries.`);
  } else {
    value.findings.forEach((finding, index) => validateFinding(finding, `${path}.findings[${index}]`, errors));
  }
}

export class TemporaryWorkerValidationError extends Error {
  constructor(errors) {
    super(`Temporary worker failed validation: ${errors.slice(0, 4).join(' ')}`);
    this.name = 'TemporaryWorkerValidationError';
    this.code = 'INVALID_TEMPORARY_WORKER';
    this.errors = [...errors];
  }
}

export function validateTemporaryWorker(value) {
  const errors = [];
  if (!isRecord(value)) return { valid: false, errors: ['temporaryWorker must be an object.'] };

  ['id', 'role', 'task', 'provider', 'artifactId'].forEach((field) => {
    if (!isText(value[field])) errors.push(`${field} must be non-empty text.`);
  });
  if (!ALLOWED_STATUS.has(value.status)) errors.push('status is unsupported.');
  if (value.model !== null && value.model !== undefined && !isText(value.model)) errors.push('model must be text or null.');
  if (typeof value.liveModel !== 'boolean') errors.push('liveModel must be boolean.');
  if (typeof value.freeOnly !== 'boolean') errors.push('freeOnly must be boolean.');
  if (!isText(value.startedAt)) errors.push('startedAt must be non-empty text.');
  if (!isText(value.completedAt)) errors.push('completedAt must be non-empty text.');
  if (!isNonNegativeNumber(value.latencyMs)) errors.push('latencyMs must be a non-negative number.');
  if (!Number.isInteger(value.timeoutMs) || value.timeoutMs < 250 || value.timeoutMs > 300000) {
    errors.push('timeoutMs must be an integer between 250 and 300000.');
  }
  if (value.callBudget !== 1) errors.push('callBudget must equal 1.');
  if (value.callsUsed !== 1) errors.push('callsUsed must equal 1.');
  if (value.childSpawning !== false) errors.push('childSpawning must be false.');
  if (value.externalActions !== false) errors.push('externalActions must be false.');
  if (!Array.isArray(value.tools) || value.tools.length !== 0) errors.push('tools must be an empty array.');
  if (!Array.isArray(value.contextFields) || value.contextFields.length === 0 || value.contextFields.some((field) => !isText(field))) {
    errors.push('contextFields must be a non-empty text array.');
  }
  if (!Number.isInteger(value.inputBytes) || value.inputBytes <= 0 || value.inputBytes > 49152) {
    errors.push('inputBytes must be between 1 and 49152.');
  }
  if (!Array.isArray(value.acceptedFindings) || value.acceptedFindings.length > MAX_FINDINGS) {
    errors.push('acceptedFindings must be a bounded array.');
  } else {
    value.acceptedFindings.forEach((finding, index) => validateFinding(finding, `acceptedFindings[${index}]`, errors));
  }
  if (!Array.isArray(value.rejectedFindings) || value.rejectedFindings.length > MAX_FINDINGS) {
    errors.push('rejectedFindings must be a bounded array.');
  } else {
    value.rejectedFindings.forEach((finding, index) => validateFinding(finding, `rejectedFindings[${index}]`, errors));
  }

  if (value.status === 'completed') {
    validateReview(value.review, 'review', errors);
    if (value.failure !== null) errors.push('failure must be null for completed workers.');
  } else {
    if (value.review !== null) errors.push('review must be null when the worker did not complete.');
    if (!isRecord(value.failure)) {
      errors.push('failure must be an object when the worker did not complete.');
    } else {
      if (!isText(value.failure.code)) errors.push('failure.code must be non-empty text.');
      if (!isText(value.failure.message)) errors.push('failure.message must be non-empty text.');
    }
  }

  if (value.usage !== null && value.usage !== undefined && !isRecord(value.usage)) {
    errors.push('usage must be an object or null.');
  }

  return { valid: errors.length === 0, errors };
}

export function assertTemporaryWorker(value) {
  const validation = validateTemporaryWorker(value);
  if (!validation.valid) throw new TemporaryWorkerValidationError(validation.errors);
  return value;
}
