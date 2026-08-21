import test from 'node:test';
import assert from 'node:assert/strict';

import { examples } from '../apps/web/engine.js';
import {
  ProviderResponseError,
  ProviderUnavailableError
} from '../services/gateway/errors.mjs';
import {
  createOpenRouterProvider,
  DEFAULT_OPENROUTER_FREE_MODEL,
  normalizeFreeOpenRouterModel,
  OPENROUTER_API_BASE
} from '../services/gateway/providers/openrouter.mjs';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function validSupplement() {
  return {
    architecture: {
      kind: 'Free-route orchestrator with bounded evidence specialists',
      reason: 'Independent analysis can run in parallel while deterministic policy and evaluation stages remain authoritative.'
    },
    recommendation: 'Use read-only specialists, validate their structured artifacts, and require approval before any external write.',
    unresolvedQuestions: ['Which approved systems can the read-only workers query?'],
    confidenceAdjustment: 3
  };
}

test('accepts only the free router or explicit :free variants', () => {
  assert.equal(normalizeFreeOpenRouterModel(), DEFAULT_OPENROUTER_FREE_MODEL);
  assert.equal(normalizeFreeOpenRouterModel('openrouter/free'), 'openrouter/free');
  assert.equal(normalizeFreeOpenRouterModel('vendor/model:free'), 'vendor/model:free');
  assert.throws(() => normalizeFreeOpenRouterModel('vendor/paid-model'), /permits only/);
  assert.throws(() => normalizeFreeOpenRouterModel('free'), /valid OpenRouter model identifier/);
  assert.throws(() => normalizeFreeOpenRouterModel('vendor/model:free extra'), /valid OpenRouter model identifier/);
});

test('is unavailable without a server-side API key and makes no request', async () => {
  let fetchCalls = 0;
  const provider = createOpenRouterProvider({
    apiKey: '',
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('unexpected request');
    }
  });

  assert.equal(provider.configured, false);
  assert.equal(provider.freeOnly, true);
  assert.equal(provider.model, 'openrouter/free');
  const health = await provider.health();
  assert.deepEqual(health, {
    configured: false,
    available: false,
    reason: 'OPENROUTER_API_KEY is not configured.'
  });
  await assert.rejects(
    provider.analyze(examples[0].value),
    (error) => error instanceof ProviderUnavailableError
  );
  assert.equal(fetchCalls, 0);
});

test('health validates the key only against the fixed official endpoint', async () => {
  const requests = [];
  const provider = createOpenRouterProvider({
    apiKey: 'unit-test-key',
    model: 'openrouter/free',
    httpReferer: 'https://example.test/harnesslab',
    appTitle: 'HarnessLab Unit Test',
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return jsonResponse({ data: { is_free_tier: true, label: 'must-not-be-returned' } });
    }
  });

  const health = await provider.health();
  assert.deepEqual(health, { configured: true, available: true, reason: null });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, `${OPENROUTER_API_BASE}/key`);
  assert.equal(requests[0].options.method, 'GET');
  assert.equal(requests[0].options.headers.authorization, 'Bearer unit-test-key');
  assert.equal(requests[0].options.headers['http-referer'], 'https://example.test/harnesslab');
  assert.equal(requests[0].options.headers['x-title'], 'HarnessLab Unit Test');
  assert.equal(JSON.stringify(health).includes('unit-test-key'), false);
  assert.equal(JSON.stringify(health).includes('must-not-be-returned'), false);
});

test('health reports a rejected key without echoing credentials or provider metadata', async () => {
  const provider = createOpenRouterProvider({
    apiKey: 'rejected-unit-test-key',
    fetchImpl: async () => jsonResponse({ error: { message: 'raw provider explanation' } }, 401)
  });
  const health = await provider.health();
  assert.equal(health.configured, true);
  assert.equal(health.available, false);
  assert.equal(health.reason, 'Configured OpenRouter API key was rejected.');
  assert.equal(JSON.stringify(health).includes('rejected-unit-test-key'), false);
  assert.equal(JSON.stringify(health).includes('raw provider explanation'), false);
});

