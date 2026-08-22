# HarnessLab

HarnessLab is an AI-assisted agent harness builder and adaptive swarm runtime for designing, validating, running, and evolving durable agent systems.

> **Agents are disposable. Harnesses are durable. Knowledge is retained as structured artifacts.**

## Live application

The advanced no-build React command center is deployed at:

```text
https://yashumani.github.io/harnesslab/
```

HarnessLab follows a **deploy-first development cycle**. The current visible path is:

```text
Project
  → analysis runtime
  → requirement interpretation
  → harness architecture
  → bounded subagent plan
  → permissions and artifacts
  → trace and evaluation
  → optional executed architecture critic
  → immutable saved version
```

The deployed UI includes:

- deterministic requirement interpretation and architecture selection;
- workflow, single-agent, or temporary-subagent guidance;
- MCP, A2A, retrieval, and typed-function recommendations;
- bounded planned-agent contracts;
- permissions and approval gates;
- structured artifact identifiers;
- execution trace and evaluation summary;
- browser-local projects, immutable harness versions, restore, and JSON backup;
- provider-neutral runtime controls with browser, automatic-fallback, and gateway-required modes;
- a live **Temporary Architecture Critic** console for one bounded gateway worker.

## First executed temporary worker

The architecture critic is the first subagent HarnessLab can actually execute. It is deliberately constrained:

```text
One worker
One provider call
No tools
No child agents
No external actions
Fixed deadline
Structured review only
```

The critic receives a whitelist-only context envelope containing the requirement, architecture, protocols, permissions, constraints, unresolved questions, bounded planned-agent summaries, artifacts, and evaluation. It does not receive provider credentials, the full browser conversation, filesystem access, databases, MCP clients, A2A peers, deployment credentials, or production data.

A finding is applied only when it passes the typed schema, has `medium` or `high` severity, and has confidence of at least `0.70`. Rejected findings remain in the review artifact for traceability. The deterministic merge cannot weaken permissions, denied actions, approval requirements, stages, protocols, existing constraints, artifacts, or evaluation requirements.

Browser-deterministic mode remains analysis-only and executes no worker. To run the critic, start the gateway and select **Automatic** or **Gateway required** in the application.

## Provider-neutral gateway

```text
Browser analysis client
  ├─ deterministic browser engine
  └─ HarnessLab gateway
       ├─ deterministic provider
       ├─ explicitly configured Ollama provider
       └─ explicitly configured OpenRouter free-only provider
```

The browser never accepts provider keys. Gateway responses, browser fallback, and temporary-worker results pass shared validators before rendering or saving.

The current slice does not execute MCP tools, A2A peers, arbitrary code, files, databases, external writes, deployments, purchases, or production changes. Browser project data is local to the current browser profile and is not encrypted cloud storage or cross-device synchronization.

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

Then select **Automatic** or **Gateway required**, use **Test connection**, generate a plan, and open the critic launcher in the lower-right corner.

The gateway exposes:

```text
GET  /health
POST /v1/analyze
POST /v1/critique
```

The critic endpoint accepts only a validated harness result. The request cannot choose a provider, select a model, add tools, or expand the worker task.

### Temporary critic limits

Defaults:

```bash
export HARNESSLAB_CRITIC_TIMEOUT_MS=20000
export HARNESSLAB_CRITIC_MAX_BODY_BYTES=262144
```

The compiled worker context itself is limited to 48 KiB. Every provider receives a one-call budget.

### Enable an installed Ollama model

Configure values outside the repository:

```bash
export HARNESSLAB_PROVIDER=ollama
export OLLAMA_BASE_URL=http://127.0.0.1:11434
export OLLAMA_DEFAULT_MODEL=<installed-local-model-name>
npm run gateway
```

Ollama can supply bounded architecture guidance and one bounded critic review. Deterministic HarnessLab permissions, stages, artifact requirements, safety constraints, finding acceptance, and validation remain authoritative.

### Enable OpenRouter free models

OpenRouter requires an API key even for free routes. Put it only in the gateway environment:

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

A paid or ambiguous model identifier is rejected at gateway startup. There is no paid-model override. The adapter uses the fixed official OpenRouter HTTPS API origin, validates the key without returning its metadata, requests structured JSON, records the actual routed model when available, and preserves deterministic HarnessLab controls.

No OpenRouter account, key, credit purchase, or live request is created automatically by this repository.

## Run the gateway container

```bash
docker build -f services/gateway/Dockerfile -t harnesslab-gateway .
docker run --rm -p 8787:8787 harnesslab-gateway
```

The container runs as a non-root user and starts with the deterministic provider. Pass Ollama or OpenRouter settings at runtime; never bake a credential into the image.

## Test

```bash
npm run check
```

The suite covers:

- deterministic architecture routing and planned-agent limits;
- permission, A2A, artifact, trace, and evaluation contracts;
- browser workspace recovery, immutable versions, retention, and backup export;
- shared harness-result and temporary-worker validation;
- browser runtime modes, fallback evidence, and gateway identity checks;
- minimum critic context compilation;
- one-worker, one-call, no-tools, no-child, and no-external-action enforcement;
- strict critic review parsing and deterministic finding acceptance;
- retained timeout and failure evidence;
- browser critic-client and console contracts;
- gateway CORS, body-size, method, timeout, routed-model, and sanitized-error behavior;
- deterministic HTTP analysis and critic execution;
- bounded Ollama and OpenRouter analysis/critic behavior;
- free-only OpenRouter enforcement;
- non-root container build;
- live GitHub Pages assets and responsive critic visual.

## Browser workspace boundary

Harness projects currently use versioned browser storage:

```text
Project
  → full requirement
  → validated harness result
  → optional reviewed result
  → immutable saved version
  → local version history
  → optional JSON backup
```

Do not enter credentials, API keys, production data, or secrets. Exported backups can contain the full requirement and reviewed artifacts and should be handled as private files.

## Deploy

The GitHub Pages workflow validates and publishes only `apps/web`:

```text
.github/workflows/deploy-pages.yml
```

After deployment, a separate workflow tests the actual public HTML, modules, worker contract, critic visual, and manifest:

```text
.github/workflows/verify-pages.yml
```

The gateway is independently container-deployable; GitHub Pages hosts only the browser application.

Architecture details:

- [`docs/architecture/DEPLOY_FIRST.md`](docs/architecture/DEPLOY_FIRST.md)
- [`docs/architecture/LOCAL_WORKSPACE.md`](docs/architecture/LOCAL_WORKSPACE.md)
- [`docs/architecture/ANALYSIS_GATEWAY.md`](docs/architecture/ANALYSIS_GATEWAY.md)
- [`docs/architecture/NO_BUILD_REACT.md`](docs/architecture/NO_BUILD_REACT.md)
- [`docs/architecture/TEMPORARY_CRITIC.md`](docs/architecture/TEMPORARY_CRITIC.md)

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

Repository governance, deploy-first CI, the live no-build React command center, durable browser projects, provider-neutral gateway, Ollama, free-only OpenRouter, and one executable bounded temporary critic are developed through pull requests.

No open-source license has been selected yet. Do not assume permission to copy, modify, or redistribute this repository's contents.
