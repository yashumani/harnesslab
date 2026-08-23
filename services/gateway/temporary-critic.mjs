import { createHash } from 'node:crypto';

import {
  applyTemporaryCriticOutcome,
  buildCriticContext,
  createCriticPrompt,
  createDeterministicCriticReview as createCoreDeterministicCriticReview,
  CriticContractError,
  MAX_CRITIC_CONTEXT_BYTES,
  MAX_CRITIC_FINDINGS,
  parseCriticReview as parseCoreCriticReview,
  TEMPORARY_CRITIC_ROLE,
  TEMPORARY_CRITIC_TASK
} from '../../apps/web/critic-core.js';
import { ProviderResponseError } from './errors.mjs';

export {
  applyTemporaryCriticOutcome,
  createCriticPrompt,
  MAX_CRITIC_CONTEXT_BYTES,
  MAX_CRITIC_FINDINGS,
  TEMPORARY_CRITIC_ROLE,
  TEMPORARY_CRITIC_TASK
};

function contextHash(context) {
  return createHash('sha256').update(JSON.stringify(context)).digest('hex').slice(0, 12).toUpperCase();
}

function asProviderResponseError(error) {
  if (error instanceof ProviderResponseError) return error;
  if (error instanceof CriticContractError) {
    return new ProviderResponseError(error.message, { cause: error });
  }
  return error;
}

export function compileCriticContext(result) {
  try {
    const { context, inputBytes } = buildCriticContext(result);
    return Object.freeze({
      context: Object.freeze(context),
      inputBytes,
      hash: contextHash(context)
    });
  } catch (error) {
    throw asProviderResponseError(error);
  }
}

export function parseCriticReview(content, options = {}) {
  try {
    return parseCoreCriticReview(content, options);
  } catch (error) {
    throw asProviderResponseError(error);
  }
}

export function createDeterministicCriticReview(context) {
  try {
    return createCoreDeterministicCriticReview(context);
  } catch (error) {
    throw asProviderResponseError(error);
  }
}
