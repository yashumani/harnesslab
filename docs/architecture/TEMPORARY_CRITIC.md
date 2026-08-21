# Bounded Temporary Architecture Critic

## Purpose

HarnessLab's first executed temporary subagent is deliberately narrow: one architecture critic can review an already generated harness plan and return one structured artifact. It proves the temporary-agent lifecycle without adding tools, recursive spawning, code execution, external writes, or production access.

```text
Validated HarnessResult
        ↓
Minimum context compiler
        ↓
One temporary architecture critic
  - one provider call
  - no tools
  - no child agents
  - no external actions
  - fixed deadline
        ↓
TemporaryAgentReview artifact validator
        ↓
Deterministic finding acceptance
        ↓
Reviewed HarnessResult
  - retained artifact
  - trace events
  - provider/model/latency metadata
  - accepted and rejected findings
```

This slice operationalizes the principle:

> Agents are disposable. Harnesses are durable. Validated artifacts persist.

## User path

The public GitHub Pages application continues to generate harness plans in browser-deterministic, automatic-fallback, or gateway-required mode. A separate **Temporary Architecture Critic** console captures the current plan.

When browser mode is active, the console explains that no worker is executed. When Automatic or Gateway required mode is active and a compatible gateway is running, the console can call:

```text
POST /v1/critique
```

The browser request contains exactly one field:

```json
{
  "result": {}
}
```

The browser cannot choose the provider, select a model, submit credentials, add tools, or expand the worker task.

## Minimum context envelope

The gateway validates the incoming `HarnessResult` and compiles a whitelist-only context object containing:

- schema version;
- fixed task and objective;
- interpreted requirement;
- complexity, risk, and confidence scores;
- architecture kind and rationale;
- protocol decisions;
- permission matrix;
- safety constraints;
- unresolved questions;
- bounded subagent-plan summaries;
- artifact types and statuses;
- evaluation summary;
- fixed worker policy.

The context does **not** contain:

- provider credentials;
- browser runtime metadata;
- full chat history;
- filesystem handles;
- database connections;
- MCP clients;
- A2A peers;
- tool schemas;
- deployment credentials;
- production data.

The serialized context is limited to 48 KiB.

## Worker policy

Every execution has the same non-negotiable contract:

```json
{
  "role": "Architecture Critic",
  "task": "architecture-critic",
  "callBudget": 1,
  "callsUsed": 1,
  "tools": [],
  "childSpawning": false,
  "externalActions": false
}
```

Gateway configuration controls the deadline:

```text
HARNESSLAB_CRITIC_TIMEOUT_MS=20000
HARNESSLAB_CRITIC_MAX_BODY_BYTES=262144
```

The gateway process request timeout is always greater than or equal to the critic deadline.

## Provider behavior

The existing provider abstraction supplies the worker:

| Provider | Critic behavior |
|---|---|
| Deterministic | Executes a rule-based independent review with no model |
| Ollama | Makes one local JSON chat request to the configured model |
| OpenRouter | Makes one JSON chat-completions request through `openrouter/free` or an explicit `:free` model |

OpenRouter remains free-only. A provider cannot be selected through the request body, and credentials stay in the gateway environment.

The provider must return exactly:

```json
{
  "verdict": "pass",
  "summary": "...",
  "confidence": 0.9,
  "findings": [
    {
      "category": "evidence_gap",
      "severity": "medium",
      "confidence": 0.85,
      "observation": "...",
      "recommendation": "...",
      "question": "..."
    }
  ]
}
```

Allowed categories are:

- `missing_requirement`
- `reliability`
- `overcomplexity`
- `evidence_gap`
- `safety_gap`
- `protocol_fit`

At most six findings are accepted from the provider response.

## Deterministic merge policy

Provider output is advice, not authority.

A finding is applied only when:

- it satisfies the strict typed schema;
- its severity is `medium` or `high`;
- its confidence is at least `0.70`.

Low-confidence or low-severity findings remain in the retained review artifact but are not applied.

Accepted findings may only:

- append bounded unresolved questions;
- append a critic note to the recommendation;
- add an Architecture critique evaluation dimension;
- add trace evidence;
- add the retained review artifact.

The merge cannot modify or weaken:

- permissions;
- denied actions;
- approval requirements;
- execution stages;
- protocol decisions;
- planned subagent contracts;
- existing safety constraints;
- artifact retention requirements;
- traceability requirements.

## Failure behavior

A provider timeout, unavailability, malformed response, or invalid worker artifact is never presented as success.

For provider failures that occur after a valid request is accepted, the gateway returns the original harness plan augmented with:

- `temporaryWorker.status` of `failed` or `timed_out`;
- a sanitized failure code and message;
- a retained `TemporaryAgentReview` artifact with failure status;
- `temporary_agent.failed` or `temporary_agent.timed_out` trace evidence;
- zero accepted findings.

Invalid request bodies and contract violations return a structured HTTP error.

## Retained worker object

The reviewed result contains an optional `temporaryWorker` object validated by `apps/web/temporary-worker-contract.js`. It records:

- worker ID, role, and fixed task;
- completion status;
- provider and routed model;
- live/free-only policy;
- start and completion timestamps;
- latency and deadline;
- one-call budget and use;
- empty tool list;
- no-child and no-external-action flags;
- context field names and byte count;
- retained artifact ID;
- review;
- accepted and rejected findings;
- provider usage metadata;
- sanitized failure information when applicable.

## Browser boundary

The public critic console:

- receives the latest plan through a local custom event;
- reads only the already stored gateway URL, mode, and timeout metadata;
- sends no provider authorization;
- displays worker status, provenance, context size, artifact ID, and finding decisions;
- can copy or download the reviewed result;
- can save the reviewed result as a new browser-local project version.

Browser project storage is not encrypted cloud storage or cross-device synchronization.

## Verification

The test and deployment system validates:

- context minimization;
- one-worker and one-call enforcement;
- no tools, child agents, or external actions;
- strict review parsing;
- deterministic finding acceptance;
- permission/stage/protocol preservation;
- timeout evidence;
- deterministic, Ollama, and OpenRouter critic paths;
- HTTP endpoint and CORS behavior;
- browser client validation;
- public console assets and mobile/reduced-motion CSS;
- live GitHub Pages publication.

## Next seam

The next runtime expansion should add multiple independent temporary workers only after this single-worker path produces measurable accuracy or coverage gains. Parallelism must remain bounded by a dependency graph, shared artifact contracts, resource budgets, and an evaluator/judge stage.
