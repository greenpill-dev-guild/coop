# UI Quality Hardening

**Branch**: `refactor/ui-quality-hardening`
**Status**: ACTIVE
**Created**: 2026-03-22
**Last Updated**: 2026-03-22

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Playwright visual snapshots over Storybook | Storybook adds build complexity for ~50 components; Playwright already configured with desktop + mobile projects |
| 2 | Add z-index tokens to tokens.css, not a JS constant | CSS-only design system — keep single source of truth in CSS custom properties |
| 3 | Add missing radius tokens (--coop-radius-button, --coop-radius-icon) rather than forcing existing ones | 10px and 14px are distinct design decisions, not sloppy usage of the 8px/16px tokens |
| 4 | Keep --popup-hero-* variables | Hero gradients are genuinely popup-specific; not worth abstracting into shared tokens |
| 5 | Promote shared --popup-* semantics up to tokens.css | --popup-text, --popup-border, --popup-panel-bg have sidepanel equivalents; unify as --coop-text, --coop-border, --coop-panel |
| 6 | Split operator-sections.tsx into directory before NestTab | NestTab depends on operator-sections; clean the dependency first |
| 7 | Dev catalog as a separate Vite entry, not a sidepanel route | Avoids polluting production bundle; can use same build pipeline |
| 8 | CSS token lint as a scripts/ utility, not a Biome rule | Biome doesn't support custom CSS rules; a simple grep-based script is sufficient |

## Requirements Coverage

| Requirement | Planned Step | Status |
|-------------|--------------|--------|
| Visual regression detection | Steps 1–2 | |
| Token adoption enforcement | Steps 3–4 | |
| Z-index scale | Step 5 | |
| Theme token consolidation | Step 6 | |
| Monolith decomposition | Steps 7–10 | |
| Component isolation (dev catalog) | Step 11 | |

## CLAUDE.md Compliance
- [x] No new packages — all changes in existing shared/extension
- [x] Barrel imports from @coop/shared for any new shared exports
- [x] Single root .env only
- [x] Tests use `bun run test` (vitest)

## Impact Analysis

### Files to Modify
- `packages/shared/src/styles/tokens.css` — Add z-index scale, new radius tokens, promoted semantic tokens
- `packages/extension/src/views/Popup/popup.css` — Replace hardcoded values with tokens, consolidate --popup-* into --coop-*
- `packages/extension/src/global.css` — Replace hardcoded values with tokens, use z-index tokens
- `packages/extension/src/views/Popup/PopupApp.tsx` — Extract screen renderers and data transforms
- `packages/extension/src/views/Sidepanel/SidepanelApp.tsx` — Extract tab routing and hook orchestration
- `packages/extension/src/views/Sidepanel/tabs/NestTab.tsx` — Break into section components
- `packages/extension/src/views/Sidepanel/operator-sections.tsx` — Split into directory of files
- `playwright.config.cjs` — Add visual comparison project
- `package.json` — Add visual test scripts

### Files to Create
- `e2e/visual-popup.spec.cjs` — Popup visual snapshot tests
- `e2e/visual-sidepanel.spec.cjs` — Sidepanel visual snapshot tests
- `scripts/lint-tokens.ts` — CSS token adoption linter
- `packages/extension/src/views/Sidepanel/operator-sections/` — Directory for split sections
- `packages/extension/src/views/Popup/screens/` — Extracted popup screen logic
- `packages/extension/src/catalog/` — Dev catalog entry point + page

## Test Strategy
- **Visual tests**: Playwright `toHaveScreenshot()` for popup (light+dark, each screen), sidepanel (light+dark, each tab)
- **Unit tests**: Existing tests must pass after all refactors (no behavior changes)
- **Lint**: `scripts/lint-tokens.ts` runs in CI, fails on hardcoded values that have token equivalents
- **Build**: `bun build` must succeed after each step

---

## Implementation Steps

### Step 1: Playwright visual testing infrastructure
**Files**: `playwright.config.cjs`, `package.json`
**Details**:
- Add a `visual` project to playwright.config.cjs using Desktop Chrome with a fixed viewport (1280×800 for sidepanel, 360×520 for popup)
- Add `test:visual` and `test:visual:update` scripts to package.json
- Configure `expect.toHaveScreenshot()` with `maxDiffPixelRatio: 0.01` threshold
- Store snapshots in `e2e/__screenshots__/`
**Verify**: `bun run test:visual --help` works, config parses without errors

