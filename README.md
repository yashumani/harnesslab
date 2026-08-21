# HarnessLab

HarnessLab is an AI-assisted agent harness builder and adaptive swarm runtime for designing, validating, running, and evolving durable agent systems.

> **Agents are disposable. Harnesses are durable. Knowledge is retained as structured artifacts.**

## Current deploy-first slices

HarnessLab follows a **deploy-first development cycle**. The static application already provides a complete visible path:

```text
Project
  → analysis runtime
  → requirement interpretation
  → harness architecture
  → bounded temporary-agent plan
  → permissions and artifacts
  → trace and evaluation
  → immutable saved version
```

The deployed UI includes:

- deterministic requirement interpretation and architecture selection;
- workflow, single-agent, or temporary-subagent guidance;
- MCP, A2A, retrieval, and typed-function recommendations;
- bounded temporary-agent contracts;
- permissions and approval gates;
- structured artifact identifiers;
- execution trace and evaluation summary;
- browser-local projects, immutable harness versions, restore, and JSON backup;
- provider-neutral runtime controls with browser, automatic-fallback, and gateway-required modes.

The optional gateway adds server-side provider seams without breaking the static experience:

```text
Browser analysis client
  ├─ deterministic browser engine
  └─ HarnessLab gateway
       ├─ deterministic provider
       ├─ explicitly configured Ollama provider
       └─ explicitly configured OpenRouter free-only provider
```

The browser never accepts provider keys. Gateway responses and browser fallback both pass the shared harness-result validator before rendering or saving.

No slice currently executes MCP tools, A2A peers, arbitrary code, external writes, production changes, or remote temporary workers. Browser project data is local to the current browser profile and is not encrypted cloud storage or cross-device synchronization.

Expected public URL after GitHub Pages is configured for GitHub Actions:

```text
https://yashumani.github.io/harnesslab/
```

## Requirements

- Node.js 22 or newer for tests and the analysis gateway;
- Python 3 for the zero-dependency local static server;
- Docker only when validating or running the optional gateway container;
- Ollama only when explicitly selecting the Ollama provider;
- an OpenRouter account-created API key only when explicitly selecting the OpenRouter provider.

No package installation is required for the current slices.

## Run the browser application

```bash
npm run check
npm run serve
```

Open:

```text
http://127.0.0.1:4173
```

Browser deterministic mode needs no account, API key, model download, gateway, or paid service.

## Run the analysis gateway

In another terminal:

```bash
npm run gateway
```

The safe default provider is deterministic. In the browser, set the gateway URL to:

```text
http://127.0.0.1:8787
```

Then select **Automatic** or **Gateway required** and use **Test connection**.

### Enable an installed Ollama model

Configure values outside the repository:

```bash
export HARNESSLAB_PROVIDER=ollama
export OLLAMA_BASE_URL=http://127.0.0.1:11434
export OLLAMA_DEFAULT_MODEL=<installed-local-model-name>
npm run gateway
```

Ollama supplies a bounded architecture supplement. Deterministic HarnessLab permissions, stages, artifact requirements, safety constraints, and validation remain authoritative. An unavailable or invalid model response becomes an explicit error; only browser **Automatic** mode may use and record deterministic fallback.

### Enable OpenRouter free models

OpenRouter still requires an API key. Put it only in the gateway environment:

```bash
export HARNESSLAB_PROVIDER=openrouter
export OPENROUTER_API_KEY=<your-openrouter-api-key>
export OPENROUTER_DEFAULT_MODEL=openrouter/free
npm run gateway
```

HarnessLab permits only:

```text
openrouter/free
<provider/model:free>
```

A paid or ambiguous model identifier is rejected at gateway startup. This slice has no paid-model override.

The adapter validates the key without returning its metadata, uses the fixed official OpenRouter HTTPS API origin, requests structured JSON, records the actual routed model when available, and keeps deterministic HarnessLab permissions, stages, artifacts, safety constraints, and evaluations authoritative.

No OpenRouter account, key, credit purchase, or live request is created automatically by this repository.

## Run the gateway container

```bash
docker build -f services/gateway/Dockerfile -t harnesslab-gateway .
docker run --rm -p 8787:8787 harnesslab-gateway
```

The container runs as a non-root user and starts with the deterministic provider. Pass any Ollama or OpenRouter settings at runtime; never bake a credential into the image.

## Test

```bash
npm run check
```

The suite covers:

- deterministic architecture routing and temporary-agent limits;
- permission, A2A, artifact, trace, and evaluation contracts;
- browser workspace recovery, immutable versions, retention, and backup export;
- shared harness-result validation;
- browser runtime modes, fallback evidence, and gateway identity checks;
- gateway CORS, body-size, method, timeout, routed-model, and sanitized-error behavior;
- deterministic HTTP analysis;
- shared complete-response provider timeout and size boundaries;
- bounded Ollama health, response, and control-preservation behavior;
- free-only OpenRouter model enforcement, health, headers, structured output, routed-model provenance, response validation, and control preservation.

## Browser workspace boundary

Harness projects currently use versioned browser storage:

```text
Project
  → full requirement
  → validated harness result
  → immutable saved version
  → local version history
  → optional JSON backup
```

Do not enter credentials, API keys, production data, or secrets. Exported backups can contain the full requirement text and should be handled as private files.

## Deploy

The GitHub Pages workflow publishes only `apps/web` after validation. Before the first deployment, a repository administrator must select:

```text
Settings → Pages → Build and deployment → Source → GitHub Actions
```

Every relevant push to `main` then runs `.github/workflows/deploy-pages.yml`. The optional gateway is independently container-deployable; it is not hosted by GitHub Pages.

Architecture details:

- [`docs/architecture/DEPLOY_FIRST.md`](docs/architecture/DEPLOY_FIRST.md)
- [`docs/architecture/LOCAL_WORKSPACE.md`](docs/architecture/LOCAL_WORKSPACE.md)
- [`docs/architecture/ANALYSIS_GATEWAY.md`](docs/architecture/ANALYSIS_GATEWAY.md)

## Product direction

HarnessLab will provide:

- guided requirements discovery;
- agent-versus-workflow architecture decisions;
- harness specification generation;
- capability-aware model routing across OpenRouter, Ollama, and future providers;
- adaptive temporary-subagent orchestration;
- context isolation and least-privilege tool access;
- structured artifact and state management;
- MCP integration and selective A2A interoperability;
- simulation, evaluation, tracing, and failure recovery;
- code scaffolding and deployment guidance.

## Foundational principles

1. Start deterministic; add agency only where uncertainty requires it.
2. Spawn temporary intelligence only when the expected benefit exceeds cost and complexity.
3. Give every subagent minimum necessary context, tools, permissions, time, and budget.
4. Prefer structured artifacts over unbounded agent-to-agent conversation.
5. Preserve provider independence through a model and harness abstraction layer.
6. Treat evaluation, observability, security, and recovery as core architecture—not add-ons.
7. Require human approval for destructive, irreversible, financial, security-sensitive, or production-impacting operations.
8. Deploy a complete user-visible skeleton before replacing its internal seams.

## Repository status

Repository governance, security boundaries, deploy-first CI, the interactive skeleton, durable browser projects, the provider-neutral gateway, Ollama, and a free-only OpenRouter adapter are developed through pull requests.

No open-source license has been selected yet. Do not assume permission to copy, modify, or redistribute this repository's contents.
