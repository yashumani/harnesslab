# Harness Specification

The harness specification is the durable, versioned blueprint from which execution, simulation, evaluation, and code generation are derived.

## Required domains

```yaml
metadata: {}
objective: {}
success_criteria: []
inputs: []
outputs: []
roles: []
topology: {}
context_policy: {}
tools: []
integrations: []
permissions: {}
human_approvals: []
state: {}
artifacts: []
model_routing: {}
execution_limits: {}
failure_policy: {}
evaluation_plan: {}
observability: {}
deployment: {}
```

## Temporary subagent contract

Every temporary worker must have:

- a unique task identifier;
- a bounded objective and explicit completion condition;
- minimal compiled context;
- an allowlist of tools and data sources;
- explicit read, write, and approval permissions;
- a timeout, concurrency slot, depth limit, model-call limit, and cost limit;
- a structured output schema;
- defined retry, fallback, cancellation, and escalation behavior;
- trace and artifact-retention rules.

## Versioning

A harness revision must record who or what proposed it, why it changed, evaluation evidence, compatibility impact, and rollback target.
