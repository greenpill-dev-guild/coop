# Implementation Bridge — Coop's CSS & Component System

Maps the design philosophy to Coop's actual implementation: plain CSS custom properties, class-based styling, and existing component patterns. No Tailwind, no Radix — Coop uses its own component vocabulary.

## Existing Infrastructure

| Feature | Status | File |
|---------|--------|------|
| Brand palette tokens | **Implemented** | `packages/shared/src/styles/tokens.css` |
| Dark mode overrides | **Implemented** | `tokens.css` (`prefers-color-scheme` + `[data-theme="dark"]`) |
| Accessibility styles | **Implemented** | `packages/shared/src/styles/a11y.css` |
| Component classes | **Implemented** | `packages/extension/src/global.css` |
| Entrance animation | **Implemented** | `@keyframes coop-rise` in `global.css` |
| Attention animation | **Implemented** | `@keyframes coop-wiggle` in `global.css` |
| Token lint script | **Implemented** | `scripts/lint-tokens.ts` |
| Storybook | **Not yet** | No Storybook setup in extension |
| View Transitions | **Not yet** | Could apply to tab switching |
| Container queries | **Not yet** | Not used but applicable to sidepanel cards |

---

## Component Vocabulary

These are the building blocks. Always check this list before creating new CSS classes:

### Cards
| Class | Z-Layer | Material | Use |
|-------|---------|----------|-----|
| `.panel-card` | Z2 | Vellum | Standard content container |
| `.panel-card.collapsible-card` | Z2 | Vellum | Expandable sections (Nest, operator console) |
| `.draft-card` | Z2 | Vellum | Draft review card in Chickens |
| `.artifact-card` | Z2 | Vellum | Published artifact in Coops |
| `.roost-hero-card` | Z2 | Parchment | Hero-sized cards in Roost |

### Badges & Pills
| Class | Use |
|-------|-----|
| `.badge` | Standard pill label (stage, category, provenance) |
| `.badge--neutral` | Muted variant for tags |
| `.badge-row` | Horizontal badge container |
| `.state-pill` | State indicator pill |
| `.popup-mini-pill` | Small pill in popup context |

### Buttons
| Class | Min Height | Use |
|-------|-----------|-----|
| `.primary-button` | 48px | Main actions (publish, approve) |
| `.secondary-button` | 38px | Secondary actions (save, polish) |
| `.ghost-button` | — | Subtle actions |
| `.inline-button` | — | Inline text-like buttons |
| `.popup-icon-button` | — | Icon buttons in popup header |

### Layout
| Class | Use |
|-------|-----|
| `.coop-shell` | Top-level grid shell |
| `.content-shell` | Main content area (1rem padding + gap) |
| `.panel-header` | Sticky header with blur backdrop |
| `.tab-strip` | Tab navigation strip |
| `.stack` | Vertical flex container |
| `.field-grid` | Label + input layout |
| `.action-row` | Horizontal action button row |
| `.detail-grid` | Two-column detail layout |

### Lists & Groups
| Class | Use |
|-------|-----|
| `.time-group` | Apple Finder-style time grouping |
| `.roost-activity-list` | Activity items in Roost |
| `.roost-activity-item` | Single activity row |
| `.operator-log-entry` | Log entry in operator console |
| `.popup-draft-list` | Draft list in popup |
| `.popup-draft-row` | Single draft row in popup |

### Status & Feedback
| Class | Use |
|-------|-----|
| `.skeleton`, `.skeleton-card`, `.skeleton-text` | Loading placeholders |
| `.helper-text` | Secondary descriptive text |
| `.meta-text` | Timestamp/secondary metadata |
| `.state-text` | Muted status text |
| `.filter-popover` | Category/filter dropdown |

---

## Token System

Source of truth: `packages/shared/src/styles/tokens.css`

