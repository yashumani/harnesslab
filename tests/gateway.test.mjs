import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeRequirement, examples } from '../apps/web/engine.js';
import { createGatewayServer } from '../services/gateway/app.mjs';
import { loadGatewayConfig } from '../services/gateway/config.mjs';
import { createDeterministicProvider } from '../services/gateway/providers/deterministic.mjs';

const logger = Object.freeze({ info() {}, warn() {}, error() {} });

function testConfig(overrides = {}) {
  return {
    ...loadGatewayConfig({}),
    ...overrides
  };
}

async function withGateway({ provider = createDeterministicProvider(), config = testConfig() } = {}, callback) {
  let requestCounter = 0;
  const server = createGatewayServer({
    config,
    provider,
    logger,
    requestIdFactory: () => `REQ-${++requestCounter}`
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    return await callback(baseUrl);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function readJson(response) {
  return JSON.parse(await response.text());
}

test('health exposes bounded provider capabilities without configuration secrets', async () => {
  const provider = {
    ...createDeterministicProvider(),
    secret: 'must-not-leak'
  };
  await withGateway({ provider }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    const payload = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(payload.service, 'harnesslab-gateway');
    assert.equal(payload.status, 'ok');
    assert.equal(payload.provider.name, 'deterministic');
    assert.equal(payload.provider.available, true);
    assert.equal(payload.capabilities.executeTools, false);
    assert.equal(JSON.stringify(payload).includes('must-not-leak'), false);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-request-id'), payload.requestId);
  });
});

test('deterministic provider completes the established result contract over HTTP', async () => {
  await withGateway({}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/analyze`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://127.0.0.1:4173'
      },
      body: JSON.stringify({ requirement: examples[0].value })
    });
    const payload = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://127.0.0.1:4173');
    assert.equal(payload.provider.name, 'deterministic');
    assert.match(payload.result.mode, /Deterministic gateway analysis/);
    assert.equal(payload.result.runId, analyzeRequirement(examples[0].value).runId);
    assert.ok(payload.metadata.latencyMs >= 0);
    assert.equal(payload.metadata.usage, null);
  });
});

test('preflight succeeds only for an allowed origin', async () => {
  await withGateway({}, async (baseUrl) => {
    const allowed = await fetch(`${baseUrl}/v1/analyze`, {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:4173' }
    });
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:4173');

    const denied = await fetch(`${baseUrl}/v1/analyze`, {
      method: 'OPTIONS',
      headers: { origin: 'https://malicious.example' }
    });
    const payload = await readJson(denied);
    assert.equal(denied.status, 403);
    assert.equal(payload.error.code, 'ORIGIN_NOT_ALLOWED');
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
  });
});

test('rejects malformed, unsupported, and oversized request bodies', async () => {
  await withGateway({ config: testConfig({ maxBodyBytes: 80 }) }, async (baseUrl) => {
    const wrongType = await fetch(`${baseUrl}/v1/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'not json'
    });
    assert.equal(wrongType.status, 415);
    assert.equal((await readJson(wrongType)).error.code, 'UNSUPPORTED_MEDIA_TYPE');

    const malformed = await fetch(`${baseUrl}/v1/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{bad'
    });
    assert.equal(malformed.status, 400);
    assert.equal((await readJson(malformed)).error.code, 'INVALID_JSON');

    const extraField = await fetch(`${baseUrl}/v1/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requirement: 'A valid requirement text.', provider: 'ollama' })
    });
    assert.equal(extraField.status, 400);
    assert.equal((await readJson(extraField)).error.code, 'UNSUPPORTED_FIELD');

    const oversized = await fetch(`${baseUrl}/v1/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requirement: 'x'.repeat(200) })
    });
    assert.equal(oversized.status, 413);
    assert.equal((await readJson(oversized)).error.code, 'BODY_TOO_LARGE');
  });
});

test('returns a bounded timeout error when a provider does not finish', async () => {
  const provider = {
    name: 'stalled-provider',
    model: null,
    liveModel: true,
    configured: true,
    async health() { return { configured: true, available: true, reason: null }; },
    async analyze() { return new Promise(() => {}); }
  };
  await withGateway({ provider, config: testConfig({ requestTimeoutMs: 25 }) }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requirement: 'Design a bounded agent system.' })
    });
    const payload = await readJson(response);
    assert.equal(response.status, 504);
    assert.equal(payload.error.code, 'PROVIDER_TIMEOUT');
    assert.equal(JSON.stringify(payload).includes('stack'), false);
  });
});

test('rejects unknown endpoints and unsupported methods', async () => {
  await withGateway({}, async (baseUrl) => {
    const missing = await fetch(`${baseUrl}/unknown`);
    assert.equal(missing.status, 404);
    assert.equal((await readJson(missing)).error.code, 'NOT_FOUND');

    const method = await fetch(`${baseUrl}/health`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(method.status, 405);
    assert.equal((await readJson(method)).error.code, 'METHOD_NOT_ALLOWED');
  });
});
