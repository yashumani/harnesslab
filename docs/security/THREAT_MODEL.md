# Initial Threat Model

## Protected assets

User requirements, source code, credentials, tool permissions, model prompts, retrieved context, generated artifacts, execution traces, evaluation data, infrastructure configuration, and production environments.

## Trust boundaries

- browser to control-plane API;
- control plane to database, queue, and artifact storage;
- dispatcher to execution worker;
- worker to model provider;
- worker to MCP server or external tool;
- temporary subagent to compiled context and shared artifacts;
- CI workflow to repository and deployment environment.

## Priority threats

1. Prompt injection causing unauthorized tool use or data disclosure.
2. Over-privileged tools, workers, GitHub Apps, or model-provider credentials.
3. Cross-project or cross-tenant context leakage.
4. Untrusted code escaping its sandbox.
5. Recursive agent spawning, nonterminating loops, or resource exhaustion.
6. Malicious or malformed artifacts poisoning later agents or evaluations.
7. Secrets leaking through logs, traces, prompts, generated files, or CI artifacts.
8. Supply-chain compromise in dependencies, Actions, containers, models, or MCP servers.
9. Incorrect evaluator confidence allowing unsafe or unsupported results.
10. Autonomous modification of security controls, deployments, or repository administration.

## Baseline controls

Least privilege, explicit allowlists, tenant isolation, sandboxing, structured schemas, input and output validation, human approval gates, immutable audit events, time and budget limits, failure-safe defaults, secret scanning, dependency review, code review, and continuous adversarial evaluations.
