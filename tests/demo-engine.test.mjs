import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeRequirement, examples } from '../apps/web/engine.js';

test('rejects an empty or underspecified requirement', () => {
  assert.throws(() => analyzeRequirement('  '), /at least 8 characters/i);
  assert.throws(() => analyzeRequirement(null), /must be a string/i);
});

test('returns a deterministic result for the same requirement', () => {
  const requirement = examples[0].value;
  const first = analyzeRequirement(requirement);
  const second = analyzeRequirement(requirement);

  assert.deepEqual(first, second);
  assert.match(first.runId, /^DEMO-[A-F0-9]{8}$/);
  assert.equal(first.mode, 'Deterministic demo — no live model or external tool execution');
});

test('keeps a narrow request simple', () => {
  const result = analyzeRequirement('Summarize a short meeting note into three action items.');

  assert.ok(result.scores.complexity < 58);
  assert.equal(result.subagents.length, 0);
  assert.match(result.architecture.kind, /LLM feature|Deterministic workflow/);
  assert.equal(result.permissions.find((item) => item.capability === 'Production deployment or deletion').policy, 'Deny');
});

test('plans bounded temporary agents for a complex data investigation', () => {
  const result = analyzeRequirement(examples[0].value);

  assert.ok(result.scores.complexity >= 74);
  assert.match(result.architecture.kind, /temporary subagents/i);
  assert.ok(result.subagents.length >= 3);
  assert.ok(result.subagents.some((agent) => agent.role === 'Data Quality Analyst'));
  assert.ok(result.subagents.every((agent) => agent.childSpawning === false));
  assert.ok(result.subagents.every((agent) => agent.timeoutSeconds > 0));
  assert.ok(result.protocols.some((protocol) => protocol.name.includes('MCP')));
  assert.ok(result.artifacts.some((artifact) => artifact.type === 'HarnessSpec'));
  assert.ok(result.trace.some((entry) => entry.event === 'subagents.planned'));
});

test('requires approval and denies production mutation for risky software delivery', () => {
  const result = analyzeRequirement('Design an agent that modifies code, sends a pull request, and deploys to production only after a human approves the change. It must never delete production resources.');

  assert.ok(result.scores.risk >= 55);
  assert.equal(
    result.permissions.find((item) => item.capability === 'Write or modify external systems').policy,
    'Human approval'
  );
  assert.equal(
    result.permissions.find((item) => item.capability === 'Production deployment or deletion').policy,
    'Deny'
  );
  assert.ok(result.subagents.some((agent) => agent.role === 'Safety and Policy Critic'));
});

test('does not recommend A2A for internal temporary agents alone', () => {
  const internal = analyzeRequirement(examples[0].value);
  const internalA2A = internal.protocols.find((protocol) => protocol.name === 'A2A interoperability');
  assert.equal(internalA2A.decision, 'Not yet');

  const external = analyzeRequirement('Coordinate with an independent remote agent through A2A, exchange structured tasks, and validate returned artifacts before accepting them.');
  const externalA2A = external.protocols.find((protocol) => protocol.name === 'A2A interoperability');
  assert.equal(externalA2A.decision, 'Recommended');
});

test('evaluation and trace contracts remain complete', () => {
  const result = analyzeRequirement(examples[2].value);

  assert.equal(result.evaluation.dimensions.length, 4);
  assert.ok(result.evaluation.overall >= 0 && result.evaluation.overall <= 100);
  assert.equal(result.trace.at(-1).event, 'response.ready');
  assert.ok(result.constraints.some((constraint) => constraint.includes('does not execute live models')));
});
