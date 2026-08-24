# Agent Necessity and Topology Decision

HarnessLab does not assume every AI use case needs an agent. The agent-necessity advisor selects the least complex topology supported by evidence in the supplied requirement.

## Decision sequence

```text
Requirement text
  → requirement readiness
  → nine source-backed decision factors
  → least-complex viable topology
  → bounded alternatives and upgrade conditions
  → typed functions / MCP / retrieval / A2A responsibilities
  → autonomy and approval guidance
  → retained AgentDecision artifact
```

## Supported topology modes

| Mode | Use when |
|---|---|
| `llm-feature` | The task is primarily interpretation or generation inside a deterministic wrapper. |
| `workflow` | A fixed, testable sequence can own the process with one bounded reasoning step. |
| `single-agent` | Intermediate observations determine the next bounded action or tool call. |
| `temporary-subagents` | Explicit independent workstreams benefit from isolated temporary specialists and structured returns. |
| `external-agent-network` | A separately operated or remote agent creates a genuine trust and interoperability boundary. |

The decision is deterministic and local. It uses no provider, model, account, API key, gateway, or network request.

## Decision factors

The advisor records nine factors:

1. interpretation uncertainty;
2. deterministic sequence strength;
3. iterative planning and recovery;
4. tool and system boundaries;
5. independent parallel workstreams;
6. external-agent trust boundaries;
7. irreversible or sensitive actions;
8. evidence and evaluation burden;
9. external knowledge or retrieval.

Every present factor retains evidence quoted from the supplied requirement. Missing signals remain `absent` with no fabricated evidence.

## Protocol responsibilities

The advisor distinguishes four concepts that are often confused:

- **Native typed functions** expose a small known capability directly through strict inputs and outputs.
- **MCP** standardizes model-to-tool and model-to-context access behind permission-aware servers.
- **Retrieval** selects, sources, and freshness-checks knowledge supplied to reasoning stages.
- **A2A** exchanges tasks and structured artifacts across separately operated agent trust boundaries.

Internal temporary workers do not need A2A. An external-agent topology requires A2A guidance and independent validation of every returned artifact.

## Risk and autonomy

Risk never increases the selected level of agency. Sensitive, destructive, financial, communication, credential, or production actions add containment:

- a separate human-issued action token;
- denied production mutation by default;
- typed inputs and structured outputs;
- timeouts, budgets, and trace events;
- no child spawning for temporary workers;
- artifact validation before synthesis.

## Retained contract

New HarnessResults may include a typed `agentDecision` containing:

- selected mode, label, rationale, and confidence;
- nine factor assessments;
- all five alternatives with selection, rejection, or deferral reasons;
- protocol responsibilities and decisions;
- autonomy and approval guidance;
- requirement-readiness linkage.

The result validator requires `architecture.kind` to match the selected decision label. Non-multi-agent decisions cannot retain planned temporary subagents. Legacy results without `agentDecision` remain readable.

## Safety boundary

This capability recommends architecture only. It does not execute tools, MCP servers, A2A peers, code, files, databases, deployments, external writes, paid models, or production actions.
