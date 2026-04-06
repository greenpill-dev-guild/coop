# Materials — The Vellum Language

Coop's material system is **Vellum** — warm, tactile, paper-like. Unlike Green Goods' glass-forward approach, Coop's design direction says "warm, not corporate." The cream/brown palette creates surfaces that feel inhabited, not clinical.

Materials are not decoration — they are information architecture. Opacity and texture communicate depth and importance.

## Material System

Five semantic materials mapped to Coop's existing token palette:

| Material | Background | Opacity | Use When | Cognitive Load |
|----------|-----------|---------|----------|----------------|
| **Parchment** | `--coop-cream` | 100% | Text-dense content, forms, command surfaces | Maximum — paragraphs, editors |
| **Vellum** | `--coop-cream` | 85% | Standard surfaces, cards, panels | High — titles, descriptions, controls |
| **Linen** | `--coop-mist` | 65% | Secondary context, recessed areas | Medium — short text, badges |
| **Gauze** | `--coop-mist` | 40% | Background layers, ambient indicators | Low — glanceable metrics only |
| **Breath** | transparent | 20% | Purely decorative, subtle dividers | Very low — no text content |

### Cognitive Load Rule

Match material to content density:

- **Parchment**: Mandatory for draft editors, forms, operator controls, any surface with paragraph text
- **Vellum**: Default for cards, panels, and list items. The workhorse material.
- **Linen**: Secondary panels, filter areas, settings sections. Always behind primary content.
- **Gauze**: Source health indicators, sync badges, ambient status. Never place readable text here.
- **Breath**: Subtle section dividers, background texture. Decorative only.

---

## Material ↔ Paradigm Mapping

| Paradigm | Primary Material | Token Implementation |
|----------|-----------------|---------------------|
| **Command Surface** | Parchment (solid cream) | `background: var(--coop-cream)` with visible border |
| **Ambient Display** | Gauze or Linen | `background: var(--coop-mist)` at reduced opacity |
| **Data Landscape** | Vellum | `.panel-card` with standard elevation |
| **Conversational** | Vellum or Parchment | Content-forward, minimal chrome |
| **Ritual** | Glow (orange/green radiance) | Glow mark assets, full-screen moments |

---

## Material ↔ Brand Mapping

The brand palette IS the material vocabulary:

| Brand Color | Material Role | CSS Token |
|-------------|--------------|-----------|
| `--coop-cream` (#fcf5ef) | Vellum/Parchment base — warm paper surface | Background, card base |
| `--coop-brown` (#4f2e1f) | Ink — primary text, borders, dense UI | Text, outlines, strong emphasis |
| `--coop-brown-soft` (#6b4a36) | Soft ink — secondary text, quiet lines | Helper text, decorative borders |
| `--coop-green` (#5a7d10) | Growth accent — knowledge, active states | Source badges, routing, tags |
| `--coop-orange` (#fd8a01) | Action accent — CTAs, publish, archive | Buttons, highlights, audio/success |
| `--coop-mist` (#d8d4d0) | Linen/Gauze — neutral backdrop, dividers | Recessed panels, inactive UI |
| `--coop-ink` (#27140e) | Deep brown-black — high-contrast headlines | Hero text, strong emphasis |
| `--coop-error` (#a63b20) | Error — destructive actions, offline | Validation, warnings |

---

## Dark Mode Materials

Coop's dark mode inverts the Vellum metaphor: from cream paper with brown ink to dark paper with warm light text. The warmth persists.

| Material | Light Mode | Dark Mode |
|----------|-----------|-----------|
| Parchment | Cream (#fcf5ef) solid | Deep brown (#1a0f08) solid |
| Vellum | Cream at 85% | Deep brown at 85% |
| Linen | Mist at 65% | Charcoal at 65% |
| Gauze | Mist at 40% | Charcoal at 40% |
| Breath | Transparent 20% | Transparent 20% |

Text colors flip: brown ink → warm cream text. Green and orange accents remain consistent across modes.

---

## Extension Surface Materials

| Surface | Material | Rationale |
|---------|----------|-----------|
| Popup background | Parchment | Dense content, needs maximum readability |
| Popup draft rows | Vellum | Standard card-level content |
| Sidepanel header | Parchment | Navigation anchor, always legible |
| Sidepanel cards | Vellum (`.panel-card`) | Default card material |
| Sidepanel recessed | Linen | Filter areas, collapsible sections |
| Agent status badges | Gauze | Ambient, glanceable, never demanding |
| Source health dot | Gauze | Peripheral indicator |
| Success toast | Glow (orange tint) | Celebration moment, brief |
| Onboarding empty state | Glow (green tint) | Welcoming, inviting action |

---

## Accessibility Fallbacks

For users who need maximum contrast (high contrast mode, visual impairment):

```css
@media (prefers-contrast: more) {
  .panel-card,
  .draft-card,
  .collapsible-card {
    background-color: var(--coop-cream);
    opacity: 1;
    border: 2px solid var(--coop-brown);
  }
}
```

Materials are progressive enhancement. Parchment (solid) is always the fallback. Never rely on translucency alone to communicate hierarchy — pair with borders, shadows, and typography weight.
