# HarnessLab Product Requirements

## Vision

HarnessLab helps newcomers and experienced teams design, understand, validate, build, run, and evolve dependable AI-agent harnesses without binding the system to one model or provider.

## Primary user journey

1. The user describes an objective, systems, constraints, and success criteria.
2. The requirements engine extracts a structured requirement model and identifies gaps or contradictions.
3. The architecture engine decides whether the solution should be deterministic software, an LLM feature, a workflow, a single agent, or a multi-agent system.
4. The platform produces a versioned harness specification covering roles, topology, context, tools, permissions, state, limits, failures, evaluations, and observability.
5. A simulator and critic challenge the design.
6. The runtime may spawn bounded temporary subagents when parallelism or independent verification is beneficial.
7. Evaluators validate structured artifacts before the result is finalized.
8. Traces, metrics, failures, and evaluation outcomes improve future routing and harness revisions.

## V1 outcome

A user can create a project, submit a requirement, generate and inspect a harness specification, execute a bounded workflow with temporary subagents, review artifacts and traces, run evaluations, and export an implementation scaffold.

## Non-goals for the first release

- unrestricted autonomous operation;
- production access without explicit authorization;
- guaranteed prevention of model error;
- automatic paid-model or paid-infrastructure use;
- multi-agent complexity where a deterministic workflow is sufficient.
