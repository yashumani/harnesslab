# Agent Necessity and Topology Decision

## Purpose

HarnessLab should not recommend an agent merely because a model can be placed inside a loop. The topology advisor chooses the **smallest architecture justified by the supplied evidence** and explains what would need to change before a more agentic design becomes appropriate.

```text
Requirement
  → readiness assessment
  → evidence-backed topology factors
  → smallest justified architecture
  → alternatives and upgrade conditions
  → protocol responsibility guidance
  → autonomy guardrails
  → retained TopologyDecision artifact
```

The decision runs locally and deterministically. It uses no model, account, API key, gateway, or network request.

## Supported topologies

### `llm-feature`

Use one bounded model call inside deterministic input, output, validation, and policy controls. There is no autonomous control loop.

Typical fit:

- summarize a supplied document;
- classify or extract structured information;
- transform one input into one validated output;
- no tool selection, multi-step recovery, or external-agent boundary.

### `workflow`

Use a fixed execution graph with explicit transitions, retries, and failure behavior. Reasoning may be inserted at a bounded step, but the application owns the control flow.

Typical fit:

- repeatable pipelines;
- rule-driven validation;
- approval sequences;
- deterministic tool calls;
- stable, inspectable failure paths.

### `single-agent`

Use one bounded orchestrator when the system must choose tools, revise a plan, or recover from intermediate results.

Required boundaries:

- maximum turns and deadline;
- typed tool interfaces;
- no unbounded recursion;
- explicit action budget;
- approval-gated writes;
- structured completion artifact.

### `temporary-subagents`

Use one durable orchestrator with disposable specialists only when at least two independent workstreams benefit from parallelism or independent review.

Required boundaries:

- fixed worker cap;
- depth one;
- no child-agent spawning;
- minimum task-specific context;
- read-only tools by default;
- structured worker artifacts;
- deterministic judge and conflict handling;
- measured quality or latency benefit.

### `external-agent-network`

Use A2A only when separately operated agents must exchange tasks and artifacts across a real trust boundary.

Required boundaries:

- authenticated peer identity;
- capability-specific grants;
- expiry and revocation;
- no transitive authority;
- schema-validated artifacts;
- replay and idempotency controls;
- independent audit trail.

Internal temporary workers do not need A2A.

## Decision factors

The current deterministic advisor evaluates nine factors:

1. Interpretation uncertainty
2. Deterministic sequence strength
3. Iterative planning or recovery
4. Tool and system boundaries
5. Independent parallel workstreams
6. External-agent trust boundary
7. Write or destructive-action risk
8. Evidence and evaluation requirements
9. Requirement readiness

Each supported factor includes a source excerpt from the supplied requirement. Unsupported factors are marked absent. Readiness uncertainty is inherited from the typed requirement assessment.

## Risk rule

Risk never increases recommended autonomy.

Consequential actions—writes, deployment, deletion, payments, production access, credentials, customer data, medical data, or financial data—add containment and approval requirements. They do not justify a swarm or broader agency.

## Protocol responsibilities

### Typed functions

Typed functions expose narrow schema-validated operations inside one application or service boundary. They are the first tool abstraction because their arguments, permissions, errors, retries, and audit events can remain deterministic.

### MCP

MCP standardizes discoverable model-facing tools, resources, and prompts. It is appropriate when multiple reusable integrations need one permission-aware interface. MCP does not decide control flow and does not create independent agents.

### Retrieval

Retrieval selects, sources, freshness-checks, and cites knowledge. It adds context, not action authority. Retrieval can be used by a feature, workflow, single agent, or swarm.

### A2A

A2A exchanges tasks and artifacts between separately operated agent identities. It is not required for internal subagents running under one orchestrator.

## Retained contract

New HarnessResults contain an optional `architectureDecision` object and a retained `TopologyDecision` artifact. Legacy saved results without the object remain readable.

The decision records:

- selected topology and bounded autonomy;
- decision confidence;
- requirement readiness snapshot;
- nine evidence-backed factors;
- all five alternatives and upgrade conditions;
- typed-function, MCP, retrieval, and A2A guidance;
- non-negotiable guardrails.

`apps/web/result-contract.js` validates the object and requires the rendered `architecture.kind` to match the selected topology.

## Browser interface

The public topology advisor provides live and retained modes:

- **Live draft** recomputes from the current requirement without a network request.
- **Generated result** displays the immutable decision retained by the current HarnessResult.

The drawer is modal, makes background content inert, traps focus, supports Escape, restores focus, and has deliberate desktop and phone layouts.

## Deploy-first verification

The release path is:

```text
Typed decision engine
  → HarnessResult integration
  → responsive advisor
  → unit and contract tests
  → real Chromium interaction
  → desktop/tablet/phone QA
  → squash merge
  → GitHub Pages deployment
  → public Chromium verification
```

The browser verifier changes the composer programmatically to an A2A requirement and confirms:

- `external-agent-network` is selected;
- A2A is recommended;
- all present factors retain source evidence;
- no model, gateway, OpenRouter, Ollama, or POST request occurs;
- modal inertness and focus lifecycle work.
