import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeRequirement } from '../apps/web/engine.js';
import { createGatewayServer } from '../services/gateway/app.mjs';
import { loadGatewayConfig } from '../services/gateway/config.mjs';

const logger = Object.freeze({ info() {}, warn() {}, error() {} });

async function withServer(provider, callback) {
  const server = createGatewayServer({
    config: loadGatewayConfig({}),
    provider,
    logger,
    requestIdFactory: () => 'REQ-PROVENANCE'
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('health and analysis expose free-only policy and actual routed model without provider secrets', async () => {
  const provider = {
    name: 'openrouter',
    model: 'openrouter/free',
    liveModel: true,
    freeOnly: true,
    configured: true,
    secret: 'must-not-leak',
    async health() {
      return { configured: true, available: true, reason: null };
    },
    async analyze(requirement) {
      return {
        result: analyzeRequirement(requirement),
        model: 'provider/actual-free-model:free',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      };
    }
  };

  await withServer(provider, async (baseUrl) => {
    const healthResponse = await fetch(`${baseUrl}/health`);
    const health = await healthResponse.json();
    assert.equal(health.provider.model, 'openrouter/free');
    assert.equal(health.provider.freeOnly, true);
    assert.equal(JSON.stringify(health).includes('must-not-leak'), false);

    const analysisResponse = await fetch(`${baseUrl}/v1/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requirement: 'Build a bounded analytics agent with evidence.' })
    });
    const analysis = await analysisResponse.json();
    assert.equal(analysisResponse.status, 200);
    assert.equal(analysis.provider.name, 'openrouter');
    assert.equal(analysis.provider.model, 'provider/actual-free-model:free');
    assert.equal(analysis.provider.freeOnly, true);
    assert.deepEqual(analysis.metadata.usage, {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150
    });
    assert.equal(JSON.stringify(analysis).includes('must-not-leak'), false);
  });
});
