# Interaction Patterns — Extension-First

Interaction paradigms for browser extension UIs that work across popup (400px fixed), sidepanel (variable width), and PWA receiver. Every pattern must work with mouse, keyboard, and touch.

## Progressive Disclosure — The Jarvis Principle

Information appears in layers. The first layer is always calm. Complexity reveals on engagement. This serves cognitive diversity — the base layer works for everyone, deeper layers serve those who need them.

| Layer | Time | What Shows | How It Reveals | Coop Example |
|-------|------|------------|----------------|-------------|
| **Glance** | < 1s | Title, status dot, one key metric | Always visible | Popup source health: "12 active, all fresh" |
| **Scan** | 1-3s | Summary, badges, action hints | Visible in compact card | Chickens badge row: stage + category + provenance + confidence |
| **Engage** | 3s+ | Full detail, insights, provenance | Click/expand, full card view | DraftCard "Sourced from" section, "Why now" |
| **Deep Dive** | Intentional | Raw data, traces, configuration | Separate surface/section | Roost Decision History, Nest Source config |

### Critical Rule

Never hide essential information behind hover. Hover is a preview, not a gate. Touch devices cannot hover. Coop's popup is used on laptops with trackpads AND touch-enabled Chromebooks.

Primary content is visible at rest. Hover/focus reveals supplementary detail (tooltips, confidence breakdowns).

---

## Adaptive Density

The interface breathes — expanding when the user needs space to think, compressing when they are in flow.

| Mode | Gap | Padding | Text | Grid | Coop Surface |
|------|-----|---------|------|------|-------------|
| **Comfortable** | 1.5rem | 1.5rem | base | 1-col | Roost Focus, onboarding, empty states |
| **Compact** | 0.75rem | 0.75rem | sm | 1-col dense | Chickens compact cards, Nest member list |
| **Focused** | 2rem | 2rem+ | lg | 1-col narrow | Popup capture, draft editor, coop creation |

In existing CSS:
- Comfortable = `.content-shell` defaults (1rem gap)
- Compact = `.popup-draft-list`, `.popup-draft-row` (tight spacing)
- Focused = Popup screens with single actions (`.popup-screen--fill`)

### Extension Density Rules

- **Popup**: Always compact or focused. Never comfortable — space is precious.
- **Sidepanel > Chickens**: Compact for the list, comfortable for the expanded card.
- **Sidepanel > Roost**: Comfortable for Focus/Agent, compact for observation logs.
- **Sidepanel > Nest**: Compact for lists, focused for forms/config.

---

## Card Interaction Pattern

Cards are Coop's primary UI unit. Three interaction levels:

### Compact Card (Glance + Scan)
```
┌───────────────────────────────────────┐
│ [badge] [badge] [badge]    timestamp  │  ← Badge row (scan)
│ Title of the draft                    │  ← Title (glance)
│ First line of summary...             │  ← Lede (scan)
│ domain.com · 3 sources · 1 target    │  ← Meta strip (scan)
└───────────────────────────────────────┘
```

### Full Card (Engage)
```
┌───────────────────────────────────────┐
│ [badge] [badge] [badge]    timestamp  │
│ Title of the draft                    │
│ Full summary paragraph visible here   │
│ domain.com · 3 sources · 1 target    │
│                                       │
│ Sourced from                          │  ← Provenance (engage)
│  · Bankless #412 — "Storage costs"   │
│  · filecoin-project/specs — FIP-0076 │
│ Track record: approved 2w ago        │
│                                       │
│ Why now                               │  ← Insight (engage)
│ Grant window opens next week.         │
│                                       │
│ [Polish] [Save] [Ready to share]     │  ← Actions (engage)
└───────────────────────────────────────┘
```

### Deep Dive (separate surface)
Decision History in Roost, source config in Nest — full reasoning traces, entity lists, temporal graphs. Never inline in a card.

---

## Touch and Keyboard

| Interaction | Mouse | Touch | Keyboard |
|-------------|-------|-------|----------|
| Open card detail | Click | Tap | Enter |
| Hover preview | Hover (300ms) | Long press (not implemented) | Focus |
| Dismiss popover | Click outside | Tap outside | Escape |
| Navigate list | Scroll | Swipe | Arrow keys |
| Filter | Click filter pill | Tap filter pill | Tab + Enter |

### Hit Target Rules

- All interactive elements ≥ 44px height (WCAG 2.5.5, Level AAA target)
- Existing: `.primary-button` min-height 48px, `.secondary-button` min-height 38px
- Badge clicks: badges that act as filters need ≥ 44px touch area (use padding, not just text size)
- Popup rows: `.popup-draft-row` already has sufficient height

---

## Container-Query Thinking

Components should adapt to their container, not the viewport. This matters because:
- Sidepanel width varies (300-800px)
- The same card component appears in popup (400px) and sidepanel (variable)
- Future: cards may appear in the PWA receiver at full viewport width

Use CSS container queries where components may appear in different layout contexts.

---

## Animation Principles

Motion communicates state, not decoration:

| Purpose | Animation | Coop Use |
|---------|-----------|----------|
| **Entrance** | Fade-in + slide-up (`coop-rise`) | New cards appearing in list |
| **Attention** | Subtle wiggle (`coop-wiggle`) | New notification, review needed |
| **Transition** | Opacity crossfade | Tab switching, section expansion |
| **Celebration** | Glow bloom + sound | Coop creation, successful publish |

Rules:
- Respect `prefers-reduced-motion` (MANDATORY)
- Only animate `transform` and `opacity` (GPU-accelerated)
- No `transition: all` — specify properties
- Sound only for celebrations (rooster call, cluck) — never for background activity
