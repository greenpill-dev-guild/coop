# UI Audit Remediation — Full Design Overhaul

**Branch**: `feature/ui-audit-remediation`
**Status**: ACTIVE
**Created**: 2026-03-13
**Last Updated**: 2026-03-13 (All 6 phases complete)
**Status**: IMPLEMENTED

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Extract shared CSS tokens into `packages/shared/src/styles/tokens.css` | Single source of truth prevents drift between app and extension |
| 2 | Reduce sidepanel to 4 tabs with icons | 6 text-only tabs don't fit narrow sidepanel; merge Nest+Nest Tools into Settings |
| 3 | Default sidepanel tab = Roost for returning users, Nest for new | Returning users need their working surface, not the create form |
| 4 | Redesign landing hero to show the flow visually | Current hero is abstract; needs to show scattered-tabs → coop → opportunity |
| 5 | Keep vanilla CSS with custom properties (no Tailwind migration) | Already well-structured; adding Tailwind is a large migration for incremental gain |
| 6 | Use inline SVG for tab icons, not an icon library | Keeps bundle small, matches hand-drawn brand feel |
| 7 | Decompose receiver app.tsx into route-level components | 80KB single file is unmaintainable; split by concern |
| 8 | Rename "Nest" tab to "Home" and "Nest Tools" to merge into Settings | Resolves naming collision with receiver "nest" and reduces tab count |
| 9 | Move prompt-copy and deep ritual sections to docs/onboarding | Landing page should sell, not teach workshop facilitation |
| 10 | Standardize border-radius: 24px for cards, 16px for inputs/buttons, 999px for pills | Unify the two divergent systems into one scale |
| 11 | Add first-open onboarding overlay to sidepanel | New users currently see a dense form with no context |
| 12 | Celebrate knowledge→opportunity moments with orange glow + sound | Core UX gap: the transformation is invisible today |

## Requirements Coverage

| Requirement | Planned Step | Status |
|-------------|--------------|--------|
| Unified design tokens | Phase 1, Steps 1-2 | DONE |
| Consistent border-radius | Phase 1, Step 2 | DONE |
| Accessibility (focus, aria-live, labels) | Phase 1, Step 3 | DONE |
| Sidepanel tab reduction (6→4) | Phase 2, Step 1 | DONE |
| Tab icons | Phase 2, Step 1 | DONE |
| Smart default tab | Phase 2, Step 2 | DONE |
| Sidepanel header simplification | Phase 2, Step 3 | DONE |
| Start a Coop form reduction | Phase 2, Step 4 | DONE |
| Empty state illustrations | Phase 2, Step 5 | DONE |
| First-open onboarding | Phase 2, Step 6 | DONE |
| Hero redesign (flow visualization) | Phase 3, Step 1 | DONE |
| Landing copy consistency | Phase 3, Step 2 | DONE |
| Landing ritual section simplification | Phase 3, Step 3 | DONE |
| Landing mobile timeline fix | Phase 3, Step 4 | DONE |
| Landing backdrop/fence motif | Phase 3, Step 4 | DONE |
| Knowledge→opportunity celebration | Phase 4, Step 1 | DONE |
| Coop Feed relationship hints | Phase 4, Step 2 | DONE |
| Board view sidebar simplification | Phase 4, Step 3 | DONE |
| Board empty state improvement | Phase 4, Step 3 | DONE |
| Receiver app.tsx decomposition | Phase 5, Step 1 | DONE |
| Receiver app bar icons | Phase 5, Step 2 | DONE |
| Metaphor vocabulary audit | Phase 6, Step 1 | DONE |

## CLAUDE.md Compliance

- [ ] Shared tokens in `@coop/shared` — barrel import
- [ ] Single root `.env` only
- [ ] No package-specific env files
- [ ] Modules follow shared boundary pattern
- [ ] Validation passes: `bun format && bun lint && bun run test && bun build`

