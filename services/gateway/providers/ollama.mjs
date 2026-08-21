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

export function createOllamaProvider({
  baseUrl,
  model,
  timeoutMs = 45000,
  healthTimeoutMs = 3000,
  temperature = 0.2,
  fetchImpl = globalThis.fetch
}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('Ollama provider requires fetch.');
  const configured = typeof model === 'string' && model.trim().length > 0;
  const normalizedModel = configured ? model.trim() : null;

  async function health() {
    if (!configured) {
      return { configured: false, available: false, reason: 'OLLAMA_DEFAULT_MODEL is not configured.' };
    }
    try {
      const { response, payload } = await fetchProviderJson({
        fetchImpl,
        url: `${baseUrl}/api/tags`,
        options: { method: 'GET', headers: { accept: 'application/json' } },
        timeoutMs: healthTimeoutMs,
        providerLabel: 'Ollama'
      });
      if (!response.ok) return { configured: true, available: false, reason: `Ollama health returned HTTP ${response.status}.` };
      const models = Array.isArray(payload?.models) ? payload.models : [];
      const available = models.some((entry) => entry?.name === normalizedModel || entry?.model === normalizedModel);
      return {
        configured: true,
        available,
        reason: available ? null : 'Configured Ollama model is not installed.'
      };
    } catch (error) {
      return {
        configured: true,
        available: false,
        reason: error instanceof Error ? error.message : 'Ollama health check failed.'
      };
    }
  }

  async function analyze(requirement, { signal = null } = {}) {
    if (!configured) throw new ProviderUnavailableError('Ollama is selected but OLLAMA_DEFAULT_MODEL is not configured.');
    const { response, payload } = await fetchProviderJson({
      fetchImpl,
      url: `${baseUrl}/api/chat`,
      options: {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: normalizedModel,
          stream: false,
          format: 'json',
          messages: [
            {
              role: 'system',
              content: 'You are a bounded architecture-analysis worker. Follow the requested JSON schema and never claim external execution.'
            },
            { role: 'user', content: createArchitecturePrompt(requirement) }
          ],
          options: { temperature }
        })
      },
      timeoutMs,
      upstreamSignal: signal,
      providerLabel: 'Ollama'
    });

    if (!response.ok) {
      throw response.status >= 500
        ? new ProviderUnavailableError(`Ollama returned HTTP ${response.status}.`)
        : new ProviderResponseError(`Ollama rejected the request with HTTP ${response.status}.`);
    }

    const supplement = parseArchitectureSupplement(payload?.message?.content, { providerLabel: 'Ollama' });
    return {
      result: applyArchitectureSupplement(requirement, supplement, {
        providerLabel: 'Ollama',
        runIdPrefix: 'OLLAMA',
        mode: 'Live Ollama-assisted analysis with deterministic HarnessLab controls',
        traceDetail: 'Ollama supplied bounded architecture guidance; deterministic policy, artifact, and evaluation controls remained authoritative.',
        constraint: 'Ollama may advise architecture and questions, but deterministic HarnessLab controls remain authoritative.',
        verdictLabel: 'Ollama-assisted'
      }),
      model: normalizedModel,
      usage: {
        promptTokens: Number.isFinite(payload?.prompt_eval_count) ? payload.prompt_eval_count : null,
        completionTokens: Number.isFinite(payload?.eval_count) ? payload.eval_count : null,
        totalDurationNs: Number.isFinite(payload?.total_duration) ? payload.total_duration : null
      }
    };
  }

  return {
    name: 'ollama',
    model: normalizedModel,
    liveModel: true,
    configured,
    health,
    analyze
  };
}
