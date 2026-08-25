# HarnessLab Interactive Learning Guide

## Purpose

HarnessLab is a technical product with a broad audience. The builder can produce useful architecture guidance, but the interface alone cannot teach every newcomer what a harness is, when an agent is justified, why temporary workers are different from A2A peers, or how a developer should turn the result into implementation work.

The learning guide creates a dedicated education layer without turning the primary workspace into a marketing page or interrupting the architect workflow.

## User experience

The main workspace exposes a compact **Learn HarnessLab** launcher near the top-right of the viewport. It is visually distinct from the light workspace, but it is smaller and less prominent than the primary architect action.

Opening the launcher presents three learning paths:

- **End-user path** — how to write, clarify, review, and save a harness requirement;
- **Developer path** — how to translate the result into layers, contracts, tests, and deployment boundaries;
- **Architecture path** — how to choose between software, workflows, agents, temporary subagents, MCP, retrieval, and A2A.

The full guide is deployed at:

```text
/guide/
```

## Presentation contract

The guide is a dependency-free dark web presentation with 18 chapters. It supports:

- previous and next controls;
- Arrow, Page Up, Page Down, Home, End, and Space navigation;
- slide hashes such as `#slide-15`;
- touch swipes;
- chapter overview;
- fullscreen mode;
- landscape printing;
- desktop, tablet, and phone layouts;
- reduced-motion preferences;
- focus trapping, Escape, inert background, and focus restoration in modal interfaces.

The guide uses no model, gateway, provider key, remote template source, external image, analytics SDK, or network request.

## Information architecture

1. HarnessLab overview
2. Plain-English and technical definition
3. Harness concept
4. Target audiences
5. End-to-end product journey
6. Requirement readiness and contradictions
7. Architecture decision ladder
8. Decision factors
9. Temporary-subagent lifecycle
10. Typed functions, MCP, retrieval, and A2A
11. System architecture
12. Context and artifact flow
13. Safety and permission model
14. Evaluation, evidence, and versioning
15. End-user playbook
16. Developer workflow
17. Worked anomaly-investigation example
18. Quick start and current live scope

## Scope disclosure

The guide distinguishes current behavior from intended platform direction. It must never imply that visual planning equals live model, tool, MCP, A2A, database, remote-worker, or production execution.

## Deployment

The existing GitHub Pages workflow publishes the entire `apps/web` directory, so the guide and learning hub deploy with the product. A dedicated post-deployment verifier checks the public entry point, all guide assets, slide count, key content, responsive CSS, and credential boundary.
