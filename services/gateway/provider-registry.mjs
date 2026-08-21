import { createDeterministicProvider } from './providers/deterministic.mjs';
import { createOllamaProvider } from './providers/ollama.mjs';
import { createOpenRouterProvider } from './providers/openrouter.mjs';

export function createConfiguredProvider(config, { fetchImpl = globalThis.fetch } = {}) {
  if (config.provider === 'deterministic') return createDeterministicProvider();
  if (config.provider === 'ollama') {
    return createOllamaProvider({
      baseUrl: config.ollama.baseUrl,
      model: config.ollama.model,
      temperature: config.ollama.temperature,
      timeoutMs: config.requestTimeoutMs,
      healthTimeoutMs: config.healthTimeoutMs,
      fetchImpl
    });
  }
  if (config.provider === 'openrouter') {
    return createOpenRouterProvider({
      apiKey: config.openrouter.apiKey,
      model: config.openrouter.model,
      temperature: config.openrouter.temperature,
      maxTokens: config.openrouter.maxTokens,
      httpReferer: config.openrouter.httpReferer,
      appTitle: config.openrouter.appTitle,
      timeoutMs: config.requestTimeoutMs,
      healthTimeoutMs: config.healthTimeoutMs,
      fetchImpl
    });
  }
  throw new Error(`Unsupported provider: ${config.provider}`);
}
