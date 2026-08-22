# Provider-Neutral Analysis Gateway

## Purpose

HarnessLab has a replaceable analysis seam. The public static UI remains deployable and useful by itself, while an optional gateway can supply server-side deterministic analysis, bounded local Ollama guidance, bounded OpenRouter free-model guidance, and one optional temporary architecture critic.

```text
Browser UI
  → analysis client
      ├─ browser deterministic provider
      └─ HarnessLab gateway
           ├─ deterministic provider
           ├─ Ollama provider
           └─ OpenRouter free-only provider
  → shared HarnessResult contract
  → existing renderer, project history, artifacts, and evaluations

Validated HarnessResult
  → critic client
      → HarnessLab gateway
           → one temporary architecture critic
  → TemporaryAgentReview artifact
  → deterministic finding merge
  → trace, evaluation, and reviewed project version
```

The gateway does not execute tools, MCP servers, A2A peers, code, files, databases, production actions, or external writes in this slice.

## Browser modes

### Browser deterministic

No network request is made. The in-browser engine produces the established harness result and records browser/deterministic provenance. Temporary-worker execution is unavailable in this mode.

### Automatic

The browser calls the configured gateway for analysis. A network error, timeout, non-success response, invalid JSON, or invalid harness result triggers deterministic browser fallback. The fallback is added to the trace and runtime metadata.

A temporary critic remains an explicit user action. It never falls back to a fabricated browser worker.

### Gateway required

The browser calls the configured gateway and surfaces failure. It does not silently claim that a model, provider, or temporary worker completed the task.

Only gateway URL, mode, and timeout metadata may be stored in the browser. Provider credentials are never accepted by the web interface.

## HTTP contracts

### `GET /health`

Returns gateway identity, configured provider, availability, free-only policy, and supported capabilities. It never returns environment values, provider base URLs, credentials, API-key metadata, stack traces, or raw provider responses.

Representative response:

```json
{
  "requestId": "...",
  "service": "harnesslab-gateway",
  "version": "0.3.0",
  "status": "ok",
  "provider": {
    "name": "openrouter",
    "model": "openrouter/free",
    "liveModel": true,
    "freeOnly": true,
    "configured": true,
    "available": true,
    "reason": null
  },
  "capabilities": {
    "analyzeHarness": true,
    "executeTemporaryCritic": true,
    "maxTemporaryWorkersPerRequest": 1,
    "executeTools": false,
    "executeMcp": false,
    "executeA2a": false,
    "executeCode": false,
    "externalActions": false
  }
}
```

### `POST /v1/analyze`

Request:

```json
{
  "requirement": "Build a bounded agent system..."
}
```

The gateway rejects unknown request fields so a browser cannot choose providers, submit credentials, select a paid model, or expand server permissions through the request body.

Response:

```json
{
  "requestId": "...",
  "provider": {
    "name": "openrouter",
    "model": "provider/actual-routed-model:free",
    "liveModel": true,
    "freeOnly": true
  },
  "result": {},
  "metadata": {
    "latencyMs": 1200,
    "usage": {
      "promptTokens": 400,
      "completionTokens": 150,
      "totalTokens": 550
    }
  }
}
```

`result` must pass `apps/web/result-contract.js` before it is sent by the server and again before it is rendered by the browser.

### `POST /v1/critique`

Request:

```json
{
  "result": {}
}
```

`result` must already satisfy the HarnessResult contract. No other request field is accepted. Therefore the browser cannot choose a provider, select a model, add a tool, change the worker role, provide credentials, or request multiple workers.

The gateway compiles a 48 KiB maximum context envelope, executes exactly one critic provider call, validates the returned review, applies deterministic finding rules, and returns:

```json
{
  "requestId": "...",
  "provider": {
    "name": "openrouter",
    "model": "provider/actual-routed-model:free",
    "liveModel": true,
    "freeOnly": true
  },
  "result": {
    "temporaryWorker": {}
  },
  "worker": {},
  "metadata": {
    "latencyMs": 900,
    "usage": {},
    "completed": true
  }
}
```

The browser and gateway both validate `worker` with `apps/web/temporary-worker-contract.js`. The result retains a `TemporaryAgentReview` artifact and worker lifecycle trace events.

## Temporary critic boundary

The worker contract is fixed:

```text
Role: Architecture Critic
Task: architecture-critic
Maximum workers per request: 1
Provider-call budget: 1
Tools: none
Child spawning: denied
External actions: denied
Code execution: denied
MCP: denied
A2A: denied
```

