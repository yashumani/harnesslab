# Local Workspace Persistence

## Purpose

The deployed HarnessLab skeleton needs a durable user path before account, API, and database infrastructure exists. This slice persists project and harness-version metadata in the current browser while keeping the storage contract replaceable.

## User path

```text
Create or select project
  → generate harness plan
  → save immutable version
  → inspect version history
  → reopen a version
  → export workspace backup
```

## Data contract

The browser store uses the key `harnesslab.workspace.v1` and a versioned envelope:

```text
WorkspaceState
  schemaVersion
  updatedAt
  activeProjectId
  projects[]
    id
    name
    createdAt
    updatedAt
    runs[]
      id
      version
      savedAt
      requirement
      runId
      architecture
      score
      result
```

Saved result objects are deep-cloned before persistence so later in-memory changes cannot rewrite prior versions through application references. The UI exposes no edit-in-place behavior for saved versions.

## Reliability behavior

- Missing storage creates one starter project.
- Malformed or incompatible state is replaced with a valid starter workspace.
- Browser storage exceptions switch the session to an in-memory fallback.
- Each project retains at most 50 saved versions.
- Backups use a separate export envelope with type, schema version, and export timestamp.

## Security and privacy boundary

Browser storage is not an encrypted vault. It is visible to the current browser profile and may be inspectable by someone with access to the device. Requirements and exported backups must not contain credentials, secrets, or production data.

No account, cloud synchronization, server-side authorization, remote worker, live model, MCP server, or A2A peer is introduced by this slice.

## Replacement seam

The UI depends on a small workspace-store interface rather than direct `localStorage` calls:

```text
getSnapshot
getActiveProject
createProject
selectProject
saveRun
getRun
exportWorkspace
```

A later repository slice can implement the same use cases through the control-plane API and PostgreSQL. Migration will add server-generated identifiers, authenticated ownership, conflict handling, database migrations, encryption, and browser-to-cloud import without changing the visible project/version workflow.
