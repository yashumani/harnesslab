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
  if (!['deterministic', 'ollama'].includes(provider)) {
    throw new Error('HARNESSLAB_PROVIDER must be deterministic or ollama.');
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
    allowedOrigins: Object.freeze(parseOrigins(environment.HARNESSLAB_ALLOWED_ORIGINS)),
    ollama: Object.freeze({
      baseUrl: normalizeHttpUrl(environment.OLLAMA_BASE_URL || 'http://127.0.0.1:11434', 'OLLAMA_BASE_URL'),
      model: (environment.OLLAMA_DEFAULT_MODEL || '').trim(),
      temperature: 0.2
    })
  });
}
