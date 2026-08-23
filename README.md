# HarnessLab

HarnessLab is an AI-assisted agent harness builder and adaptive temporary-agent runtime for designing, validating, running, and evolving durable agent systems.

> **Agents are disposable. Harnesses are durable. Knowledge is retained as structured artifacts.**

## Live application

```text
https://yashumani.github.io/harnesslab/
```

The deployed application follows a deploy-first path:

```text
Requirement
  → architecture decision
  → bounded agent plan
  → permissions and protocol guidance
  → artifacts, trace, and evaluation
  → optional executed Architecture Critic
  → immutable saved version
```

The browser application uses pinned React, ReactDOM, and HTM directly. There is no bundler, JSX compiler, generated browser bundle, package installation, or browser provider credential.

## Current public experience

The live site includes:

- deterministic requirement interpretation and architecture selection;
- workflow, single-agent, or adaptive temporary-subagent recommendations;
- MCP, A2A, retrieval, and typed-function guidance;
- capability-level permissions, approval gates, and denied actions;
- bounded planned-agent contracts;
- structured artifacts, execution traces, and evaluation evidence;
- browser-local projects and immutable harness versions;
- restore, backup, copy, download, and JSON export;
- browser, automatic-fallback, and gateway-required analysis modes;
- one executable bounded **Temporary Architecture Critic**;
- provider-neutral gateway adapters for deterministic analysis, Ollama, and free-only OpenRouter.

The Taskzen-inspired product interface is an original HarnessLab implementation based only on high-level SaaS layout principles from the free Framer template. No Framer project, template source, screenshot, illustration, icon pack, or proprietary asset is copied into the repository. See [`docs/architecture/FRAMER_TASKZEN_VISUAL_SYSTEM.md`](docs/architecture/FRAMER_TASKZEN_VISUAL_SYSTEM.md).

## Executed temporary Architecture Critic

The critic has two execution paths behind one validated worker contract.

### Browser deterministic

This is the default public path:

```text
HarnessResult
  → browser-local minimum-context compiler
  → one deterministic critic invocation
  → typed TemporaryAgentReview
  → deterministic finding acceptance
  → retained artifact, trace, and evaluation update
```

It requires:

```text
No account
No API key
No model
No gateway
No paid service
No network request for critique
```

### Gateway backed

Select **Automatic** or **Gateway required** to use the separately running HarnessLab gateway. The gateway may execute the same critic contract through:

- the deterministic provider;
- an explicitly configured local Ollama model;
- `openrouter/free` or an explicit `:free` OpenRouter model.

Provider choice, model configuration, and credentials remain server-side. The browser sends only the validated harness result to `POST /v1/critique`.

### Non-negotiable worker limits

```text
Temporary workers per request: 1
Bounded critic invocations:     1
Maximum context:                48 KiB
Tools:                          none
Child-agent spawning:           denied
External actions:               denied
MCP execution:                  denied
A2A execution:                  denied
Code, files, and databases:     unavailable
```

The minimum context contains only the requirement, scores, architecture, protocol recommendations, permissions, constraints, unresolved questions, bounded planned-agent summaries, artifacts, evaluation, and fixed worker policy. It excludes provider credentials, runtime secrets, tool handles, files, databases, MCP/A2A clients, deployment credentials, production data, and the full browser conversation.

A finding is applied only when it:

- satisfies the strict typed schema;
- has `medium` or `high` severity;
- has confidence of at least `0.70`.

Rejected findings remain in the review artifact. The critic cannot weaken permissions, denied actions, approval requirements, stages, protocols, safety constraints, artifact requirements, evaluation, or traceability.

## Provider-neutral analysis gateway

```text
Browser
  ├─ deterministic planner
  ├─ browser-local deterministic critic
  └─ optional HarnessLab gateway
       ├─ deterministic provider
       ├─ explicitly configured Ollama provider
       └─ explicitly configured OpenRouter free-only provider
```

The gateway exposes:

```text
GET  /health
POST /v1/analyze
POST /v1/critique
```

The current release does not execute MCP tools, A2A peers, arbitrary code, files, databases, external writes, deployments, purchases, or production changes. Browser project data is local to the current browser profile and is not encrypted cloud storage or cross-device synchronization.

## Requirements

- Node.js 22 or newer for tests and the optional gateway;
- Python 3 for the dependency-free local static server;
- Docker only for the optional gateway container;
- Ollama only when explicitly selecting an installed local model;
- an OpenRouter account-created API key only when explicitly selecting the free-only OpenRouter provider.

No package installation is required for the current application.

## Run locally

```bash
npm run check
npm run serve
```

Open:

```text
http://127.0.0.1:4173
```

Browser mode can generate a harness plan and execute the deterministic critic without a gateway.

## Run the gateway

In another terminal:

```bash
npm run gateway
```

The safe default is the deterministic provider at:

```text
http://127.0.0.1:8787
```

