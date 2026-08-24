import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  analyzeRequirementIntelligence,
  validateRequirementIntelligence
} from '../apps/web/requirement-intelligence.js';

function contradictionIds(text) {
  return analyzeRequirementIntelligence(text).contradictions.map((item) => item.id);
}

test('does not combine unrelated read-only and mutation clauses', () => {
  const ids = contradictionIds(
    'Build an agent for analysts. The database must remain read-only. The agent must update a local status report.'
  );
  assert.equal(ids.includes('read-only-vs-required-mutation'), false);
});

test('still detects a mutation of the same protected scope', () => {
  const globalIds = contradictionIds(
    'Build an agent that must remain read-only and must update approved business records before returning a summary.'
  );
  assert.ok(globalIds.includes('read-only-vs-required-mutation'));

  const resourceIds = contradictionIds(
    'The database must remain read-only. The agent is required to update the database before returning a report.'
  );
  assert.ok(resourceIds.includes('read-only-vs-required-mutation'));
});

test('recognizes ordinary every-action approval phrasing', () => {
  const ids = contradictionIds(
    'Build a fully autonomous agent without human intervention. Human approval is required before every action.'
  );
  assert.ok(ids.includes('autonomy-vs-every-action-approval'));
});

test('keeps evidence excerpts as exact source substrings', () => {
  const requirement = 'Build  an agent that summarizes  meeting notes into a report for analysts.';
  const analysis = analyzeRequirementIntelligence(requirement);

  for (const dimension of analysis.dimensions) {
    for (const evidence of dimension.evidence) {
      assert.equal(requirement.includes(evidence), true, `${dimension.id} evidence changed source whitespace`);
    }
  }
});

test('rejects counts and brief entries that disagree with dimensions', () => {
  const analysis = analyzeRequirementIntelligence(
    'Build a read-only agent for analysts that reads approved documents and returns a cited report. It must never write external data and requires human approval for messages.'
  );

  const badCounts = structuredClone(analysis);
  badCounts.counts = { covered: 10, partial: 10, missing: 10 };
  assert.equal(validateRequirementIntelligence(badCounts).valid, false);

  const badBrief = structuredClone(analysis);
  badBrief.brief.objective.status = badBrief.brief.objective.status === 'covered' ? 'missing' : 'covered';
  assert.equal(validateRequirementIntelligence(badBrief).valid, false);

  const badScore = structuredClone(analysis);
  badScore.score = Math.max(0, analysis.score - 1);
  assert.equal(validateRequirementIntelligence(badScore).valid, false);
});

test('ships the complete readiness drawer focus and legacy-state lifecycle', async () => {
  const [panel, hardeningCss] = await Promise.all([
    readFile('apps/web/requirement-intelligence-panel.js', 'utf8'),
    readFile('apps/web/requirement-intelligence-hardening.css', 'utf8')
  ]);

  assert.match(panel, /setBackgroundInert\(true\)/);
  assert.match(panel, /setBackgroundInert\(false\)/);
  assert.match(panel, /event\.key === 'Escape'/);
  assert.match(panel, /event\.key !== 'Tab'/);
  assert.match(panel, /aria-modal="true"/);
  assert.match(panel, /data-action="close"\]\'\)\?\.focus|data-action="close"/);
  assert.match(panel, /data-action="toggle"\]\'\)\?\.focus|data-action="toggle"/);
  assert.match(panel, /this\.retainedAnalysis = null/);
  assert.match(panel, /characterData: true/);
  assert.match(panel, /textarea\.value !== this\.requirement/);
  assert.match(hardeningCss, /:host/);
  assert.match(hardeningCss, /z-index: 90/);
});
