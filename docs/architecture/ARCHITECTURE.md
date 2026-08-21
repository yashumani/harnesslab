# HarnessLab Architecture

## System shape

HarnessLab separates a durable control plane from replaceable execution workers.

```text
Web UI
  -> Control-plane API
      -> Harness intelligence engines
      -> Orchestrator and task state
      -> PostgreSQL / queue / artifact metadata
      -> Execution dispatcher
          -> Registered sandboxed workers
              -> Temporary subagents
              -> Model router
                  -> Ollama
                  -> OpenRouter
                  -> Future providers
              -> MCP and approved tools
      -> Evaluator / judge
      -> Tracing, metrics, and learning
```

## Core components

- **Requirement engine:** converts natural language and documents into a structured requirement model.
- **Architecture designer:** chooses deterministic, workflow, single-agent, or multi-agent patterns.
- **Policy engine:** defines permissions, approvals, limits, budgets, and prohibited actions.
- **Context compiler:** gives each worker only necessary instructions, policies, artifacts, and tools.
- **Adaptive subagent controller:** decides whether, how many, and which temporary workers to spawn.
- **Artifact store:** retains typed, versioned outputs rather than relying on conversational memory.
- **Evaluator:** checks completeness, correctness, evidence, policy compliance, and confidence.
- **Model router:** selects providers and models by capability, availability, privacy, latency, and cost.
- **Observability layer:** captures traces, tool events, metrics, evaluation outcomes, and failure causes.

## Deployment direction

GitHub is the source of truth. Local Docker Compose is the first complete environment. A hosted control plane and registered Docker execution workers will be introduced after the vertical slice is validated.
