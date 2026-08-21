import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { assertHarnessResult, HarnessResultValidationError } from '../../apps/web/result-contract.js';
import { assertTemporaryWorker, TemporaryWorkerValidationError } from '../../apps/web/temporary-worker-contract.js';
import {
  GatewayError,
  ProviderTimeoutError,
  RequestValidationError
} from './errors.mjs';
import {
  applyTemporaryCriticOutcome,
  compileCriticContext
} from './temporary-critic.mjs';

const NOOP_LOGGER = Object.freeze({
  info() {},
  warn() {},
  error() {}
});

function elapsedMs(startedAt, now) {
  return Math.max(0, Math.round(now() - startedAt));
}

function isoTimestamp(value) {
  const date = new Date(Number.isFinite(value) ? value : Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function safeReason(value) {
  return typeof value === 'string' && value.trim()
    ? value.replace(/\s+/g, ' ').trim().slice(0, 180)
    : null;
}

function safeModel(value, fallback = null) {
  return typeof value === 'string' && value.trim() && value.length <= 200 && !/[\r\n]/.test(value)
    ? value.trim()
    : fallback;
}

function applyBaseHeaders(response, requestId) {
  response.setHeader('cache-control', 'no-store');
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader('x-request-id', requestId);
}

function applyCorsHeaders(response, origin) {
  if (!origin) return;
  response.setHeader('access-control-allow-origin', origin);
  response.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  response.setHeader('access-control-allow-headers', 'content-type');
  response.setHeader('access-control-max-age', '600');
  response.setHeader('vary', 'Origin');
}

function sendJson(response, status, payload, { requestId, origin = null } = {}) {
  applyBaseHeaders(response, requestId);
  applyCorsHeaders(response, origin);
  response.statusCode = status;
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request, maxBodyBytes) {
  const contentType = request.headers['content-type'] || '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new RequestValidationError('Content-Type must be application/json.', {
      code: 'UNSUPPORTED_MEDIA_TYPE',
      status: 415
    });
  }

  const chunks = [];
  let size = 0;
  let tooLarge = false;
  try {
    for await (const chunk of request) {
      size += chunk.length;
      if (size > maxBodyBytes) {
        tooLarge = true;
        continue;
      }
      chunks.push(chunk);
    }
  } catch (cause) {
    throw new RequestValidationError('Unable to read the request body.', {
      code: 'INVALID_BODY',
      cause
    });
  }
  if (tooLarge) {
    throw new RequestValidationError('Request body exceeded the configured limit.', {
      code: 'BODY_TOO_LARGE',
      status: 413
    });
  }
  if (!chunks.length) throw new RequestValidationError('Request body is required.');

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (cause) {
    throw new RequestValidationError('Request body must contain valid JSON.', {
      code: 'INVALID_JSON',
      cause
    });
  }
}

function validateAnalyzeRequest(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new RequestValidationError('Request body must be a JSON object.');
  }
  const unexpected = Object.keys(payload).filter((key) => key !== 'requirement');
  if (unexpected.length) {
    throw new RequestValidationError(`Unsupported request field: ${unexpected[0]}.`, {
      code: 'UNSUPPORTED_FIELD'
    });
  }
  if (typeof payload.requirement !== 'string') {
    throw new RequestValidationError('requirement must be text.');
  }
  const requirement = payload.requirement.trim();
  if (requirement.length < 8) throw new RequestValidationError('requirement must contain at least 8 characters.');
  if (requirement.length > 1600) throw new RequestValidationError('requirement must contain 1600 characters or fewer.');
  return requirement;
}

function validateCriticRequest(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new RequestValidationError('Request body must be a JSON object.');
  }
  const unexpected = Object.keys(payload).filter((key) => key !== 'result');
  if (unexpected.length) {
    throw new RequestValidationError(`Unsupported request field: ${unexpected[0]}.`, {
      code: 'UNSUPPORTED_FIELD'
    });
  }
  try {
    assertHarnessResult(payload.result);
  } catch (cause) {
    throw new RequestValidationError('result must satisfy the HarnessLab harness-result contract.', {
      code: 'INVALID_HARNESS_RESULT',
      cause
    });
  }
  return payload.result;
}

