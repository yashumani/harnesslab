# Deploy-first development contract

HarnessLab uses a deploy-first cycle: establish a complete user-visible path, deploy it, validate the path, and then replace simulated seams with production components one at a time.

## First deployed vertical slice

```text
Browser requirement
       ↓
Deterministic requirement classifier
       ↓
Harness topology recommendation
       ↓
Bounded temporary-subagent plan
       ↓
Permission and lifecycle matrix
       ↓
Structured artifacts
       ↓
Trace and evaluation result
```

The first slice is intentionally static and has no secrets, hosted model, database, tool execution, MCP connection, A2A connection, or remote worker. It proves the interaction model, output contract, repository-relative deployment, CI, and observable decision flow before those dependencies are introduced.

## Why this is end to end

The slice starts with an actual user requirement and ends with a structured harness artifact rendered in the browser. The same pure `analyzeRequirement` contract is consumed by the interface and automated tests. The deployed result therefore validates the full product path while remaining deterministic and free to operate.

It does **not** claim that a live model or agent has executed. Every visible surface labels the current runtime as a deterministic demo.

## Replacement seams

The deployed application should remain usable while these seams are replaced in order:

1. **Requirement engine:** replace deterministic classification with a provider-neutral API that can call Ollama or OpenRouter and validate the same result schema.
2. **Persistence:** store projects, requirement specifications, harness versions, and traces in PostgreSQL while retaining browser resilience.
3. **Worker runtime:** replace planned temporary agents with queue-backed, timeout-bound workers that receive isolated context and return typed artifacts.
4. **Evaluator:** execute schema, policy, correctness, and evidence checks against real worker artifacts.
5. **Tool layer:** add typed internal functions first, then MCP adapters where standardization adds value.
6. **A2A:** add only for independent agents across an actual trust or ownership boundary.
7. **Deployment:** move the control plane and execution plane to suitable services while the static web experience remains continuously deployable.

## Deployment path

The static application lives in `apps/web` and is deployed by `.github/workflows/deploy-pages.yml` on each relevant push to `main`.

GitHub Pages requires one repository administrator action before the first deployment:

```text
Settings → Pages → Build and deployment → Source → GitHub Actions
```

After that setting is active, the workflow validates the application, uploads only `apps/web`, creates or reuses the `github-pages` environment, and deploys the artifact.

Expected public address:

```text
https://yashumani.github.io/harnesslab/
```

## Definition of a deploy-first slice

Every subsequent slice must:

- begin with a user-observable behavior;
- include the complete path needed to demonstrate that behavior;
- preserve explicit simulated-versus-live boundaries;
- include automated tests and failure behavior;
- deploy before deeper optimization begins;
- record the next seam to replace;
- avoid credentials, paid services, production writes, or destructive actions unless separately approved.
