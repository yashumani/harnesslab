import { assertHarnessResult } from './result-contract.js';

export const ANALYSIS_RUNTIME_STORAGE_KEY = 'harnesslab.analysis-runtime.v1';
export const RuntimeModes = Object.freeze({
  BROWSER: 'browser',
  AUTOMATIC: 'automatic',
  GATEWAY: 'gateway'
});

export const DEFAULT_RUNTIME_SETTINGS = Object.freeze({
  mode: RuntimeModes.BROWSER,
  gatewayUrl: 'http://127.0.0.1:8787',
  timeoutMs: 5000
});

const MAX_RESPONSE_BYTES = 1024 * 1024;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeMessage(value, fallback = 'The analysis gateway request failed.') {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  return value.replace(/\s+/g, ' ').trim().slice(0, 240);
}

export class AnalysisGatewayError extends Error {
  constructor(message, { code = 'GATEWAY_ERROR', status = null, cause = null } = {}) {
    super(sanitizeMessage(message));
    this.name = 'AnalysisGatewayError';
    this.code = code;
    this.status = status;
    if (cause) this.cause = cause;
  }
}

export function normalizeGatewayUrl(value) {
  if (typeof value !== 'string') throw new AnalysisGatewayError('Gateway URL must be text.', { code: 'INVALID_GATEWAY_URL' });
  let url;
  try {
    url = new URL(value.trim());
  } catch (cause) {
    throw new AnalysisGatewayError('Enter a valid HTTP or HTTPS gateway URL.', { code: 'INVALID_GATEWAY_URL', cause });
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new AnalysisGatewayError('Gateway URL must use HTTP or HTTPS.', { code: 'INVALID_GATEWAY_URL' });
  }
  if (url.username || url.password) {
    throw new AnalysisGatewayError('Do not place credentials in the gateway URL.', { code: 'INVALID_GATEWAY_URL' });
  }
  url.hash = '';
  url.search = '';
  return url.toString().replace(/\/$/, '');
}

export function normalizeRuntimeSettings(value = {}) {
  const candidate = isRecord(value) ? value : {};
  const mode = Object.values(RuntimeModes).includes(candidate.mode)
    ? candidate.mode
    : DEFAULT_RUNTIME_SETTINGS.mode;
  const timeout = Number(candidate.timeoutMs);
  const timeoutMs = Number.isFinite(timeout)
    ? Math.max(500, Math.min(60000, Math.round(timeout)))
    : DEFAULT_RUNTIME_SETTINGS.timeoutMs;
  let gatewayUrl = DEFAULT_RUNTIME_SETTINGS.gatewayUrl;
  try {
    gatewayUrl = normalizeGatewayUrl(candidate.gatewayUrl ?? gatewayUrl);
  } catch {
    gatewayUrl = DEFAULT_RUNTIME_SETTINGS.gatewayUrl;
  }
  return { mode, gatewayUrl, timeoutMs };
}

export function loadRuntimeSettings(storage = null) {
  if (!storage) return { ...DEFAULT_RUNTIME_SETTINGS };
  try {
    const raw = storage.getItem(ANALYSIS_RUNTIME_STORAGE_KEY);
    return raw ? normalizeRuntimeSettings(JSON.parse(raw)) : { ...DEFAULT_RUNTIME_SETTINGS };
  } catch {
    return { ...DEFAULT_RUNTIME_SETTINGS };
  }
}

export function saveRuntimeSettings(storage, settings) {
  const normalized = normalizeRuntimeSettings(settings);
  if (storage) {
    try {
      storage.setItem(ANALYSIS_RUNTIME_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Runtime settings are convenience metadata. Analysis remains available without persistence.
    }
  }
  return normalized;
}

function elapsedMs(startedAt, now) {
  return Math.max(0, Math.round(now() - startedAt));
}

function appendFallbackEvidence(result, reason) {
  const next = cloneJson(result);
  const fallbackEntry = {
    sequence: 0,
    offset: '+fallback',
    event: 'gateway.fallback',
    detail: `Gateway analysis was unavailable; deterministic browser analysis was used. ${sanitizeMessage(reason, '')}`.trim(),
    status: 'Complete'
  };
  const trace = Array.isArray(next.trace) ? [...next.trace] : [];
  const responseIndex = trace.findIndex((entry) => entry?.event === 'response.ready');
  if (responseIndex >= 0) trace.splice(responseIndex, 0, fallbackEntry);
  else trace.push(fallbackEntry);
  next.trace = trace.map((entry, index) => ({ ...entry, sequence: index + 1 }));
  next.constraints = [
    ...(Array.isArray(next.constraints) ? next.constraints : []),
    'The configured gateway did not produce this result; deterministic browser fallback was recorded explicitly.'
  ];
  return next;
}

function attachRuntime(result, runtime) {
  const next = cloneJson(result);
  next.runtime = {
    mode: runtime.mode,
    source: runtime.source,
    provider: runtime.provider,
    model: runtime.model ?? null,
    gatewayUrl: runtime.gatewayUrl ?? null,
    requestId: runtime.requestId ?? null,
    latencyMs: runtime.latencyMs,
    fallbackUsed: Boolean(runtime.fallbackUsed),
    fallbackReason: runtime.fallbackReason ?? null
  };
  assertHarnessResult(next);
  return next;
}

async function fetchJson(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(url, { ...options, signal: controller.signal });
  } catch (cause) {
    if (controller.signal.aborted) {
      throw new AnalysisGatewayError(`Gateway did not respond within ${timeoutMs} ms.`, {
        code: 'GATEWAY_TIMEOUT',
        cause
      });
    }
    throw new AnalysisGatewayError('Unable to reach the configured analysis gateway.', {
      code: 'GATEWAY_UNREACHABLE',
      cause
    });
  } finally {
    clearTimeout(timer);
  }

  let text;
  try {
    text = await response.text();
  } catch (cause) {
    throw new AnalysisGatewayError('Unable to read the gateway response.', {
      code: 'GATEWAY_RESPONSE_ERROR',
      status: response.status,
      cause
    });
  }
  if (text.length > MAX_RESPONSE_BYTES) {
    throw new AnalysisGatewayError('Gateway response exceeded the allowed size.', {
      code: 'GATEWAY_RESPONSE_TOO_LARGE',
      status: response.status
    });
  }

  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (cause) {
      throw new AnalysisGatewayError('Gateway returned invalid JSON.', {
        code: 'GATEWAY_INVALID_JSON',
        status: response.status,
        cause
      });
    }
  }

  if (!response.ok) {
    const message = payload?.error?.message ?? `Gateway returned HTTP ${response.status}.`;
    throw new AnalysisGatewayError(message, {
      code: payload?.error?.code ?? 'GATEWAY_HTTP_ERROR',
      status: response.status
    });
  }
  if (!isRecord(payload)) {
    throw new AnalysisGatewayError('Gateway returned an empty response.', { code: 'GATEWAY_EMPTY_RESPONSE' });
  }
  return payload;
}