async function runWithTimeout(task, timeoutMs, timeoutMessage) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort(new Error('gateway task timeout'));
      reject(new ProviderTimeoutError(timeoutMessage));
    }, timeoutMs);
  });
  try {
    return await Promise.race([task(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function runProviderWithTimeout(provider, requirement, timeoutMs) {
  return runWithTimeout(
    (signal) => provider.analyze(requirement, { signal }),
    timeoutMs,
    `Analysis exceeded the ${timeoutMs} ms gateway limit.`
  );
}

async function runCriticWithTimeout(provider, context, timeoutMs) {
  if (typeof provider.critique !== 'function') {
    throw new GatewayError('The configured provider does not support the temporary critic contract.', {
      code: 'TEMPORARY_CRITIC_UNSUPPORTED',
      status: 503,
      expose: true
    });
  }
  return runWithTimeout(
    (signal) => provider.critique(context, { signal }),
    timeoutMs,
    `Temporary critic exceeded the ${timeoutMs} ms worker deadline.`
  );
}

function normalizeError(error) {
  if (error instanceof GatewayError) return error;
  if (error instanceof HarnessResultValidationError || error instanceof TemporaryWorkerValidationError) {
    return new GatewayError('Provider output failed a HarnessLab runtime contract.', {
      code: 'INVALID_PROVIDER_RESULT',
      status: 502,
      cause: error,
      expose: true
    });
  }
  return new GatewayError('The gateway could not complete the request.', {
    code: 'INTERNAL_ERROR',
    status: 500,
    cause: error,
    expose: false
  });
}

export function createGatewayHandler({
  config,
  provider,
  logger = NOOP_LOGGER,
  now = () => Date.now(),
  requestIdFactory = () => randomUUID()
}) {
  if (!config || !provider) throw new TypeError('Gateway config and provider are required.');
  const allowedOrigins = new Set(config.allowedOrigins);

  return async function gatewayHandler(request, response) {
    const requestId = requestIdFactory();
    const origin = typeof request.headers.origin === 'string' ? request.headers.origin : null;
    const startedAt = now();

    if (origin && !allowedOrigins.has(origin)) {
      sendJson(response, 403, {
        requestId,
        error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Request origin is not allowed by this gateway.' }
      }, { requestId });
      logger.warn('gateway.request.denied', { requestId, method: request.method, path: request.url });
      return;
    }

    if (request.method === 'OPTIONS') {
      applyBaseHeaders(response, requestId);
      applyCorsHeaders(response, origin);
      response.statusCode = 204;
      response.removeHeader('content-type');
      response.end();
      return;
    }

    try {
      const url = new URL(request.url || '/', 'http://gateway.local');
      if (request.method === 'GET' && url.pathname === '/health') {
        let health;
        try {
          health = await provider.health();
        } catch (error) {
          health = { configured: provider.configured, available: false, reason: safeReason(error?.message) };
        }
        sendJson(response, 200, {
          requestId,
          service: 'harnesslab-gateway',
          version: '0.3.0',
          status: health.available ? 'ok' : 'degraded',
          provider: {
            name: provider.name,
            model: provider.model,
            liveModel: provider.liveModel,
            freeOnly: Boolean(provider.freeOnly),
            configured: Boolean(health.configured),
            available: Boolean(health.available),
            reason: safeReason(health.reason)
          },
          capabilities: {
            analyzeHarness: true,
            executeTemporaryCritic: typeof provider.critique === 'function',
            maxTemporaryWorkersPerRequest: 1,
            executeTools: false,
            executeMcp: false,
            executeA2a: false,
            executeCode: false,
            externalActions: false
          }
        }, { requestId, origin });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/v1/analyze') {
        const payload = await readJsonBody(request, config.maxBodyBytes);
        const requirement = validateAnalyzeRequest(payload);
        const providerResponse = await runProviderWithTimeout(provider, requirement, config.requestTimeoutMs);
        assertHarnessResult(providerResponse?.result);
        const latencyMs = elapsedMs(startedAt, now);
        const routedModel = safeModel(providerResponse.model, provider.model);
        sendJson(response, 200, {
          requestId,
          provider: {
            name: provider.name,
            model: routedModel,
            liveModel: provider.liveModel,
            freeOnly: Boolean(provider.freeOnly)
          },
          result: providerResponse.result,
          metadata: {
            latencyMs,
            usage: providerResponse.usage ?? null
          }
        }, { requestId, origin });
        logger.info('gateway.analysis.complete', {
          requestId,
          provider: provider.name,
          model: routedModel,
          liveModel: provider.liveModel,
          freeOnly: Boolean(provider.freeOnly),
          latencyMs
        });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/v1/critique') {
        const payload = await readJsonBody(request, config.criticMaxBodyBytes);
        const originalResult = validateCriticRequest(payload);
        const contextEnvelope = compileCriticContext(originalResult);
        const workerStartedAt = isoTimestamp(startedAt);
        let workerResponse = null;
        let workerStatus = 'completed';
        let workerFailure = null;

        try {
          workerResponse = await runCriticWithTimeout(provider, contextEnvelope.context, config.criticTimeoutMs);
        } catch (error) {
          const normalizedWorkerError = normalizeError(error);
          workerStatus = normalizedWorkerError instanceof ProviderTimeoutError || normalizedWorkerError.code === 'PROVIDER_TIMEOUT'
            ? 'timed_out'
            : 'failed';
          workerFailure = normalizedWorkerError;
        }

        const latencyMs = elapsedMs(startedAt, now);
        const routedModel = safeModel(workerResponse?.model, provider.model);
        const reviewedResult = applyTemporaryCriticOutcome(originalResult, {
          review: workerResponse?.review ?? null,
          status: workerStatus,
          provider: provider.name,
          model: routedModel,
          liveModel: provider.liveModel,
          freeOnly: Boolean(provider.freeOnly),
          latencyMs,
          timeoutMs: config.criticTimeoutMs,
          usage: workerResponse?.usage ?? null,
          contextEnvelope,
          startedAt: workerStartedAt,
          completedAt: isoTimestamp(now()),
          failureCode: workerFailure?.code ?? null,
          failureMessage: workerFailure?.message ?? null
        });
        assertTemporaryWorker(reviewedResult.temporaryWorker);

        sendJson(response, 200, {
          requestId,
          provider: {
            name: provider.name,
            model: routedModel,
            liveModel: provider.liveModel,
            freeOnly: Boolean(provider.freeOnly)
          },
          result: reviewedResult,
          worker: reviewedResult.temporaryWorker,
          metadata: {
            latencyMs,
            usage: workerResponse?.usage ?? null,
            completed: workerStatus === 'completed'
          }
        }, { requestId, origin });
        logger.info('gateway.temporary_critic.finished', {
          requestId,
          workerId: reviewedResult.temporaryWorker.id,
          status: workerStatus,
          provider: provider.name,
          model: routedModel,
          liveModel: provider.liveModel,
          freeOnly: Boolean(provider.freeOnly),
          acceptedFindings: reviewedResult.temporaryWorker.acceptedFindings.length,
          rejectedFindings: reviewedResult.temporaryWorker.rejectedFindings.length,
          latencyMs
        });
        return;
      }

      if (['/health', '/v1/analyze', '/v1/critique'].includes(url.pathname)) {
        throw new RequestValidationError('HTTP method is not allowed for this endpoint.', {
          code: 'METHOD_NOT_ALLOWED',
          status: 405
        });
      }
      throw new RequestValidationError('Endpoint was not found.', {
        code: 'NOT_FOUND',
        status: 404
      });
    } catch (error) {
      const normalized = normalizeError(error);
      const publicMessage = normalized.expose
        ? safeReason(normalized.message) || 'The request failed.'
        : 'The gateway could not complete the request.';
      sendJson(response, normalized.status, {
        requestId,
        error: { code: normalized.code, message: publicMessage }
      }, { requestId, origin });
      const log = normalized.status >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger);
      log('gateway.request.failed', {
        requestId,
        method: request.method,
        path: request.url,
        status: normalized.status,
        code: normalized.code
      });
    }
  };
}

export function createGatewayServer(options) {
  const handler = createGatewayHandler(options);
  return createServer((request, response) => {
    handler(request, response).catch((error) => {
      const requestId = options.requestIdFactory?.() ?? randomUUID();
      if (!response.headersSent) {
        sendJson(response, 500, {
          requestId,
          error: { code: 'UNHANDLED_ERROR', message: 'The gateway could not complete the request.' }
        }, { requestId });
      } else {
        response.destroy(error);
      }
    });
  });
}
