# AI Development Agent Policy

This file defines the default operating boundary for AI-assisted development in this repository.

## Allowed

An assigned development agent may read the repository, inspect linked issues, create a short-lived branch, modify files within the assigned scope, run local tests, commit changes, open or update a draft pull request, and report evidence and limitations.

## Required behavior

- Work from an explicit issue or clearly documented task.
- Preserve existing architecture decisions unless the task explicitly changes them.
- Use least privilege and minimum necessary context.
- Validate generated code, schemas, migrations, workflows, and configuration.
- Keep secrets out of prompts, logs, commits, artifacts, and test fixtures.
- Record tests run, failures, unresolved risks, and rollback considerations.
- Stop and escalate security, privacy, data-loss, paid-service, credential, repository-access, or foundational product decisions.

## Prohibited without explicit human approval

- pushing directly to `main`;
- merging or approving its own pull request;
- changing repository visibility, branch protection, Actions permissions, billing, or collaborators;
- accessing production data or secrets;
- deploying to production;
- deleting repositories, branches, environments, databases, storage, or infrastructure;
- weakening authentication, authorization, sandboxing, audit logging, policy checks, evaluation gates, or resource limits;
- adding a paid service, marketplace purchase, or model with nonzero cost;
- executing untrusted code outside an approved sandbox.

## Temporary-subagent rules

Temporary subagents must receive a bounded task, minimal context, explicit tools and permissions, a timeout, a call or cost budget, and a structured return schema. They may not recursively spawn additional agents unless the harness explicitly permits it. Their conversational state is disposable; validated artifacts and traces are retained according to policy.
