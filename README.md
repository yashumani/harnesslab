# HarnessLab

HarnessLab is an AI-assisted agent harness builder and adaptive temporary-agent runtime for designing, validating, running, and evolving durable agent systems.

> **Agents are disposable. Harnesses are durable. Knowledge is retained as structured artifacts.**

## Live application

```text
https://yashumani.github.io/harnesslab/
```

HarnessLab follows a deploy-first cycle:

```text
Requirement
  → architecture decision
  → bounded agent plan
  → permissions and protocols
  → artifacts and trace
  → evaluation
  → optional executed architecture critic
  → immutable saved version
```

The browser experience is a no-build React application. React, ReactDOM, and HTM are pinned and loaded directly; GitHub Pages publishes the reviewed files in `apps/web`.

## Product interface

The current interface is an original HarnessLab product experience based on high-level patterns from the free **Taskzen** AI SaaS template on Framer:

- light professional B2B SaaS presentation;
- compact product navigation;
- real HarnessLab architecture output as the hero preview;
- restrained indigo and teal semantic accents;
- dashboard-oriented project, runtime, risk, architecture, control, and evidence surfaces;
- deliberate desktop, tablet, and phone compositions;
- keyboard focus and reduced-motion support.

No Framer project, template source, screenshot, illustration, icon pack, or proprietary asset is copied into this repository. See [`docs/architecture/FRAMER_TASKZEN_VISUAL_SYSTEM.md`](docs/architecture/FRAMER_TASKZEN_VISUAL_SYSTEM.md).

## Current capabilities

The deployed application includes:

- deterministic requirement interpretation and architecture selection;
- workflow, single-agent, or temporary-subagent recommendations;
- MCP, A2A, retrieval, and typed-function guidance;
- bounded planned-agent contracts;
- capability-level permissions and approval gates;
- structured artifact identifiers;
- execution trace and evaluation summary;
- browser-local projects and immutable harness versions;
- restore, copy, download, and JSON workspace backup;
- browser, automatic-fallback, and gateway-required runtime modes;
- provider-neutral Ollama and free-only OpenRouter gateway adapters;
- one executable bounded **Temporary Architecture Critic**.

## First executed temporary worker

The architecture critic is deliberately constrained:

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

A finding is applied only when it passes the typed schema, has `medium` or `high` severity, and has confidence of at least `0.70`. Rejected findings remain in the review artifact for traceability. Deterministic merge logic cannot weaken permissions, denied actions, approval requirements, stages, protocols, constraints, artifacts, or evaluation requirements.

Browser-deterministic mode remains analysis-only and executes no worker. To run the critic, start the gateway and select **Automatic** or **Gateway required**.

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

No package installation is required for the current application slices.

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

The safe default provider is deterministic. Set the browser gateway URL to:

```text
http://127.0.0.1:8787
```

Then select **Automatic** or **Gateway required**, test the connection, generate a plan, and open the critic launcher.

The gateway exposes:

```text
GET  /health
POST /v1/analyze
POST /v1/critique
```

The critic endpoint accepts only a validated harness result. The browser request cannot choose a provider, select a model, add tools, or expand the worker task.

### Temporary critic limits

```bash
export HARNESSLAB_CRITIC_TIMEOUT_MS=20000
export HARNESSLAB_CRITIC_MAX_BODY_BYTES=262144
```

The compiled worker context is limited to 48 KiB. Every provider receives a one-call budget.

### Enable an installed Ollama model

```bash
export HARNESSLAB_PROVIDER=ollama
export OLLAMA_BASE_URL=http://127.0.0.1:11434
export OLLAMA_DEFAULT_MODEL=<installed-local-model-name>
npm run gateway
```

Ollama may supply bounded architecture guidance and one bounded critic review. Deterministic HarnessLab permissions, stages, artifact requirements, safety constraints, finding acceptance, and validation remain authoritative.

### Enable OpenRouter free models

OpenRouter requires an API key even for free routes. Keep it only in the gateway environment:

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

A paid or ambiguous model identifier is rejected at gateway startup. There is no paid-model override. No OpenRouter account, key, credit purchase, or live request is created automatically by this repository.

## Run the gateway container

```bash
docker build -f services/gateway/Dockerfile -t harnesslab-gateway .
docker run --rm -p 8787:8787 harnesslab-gateway
```

The container runs as a non-root user and starts with the deterministic provider. Pass provider settings at runtime; never bake credentials into the image.

## Validation

```bash
npm run check
```

The suite covers:

- deterministic architecture routing and planned-agent limits;
- permission, A2A, artifact, trace, and evaluation contracts;
- browser workspace recovery, immutable versions, retention, and backup export;
- shared harness-result and temporary-worker validation;
- browser runtime modes, fallback evidence, and gateway identity checks;
- one-worker, one-call, no-tools, no-child, and no-external-action enforcement;
- strict critic parsing and deterministic finding acceptance;
- retained timeout and failure evidence;
- gateway CORS, body-size, method, timeout, and sanitized-error behavior;
- deterministic HTTP analysis and critic execution;
- bounded Ollama and OpenRouter behavior;
- free-only OpenRouter enforcement;
- non-root container build;
- Taskzen visual-system contracts;
- exact desktop, tablet, and phone browser audits with screenshots and DOM evidence;
- public GitHub Pages asset verification.

## Responsive QA

The `UI Viewport Audit` workflow starts the real no-build application and uses Chrome DevTools Protocol to render exact CSS viewports:

```text
Desktop  1440 × 1100
Tablet   1024 × 900
Phone     390 × 844
```

For each viewport it retains a PNG, rendered DOM, and JSON diagnostics and rejects page overflow, clipped primary controls, undersized primary controls, incorrect layout identity, a missing React application, or a missing critic component.

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

After deployment, separate workflows validate the real public HTML, Taskzen assets, responsive contract, worker contract, critic visual, and manifest:

```text
.github/workflows/verify-pages.yml
.github/workflows/verify-design-theme.yml
.github/workflows/ui-viewport-audit.yml
```

The gateway is independently container-deployable; GitHub Pages hosts only the browser application.

## Architecture documentation

- [`docs/architecture/DEPLOY_FIRST.md`](docs/architecture/DEPLOY_FIRST.md)
- [`docs/architecture/LOCAL_WORKSPACE.md`](docs/architecture/LOCAL_WORKSPACE.md)
- [`docs/architecture/ANALYSIS_GATEWAY.md`](docs/architecture/ANALYSIS_GATEWAY.md)
- [`docs/architecture/NO_BUILD_REACT.md`](docs/architecture/NO_BUILD_REACT.md)
- [`docs/architecture/TEMPORARY_CRITIC.md`](docs/architecture/TEMPORARY_CRITIC.md)
- [`docs/architecture/FRAMER_TASKZEN_VISUAL_SYSTEM.md`](docs/architecture/FRAMER_TASKZEN_VISUAL_SYSTEM.md)

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
5. Preserve provider independence through model and harness abstractions.
6. Treat evaluation, observability, security, and recovery as core architecture.
7. Require human approval for destructive, irreversible, financial, security-sensitive, or production-impacting operations.
8. Deploy a complete user-visible skeleton before replacing its internal seams.

No open-source license has been selected. Do not assume permission to copy, modify, or redistribute this repository's contents.
