import {
  ProviderResponseError,
  ProviderUnavailableError
} from '../errors.mjs';
import {
  applyArchitectureSupplement,
  createArchitecturePrompt,
  parseArchitectureSupplement
} from './architecture-guidance.mjs';
import { fetchProviderJson } from './provider-http.mjs';

export const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';
export const DEFAULT_OPENROUTER_FREE_MODEL = 'openrouter/free';

export function normalizeFreeOpenRouterModel(value = DEFAULT_OPENROUTER_FREE_MODEL) {
  if (typeof value !== 'string') throw new Error('OPENROUTER_DEFAULT_MODEL must be text.');
  const model = value.trim();
  if (!model || model.length > 200 || /\s/.test(model) || !model.includes('/')) {
    throw new Error('OPENROUTER_DEFAULT_MODEL must be a valid OpenRouter model identifier.');
  }
  if (model !== DEFAULT_OPENROUTER_FREE_MODEL && !model.endsWith(':free')) {
    throw new Error('HarnessLab permits only openrouter/free or an explicit OpenRouter model ending in :free.');
  }
  return model;
}

function normalizeOptionalHeader(value, maximum) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/[\r\n]+/g, ' ');
  return normalized ? normalized.slice(0, maximum) : null;
}

function extractMessageContent(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const combined = content
      .filter((part) => part && typeof part === 'object' && part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n')
      .trim();
    if (combined) return combined;
  }
  throw new ProviderResponseError('OpenRouter response did not contain assistant text.');
}

function responseModel(payload, configuredModel) {
  const candidate = typeof payload?.model === 'string' ? payload.model.trim() : '';
  return candidate && candidate.length <= 200 && !/[\r\n]/.test(candidate)
    ? candidate
    : configuredModel;
}

export function createOpenRouterProvider({
  apiKey,
  model = DEFAULT_OPENROUTER_FREE_MODEL,
  timeoutMs = 45000,
  healthTimeoutMs = 3000,
  temperature = 0.2,
  maxTokens = 1200,
  httpReferer = null,
  appTitle = 'HarnessLab',
  fetchImpl = globalThis.fetch
}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('OpenRouter provider requires fetch.');
  const normalizedModel = normalizeFreeOpenRouterModel(model);
  const normalizedKey = typeof apiKey === 'string' ? apiKey.trim() : '';
  const configured = normalizedKey.length > 0;
  const referer = normalizeOptionalHeader(httpReferer, 500);
  const title = normalizeOptionalHeader(appTitle, 100) || 'HarnessLab';

  function headers({ json = false } = {}) {
    const result = {
      accept: 'application/json',
      authorization: `Bearer ${normalizedKey}`,
      'x-openrouter-title': title
    };
    if (json) result['content-type'] = 'application/json';
    if (referer) result['http-referer'] = referer;
    return result;
  }

  async function health() {
    if (!configured) {
      return { configured: false, available: false, reason: 'OPENROUTER_API_KEY is not configured.' };
    }
    try {
      const { response, payload } = await fetchProviderJson({
        fetchImpl,
        url: `${OPENROUTER_API_BASE}/key`,
        options: { method: 'GET', headers: headers() },
        timeoutMs: healthTimeoutMs,
        providerLabel: 'OpenRouter'
      });
      if (response.status === 401 || response.status === 403) {
        return { configured: true, available: false, reason: 'Configured OpenRouter API key was rejected.' };
      }
      if (!response.ok) {
        return { configured: true, available: false, reason: `OpenRouter health returned HTTP ${response.status}.` };
      }
      const available = payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data);
      return {
        configured: true,
        available,
        reason: available ? null : 'OpenRouter key metadata response was invalid.'
      };
    } catch (error) {
      return {
        configured: true,
        available: false,
        reason: error instanceof Error ? error.message : 'OpenRouter health check failed.'
      };
    }
  }

  async function analyze(requirement, { signal = null } = {}) {
    if (!configured) throw new ProviderUnavailableError('OpenRouter is selected but OPENROUTER_API_KEY is not configured.');
    const { response, payload } = await fetchProviderJson({
      fetchImpl,
      url: `${OPENROUTER_API_BASE}/chat/completions`,
      options: {
        method: 'POST',
        headers: headers({ json: true }),
        body: JSON.stringify({
          model: normalizedModel,
          stream: false,
          temperature,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
          usage: { include: true },
          messages: [
            {
              role: 'system',
              content: 'You are a bounded architecture-analysis worker. Follow the requested JSON schema and never claim external execution.'
            },
            { role: 'user', content: createArchitecturePrompt(requirement) }
          ]
        })
      },
      timeoutMs,
      upstreamSignal: signal,
      providerLabel: 'OpenRouter'
    });

    if (!response.ok) {
      if ([401, 403].includes(response.status)) {
        throw new ProviderUnavailableError('OpenRouter rejected the configured API key.');
      }
      if (response.status === 429) {
        throw new ProviderUnavailableError('OpenRouter free-model rate limit or availability capacity was reached.');
      }
      throw response.status >= 500
        ? new ProviderUnavailableError(`OpenRouter returned HTTP ${response.status}.`)
        : new ProviderResponseError(`OpenRouter rejected the request with HTTP ${response.status}.`);
    }

    const supplement = parseArchitectureSupplement(extractMessageContent(payload), { providerLabel: 'OpenRouter' });
    const routedModel = responseModel(payload, normalizedModel);
    return {
      result: applyArchitectureSupplement(requirement, supplement, {
        providerLabel: 'OpenRouter',
        runIdPrefix: 'OPENROUTER',
        mode: 'Live OpenRouter free-model analysis with deterministic HarnessLab controls',
        traceDetail: `OpenRouter supplied bounded architecture guidance through a free route (${routedModel}); deterministic policy, artifact, and evaluation controls remained authoritative.`,
        constraint: 'OpenRouter may advise architecture and questions through a free model route, but deterministic HarnessLab controls remain authoritative.',
        verdictLabel: 'OpenRouter-assisted'
      }),
      model: routedModel,
      usage: {
        promptTokens: Number.isFinite(payload?.usage?.prompt_tokens) ? payload.usage.prompt_tokens : null,
        completionTokens: Number.isFinite(payload?.usage?.completion_tokens) ? payload.usage.completion_tokens : null,
        totalTokens: Number.isFinite(payload?.usage?.total_tokens) ? payload.usage.total_tokens : null
      }
    };
  }

  return {
    name: 'openrouter',
    model: normalizedModel,
    liveModel: true,
    configured,
    freeOnly: true,
    health,
    analyze
  };
}
