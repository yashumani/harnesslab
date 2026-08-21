import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeRequirement, examples } from '../apps/web/engine.js';
import {
  assertHarnessResult,
  HarnessResultValidationError,
  validateHarnessResult
} from '../apps/web/result-contract.js';

test('accepts the established deterministic harness result', () => {
  const result = analyzeRequirement(examples[0].value);
  assert.equal(validateHarnessResult(result).valid, true);
  assert.equal(assertHarnessResult(result), result);
});

test('accepts validated runtime provenance metadata', () => {
  const result = analyzeRequirement(examples[1].value);
  result.runtime = {
    mode: 'gateway',
    source: 'gateway',
    provider: 'deterministic',
    model: null,
    latencyMs: 42,
    fallbackUsed: false
  };
  assert.equal(validateHarnessResult(result).valid, true);
});

test('rejects missing core artifacts and invalid scores', () => {
  const result = analyzeRequirement(examples[0].value);
  result.artifacts = [];
  result.scores.risk = 140;
  const validation = validateHarnessResult(result);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.includes('artifacts')));
  assert.ok(validation.errors.some((error) => error.includes('scores.risk')));
});

test('rejects malformed runtime metadata', () => {
  const result = analyzeRequirement(examples[2].value);
  result.runtime = { source: '', provider: '', latencyMs: -1, fallbackUsed: 'sometimes' };
  const validation = validateHarnessResult(result);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.includes('runtime.source')));
  assert.ok(validation.errors.some((error) => error.includes('runtime.latencyMs')));
});

test('bounds collection sizes before UI rendering', () => {
  const result = analyzeRequirement(examples[0].value);
  result.capabilities = Array.from({ length: 65 }, (_, index) => `Capability ${index}`);
  const validation = validateHarnessResult(result);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.includes('exceeds 64 entries')));
});

test('assertion exposes a typed validation error without provider content', () => {
  assert.throws(
    () => assertHarnessResult({ runId: 'bad' }),
    (error) => error instanceof HarnessResultValidationError && error.code === 'INVALID_HARNESS_RESULT'
  );
});
