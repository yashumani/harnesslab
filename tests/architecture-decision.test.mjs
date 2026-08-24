import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeArchitectureDecision,
  assertArchitectureDecision,
  validateArchitectureDecision
} from '../apps/web/architecture-decision.js';
import { analyzeRequirement, examples } from '../apps/web/engine.js';
import { analyzeRequirementIntelligence } from '../apps/web/requirement-intelligence.js';
import { assertHarnessResult, validateHarnessResult } from '../apps/web/result-contract.js';

function decide(requirement) {
  return analyzeArchitectureDecision(requirement, analyzeRequirementIntelligence(requirement));
}

test('selects the smallest justified topology deterministically', () => {
  const fixtures = [
    [
      'Summarize an uploaded meeting note into three concise action items for managers.',
      'llm-feature'
    ],
    [
      'Use a fixed deterministic workflow with predefined steps to validate a JSON schema, apply approved rules, and return the result.',
      'workflow'
    ],
    [
      'Build an agent that interprets a GitHub issue, calls the GitHub API, retries failed tests, revises its plan, and returns a proposed patch.',
      'single-agent'
    ],
    [
      'Build an agent that investigates KPI anomalies, queries a SQL warehouse, compares independent dimensions in parallel, validates evidence, and returns a root-cause report.',
      'temporary-subagents'
    ],
    [
      'Coordinate with a separately operated partner agent through A2A, exchange authenticated tasks, and validate every returned artifact.',
      'external-agent-network'
    ]
  ];

  for (const [requirement, expected] of fixtures) {
    const first = decide(requirement);
    const second = decide(requirement);
    assert.deepEqual(first, second);
    assertArchitectureDecision(first);
    assert.equal(first.selectedTopology.id, expected, requirement);
    assert.match(first.decisionId, /^TOPO-[A-F0-9]{8}$/);
    assert.equal(first.alternatives.filter((item) => item.status === 'selected').length, 1);
  }
});

test('does not use risk evidence to justify more agency', () => {
  const decision = decide(
    'Use a fixed deterministic workflow to validate an approved request and delete a production record only after human approval.'
  );

  assert.equal(decision.selectedTopology.id, 'workflow');
  assert.equal(decision.factors.find((factor) => factor.id === 'write-risk').status, 'present');
  assert.ok(decision.guardrails.some((guardrail) => /risk evidence never increases autonomy/i.test(guardrail)));
  assert.ok(decision.guardrails.some((guardrail) => /approval/i.test(guardrail)));
});

test('separates typed functions, MCP, retrieval, and A2A responsibilities', () => {
  const internal = decide(
    'Build an agent that interprets GitHub issues, queries Snowflake, reads policy documents from Drive, posts an approval draft to Slack, and returns cited evidence.'
  );
  const byId = Object.fromEntries(internal.protocols.map((protocol) => [protocol.id, protocol]));

  assert.equal(byId['typed-functions'].decision, 'Foundation');
  assert.equal(byId.mcp.decision, 'Recommended');
  assert.equal(byId.retrieval.decision, 'Recommended');
  assert.equal(byId.a2a.decision, 'Not yet');
  assert.match(byId['typed-functions'].responsibility, /schema-validated operations/i);
  assert.match(byId.mcp.responsibility, /model-facing integrations/i);
  assert.match(byId.retrieval.responsibility, /knowledge/i);
  assert.match(byId.a2a.responsibility, /separately operated agent/i);

  const external = decide('Use A2A to exchange tasks with an external agent and validate structured returned artifacts.');
  assert.equal(external.protocols.find((protocol) => protocol.id === 'a2a').decision, 'Recommended');
});

test('quotes only supplied evidence and marks unsupported factors absent', () => {
  const requirement = 'Build  an agent that summarizes  meeting notes into a report for analysts.';
  const decision = decide(requirement);

  for (const factor of decision.factors) {
    for (const evidence of factor.evidence) {
      assert.equal(requirement.includes(evidence), true, `${factor.id} evidence was not copied from the supplied text`);
    }
    if (factor.status === 'absent') assert.deepEqual(factor.evidence, []);
  }
  assert.equal(decision.factors.find((factor) => factor.id === 'external-agent-boundary').status, 'absent');
});

test('validator rejects expanded or inconsistent topology decisions', () => {
  const decision = decide(examples[0].value);

  const expanded = structuredClone(decision);
  expanded.provider = 'invented';
  assert.equal(validateArchitectureDecision(expanded).valid, false);

  const inconsistent = structuredClone(decision);
  inconsistent.selectedTopology.id = 'external-agent-network';
  assert.equal(validateArchitectureDecision(inconsistent).valid, false);

  const invalidA2a = structuredClone(decision);
  invalidA2a.protocols.find((protocol) => protocol.id === 'a2a').decision = 'Recommended';
  assert.equal(validateArchitectureDecision(invalidA2a).valid, false);
});

test('new HarnessResults retain the topology decision while legacy results remain readable', () => {
  const result = analyzeRequirement(examples[0].value);
  assertHarnessResult(result);
  assertArchitectureDecision(result.architectureDecision);
  assert.equal(result.architecture.kind, result.architectureDecision.selectedTopology.architectureKind);
  assert.ok(result.artifacts.some((artifact) => artifact.type === 'TopologyDecision'));
  assert.ok(result.trace.some((entry) => entry.event === 'topology.decided'));
  assert.ok(result.evaluation.dimensions.some((dimension) => dimension.name === 'Architecture fit'));
  assert.equal(result.architectureDecision.selectedTopology.id, 'temporary-subagents');
  assert.ok(result.subagents.length > 0);

  const legacy = structuredClone(result);
  delete legacy.architectureDecision;
  assert.equal(validateHarnessResult(legacy).valid, true);

  const mismatched = structuredClone(result);
  mismatched.architecture.kind = 'Unrelated topology';
  assert.equal(validateHarnessResult(mismatched).valid, false);
});

test('non-subagent topologies do not spawn temporary workers', () => {
  const narrow = analyzeRequirement('Summarize a short meeting note into three action items for managers.');
  assert.equal(narrow.architectureDecision.selectedTopology.id, 'llm-feature');
  assert.deepEqual(narrow.subagents, []);

  const riskyWorkflow = analyzeRequirement(
    'Use a fixed deterministic workflow to validate an approved request and delete a production record only after human approval.'
  );
  assert.equal(riskyWorkflow.architectureDecision.selectedTopology.id, 'workflow');
  assert.deepEqual(riskyWorkflow.subagents, []);
});
