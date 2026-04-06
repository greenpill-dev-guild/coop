---
name: design
description: "Design philosophy for Coop's adaptive, warm, browser-first interfaces. Four-lens framework: Regenerative, Spatial, Ecosystem, Compliance. Vellum material language. Progressive disclosure. Use for design direction, visual decisions, component planning, and design review."
version: "1.0.0"
status: active
packages: ["shared", "extension", "app"]
dependencies: ["ui-compliance"]
last_updated: "2026-04-05"
last_verified: "2026-04-05"
---

# Design Skill

Design philosophy and visual direction for Coop. This skill shapes *what* to build and *why* — the `ui-compliance` skill handles accessibility specifics, and `tokens.css` provides the implementation palette.

> **Paradigm**: The Adaptive Surface. Not pages — panes of contextual information that respond to intent, reveal on engagement, and recede when irrelevant. Warm, observant, and structured — never cold, surveillance-like, or overdesigned.

Adapted from Green Goods' design skill (same Quad Foundation), tailored for browser extension context, plain CSS tokens, and Coop's Vellum material language.

## Activation

| Domain | Keywords / Triggers | Sub-file |
|--------|-------------------|----------|
| **Design Philosophy** | design direction, paradigm, adaptive surface, vision | This file |
| **Depth & Space** | Z-axis, depth, layers, elevation, scroll | [spatial.md](./spatial.md) |
| **Interaction** | progressive disclosure, density, hover, touch | [interaction.md](./interaction.md) |
| **Materials** | vellum, surface, warmth, opacity, grain | [materials.md](./materials.md) |
| **Ecosystem** | members, operators, agents, cross-coop, cascade | [ecosystem.md](./ecosystem.md) |
| **Regenerative** | regen, degen, capability, succession, growth-agnostic | [regenerative.md](./regenerative.md) |
| **Implementation** | tokens, CSS, components, classes, build | [implementation.md](./implementation.md) |
| **Review Checklist** | review, PR, audit, checklist, before merging UI | [review-checklist.md](./review-checklist.md) |
| **References** | inspiration, design books, readiness checklist | [references.md](./references.md) |

When invoked:
1. Establish design paradigm and material before writing code
2. Apply Regenerative lens — does this regenerate or extract?
3. Apply Ecosystem lens — whose experience composes with whose?
4. Apply Inclusive Design lens — who gets excluded?
5. Defer to `ui-compliance` skill for WCAG specifics
6. Run the 4-lens review checklist on new components

---

## Quad Foundation

Four frameworks anchor every design decision, applied in order:

### 1. Regenerative Design

Does this design regenerate or extract? Seven principles: make the mycelium visible, design for succession, enrich the edges, failure is succession, growth-agnostic, capability is the deliverable, regen not degen.

Coop is a knowledge commons, not a content platform. The agent builds shared understanding, not engagement metrics. No streaks, no FOMO, no gamified entity counts. The Walkaway Test: if the agent stops, does the knowledge persist?

Full framework: [regenerative.md](./regenerative.md)

### 2. The Adaptive Surface Paradigm

The interface is a set of adaptive surfaces. Information floats in layers of relevance — the most urgent at eye level, the contextual at the periphery, the archival behind a gesture. Controls appear when context demands them and recede when it doesn't.

Not everything should be spatial. A settings form is a settings form. The paradigm applies when: the user monitors multiple streams (Roost), reviews candidates (Chickens), or explores decision history.

### 3. User Ecosystem Thinking

The interface exists in an ecosystem of interconnected people and agents. A single design decision cascades across members who may never see the same screen. Based on Youngblood, Chesluk, and Haidary's framework (BIS Publishers, 2021).

Coop adds a unique dimension: **agents are ecosystem actors**. The Coop agent is an Autonomic User whose behavior shapes every member's experience. It must have visible state — not hidden behind infrastructure.

Full framework with Coop ecosystem map: [ecosystem.md](./ecosystem.md)

### 4. Microsoft Inclusive Design

Three principles woven throughout:

- **Recognize Exclusion** — Extension UIs create specific exclusions: small popup viewport (400px), variable sidepanel width, color reliance in badges, dense information in compact cards.
- **Learn from Diversity** — Progressive disclosure and adaptive density serve cognitive diversity, not just preference. Coop's founder has poor eyesight — design for that.
- **Solve for One, Extend to Many** — Every pattern must work across popup (400px), sidepanel (variable), and PWA (full viewport). Constraints breed universal solutions.

---

## Paradigm Selection

Choose one paradigm per surface. Mix across a view.

| Paradigm | When | Feel | Density | Coop Example |
|----------|------|------|---------|-------------|
| **Command Surface** | Primary action area | Warm solid, sharp focus, high contrast | High — controls visible and ready | Nest Sources, Popup capture |
| **Ambient Display** | Status, background info | Translucent, soft, peripheral | Low — glanceable, never demands attention | Source health dot, sync badge |
| **Data Landscape** | History, traces, flows | Layered, navigable, zoomable | Variable — overview to detail | Decision History, Chickens review |
| **Conversational** | Agent interaction, guidance | Minimal chrome, content-forward | Sparse — message and response | Agent approval prompts |
| **Ritual** | Onboarding, success, ceremony | Full-screen, cinematic, focused | Single-purpose — one thing, done well | Coop creation, first source added |

