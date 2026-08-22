# HarnessLab Anomaly-Product UI System

## Source of truth

HarnessLab’s visual shell is derived from the product-owned repository:

```text
yashumani/drill-down-anamoly
```

The implementation was reviewed from the active `main` branch, especially:

```text
src/AppShell.tsx
src/depo-inspired.css
src/final-enhancements.css
src/mobile.css
src/hierarchy.css
src/components/ThemePicker.tsx
src/data/palettes.ts
```

This is not a generic dashboard theme and is not based on the previously used NeuroNest/Dribbble layer. The active HarnessLab files are original, product-specific adaptations of the anomaly application’s own hierarchy, palette catalog, and responsive behavior.

## Shared product language

The two applications now share these design principles:

1. **Answer first.** The hero states the product outcome before exposing configuration.
2. **Presentation app bar.** Brand, primary destinations, and theme selection remain visible at the top.
3. **Hard-card hierarchy.** Three-pixel outlines, compact radii, offset shadows, and decisive signal colors make modules easy to scan.
4. **Compact control decks.** Inputs fit their content and remain grouped by task.
5. **Executive KPI blocks.** Important measures use distinct signal surfaces rather than visually identical cards.
6. **Progressive disclosure.** The main experience is approachable, while evidence, JSON, and advanced controls remain available.
7. **Palette portability.** The same 18 Editorial, Brand-inspired, and Executive palettes are available in both products.
8. **Phone-specific composition.** Mobile is not a scaled desktop. Navigation becomes a visible two-column destination grid, cards become single-column, and primary actions remain at least 44 pixels high.

## HarnessLab template mapping

| Anomaly product pattern | HarnessLab implementation |
|---|---|
| Presentation app bar | Brand, section destinations, and palette picker |
| Answer-first headline | Agent harness control-room hero |
| Make-it-yours action card | Current harness/run console |
| Workspace tabs | Harness result tabs and section navigation |
| Executive metrics | Complexity, risk, confidence, and temporary-agent counts |
| Compact filter deck | Provider-neutral runtime controls |
| Slide/page progress | Design → Validate → Deploy → Observe → Improve strip |
| AI response side panel | Bounded Temporary Architecture Critic drawer |
| Analyst evidence | Trace, evaluations, artifacts, and JSON |

## Palette catalog

HarnessLab uses the same palette identifiers and labels as the anomaly product:

### Editorial

- Paper (`midnight`)
- Ink (`slate`)
- Clay (`warm`)
- Mint (`light`)

### Brand-inspired

- Verizon
- AT&T
- T-Mobile
- NVIDIA
- Meta
- Google

### Executive

- CFO Navy
- Emerald
- Copper
- Royal
- Solar
- Arctic
- Plum
- Monochrome

The selected palette is stored only as a local palette identifier:

```text
harnesslab.anomaly-palette.v1
```

No provider key, project content, or external credential is stored by the theme system.

## Files

```text
apps/web/anomaly-shell.js
apps/web/anomaly-ui.css
apps/web/anomaly-mobile.css
```

`anomaly-shell.js` owns:

- palette definitions;
- local palette persistence;
- theme-color updates;
- desktop/tablet/phone layout metadata;
- theme picker rendering;
- development-cycle status strip;
- optional browser viewport audit.

`anomaly-ui.css` owns the shared desktop/tablet visual system.

`anomaly-mobile.css` is imported last and owns phone-specific composition.

## Functional boundary

The redesign does not change:

- deterministic analysis;
- the HarnessResult contract;
- provider-neutral gateway behavior;
- Ollama or free-only OpenRouter routing;
- the temporary-critic worker contract;
- permissions, denial rules, or approval gates;
- browser credential boundaries;
- workspace persistence and export formats.

## Responsive acceptance contract

The release is checked at:

```text
Desktop: 1440 × 1100
Tablet:  1024 × 900
Phone:    390 × 844
```

At each viewport, automated browser checks require:

- no horizontal page overflow;
- no clipped visible primary control;
- no visible primary control smaller than the defined interaction boundary;
- a complete React mount;
- a mounted palette picker;
- a visible development-cycle strip;
- the current theme and layout metadata;
- no browser provider credential construction.

Screenshots from all three viewports are retained as GitHub Actions artifacts for review.

## Development cycle

The visual cycle communicates the same deploy-first operating model used by the repository:

```text
Design → Validate → Deploy → Observe → Improve
```

It is presentation metadata only. It does not grant deployment authority or run work independently.
