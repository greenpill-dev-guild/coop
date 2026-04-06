# References & Readiness Checklists

## Books

| Book | Author | Key Concept |
|------|--------|-------------|
| *Laws of UX* | Jon Yablonski | Psychology-backed design heuristics (Fitts's Law, Hick's Law, Miller's Law) |
| *Refactoring UI* | Adam Wathan, Steve Schoger | Visual design for developers — spacing, hierarchy, color, typography |
| *The Design of Everyday Things* | Don Norman | Affordances, signifiers, mapping |
| *Designing Interfaces* (3rd ed.) | Jenifer Tidwell et al. | Pattern library for interaction design |
| *Rethinking Users* | Youngblood, Chesluk, Haidary | 15 user archetypes, ecosystem thinking |

## Designers & Studios

| Who | Known For | Follow For |
|-----|-----------|------------|
| **Rauno Freiberg** (Vercel) | Spatial web effects, liquid interfaces | Bleeding-edge CSS/motion |
| **Paco Coursey** (Linear) | Precision minimalism, keyboard-first | Command surface craft |
| **Stripe Design** | Data-dense elegance, glass materials | Financial/data UI reference |
| **Linear** | GPU-rendered UI, keyboard navigation | Operator tools, control panes |
| **Notion** | Calm productivity, content-first | The aesthetic Chickens aspires to |
| **Apple HIG** | visionOS guidelines, material system | Spatial readiness patterns |

## Inspiration Sources

| Source | Use For |
|--------|---------|
| **Godly** | High-end visual direction, animation |
| **Refero** | Real-world UI patterns by interaction type |
| **Mobbin** | Mobile/web app flow analysis |

## Research & Frameworks

| Source | Authority On |
|--------|-------------|
| **Microsoft Inclusive Design** | [inclusive.microsoft.design](https://inclusive.microsoft.design/) — Persona Spectrum, cognitive inclusion |
| **Rethinking Users** | [rethinkingusers.com](https://www.rethinkingusers.com/) — 15 archetypes, ecosystem mapping |
| **Nielsen Norman Group** | Research-backed usability, AI UX |
| **Material Design 3** | Adaptive tokens, dynamic color, motion |
| **EPIC 2023** | Friction & ease in complex systems |

## Coop-Specific References

| Source | Location | What It Provides |
|--------|----------|-----------------|
| **Design Direction** | `docs/reference/coop-design-direction.md` | Brand read, palette, visual principles, motion/sound |
| **Design Tokens** | `packages/shared/src/styles/tokens.css` | Canonical runtime palette, spacing, radii, dark mode |
| **Accessibility Styles** | `packages/shared/src/styles/a11y.css` | Focus indicators, screen reader utilities |
| **Global Components** | `packages/extension/src/global.css` | Component classes, card patterns, badge system |
| **Token Lint** | `scripts/lint-tokens.ts` | Enforces only declared tokens are used |
| **Design Audit Prompt** | `docs/reference/hackathon-sprint-audit-prompts/design-system.md` | One-shot design system audit template |
| **Green Goods Design Skill** | `/Users/afo/Code/greenpill/green-goods/.claude/skills/design/` | Parent design skill — this skill is adapted from it |

---

## Spatial Readiness Checklist

Run before shipping new components or views:

```
Spatial Readiness Check
│
├─ [ ] Material-based backgrounds?
│      Using Vellum material tokens, not hardcoded hex colors
│      Parchment for text-dense, Gauze for ambient indicators
│
├─ [ ] Generous hit targets?
│      All interactive elements >= 44px (touch/accessibility)
│
├─ [ ] Rounded corners scale?
│      Small: radius-sm (4px). Cards: radius-md (8px).
│      Large: radius-lg (12px). Modals: radius-xl (16px).
│
├─ [ ] Progressive disclosure?
│      Information layers: glance → scan → engage → deep dive
│
├─ [ ] Works in popup (400px)?
│      Component tested at popup dimensions
│
├─ [ ] Works in sidepanel (variable)?
│      Component adapts to container width
│
├─ [ ] Depth hierarchy?
│      Z-axis used for information priority (Z0-Z4 model)
│
├─ [ ] Motion respects reduced-motion?
│      Animations wrapped in prefers-reduced-motion check
│
├─ [ ] Keyboard navigable?
│      Every action reachable via Tab/Enter/Escape
│
└─ [ ] Cognitive load appropriate?
       Material matches content density
       Dense content on Parchment, status on Gauze
```

---

## Combined Pre-Merge Checklist (Quick Version)

For time-constrained reviews, run this 10-point quick check:

```
Quick Design Check (5 min)
│
├─ [ ] Regen aesthetic? (warm palette, no degen patterns)
├─ [ ] Growth-agnostic? (no gamification, FOMO, streaks)
├─ [ ] Observant, not surveillance? (curious language)
├─ [ ] Material matches density? (Parchment for text, Gauze for status)
├─ [ ] Hit targets >= 44px?
├─ [ ] Works at 400px width?
├─ [ ] Color not sole indicator? (icon/text alongside)
├─ [ ] Token discipline? (var(--coop-*), not hex)
├─ [ ] Existing component reused? (check global.css)
└─ [ ] Motion has reduced-motion fallback?
```
