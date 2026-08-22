import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeRequirement, examples } from '../apps/web/engine.js';
import { assertHarnessResult } from '../apps/web/result-contract.js';
import {
  assertTemporaryWorker,
  validateTemporaryWorker
} from '../apps/web/temporary-worker-contract.js';
import {
  applyTemporaryCriticOutcome,
  compileCriticContext,
  createDeterministicCriticReview,
  parseCriticReview
} from '../services/gateway/temporary-critic.mjs';

function completedMetadata(contextEnvelope, review, overrides = {}) {
  return {
    review,
    status: 'completed',
    provider: 'deterministic',
    model: null,
    liveModel: false,
    freeOnly: false,
    latencyMs: 12,
    timeoutMs: 20000,
    usage: null,
    contextEnvelope,
    startedAt: '2026-08-21T23:00:00.000Z',
    completedAt: '2026-08-21T23:00:00.012Z',
    ...overrides
  };
}

test('compiles only the bounded architecture-critic context envelope', () => {
  const result = analyzeRequirement(examples[0].value);
  result.runtime = {
    source: 'gateway',
    provider: 'openrouter',
    model: 'example/free:free',
    apiKey: 'must-not-enter-context',
    latencyMs: 42,
    fallbackUsed: false
  };
  const envelope = compileCriticContext(result);

  assert.equal(envelope.context.task, 'architecture-critic');
  assert.deepEqual(envelope.context.policy.tools, []);
  assert.equal(envelope.context.policy.childSpawning, false);
  assert.equal(envelope.context.policy.externalActions, false);
  assert.equal(envelope.context.policy.modelCallBudget, 1);
  assert.ok(envelope.inputBytes > 0 && envelope.inputBytes <= 48 * 1024);
  assert.equal(Object.hasOwn(envelope.context, 'runtime'), false);
  assert.equal(JSON.stringify(envelope.context).includes('must-not-enter-context'), false);
  assert.deepEqual(
    Object.keys(envelope.context),
    [
      'schemaVersion', 'task', 'objective', 'requirement', 'scores', 'architecture',
      'protocols', 'permissions', 'constraints', 'unresolvedQuestions', 'subagentPlan',
      'artifacts', 'evaluation', 'policy'
    ]
  );
});

test('parses strict bounded critic output and rejects schema expansion', () => {
  const review = parseCriticReview(JSON.stringify({
    verdict: 'revise',
    summary: 'The plan needs one requirement clarification before live execution.',
    confidence: 0.9,
    findings: [{
      category: 'missing_requirement',
      severity: 'medium',
      confidence: 0.91,
      observation: 'The approval owner is not identified.',
      recommendation: 'Name the approval role before exposing any write capability.',
      question: 'Who can approve external writes?'
    }]
  }), { providerLabel: 'Unit critic' });

  assert.equal(review.findings.length, 1);
  assert.equal(review.findings[0].id, 'F-01');
  assert.throws(() => parseCriticReview(JSON.stringify({
    verdict: 'pass',
    summary: 'A valid summary that is long enough.',
    confidence: 0.9,
    findings: [],
    tools: ['shell']
  }), { providerLabel: 'Unit critic' }), /unsupported fields/);
  assert.throws(() => parseCriticReview(JSON.stringify({
    verdict: 'revise',
    summary: 'A valid summary that is long enough.',
    confidence: 0.9,
    findings: [{
      category: 'credential_access',
      severity: 'high',
      confidence: 1,
      observation: 'Unsupported category should fail.',
      recommendation: 'Reject it before merge.'
    }]
  }), { providerLabel: 'Unit critic' }), /unsupported category/);
});