## Impact Analysis

### Files to Modify

**Phase 1 — Design System:**
- `packages/shared/src/styles/tokens.css` — NEW: shared design tokens
- `packages/shared/src/index.ts` — Re-export token path for consuming packages
- `packages/app/src/styles.css` — Replace hardcoded tokens with imports
- `packages/extension/src/global.css` — Replace hardcoded tokens with imports
- `packages/app/src/main.tsx` — Import shared tokens
- `packages/extension/src/views/Popup/main.tsx` — Import shared tokens
- `packages/extension/src/views/Sidepanel/main.tsx` — Import shared tokens

**Phase 2 — Extension Sidepanel:**
- `packages/extension/src/views/Sidepanel/sidepanel-app.tsx` — Tab restructure, header, forms, defaults
- `packages/extension/src/global.css` — Tab strip, header, onboarding styles
- `packages/extension/src/views/Sidepanel/operator-console.tsx` — Merge into Settings tab

**Phase 3 — Landing Page:**
- `packages/app/src/views/Landing/index.tsx` — Hero, copy, ritual, timeline
- `packages/app/src/styles.css` — Hero art, timeline, backdrop, mobile

**Phase 4 — Knowledge-to-Opportunity Flow:**
- `packages/extension/src/views/Sidepanel/sidepanel-app.tsx` — Feed celebration, category badges
- `packages/extension/src/global.css` — Opportunity glow, celebration styles
- `packages/app/src/views/Board/index.tsx` — Sidebar simplification, empty state
- `packages/app/src/styles.css` — Board layout adjustments

**Phase 5 — Receiver Decomposition:**
- `packages/app/src/app.tsx` — Split into route components
- `packages/app/src/views/Receiver/index.tsx` — NEW: receiver shell
- `packages/app/src/views/Receiver/capture.tsx` — NEW: capture/egg UI
- `packages/app/src/views/Receiver/inbox.tsx` — NEW: inbox/nest items
- `packages/app/src/views/Receiver/pairing.tsx` — NEW: pairing flow
- `packages/app/src/views/Receiver/settings.tsx` — NEW: receiver settings

### Files to Create

- `packages/shared/src/styles/tokens.css` — Shared design tokens
- `packages/shared/src/styles/a11y.css` — Shared accessibility utilities
- `packages/app/src/views/Receiver/index.tsx` — Receiver shell
- `packages/app/src/views/Receiver/capture.tsx` — Capture component
- `packages/app/src/views/Receiver/inbox.tsx` — Inbox component
- `packages/app/src/views/Receiver/pairing.tsx` — Pairing component
- `packages/app/src/views/Receiver/settings.tsx` — Settings component

## Test Strategy

- **Unit tests**: Each phase should pass existing tests; new tests for decomposed receiver components
- **Integration tests**: Sidepanel tab navigation, form submission with reduced fields
- **E2E tests**: `bun run validate core-loop` after each phase; `bun run validate full` after Phase 5
- **Visual regression**: Manual screenshot comparison at each phase (no automated visual testing yet)

---

## Phase 1: Design System Foundation

**Goal**: Single source of truth for tokens, consistent border-radius, accessibility baseline.
**Dependency**: None — this is the foundation everything else builds on.
**Estimated steps**: 3

### Step 1: Extract shared design tokens

**Files**: `packages/shared/src/styles/tokens.css` (new), `packages/shared/package.json`

Create `packages/shared/src/styles/tokens.css` with unified CSS custom properties:

```css
:root {
  /* Palette */
  --coop-cream: #fcf5ef;
  --coop-brown: #4f2e1f;
  --coop-brown-soft: #6b4a36;
  --coop-green: #5a7d10;
  --coop-orange: #fd8a01;
  --coop-mist: #d8d4d0;
  --coop-ink: #27140e;
  --coop-error: #a63b20;

  /* Borders */
  --coop-line: rgba(79, 46, 31, 0.16);

  /* Shadows */
  --coop-shadow-sm: 0 8px 20px rgba(79, 46, 31, 0.08);
  --coop-shadow-md: 0 16px 40px rgba(79, 46, 31, 0.12);
  --coop-shadow-lg: 0 24px 60px rgba(79, 46, 31, 0.12);

  /* Radii */
  --coop-radius-pill: 999px;
  --coop-radius-card: 24px;
  --coop-radius-input: 16px;
  --coop-radius-chip: 12px;

  /* Spacing */
  --coop-space-xs: 0.35rem;
  --coop-space-sm: 0.65rem;
  --coop-space-md: 1rem;
  --coop-space-lg: 1.5rem;
  --coop-space-xl: 2rem;

  /* Typography */
  --coop-font-display: "Gill Sans", "Trebuchet MS", sans-serif;
  --coop-font-body: "Avenir Next", "Trebuchet MS", "Segoe UI", sans-serif;
  --coop-font-mono: "SFMono-Regular", "JetBrains Mono", monospace;

  /* Transitions */
  --coop-ease: 180ms ease;
}
```

Ensure the CSS file can be imported by both app and extension via their Vite configs (direct CSS import or copy).

**Verify**: File exists, tokens are syntactically valid CSS.

### Step 2: Migrate app and extension CSS to shared tokens

**Files**: `packages/app/src/styles.css`, `packages/extension/src/global.css`, `packages/app/src/main.tsx`, `packages/extension/src/views/Sidepanel/main.tsx`, `packages/extension/src/views/Popup/main.tsx`

- Add `@import` of shared tokens at the top of both CSS files (or import in JS entry points)
- Replace all hardcoded color values, shadow values, border-radius values with token references
- Standardize border-radius: cards → `var(--coop-radius-card)`, inputs → `var(--coop-radius-input)`, pills → `var(--coop-radius-pill)`
- Remove duplicate `:root` declarations from both files (keep only package-specific overrides if any)
- Normalize `--coop-shadow` to use the `--coop-shadow-md` / `--coop-shadow-lg` scale

**Verify**: `bun build` succeeds, both app and extension render with correct colors.

### Step 3: Accessibility baseline

**Files**: `packages/shared/src/styles/a11y.css` (new), `packages/app/src/styles.css`, `packages/extension/src/global.css`

Create `packages/shared/src/styles/a11y.css`:
- `:focus-visible` outline styles (2px solid `var(--coop-orange)`, 2px offset)
- `.sr-only` utility class for screen-reader-only content
- `[aria-live]` region styling

Update app and extension CSS:
- Import a11y.css
- Add `aria-live="polite"` to the message display area in sidepanel and receiver
- Audit form labels in `sidepanel-app.tsx` — ensure every `<input>`, `<select>`, `<textarea>` has an associated `<label>` with `htmlFor`

**Verify**: Tab through sidepanel with keyboard — all interactive elements have visible focus rings. `bun run test` passes.

---

## Phase 2: Extension Sidepanel Overhaul

**Goal**: Reduce cognitive load, make the primary surface feel fun and scannable.
**Dependency**: Phase 1 (tokens must be in place).
**Estimated steps**: 6

### Step 1: Restructure tabs from 6 to 4 with icons

**Files**: `packages/extension/src/views/Sidepanel/sidepanel-app.tsx`, `packages/extension/src/global.css`

New tab structure:
| Old | New | Icon concept |
|-----|-----|-------------|
| Loose Chickens | Chickens | Scattered feathers / running chicken |
| Roost | Roost | Nest with eggs |
| Nest + Nest Tools + Flock Meeting merged | Home | Coop house |
| Coop Feed | Feed | Shared bowl / feed trough |

