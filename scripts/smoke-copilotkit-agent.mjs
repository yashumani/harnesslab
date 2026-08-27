import assert from 'node:assert/strict';
import { createHarnessLabDeterministicAgent } from '../apps/copilotkit-web/src/harnesslab-agent.js';
import { validateHarnessResult } from '../apps/web/result-contract.js';

const agent = createHarnessLabDeterministicAgent({
  agentId: 'harnessArchitect',
  threadId: 'smoke-thread'
});

agent.addMessage({
  id: 'smoke-user-message',
  role: 'user',
  content: 'Build a read-only agent for finance analysts that investigates KPI anomalies from approved warehouse views, cites evidence, cannot write to source systems, requires human approval before sending any report, and succeeds when every claim maps to retained data evidence.'
});

const run = await agent.runAgent({ runId: 'smoke-run' });
const state = agent.state;

assert.equal(state.status, 'complete');
assert.equal(state.provenance.framework, 'CopilotKit v2');
assert.equal(state.provenance.protocol, 'AG-UI');
assert.equal(state.provenance.provider, 'deterministic');
assert.equal(state.provenance.model, 'none');
assert.equal(state.provenance.networkRequestsToModels, 0);
assert.equal(state.provenance.toolsExecuted, 0);
assert.equal(state.provenance.externalActions, 0);
assert.equal(validateHarnessResult(state.result).valid, true);
assert.equal(run.result.status, 'complete');
assert.ok(agent.messages.some((message) => message.role === 'assistant'));

console.log(JSON.stringify({
  agentId: agent.agentId,
  threadId: agent.threadId,
  runResult: run.result,
  harnessRunId: state.result.runId,
  architecture: state.result.architecture.kind,
  evaluation: state.result.evaluation.overall,
  messages: agent.messages.length,
  boundaries: state.provenance
}, null, 2));