The provider response is a strict JSON review with at most six findings. Deterministic rules apply only findings with `medium` or `high` severity and confidence of at least `0.70`.

The merge may add unresolved questions, append critic recommendations, add an Architecture critique evaluation dimension, retain the review artifact, and add trace evidence. It cannot modify or weaken permissions, denied actions, approval requirements, stages, protocol decisions, planned subagent contracts, safety constraints, artifact requirements, or traceability.

A timeout or provider failure returns the original result plus a failed/timed-out worker artifact and trace. It never invents a completed review.

Full detail: [`TEMPORARY_CRITIC.md`](TEMPORARY_CRITIC.md).

## Reliability and security controls

- Exact-origin CORS allowlist; no wildcard default.
- JSON-only request bodies.
- 1,600-character requirement limit for analysis.
- Configurable analysis and critic request-body limits.
- Separate gateway analysis and critic deadlines.
- Complete provider response-body timeout.
- Bounded response parsing for browser, Ollama, and OpenRouter.
- Random request identifiers and no-store responses.
- Sanitized error envelopes without stack traces, raw model content, or credentials.
- Deterministic default provider.
- No browser API-key field or provider authorization header.
- Server-selected provider; requests cannot override it.
- Fixed official OpenRouter HTTPS API origin.
- OpenRouter model policy restricted to `openrouter/free` or an explicit identifier ending in `:free`.
- One temporary worker and one call per critic request.
- Whitelist-only temporary-worker context.
- No tools, child agents, or external actions.
- Strict worker result validation in server and browser.
- Non-root container runtime.

## Run locally

Terminal 1:

```bash
npm run gateway
```

Terminal 2:

```bash
npm run serve
```

Open `http://127.0.0.1:4173`, select **Gateway required** or **Automatic**, test `http://127.0.0.1:8787`, generate a plan, then open the Temporary Architecture Critic console.

The default gateway provider is deterministic, so analysis and critic execution need no model, account, key, or paid service.

## Critic configuration

```bash
export HARNESSLAB_CRITIC_TIMEOUT_MS=20000
export HARNESSLAB_CRITIC_MAX_BODY_BYTES=262144
```

The context compiler has an independent hard limit of 48 KiB.

## Run with Ollama

Set environment values outside the repository:

```bash
export HARNESSLAB_PROVIDER=ollama
export OLLAMA_BASE_URL=http://127.0.0.1:11434
export OLLAMA_DEFAULT_MODEL=<installed-local-model-name>
npm run gateway
```

The Ollama adapter requests either a bounded architecture supplement or one bounded critic review. Deterministic HarnessLab permissions, stages, artifacts, trace requirements, safety constraints, evaluation rules, and critic finding acceptance remain authoritative.

## Run with OpenRouter free models

OpenRouter requires an account-created API key even for free API routes. Place the key only in the gateway environment:

```bash
export HARNESSLAB_PROVIDER=openrouter
export OPENROUTER_API_KEY=<your-openrouter-api-key>
export OPENROUTER_DEFAULT_MODEL=openrouter/free
npm run gateway
```

A specific free variant can replace the router:

```bash
export OPENROUTER_DEFAULT_MODEL=<provider/model:free>
```

Any model that is neither exactly `openrouter/free` nor suffixed with `:free` is rejected during gateway startup. HarnessLab does not provide a paid-model override.

The OpenRouter adapter:

- validates the key through the official key metadata endpoint;
- sends inference only to the fixed official chat-completions endpoint;
- requests JSON-object output;
- uses non-streaming responses and a bounded token limit;
- records the actual routed model when provided;
- records bounded usage metadata;
- sanitizes provider errors;
- never returns the key or key metadata;
- uses the same free-only route for the optional critic.

## Container

```bash
docker build -f services/gateway/Dockerfile -t harnesslab-gateway .
docker run --rm -p 8787:8787 harnesslab-gateway
```

The image starts with the deterministic provider. Pass Ollama or OpenRouter settings only through the runtime environment.

## Deployment seam

GitHub Pages publishes only `apps/web`. It serves browser-deterministic analysis and the temporary-critic console, but it does not host the gateway itself.

A hosted gateway should use HTTPS, narrow origin allowlists, environment-scoped provider configuration, authentication before multi-user use, rate limits, centralized traces, and dedicated worker isolation before any further capability is exposed.

The next server-side slices will add authenticated project persistence and bounded multi-worker orchestration behind the existing browser contracts.