Set that address in the browser, select **Automatic** or **Gateway required**, and test the connection.

### Worker limits

```bash
export HARNESSLAB_CRITIC_TIMEOUT_MS=20000
export HARNESSLAB_CRITIC_MAX_BODY_BYTES=262144
```

### Ollama

```bash
export HARNESSLAB_PROVIDER=ollama
export OLLAMA_BASE_URL=http://127.0.0.1:11434
export OLLAMA_DEFAULT_MODEL=<installed-local-model-name>
npm run gateway
```

Ollama may return bounded architecture guidance and one typed critic review. Deterministic HarnessLab controls remain authoritative.

### OpenRouter free-only

OpenRouter requires an account-created API key even for free routes. Keep it only in the gateway environment:

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

A paid or ambiguous model identifier is rejected at startup. There is no paid-model override, and the repository does not create an account, key, credit purchase, or live provider request automatically.

## Gateway container

```bash
docker build -f services/gateway/Dockerfile -t harnesslab-gateway .
docker run --rm -p 8787:8787 harnesslab-gateway
```

The container runs as a non-root user. Pass provider configuration at runtime; never bake credentials into the image.

## Validation

```bash
npm run check
```

The suite covers:

- deterministic architecture routing and planned-agent limits;
- permission, A2A, artifact, trace, and evaluation contracts;
- browser workspace recovery, immutable versions, retention, and backup export;
- shared harness-result and temporary-worker validation;
- browser analysis modes, gateway fallback, and gateway identity;
- browser-local critic execution with zero `fetch` calls;
- browser/gateway deterministic critic context and result parity;
- one-worker, one-invocation, no-tools, no-child, and no-external-action enforcement;
- strict critic parsing and deterministic finding acceptance;
- retained failure and timeout evidence;
- gateway CORS, request limits, timeouts, methods, and sanitized errors;
- bounded deterministic, Ollama, and free-only OpenRouter behavior;
- non-root gateway container build;
- exact desktop, tablet, and phone viewport audits;
- responsive navigation focus management and accessibility;
- public GitHub Pages asset and real-browser critic execution verification.

## Responsive QA

`UI Viewport Audit` renders the real no-build application with Chrome DevTools Protocol at:

```text
Desktop  1440 × 1100
Tablet   1024 × 900
Phone     390 × 844
```

It retains PNG, rendered DOM, console, and JSON evidence. The job rejects page overflow, clipped controls, undersized controls, incorrect layout identity, missing application/critic mounts, and broken responsive-drawer focus behavior.

## Deployment verification

`.github/workflows/deploy-pages.yml` validates and publishes only `apps/web`.

After deployment, `.github/workflows/verify-pages.yml`:

1. verifies the public HTML, visual assets, critic contracts, and browser credential boundary;
2. opens the public site in real Chromium;
3. runs the browser-local deterministic critic;
4. captures all network requests during the critic execution;
5. requires zero critic POST, gateway, Ollama, or OpenRouter requests;
6. verifies the retained review artifact, completion trace, and evaluation update.

The evidence is retained as a workflow artifact.

## Browser workspace boundary

Harness projects currently use versioned browser storage:

```text
Project
  → full requirement
  → validated HarnessResult
  → optional reviewed result
  → immutable saved version
  → local version history
  → optional JSON backup
```

Do not enter credentials, API keys, production data, or secrets. Exported backups can contain full requirements and review artifacts and should be handled as private files.

## Architecture documentation

- [`docs/architecture/DEPLOY_FIRST.md`](docs/architecture/DEPLOY_FIRST.md)
- [`docs/architecture/LOCAL_WORKSPACE.md`](docs/architecture/LOCAL_WORKSPACE.md)
- [`docs/architecture/ANALYSIS_GATEWAY.md`](docs/architecture/ANALYSIS_GATEWAY.md)
- [`docs/architecture/NO_BUILD_REACT.md`](docs/architecture/NO_BUILD_REACT.md)
- [`docs/architecture/TEMPORARY_CRITIC.md`](docs/architecture/TEMPORARY_CRITIC.md)
- [`docs/architecture/FRAMER_TASKZEN_VISUAL_SYSTEM.md`](docs/architecture/FRAMER_TASKZEN_VISUAL_SYSTEM.md)

## Foundational principles

1. Start deterministic; add agency only where uncertainty requires it.
2. Spawn temporary intelligence only when expected benefit exceeds cost and complexity.
3. Give every subagent minimum necessary context, tools, permissions, time, and budget.
4. Prefer structured artifacts over unbounded agent-to-agent conversation.
5. Preserve provider independence through model and harness abstractions.
6. Treat evaluation, observability, security, and recovery as core architecture.
7. Require human approval for destructive, irreversible, financial, security-sensitive, or production-impacting operations.
8. Deploy a complete user-visible slice before replacing its internal seams.

No open-source license has been selected. Do not assume permission to copy, modify, or redistribute this repository's contents.
