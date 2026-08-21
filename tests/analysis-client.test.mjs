import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeRequirement, examples } from '../apps/web/engine.js';
import {
  ANALYSIS_RUNTIME_STORAGE_KEY,
  AnalysisGatewayError,
  createAnalysisClient,
  DEFAULT_RUNTIME_SETTINGS,
  loadRuntimeSettings,
  RuntimeModes,
  saveRuntimeSettings
} from '../apps/web/analysis-client.js';
import { createMemoryStorage } from '../apps/web/workspace-store.js';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function nowSequence(values) {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0;
}

test('browser mode never calls a gateway', async () => {
  let fetchCalls = 0;
  const client = createAnalysisClient({
    fallbackAnalyze: analyzeRequirement,
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('unexpected fetch');
    },
    now: nowSequence([10, 18])
  });

  const result = await client.analyze(examples[0].value, { mode: RuntimeModes.BROWSER });
  assert.equal(fetchCalls, 0);
  assert.equal(result.runtime.source, 'browser');
  assert.equal(result.runtime.provider, 'deterministic');
  assert.equal(result.runtime.fallbackUsed, false);
  assert.equal(result.runtime.latencyMs, 8);
});

test('gateway mode validates and records gateway provenance', async () => {
  let request;
  const gatewayResult = analyzeRequirement(examples[1].value);
  const client = createAnalysisClient({
    fallbackAnalyze: analyzeRequirement,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return jsonResponse({
        requestId: 'REQ-123',
        provider: { name: 'deterministic', model: null, liveModel: false },
        result: gatewayResult,
        metadata: { latencyMs: 31, usage: null }
      });
    }
  });

  const result = await client.analyze(examples[1].value, {
    mode: RuntimeModes.GATEWAY,
    gatewayUrl: 'http://127.0.0.1:8787/'
  });
  assert.equal(request.url, 'http://127.0.0.1:8787/v1/analyze');
  assert.equal(request.options.method, 'POST');
  assert.equal(JSON.parse(request.options.body).requirement, examples[1].value);
  assert.equal(result.runtime.source, 'gateway');
  assert.equal(result.runtime.requestId, 'REQ-123');
  assert.equal(result.runtime.latencyMs, 31);
});

test('automatic mode records deterministic fallback evidence', async () => {
  const client = createAnalysisClient({
    fallbackAnalyze: analyzeRequirement,
    fetchImpl: async () => { throw new TypeError('network unavailable'); },
    now: nowSequence([5, 9])
  });

  const result = await client.analyze(examples[2].value, {
    mode: RuntimeModes.AUTOMATIC,
    gatewayUrl: 'http://127.0.0.1:8787'
  });
  assert.equal(result.runtime.source, 'browser');
  assert.equal(result.runtime.fallbackUsed, true);
  assert.equal(result.runtime.fallbackReason, 'GATEWAY_UNREACHABLE');
  assert.ok(result.trace.some((entry) => entry.event === 'gateway.fallback'));
  assert.ok(result.constraints.some((constraint) => constraint.includes('configured gateway did not produce')));
});

test('required gateway mode never silently falls back', async () => {
  let fallbackCalls = 0;
  const client = createAnalysisClient({
    fallbackAnalyze: (requirement) => {
      fallbackCalls += 1;
      return analyzeRequirement(requirement);
    },
    fetchImpl: async () => { throw new TypeError('offline'); }
  });

  await assert.rejects(
    client.analyze(examples[0].value, { mode: RuntimeModes.GATEWAY }),
    (error) => error instanceof AnalysisGatewayError && error.code === 'GATEWAY_UNREACHABLE'
  );
  assert.equal(fallbackCalls, 0);
});

test('automatic mode rejects an invalid gateway result before fallback', async () => {
  const client = createAnalysisClient({
    fallbackAnalyze: analyzeRequirement,
    fetchImpl: async () => jsonResponse({
      requestId: 'REQ-BAD',
      provider: { name: 'ollama', model: 'demo' },
      result: { runId: 'incomplete' },
      metadata: { latencyMs: 10 }
    })
  });

  const result = await client.analyze(examples[0].value, { mode: RuntimeModes.AUTOMATIC });
  assert.equal(result.runtime.fallbackUsed, true);
  assert.equal(result.runtime.fallbackReason, 'GATEWAY_INVALID_RESULT');
});

test('health check verifies the HarnessLab gateway identity', async () => {
  const client = createAnalysisClient({
    fallbackAnalyze: analyzeRequirement,
    fetchImpl: async (url) => {
      assert.equal(url, 'http://127.0.0.1:8787/health');
      return jsonResponse({
        requestId: 'HEALTH-1',
        service: 'harnesslab-gateway',
        status: 'ok',
        provider: {
          name: 'ollama',
          model: 'qwen-test',
          configured: true,
          available: true,
          liveModel: true
        }
      });
    }
  });

  const health = await client.checkHealth(DEFAULT_RUNTIME_SETTINGS);
  assert.equal(health.status, 'ok');
  assert.equal(health.provider.name, 'ollama');
  assert.equal(health.provider.available, true);
});

test('health check rejects an unrelated endpoint', async () => {
  const client = createAnalysisClient({
    fallbackAnalyze: analyzeRequirement,
    fetchImpl: async () => jsonResponse({ service: 'something-else', provider: {} })
  });
  await assert.rejects(
    client.checkHealth(DEFAULT_RUNTIME_SETTINGS),
    (error) => error instanceof AnalysisGatewayError && error.code === 'INCOMPATIBLE_GATEWAY'
  );
});

test('runtime settings persist only non-secret connection metadata', () => {
  const storage = createMemoryStorage();
  const saved = saveRuntimeSettings(storage, {
    mode: RuntimeModes.AUTOMATIC,
    gatewayUrl: 'https://gateway.example.test/harnesslab/',
    timeoutMs: 8200,
    apiKey: 'must-not-persist'
  });
  assert.deepEqual(saved, {
    mode: RuntimeModes.AUTOMATIC,
    gatewayUrl: 'https://gateway.example.test/harnesslab',
    timeoutMs: 8200
  });
  const raw = storage.getItem(ANALYSIS_RUNTIME_STORAGE_KEY);
  assert.ok(raw);
  assert.equal(raw.includes('must-not-persist'), false);
  assert.deepEqual(loadRuntimeSettings(storage), saved);
});

test('corrupted runtime settings recover to safe defaults', () => {
  const storage = createMemoryStorage({ [ANALYSIS_RUNTIME_STORAGE_KEY]: '{bad-json' });
  assert.deepEqual(loadRuntimeSettings(storage), DEFAULT_RUNTIME_SETTINGS);
});
