import { analyzeRequirement } from '../../../apps/web/engine.js';
import { assertHarnessResult } from '../../../apps/web/result-contract.js';
import { createDeterministicCriticReview } from '../temporary-critic.mjs';

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createDeterministicProvider({ analyze = analyzeRequirement } = {}) {
  return {
    name: 'deterministic',
    model: null,
    liveModel: false,
    configured: true,

    async health() {
      return { configured: true, available: true, reason: null };
    },

    async analyze(requirement) {
      const result = cloneJson(await analyze(requirement));
      result.mode = 'Deterministic gateway analysis — no live model or external tool execution';
      assertHarnessResult(result);
      return { result, usage: null };
    },

    async critique(context, { signal = null } = {}) {
      if (signal?.aborted) throw signal.reason ?? new Error('Temporary critic request was cancelled.');
      return {
        review: createDeterministicCriticReview(context),
        model: null,
        usage: null
      };
    }
  };
}
