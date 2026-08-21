# Provider-Neutral Analysis Gateway

## Purpose

HarnessLab now has a replaceable analysis seam. The public static UI remains deployable and useful by itself, while an optional gateway can supply server-side deterministic analysis or bounded Ollama-assisted guidance.

```text
Browser UI
  → analysis client
      ├─ browser deterministic provider
      └─ HarnessLab gateway
           ├─ deterministic provider
           └─ Ollama provider
  → shared HarnessResult contract
  → existing renderer, project history, artifacts, and evaluations
```

The gateway does not execute tools, MCP servers, A2A peers, code, files, production actions, or temporary workers in this slice.

## Browser modes

### Browser deterministic

No network request is made. The in-browser engine produces the established harness result and records browser/deterministic provenance.

### Automatic

The browser calls the configured gateway. A network error, timeout, non-success response, invalid JSON, or invalid harness result triggers deterministic browser fallback. The fallback is added to the trace and runtime metadata.

### Gateway required

The browser calls the configured gateway and surfaces failure. It does not silently claim that a model or provider completed the task.

Only gateway URL, mode, and timeout metadata may be stored in the browser. Provider credentials are never accepted by the web interface.

## HTTP contract

### `GET /health`

Returns gateway identity, configured provider, availability, and supported capabilities. It never returns environment values, provider base URLs, credentials, stack traces, or raw provider responses.

Representative response:

```json
{
  "requestId": "...",
  "service": "harnesslab-gateway",
  "version": "0.1.0",
  "status": "ok",
  "provider": {
    "name": "deterministic",
    "model": null,
    "liveModel": false,
    "configured": true,
    "available": true,
    "reason": null
  },
  "capabilities": {
    "analyzeHarness": true,
    "executeTools": false,
    "executeMcp": false,
    "executeA2a": false
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

The gateway rejects unknown request fields so a browser cannot choose providers, submit credentials, or expand server permissions through the request body.

Response:

```json
{
  "requestId": "...",
  "provider": {
    "name": "deterministic",
    "model": null,
    "liveModel": false
  },
  "result": {},
  "metadata": {
    "latencyMs": 4,
    "usage": null
  }
}
```

`result` must pass the shared `apps/web/result-contract.js` validator before it is sent by the server and again before it is rendered by the browser.

## Reliability and security controls

- Exact-origin CORS allowlist; no wildcard default.
- JSON-only request bodies.
- 1,600-character requirement limit.
- Configurable body-size limit.
- Gateway and provider timeouts.
- Bounded response parsing in the browser and Ollama adapter.
- Random request identifiers and no-store responses.
- Sanitized error envelopes without stack traces or raw model content.
- Deterministic default provider.
- No browser API-key field or authorization header.
- Server-selected provider; the request cannot override it.
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

Open `http://127.0.0.1:4173`, select **Gateway required** or **Automatic**, and test `http://127.0.0.1:8787`.

The default gateway provider is deterministic, so this path needs no model, account, key, or paid service.

## Run with Ollama

Set environment values outside the repository:

```bash
export HARNESSLAB_PROVIDER=ollama
export OLLAMA_BASE_URL=http://127.0.0.1:11434
export OLLAMA_DEFAULT_MODEL=<installed-local-model-name>
npm run gateway
```

The Ollama adapter requests a small JSON architecture supplement. It may refine architecture kind, rationale, recommendation, unresolved questions, and confidence. Deterministic HarnessLab permissions, stages, artifacts, trace requirements, safety constraints, and evaluations remain authoritative.

An unavailable model, malformed response, schema violation, or timeout returns an explicit gateway error. Browser **Automatic** mode may then use and record deterministic fallback; **Gateway required** mode does not.

## Container

```bash
docker build -f services/gateway/Dockerfile -t harnesslab-gateway .
docker run --rm -p 8787:8787 harnesslab-gateway
```

The image starts with the deterministic provider. Pass Ollama settings only through the runtime environment when needed.

## Deployment seam

GitHub Pages continues publishing only `apps/web`. The gateway is independently deployable to a container host later. A hosted gateway should use HTTPS, narrow origin allowlists, environment-scoped provider configuration, authentication before multi-user use, rate limits, and centralized traces.

The next server-side slices will add authenticated project persistence and bounded temporary-worker execution behind the same browser contract. OpenRouter remains a future server-side adapter; it is not activated by this slice.
