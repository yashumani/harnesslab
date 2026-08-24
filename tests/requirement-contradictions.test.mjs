import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeRequirementIntelligence } from '../apps/web/requirement-intelligence.js';

function contradictionIds(text) {
  return analyzeRequirementIntelligence(text).contradictions.map((item) => item.id);
}

test('flags full autonomy combined with approval for every action', () => {
  const ids = contradictionIds(
    'Build a fully autonomous agent without human intervention, with human approval before every action. It returns a report.'
  );
  assert.ok(ids.includes('autonomy-vs-every-action-approval'));

  const boundedIds = contradictionIds(
    'Design an autonomous agent that reads a GitHub issue, proposes a patch, runs tests, and asks for human approval before deployment.'
  );
  assert.equal(boundedIds.includes('autonomy-vs-every-action-approval'), false);
});

test('flags an explicit read-only contract combined with required mutation', () => {
  const ids = contradictionIds(
    'Build an agent that must remain read-only and must update approved business records before returning a summary.'
  );
  assert.ok(ids.includes('read-only-vs-required-mutation'));

  const boundedIds = contradictionIds(
    'Build an agent that reads a read-only repository and generates a deployment plan. After approval, a separate human deploys it.'
  );
  assert.equal(boundedIds.includes('read-only-vs-required-mutation'), false);
});

test('flags prohibited network access combined with a named remote integration', () => {
  const ids = contradictionIds(
    'Build an agent with no network access. It must use Slack to deliver every result.'
  );
  assert.ok(ids.includes('no-external-access-vs-external-integration'));
});

test('flags account-free requirements combined with a hosted provider', () => {
  const ids = contradictionIds(
    'Create an agent using OpenRouter without an account or sign-up. Return a structured report.'
  );
  assert.ok(ids.includes('no-credentials-vs-hosted-provider'));
});

test('flags denied data access combined with a required query', () => {
  const ids = contradictionIds(
    'Build an agent with no access to the database that must query the database and return a report.'
  );
  assert.ok(ids.includes('no-data-access-vs-data-query'));
});

test('flags stateless requirements combined with cross-session memory', () => {
  const ids = contradictionIds(
    'Create a stateless-only assistant with no persistence that must remember previous sessions and retain long-term state.'
  );
  assert.ok(ids.includes('no-persistence-vs-memory'));

  const boundedIds = contradictionIds(
    'Build an agent that does not store authentication material but retains non-sensitive run history for 30 days.'
  );
  assert.equal(boundedIds.includes('no-persistence-vs-memory'), false);
});

test('places contradiction questions before missing-dimension questions', () => {
  const analysis = analyzeRequirementIntelligence(
    'Build a fully autonomous agent without human intervention, with human approval before every action.'
  );
  assert.equal(analysis.status, 'needs-input');
  assert.equal(analysis.questions[0].dimension, 'contradiction');
  assert.equal(analysis.questions[0].priority, 'high');
  assert.ok(analysis.questions.length <= 8);
});
