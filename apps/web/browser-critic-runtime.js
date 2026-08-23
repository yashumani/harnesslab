import {
  applyTemporaryCriticOutcome,
  buildCriticContext,
  createDeterministicCriticReview
} from './critic-core.js';
import { assertHarnessResult } from './result-contract.js';
import { assertTemporaryWorker } from './temporary-worker-contract.js';

const DEFAULT_BROWSER_CRITIC_TIMEOUT_MS = 20000;

export class BrowserCriticRuntimeError extends Error {
  constructor(message, { code = 'BROWSER_CRITIC_ERROR', cause = null } = {}) {
    super(message);
    this.name = 'BrowserCriticRuntimeError';
    this.code = code;
    if (cause) this.cause = cause;
  }
}

function clampTimeout(value) {
  const candidate = Number(value);
  if (!Number.isFinite(candidate)) return DEFAULT_BROWSER_CRITIC_TIMEOUT_MS;
  return Math.max(250, Math.min(300000, Math.round(candidate)));
}

function isoTimestamp(value) {
  const date = new Date(Number.isFinite(value) ? value : Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function fallbackHash(bytes) {
  let hash = 2166136261;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  const primary = (hash >>> 0).toString(16).padStart(8, '0');
  let secondary = 0x9e3779b9;
  for (let index = bytes.length - 1; index >= 0; index -= 1) {
    secondary ^= bytes[index];
    secondary = Math.imul(secondary, 2246822519);
  }
  return `${primary}${(secondary >>> 0).toString(16).padStart(8, '0')}`.slice(0, 12).toUpperCase();
}

async function hashContext(context, cryptoImpl = globalThis.crypto) {
  const bytes = new TextEncoder().encode(JSON.stringify(context));
  if (!cryptoImpl?.subtle?.digest) return fallbackHash(bytes);
  try {
    const digest = await cryptoImpl.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 12)
      .toUpperCase();
  } catch (cause) {
    throw new BrowserCriticRuntimeError('Unable to derive the browser critic context identifier.', {
      code: 'BROWSER_CRITIC_HASH_FAILED',
      cause
    });
  }
}

export async function compileBrowserCriticContext(result, { cryptoImpl = globalThis.crypto } = {}) {
  const { context, inputBytes } = buildCriticContext(result);
  const hash = await hashContext(context, cryptoImpl);
  return Object.freeze({
    context: Object.freeze(context),
    inputBytes,
    hash
  });
}

export async function executeBrowserDeterministicCritic(result, {
  timeoutMs = DEFAULT_BROWSER_CRITIC_TIMEOUT_MS,
  now = () => Date.now(),
  cryptoImpl = globalThis.crypto
} = {}) {
  assertHarnessResult(result);
  const boundedTimeoutMs = clampTimeout(timeoutMs);
  const startedAtMs = Number(now());
  const contextEnvelope = await compileBrowserCriticContext(result, { cryptoImpl });
  const review = createDeterministicCriticReview(contextEnvelope.context);
  const completedAtMs = Number(now());
  const latencyMs = Math.max(0, Math.round(completedAtMs - startedAtMs));
  const reviewedResult = applyTemporaryCriticOutcome(result, {
    review,
    status: 'completed',
    provider: 'deterministic',
    model: null,
    liveModel: false,
    freeOnly: false,
    latencyMs,
    timeoutMs: boundedTimeoutMs,
    usage: null,
    contextEnvelope,
    startedAt: isoTimestamp(startedAtMs),
    completedAt: isoTimestamp(completedAtMs)
  });

  assertHarnessResult(reviewedResult);
  assertTemporaryWorker(reviewedResult.temporaryWorker);

  return {
    requestId: `LOCAL-${contextEnvelope.hash}`,
    provider: {
      name: 'deterministic',
      model: null,
      liveModel: false,
      freeOnly: false
    },
    result: reviewedResult,
    worker: structuredClone(reviewedResult.temporaryWorker),
    metadata: {
      latencyMs,
      usage: null,
      completed: true,
      execution: 'browser-local',
      networkRequests: 0
    }
  };
}
