import {
  normalizeGatewayUrl,
  normalizeRuntimeSettings,
  RuntimeModes
} from './analysis-client.js';
import { executeBrowserDeterministicCritic } from './browser-critic-runtime.js';
import { assertHarnessResult } from './result-contract.js';
import { assertTemporaryWorker } from './temporary-worker-contract.js';

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeMessage(value, fallback = 'The temporary critic request failed.') {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  return value.trim().replace(/\s+/g, ' ').slice(0, 240);
}

function emitResult(result) {
  try {
    if (typeof globalThis.CustomEvent === 'function' && typeof globalThis.dispatchEvent === 'function') {
      globalThis.dispatchEvent(new CustomEvent('harnesslab:critic-result', {
        detail: JSON.parse(JSON.stringify(result))
      }));
    }
  } catch {
    // Event delivery is optional. The returned result remains authoritative.
  }
  return result;
}

export class CriticGatewayError extends Error {
  constructor(message, { code = 'CRITIC_GATEWAY_ERROR', status = null, cause = null } = {}) {
    super(sanitizeMessage(message));
    this.name = 'CriticGatewayError';
    this.code = code;
    this.status = status;
    if (cause) this.cause = cause;
  }
}

function validateCriticEnvelope(payload, { source = 'Temporary critic' } = {}) {
  if (!isRecord(payload) || !isRecord(payload.result) || !isRecord(payload.worker)) {
    throw new CriticGatewayError(`${source} did not include the reviewed harness result and worker artifact.`, {
      code: 'CRITIC_INVALID_ENVELOPE'
    });
  }

  try {
    assertHarnessResult(payload.result);
    assertTemporaryWorker(payload.worker);
    assertTemporaryWorker(payload.result.temporaryWorker);
  } catch (cause) {
    throw new CriticGatewayError(`${source} returned a temporary worker result that failed validation.`, {
      code: 'CRITIC_INVALID_RESULT',
      cause
    });
  }
  if (payload.worker.id !== payload.result.temporaryWorker.id) {
    throw new CriticGatewayError(`${source} returned inconsistent temporary worker identifiers.`, {
      code: 'CRITIC_INVALID_RESULT'
    });
  }

  return {
    result: payload.result,
    worker: payload.worker,
    provider: isRecord(payload.provider) ? payload.provider : null,
    requestId: typeof payload.requestId === 'string' ? payload.requestId : null,
    metadata: isRecord(payload.metadata) ? payload.metadata : null
  };
}

async function fetchCriticJson(fetchImpl, url, result, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('temporary critic timeout')), timeoutMs);
  let response = null;
  let text = '';
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ result }),
      signal: controller.signal
    });
    text = await response.text();
  } catch (cause) {
    if (controller.signal.aborted) {
      throw new CriticGatewayError(`Temporary critic did not complete within ${timeoutMs} ms.`, {
        code: 'CRITIC_TIMEOUT',
        cause
      });
    }
    throw new CriticGatewayError('Unable to reach the configured HarnessLab gateway.', {
      code: 'CRITIC_GATEWAY_UNREACHABLE',
      cause
    });
  } finally {
    clearTimeout(timer);
  }

  if (text.length > MAX_RESPONSE_BYTES) {
    throw new CriticGatewayError('Temporary critic response exceeded the allowed size.', {
      code: 'CRITIC_RESPONSE_TOO_LARGE',
      status: response.status
    });
  }

  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (cause) {
    throw new CriticGatewayError('Temporary critic returned invalid JSON.', {
      code: 'CRITIC_INVALID_JSON',
      status: response.status,
      cause
    });
  }

  if (!response.ok) {
    throw new CriticGatewayError(payload?.error?.message ?? `Gateway returned HTTP ${response.status}.`, {
      code: payload?.error?.code ?? 'CRITIC_HTTP_ERROR',
      status: response.status
    });
  }
  return validateCriticEnvelope(payload, { source: 'Gateway' });
}

export function createCriticClient({
  fetchImpl = globalThis.fetch,
  browserCritic = executeBrowserDeterministicCritic
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required.');
  if (typeof browserCritic !== 'function') throw new TypeError('A browser deterministic critic is required.');

  async function critique(result, inputSettings = {}) {
    assertHarnessResult(result);
    const preliminarySettings = normalizeRuntimeSettings(inputSettings);
    const settings = preliminarySettings.mode === RuntimeModes.BROWSER
      ? preliminarySettings
      : normalizeRuntimeSettings(inputSettings, { strictGatewayUrl: true });

    if (settings.mode === RuntimeModes.BROWSER) {
      try {
        const payload = await browserCritic(result, {
          timeoutMs: Math.max(250, Math.min(60000, settings.timeoutMs))
        });
        return emitResult(validateCriticEnvelope(payload, { source: 'Browser deterministic critic' }));
      } catch (cause) {
        if (cause instanceof CriticGatewayError) throw cause;
        throw new CriticGatewayError('The browser deterministic critic could not complete.', {
          code: typeof cause?.code === 'string' ? cause.code : 'BROWSER_CRITIC_FAILED',
          cause
        });
      }
    }

    const gatewayUrl = normalizeGatewayUrl(settings.gatewayUrl);
    const timeoutMs = Math.max(25000, Math.min(60000, settings.timeoutMs));
    const payload = await fetchCriticJson(fetchImpl, `${gatewayUrl}/v1/critique`, result, timeoutMs);
    return emitResult(payload);
  }

  return { critique };
}