test('executes deterministic critic and applies only deterministic merge-safe changes', () => {
  const original = analyzeRequirement(examples[0].value);
  const permissions = structuredClone(original.permissions);
  const stages = structuredClone(original.stages);
  const protocols = structuredClone(original.protocols);
  const subagents = structuredClone(original.subagents);
  const envelope = compileCriticContext(original);
  const review = createDeterministicCriticReview(envelope.context);
  const reviewed = applyTemporaryCriticOutcome(original, completedMetadata(envelope, review));

  assertHarnessResult(reviewed);
  assertTemporaryWorker(reviewed.temporaryWorker);
  assert.equal(reviewed.temporaryWorker.status, 'completed');
  assert.equal(reviewed.temporaryWorker.callBudget, 1);
  assert.equal(reviewed.temporaryWorker.callsUsed, 1);
  assert.equal(reviewed.temporaryWorker.childSpawning, false);
  assert.equal(reviewed.temporaryWorker.externalActions, false);
  assert.deepEqual(reviewed.temporaryWorker.tools, []);
  assert.deepEqual(reviewed.permissions, permissions);
  assert.deepEqual(reviewed.stages, stages);
  assert.deepEqual(reviewed.protocols, protocols);
  assert.deepEqual(reviewed.subagents, subagents);
  assert.ok(reviewed.artifacts.some((artifact) => artifact.type === 'TemporaryAgentReview'));
  assert.ok(reviewed.trace.some((entry) => entry.event === 'temporary_agent.started'));
  assert.ok(reviewed.trace.some((entry) => entry.event === 'temporary_agent.completed'));
  assert.ok(reviewed.trace.some((entry) => entry.event === 'temporary_agent.review_applied'));
  assert.ok(reviewed.evaluation.dimensions.some((dimension) => dimension.name === 'Architecture critique'));
  assert.ok(reviewed.constraints.some((constraint) => constraint.includes('one-call budget')));
});

test('rejects low-confidence findings without losing the review artifact', () => {
  const original = analyzeRequirement('Design a bounded agent that summarizes an approved document and returns evidence.');
  const envelope = compileCriticContext(original);
  const review = parseCriticReview(JSON.stringify({
    verdict: 'revise',
    summary: 'One low-confidence observation is retained for audit but not applied.',
    confidence: 0.8,
    findings: [{
      category: 'overcomplexity',
      severity: 'medium',
      confidence: 0.4,
      observation: 'The plan might be more complex than necessary.',
      recommendation: 'Consider simplifying after measurement.',
      question: null
    }]
  }), { providerLabel: 'Unit critic' });
  const reviewed = applyTemporaryCriticOutcome(original, completedMetadata(envelope, review));

  assert.equal(reviewed.temporaryWorker.acceptedFindings.length, 0);
  assert.equal(reviewed.temporaryWorker.rejectedFindings.length, 1);
  assert.equal(reviewed.recommendation, original.recommendation);
  assert.ok(reviewed.artifacts.some((artifact) => artifact.id === reviewed.temporaryWorker.artifactId));
});

test('retains timeout evidence without fabricating a completed review', () => {
  const original = analyzeRequirement(examples[1].value);
  const envelope = compileCriticContext(original);
  const reviewed = applyTemporaryCriticOutcome(original, completedMetadata(envelope, null, {
    status: 'timed_out',
    provider: 'ollama',
    model: 'local-test-model',
    liveModel: true,
    latencyMs: 20001,
    failureCode: 'PROVIDER_TIMEOUT',
    failureMessage: 'Temporary critic exceeded the worker deadline.'
  }));

  const validation = validateTemporaryWorker(reviewed.temporaryWorker);
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  assert.equal(reviewed.temporaryWorker.status, 'timed_out');
  assert.equal(reviewed.temporaryWorker.review, null);
  assert.equal(reviewed.temporaryWorker.acceptedFindings.length, 0);
  assert.equal(reviewed.temporaryWorker.failure.code, 'PROVIDER_TIMEOUT');
  assert.ok(reviewed.trace.some((entry) => entry.event === 'temporary_agent.timed_out'));
  assert.ok(reviewed.artifacts.some((artifact) => artifact.status === 'timed out'));
  assert.equal(reviewed.recommendation, original.recommendation);
});
