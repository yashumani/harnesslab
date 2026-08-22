import test from 'node:test';
import assert from 'node:assert/strict';

import { loadGatewayConfig } from '../services/gateway/config.mjs';

test('uses safe bounded temporary critic defaults', () => {
  const config = loadGatewayConfig({});
  assert.equal(config.criticTimeoutMs, 20000);
  assert.equal(config.criticMaxBodyBytes, 262144);
  assert.ok(config.criticTimeoutMs < config.requestTimeoutMs);
});

test('parses explicit bounded critic limits', () => {
  const config = loadGatewayConfig({
    HARNESSLAB_CRITIC_TIMEOUT_MS: '12500',
    HARNESSLAB_CRITIC_MAX_BODY_BYTES: '131072'
  });
  assert.equal(config.criticTimeoutMs, 12500);
  assert.equal(config.criticMaxBodyBytes, 131072);
});

test('rejects unsafe temporary critic timeout and body limits', () => {
  assert.throws(
    () => loadGatewayConfig({ HARNESSLAB_CRITIC_TIMEOUT_MS: '100' }),
    /between 500 and 120000/
  );
  assert.throws(
    () => loadGatewayConfig({ HARNESSLAB_CRITIC_TIMEOUT_MS: '150000' }),
    /between 500 and 120000/
  );
  assert.throws(
    () => loadGatewayConfig({ HARNESSLAB_CRITIC_MAX_BODY_BYTES: '1000' }),
    /between 16384 and 1048576/
  );
  assert.throws(
    () => loadGatewayConfig({ HARNESSLAB_CRITIC_MAX_BODY_BYTES: '2000000' }),
    /between 16384 and 1048576/
  );
});
