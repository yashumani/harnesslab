# NeuroNest-Inspired HarnessLab Visual System

## Reference

The visual direction was informed by the Dribbble case study:

- **NeuroNest — Startup LLM AI SaaS Tool Dashboard Design**
- LAIN UI/UX for LAIN
- https://dribbble.com/shots/26288457-NeuroNest-Startup-LLM-AI-SaaS-Tool-Dashboard-Design

The reference describes a dark, modular AI command center with centralized statistics, quick-launch actions, a dynamic response sidebar, clear data blocks for prompts/agents/flows/documents, and restrained accent colors.

## Original-implementation boundary

HarnessLab does not copy or embed the Dribbble image, source file, illustration, icon set, component geometry, or proprietary asset. The implementation translates only high-level product-design principles into an original theme over HarnessLab's existing functional component system.

The source-derived ideas are:

1. A calm, grounded dark workspace rather than a saturated gaming interface.
2. Compact navigation that preserves orientation without dominating the work area.
3. Modular cards that make complex agent-system information scannable.
4. A prominent quick-launch area for the primary architecture action.
5. A dedicated right-side intelligence surface for temporary-agent feedback.
6. Small, deliberate accent families rather than one accent applied everywhere.

## HarnessLab interpretation

HarnessLab maps those ideas to its own product model:

| Reference principle | HarnessLab implementation |
|---|---|
| Modular AI command center | Floating navigation, detached top bar, card-based workspace, and tabbed evidence views |
| Central AI statistics | Complexity, risk, confidence, and temporary-agent KPI cards |
| Quick launch | Architect call-to-action, requirement composer, and runtime-mode cards |
| Dynamic response sidebar | Bounded Architecture Critic launcher and drawer |
| Agent/workflow/data blocks | Architecture map, protocol cards, worker cards, permission matrix, trace, and artifacts |
| Restrained accents | Lavender, sage, warm yellow, soft rose, and neutral charcoal |

## Palette

The theme uses an adapted palette influenced by the reference's published color family:

```text
Canvas            #070707
Raised surface    #121214
Lavender          #CCB8EB
Sage              #B8D2AC
Warm yellow       #F9E893
Soft neutral      #D9DBDD
Muted text        #9EA2A6
Soft rose         #E7A5B5
```

Colors are assigned semantically:

- **Lavender:** architecture, routing, orchestration, and selected navigation.
- **Sage:** validated, connected, allowed, and evidence-positive states.
- **Warm yellow:** primary actions, attention, approval, and quick-launch emphasis.
- **Soft rose:** denied, high-risk, or failed states.
- **Neutral charcoal:** durable workspace surfaces and long-session readability.

## Layering model

The visual implementation is a non-destructive theme layer:

```text
react-app.css
    ↓ functional layout and component contracts
neuronest-theme.css
    ↓ original visual adaptation and responsive refinements
React components / gateway / workers
    ↓ unchanged functional behavior
```

This separation keeps the visual system replaceable without rewriting the agent, workspace, runtime, or evidence contracts.

## Responsive behavior

- Desktop keeps the floating left navigation, detached top bar, two-column mission area, and modular workspace panels.
- Medium widths collapse the mission and workspace layouts while retaining the card hierarchy.
- Tablet/mobile returns the main content to a full-width canvas and preserves the existing navigation drawer.
- All focus-visible behavior remains explicit.
- Reduced-motion preferences disable decorative motion and retain readable state changes.

## Asset policy

The theme contains no remote background image, Dribbble CDN reference, embedded screenshot, base64 artwork, copied icon, or downloaded template file. The only external browser dependencies remain the existing pinned React, ReactDOM, and HTM runtime files.
