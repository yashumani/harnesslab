# Contributing to HarnessLab

HarnessLab is currently in foundation development. All changes after repository initialization must use a short-lived branch and pull request.

## Workflow

1. Start from the latest `main`.
2. Use a branch such as `feat/...`, `fix/...`, `docs/...`, `chore/...`, `security/...`, or `experiment/...`.
3. Link the change to an issue whenever practical.
4. Keep the pull request focused on one testable product slice.
5. Run all relevant checks and document evidence in the pull request.
6. Use squash merging after required checks and review conditions pass.

## Required quality

Changes must include appropriate tests or a clear explanation of why tests are not applicable. Architecture, security, permissions, data handling, model routing, and runtime-limit changes must update the corresponding documentation.

## Secrets and data

Never commit credentials, tokens, private keys, production data, user conversations, model traces containing sensitive content, or local `.env` files.

## Commit style

Use clear imperative commit subjects, preferably following Conventional Commits, for example `feat: add structured harness schema`.
