import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeRequirement, examples } from '../apps/web/engine.js';
import { createGatewayServer } from '../services/gateway/app.mjs';
import { loadGatewayConfig } from '../services/gateway/config.mjs';
import { createDeterministicProvider } from '../services/gateway/providers/deterministic.mjs';
import { parseCriticReview } from '../services/gateway/temporary-critic.mjs';

const logger = Object.freeze({ info() {}, warn() {}, error() {} });

function testConfig(overrides = {}) {
  return {
    ...loadGatewayConfig({}),
    criticTimeoutMs: 1000,
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

function validReview() {
  return parseCriticReview(JSON.stringify({
    verdict: 'revise',
    summary: 'The critic found one requirement gap while preserving the control plane.',
    confidence: 0.94,
    findings: [{
      category: 'missing_requirement',
      severity: 'medium',
      confidence: 0.93,
      observation: 'The approval owner is not named.',
      recommendation: 'Name the approval role before enabling any external write.',
      question: 'Who can approve external writes?'
    }]
  }), { providerLabel: 'Gateway test critic' });
}

test('health advertises exactly one bounded critic and no execution capabilities', async () => {
  await withGateway({}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    const payload = await readJson(response);

    assert.equal(response.status, 200);
    assert.equal(payload.version, '0.3.0');
    assert.equal(payload.capabilities.executeTemporaryCritic, true);
    assert.equal(payload.capabilities.maxTemporaryWorkersPerRequest, 1);
    assert.equal(payload.capabilities.executeTools, false);
    assert.equal(payload.capabilities.executeMcp, false);
    assert.equal(payload.capabilities.executeA2a, false);
    assert.equal(payload.capabilities.executeCode, false);
    assert.equal(payload.capabilities.externalActions, false);
  });
});

test('executes one deterministic critic and returns a validated retained artifact', async () => {
  await withGateway({}, async (baseUrl) => {
    const original = analyzeRequirement(examples[0].value);
    const permissions = structuredClone(original.permissions);
    const response = await fetch(`${baseUrl}/v1/critique`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://127.0.0.1:4173'
      },
      body: JSON.stringify({ result: original })
    });
    const payload = await readJson(response);

    assert.equal(response.status, 200);
    assert.equal(payload.provider.name, 'deterministic');
    assert.equal(payload.metadata.completed, true);
    assert.equal(payload.worker.status, 'completed');
    assert.equal(payload.worker.callBudget, 1);
    assert.equal(payload.worker.callsUsed, 1);
    assert.equal(payload.worker.childSpawning, false);
    assert.deepEqual(payload.worker.tools, []);
    assert.equal(payload.worker.externalActions, false);
    assert.deepEqual(payload.result.permissions, permissions);
    assert.equal(payload.result.temporaryWorker.id, payload.worker.id);
    assert.ok(payload.result.artifacts.some((artifact) => artifact.id === payload.worker.artifactId));
    assert.ok(payload.result.trace.some((entry) => entry.event === 'temporary_agent.completed'));
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://127.0.0.1:4173');
  });
});

test('passes only the minimum context to one provider critique call', async () => {
  const contexts = [];
  const provider = {
    name: 'recording-provider',
    model: 'critic-test-model',
    liveModel: true,
    configured: true,
    freeOnly: false,
    async health() { return { configured: true, available: true, reason: null }; },
    async analyze(requirement) { return { result: analyzeRequirement(requirement), usage: null }; },
    async critique(context) {
      contexts.push(structuredClone(context));
      return { review: validReview(), model: 'critic-routed-model', usage: { totalTokens: 100 } };
    }
  };

  await withGateway({ provider }, async (baseUrl) => {
    const original = analyzeRequirement(examples[1].value);
    original.runtime = {
      source: 'gateway',
      provider: 'recording-provider',
      model: 'critic-test-model',
      secret: 'must-not-reach-worker',
      latencyMs: 1,
      fallbackUsed: false
    };
    const response = await fetch(`${baseUrl}/v1/critique`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ result: original })
    });
    const payload = await readJson(response);

    assert.equal(response.status, 200);
    assert.equal(contexts.length, 1);
    assert.equal(JSON.stringify(contexts[0]).includes('must-not-reach-worker'), false);
    assert.deepEqual(contexts[0].policy.tools, []);
    assert.equal(contexts[0].policy.modelCallBudget, 1);
    assert.equal(contexts[0].policy.childSpawning, false);
    assert.equal(payload.provider.model, 'critic-routed-model');
    assert.equal(payload.worker.acceptedFindings.length, 1);
    assert.ok(payload.result.unresolvedQuestions.includes('Who can approve external writes?'));
  });
});

test('returns a timed-out worker artifact instead of fabricating success', async () => {
  const provider = {
    name: 'stalled-critic',
    model: 'stalled-model',
    liveModel: true,
    configured: true,
    async health() { return { configured: true, available: true, reason: null }; },
    async analyze(requirement) { return { result: analyzeRequirement(requirement), usage: null }; },
    async critique() { return new Promise(() => {}); }
  };

  await withGateway({ provider, config: testConfig({ criticTimeoutMs: 250 }) }, async (baseUrl) => {
    const original = analyzeRequirement(examples[2].value);
    const response = await fetch(`${baseUrl}/v1/critique`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ result: original })
    });
    const payload = await readJson(response);

    assert.equal(response.status, 200);
    assert.equal(payload.metadata.completed, false);
    assert.equal(payload.worker.status, 'timed_out');
    assert.equal(payload.worker.review, null);
    assert.equal(payload.worker.acceptedFindings.length, 0);
    assert.equal(payload.worker.failure.code, 'PROVIDER_TIMEOUT');
    assert.equal(payload.result.recommendation, original.recommendation);
    assert.ok(payload.result.trace.some((entry) => entry.event === 'temporary_agent.timed_out'));
  });
});

test('rejects request fields that try to choose a provider or expand the task', async () => {
  await withGateway({}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/critique`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        result: analyzeRequirement(examples[0].value),
        provider: 'openrouter',
        tools: ['shell']
      })
    });
    const payload = await readJson(response);

    assert.equal(response.status, 400);
    assert.equal(payload.error.code, 'UNSUPPORTED_FIELD');
  });
});

test('invalid provider review fails the contract rather than weakening controls', async () => {
  const provider = {
    name: 'invalid-critic',
    model: null,
    liveModel: false,
    configured: true,
    async health() { return { configured: true, available: true, reason: null }; },
    async analyze(requirement) { return { result: analyzeRequirement(requirement), usage: null }; },
    async critique() {
      return {
        review: {
          verdict: 'revise',
          summary: 'Invalid critic output tries to bypass the typed finding contract.',
          confidence: 1,
          findings: [{
            category: 'safety_gap',
            severity: 'high',
            confidence: 1,
            observation: 'A valid-looking observation.',
            recommendation: 'A valid-looking recommendation.',
            question: null,
            tools: ['shell']
          }]
        },
        usage: null
      };
    }
  };

  await withGateway({ provider }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/critique`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ result: analyzeRequirement(examples[0].value) })
    });
    const payload = await readJson(response);

    assert.equal(response.status, 502);
    assert.equal(payload.error.code, 'INVALID_PROVIDER_RESULT');
    assert.equal(JSON.stringify(payload).includes('shell'), false);
  });
});