### Palette Tokens
```css
--coop-cream: #fcf5ef;     /* Vellum base */
--coop-brown: #4f2e1f;     /* Primary text */
--coop-brown-soft: #6b4a36; /* Secondary text */
--coop-green: #5a7d10;     /* Knowledge/growth */
--coop-orange: #fd8a01;    /* Action/publish */
--coop-mist: #d8d4d0;      /* Neutral/linen */
--coop-ink: #27140e;        /* Deep emphasis */
--coop-error: #a63b20;      /* Error/destructive */
```

### Semantic Surface Tokens
```css
--surface: var(--coop-cream);        /* Z1-Z2 background */
--surface-alt: ...;                  /* Recessed/linen areas */
--text: var(--coop-brown);           /* Primary text */
--text-soft: var(--coop-brown-soft); /* Secondary text */
--border: var(--coop-mist);          /* Default borders */
```

### Spacing & Radius
```css
--radius-sm: 4px;   /* Badges, tags */
--radius-md: 8px;   /* Cards, inputs */
--radius-lg: 12px;  /* Large cards, sections */
--radius-xl: 16px;  /* Modals, screens */
```

---

## Material ↔ CSS Mapping

| Material | CSS Implementation |
|----------|-------------------|
| **Parchment** | `background: var(--coop-cream)` (solid) |
| **Vellum** | `.panel-card` (cream bg, border, slight shadow) |
| **Linen** | `background: var(--coop-mist)` or reduced opacity cream |
| **Gauze** | `opacity: 0.6` on `--coop-mist` background |
| **Glow** | Use glow brand assets (`coop-mark-glow.png`) for celebrations |

---

## New Components for Knowledge Sandbox

When building the knowledge sandbox UI (Section 10 of the exploration doc), these new CSS classes extend the existing vocabulary:

```css
/* Source provenance on draft cards */
.draft-card__provenance {
  border-top: 1px solid var(--coop-mist);
  padding-top: 0.75rem;
  margin-top: 0.5rem;
}
.draft-card__source-ref {
  font-size: 0.8125rem;
  color: var(--coop-brown-soft);
  padding-left: 1rem;
  position: relative;
}
.draft-card__source-ref::before {
  content: "·";
  position: absolute;
  left: 0.25rem;
}
.draft-card__track-record {
  font-size: 0.75rem;
  color: var(--coop-green);
  padding-left: 1rem;
}

/* Source cards in Nest */
.source-card { /* extends .operator-log-entry */ }
.source-card__health {
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--coop-green);
}
.source-card__health--stale { background: var(--coop-orange); }
.source-card__health--error { background: var(--coop-error); }

/* Topic knowledge bars in Roost */
.topic-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.topic-bar__fill {
  height: 6px;
  background: var(--coop-green);
  border-radius: var(--radius-sm);
  transition: width 300ms ease-out;
}

/* Source type icons */
.source-icon { width: 16px; height: 16px; opacity: 0.7; }
```

---

## Paradigm ↔ Existing Surface Mapping

| Surface | Paradigm | Primary CSS Classes | Material |
|---------|----------|-------------------|----------|
| Popup Home | Command | `.popup-screen`, `.popup-primary-action` | Parchment |
| Popup Draft List | Data Landscape | `.popup-draft-list`, `.popup-draft-row` | Vellum |
| Chickens Review | Data Landscape | `.draft-card`, `.badge-row`, `.time-group` | Vellum |
| Chickens Shared | Data Landscape | `.artifact-card` | Vellum |
| Roost Focus | Ambient | `.roost-hero-card`, `.roost-activity-list` | Parchment/Vellum |
| Roost Agent | Ambient/Data | `.roost-hero-card`, `.operator-log-entry` | Vellum |
| Roost Garden | Command | `.panel-card`, `.primary-button` | Parchment |
| Coops Tab | Data Landscape | `.artifact-card`, archive controls | Vellum |
| Nest Members | Command | `.panel-card`, `.collapsible-card` | Parchment |
| Nest Agent | Command | OperatorConsole sections | Parchment |
| Nest Settings | Command | `.collapsible-card`, `.field-grid` | Parchment |
| Nest Sources (new) | Command | `.collapsible-card`, `.source-card` | Parchment |
