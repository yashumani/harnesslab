# No-Build React Command Center

## Decision

HarnessLab renders its GitHub Pages interface with React 18 and HTM directly in the browser. The deployed source under `apps/web` is the reviewed source: no bundler, JSX compiler, package installation, generated JavaScript bundle, or separate build artifact is required.

```text
index.html
  → pinned React UMD runtime
  → pinned ReactDOM UMD runtime
  → pinned HTM tagged-template runtime
  → app.js ES module
      ├─ deterministic engine
      ├─ provider-neutral analysis client
      └─ versioned workspace store
  → validated HarnessResult
  → React command-center views
```

## Why this slice uses no build

The deploy-first objective is to keep the public application independently useful while backend, provider, persistence, worker, MCP, and A2A seams evolve. Direct static deployment provides a small and auditable browser surface:

- the source committed to `apps/web` is the source GitHub Pages serves;
- there is no generated bundle to reproduce or review;
- browser deterministic mode works without an account, gateway, provider key, or model;
- the provider-neutral gateway remains an optional replacement seam;
- project history and saved HarnessResult artifacts remain compatible.

## Runtime dependencies

The HTML pins exact versions of:

- React `18.3.1`;
- ReactDOM `18.3.1`;
- HTM `3.1.1`.

The scripts are loaded from `unpkg.com`. The content-security policy restricts scripts to the application origin and that CDN. HarnessLab renders an explicit error if the pinned runtime cannot load.

## Preserved capabilities

The React visual layer calls the existing modules rather than reimplementing their rules:

- `engine.js` for deterministic harness planning;
- `analysis-client.js` for browser, automatic-fallback, and gateway-required modes;
- `workspace-store.js` for browser-local projects and immutable versions;
- the shared HarnessResult validator before gateway results are rendered or retained.

The command center presents architecture, protocol, temporary-agent, permission, artifact, trace, evaluation, project-history, provenance, and JSON views.

## Safety boundary

The visual layer does not execute temporary agents, tools, MCP servers, A2A peers, code, files, external writes, or production changes. Temporary-agent cards are explicitly labeled as planned rather than executed. The browser accepts no Ollama or OpenRouter credential and never constructs a provider authorization header.

## Deployment

The existing GitHub Pages workflow uploads `apps/web` directly. Relevant changes under `apps/web` trigger deployment after merge to `main`.

Expected route:

```text
https://yashumani.github.io/harnesslab/
```

## Future migration

A compiled frontend may later be justified by offline vendoring, code splitting, a larger component system, or stricter supply-chain requirements. Any migration must preserve the engine, analysis-client, workspace, result, permission, and trace contracts rather than moving control decisions into presentation components.
