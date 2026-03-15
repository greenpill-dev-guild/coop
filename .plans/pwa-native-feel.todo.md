# PWA Native-Feel Overhaul

**GitHub Issue**: —
**Branch**: `feature/pwa-native-feel`
**Status**: IMPLEMENTED
**Created**: 2026-03-14
**Last Updated**: 2026-03-14

## Source Audits

- `.plans/audits/2026-03-14-app-pwa-ui-audit.md` — 25 findings (7C / 6H / 8M / 4L)
- `docs/ui-review-issues.md` — 20 findings (2026-03-13)
- Live cross-reference session (2026-03-14) — 17 findings, consolidated priority matrix

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | No UI library — keep vanilla React + CSS | CLAUDE.md principle: browser-first, no unnecessary deps. The missing primitives (dialog, bottom sheet) are small enough to build with native elements. |
| 2 | Components stay in `packages/app` | Shared package is domain modules only (CLAUDE.md). View components are app-specific. |
| 3 | New `packages/app/src/components/` directory | No components dir exists today. All UI primitives (Button, Card, Dialog, BottomSheet, Skeleton) go here. |
| 4 | `<dialog>` element for overlays | Extension already uses `<dialog>` in OnboardingOverlay.tsx. Align app to same pattern. Native focus trap, `::backdrop`, Escape handling. |
| 5 | View Transitions API with fallback | `document.startViewTransition()` has 78%+ support. Wrap in feature detection; unsupported browsers get instant swap (current behavior). |
| 6 | Design tokens via `color-mix()` for alpha variants | Eliminates 40+ raw `rgba(79, 46, 31, ...)` values. `color-mix(in srgb, var(--coop-brown) 12%, transparent)` replaces `rgba(79, 46, 31, 0.12)`. 91%+ browser support. |
| 7 | Dark mode as token inversion in `tokens.css` | Single `@media (prefers-color-scheme: dark)` block. Inverts palette tokens. All UI inherits automatically because tokens are already used for primary colors. |
| 8 | Phased delivery: 5 PRs | Each phase is independently shippable. P0 is a bugfix. P1 is architecture. P2 is design system. P3 is a11y. P4 is polish. |
| 9 | Extract views before adding transitions | View transitions need stable component boundaries. Extract first (Step 4), then add transitions (Step 7). |
| 10 | Bottom sheet as CSS-only + minimal JS | `translate` + `touch-event` handler. No gesture library. Snap points via CSS `scroll-snap`. |

## Requirements Coverage

| Requirement | Source | Planned Step | Status |
|-------------|--------|--------------|--------|
| Define 8 missing CSS classes | PWA audit C1 | Step 1 | ✅ |
| `<dialog>` for QR scanner overlay | All 3 audits | Step 2 | ✅ |
| Focus trap + backdrop on dialog | All 3 audits | Step 2 | ✅ |
| Extract PairView component | My review + UI review | Step 4 | ✅ |
| Extract CaptureView component | My review + UI review | Step 4 | ✅ |
| Extract InboxView component | My review + UI review | Step 4 | ✅ |
| Extract shared UI components (Button, Card, Pill) | My review + PWA audit | Step 5 | ✅ |
| Skeleton loading states | All 3 audits | Step 6 | ✅ |
| View transitions between routes | My review + PWA audit | Step 7 | ✅ |
| Bottom sheet for settings | My review + PWA audit | Step 8 | ✅ |
| Design token consolidation (15% → 90%+) | My review + PWA audit H6 | Step 9 | ✅ |
| `100dvh` fallback | My review + PWA audit H5 | Step 3 | ✅ |
| `apple-touch-icon` in HTML | PWA audit H4 | Step 3 | ✅ |
| Theme-color alignment | PWA audit L3 | Step 3 | ✅ |
| Touch target minimums 44px | My review + PWA audit M4 | Step 10 | ✅ |
| Egg button a11y (`aria-pressed`, live region) | PWA audit M6 | Step 11 | ✅ |
| ErrorBoundary design tokens | PWA audit M7 | Step 11 | ✅ |
| Dark mode support | My review + PWA audit M1 | Step 12 | ✅ |
| Container queries | PWA audit M8 | Step 13 | ✅ |
| Scroll-snap for inbox | PWA audit M2 | Step 13 | ✅ |
| Pull-to-refresh | My review + PWA audit M5 | Step 13 | ✅ |
| Font loading strategy | PWA audit L4 | Step 14 | ✅ |
| `scrollbar-gutter: stable` | My review | Step 14 | ✅ |
| `display-mode: standalone` overscroll | My review | Step 14 | ✅ |