test('uses the official chat endpoint, requests structured output, and records the routed model', async () => {
  const requests = [];
  const provider = createOpenRouterProvider({
    apiKey: 'unit-test-key',
    model: 'openrouter/free',
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return jsonResponse({
        id: 'generation-test',
        model: 'provider/selected-model:free',
        choices: [{
          message: {
            role: 'assistant',
            content: JSON.stringify(validSupplement())
          }
        }],
        usage: {
          prompt_tokens: 410,
          completion_tokens: 142,
          total_tokens: 552
        }
      });
    }
  });

  const response = await provider.analyze(examples[0].value);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, `${OPENROUTER_API_BASE}/chat/completions`);
  const body = JSON.parse(requests[0].options.body);
  assert.equal(body.model, 'openrouter/free');
  assert.equal(body.stream, false);
  assert.deepEqual(body.response_format, { type: 'json_object' });
  assert.deepEqual(body.usage, { include: true });
  assert.equal(body.max_tokens, 1200);
  assert.equal(JSON.stringify(body).includes('unit-test-key'), false);
  assert.equal(requests[0].options.headers.authorization, 'Bearer unit-test-key');

  assert.equal(response.model, 'provider/selected-model:free');
  assert.match(response.result.mode, /OpenRouter free-model analysis/);
  assert.match(response.result.runId, /^OPENROUTER-/);
  assert.equal(response.result.architecture.kind, validSupplement().architecture.kind);
  assert.ok(response.result.trace.some((entry) => entry.event === 'model.assisted'));
  assert.ok(response.result.trace.some((entry) => entry.detail.includes('provider/selected-model:free')));
  assert.equal(
    response.result.permissions.find((permission) => permission.capability === 'Production deployment or deletion').policy,
    'Deny'
  );
  assert.ok(response.result.constraints.some((constraint) => constraint.includes('deterministic HarnessLab controls')));
  assert.deepEqual(response.usage, {
    promptTokens: 410,
    completionTokens: 142,
    totalTokens: 552
  });
});

test('supports text-part message content without accepting non-text parts', async () => {
  const provider = createOpenRouterProvider({
    apiKey: 'unit-test-key',
    model: 'example/model:free',
    fetchImpl: async () => jsonResponse({
      model: 'example/model:free',
      choices: [{
        message: {
          content: [
            { type: 'image', image_url: 'ignored' },
            { type: 'text', text: JSON.stringify(validSupplement()) }
          ]
        }
      }]
    })
  });
  const response = await provider.analyze(examples[1].value);
  assert.equal(response.model, 'example/model:free');
  assert.equal(response.result.architecture.kind, validSupplement().architecture.kind);
});

test('returns a bounded free-capacity error for HTTP 429', async () => {
  const rawProviderMessage = 'account details that must not be surfaced';
  const provider = createOpenRouterProvider({
    apiKey: 'unit-test-key',
    fetchImpl: async () => jsonResponse({ error: { message: rawProviderMessage } }, 429)
  });
  await assert.rejects(provider.analyze(examples[0].value), (error) => {
    assert.equal(error instanceof ProviderUnavailableError, true);
    assert.match(error.message, /free-model rate limit or availability capacity/);
    assert.equal(error.message.includes(rawProviderMessage), false);
    assert.equal(error.message.includes('unit-test-key'), false);
    return true;
  });
});

test('rejects malformed or unsupported model supplements', async () => {
  const provider = createOpenRouterProvider({
    apiKey: 'unit-test-key',
    fetchImpl: async () => jsonResponse({
      model: 'provider/model:free',
      choices: [{ message: { content: JSON.stringify({ ...validSupplement(), unexpected: 'field' }) } }]
    })
  });
  await assert.rejects(
    provider.analyze(examples[0].value),
    (error) => error instanceof ProviderResponseError && /unsupported fields/.test(error.message)
  );
});

test('does not surface raw assistant content in parse errors', async () => {
  const rawContent = 'sensitive-like-provider-content-that-must-not-appear';
  const provider = createOpenRouterProvider({
    apiKey: 'unit-test-key',
    fetchImpl: async () => jsonResponse({
      choices: [{ message: { content: rawContent } }]
    })
  });
  await assert.rejects(provider.analyze(examples[0].value), (error) => {
    assert.equal(error instanceof ProviderResponseError, true);
    assert.equal(error.message.includes(rawContent), false);
    return true;
  });
});