Changes:
- Update `tabs` const from 6 to 4 entries: `['Chickens', 'Roost', 'Home', 'Feed']`
- Update `PanelTab` type
- Add inline SVG icons (small, 16-20px, hand-drawn style matching brand) next to each tab label
- Update `.tab-strip` grid to `repeat(4, minmax(0, 1fr))` — each tab ~90px at 400px width
- Move "Flock Meeting" content into the "Home" tab as a collapsible section
- Move operator console / "Nest Tools" into a "Settings" collapsible inside "Home" tab (or gear icon in header)
- Update all `setPanelTab()` calls to use new tab names

**Verify**: Sidepanel renders with 4 tabs, all tab content loads correctly.

### Step 2: Smart default tab based on user state

**Files**: `packages/extension/src/views/Sidepanel/sidepanel-app.tsx`

- Change initial `useState<PanelTab>` from hardcoded `'Nest'` to a function:
  - If `dashboard?.coops.length > 0` → default to `'Roost'`
  - If no coops exist → default to `'Home'` (where create/join lives)
- Add `useEffect` that updates default when dashboard first loads (since dashboard is async)

**Verify**: Open sidepanel with existing coop → lands on Roost. Open with no coops → lands on Home.

### Step 3: Simplify the sticky header

**Files**: `packages/extension/src/views/Sidepanel/sidepanel-app.tsx`, `packages/extension/src/global.css`

Reduce header to:
- Row 1: Wordmark (left) + state pill (right)
- Row 2: Active coop name (left, larger text) + coop switcher dropdown (compact, right)
- Remove: summary strip (3 cards), state-text line, "Open coop board" button (move to Home tab)

The 3 summary cards (active nest, roost drafts, sync state) move into the Roost tab as a top-of-page summary.

Update CSS:
- `.panel-header` becomes a compact 2-row layout
- Remove `.summary-strip` from header
- Remove `.state-text` from header (move status info to Home tab)

**Verify**: Header is visually compact (~80px tall). All moved content is accessible in its new location.

### Step 4: Streamline "Start a Coop" form

**Files**: `packages/extension/src/views/Sidepanel/sidepanel-app.tsx`

Reduce required fields to 4:
1. Coop name (text input)
2. What is this coop for? (text input — the purpose)
3. Your display name (text input)
4. Your starter note (textarea)

Move to a collapsible "Advanced" section (collapsed by default):
- Coop style dropdown
- Round-up timing
- Big picture textarea
- Green Goods garden checkbox
- All 4 lens areas

Set sensible defaults:
- `spaceType`: 'community' (most common)
- `captureMode`: 'manual'
- `summary`: auto-generated from purpose if not provided

**Verify**: Form submits successfully with only the 4 required fields. Advanced section works when expanded.

### Step 5: Design empty states with personality

**Files**: `packages/extension/src/views/Sidepanel/sidepanel-app.tsx`, `packages/extension/src/global.css`

For each empty state, add a CSS-only illustration + improved copy:

| Tab | Empty State | Visual | Copy |
|-----|------------|--------|------|
| Chickens | No captures | Dashed outline of a running chicken (CSS border art or simple SVG) | "No loose chickens yet. Hit 'Round up' to see what's open." |
| Roost | No drafts | Empty nest outline with one feather | "The roost is quiet. Round up some tabs to get drafts hatching." |
| Feed | No artifacts | Empty feed bowl | "Nothing shared yet. Publish a draft from the roost to start the feed." |
| Home | No coops | Egg outline | "No coop yet. Start one below and invite your flock." |

Update empty state styles:
- Center the illustration
- Use `--coop-brown-soft` at lower opacity for the illustration
- Keep copy warm and actionable

**Verify**: Each tab shows its empty state correctly when no data exists.

### Step 6: First-open onboarding overlay

**Files**: `packages/extension/src/views/Sidepanel/sidepanel-app.tsx`, `packages/extension/src/global.css`

Add a 3-step onboarding overlay shown on first open (tracked via `localStorage` flag):

