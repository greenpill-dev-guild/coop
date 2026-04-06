# Spatial Design — Depth in a Browser Extension

The Z-axis is a first-class dimension. Every element has a position on the Z-axis — a "distance" from the user. This creates natural hierarchy without borders or heavy color contrast.

Extension context: popup is a fixed 400px pane, sidepanel is variable width. Depth works through shadows, borders, and material opacity — not blur-heavy glass (which conflicts with Vellum's warm, tactile character).

## Z-Layer Model

```
Z-Layer Stack (Extension Context)
═══════════════════════════════════════
Z4: Overlay      → Modals, share menu, critical alerts
                    shadow-lg, solid parchment, highest z-index
Z3: Floating     → Tooltips, filter popovers, notification banner
                    shadow-md, vellum material, elevated
Z2: Surface      → Cards, draft entries, panel sections
                    shadow-sm or border, vellum material
Z1: Ground       → Tab content area, list backgrounds
                    No shadow, linen or gauze material
Z0: Substrate    → Extension chrome, browser frame
                    Not styled — the extension exists within it
```

### Mapping to Existing CSS

| Z-Layer | Coop CSS Class | Typical Element |
|---------|---------------|-----------------|
| Z0 | — | Browser chrome |
| Z1 | `.content-shell`, `.coop-shell` | Page/tab backgrounds |
| Z2 | `.panel-card`, `.draft-card` | Cards, list items |
| Z3 | `.filter-popover`, Tooltip component | Popovers, tooltips |
| Z4 | `dialog`, `.popup-screen` modals | Share menu, confirmations |

---

## Depth Through Warmth (Not Glass)

Green Goods uses backdrop-blur glass panes. Coop uses **warm material layering** — depth expressed through opacity, shadow, and border rather than frosted glass.

| Depth Cue | How Coop Uses It |
|-----------|------------------|
| **Shadow** | Subtle warm shadows. `box-shadow: 0 1px 3px rgba(79,46,31,0.08)` — brown-tinted, not grey |
| **Border** | `border: 1px solid var(--coop-mist)` at Z2. Stronger at Z3+. |
| **Opacity** | Lower layers more transparent (Gauze → Linen). Higher layers more opaque (Vellum → Parchment). |
| **Typography weight** | Higher Z-layers use bolder text. Z4 modals use `--coop-ink` for strong emphasis. |
| **Elevation gap** | Space between layers implies depth. Cards at Z2 have margin from Z1 ground. |

---

## Corner Philosophy

Scale rounding with element size. Coop uses `border-radius` from `tokens.css`:

| Element Size | Radius | Examples |
|-------------|--------|----------|
| Small (badges, tags) | `var(--radius-sm)` 4px | `.badge`, `.state-pill` |
| Medium (cards, inputs) | `var(--radius-md)` 8px | `.panel-card`, input fields |
| Large (panels, sections) | `var(--radius-lg)` 12px | `.draft-card`, collapsible sections |
| Full (modals, screens) | `var(--radius-xl)` 16px | Popup screens, share dialogs |

---

## Progressive Depth in Sidepanel

The sidepanel has room for layered depth. Content scrolls along the Z-axis conceptually:

```
┌────────────────────────────────────┐
│ Panel Header (Z3 — sticky, solid)  │ ← Always on top, parchment
├────────────────────────────────────┤
│ Tab Strip (Z2 — surface)           │ ← Active tab elevated
├────────────────────────────────────┤
│                                    │
│ Card at Z2 ┌──────────────────┐    │
│            │ Draft card       │    │ ← Vellum, slight shadow
│            │ with provenance  │    │
│            └──────────────────┘    │
│                                    │
│ Card at Z2 ┌──────────────────┐    │
│            │ Another card     │    │
│            └──────────────────┘    │
│                                    │
│ Recessed section at Z1             │ ← Linen, no shadow
│ ┌──────────────────────────────┐   │
│ │ Collapsible details          │   │
│ └──────────────────────────────┘   │
│                                    │
└────────────────────────────────────┘
```

---

## Popup Depth (Compressed)

The popup has limited vertical space. Depth is compressed — fewer layers, stronger contrast:

```
┌──────────────────────────────────┐
│ Header (Z3 — parchment, sticky)  │
├──────────────────────────────────┤
│ List item (Z2 — vellum)          │
│ List item (Z2 — vellum)          │
│ List item (Z2 — vellum)          │
├──────────────────────────────────┤
│ Action bar (Z3 — parchment)      │ ← Bottom-anchored actions
└──────────────────────────────────┘
```

Only Z1-Z3 in popup. Z4 (modals) appear infrequently and take over the full popup area.

---

## Depth Without Vision

The Z-layer model relies on visual cues. For users who cannot perceive these:

- **Semantic HTML**: Z4 overlays use `<dialog>`. Z3 uses Tooltip component with `role="tooltip"`.
- **Focus management**: Higher Z-layers trap focus. Lower layers are inert when overlaid.
- **Announcements**: `aria-live` regions for ambient displays (Z1-Z2) that update without user action.
- **Size and weight**: Higher Z-layers use larger text and heavier font weight.
- **Motion**: Respect `prefers-reduced-motion`. Depth transitions are opacity-only in reduced-motion mode.
