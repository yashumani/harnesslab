import { createDeterministicProvider } from './providers/deterministic.mjs';
import { createOllamaProvider } from './providers/ollama.mjs';

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
  throw new Error(`Unsupported provider: ${config.provider}`);
}
