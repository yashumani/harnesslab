import test from 'node:test';
import assert from 'node:assert/strict';

import { examples } from '../apps/web/engine.js';
import { ProviderResponseError, ProviderUnavailableError } from '../services/gateway/errors.mjs';
import { createOllamaProvider } from '../services/gateway/providers/ollama.mjs';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

test('reports Ollama as unavailable until a model is explicitly configured', async () => {
  let fetchCalls = 0;
  const provider = createOllamaProvider({
    baseUrl: 'http://127.0.0.1:11434',
    model: '',
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('unexpected call');
    }
  });

  assert.equal(provider.configured, false);
  const health = await provider.health();
  assert.equal(health.available, false);
  assert.match(health.reason, /not configured/);
  await assert.rejects(
    provider.analyze(examples[0].value),
    (error) => error instanceof ProviderUnavailableError
  );
  assert.equal(fetchCalls, 0);
});

test('health checks that the configured model is installed', async () => {
  const provider = createOllamaProvider({
    baseUrl: 'http://127.0.0.1:11434',
    model: 'qwen-test:latest',
    fetchImpl: async (url) => {
      assert.equal(url, 'http://127.0.0.1:11434/api/tags');
      return jsonResponse({ models: [{ name: 'qwen-test:latest' }] });
    }
  });
  const health = await provider.health();
  assert.deepEqual(health, { configured: true, available: true, reason: null });
});

test('Ollama may refine architecture while deterministic controls remain authoritative', async () => {
  const calls = [];
  const provider = createOllamaProvider({
    baseUrl: 'http://127.0.0.1:11434',
    model: 'qwen-test:latest',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({
        message: {
          content: JSON.stringify({
            architecture: {
              kind: 'Adaptive orchestrator with evidence-review specialists',
              reason: 'Independent data-quality and diagnostic work can run concurrently while one orchestrator retains policy authority.'
            },
            recommendation: 'Use two read-only specialists, validate their artifacts, and require human approval before any external write.',
            unresolvedQuestions: ['Which warehouse schemas are approved for read-only access?'],
            confidenceAdjustment: 4
          })
        },
        prompt_eval_count: 420,
        eval_count: 155,
        total_duration: 123456789
      });
    }
  });

  const response = await provider.analyze(examples[0].value);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://127.0.0.1:11434/api/chat');
  const requestBody = JSON.parse(calls[0].options.body);
  assert.equal(requestBody.model, 'qwen-test:latest');
  assert.equal(requestBody.stream, false);
  assert.equal(requestBody.format, 'json');
  assert.equal(JSON.stringify(requestBody).includes('apiKey'), false);

  assert.match(response.result.mode, /Ollama-assisted/);
  assert.match(response.result.runId, /^OLLAMA-/);
  assert.equal(response.result.architecture.kind, 'Adaptive orchestrator with evidence-review specialists');
  assert.ok(response.result.trace.some((entry) => entry.event === 'model.assisted'));
  assert.equal(
    response.result.permissions.find((permission) => permission.capability === 'Production deployment or deletion').policy,
    'Deny'
  );
  assert.ok(response.result.constraints.some((constraint) => constraint.includes('deterministic HarnessLab controls')));
  assert.deepEqual(response.usage, {
    promptTokens: 420,
    completionTokens: 155,
    totalDurationNs: 123456789
  });
});

test('rejects malformed model output rather than inventing a live result', async () => {
  const provider = createOllamaProvider({
    baseUrl: 'http://127.0.0.1:11434',
    model: 'qwen-test',
    fetchImpl: async () => jsonResponse({ message: { content: 'not json' } })
  });

  await assert.rejects(
    provider.analyze(examples[0].value),
    (error) => error instanceof ProviderResponseError
  );
});

test('rejects supplements that omit required architecture evidence', async () => {
  const provider = createOllamaProvider({
    baseUrl: 'http://127.0.0.1:11434',
    model: 'qwen-test',
    fetchImpl: async () => jsonResponse({
      message: { content: JSON.stringify({ recommendation: 'Do something.' }) }
    })
  });

  await assert.rejects(
    provider.analyze(examples[0].value),
    (error) => error instanceof ProviderResponseError
  );
});

test('does not surface raw provider response content in errors', async () => {
  const secretLikeContent = 'sk-example-this-must-not-appear-in-the-error-message';
  const provider = createOllamaProvider({
    baseUrl: 'http://127.0.0.1:11434',
    model: 'qwen-test',
    fetchImpl: async () => jsonResponse({ message: { content: secretLikeContent } })
  });

  await assert.rejects(provider.analyze(examples[0].value), (error) => {
    assert.equal(error.message.includes(secretLikeContent), false);
    return error instanceof ProviderResponseError;
  });
});
