const MAX_COLLECTION_SIZE = 64;
const MAX_TEXT_LENGTH = 12000;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isText(value, { allowEmpty = false } = {}) {
  return typeof value === 'string'
    && value.length <= MAX_TEXT_LENGTH
    && (allowEmpty || value.trim().length > 0);
}

function isScore(value) {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function validateArray(errors, value, path, itemValidator, { allowEmpty = true } = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array.`);
    return;
  }
  if (!allowEmpty && value.length === 0) errors.push(`${path} must not be empty.`);
  if (value.length > MAX_COLLECTION_SIZE) errors.push(`${path} exceeds ${MAX_COLLECTION_SIZE} entries.`);
  value.slice(0, MAX_COLLECTION_SIZE).forEach((item, index) => itemValidator(item, `${path}[${index}]`, errors));
}

function validateStringArray(value, path, errors) {
  validateArray(errors, value, path, (item, itemPath, itemErrors) => {
    if (!isText(item)) itemErrors.push(`${itemPath} must be non-empty text.`);
  });
}

function validateNamedRecord(item, path, errors, fields) {
  if (!isRecord(item)) {
    errors.push(`${path} must be an object.`);
    return;
  }
  fields.forEach((field) => {
    if (!isText(item[field])) errors.push(`${path}.${field} must be non-empty text.`);
  });
}

export class HarnessResultValidationError extends Error {
  constructor(errors) {
    super(`Harness result failed validation: ${errors.slice(0, 4).join(' ')}`);
    this.name = 'HarnessResultValidationError';
    this.code = 'INVALID_HARNESS_RESULT';
    this.errors = [...errors];
  }
}

export function validateHarnessResult(value) {
  const errors = [];
  if (!isRecord(value)) return { valid: false, errors: ['result must be an object.'] };

  ['mode', 'runId', 'requirement', 'domain', 'recommendation'].forEach((field) => {
    if (!isText(value[field])) errors.push(`${field} must be non-empty text.`);
  });

  if (!isRecord(value.scores)) {
    errors.push('scores must be an object.');
  } else {
    ['complexity', 'risk', 'confidence'].forEach((field) => {
      if (!isScore(value.scores[field])) errors.push(`scores.${field} must be between 0 and 100.`);
    });
  }

  if (!isRecord(value.architecture)) {
    errors.push('architecture must be an object.');
  } else {
    ['kind', 'reason'].forEach((field) => {
      if (!isText(value.architecture[field])) errors.push(`architecture.${field} must be non-empty text.`);
    });
  }

  validateStringArray(value.capabilities, 'capabilities', errors);
  validateStringArray(value.unresolvedQuestions, 'unresolvedQuestions', errors);
  validateStringArray(value.constraints, 'constraints', errors);

  validateArray(errors, value.protocols, 'protocols', (item, path, itemErrors) => {
    validateNamedRecord(item, path, itemErrors, ['name', 'decision', 'rationale']);
  });

  validateArray(errors, value.stages, 'stages', (item, path, itemErrors) => {
    validateNamedRecord(item, path, itemErrors, ['name', 'purpose', 'mode']);
  }, { allowEmpty: false });

  validateArray(errors, value.permissions, 'permissions', (item, path, itemErrors) => {
    validateNamedRecord(item, path, itemErrors, ['capability', 'policy', 'enforcement']);
  }, { allowEmpty: false });

  validateArray(errors, value.subagents, 'subagents', (item, path, itemErrors) => {
    if (!isRecord(item)) {
      itemErrors.push(`${path} must be an object.`);
      return;
    }
    ['id', 'role', 'objective', 'context', 'permissions', 'returnArtifact'].forEach((field) => {
      if (!isText(item[field])) itemErrors.push(`${path}.${field} must be non-empty text.`);
    });
    validateStringArray(item.tools, `${path}.tools`, itemErrors);
    if (!Number.isFinite(item.timeoutSeconds) || item.timeoutSeconds <= 0 || item.timeoutSeconds > 3600) {
      itemErrors.push(`${path}.timeoutSeconds must be between 1 and 3600.`);
    }
    if (typeof item.childSpawning !== 'boolean') itemErrors.push(`${path}.childSpawning must be boolean.`);
  });

  validateArray(errors, value.artifacts, 'artifacts', (item, path, itemErrors) => {
    if (!isRecord(item)) {
      itemErrors.push(`${path} must be an object.`);
      return;
    }
    ['id', 'type', 'status'].forEach((field) => {
      if (!isText(item[field])) itemErrors.push(`${path}.${field} must be non-empty text.`);
    });
    if (typeof item.retained !== 'boolean') itemErrors.push(`${path}.retained must be boolean.`);
  }, { allowEmpty: false });

  validateArray(errors, value.trace, 'trace', (item, path, itemErrors) => {
    if (!isRecord(item)) {
      itemErrors.push(`${path} must be an object.`);
      return;
    }
    if (!Number.isInteger(item.sequence) || item.sequence <= 0) itemErrors.push(`${path}.sequence must be a positive integer.`);
    ['offset', 'event', 'detail', 'status'].forEach((field) => {
      if (!isText(item[field])) itemErrors.push(`${path}.${field} must be non-empty text.`);
    });
  }, { allowEmpty: false });

  if (!isRecord(value.evaluation)) {
    errors.push('evaluation must be an object.');
  } else {
    if (!isScore(value.evaluation.overall)) errors.push('evaluation.overall must be between 0 and 100.');
    if (!isText(value.evaluation.verdict)) errors.push('evaluation.verdict must be non-empty text.');
    validateArray(errors, value.evaluation.dimensions, 'evaluation.dimensions', (item, path, itemErrors) => {
      if (!isRecord(item)) {
        itemErrors.push(`${path} must be an object.`);
        return;
      }
      if (!isText(item.name)) itemErrors.push(`${path}.name must be non-empty text.`);
      if (!isScore(item.score)) itemErrors.push(`${path}.score must be between 0 and 100.`);
    }, { allowEmpty: false });
  }

  if ('runtime' in value && value.runtime !== null) {
    if (!isRecord(value.runtime)) {
      errors.push('runtime must be an object when present.');
    } else {
      ['source', 'provider'].forEach((field) => {
        if (!isText(value.runtime[field])) errors.push(`runtime.${field} must be non-empty text.`);
      });
      if ('latencyMs' in value.runtime && (!Number.isFinite(value.runtime.latencyMs) || value.runtime.latencyMs < 0)) {
        errors.push('runtime.latencyMs must be a non-negative number.');
      }
      if ('fallbackUsed' in value.runtime && typeof value.runtime.fallbackUsed !== 'boolean') {
        errors.push('runtime.fallbackUsed must be boolean.');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function assertHarnessResult(value) {
  const validation = validateHarnessResult(value);
  if (!validation.valid) throw new HarnessResultValidationError(validation.errors);
  return value;
}
