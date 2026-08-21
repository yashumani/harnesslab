import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeRequirement, examples } from '../apps/web/engine.js';
import { createDeterministicProvider } from '../services/gateway/providers/deterministic.mjs';
import { createOllamaProvider } from '../services/gateway/providers/ollama.mjs';
import {
  createOpenRouterProvider,
  OPENROUTER_API_BASE
} from '../services/gateway/providers/openrouter.mjs';
import { compileCriticContext } from '../services/gateway/temporary-critic.mjs';

function validCriticPayload() {
  return {
    verdict: 'revise',
    summary: 'The bounded critic found one evidence gap that should be resolved before live execution.',
    confidence: 0.93,
    findings: [{
      category: 'evidence_gap',
      severity: 'medium',
      confidence: 0.9,
      observation: 'The plan does not identify the authoritative source for one required claim.',
      recommendation: 'Name the approved evidence source and freshness rule before execution.',
      question: 'Which approved source is authoritative for this claim?'
    }]
  };
}

function context() {
  return compileCriticContext(analyzeRequirement(examples[0].value)).context;
}

test('deterministic provider executes one structured critic without a model', async () => {
  const provider = createDeterministicProvider();
  const response = await provider.critique(context());

  assert.equal(provider.liveModel, false);
  assert.equal(response.model, null);
  assert.equal(response.usage, null);
  assert.ok(['pass', 'revise'].includes(response.review.verdict));
  assert.ok(response.review.findings.length <= 6);
});

test('Ollama critic uses one JSON-only chat request with no tools', async () => {
  const requests = [];
  const provider = createOllamaProvider({
    baseUrl: 'http://127.0.0.1:11434',
    model: 'unit-model',
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify({
        message: { content: JSON.stringify(validCriticPayload()) },
        prompt_eval_count: 300,
        eval_count: 100
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  });

  const response = await provider.critique(context());
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'http://127.0.0.1:11434/api/chat');
  const body = JSON.parse(requests[0].options.body);
  assert.equal(body.model, 'unit-model');
  assert.equal(body.stream, false);
  assert.equal(body.format, 'json');
  assert.equal(Object.hasOwn(body, 'tools'), false);
  assert.match(body.messages[0].content, /no tools/i);
  assert.match(body.messages[1].content, /one response only/i);
  assert.equal(response.review.findings[0].category, 'evidence_gap');
  assert.deepEqual(response.usage, {
    promptTokens: 300,
    completionTokens: 100,
    totalDurationNs: null
  });
});

test('OpenRouter critic stays on a free route and records the routed model', async () => {
  const requests = [];
  const provider = createOpenRouterProvider({
    apiKey: 'unit-test-key',
    model: 'openrouter/free',
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify({
        model: 'provider/routed-model:free',
        choices: [{ message: { content: JSON.stringify(validCriticPayload()) } }],
        usage: { prompt_tokens: 320, completion_tokens: 110, total_tokens: 430 }
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  });

  const response = await provider.critique(context());
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, `${OPENROUTER_API_BASE}/chat/completions`);
  const body = JSON.parse(requests[0].options.body);
  assert.equal(body.model, 'openrouter/free');
  assert.equal(body.stream, false);
  assert.deepEqual(body.response_format, { type: 'json_object' });
  assert.equal(Object.hasOwn(body, 'tools'), false);
  assert.equal(JSON.stringify(body).includes('unit-test-key'), false);
  assert.equal(requests[0].options.headers.authorization, 'Bearer unit-test-key');
  assert.match(body.messages[0].content, /no tools/i);
  assert.equal(response.model, 'provider/routed-model:free');
  assert.equal(response.review.findings[0].category, 'evidence_gap');
  assert.deepEqual(response.usage, {
    promptTokens: 320,
    completionTokens: 110,
    totalTokens: 430
  });
});
