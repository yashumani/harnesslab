import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import {
  compileBrowserCriticContext,
  executeBrowserDeterministicCritic
} from '../apps/web/browser-critic-runtime.js';
import { analyzeRequirement, examples } from '../apps/web/engine.js';
import { assertHarnessResult } from '../apps/web/result-contract.js';
import { assertTemporaryWorker } from '../apps/web/temporary-worker-contract.js';
import {
  applyTemporaryCriticOutcome,
  compileCriticContext,
  createDeterministicCriticReview
} from '../services/gateway/temporary-critic.mjs';

function clock(values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

test('browser context compilation matches the gateway whitelist, byte count, and SHA-256 identifier', async () => {
  const result = analyzeRequirement(examples[0].value);
  result.runtime = {
    source: 'gateway',
    provider: 'openrouter',
    model: 'example/free:free',
    apiKey: 'must-not-enter-context',
    latencyMs: 42,
    fallbackUsed: false
  };

  const browser = await compileBrowserCriticContext(result, { cryptoImpl: webcrypto });
  const gateway = compileCriticContext(result);

  assert.deepEqual(browser.context, gateway.context);
  assert.equal(browser.inputBytes, gateway.inputBytes);
  assert.equal(browser.hash, gateway.hash);
  assert.equal(JSON.stringify(browser.context).includes('must-not-enter-context'), false);
  assert.equal(Object.hasOwn(browser.context, 'runtime'), false);
  assert.deepEqual(browser.context.policy.tools, []);
  assert.equal(browser.context.policy.childSpawning, false);
  assert.equal(browser.context.policy.externalActions, false);
  assert.equal(browser.context.policy.modelCallBudget, 1);
});

test('browser and gateway deterministic critic outcomes are contract-equivalent', async () => {
  const original = analyzeRequirement(examples[0].value);
  const startedAtMs = Date.parse('2026-08-23T20:00:00.000Z');
  const completedAtMs = startedAtMs + 12;

  const browser = await executeBrowserDeterministicCritic(original, {
    timeoutMs: 20000,
    now: clock([startedAtMs, completedAtMs]),
    cryptoImpl: webcrypto
  });

  const contextEnvelope = compileCriticContext(original);
  const review = createDeterministicCriticReview(contextEnvelope.context);
  const gatewayResult = applyTemporaryCriticOutcome(original, {
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
    startedAt: '2026-08-23T20:00:00.000Z',
    completedAt: '2026-08-23T20:00:00.012Z'
  });

  assertHarnessResult(browser.result);
  assertTemporaryWorker(browser.worker);
  assert.deepEqual(browser.result, gatewayResult);
  assert.deepEqual(browser.worker, gatewayResult.temporaryWorker);
  assert.equal(browser.metadata.execution, 'browser-local');
  assert.equal(browser.metadata.networkRequests, 0);
  assert.equal(browser.provider.liveModel, false);
  assert.match(browser.requestId, /^LOCAL-[A-F0-9]{12}$/);
});

test('browser deterministic critic preserves authoritative controls', async () => {
  const original = analyzeRequirement(examples[1].value);
  const permissions = structuredClone(original.permissions);
  const stages = structuredClone(original.stages);
  const protocols = structuredClone(original.protocols);
  const subagents = structuredClone(original.subagents);

  const response = await executeBrowserDeterministicCritic(original, {
    now: clock([1000, 1004]),
    cryptoImpl: webcrypto
  });

  assert.deepEqual(response.result.permissions, permissions);
  assert.deepEqual(response.result.stages, stages);
  assert.deepEqual(response.result.protocols, protocols);
  assert.deepEqual(response.result.subagents, subagents);
  assert.equal(response.worker.callBudget, 1);
  assert.equal(response.worker.callsUsed, 1);
  assert.equal(response.worker.childSpawning, false);
  assert.equal(response.worker.externalActions, false);
  assert.deepEqual(response.worker.tools, []);
  assert.ok(response.result.artifacts.some((artifact) => artifact.type === 'TemporaryAgentReview'));
  assert.ok(response.result.trace.some((entry) => entry.event === 'temporary_agent.completed'));
});