1. **"Loose Chickens"** — "Coop watches your open tabs and catches the useful ones here. All local, all private."
2. **"The Roost"** — "Review, tidy, and shape your catches into drafts before sharing with the group."
3. **"The Feed"** — "Publish what matters. Your flock sees it, and good finds turn into shared opportunities."

Each step highlights the relevant tab with a subtle pulse/glow.

Final step: "Start a Coop" button or "Got it" dismiss.

Set `localStorage.setItem('coop-onboarding-complete', 'true')` on dismiss.

**Verify**: Clear localStorage, open sidepanel → onboarding shows. Dismiss → doesn't show again.

---

## Phase 3: Landing Page Redesign

**Goal**: Make the hero tell the story, simplify the page, tighten copy.
**Dependency**: Phase 1 (tokens). Independent of Phase 2.
**Estimated steps**: 4

### Step 1: Redesign hero art to show the flow

**Files**: `packages/app/src/views/Landing/index.tsx`, `packages/app/src/styles.css`

Replace the current hero art (glow mark + 4 fragment cards) with a visual flow:

**New hero art concept (CSS-illustrated):**
- LEFT zone: 3-4 small scattered cards at angles (representing loose tabs/chickens) with dashed outlines, slightly transparent
- CENTER: An arrow or curved path flowing rightward, with the Coop mark at the center as the collector
- RIGHT zone: 2-3 stacked, aligned cards (representing organized knowledge/opportunities) with solid borders, warm glow

Use CSS transforms for the scattered/aligned effect. The fragment cards become:
- Left side labels: "Research tab", "Funding link", "Field note" (real examples, not product jargon)
- Right side labels: "Funding lead", "Shared evidence", "Next step" (outcomes)

Update `.hero-art` to use flexbox/grid with the three zones.
Keep the glow mark as the centerpiece but with context.

**Verify**: Hero visually communicates the flow at desktop and mobile widths.

### Step 2: Tighten landing copy for consistency

**Files**: `packages/app/src/views/Landing/index.tsx`

