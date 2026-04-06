# Design Review Checklist

Unified PR review flow combining all four design lenses. Run in order — each lens builds on the previous.

---

## When to Use

- **Every PR** that touches views, components, or styles
- **Quick pass** (5 min): Lenses 1 + 4 only (Regenerative + Compliance)
- **Full pass** (15 min): All four lenses in order
- **New view/feature**: Full pass + Paradigm Validation (bottom of this file)

---

## Lens 1: Regenerative Design

> Does this design regenerate or extract?

| # | Check | Pass | Fix if Fail |
|---|-------|------|-------------|
| 1.1 | **Value flow visible?** Member can trace how their action connects to the system | | Add context: "Your capture → agent draft → coop review → shared knowledge" |
| 1.2 | **Succession-appropriate?** Feature complexity matches coop maturity | | Use progressive disclosure — hide advanced controls behind expansion |
| 1.3 | **Edge-enriched?** If at a stakeholder boundary, designed for bidirectional learning | | Show agent reasoning alongside output, not just the output |
| 1.4 | **Failure as succession?** Error/empty/rejection states guide toward renewal | | Replace "No results" with "Here's how to get started." Replace rejection with reasoning |
| 1.5 | **Growth-agnostic?** No engagement gamification, urgency, or FOMO | | Remove streak indicators, countdown timers, "X new since last visit" |
| 1.6 | **Capability-building?** Increases coop independence, not agent dependency | | Ask: "If the agent stopped, would this knowledge persist?" If no, redesign |
| 1.7 | **Regen aesthetic?** Warm Vellum material, not financial terminal | | Use cream/brown/green palette. Replace cold greys with warm tokens |
| 1.8 | **Observant, not surveillance?** Language feels curious, not aggressive | | Use "noticed" not "tracked". "Suggestion" not "alert" for agent output |

---

## Lens 2: Spatial Readiness

> Does this design use depth and material intentionally?

| # | Check | Pass | Fix if Fail |
|---|-------|------|-------------|
| 2.1 | **Paradigm declared?** Surface type chosen | | Choose: Command / Ambient / Data Landscape / Conversational / Ritual |
| 2.2 | **Material appropriate?** Material matches content density | | Text-dense → Parchment. Cards → Vellum. Status → Gauze. See `materials.md` |
| 2.3 | **Depth hierarchy?** Z-axis used for information priority | | Primary at Z2 (cards). Contextual at Z1 (ground). Alerts at Z3+. See `spatial.md` |
| 2.4 | **Hit targets >= 44px?** All interactive elements large enough | | Increase padding. Buttons: `min-height: 44px`. Badge clicks: add padding |
| 2.5 | **Progressive disclosure?** Information layers: glance → scan → engage → deep dive | | Surface summary first. Details on expand. Full data in separate section |
| 2.6 | **Works in popup (400px)?** Component functions at narrow width | | Test at 400px. Use `max-width: 100%` on wide elements |
| 2.7 | **Works in sidepanel (variable)?** Component adapts to container | | Use percentage/flex widths, not fixed px. Consider container queries |
| 2.8 | **Motion respects reduced-motion?** Animations degrade gracefully | | Wrap in `@media (prefers-reduced-motion: no-preference)` |

---

## Lens 3: Ecosystem Awareness

> Whose experience composes with whose?

| # | Check | Pass | Fix if Fail |
|---|-------|------|-------------|
| 3.1 | **Archetypes mapped?** Can name at least 3 archetypes this surface serves | | Review archetypes in `ecosystem.md`. A draft seen by member, operator, and agent has different needs |
| 3.2 | **Cascade visible?** Governing actions show blast radius before confirmation | | Add: "This affects N members" or "Agent uses 47 entities from this source" before destructive actions |
| 3.3 | **Autonomic actors surfaced?** Agent/sync/contract state visible | | Show heartbeat, sync badges, entity counts — not hidden behind "loading" |
| 3.4 | **Surrogate marked?** Agent-generated content clearly attributed | | Provenance badge shows "agent insight". Sourced from section shows specific references |
| 3.5 | **Serial chain visible?** If entity flows through multiple actors, position shown | | Show where in capture → draft → review → publish → archive chain this item sits |

---

## Lens 4: Compliance & Accessibility

> Does this meet WCAG 2.1 AA and Coop standards?

| # | Check | Pass | Fix if Fail |
|---|-------|------|-------------|
| 4.1 | **Labels on all inputs?** Every form field has visible or sr-only label | | Add `<label>` or `aria-label`. Never rely on placeholder alone |
| 4.2 | **Error associations?** Errors linked via `aria-describedby` | | Add `id` to error message, `aria-describedby` to input |
| 4.3 | **Color not sole indicator?** State conveyed through icon + color + text | | Add icon or text alongside color. Never color alone (WCAG 1.4.1) |
| 4.4 | **Focus management?** Modals/popovers trap focus, dismissal returns it | | Use existing Tooltip component pattern. Add focus trap for custom overlays |
| 4.5 | **Keyboard navigable?** All actions reachable without mouse | | Test with Tab/Shift+Tab/Enter/Escape |
| 4.6 | **Dark mode tested?** Component renders correctly in both themes | | Check contrast ratios in dark mode. Ensure warm tones persist |
| 4.7 | **Responsive tested?** Works at 400px (popup) and variable width (sidepanel) | | Test at multiple widths. Use container queries where applicable |
| 4.8 | **Existing components reused?** Not duplicating `global.css` patterns | | Check CLAUDE.md component list. Reuse `.panel-card`, `.badge`, `.badge-row`, etc. |
| 4.9 | **Token discipline?** Using `var(--coop-*)` tokens, not hardcoded colors | | Replace hex values with CSS custom properties from `tokens.css` |
| 4.10 | **Offline state handled?** Component degrades gracefully without connectivity | | Show cached data with freshness indicator. Queue actions for sync |

---

## Paradigm Decision Matrix

Use when starting a new view or refactoring an existing one.

```
Q1: Is this a primary action area where the user DOES things?
    → Yes: Command Surface (Parchment, high contrast, controls visible)
    → No: Q2

Q2: Is this monitoring/status that the user GLANCES at?
    → Yes: Ambient Display (Gauze/Linen, peripheral, never demands attention)
    → No: Q3

Q3: Is this data exploration — history, traces, comparisons?
    → Yes: Data Landscape (Vellum, variable density, overview-to-detail)
    → No: Q4

Q4: Is this agent/guidance interaction?
    → Yes: Conversational (Vellum/Parchment, minimal chrome, content-forward)
    → No: Default to Command Surface
```

---

## Review Order Summary

```
1. REGENERATIVE (Lens 1) — Is this design aligned with regen principles?
   ↓ Catches: gamification, extraction patterns, degen aesthetics, surveillance language
2. SPATIAL (Lens 2) — Is depth/material used intentionally?
   ↓ Catches: flat/generic UI, missing progressive disclosure, popup overflow
3. ECOSYSTEM (Lens 3) — Does this consider multi-user/agent cascades?
   ↓ Catches: hidden agent state, missing cascade warnings, unmarked surrogates
4. COMPLIANCE (Lens 4) — Does this meet a11y/responsive/token standards?
   ↓ Catches: accessibility violations, hardcoded colors, component duplication
```
