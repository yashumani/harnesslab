import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ProviderResponseError,
  ProviderTimeoutError,
  ProviderUnavailableError
} from '../services/gateway/errors.mjs';
import { fetchProviderJson } from '../services/gateway/providers/provider-http.mjs';

test('timeout covers a provider body that stalls after headers', async () => {
  await assert.rejects(
    fetchProviderJson({
      fetchImpl: async (_url, options) => ({
        ok: true,
        status: 200,
        async text() {
          return new Promise((resolve, reject) => {
            options.signal.addEventListener('abort', () => reject(new Error('body aborted')), { once: true });
          });
        }
      }),
      url: 'https://provider.example.test/resource',
      timeoutMs: 25,
      providerLabel: 'Test provider'
    }),
    (error) => error instanceof ProviderTimeoutError
  );
});

test('rejects responses larger than the configured provider boundary', async () => {
  await assert.rejects(
    fetchProviderJson({
      fetchImpl: async () => new Response(JSON.stringify({ data: 'x'.repeat(100) }), { status: 200 }),
      url: 'https://provider.example.test/resource',
      timeoutMs: 1000,
      maxResponseBytes: 32,
      providerLabel: 'Test provider'
    }),
    (error) => error instanceof ProviderResponseError && /exceeded the allowed size/.test(error.message)
  );
});

test('rejects invalid provider JSON without echoing its contents', async () => {
  const rawContent = 'not-json-sensitive-provider-content';
  await assert.rejects(
    fetchProviderJson({
      fetchImpl: async () => new Response(rawContent, { status: 200 }),
      url: 'https://provider.example.test/resource',
      timeoutMs: 1000,
      providerLabel: 'Test provider'
    }),
    (error) => {
      assert.equal(error instanceof ProviderResponseError, true);
      assert.equal(error.message.includes(rawContent), false);
      return true;
    }
  );
});

test('maps network failures to provider-unavailable errors', async () => {
  await assert.rejects(
    fetchProviderJson({
      fetchImpl: async () => { throw new TypeError('network down'); },
      url: 'https://provider.example.test/resource',
      timeoutMs: 1000,
      providerLabel: 'Test provider'
    }),
    (error) => error instanceof ProviderUnavailableError
  );
});

test('upstream cancellation aborts the provider request', async () => {
  const upstream = new AbortController();
  const request = fetchProviderJson({
    fetchImpl: async (_url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('request aborted')), { once: true });
    }),
    url: 'https://provider.example.test/resource',
    timeoutMs: 1000,
    upstreamSignal: upstream.signal,
    providerLabel: 'Test provider'
  });
  upstream.abort(new Error('caller cancelled'));
  await assert.rejects(request, (error) => error instanceof ProviderTimeoutError);
});