Copy audit and fixes:
- Remove the `quiet-note` ("Landing page sound stays off...") — implementation detail
- Change eyebrow from "No more chickens loose" to keep it (it's great) but ensure the h1 and lede reinforce the same idea without switching to technical language
- Problem section: keep but tighten. Remove internal-sounding phrases
- "How It Works" timeline: use benefit-oriented labels, not process descriptions
  - Step 1: "Name what matters" (not "Start a coop with a short first chat")
  - Step 2: "Browse normally" (keep as-is, it's good)
  - Step 3: "Review together" (not "The Roost holds drafts until...")
  - Step 4: "Act on what you found" (not "The coop leaves with shared finds...")

Ensure all copy uses the same warm, direct voice. No "passive capture", "browser-local AI loop", or other technical phrases on the landing page.

**Verify**: Read through the page top-to-bottom — no jarring tone shifts.

### Step 3: Simplify ritual and prompt sections

**Files**: `packages/app/src/views/Landing/index.tsx`

- Remove the "Prompt Copy" section entirely (the raw GPT/Gemini prompt). Move it to documentation.
- Simplify the "Teach Coop More" ritual section:
  - Reduce from 4 lens cards to a single "What does your group care about?" section with 2-3 example questions
  - Remove the `ritualPrompt` const and the `copyPrompt` handler
  - Remove "Optional deepening for bigger coops" card
- Keep the "Privacy And Push" section (it's important and well-written)
- Keep the "Extension States" section but simplify the install instructions

**Verify**: Page is shorter, focused. No prompt text visible. `bun build` succeeds.

### Step 4: Fix mobile layout + strengthen backdrop motif

**Files**: `packages/app/src/styles.css`

**Timeline mobile fix:**
- At `@media (max-width: 1024px)`, instead of collapsing timeline to 1 column, use `repeat(2, minmax(0, 1fr))` for a 2x2 grid that preserves the sequence (1→2 on top, 3→4 on bottom)
- Add connecting lines or numbered badges that maintain visual sequence

**Backdrop motif:**
- Increase the grid line opacity from 0.04 to 0.07
- Change `background-size: 52px 52px` to `48px 48px` (tighter grid = more fence-like)
- Add horizontal wooden-fence-style lines at section breaks using `::after` pseudo-elements on `.section` — a subtle brown dashed border

**Footer links:**
- Remove links to raw spec files (`/spec/coop-os-architecture-vnext.md`, `/spec/demo-and-deploy-runbook.md`) — these are internal. Replace with real CTAs.

**Verify**: Mobile view maintains sequential timeline. Backdrop pattern is visible and feels fence-like.

---

## Phase 4: Knowledge-to-Opportunity Flow

**Goal**: Make the transformation from knowledge to opportunity visible and celebrated.
**Dependency**: Phase 2 (sidepanel structure must be updated first).
**Estimated steps**: 3

### Step 1: Celebrate opportunity-category artifacts

**Files**: `packages/extension/src/views/Sidepanel/sidepanel-app.tsx`, `packages/extension/src/global.css`

When a draft is categorized as `funding-lead`, `opportunity`, or `next-step`:
- Show the category badge with an orange glow background (`--coop-orange` at 0.15 opacity)
- Add a subtle pulse animation on the badge when first appearing
- When publishing such a draft, show a success message with stronger celebration copy: "A funding lead just landed in the feed." (not just "Draft shared with the coop feed.")
- Optionally trigger the `coop-soft-cluck` sound with a slightly different message

Add CSS class `.is-opportunity` for artifacts with opportunity-type categories:
```css
.draft-card.is-opportunity,
.artifact-card.is-opportunity {
  border-color: rgba(253, 138, 1, 0.3);
  background: linear-gradient(135deg, rgba(255, 248, 236, 0.95), rgba(255, 252, 249, 0.9));
  box-shadow: 0 0 0 1px rgba(253, 138, 1, 0.12), var(--coop-shadow-md);
}
```

**Verify**: Create a draft with category "funding-lead", publish it — visual celebration is visible.

### Step 2: Add relationship hints to the Coop Feed

**Files**: `packages/extension/src/views/Sidepanel/sidepanel-app.tsx`, `packages/extension/src/global.css`

In the Feed tab, when displaying artifacts:
- Group artifacts by category with section headers: "Funding Leads", "Evidence", "Next Steps", "Insights"
- Show a small count badge per category at the top of the feed
- For each artifact, if its source capture is known, show a subtle "from [capture title]" link — making the knowledge→opportunity chain visible inline
- Add a "View on board" link at the bottom of the feed (moves from deleted header location)

**Verify**: Feed shows categorized sections. Source links work.

### Step 3: Simplify board view + improve empty state

**Files**: `packages/app/src/views/Board/index.tsx`, `packages/app/src/styles.css`

**Board sidebar simplification:**
- Collapse "Saved proof trail" and "What the coop kept" into a single collapsible sidebar panel
- Default the sidebar to collapsed on viewport widths < 1180px
- Keep the ReactFlow canvas as the dominant element

**Board empty state:**
- Replace the dead-end "Board snapshot unavailable" with:
  - A brief explanation: "The board needs a coop snapshot to display. Open it from the extension sidepanel."
  - A CSS illustration of an empty nest/board
  - If possible, a direct "Install extension" link

**Verify**: Board renders with simplified sidebar. Empty state is informative.

---

## Phase 5: Receiver App Decomposition

**Goal**: Break the 80KB monolith into maintainable components.
**Dependency**: Phase 1 (tokens). Otherwise independent.
**Estimated steps**: 2

### Step 1: Decompose app.tsx into route-level components

**Files**: `packages/app/src/app.tsx` → split into:
- `packages/app/src/app.tsx` — thin shell with ErrorBoundary, routing, service worker
- `packages/app/src/views/Receiver/index.tsx` — receiver shell layout, app bar, tab routing
- `packages/app/src/views/Receiver/capture.tsx` — egg button, screenshot, recording state
- `packages/app/src/views/Receiver/inbox.tsx` — nest items list, sync pills, actions
- `packages/app/src/views/Receiver/pairing.tsx` — pairing form, QR display, status
- `packages/app/src/views/Receiver/settings.tsx` — device identity, sync settings, sound prefs

Each component receives only the props it needs from the parent Receiver shell.
State management stays in the shell component (lift state up pattern already in use).

**Verify**: All receiver functionality works as before. `bun run test` passes. `bun build` succeeds.

### Step 2: Add icons to receiver app bar

**Files**: `packages/app/src/views/Receiver/index.tsx`, `packages/app/src/styles.css`

Add inline SVG icons to the `.receiver-appbar` links:
- Capture tab: egg/camera icon
- Inbox tab: nest/tray icon
- Settings tab: gear icon

Update `.receiver-appbar-link` to stack icon + text vertically (already has the grid layout for this).

**Verify**: App bar shows icons on mobile. Touch targets are at least 44x44px.

---

## Phase 6: Metaphor & Vocabulary Audit

**Goal**: Ensure the chicken metaphor is consistent, clear, and doesn't create confusion.
**Dependency**: Phase 2 (tab names must be finalized first).
**Estimated steps**: 1

### Step 1: Vocabulary audit and normalization

**Files**: All `.tsx` files in `packages/app/src/` and `packages/extension/src/`

Audit and normalize:

| Term | Current Usage | Standardize To |
|------|--------------|----------------|
| Nest | Coop management tab + receiver paired devices | "Home" for the tab. "Paired device" or "Pocket Coop" for receiver. Remove "nest" from receiver UI copy where it means "paired device." |
| Hatch | "Quick hatch", "Start a Coop", "Launch the Coop" | "Hatch a coop" for creation. "Quick hatch" for the fast form. Remove "Launch the Coop." |
| Nest Tools | Admin/operator tab | Merged into "Home" → "Settings" section |
| Loose Chickens | Tab name | Shorten to "Chickens" in tab, keep "Loose Chickens" in descriptive copy |
| Flock Meeting | Tab name | Section inside "Home" tab, keep the name |
| Round-up | Tab capture action | Keep as-is — it's clear and fun |
| Roost | Draft review queue | Keep as-is — intuitive |
| Feed | Shared published artifacts | Keep as-is — universally understood |

Search all `.tsx` files for inconsistent usage and normalize. Pay special attention to:
- Button labels
- Empty state copy
- Success/error messages
- `setMessage()` calls

**Verify**: Grep for old terms confirms no stale references. All user-facing strings use the standardized vocabulary.

---

## Validation

After all phases:

```bash
bun format && bun lint && bun run test && bun build
bun run validate core-loop
bun run validate full
```

- [ ] TypeScript passes
- [ ] All existing tests pass
- [ ] Both app and extension build successfully
- [ ] Extension popup and sidepanel render correctly
- [ ] Landing page renders at desktop, tablet, mobile widths
- [ ] Board view renders with and without snapshot data
- [ ] Receiver app works in PWA mode
- [ ] Keyboard navigation works throughout (focus-visible)
- [ ] Screen reader announces status messages (aria-live)

## Phase Dependencies

```
Phase 1 (Design System) ──┬──→ Phase 2 (Sidepanel) ──→ Phase 4 (Knowledge Flow)
                          ├──→ Phase 3 (Landing Page)
                          └──→ Phase 5 (Receiver Decomp) ──→ Phase 6 (Vocabulary)
```

Phases 2, 3, and 5 can run in parallel after Phase 1 completes.
Phase 4 depends on Phase 2 (sidepanel must be restructured).
Phase 6 depends on Phase 2 (tab names must be finalized) and Phase 5 (receiver terminology).
