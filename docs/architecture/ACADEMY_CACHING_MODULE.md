# HarnessLab Academy — Module 1 caching curriculum

## Purpose

Module 1 turns the supplied **Chat Caching, Prompt Caching, and KV Caching** curriculum into a durable, interactive learning experience at:

```text
/academy/caching/
```

The module is educational. It adds no model authority, tool execution, credential handling, analytics, database write, or external runtime call.

## Source policy

The supplied module is the canonical source for:

- terminology;
- chapter order;
- mental models;
- equations and examples;
- BI architecture guidance;
- invalidation and observability principles;
- the practical experiment sequence.

Provider-specific API behavior, pricing multipliers, cache lifetimes, usage fields, and minimum-token thresholds are time-sensitive. They are verified against official provider documentation before publication and labeled with the verification date.

One material correction is retained in the UI: the supplied draft describes a fixed 1,024-token minimum for GPT-5.6. Current OpenAI documentation states that the minimum cacheable length varies by model, so the published lesson does not present 1,024 as a universal current threshold.

## Experience architecture

```text
Learn HarnessLab hub
        ↓
Module 1 route
        ↓
16 navigable chapters
        ├─ cache-mechanism selector
        ├─ KV-growth visualizer
        ├─ KV-memory calculator
        ├─ prompt-order lab
        ├─ prompt-cache economics calculator
        ├─ copyable implementation examples
        ├─ experiment plan
        └─ five-question knowledge check
```

Progress is stored only as optional browser-local UI state. The curriculum remains fully usable when storage is unavailable.

## Security and privacy boundary

The module has a restrictive Content Security Policy:

```text
connect-src 'none'
```

It contains no provider API key field, telemetry SDK, analytics request, remote font, remote artwork, model request, or hidden service call. Official documentation links are ordinary user-initiated top-level navigation.

## Responsive contract

The module is validated at:

- desktop: 1440 × 1000;
- phone: 390 × 844.

The document must have zero horizontal page overflow, zero clipped primary controls, a complete 16-chapter DOM, visible focus states, and reduced-motion behavior.

## Evolution

Later Academy modules can reuse the route structure and validation pattern while keeping content independent. The next planned curriculum topic is **Context, Conversation State, Memory, and Compaction**.
