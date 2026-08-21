import test from 'node:test';
import assert from 'node:assert/strict';

import { loadGatewayConfig } from '../services/gateway/config.mjs';
import { createConfiguredProvider } from '../services/gateway/provider-registry.mjs';

test('keeps deterministic as the default provider', () => {
  const provider = createConfiguredProvider(loadGatewayConfig({}));
  assert.equal(provider.name, 'deterministic');
  assert.equal(provider.liveModel, false);
  assert.equal(provider.configured, true);
});

test('constructs an explicitly configured free-only OpenRouter provider', () => {
  let fetchCalls = 0;
  const config = loadGatewayConfig({
    HARNESSLAB_PROVIDER: 'openrouter',
    OPENROUTER_API_KEY: 'unit-test-key',
    OPENROUTER_DEFAULT_MODEL: 'vendor/model:free'
  });
  const provider = createConfiguredProvider(config, {
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('construction must not call the provider');
    }
  });
  assert.equal(provider.name, 'openrouter');
  assert.equal(provider.model, 'vendor/model:free');
  assert.equal(provider.freeOnly, true);
  assert.equal(provider.configured, true);
  assert.equal(fetchCalls, 0);
});

test('rejects registry values outside the validated provider set', () => {
  assert.throws(
    () => createConfiguredProvider({ provider: 'unsupported' }),
    /Unsupported provider/
  );
});
