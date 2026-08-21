# ADR 0001: Foundational HarnessLab Principles

- Status: Accepted
- Date: 2026-08-21

## Decision

HarnessLab will be designed around these rules:

1. Agents are disposable; harnesses are durable.
2. Knowledge is retained as validated structured artifacts, not as unbounded chat history.
3. Permanent architecture may use temporary intelligence spawned on demand.
4. Temporary agents receive minimal context and least privilege.
5. Spawn intelligence only when expected quality, speed, coverage, or verification benefit exceeds added cost and complexity.
6. Start deterministic and introduce agentic decisions only where uncertainty requires them.
7. Models and providers are replaceable workers behind a capability-aware abstraction.
8. Evaluation, observability, failure recovery, security, and human approvals are part of the harness definition.

## Consequences

The runtime must support typed artifacts, context compilation, policy-aware tool access, adaptive parallelism, resource limits, provider routing, evaluators, and traceable harness revisions. The product must also explain why an agent, workflow, MCP integration, A2A relationship, or deterministic component was selected.
