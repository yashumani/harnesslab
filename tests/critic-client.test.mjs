import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeRequirement, examples } from '../apps/web/engine.js';
import { RuntimeModes } from '../apps/web/analysis-client.js';
import {
  createCriticClient,
  CriticGatewayError
} from '../apps/web/critic-client.js';
import {
  applyTemporaryCriticOutcome,
  compileCriticContext,
  createDeterministicCriticReview
} from '../services/gateway/temporary-critic.mjs';

function reviewedEnvelope() {
  const original = analyzeRequirement(examples[0].value);
  const contextEnvelope = compileCriticContext(original);
  const review = createDeterministicCriticReview(contextEnvelope.context);
  const result = applyTemporaryCriticOutcome(original, {
    review,
    status: 'completed',
    provider: 'deterministic',
    model: null,
    liveModel: false,
    freeOnly: false,
    latencyMs: 8,
    timeoutMs: 20000,
    usage: null,
    contextEnvelope,
    startedAt: '2026-08-21T23:00:00.000Z',
    completedAt: '2026-08-21T23:00:00.008Z'
  });
  return {
    requestId: 'REQ-critic-1',
    provider: { name: 'deterministic', model: null, liveModel: false, freeOnly: false },
    result,
    worker: result.temporaryWorker,
    metadata: { latencyMs: 8, usage: null, completed: true }
  };
}

test('browser mode does not execute a temporary worker or call fetch', async () => {
  let fetchCalls = 0;
  const client = createCriticClient({
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('unexpected request');
    }
  });

  await assert.rejects(
    client.critique(analyzeRequirement(examples[0].value), {
      mode: RuntimeModes.BROWSER,
      gatewayUrl: 'http://127.0.0.1:8787',
      timeoutMs: 5000
    }),
    (error) => error instanceof CriticGatewayError && error.code === 'WORKER_REQUIRES_GATEWAY'
  );
  assert.equal(fetchCalls, 0);
});

test('calls only the bounded critic endpoint and validates the worker envelope', async () => {
  const envelope = reviewedEnvelope();
  const requests = [];
  const client = createCriticClient({
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify(envelope), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
  });

  const response = await client.critique(analyzeRequirement(examples[0].value), {
    mode: RuntimeModes.GATEWAY,
    gatewayUrl: 'http://127.0.0.1:8787/',
    timeoutMs: 5000
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'http://127.0.0.1:8787/v1/critique');
  assert.equal(requests[0].options.method, 'POST');
  assert.deepEqual(Object.keys(JSON.parse(requests[0].options.body)), ['result']);
  assert.equal(requests[0].options.headers['content-type'], 'application/json');
  assert.equal(response.worker.callBudget, 1);
  assert.equal(response.worker.childSpawning, false);
  assert.deepEqual(response.worker.tools, []);
  assert.equal(response.requestId, 'REQ-critic-1');
});

test('rejects invalid or inconsistent worker envelopes', async () => {
  const envelope = reviewedEnvelope();
  envelope.worker.id = 'DIFFERENT-ID';
  const client = createCriticClient({
    fetchImpl: async () => new Response(JSON.stringify(envelope), { status: 200 })
  });

  await assert.rejects(
    client.critique(analyzeRequirement(examples[0].value), {
      mode: RuntimeModes.AUTOMATIC,
      gatewayUrl: 'http://127.0.0.1:8787',
      timeoutMs: 5000
    }),
    (error) => error instanceof CriticGatewayError && error.code === 'CRITIC_INVALID_RESULT'
  );
});

test('surfaces sanitized gateway errors without fabricating a worker', async () => {
  const client = createCriticClient({
    fetchImpl: async () => new Response(JSON.stringify({
      error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Request origin is not allowed by this gateway.' }
    }), { status: 403 })
  });

  await assert.rejects(
    client.critique(analyzeRequirement(examples[0].value), {
      mode: RuntimeModes.GATEWAY,
      gatewayUrl: 'https://gateway.example.test',
      timeoutMs: 5000
    }),
    (error) => {
      assert.equal(error instanceof CriticGatewayError, true);
      assert.equal(error.code, 'ORIGIN_NOT_ALLOWED');
      assert.equal(error.status, 403);
      assert.match(error.message, /origin is not allowed/i);
      return true;
    }
  );
});