function validateGatewayEnvelope(payload) {
  if (!isRecord(payload.result)) {
    throw new AnalysisGatewayError('Gateway response did not include a harness result.', { code: 'GATEWAY_INVALID_RESULT' });
  }
  try {
    assertHarnessResult(payload.result);
  } catch (cause) {
    throw new AnalysisGatewayError('Gateway returned a result that failed the HarnessLab contract.', {
      code: 'GATEWAY_INVALID_RESULT',
      cause
    });
  }
  const provider = isRecord(payload.provider) && typeof payload.provider.name === 'string'
    ? payload.provider
    : { name: 'unknown', model: null };
  return {
    result: payload.result,
    requestId: typeof payload.requestId === 'string' ? payload.requestId : null,
    provider,
    latencyMs: Number.isFinite(payload.metadata?.latencyMs) ? payload.metadata.latencyMs : null
  };
}

export function createAnalysisClient({
  fetchImpl = globalThis.fetch,
  fallbackAnalyze,
  now = () => globalThis.performance?.now?.() ?? Date.now()
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required.');
  if (typeof fallbackAnalyze !== 'function') throw new TypeError('A deterministic fallback analyzer is required.');

  async function browserAnalysis(requirement, settings, fallback = null) {
    const startedAt = now();
    let result = await fallbackAnalyze(requirement);
    assertHarnessResult(result);
    if (fallback) result = appendFallbackEvidence(result, fallback.message);
    return attachRuntime(result, {
      mode: settings.mode,
      source: 'browser',
      provider: 'deterministic',
      model: null,
      latencyMs: elapsedMs(startedAt, now),
      fallbackUsed: Boolean(fallback),
      fallbackReason: fallback?.code ?? null
    });
  }

  async function gatewayAnalysis(requirement, settings) {
    const gatewayUrl = normalizeGatewayUrl(settings.gatewayUrl);
    const startedAt = now();
    const payload = await fetchJson(fetchImpl, `${gatewayUrl}/v1/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requirement })
    }, settings.timeoutMs);
    const envelope = validateGatewayEnvelope(payload);
    return attachRuntime(envelope.result, {
      mode: settings.mode,
      source: 'gateway',
      provider: envelope.provider.name,
      model: envelope.provider.model ?? null,
      gatewayUrl,
      requestId: envelope.requestId,
      latencyMs: envelope.latencyMs ?? elapsedMs(startedAt, now),
      fallbackUsed: false
    });
  }

  async function analyze(requirement, inputSettings = {}) {
    if (typeof requirement !== 'string' || requirement.trim().length < 8) {
      throw new Error('Describe the agent use case in at least 8 characters.');
    }
    const settings = normalizeRuntimeSettings(inputSettings);
    if (settings.mode === RuntimeModes.BROWSER) return browserAnalysis(requirement, settings);

    try {
      return await gatewayAnalysis(requirement, settings);
    } catch (error) {
      const gatewayError = error instanceof AnalysisGatewayError
        ? error
        : new AnalysisGatewayError('Gateway analysis failed.', { cause: error });
      if (settings.mode === RuntimeModes.AUTOMATIC) {
        return browserAnalysis(requirement, settings, gatewayError);
      }
      throw gatewayError;
    }
  }

  async function checkHealth(inputSettings = {}) {
    const settings = normalizeRuntimeSettings(inputSettings);
    const gatewayUrl = normalizeGatewayUrl(settings.gatewayUrl);
    const payload = await fetchJson(fetchImpl, `${gatewayUrl}/health`, {
      method: 'GET',
      headers: { accept: 'application/json' }
    }, Math.min(settings.timeoutMs, 5000));
    if (payload.service !== 'harnesslab-gateway' || !isRecord(payload.provider)) {
      throw new AnalysisGatewayError('Endpoint is not a compatible HarnessLab gateway.', {
        code: 'INCOMPATIBLE_GATEWAY'
      });
    }
    return {
      gatewayUrl,
      status: typeof payload.status === 'string' ? payload.status : 'unknown',
      requestId: typeof payload.requestId === 'string' ? payload.requestId : null,
      provider: {
        name: typeof payload.provider.name === 'string' ? payload.provider.name : 'unknown',
        model: typeof payload.provider.model === 'string' ? payload.provider.model : null,
        configured: Boolean(payload.provider.configured),
        available: Boolean(payload.provider.available),
        liveModel: Boolean(payload.provider.liveModel)
      }
    };
  }

  return { analyze, checkHealth };
}