## CLAUDE.md Compliance

- [x] Components in app package only (not shared)
- [x] Barrel imports from `@coop/shared`
- [x] Single root `.env.local` only
- [x] No new dependencies
- [x] Conventional commits with scope

## Impact Analysis

### Files to Modify

| File | Changes |
|------|---------|
| `packages/app/src/app.tsx` | Extract 3 view sections into separate components; extract icon components; wire Dialog + BottomSheet + ViewTransition; add skeleton states |
| `packages/app/src/styles.css` | Add 8 missing classes; replace magic values with tokens; add dialog/sheet/skeleton/transition styles; add dark mode block; add container queries |
| `packages/shared/src/styles/tokens.css` | Add alpha tokens via `color-mix()`; add radius/spacing tokens for missing scales; add dark mode `@media` block |
| `packages/shared/src/styles/a11y.css` | Add touch target minimums; add live region helpers |
| `packages/app/index.html` | Add `apple-touch-icon`; fix theme-color; add font preload hints |
| `packages/app/public/manifest.webmanifest` | Align theme_color |

### Files to Create

| File | Purpose |
|------|---------|
| `packages/app/src/components/Dialog.tsx` | Native `<dialog>` wrapper with focus management and backdrop |
| `packages/app/src/components/BottomSheet.tsx` | Sliding panel with drag handle and snap points |
| `packages/app/src/components/Skeleton.tsx` | Pulsing placeholder cards |
| `packages/app/src/components/Button.tsx` | Shared button with size/variant props |
| `packages/app/src/components/Card.tsx` | Shared card wrapper |
| `packages/app/src/components/SyncPill.tsx` | Sync status pill |
| `packages/app/src/views/Receiver/PairView.tsx` | Extracted pair route view |
| `packages/app/src/views/Receiver/CaptureView.tsx` | Extracted capture route view |
| `packages/app/src/views/Receiver/InboxView.tsx` | Extracted inbox route view |
| `packages/app/src/views/Receiver/ReceiverShell.tsx` | Shared shell (topbar + main + appbar) |
| `packages/app/src/views/Receiver/icons.tsx` | Extracted appbar icon components |

## Test Strategy

- **Unit tests**: New components (`Dialog`, `BottomSheet`, `Skeleton`, `Button`) each get a test file. Expect ~8 new test files.
- **Existing tests**: `QrScannerA11y.test.tsx` must be updated for `<dialog>` migration. `ReceiverApp.test.tsx` must be updated for extracted views. `BoardApp.test.tsx` should be updated once `.summary-card` / `.empty-state` are styled.
- **Validation**: `bun format && bun lint && bun run test && bun build` after every step.

---

## Implementation Steps

### Phase 0: Ship-Blocking Fixes (1 PR)

#### Step 1: Define 8 missing CSS classes
**Files**: `packages/app/src/styles.css`
**Details**:
- `.stack` — `display: grid; gap: var(--coop-space-md);` (vertical stack layout)
- `.detail-grid` — 2-column grid, `gap: var(--coop-space-sm)`, items aligned top
- `.helper-text` — `font-size: 0.82rem; color: var(--coop-brown-soft); margin: 0.15rem 0 0;`
- `.summary-card` — Match existing `.board-story-stats div` pattern: `padding: 0.85rem; border-radius: 18px; background: rgba(79, 46, 31, 0.06); display: grid; gap: 0.15rem;`
- `.empty-state` — Match existing `.empty-nest` pattern: `border-radius: 24px; padding: 1.2rem; border: 1px dashed var(--coop-line); background: rgba(255, 255, 255, 0.64); color: var(--coop-brown-soft);`
- `.source-link` — `color: var(--coop-green); text-decoration: underline; text-underline-offset: 2px; word-break: break-all;`
- `.badge-row` — `display: flex; gap: 0.45rem; flex-wrap: wrap;`
- `.badge` — Match existing `.sync-pill` pattern: `display: inline-flex; align-items: center; padding: 0.3rem 0.65rem; border-radius: var(--coop-radius-pill); background: rgba(79, 46, 31, 0.08); font-size: 0.75rem; font-weight: 700;`
**Verify**: All 8 classes render visually in Board and Pair views; `bun build` passes.

