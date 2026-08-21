import test from 'node:test';
import assert from 'node:assert/strict';

import { loadGatewayConfig } from '../services/gateway/config.mjs';

test('uses local deterministic defaults without credentials', () => {
  const config = loadGatewayConfig({});
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 8787);
  assert.equal(config.provider, 'deterministic');
  assert.equal(config.ollama.model, '');
  assert.ok(config.allowedOrigins.includes('https://yashumani.github.io'));
});

test('parses explicit Ollama and origin settings', () => {
  const config = loadGatewayConfig({
    HARNESSLAB_PROVIDER: 'ollama',
    HARNESSLAB_GATEWAY_HOST: '0.0.0.0',
    HARNESSLAB_GATEWAY_PORT: '9000',
    HARNESSLAB_GATEWAY_TIMEOUT_MS: '12000',
    HARNESSLAB_ALLOWED_ORIGINS: 'https://example.test,http://localhost:4173',
    OLLAMA_BASE_URL: 'http://127.0.0.1:11434/',
    OLLAMA_DEFAULT_MODEL: 'qwen-test'
  });
  assert.equal(config.provider, 'ollama');
  assert.equal(config.port, 9000);
  assert.equal(config.requestTimeoutMs, 12000);
  assert.deepEqual(config.allowedOrigins, ['https://example.test', 'http://localhost:4173']);
  assert.equal(config.ollama.baseUrl, 'http://127.0.0.1:11434');
  assert.equal(config.ollama.model, 'qwen-test');
});

test('rejects unsupported providers and invalid numeric limits', () => {
  assert.throws(
    () => loadGatewayConfig({ HARNESSLAB_PROVIDER: 'unknown' }),
    /deterministic or ollama/
  );
  assert.throws(
    () => loadGatewayConfig({ HARNESSLAB_GATEWAY_PORT: '70000' }),
    /between 1 and 65535/
  );
  assert.throws(
    () => loadGatewayConfig({ HARNESSLAB_MAX_BODY_BYTES: '10' }),
    /between 1024 and 1048576/
  );
});

test('rejects origins with paths and URLs containing credentials', () => {
  assert.throws(
    () => loadGatewayConfig({ HARNESSLAB_ALLOWED_ORIGINS: 'https://example.test/path' }),
    /must not include credentials, path, query, or fragment/
  );
  assert.throws(
    () => loadGatewayConfig({ OLLAMA_BASE_URL: 'http://user:secret@localhost:11434' }),
    /must not contain credentials/
  );
});
