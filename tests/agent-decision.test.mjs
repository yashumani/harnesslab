import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeAgentDecision,
  validateAgentDecision
} from '../apps/web/agent-decision.js';
import { analyzeRequirement, examples } from '../apps/web/engine.js';
import { analyzeRequirementIntelligence } from '../apps/web/requirement-intelligence.js';
import { validateHarnessResult } from '../apps/web/result-contract.js';

function decide(requirement) {
  return analyzeAgentDecision(requirement, analyzeRequirementIntelligence(requirement));
}

test('keeps a narrow fixed transformation as a deterministic workflow', () => {
  const requirement = 'Summarize a short meeting note into three action items.';
  const decision = decide(requirement);

  assert.equal(decision.selected.mode, 'workflow');
  assert.equal(decision.autonomy.level, 'none');
  assert.equal(decision.autonomy.approvalRequired, false);
  assert.equal(decision.alternatives.filter((item) => item.status === 'selected').length, 1);
  assert.equal(decision.alternatives.find((item) => item.status === 'selected').mode, 'workflow');
});

test('selects temporary subagents only for explicit independent workstreams', () => {
  const decision = decide(examples[0].value);

  assert.equal(decision.selected.mode, 'temporary-subagents');
  assert.equal(decision.factors.find((item) => item.id === 'parallelism').state !== 'absent', true);
  assert.equal(decision.protocols.find((item) => item.id === 'a2a').decision, 'not-needed');
  assert.equal(decision.autonomy.level, 'coordinated');
  assert.ok(decision.selected.rationale.includes('temporary') || decision.selected.rationale.includes('independent'));
});

test('reserves external-agent networks and A2A for a real trust boundary', () => {
  const requirement = 'Coordinate with an independent remote agent through A2A, exchange structured tasks, and validate every returned artifact before accepting it.';
  const decision = decide(requirement);

  assert.equal(decision.selected.mode, 'external-agent-network');
  assert.equal(decision.protocols.find((item) => item.id === 'a2a').decision, 'required');
  assert.ok(decision.factors.find((item) => item.id === 'externalBoundary').evidence.length > 0);
});

test('risk adds approval and containment without increasing agency', () => {
  const requirement = 'Create a fixed workflow that sends an approved status email only after human approval and never deploys or deletes production resources.';
  const decision = decide(requirement);

  assert.ok(['llm-feature', 'workflow', 'single-agent'].includes(decision.selected.mode));
  assert.equal(decision.autonomy.approvalRequired, true);
  assert.ok(decision.autonomy.guidance.some((item) => /human-issued action token|approval/i.test(item)));
  assert.notEqual(decision.selected.mode, 'temporary-subagents');
  assert.notEqual(decision.selected.mode, 'external-agent-network');
});

test('distinguishes typed functions, MCP, retrieval, and A2A responsibilities', () => {
  const requirement = 'Build one agent that queries a SQL warehouse and GitHub API, reads approved policy documents, and returns a cited report.';
  const decision = decide(requirement);
  const protocols = Object.fromEntries(decision.protocols.map((item) => [item.id, item]));

  assert.match(protocols['typed-functions'].responsibility, /strict input\/output schema/i);
  assert.match(protocols.mcp.responsibility, /model-to-tool|permission-aware/i);
  assert.equal(protocols.retrieval.decision, 'recommended');
  assert.match(protocols.retrieval.responsibility, /knowledge|freshness/i);
  assert.equal(protocols.a2a.decision, 'not-needed');
  assert.match(protocols.a2a.responsibility, /separately operated agent/i);
});

test('quotes only supplied decision evidence and marks absent factors without evidence', () => {
  const requirement = 'Build  an agent that compares approved documents and returns a cited report.';
  const decision = decide(requirement);

  for (const factor of decision.factors) {
    for (const evidence of factor.evidence) {
      assert.equal(requirement.includes(evidence), true, `${factor.id} evidence changed the supplied source`);
    }
    if (factor.state === 'absent') assert.deepEqual(factor.evidence, []);
  }
});

test('validator rejects expanded and internally inconsistent decisions', () => {
  const decision = decide(examples[0].value);

  const expanded = structuredClone(decision);
  expanded.provider = 'openrouter';
  assert.equal(validateAgentDecision(expanded).valid, false);

  const badMode = structuredClone(decision);
  badMode.selected.mode = 'unbounded-swarm';
  assert.equal(validateAgentDecision(badMode).valid, false);

  const badA2a = structuredClone(decide('Coordinate with an independent remote agent through A2A and validate returned artifacts.'));
  badA2a.protocols.find((item) => item.id === 'a2a').decision = 'not-needed';
  assert.equal(validateAgentDecision(badA2a).valid, false);
});

test('HarnessResult retains and cross-validates the agent decision', () => {
  const result = analyzeRequirement(examples[0].value);
  const validation = validateHarnessResult(result);

  assert.equal(validation.valid, true, validation.errors.join('\n'));
  assert.match(result.agentDecision.decisionId, /^AGD-[A-F0-9]{8}$/);
  assert.equal(result.architecture.kind, result.agentDecision.selected.label);
  assert.ok(result.artifacts.some((artifact) => artifact.type === 'AgentDecision'));
  assert.ok(result.trace.some((entry) => entry.event === 'agency.decided'));
  assert.ok(result.evaluation.dimensions.some((item) => item.name === 'Topology fit'));

  const inconsistent = structuredClone(result);
  inconsistent.architecture.kind = 'Unrelated topology';
  assert.equal(validateHarnessResult(inconsistent).valid, false);
});

test('legacy HarnessResults without agentDecision remain readable', () => {
  const result = analyzeRequirement(examples[2].value);
  delete result.agentDecision;
  result.artifacts = result.artifacts.filter((artifact) => artifact.type !== 'AgentDecision');
  result.trace = result.trace
    .filter((entry) => entry.event !== 'agency.decided')
    .map((entry, index) => ({ ...entry, sequence: index + 1 }));

  const validation = validateHarnessResult(result);
  assert.equal(validation.valid, true, validation.errors.join('\n'));
});