#### Step 2: Migrate QR scanner to native `<dialog>`
**Files**: `packages/app/src/app.tsx`, `packages/app/src/styles.css`, `packages/app/src/__tests__/QrScannerA11y.test.tsx`
**Details**:
- Replace `<div className="stack" role="dialog" aria-modal="true">` (line 720) with `<dialog ref={qrDialogRef}>` element
- Use `dialogRef.current.showModal()` when `isQrScannerOpen` becomes true, `.close()` when false
- Add `::backdrop` styling: `background: rgba(39, 20, 14, 0.6); backdrop-filter: blur(6px);`
- Add dialog animation: slide-up + fade-in via `@starting-style` (with instant fallback)
- Set `inert` attribute on `.receiver-main` when dialog is open (matches extension's OnboardingOverlay pattern)
- Update `QrScannerA11y.test.tsx` to query for `<dialog>` element instead of `role="dialog"` div
- Remove `biome-ignore lint/a11y/useSemanticElements` comment (no longer needed)
**Verify**: QR scanner opens with backdrop, traps focus, closes on Escape; a11y test passes; `bun run test` passes.

#### Step 3: Add `apple-touch-icon` + fix theme-color + `dvh`
**Files**: `packages/app/index.html`, `packages/app/public/manifest.webmanifest`, `packages/app/src/styles.css`
**Details**:
- Add `<link rel="apple-touch-icon" sizes="180x180" href="/branding/coop-mark-flat-192.png">` to `index.html` `<head>`
- Change `index.html` `<meta name="theme-color">` from `#f4efe4` to `#4f2e1f` (match manifest)
- In `styles.css`: add `min-height: 100dvh` after every `min-height: 100vh` (lines 49, 979)
**Verify**: iOS home screen icon correct; theme-color consistent; `bun build` passes.

---

### Phase 1: Component Extraction (1 PR)

#### Step 4: Extract receiver view components
**Files**: Create `PairView.tsx`, `CaptureView.tsx`, `InboxView.tsx`, `ReceiverShell.tsx`, `icons.tsx` in `packages/app/src/views/Receiver/`. Modify `packages/app/src/app.tsx`.
**Details**:
- Create `icons.tsx` — move `ReceiverPairIcon`, `ReceiverCaptureIcon`, `ReceiverInboxIcon` + `receiverNavItems` array out of `app.tsx`
- Create `ReceiverShell.tsx` — extract the topbar + main + appbar shell wrapper. Props: `{ route, navigate, online, pairingStatus, captures, children }`
- Create `PairView.tsx` — extract the `route.kind === 'pair'` JSX block (lines 673-797). Props: pairing flow state + settings actions
- Create `CaptureView.tsx` — extract the `route.kind === 'receiver'` JSX block (lines 799-942). Props: capture state + navigation
- Create `InboxView.tsx` — extract the `route.kind === 'inbox'` JSX block (lines 944-1044). Props: captures + actions
- Update `app.tsx` to import and render these components. `RootApp` should drop to ~350 lines (hooks + effects + routing + component composition)
- Keep all hooks in `app.tsx` — views receive state via props
**Verify**: All existing tests pass unchanged (same DOM structure); `bun run test && bun build` passes. Manual check: all three receiver routes render identically.

#### Step 5: Extract shared UI components
**Files**: Create `packages/app/src/components/Button.tsx`, `Card.tsx`, `SyncPill.tsx`
**Details**:
- `Button.tsx` — `{ variant: 'primary' | 'secondary'; size?: 'default' | 'small'; children; onClick; type? }`. Renders `<button className="button button-{variant} button-{size}">`. Centralizes touch-action and active-state behavior.
- `Card.tsx` — `{ variant?: 'nest' | 'receiver' | 'empty'; className?; children }`. Renders `<article className="nest-card receiver-card {variant-class}">`.
- `SyncPill.tsx` — `{ state: ReceiverCapture['syncState'] }`. Renders `<span className="sync-pill is-{state}">`.
- Update `PairView`, `CaptureView`, `InboxView` to use these components (replace repeated class strings)
- Do NOT update Landing or Board views in this step (minimize blast radius)
**Verify**: `bun run test && bun build` passes. No visual change.

---

### Phase 2: Loading & Transitions (1 PR)

#### Step 6: Add skeleton loading states
**Files**: Create `packages/app/src/components/Skeleton.tsx`. Modify `packages/app/src/styles.css`, `packages/app/src/app.tsx`.
**Details**:
- `Skeleton.tsx` — `{ variant: 'card' | 'pill' | 'text'; count?: number }`. Renders pulsing placeholder elements using CSS `@keyframes skeleton-pulse`.
- Add CSS: `.skeleton { border-radius: var(--coop-radius-card); background: linear-gradient(90deg, rgba(79,46,31,0.06) 25%, rgba(79,46,31,0.12) 50%, rgba(79,46,31,0.06) 75%); background-size: 200% 100%; animation: skeleton-pulse 1.5s ease infinite; }` with `@keyframes skeleton-pulse { to { background-position: -200% 0; } }`
- Add `isLoading` state to `RootApp` — true until first `refreshLocalState()` completes
- Show `<Skeleton variant="card" count={2} />` in receiver-main when `isLoading`
- Respect `prefers-reduced-motion`: disable animation, show static gray block instead
**Verify**: First paint shows skeleton cards; skeleton disappears after load; reduced-motion shows static placeholder; `bun run test && bun build` passes.

#### Step 7: Add view transitions between receiver routes
**Files**: `packages/app/src/app.tsx` (navigate function), `packages/app/src/styles.css`
**Details**:
- Wrap `setRoute()` in navigate function with `document.startViewTransition?.()`:
  ```ts
  const nextRoute = resolveRoute(nextPath);
  if (document.startViewTransition) {
    document.startViewTransition(() => setRoute(nextRoute));
  } else {
    setRoute(nextRoute);
  }
  ```
- Add CSS view-transition rules:
  ```css
  ::view-transition-old(root) { animation: fade-out 150ms ease; }
  ::view-transition-new(root) { animation: fade-in 150ms ease; }
  @keyframes fade-out { to { opacity: 0; } }
  @keyframes fade-in { from { opacity: 0; } }
  ```
- Gate behind `@media (prefers-reduced-motion: no-preference)` — reduced-motion users get instant swap
**Verify**: Tab switches show cross-fade in Chrome/Edge; Safari 18+ works; older browsers get instant swap (graceful degradation); `bun build` passes.

---

### Phase 3: Design System & Polish (1 PR)

#### Step 8: Bottom sheet for settings drawer
**Files**: Create `packages/app/src/components/BottomSheet.tsx`. Modify `packages/app/src/styles.css`, `ReceiverShell.tsx`.
**Details**:
- `BottomSheet.tsx` — Uses `<dialog>` element (consistent with Step 2 pattern). Props: `{ open; onClose; title?; children }`.
- Renders: `<dialog>` with drag handle bar at top, scrollable content area, `::backdrop`
- CSS: positioned `fixed; bottom: 0; left: 0; right: 0;` with `border-radius: 24px 24px 0 0;` and `max-height: 70vh; max-height: 70dvh;`
- Slide-up animation: `transform: translateY(100%)` → `translateY(0)` on open
- Touch-drag-to-dismiss: `onTouchStart`/`onTouchMove`/`onTouchEnd` handlers tracking vertical drag. If dragged > 30% of sheet height, close.
- Replace `<details className="receiver-settings-drawer">` in ReceiverShell with settings button that opens `<BottomSheet>`
- Move settings content (status grid, actions) into the sheet body
**Verify**: Settings open as bottom sheet; drag-to-dismiss works on touch; backdrop closes on tap; Escape closes; `bun run test && bun build` passes.

#### Step 9: Design token consolidation
**Files**: `packages/shared/src/styles/tokens.css`, `packages/app/src/styles.css`
**Details**:
- **Add missing radius tokens** to `tokens.css`:
  - `--coop-radius-card-lg: 28px;` (board cards, hero-art)
  - `--coop-radius-card-xl: 30px;` (hero-art, nest-card outer)
  - `--coop-radius-input-lg: 20px;` (appbar links, relationship cards)
  - `--coop-radius-photo: 18px;` (photos, audio, timeline steps, receipt cards)
- **Add alpha color tokens** to `tokens.css` using `color-mix()`:
  - `--coop-brown-4: color-mix(in srgb, var(--coop-brown) 4%, transparent);`
  - `--coop-brown-6: color-mix(in srgb, var(--coop-brown) 6%, transparent);`
  - `--coop-brown-8: color-mix(in srgb, var(--coop-brown) 8%, transparent);`
  - `--coop-brown-12: color-mix(in srgb, var(--coop-brown) 12%, transparent);`
  - `--coop-brown-14: color-mix(in srgb, var(--coop-brown) 14%, transparent);`
  - `--coop-brown-16: color-mix(in srgb, var(--coop-brown) 16%, transparent);`
  - `--coop-brown-18: color-mix(in srgb, var(--coop-brown) 18%, transparent);`
  - `--coop-green-12: color-mix(in srgb, var(--coop-green) 12%, transparent);`
  - `--coop-green-14: color-mix(in srgb, var(--coop-green) 14%, transparent);`
  - `--coop-green-16: color-mix(in srgb, var(--coop-green) 16%, transparent);`
  - `--coop-orange-15: color-mix(in srgb, var(--coop-orange) 15%, transparent);`
  - `--coop-orange-16: color-mix(in srgb, var(--coop-orange) 16%, transparent);`
  - `--coop-orange-18: color-mix(in srgb, var(--coop-orange) 18%, transparent);`
- **Replace all raw values** in `styles.css`:
  - `rgba(79, 46, 31, 0.12)` → `var(--coop-brown-12)` (and all other alphas)
  - `border-radius: 24px` → `var(--coop-radius-card)` etc.
  - `border-radius: 999px` → `var(--coop-radius-pill)`
  - `gap: 1rem` → `var(--coop-space-md)` where semantically appropriate
- **Add missing spacing tokens** for off-scale values used frequently:
  - `--coop-space-2xs: 0.2rem;`
  - `--coop-space-3xs: 0.15rem;`
- Target: 90%+ of values reference tokens. Accept that a few one-off decorative values (gradients, egg-button shape) stay literal.
**Verify**: No visual change (pixel-identical rendering); `bun format && bun lint && bun build` passes. Extension styles also import `tokens.css` — verify extension build too.

---

### Phase 4: Accessibility & UX (1 PR)

#### Step 10: Touch target minimums
**Files**: `packages/shared/src/styles/a11y.css`, `packages/app/src/styles.css`
**Details**:
- Add to `a11y.css`: `button, a, [role="button"], input, select, textarea { min-height: 44px; }` scoped under `.receiver-shell` to avoid affecting landing/board desktop views
- Increase `.button-small` padding from `0.7rem 1rem` to `0.75rem 1rem` and add `min-height: 44px`
- Increase `.receiver-status-chip` padding from `0.3rem 0.65rem` to `0.45rem 0.75rem`
- Increase `.receiver-appbar-link` padding from `0.55rem 0.45rem` to `0.6rem 0.5rem`
- Status dots (7px) are not interactive — no change needed (confirm they have no click handler)
**Verify**: All receiver interactive elements ≥ 44px tall; `bun build` passes.

#### Step 11: Egg button a11y + ErrorBoundary tokens
**Files**: `packages/app/src/app.tsx` (or `CaptureView.tsx` after Step 4), `packages/app/src/styles.css`
**Details**:
- Add `aria-pressed={isRecording}` to the egg button
- Add `<span role="status" aria-live="polite" className="sr-only">` near the egg button that announces `"Recording started"` / `"Recording saved"` / `"Recording cancelled"`
- Replace ErrorBoundary inline styles with CSS classes: `.error-boundary`, `.error-boundary-message`, `.error-boundary-button`. Define in `styles.css` using design tokens.
**Verify**: Screen reader announces recording state changes; error boundary renders with brand-consistent styling; `bun run test && bun build` passes.

#### Step 12: Dark mode
**Files**: `packages/shared/src/styles/tokens.css`, `packages/app/src/styles.css`
**Details**:
- Add `@media (prefers-color-scheme: dark)` block to `tokens.css` that inverts core palette:
  ```css
  --coop-cream: #1a1410;
  --coop-brown: #e8d5c4;
  --coop-brown-soft: #b8a090;
  --coop-green: #8ab840;
  --coop-orange: #ffaa44;
  --coop-mist: #3a3632;
  --coop-ink: #f0e8e0;
  --coop-error: #ff6b4a;
  ```
- Update `color-mix()` alpha tokens — they automatically recalculate against new base colors
- Add dark-mode overrides for gradients in `styles.css` body background, receiver-shell background, card backgrounds
- Update `--coop-shadow-*` tokens for dark mode (lighter shadows on dark surfaces don't work — switch to darker shadows or subtle glows)
- Update `--coop-line` border color for dark mode
**Verify**: System dark mode shows inverted palette; all text readable; cards visible; `bun build` passes. Test by toggling system appearance.

---

### Phase 5: Modern CSS & Polish (1 PR)

#### Step 13: Container queries + scroll-snap + pull-to-refresh
**Files**: `packages/app/src/styles.css`, `packages/app/src/app.tsx` (or `InboxView.tsx`)
**Details**:
- **Container queries**: Add `container-type: inline-size` to `.receiver-grid`. Add `@container (max-width: 20rem)` rules for `.nest-item-card` to stack content vertically at narrow widths.
- **Scroll-snap**: Add `scroll-snap-type: y proximity` to `.receiver-main`. Add `scroll-snap-align: start` to `.nest-item-card`. Use `proximity` (not `mandatory`) to avoid jarring snapping.
- **Pull-to-refresh**: Add `onTouchStart`/`onTouchMove`/`onTouchEnd` handlers on `.receiver-main`. When overscrolled past top by >60px with `scrollTop === 0`, show a pull indicator and call `refreshLocalState()` on release. CSS: `.pull-indicator` with rotate animation on the coop mark icon.
**Verify**: Cards adapt at narrow container widths; inbox scrolls with snap alignment; pull-to-refresh triggers data reload; `bun run test && bun build` passes.

#### Step 14: Font strategy + minor CSS polish
**Files**: `packages/app/index.html`, `packages/app/src/styles.css`, `packages/shared/src/styles/tokens.css`
**Details**:
- **Font metrics**: Add `font-size-adjust` to body and heading rules for cross-platform consistency when "Avenir Next" is unavailable
- **Scrollbar gutter**: Add `scrollbar-gutter: stable` to `.receiver-main` alongside existing `scrollbar-width: none` (belt-and-suspenders for edge cases)
- **Standalone overscroll**: Add `@media (display-mode: standalone) { html { overscroll-behavior: none; } }` to `styles.css` (removes JS class toggle dependency)
- **Text wrapping**: Add `text-wrap: balance` to `.receiver-screen-title`, `.hero-copy h1`, `.section-heading h2`
**Verify**: No visual regression on Chrome/Safari; text reflows balanced; `bun build` passes.

---

## Validation

After each step:
```bash
bun format && bun lint && bun run test && bun build
```

After full plan:
```bash
bun run validate full
```

## Phase Sizing Estimate

| Phase | Steps | New Files | Modified Files |
|-------|-------|-----------|----------------|
| Phase 0: Ship-blocking | 1-3 | 0 | 4 |
| Phase 1: Extraction | 4-5 | 8 | 2 |
| Phase 2: Loading + transitions | 6-7 | 1 | 2 |
| Phase 3: Design system | 8-9 | 1 | 2 |
| Phase 4: Accessibility | 10-12 | 0 | 4 |
| Phase 5: Modern CSS | 13-14 | 0 | 3 |
| **Total** | **14** | **10** | **~6 unique** |
