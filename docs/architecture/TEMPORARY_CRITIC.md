# Bounded Temporary Architecture Critic

## Purpose

HarnessLab's first executed temporary subagent is deliberately narrow: one Architecture Critic reviews an already generated `HarnessResult` and returns one structured artifact. It proves the temporary-agent lifecycle without tools, recursive spawning, code execution, files, databases, external writes, or production access.

```text
Validated HarnessResult
        ↓
Whitelist-only minimum context compiler
        ↓
One bounded Architecture Critic
  - browser-local deterministic, or
  - gateway deterministic / Ollama / OpenRouter free-only
  - one invocation
  - no tools
  - no child agents
  - no external actions
        ↓
TemporaryAgentReview validation
        ↓
Deterministic finding acceptance
        ↓
Reviewed HarnessResult
  - retained review artifact
  - accepted and rejected findings
  - trace evidence
  - evaluation update
  - provider/execution provenance
```

This slice operationalizes:

> Agents are disposable. Harnesses are durable. Validated artifacts persist.

## Execution paths

### Browser deterministic

The public GitHub Pages application can execute the rule-based critic directly in browser mode.

```text
No account
No model
No provider key
No gateway
No critique network request
```

The browser uses the same portable context, review, merge, artifact, trace, and worker-contract implementation as the gateway. It records:

```json
{
  "provider": "deterministic",
  "liveModel": false,
  "execution": "browser-local",
  "networkRequests": 0
}
```

### Gateway backed

Automatic and Gateway-required modes call:

```text
POST /v1/critique
```

The request contains only:

```json
{
  "result": {}
}
```

The browser cannot choose the provider, select a model, submit credentials, add tools, or expand the task. The configured gateway may use:

| Provider | Critic behavior |
|---|---|
| Deterministic | Rule-based review with no model |
| Ollama | One local JSON chat request to an explicitly configured model |
| OpenRouter | One JSON request through `openrouter/free` or an explicit `:free` model |

OpenRouter remains free-only, and provider credentials stay in the gateway environment.

## Shared portable core

`apps/web/critic-core.js` is browser-compatible and shared by the browser and Node gateway. It owns:

- context construction;
- context byte limits;
- critic prompt and response schema;
- deterministic review rules;
- finding acceptance;
- review-artifact creation;
- trace insertion;
- evaluation updates;
- preservation of authoritative controls.

The Node gateway adds only SHA-256 hashing, provider transport, request limits, CORS, deadlines, and HTTP error handling.

## Minimum context envelope

The critic receives only:

- fixed schema version, task, objective, and worker policy;
- interpreted requirement;
- complexity, risk, and confidence scores;
- architecture kind and rationale;
- protocol decisions;
- permission matrix;
- safety constraints;
- unresolved questions;
- bounded planned-agent summaries;
- artifact types and statuses;
- evaluation summary.

It does **not** receive:

- provider credentials or authorization;
- runtime secrets;
- full browser conversation;
- tool handles or expanded schemas;
- filesystem or database access;
- MCP clients or A2A peers;
- deployment credentials;
- production data.

The serialized context is limited to 48 KiB. Browser and gateway paths derive the same SHA-256 context identifier when Web Crypto is available.

## Non-negotiable worker contract

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

Gateway execution also applies:

```text
HARNESSLAB_CRITIC_TIMEOUT_MS=20000
HARNESSLAB_CRITIC_MAX_BODY_BYTES=262144
```

## Review schema

A model-backed or deterministic provider must produce only:

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

Allowed finding categories:

- `missing_requirement`
- `reliability`
- `overcomplexity`
- `evidence_gap`
- `safety_gap`
- `protocol_fit`

At most six findings are accepted into the typed review.

## Deterministic merge policy

Critic output is advice, not authority.

A finding is applied only when:

- it satisfies the strict schema;
- severity is `medium` or `high`;
- confidence is at least `0.70`.

Rejected findings remain retained but are not applied.

Accepted findings may only:

- append bounded unresolved questions;
- append bounded recommendation notes;
- add an `Architecture critique` evaluation dimension;
- add trace evidence;
- add the retained `TemporaryAgentReview` artifact.

The critic cannot modify or weaken:

- permissions or denied actions;
- approval requirements;
- execution stages;
- protocol decisions;
- planned subagent contracts;
- existing safety constraints;
- artifact retention;
- evaluation and traceability requirements.

## Failure behavior

Gateway timeout, provider unavailability, malformed output, and invalid worker artifacts are never presented as success. The gateway retains:

- a `failed` or `timed_out` worker status;
- sanitized failure code and message;
- failed review artifact;
- failure trace event;
- zero accepted findings;
- the original authoritative harness controls.

The browser deterministic path is synchronous, local, schema-validated, and has no provider transport failure mode. Contract failures are surfaced as an explicit browser critic error; no review is fabricated.

## Retained worker object

The reviewed result contains a `temporaryWorker` validated by `apps/web/temporary-worker-contract.js`. It records:

- worker identity, role, fixed task, and status;
- provider, model, live/free-only policy;
- start/completion timestamps, latency, and deadline;
- one-invocation budget and use;
- empty tool list;
- no-child and no-external-action flags;
- context field names, byte count, and artifact ID;
- review and accepted/rejected findings;
- optional provider usage;
- sanitized failure information when applicable.

## Browser console

The public critic console:

- receives the latest plan through a local custom event;
- executes locally when browser mode is active;
- uses the gateway only in Automatic or Gateway-required mode;
- sends no provider authorization;
- displays execution path, status, provenance, context size, artifact, and finding decisions;
- can copy or download the reviewed result;
- can save it as a new immutable browser-local project version.

## Verification

The repository verifies:

- browser/gateway context and result parity;
- browser execution with a fetch function that must never be called;
- real public-browser execution with CDP network capture;
- zero POST, `/v1/critique`, OpenRouter, or Ollama request during local critique;
- one-worker and one-invocation limits;
- no tools, child agents, or external actions;
- strict review parsing and deterministic finding acceptance;
- preservation of permissions, stages, protocols, and planned agents;
- retained artifact, completion trace, and evaluation update;
- deterministic, Ollama, and free-only OpenRouter gateway paths;
- desktop, tablet, phone, focus, and reduced-motion behavior;
- live GitHub Pages publication.

## Next seam

Multiple independent temporary workers should be added only after evaluation evidence shows that the single critic produces measurable accuracy or coverage gains. Future parallelism must remain dependency-aware, budgeted, artifact-driven, and judge-validated.
