# HarnessLab

HarnessLab is an AI-assisted agent harness builder and adaptive swarm runtime for designing, validating, running, and evolving durable agent systems.

> **Agents are disposable. Harnesses are durable. Knowledge is retained as structured artifacts.**

## Current deployed slice

HarnessLab follows a **deploy-first development cycle**. The deployed static application accepts an agent-use-case requirement and returns a deterministic harness blueprint containing:

- requirement interpretation and architecture selection;
- workflow, single-agent, or temporary-subagent guidance;
- MCP, A2A, retrieval, and function-tool recommendations;
- bounded temporary-agent contracts;
- permissions and approval gates;
- structured artifact identifiers;
- an execution trace and evaluation summary.

The second vertical slice adds a versioned browser workspace. Users can create projects, save immutable harness-plan versions, reopen earlier versions, and export a JSON backup. The storage adapter is intentionally isolated so a later control-plane API and PostgreSQL database can replace it without changing the user path.

The current slice is deliberately labeled as a deterministic demonstration. It does not execute a live model, MCP server, A2A peer, external tool, or remote worker. Browser project data is local to the current browser profile and must not be described as encrypted cloud storage or cross-device synchronization.

Expected deployment after GitHub Pages is configured for GitHub Actions:

```text
https://yashumani.github.io/harnesslab/
```

## Run locally

Requirements:

- Node.js 22 or newer for validation and tests;
- Python 3 for the zero-dependency local static server.

```bash
npm run check
npm run serve
```

Open:

```text
http://localhost:4173
```

No installation step, account, API key, model download, or paid service is required for the deployed skeleton.

## Test

```bash
npm test
npm run validate
```

The tests cover deterministic architecture routing, temporary-agent limits, approval gates, A2A decisions, artifact and trace contracts, workspace schema recovery, project selection, immutable version history, local persistence, storage failure fallback, retention limits, and backup export.

## Browser workspace boundary

Harness projects currently use a versioned `localStorage` adapter:

```text
Project
  → requirement
  → generated harness result
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

Every relevant push to `main` then runs `.github/workflows/deploy-pages.yml`.

See [`docs/architecture/DEPLOY_FIRST.md`](docs/architecture/DEPLOY_FIRST.md) for the replacement order from deterministic browser engine to provider-neutral API, PostgreSQL, temporary workers, evaluations, MCP, and selective A2A.

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

Repository governance, security boundaries, issue forms, architecture baselines, deploy-first CI, the interactive skeleton, and durable local project versions are developed through pull requests.

No open-source license has been selected yet. Do not assume permission to copy, modify, or redistribute this repository's contents.
