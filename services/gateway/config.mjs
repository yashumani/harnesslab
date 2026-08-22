import {
  DEFAULT_OPENROUTER_FREE_MODEL,
  normalizeFreeOpenRouterModel
} from './providers/openrouter.mjs';

const DEFAULT_ORIGINS = [
  'http://127.0.0.1:4173',
  'http://localhost:4173',
  'https://yashumani.github.io'
];

function parseInteger(value, fallback, { minimum, maximum, name }) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

function normalizeHttpUrl(value, name) {
  let url;
  try {
    url = new URL(value);
  } catch (cause) {
    throw new Error(`${name} must be a valid HTTP or HTTPS URL.`, { cause });
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${name} must use HTTP or HTTPS.`);
  if (url.username || url.password) throw new Error(`${name} must not contain credentials.`);
  url.hash = '';
  url.search = '';
  return url.toString().replace(/\/$/, '');
}

function normalizeOptionalText(value, fallback, { name, maximum }) {
  const candidate = typeof value === 'string' && value.trim() ? value.trim() : fallback;
  if (/\r|\n/.test(candidate) || candidate.length > maximum) {
    throw new Error(`${name} must be one line with ${maximum} characters or fewer.`);
  }
  return candidate;
}

function parseOrigins(value) {
  const origins = value
    ? value.split(',').map((origin) => origin.trim()).filter(Boolean)
    : DEFAULT_ORIGINS;
  if (!origins.length) throw new Error('HARNESSLAB_ALLOWED_ORIGINS must contain at least one origin.');
  const normalized = origins.map((origin) => {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Allowed origins must use HTTP or HTTPS.');
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error(`Allowed origin must not include credentials, path, query, or fragment: ${origin}`);
    }
    return url.origin;
  });
  return [...new Set(normalized)];
}

export function loadGatewayConfig(environment = process.env) {
  const provider = (environment.HARNESSLAB_PROVIDER || 'deterministic').trim().toLowerCase();
  if (!['deterministic', 'ollama', 'openrouter'].includes(provider)) {
    throw new Error('HARNESSLAB_PROVIDER must be deterministic, ollama, or openrouter.');
  }

  return Object.freeze({
    environment: environment.APP_ENV || 'development',
    host: environment.HARNESSLAB_GATEWAY_HOST || '127.0.0.1',
    port: parseInteger(environment.HARNESSLAB_GATEWAY_PORT, 8787, {
      minimum: 1,
      maximum: 65535,
      name: 'HARNESSLAB_GATEWAY_PORT'
    }),
    provider,
    requestTimeoutMs: parseInteger(environment.HARNESSLAB_GATEWAY_TIMEOUT_MS, 45000, {
      minimum: 500,
      maximum: 300000,
      name: 'HARNESSLAB_GATEWAY_TIMEOUT_MS'
    }),
    criticTimeoutMs: parseInteger(environment.HARNESSLAB_CRITIC_TIMEOUT_MS, 20000, {
      minimum: 500,
      maximum: 120000,
      name: 'HARNESSLAB_CRITIC_TIMEOUT_MS'
    }),
    healthTimeoutMs: parseInteger(environment.HARNESSLAB_HEALTH_TIMEOUT_MS, 3000, {
      minimum: 250,
      maximum: 30000,
      name: 'HARNESSLAB_HEALTH_TIMEOUT_MS'
    }),
    maxBodyBytes: parseInteger(environment.HARNESSLAB_MAX_BODY_BYTES, 65536, {
      minimum: 1024,
      maximum: 1048576,
      name: 'HARNESSLAB_MAX_BODY_BYTES'
    }),
    criticMaxBodyBytes: parseInteger(environment.HARNESSLAB_CRITIC_MAX_BODY_BYTES, 262144, {
      minimum: 16384,
      maximum: 1048576,
      name: 'HARNESSLAB_CRITIC_MAX_BODY_BYTES'
    }),
    allowedOrigins: Object.freeze(parseOrigins(environment.HARNESSLAB_ALLOWED_ORIGINS)),
    ollama: Object.freeze({
      baseUrl: normalizeHttpUrl(environment.OLLAMA_BASE_URL || 'http://127.0.0.1:11434', 'OLLAMA_BASE_URL'),
      model: (environment.OLLAMA_DEFAULT_MODEL || '').trim(),
      temperature: 0.2
    }),
    openrouter: Object.freeze({
      apiKey: typeof environment.OPENROUTER_API_KEY === 'string' ? environment.OPENROUTER_API_KEY.trim() : '',
      model: normalizeFreeOpenRouterModel(environment.OPENROUTER_DEFAULT_MODEL || DEFAULT_OPENROUTER_FREE_MODEL),
      temperature: 0.2,
      maxTokens: 1200,
      httpReferer: normalizeHttpUrl(
        environment.OPENROUTER_HTTP_REFERER || 'https://yashumani.github.io/harnesslab/',
        'OPENROUTER_HTTP_REFERER'
      ),
      appTitle: normalizeOptionalText(environment.OPENROUTER_APP_TITLE, 'HarnessLab', {
        name: 'OPENROUTER_APP_TITLE',
        maximum: 100
      })
    })
  });
}
