import { AbstractAgent, EventType } from '@ag-ui/client';
import { Observable } from 'rxjs';
import { analyzeRequirement } from '../../web/engine.js';
import { assertHarnessResult } from '../../web/result-contract.js';

const AGENT_ID = 'harnessArchitect';
const MAX_REQUIREMENT_LENGTH = 1600;
const MAX_USER_TURNS = 4;

function identifier(prefix) {
  const value = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${value}`;
}

function messageText(message) {
  if (!message) return '';
  if (typeof message.content === 'string') return message.content.trim();
  if (!Array.isArray(message.content)) return '';
  return message.content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part.text === 'string') return part.text;
      if (part && typeof part.content === 'string') return part.content;
      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function compileConversationalRequirement(messages = []) {
  const userTurns = messages
    .filter((message) => message?.role === 'user')
    .map(messageText)
    .filter(Boolean)
    .slice(-MAX_USER_TURNS);

  if (!userTurns.length) return '';

  const compiled = userTurns
    .map((turn, index) => index === 0 ? turn : `Refinement ${index}: ${turn}`)
    .join('\n\n');

  return compiled.slice(0, MAX_REQUIREMENT_LENGTH).trim();
}

function resultSummary(result) {
  const agentCount = result.subagents?.length || 0;
  const unresolved = result.unresolvedQuestions?.length || 0;
  const evaluation = result.evaluation?.overall ?? 0;
  return [
    `HarnessLab produced a validated ${result.architecture.kind} harness.`,
    `${agentCount} temporary specialist${agentCount === 1 ? '' : 's'} are planned and none were executed.`,
    `The deterministic evaluation score is ${evaluation}/100.`,
    unresolved
      ? `${unresolved} requirement question${unresolved === 1 ? ' remains' : 's remain'} before implementation.`
      : 'The supplied requirement has no unresolved architecture question in this deterministic pass.',
    'Review the structured artifact beside this conversation; CopilotKit presents the run, while HarnessLab remains authoritative for policy, permissions, and evidence.'
  ].join(' ');
}

function emitText(observer, text) {
  const messageId = identifier('message');
  observer.next({
    type: EventType.TEXT_MESSAGE_START,
    messageId,
    role: 'assistant'
  });

  const chunks = text.match(/.{1,90}(?:\s|$)/g) || [text];
  for (const chunk of chunks) {
    observer.next({
      type: EventType.TEXT_MESSAGE_CONTENT,
      messageId,
      delta: chunk
    });
  }

  observer.next({
    type: EventType.TEXT_MESSAGE_END,
    messageId
  });
}

export class HarnessLabDeterministicAgent extends AbstractAgent {
  constructor(config = {}) {
    const agentConfig = {
      agentId: config.agentId || AGENT_ID,
      description: config.description
        || 'Turns conversational requirements into validated, policy-bounded HarnessLab architecture artifacts.',
      threadId: config.threadId,
      initialMessages: config.initialMessages || [],
      initialState: config.initialState || {
        schemaVersion: 1,
        status: 'idle',
        result: null,
        provenance: {
          framework: 'CopilotKit v2',
          execution: 'self-hosted runtime',
          provider: 'deterministic',
          model: 'none',
          networkRequestsToModels: 0,
          toolsExecuted: 0,
          externalActions: 0
        }
      },
      debug: config.debug === true
    };
    super(agentConfig);
    this.harnessLabConfig = agentConfig;
  }

  clone() {
    return new HarnessLabDeterministicAgent({
      ...this.harnessLabConfig,
      threadId: this.threadId,
      initialMessages: structuredClone(this.messages || []),
      initialState: structuredClone(this.state || {})
    });
  }

  async getCapabilities() {
    return {
      identity: {
        name: 'HarnessLab Deterministic Architect',
        type: 'custom',
        version: '1.0.0'
      },
      transport: { streaming: true },
      tools: { supported: false, clientProvided: false },
      state: { snapshots: true, deltas: false },
      humanInTheLoop: { supported: false, approvals: false }
    };
  }

  run(input) {
    return new Observable((observer) => {
      const threadId = input.threadId || this.threadId || identifier('thread');
      const runId = input.runId || identifier('run');

      observer.next({
        type: EventType.RUN_STARTED,
        threadId,
        runId
      });

      try {
        const requirement = compileConversationalRequirement(input.messages || []);
        if (requirement.length < 8) {
          const message = 'Describe the objective, users, inputs, outputs, allowed actions, prohibited actions, approval rules, and success criteria. HarnessLab needs at least one concrete use-case statement before it can create a harness.';
          observer.next({
            type: EventType.STATE_SNAPSHOT,
            snapshot: {
              schemaVersion: 1,
              status: 'needs_requirement',
              requirement,
              result: null,
              error: null,
              provenance: {
                framework: 'CopilotKit v2',
                execution: 'self-hosted runtime',
                provider: 'deterministic',
                model: 'none',
                networkRequestsToModels: 0,
                toolsExecuted: 0,
                externalActions: 0
              }
            }
          });
          emitText(observer, message);
          observer.next({
            type: EventType.RUN_FINISHED,
            threadId,
            runId,
            result: { status: 'needs_requirement' }
          });
          observer.complete();
          return;
        }

        observer.next({ type: EventType.STEP_STARTED, stepName: 'requirement-intelligence' });
        const startedAt = Date.now();
        const result = assertHarnessResult(analyzeRequirement(requirement));
        observer.next({ type: EventType.STEP_FINISHED, stepName: 'requirement-intelligence' });

        observer.next({ type: EventType.STEP_STARTED, stepName: 'harness-contract' });
        const snapshot = {
          schemaVersion: 1,
          status: 'complete',
          requirement,
          result,
          error: null,
          updatedAt: new Date().toISOString(),
          conversationTurns: (input.messages || []).filter((message) => message?.role === 'user').length,
          provenance: {
            framework: 'CopilotKit v2',
            protocol: 'AG-UI',
            execution: 'self-hosted runtime',
            provider: 'deterministic',
            model: 'none',
            latencyMs: Date.now() - startedAt,
            networkRequestsToModels: 0,
            toolsExecuted: 0,
            externalActions: 0,
            authoritativeValidator: 'HarnessLab result-contract'
          }
        };
        observer.next({
          type: EventType.STATE_SNAPSHOT,
          snapshot
        });
        observer.next({ type: EventType.STEP_FINISHED, stepName: 'harness-contract' });

        emitText(observer, resultSummary(result));
        observer.next({
          type: EventType.RUN_FINISHED,
          threadId,
          runId,
          result: {
            status: 'complete',
            harnessRunId: result.runId,
            architecture: result.architecture.kind,
            evaluation: result.evaluation.overall
          }
        });
        observer.complete();
      } catch (error) {
        const message = error instanceof Error
          ? error.message.replace(/\s+/g, ' ').slice(0, 360)
          : 'HarnessLab could not validate this requirement.';

        observer.next({
          type: EventType.STATE_SNAPSHOT,
          snapshot: {
            schemaVersion: 1,
            status: 'failed',
            result: null,
            error: {
              code: error?.code || 'HARNESS_ANALYSIS_FAILED',
              message
            },
            provenance: {
              framework: 'CopilotKit v2',
              execution: 'self-hosted runtime',
              provider: 'deterministic',
              model: 'none',
              networkRequestsToModels: 0,
              toolsExecuted: 0,
              externalActions: 0
            }
          }
        });
        emitText(observer, `The deterministic HarnessLab contract rejected this request: ${message}`);
        observer.next({
          type: EventType.RUN_ERROR,
          message,
          code: error?.code || 'HARNESS_ANALYSIS_FAILED'
        });
        observer.complete();
      }
    });
  }
}

export function createHarnessLabDeterministicAgent(config = {}) {
  return new HarnessLabDeterministicAgent(config);
}
