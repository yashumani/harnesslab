# AI Safety and Autonomy Boundaries

Autonomy is configured by capability rather than represented as a single on/off switch.

## Default policy

- Answering and recommendations: allowed.
- Read-only tools: allowed only when explicitly configured.
- Reversible writes: task-specific permission required.
- External communication: approval required by default.
- Destructive or irreversible actions: denied by default.
- Production deployment: human approval required.
- Financial transactions or paid-service activation: denied without explicit authorization.
- Secret access: minimum scope, never exposed to model-visible context unless unavoidable and approved.
- Code execution: sandbox only.
- Subagent spawning: bounded by count, depth, parallelism, time, model calls, and cost.

## Failure behavior

When a requested action is unavailable or prohibited, the agent must identify the constraint, preserve completed safe work, attempt approved alternatives, return partial results when useful, and clearly state unresolved limitations. It must not bypass the control to satisfy the objective.
