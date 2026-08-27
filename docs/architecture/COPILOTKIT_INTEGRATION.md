# HarnessLab CopilotKit integration

## Decision

HarnessLab adopts CopilotKit v2 as the **interactive copilot layer**, not as the policy authority.

CopilotKit owns:

- Conversational requirement intake
- AG-UI run streaming
- Shared state between chat and the application
- Structured and generative UI surfaces
- Future human-in-the-loop approval rendering
- Future safe frontend navigation tools

HarnessLab remains authoritative for:

- Requirement-readiness evidence
- Contradiction detection
- Architecture selection
- Temporary-agent contracts
- Permissions and denied operations
- Protocol recommendations
- Retained artifacts and trace
- Result-schema validation
- Evaluation and failure boundaries

## Deploy-first architecture

```text
GitHub Pages /copilot/
        │
        │ CopilotKit React v2
        │ runtimeUrl
        ▼
Self-hosted CopilotKit runtime
        │
        │ AG-UI run
        ▼
HarnessLabDeterministicAgent
        │
        ├── compile recent user turns
        ├── analyzeRequirement()
        ├── assertHarnessResult()
        ├── STATE_SNAPSHOT
        └── streamed assistant summary
```

The first agent uses no model and no provider credential. It proves the complete CopilotKit conversation-to-state contract against the established deterministic engine.

## Why the runtime is required

CopilotKit's supported production path keeps agents and credentials behind a runtime. HarnessLab does not use `agents__unsafe_dev_only` or `selfManagedAgents` in the deployed client. The public static route therefore asks for a compatible runtime URL before enabling the chat.

A local deterministic runtime starts with:

```bash
npm install
npm run copilotkit:runtime
```

Default URL:

```text
http://127.0.0.1:8790/api/copilotkit
```

The runtime listens only on loopback by default and requires no provider key.

## Current boundaries

```text
Model calls              0
Provider keys            0
Server tools             0
Frontend mutating tools  0
Child-agent spawning     denied
MCP execution            denied
A2A execution            denied
External actions         denied
Production mutation      denied
Thread persistence       in-memory
```

The browser registers one future-facing frontend tool, `selectHarnessView`. It changes only the selected read-only artifact tab and cannot modify the harness or perform an external action.

## Next production seam

The next milestone can add a server-side model-backed architect behind the same CopilotKit runtime:

1. Keep deterministic `analyzeRequirement()` and `assertHarnessResult()` as mandatory gates.
2. Add Ollama as the local default model provider.
3. Add OpenRouter only through explicit free-only routes.
4. Expose read-only integrations as least-privilege server tools.
5. Render approval interrupts before any write-capable tool.
6. Persist authenticated thread state outside process memory.
7. Rate-limit and authenticate the runtime endpoint before public hosting.

No frontend change is required when replacing the deterministic custom agent with a compatible runtime agent that preserves the state contract.