### Step 2: Popup + sidepanel visual snapshot specs
**Files**: `e2e/visual-popup.spec.cjs`, `e2e/visual-sidepanel.spec.cjs`
**Details**:
- Popup spec: load extension popup, capture screenshots for each screen state (home, drafts list, feed, profile panel, create coop, join coop) in both light and dark themes
- Sidepanel spec: load sidepanel, capture each tab (Roost, Chickens, Coops, Nest) in light + dark
- Use existing `ensureExtensionBuilt` helper and extension loading pattern from `e2e/extension.spec.cjs`
- Each screenshot named descriptively: `popup-home-light.png`, `sidepanel-roost-dark.png`, etc.
**Verify**: `bun run test:visual --update-snapshots` generates baseline images

### Step 3: Add missing design tokens to tokens.css
**Files**: `packages/shared/src/styles/tokens.css`
**Details**:
Add to `:root` (and dark mode overrides):
```css
/* ── Z-index scale ── */
--coop-z-base: 0;
--coop-z-sticky: 1;
--coop-z-dropdown: 10;
--coop-z-tooltip: 20;
--coop-z-toast: 25;
--coop-z-modal: 30;
--coop-z-overlay: 100;

/* ── Additional radii ── */
--coop-radius-button: 14px;
--coop-radius-icon: 10px;
```
**Verify**: `bun build` succeeds, no test regressions

### Step 4: Replace hardcoded values in CSS with tokens
**Files**: `packages/extension/src/views/Popup/popup.css`, `packages/extension/src/global.css`
**Details**:
- Replace all `border-radius: 999px` → `var(--coop-radius-pill)` (14 occurrences)
- Replace all `border-radius: 14px` → `var(--coop-radius-button)` (11 occurrences)
- Replace all `border-radius: 10px` → `var(--coop-radius-icon)` (7 occurrences)
- Replace all `border-radius: 18px` → `var(--coop-radius-photo)` (7 occurrences)
- Replace all `border-radius: 8px` → `var(--coop-radius-sm)` (6 occurrences)
- Replace all `border-radius: 16px` → `var(--coop-radius-input)` (6 occurrences)
- Replace all `border-radius: 12px` → `var(--coop-radius-chip)` (3 occurrences)
- Replace all `border-radius: 22px` → `var(--coop-radius-card-lg)` with value update 22→22px or use closest (3 occurrences)
- Replace all `z-index: N` with `var(--coop-z-*)` equivalents (11 occurrences)
- Remove duplicate `skeleton-pulse` keyframe from popup.css (already in global.css)
**Verify**: `bun build` succeeds, visual snapshots match (run `bun run test:visual` — should pass since computed values are identical)

