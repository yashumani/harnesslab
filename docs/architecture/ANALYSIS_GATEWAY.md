# Provider-Neutral Analysis Gateway

## Purpose

HarnessLab keeps provider access behind a replaceable seam while preserving a useful static application.

```text
Browser UI
  ├─ deterministic requirement engine
  ├─ browser-local deterministic Architecture Critic
  └─ optional HarnessLab gateway
       ├─ deterministic provider
       ├─ explicitly configured Ollama provider
       └─ explicitly configured OpenRouter free-only provider
```

All paths return the same validated `HarnessResult` and temporary-worker contracts. The current gateway does not execute tools, MCP servers, A2A peers, code, files, databases, external writes, deployments, purchases, or production actions.

## Browser modes

### Browser deterministic

No gateway request is made for analysis or critique.

- the browser engine produces the harness plan;
- the local deterministic critic compiles the same whitelist-only context used by the gateway;
- one typed `TemporaryAgentReview` is produced;
- deterministic merge rules update the artifact set, trace, and evaluation;
- no model, key, account, gateway, or critique network request is required.

### Automatic

Analysis first attempts the configured gateway and falls back to deterministic browser analysis when the gateway fails. Fallback is explicitly recorded in runtime metadata and trace evidence.

The temporary critic remains an explicit action. In Automatic mode it uses the configured gateway and does not silently fall back to a fabricated worker.

### Gateway required

Analysis and critique require the configured gateway. Failures are surfaced rather than represented as model or worker success.

Only gateway URL, runtime mode, and timeout metadata may be stored by the browser. Provider credentials are never accepted by the UI.

## HTTP contracts

### `GET /health`

Returns gateway identity, provider name, selected model, availability, free-only policy, and supported capabilities. It never returns environment values, credentials, API-key metadata, raw provider responses, or stack traces.

Representative capabilities:

```json
{
  "analyzeHarness": true,
  "executeTemporaryCritic": true,
  "maxTemporaryWorkersPerRequest": 1,
  "executeTools": false,
  "executeMcp": false,
  "executeA2a": false,
  "executeCode": false,
  "externalActions": false
}
```

### `POST /v1/analyze`

```json
{
  "requirement": "Build a bounded agent system..."
}
```

Unknown fields are rejected. The browser cannot use the request to select a provider, submit credentials, choose a model, or expand server permissions.

The returned `result` must pass `apps/web/result-contract.js` on the server and again in the browser.

### `POST /v1/critique`

```json
{
  "result": {}
}
```

No other request field is accepted. The gateway:

1. validates the incoming `HarnessResult`;
2. compiles the 48 KiB maximum context envelope;
3. executes exactly one configured critic provider invocation;
4. validates the review schema;
5. applies deterministic finding rules;
6. returns the reviewed result and worker artifact.

The browser cannot select the critic provider, model, tools, role, permissions, or worker count.

## Shared critic implementation

`apps/web/critic-core.js` is used by both browser and gateway execution. It owns:

- minimum-context selection;
- review parsing;
- deterministic review behavior;
- finding acceptance;
- review-artifact construction;
- trace and evaluation updates;
- control preservation.

The Node gateway wrapper adds SHA-256 context hashing, provider transport, HTTP limits, timeout handling, and sanitized errors. Browser and gateway deterministic paths are parity-tested for identical input and timestamps.

Full detail: [`TEMPORARY_CRITIC.md`](TEMPORARY_CRITIC.md).

## Provider behavior

| Provider | Analysis | Critic |
|---|---|---|
| Browser deterministic | Local deterministic plan | Local deterministic review; zero critique network requests |
| Gateway deterministic | Server deterministic plan | Server deterministic review |
| Ollama | Bounded local-model guidance | One bounded JSON model request |
| OpenRouter | Bounded hosted-model guidance | One request through `openrouter/free` or an explicit `:free` model |

OpenRouter model routes are validated at startup. Paid or ambiguous routes are rejected, and credentials remain server-side.

## Reliability and security controls

- exact-origin CORS allowlist;
- JSON-only request bodies;
- bounded requirement, request-body, context, and provider-response sizes;
- separate analysis and critic deadlines;
- complete provider response-body timeout;
- random request IDs and `no-store` responses;
- sanitized errors without credentials, raw model content, or stack traces;
- deterministic default provider;
- no browser API-key field or provider authorization header;
- server-selected provider with no request override;
- fixed official OpenRouter HTTPS origin;
- OpenRouter limited to `openrouter/free` or explicit `:free` routes;
- one temporary worker and one invocation;
- whitelist-only context;
- no tools, child agents, or external actions;
- strict server and browser validation;
- non-root gateway container.

## Run locally

Browser-only:

```bash
npm run serve
```

Open `http://127.0.0.1:4173`, generate a plan, and execute the deterministic critic directly in browser mode.

With gateway:

```bash
npm run gateway
npm run serve
```

Select **Automatic** or **Gateway required**, test `http://127.0.0.1:8787`, generate a plan, and run the gateway-backed critic.
