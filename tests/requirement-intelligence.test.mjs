import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeRequirementIntelligence,
  assertRequirementIntelligence,
  validateRequirementIntelligence
} from '../apps/web/requirement-intelligence.js';
import { analyzeRequirement } from '../apps/web/engine.js';
import { assertHarnessResult, validateHarnessResult } from '../apps/web/result-contract.js';

const COMPLETE_REQUIREMENT = [
  'Build a read-only investigation agent for analysts.',
  'It receives telecom KPI data from a Snowflake warehouse and may query, validate, analyze, and compare approved tables.',
  'It returns a cited root-cause report for executives.',
  'It must never modify production data or send external notifications without human approval.',
  'A run succeeds when the top three drivers explain at least 80 percent of the anomaly within 60 seconds.',
  'Use only approved PII-safe data and keep cost under $0.10 per run.'
].join(' ');

test('produces a deterministic typed evidence-backed readiness assessment', () => {
  const first = analyzeRequirementIntelligence(COMPLETE_REQUIREMENT);
  const second = analyzeRequirementIntelligence(COMPLETE_REQUIREMENT);

  assert.deepEqual(first, second);
  assertRequirementIntelligence(first);
  assert.match(first.analysisId, /^REQI-[A-F0-9]{8}$/);
  assert.equal(first.dimensions.length, 10);
  assert.equal(first.counts.covered + first.counts.partial + first.counts.missing, 10);
  assert.ok(first.score >= 75);
  assert.notEqual(first.status, 'needs-input');
  assert.equal(first.contradictions.length, 0);
  assert.match(first.sourcePolicy, /supplied requirement/i);
});

test('quotes only supplied evidence and leaves unsupported dimensions missing', () => {
  const requirement = 'Build an agent that summarizes uploaded meeting notes into three action items.';
  const analysis = analyzeRequirementIntelligence(requirement);

  for (const dimension of analysis.dimensions) {
    for (const evidence of dimension.evidence) {
      assert.equal(requirement.includes(evidence), true, `${dimension.id} evidence was not copied from the source text`);
    }
    if (dimension.status === 'missing') {
      assert.deepEqual(dimension.evidence, []);
      assert.equal(dimension.summary, 'Not specified in the supplied requirement.');
    }
  }
  assert.ok(analysis.score < 80);
  assert.ok(analysis.questions.length > 0);
  assert.ok(analysis.questions.some((question) => question.dimension === 'successCriteria'));
});

test('validator rejects expanded or malformed assessments', () => {
  const analysis = analyzeRequirementIntelligence(COMPLETE_REQUIREMENT);
  const malformed = structuredClone(analysis);
  malformed.dimensions[0].status = 'guessed';

  const validation = validateRequirementIntelligence(malformed);
  assert.equal(validation.valid, false);
  assert.throws(() => assertRequirementIntelligence(malformed), /failed validation/i);
});

test('new harness results retain typed requirement intelligence and old results remain readable', () => {
  const result = analyzeRequirement(COMPLETE_REQUIREMENT);
  assertHarnessResult(result);
  assertRequirementIntelligence(result.requirementAnalysis);
  assert.ok(result.artifacts.some((artifact) => artifact.type === 'RequirementAssessment'));
  assert.ok(result.trace.some((entry) => entry.event === 'requirement.assessed'));
  assert.equal(result.evaluation.dimensions[0].score, result.requirementAnalysis.score);

  const legacy = structuredClone(result);
  delete legacy.requirementAnalysis;
  assert.equal(validateHarnessResult(legacy).valid, true);

  const invalid = structuredClone(result);
  invalid.requirementAnalysis.status = 'invented';
  assert.equal(validateHarnessResult(invalid).valid, false);
});
