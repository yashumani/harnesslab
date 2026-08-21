# GitHub Repository Settings Runbook

This file records settings that require repository-administrator access in the GitHub interface or an administration-capable API.

## Repository profile

- Decide whether the repository remains public or becomes private before proprietary implementation expands.
- Description: `AI-assisted agent harness builder and adaptive swarm runtime for designing, validating, running, and evolving durable agent systems.`
- Enable Issues and Projects.
- Disable Wiki and Discussions initially.
- Do not select an open-source license until the licensing model is decided.

## Pull requests

- Enable squash merging only.
- Disable merge commits and rebase merging.
- Use pull-request title and description for the squash commit.
- Enable automatic branch deletion.
- Enable automatic branch-update suggestions.
- Enable auto-merge, while keeping required checks and reviews authoritative.

## Main-branch ruleset

After `CI / required` has run successfully:

- require a pull request;
- require `CI / required`;
- require branches to be up to date;
- require conversation resolution;
- block force pushes and deletion;
- require linear history;
- use zero required approvals during solo bootstrap, then increase to one when a second human reviewer or separately identified development bot exists;
- do not grant the development agent bypass rights.

## Actions

- Default `GITHUB_TOKEN` to read-only.
- Do not allow Actions to approve pull requests.
- Require approval for workflows from all external fork contributors.
- Do not send secrets or write tokens to fork workflows.
- Use GitHub-hosted runners initially.

## Security

Enable dependency graph, Dependabot alerts and security updates, secret scanning, push protection, private vulnerability reporting, and CodeQL for Python and JavaScript/TypeScript when application code exists.

## Environments

Create `staging` and `production` only when deployment workflows exist. Keep production secrets environment-scoped and require human approval for production deployment.

## Not automated by the initial repository commit

Visibility, merge-method switches, rulesets, Actions permissions, Advanced Security switches, environments, secrets, collaborators, topics, repository description, milestones, labels, and Projects must be configured through GitHub administration interfaces or an appropriately scoped GitHub App.
