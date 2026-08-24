import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeAgentDecision } from '../apps/web/agent-decision.js';
import { analyzeRequirementIntelligence } from '../apps/web/requirement-intelligence.js';

function decide(requirement) {
  return analyzeAgentDecision(requirement, analyzeRequirementIntelligence(requirement));
}

test('recognizes plural external-agent boundaries and requires A2A guidance', () => {
  const requirement = 'Coordinate with external agents operated by partner organizations, exchange authenticated tasks and artifacts, and validate every returned result.';
  const decision = decide(requirement);
  const boundary = decision.factors.find((factor) => factor.id === 'externalBoundary');
  const a2a = decision.protocols.find((protocol) => protocol.id === 'a2a');

  assert.equal(decision.selected.mode, 'external-agent-network');
  assert.ok(boundary.score > 0);
  assert.ok(boundary.evidence.some((item) => item.includes('external agents')));
  assert.equal(a2a.decision, 'required');
});

test('explicitly prohibited external agents and A2A remain internal', () => {
  const requirement = 'Build an internal deterministic workflow. Do not use external agents or A2A; all workers must remain internal and return a validated report.';
  const decision = decide(requirement);
  const boundary = decision.factors.find((factor) => factor.id === 'externalBoundary');
  const a2a = decision.protocols.find((protocol) => protocol.id === 'a2a');

  assert.notEqual(decision.selected.mode, 'external-agent-network');
  assert.equal(boundary.state, 'absent');
  assert.equal(boundary.score, 0);
  assert.deepEqual(boundary.evidence, []);
  assert.match(boundary.effect, /explicitly prohibits external agents or A2A/i);
  assert.equal(a2a.decision, 'not-needed');
});

test('internal temporary workers alone do not require A2A', () => {
  const requirement = 'Build an orchestrator that compares independent data-quality and diagnostic workstreams in parallel using temporary subagents, then validates their structured artifacts.';
  const decision = decide(requirement);

  assert.equal(decision.selected.mode, 'temporary-subagents');
  assert.equal(decision.protocols.find((protocol) => protocol.id === 'a2a').decision, 'not-needed');
});
