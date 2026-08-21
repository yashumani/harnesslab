import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeRequirement, examples } from '../apps/web/engine.js';
import {
  AnalysisGatewayError,
  createAnalysisClient,
  RuntimeModes,
  saveRuntimeSettings
} from '../apps/web/analysis-client.js';
import { createMemoryStorage } from '../apps/web/workspace-store.js';

test('gateway timeout covers a response body that stalls after headers', async () => {
  const client = createAnalysisClient({
    fallbackAnalyze: analyzeRequirement,
    fetchImpl: async (_url, options) => ({
      ok: true,
      status: 200,
      async text() {
        return new Promise((resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(new Error('aborted body')), { once: true });
        });
      }
    })
  });

  await assert.rejects(
    client.analyze(examples[0].value, {
      mode: RuntimeModes.GATEWAY,
      gatewayUrl: 'http://127.0.0.1:8787',
      timeoutMs: 500
    }),
    (error) => error instanceof AnalysisGatewayError && error.code === 'GATEWAY_TIMEOUT'
  );
});

test('gateway-required mode rejects malformed URLs instead of substituting a default', async () => {
  const client = createAnalysisClient({
    fallbackAnalyze: analyzeRequirement,
    fetchImpl: async () => { throw new Error('must not fetch'); }
  });

  await assert.rejects(
    client.analyze(examples[0].value, {
      mode: RuntimeModes.GATEWAY,
      gatewayUrl: 'not a url'
    }),
    (error) => error instanceof AnalysisGatewayError && error.code === 'INVALID_GATEWAY_URL'
  );
});

test('runtime settings reject URLs containing embedded credentials', () => {
  assert.throws(
    () => saveRuntimeSettings(createMemoryStorage(), {
      mode: RuntimeModes.GATEWAY,
      gatewayUrl: 'https://user:secret@example.test',
      timeoutMs: 5000
    }),
    (error) => error instanceof AnalysisGatewayError && error.code === 'INVALID_GATEWAY_URL'
  );
});