### Step 5: CSS token adoption lint script
**Files**: `scripts/lint-tokens.ts`
**Details**:
- Script that scans `.css` files in `packages/` for:
  - `border-radius: <raw px>` where a `--coop-radius-*` token exists for that value
  - `z-index: <raw number>` where a `--coop-z-*` token exists for that value
  - Raw hex colors (#xxx, #xxxxxx) that match a `--coop-*` palette color
- Output: file:line with the violation and suggested token
- Exit code 1 if violations found (CI-ready)
- Exclude `tokens.css` itself (that's where values are defined)
**Verify**: Script runs clean on the codebase after Step 4 fixes

### Step 6: Consolidate popup theme tokens into shared tokens
**Files**: `packages/shared/src/styles/tokens.css`, `packages/extension/src/views/Popup/popup.css`
**Details**:
Promote these --popup-* variables to shared --coop-* semantic tokens in tokens.css:
```css
--coop-text: var(--coop-brown);
--coop-text-soft: var(--coop-brown-soft);
--coop-border: var(--coop-line);
--coop-panel: <surface value>;
--coop-field: <input value>;
--coop-pill-bg: var(--coop-green-12);
--coop-pill-text: var(--coop-green);
--coop-primary: var(--coop-brown);
--coop-primary-contrast: #ffffff;
--coop-active-bg: <green 10%>;
--coop-active-border: <green 32%>;
```
With dark mode overrides in both `@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]`.

Then in popup.css:
- Replace `--popup-text` → `--coop-text` (and all other promoted tokens)
- Keep `--popup-hero-bg`, `--popup-hero-nest`, `--popup-hero-egg`, `--popup-page-background` as popup-specific
- Update all `var(--popup-text)` references in popup.css to `var(--coop-text)` etc.
- Update global.css sidepanel styles to use the same `--coop-text` etc. if they were using --coop-brown directly

**Verify**: `bun build` succeeds, visual snapshots pass (identical appearance), both popup and sidepanel render correctly in light + dark

### Step 7: Split operator-sections.tsx into directory
**Files**: `packages/extension/src/views/Sidepanel/operator-sections.tsx` → `packages/extension/src/views/Sidepanel/operator-sections/`
**Details**:
Create `operator-sections/` directory with:
- `index.ts` — re-exports all sections (barrel)
- `helpers.ts` — shared formatting functions (formatActionLabel, formatTimestamp, etc.)
- `SkillManifestSection.tsx`
- `KnowledgeSkillsSection.tsx`
- `GardenRequestsSection.tsx`
- `AgentObservationsSection.tsx`
- `TrustedNestControlsSection.tsx`
- `PolicyAndQueueSection.tsx`
- `SessionCapabilitySection.tsx`
- `PermitSection.tsx`
- `AgentMemorySection.tsx`

Each file gets its own imports and the relevant component. The barrel re-exports everything so NestTab imports don't change.
**Verify**: `bun run test` passes, `bun build` succeeds, imports from NestTab unchanged

### Step 8: Decompose NestTab.tsx
**Files**: `packages/extension/src/views/Sidepanel/tabs/NestTab.tsx`
**Details**:
NestTab has a ~90-prop interface and renders ~15 distinct sections. Split into:
- `NestTab.tsx` — Slim orchestrator that receives props and routes to sub-components
- `NestSettingsSection.tsx` — Coop settings (chain, space type, capture mode, exclusions)
- `NestArchiveSection.tsx` — Archive setup, receipts, snapshot controls
- `NestReceiverSection.tsx` — Receiver pairing, QR codes, device list
- `NestInviteSection.tsx` — Invite creation and display
- `NestAgentSection.tsx` — Agent/inference controls, observation triggers

Each sub-component receives only the props it needs (subset of NestTabProps).
**Verify**: `bun run test` passes, `bun build` succeeds, visual snapshots pass

### Step 9: Decompose SidepanelApp.tsx
**Files**: `packages/extension/src/views/Sidepanel/SidepanelApp.tsx`
**Details**:
Extract from the 1114-line monolith:
- `hooks/useSidepanelOrchestration.ts` — The ~200 lines of hook wiring (dashboard, sync bindings, draft editor, tab capture, coop form, inference bridge) into a single orchestration hook
- `SidepanelTabRouter.tsx` — The tab rendering switch + props assembly for each tab
- Keep `SidepanelApp.tsx` as a thin shell: calls orchestration hook, renders header + tab router + footer nav

Utility functions (`downloadText`, `PairDeviceIcon`) move to `helpers.ts`.
**Verify**: `bun run test` passes (update test imports if needed), `bun build` succeeds, visual snapshots pass

### Step 10: Decompose PopupApp.tsx
**Files**: `packages/extension/src/views/Popup/PopupApp.tsx`
**Details**:
Extract from the 1114-line monolith:
- `hooks/usePopupOrchestration.ts` — Dashboard loading, coop actions, capture actions, draft actions, sound preferences, form state, computed values (draft list items, feed items, coop labels)
- `PopupScreenRouter.tsx` — The screen rendering switch that maps PopupScreen → component with props
- Keep `PopupApp.tsx` as a thin shell: calls orchestration hook, renders shell + header + screen router + footer nav + overlays (dialog, profile, blocking notice)

Helper functions (`formatRelativeTime`, `normalizeCoopIds`, `formatCoopLabel`) move to a `helpers.ts` in Popup/.
**Verify**: `bun run test` passes (existing PopupApp.test.tsx may need import updates), `bun build` succeeds, visual snapshots pass

### Step 11: Dev catalog page
**Files**: `packages/extension/src/catalog/`
**Details**:
Create a lightweight dev-only component catalog:
- `catalog.html` — Vite entry point
- `catalog.tsx` — React mount
- `CatalogApp.tsx` — Renders key building blocks with controlled props:
  - Buttons: primary, secondary, ghost, inline (all states: default, hover, active, disabled)
  - Cards: panel-card, summary-card, draft-card, artifact-card
  - Badges & pills: state-pill, badge, mini-pill
  - Forms: field-grid with inputs, selects, textareas
  - Navigation: footer nav, tab strip, choice group
  - Overlays: tooltip, dialog, blocking notice
  - Theme: light/dark toggle showing both side-by-side
- Add `dev:catalog` script to extension package.json: `vite dev --config vite.catalog.config.ts`
- `vite.catalog.config.ts` — Minimal Vite config that imports shared tokens + global.css + popup.css
- Gate behind `NODE_ENV !== 'production'` — excluded from production build

**Verify**: `bun run --filter @coop/extension dev:catalog` opens in browser, all building blocks render correctly in both themes

## Validation
- [ ] `bun format && bun lint` passes
- [ ] `bun run test` passes (all existing unit tests)
- [ ] `bun build` succeeds
- [ ] `bun run test:visual` passes (visual snapshots match)
- [ ] `scripts/lint-tokens.ts` reports zero violations
- [ ] Dev catalog renders all building blocks in both themes
