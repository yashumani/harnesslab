# Framer Taskzen-Inspired HarnessLab Visual System

## Purpose

HarnessLab uses the high-level product-design patterns of the free **Taskzen** AI SaaS template on Framer as a reference for its browser experience:

- light professional SaaS presentation;
- focused product promise;
- real product UI as the hero visual;
- compact navigation;
- dashboard-oriented cards and status surfaces;
- deliberate desktop, tablet, and phone compositions;
- restrained motion and clear calls to action.

Reference:

```text
https://www.framer.com/community/marketplace/templates/taskzen/
```

This repository does **not** import, remix, or redistribute Framer template source. It includes no Taskzen screenshot, illustration, icon pack, Framer project, animation asset, proprietary component, or remote background asset. The implementation is original HarnessLab HTML, CSS, and JavaScript applied to existing product components.

## Product direction

The visual system deliberately replaces the earlier dark cyber command-center direction. HarnessLab should look like a credible B2B product used by architects, analysts, platform teams, and engineering leaders.

The interface follows these principles:

1. **Product before decoration.** The hero contains a working HarnessLab architecture preview rather than a generic illustration.
2. **One dominant action.** The primary action is generating a harness blueprint; secondary actions remain visually quieter.
3. **Calm information density.** White surfaces, soft gray separation, and restrained semantic accents support detailed technical content.
4. **Evidence stays visible.** Risk, confidence, permissions, traces, evaluations, and artifact provenance remain first-class UI regions.
5. **Responsive recomposition.** Phone layouts stack and simplify controls instead of shrinking the desktop arrangement.
6. **No credential theatre.** Provider keys never enter the static browser application.

## Semantic design tokens

```text
Canvas              #F7F8FC
Primary surface     #FFFFFF
Secondary surface   #F1F3F9
Primary text        #111827
Secondary text      #344054
Muted text          #667085
Primary accent      #635BFF
Secondary accent    #0E9384
Accent surface      #ECEBFF
Success             #12B76A
Warning             #F79009
Error               #D92D20
Border               #E4E7EC
```

The accent colors communicate meaning rather than decorating every panel:

- indigo: architecture, selected states, primary actions;
- teal: durable controls, context, and provider-neutral system boundaries;
- green: validated and allowed states;
- amber: approval, fallback, and planned-not-executed states;
- red: denied, failed, or unsafe states.

## Shell architecture

### Desktop

The desktop application uses a floating horizontal navigation bar above a contained product workspace. The navigation exposes all six product destinations without consuming a permanent left rail.

```text
Floating product navigation
        ↓
Compact run/status bar
        ↓
Product promise + real harness preview
        ↓
Workspace / runtime / architect
        ↓
Blueprint dashboard and evidence
```

### Tablet

At widths up to 1120 CSS pixels, the navigation becomes a left drawer opened from the compact application bar. Dashboard grids reduce from four columns to two or one according to information density.

### Phone

At widths up to 760 CSS pixels:

- hero content and product preview stack;
- primary and secondary actions span the available width;
- project and runtime controls become single-column modules;
- result tabs remain horizontally scrollable with 40-pixel minimum touch height;
- permission rows become labeled single-column cards;
- temporary-agent definitions retain all safety details;
- the Architecture Critic becomes a full-screen sheet;
- no important control depends on hover.

## Component mapping

| Product capability | Visual treatment |
|---|---|
| Mission | focused SaaS hero with real current-run preview |
| Project workspace | paired project and immutable-history cards |
| Runtime selection | three selectable provider-mode cards plus a bounded connection row |
| Requirement architect | prominent white input surface with one primary action |
| Complexity/risk/confidence/agents | compact dashboard KPI cards |
| Harness topology | horizontally inspectable stage cards |
| Protocol guidance | four recommendation cards with semantic decision states |
| Temporary agents | bounded contract cards, not personality profiles |
| Permissions | responsive policy table/cards |
| Trace and evaluation | evidence timeline plus score panel |
| Artifact blackboard | structured retained-artifact cards |
| Temporary critic | light side sheet using the same semantic system |

## Functional boundary

The visual replacement does not change:

- deterministic requirement interpretation;
- provider-neutral gateway behavior;
- Ollama or free-only OpenRouter enforcement;
- temporary-worker limits;
- permission and approval rules;
- artifact schemas;
- trace and evaluation contracts;
- project persistence;
- deployment authority;
- browser credential boundaries.

## Browser QA contract

`apps/web/taskzen-shell.js` labels the active responsive mode and, only when `?ui-audit=1` is supplied, measures:

- page-level horizontal overflow;
- clipped visible primary controls;
- undersized visible primary controls;
- React application mount;
- responsive mode identity;
- Taskzen design identity.

GitHub Actions renders and retains desktop, tablet, and phone screenshots and DOM evidence. A release cannot be represented as responsive until those audits pass.

## Deploy-first lifecycle

```text
Design
  → validate application and worker contracts
  → render desktop/tablet/phone evidence
  → merge through a pull request
  → deploy apps/web to GitHub Pages
  → verify the actual public assets
  → continue with the next product seam
```