### Material Metaphors

Coop uses **Vellum** as its primary material — warm, tactile, paper-like. This is dictated by the brand direction ("warm, not corporate") and the cream/brown palette.

| Material | Visual Language | When to Use |
|----------|----------------|-------------|
| **Vellum** (primary) | Warm cream, subtle grain, paper-like | All standard surfaces — cards, panels, forms |
| **Vellum Dark** | Deep brown-ink, warm shadows | Dark mode variant — ink on dark paper |
| **Warm Glass** | Cream-tinted translucency, soft blur | Ambient displays, source health, agent status |
| **Earth** | Solid brown/green, grounded, dense | Command surfaces, operator controls |
| **Glow** | Orange/green radiance, celebration | Ritual moments — coop creation, publish success |

The brand palette IS the material system:
- `--coop-cream` = Vellum base
- `--coop-brown` / `--coop-ink` = Vellum text
- `--coop-green` = Knowledge/growth accent
- `--coop-orange` = Action/publish accent
- `--coop-mist` = Neutral/ambient backdrop

---

## Extension-Specific Constraints

Browser extensions impose unique design constraints that shape every decision:

| Context | Constraint | Design Response |
|---------|-----------|----------------|
| **Popup** | Fixed 400px width, max 600px height | Dense but scannable. Command Surface paradigm. No horizontal scroll. |
| **Sidepanel** | Variable width (300-800px) | Container queries, not viewport breakpoints. Adaptive density. |
| **Background** | No UI at all | N/A — but agent state must surface in popup/sidepanel |
| **Offscreen** | Invisible document | Agent + graph engine = Autonomic actors. Make their state visible elsewhere. |

The popup is the **quick pulse**. The sidepanel is the **workspace**. Never put workspace-level complexity in the popup, never put pulse-level simplicity as the only sidepanel view.

---

## Anti-Patterns

### Design Philosophy
1. **Dashboard-itis** — Cramming every metric onto one flat surface. Use progressive disclosure.
2. **Cold corporate** — Grayscale dashboards, flat SaaS blue accents, sterile glassmorphism. Coop is warm and inhabited.
3. **Surveillance-like** — Language or UI that makes passive observation feel aggressive. "I noticed" not "I tracked."
4. **Overdesigned** — Fun lives in iconography, success states, and copy tone — not in making the review flow hard to scan.

### Coop-Specific
5. **Generic AI slop** — Inter + purple gradient + white bg = forgettable. Coop has a distinctive warm palette. Use it.
6. **Financial terminal** — Red/green PnL, countdown timers, FOMO urgency. This is a knowledge commons, not a trading floor.
7. **Agent opacity** — Agent actions invisible until they produce output. Show the agent's state, knowledge, reasoning.
8. **Source overload** — Showing all 214 entities at once. Progressive disclosure: topic bars → source cards → entity details.

### Visual Execution
9. **Uniform density** — Same spacing everywhere. Adapt: comfortable for Roost, compact for Chickens, focused for Popup capture.
10. **Color-only state** — Badges that rely on color alone. Always pair with text or icon (WCAG 1.4.1).
11. **Motion without meaning** — Every animation communicates state change, not decoration. Respect `prefers-reduced-motion`.

---

## Decision Tree

```text
What kind of design work?
│
├── New view or tab section?
│   ├── Choose paradigm (Command / Ambient / Data / Conversational / Ritual)
│   ├── Choose material (Vellum / Warm Glass / Earth / Glow)
│   ├── Apply Regenerative lens (does this regenerate or extract?)
│   ├── Apply Ecosystem lens (who is affected? what cascades?)
│   ├── Define disclosure layers (glance → scan → engage → deep dive)
│   └── Check: works in popup (400px)? works in sidepanel (variable)?
│
├── New component?
│   ├── What Z-layer? (ground / surface / floating / overlay) → spatial.md
│   ├── What material? → materials.md
│   ├── Interactive? (hit targets ≥ 44px, keyboard reachable)
│   ├── Reuse existing class? → Check global.css, CLAUDE.md component list
│   └── Run review checklist → review-checklist.md
│
├── Agent-facing surface?
│   ├── Agent is an Autonomic actor → ecosystem.md
│   ├── Show agent state as Ambient Display (not hidden)
│   ├── Reasoning traces use Data Landscape paradigm
│   └── Source provenance uses progressive disclosure
│
├── Multi-user surface?
│   ├── Map archetypes involved → ecosystem.md
│   ├── Add cascade indicators for governing actions
│   ├── Surface autonomic actor state (agent, sync, onchain)
│   └── Run Ecosystem Readiness Checklist → ecosystem.md
│
├── Visual polish pass?
│   ├── Replace solid backgrounds with Vellum material → materials.md
│   ├── Add depth via Z-layer model → spatial.md
│   ├── Add progressive disclosure to dense surfaces → interaction.md
│   └── Verify inclusive design checks → review-checklist.md
│
└── Need inspiration?
    └── Reference library → references.md
```

---

## Related Skills

- `ui-compliance` — WCAG 2.1 AA, forms, responsive, animation, dark mode
- `react` — Component composition, state management, performance
- `data-layer` — Dexie, Yjs, offline-first patterns, sync indicators
- `architecture` — System boundaries that influence surface decomposition
