# HarnessLab

HarnessLab is an AI-assisted agent harness builder and adaptive swarm runtime for designing, validating, running, and evolving durable agent systems.

> **Agents are disposable. Harnesses are durable. Knowledge is retained as structured artifacts.**

## Status

HarnessLab is in initial architecture and repository-foundation development. The first milestone is an executable vertical slice that converts a natural-language agent requirement into a structured harness specification, delegates one bounded task to a temporary subagent, evaluates its artifact, and exposes the execution trace.

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

## Repository

The repository is being established with issue forms, contribution guidance, agent-development boundaries, security guidance, and an architecture roadmap before application implementation begins.

No open-source license has been selected yet. Do not assume permission to copy, modify, or redistribute this repository's contents.
