# UI Review Fixes — Validated Recommendations

**GitHub Issue**: docs/ui-review-issues.md
**Branch**: `release/0.0`
**Status**: ACTIVE
**Created**: 2026-03-13
**Last Updated**: 2026-03-13

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Custom hooks extract into colocated files, not a `hooks/` dir | Keeps each hook next to its consumer; avoids premature centralization |
| 2 | Message-based updates via chrome.runtime.onMessage | Native Chrome API, zero deps, replaces 3.5s polling |
| 3 | CSS-only loading skeletons, no library | Matches existing vanilla CSS approach; small footprint |
| 4 | Canonical terminology from CLAUDE.md brand metaphors | Single source of truth already exists |
| 5 | Focus trap via inert attribute + focus() | No library needed; native `inert` has wide support |
| 6 | `<details>` for Operator Console sections | Already used successfully in Board sidebar |
| 7 | Keep E2E regex removal minimal | Only fix stale labels, don't restructure tests |
| 8 | Mark meeting settings as "coming soon" rather than removing | Preserves data model; honest about status |
| 9 | localStorage → chrome.storage.sync for onboarding | Matches existing UI prefs storage pattern |
| 10 | z.preprocess → migration script + direct schema | Removes per-parse overhead |

## Requirements Coverage

| Requirement | Step | Status |
|-------------|------|--------|
| Extract hooks from app.tsx | 1 | |
| Extract hooks from sidepanel-app.tsx | 2 | |
| Replace polling with messages (extension) | 3 | |
| Replace polling with messages (receiver) | 4 | |
| Add loading skeletons | 5 | |
| Unify terminology | 6 | |
| Focus traps for modals | 7 | |
| Progressive disclosure (Operator Console) | 8 | |
| Board view actions | 9 | |
| Fix E2E test labels | 10 | |
| Arrow-key tab navigation | 11 | |
| Onboarding persistence migration | 12 | |
| Legacy chain key one-time migration | 13 | |

## CLAUDE.md Compliance
- [ ] Barrel imports from @coop/shared
- [ ] Single root .env only
- [ ] Modules in shared package
- [ ] Validation passes: bun format && bun lint && bun run test && bun build

## Implementation Steps

### Step 1: Extract custom hooks from app.tsx (Receiver)
**Files**: `packages/app/src/app.tsx`, new hook files colocated
**Details**:
- Extract `useCapture()` — camera/mic/photo state, blob URL lifecycle, stashCapture logic
- Extract `useReceiverSync()` — pairing state, reconcilePairing interval, Yjs doc management
- Extract `usePairingFlow()` — QR scanning, BarcodeDetector polling, pair/unpair handlers
- Extract `useReceiverSettings()` — sound prefs, device identity, localStorage reads
- Each hook returns the state + handlers its consumer needs
- app.tsx becomes a thin shell importing and composing these hooks
**Verify**: `bun run test` passes, `bun build` succeeds

### Step 2: Extract custom hooks from sidepanel-app.tsx (Extension)
**Files**: `packages/extension/src/views/Sidepanel/sidepanel-app.tsx`, new hook files colocated
**Details**:
- Extract `useDashboard()` — dashboard fetch, coop selection, refresh logic
- Extract `useTabCapture()` — round-up logic, tab scanning, capture state
- Extract `useSyncBindings()` — Yjs provider creation, lazy init, connection management
- Extract `useDraftEditor()` — draft CRUD, publish flow, category assignment
- Extract `useCoopForm()` — create/join coop form state + submission
- sidepanel-app.tsx becomes primarily render logic composing these hooks
**Verify**: `bun run test` passes, extension builds

### Step 3: Replace polling with message-based updates (Extension)
**Files**: `packages/extension/src/background.ts`, `packages/extension/src/views/Sidepanel/sidepanel-app.tsx`
**Details**:
- In background.ts: after state changes (capture, sync, dashboard update), send `chrome.runtime.sendMessage({ type: 'DASHBOARD_UPDATED' })`
- In sidepanel: replace `setInterval(..., 3500)` with `chrome.runtime.onMessage.addListener` that calls refresh on `DASHBOARD_UPDATED`
- Keep a manual refresh button as fallback
- Remove the 3.5s polling interval
**Verify**: Dashboard updates when captures happen without polling

### Step 4: Replace polling in Receiver app
**Files**: `packages/app/src/app.tsx` (or extracted hook from Step 1)
**Details**:
- Replace 2s `reconcilePairing` interval with Yjs `doc.on('update', ...)` callback
- The QR scanner 500ms polling is inherent to BarcodeDetector API — add a note but keep it
- Add `doc.on('update')` listener that triggers reconciliation only on actual changes
**Verify**: Receiver syncs on Yjs updates, not on timer

### Step 5: Add loading skeletons
**Files**: `packages/extension/src/global.css`, `packages/extension/src/views/Sidepanel/sidepanel-app.tsx`, `packages/app/src/styles.css`, `packages/app/src/app.tsx`
**Details**:
- Add `.skeleton` CSS class with shimmer animation (pulse gradient)
- Extension: show skeleton cards in Chickens/Roost/Feed tabs during initial dashboard load
- Extension: show skeleton in header while first coop data loads
- App: show skeleton in Board view between snapshot extraction and ReactFlow mount
- App: show skeleton in Receiver during initial pairing reconciliation
**Verify**: Visual skeleton appears during load states, disappears when data ready

### Step 6: Unify terminology across surfaces
**Files**: All `.tsx` files, `e2e/*.cjs`
**Details**:
- Canonical terms from CLAUDE.md: Tabs = "Loose Chickens", review = "Roost", feed = "Coop Feed", capture = "Round up"
- Fix inconsistencies from Issue #7 table:
  - Review queue: standardize to "Roost" (remove "Inbox" usage in app)
  - Shared feed: standardize to "Coop Feed" (remove bare "Feed" in display text)
  - Capture action: standardize to "Round up" (remove "Hatch"/"Capture" for the action)
  - Agent section: standardize to "Trusted Helpers"
- Update E2E test assertions to match standardized terms
**Verify**: Grep for old terms confirms no stale references in user-facing strings

### Step 7: Add focus traps to modals
**Files**: `packages/extension/src/views/Sidepanel/onboarding-overlay.tsx`, `packages/app/src/app.tsx` (QR scanner section)
**Details**:
- Onboarding overlay: add `inert` attribute to content behind dialog, auto-focus first interactive element, trap Tab key within dialog
- QR scanner overlay: add `role="dialog"`, `aria-modal="true"`, `inert` on background content
- Both: handle Escape key to dismiss
- Both: restore focus to trigger element on close
**Verify**: Tab key stays within modal, Escape dismisses, focus returns on close

### Step 8: Progressive disclosure for Operator Console
**Files**: `packages/extension/src/views/Sidepanel/operator-console.tsx`
**Details**:
- Wrap each section (Trusted Helpers, Garden Requests, Approval Rules, Waiting Chores, Grants, Session Capabilities) in `<details>` + `<summary>`
- Default all to collapsed except the first section
- Style `<summary>` elements with coop design tokens
- Add chevron indicator via CSS `::marker` or `::before`
**Verify**: Sections collapse/expand, only first is open by default

### Step 9: Board view actions
**Files**: `packages/app/src/views/Board/index.tsx`, `packages/app/src/styles.css`
**Details**:
- Add "Open in Extension" link that uses `chrome-extension://` URL scheme (with graceful fallback if extension not installed)
- Add "Share snapshot" button that copies board URL to clipboard
- Add "Export as image" button using ReactFlow's `toObject()` → canvas → download
- Position action buttons in a toolbar above the graph
**Verify**: Actions render, share copies URL, export produces image

### Step 10: Fix E2E test labels
**Files**: `e2e/extension.spec.cjs`, `e2e/receiver-sync.spec.cjs`
**Details**:
- Replace `/^(Coops|Nest)$/i` with exact `'Home'`
- Replace `/^(Settings|Nest Tools)$/i` with exact `'Settings'` (or wherever this moved after Step 8)
- Replace `/^(Feed|Coop Feed)$/i` with `'Coop Feed'` (after Step 6 standardization)
- Remove all regex fallbacks for tab labels — use exact strings
- Update any other stale selectors found during the fix
**Verify**: `bun run test:e2e` passes with exact label matches

### Step 11: Add arrow-key navigation to tab strip
**Files**: `packages/extension/src/views/Sidepanel/sidepanel-app.tsx`
**Details**:
- Add `role="tablist"` to tab strip container
- Add `role="tab"` + `tabIndex` management to tab buttons (active = 0, others = -1)
- Add `onKeyDown` handler: ArrowLeft/ArrowRight cycle through tabs, Home/End jump to first/last
- Add `role="tabpanel"` + `aria-labelledby` to tab content panels
- Follow WAI-ARIA Tabs pattern exactly
**Verify**: Arrow keys move between tabs, screen reader announces tab selection

### Step 12: Migrate onboarding persistence
**Files**: `packages/extension/src/views/Sidepanel/sidepanel-app.tsx` (or onboarding-overlay.tsx)
**Details**:
- Replace `localStorage.setItem('coop-onboarding-complete', '1')` with `chrome.storage.sync.set({ 'coop-onboarding-complete': true })`
- Replace `localStorage.getItem('coop-onboarding-complete')` with async `chrome.storage.sync.get('coop-onboarding-complete')`
- Handle the async nature (show nothing until storage check completes, then show overlay or content)
- Add one-time migration: if localStorage has the flag but chrome.storage.sync doesn't, copy it over
**Verify**: Complete onboarding, check chrome.storage.sync has the flag. Works across Chrome profiles.

### Step 13: Legacy chain key one-time migration
**Files**: `packages/shared/src/contracts/schema.ts`, `packages/shared/src/modules/storage/db.ts`
**Details**:
- Remove `z.preprocess(normalizeLegacyOnchainState, ...)` from the onchain state schema
- Add a one-time migration function `migrateLegacyChainKeys()` in the storage module
- Call it during DB initialization (Dexie version upgrade hook or app startup)
- The migration reads existing onchain state, applies the chain key map, writes back
- After migration, schema validates without preprocessing on every parse
**Verify**: `bun run test` passes, schema parsing still handles both old and new chain keys during migration

## Validation
- [ ] `bun format && bun lint && bun run test && bun build`
- [ ] Extension popup and sidepanel render correctly
- [ ] Receiver app works in PWA mode
- [ ] E2E tests pass with exact labels
- [ ] Keyboard navigation works (arrow keys on tabs, focus traps on modals)
- [ ] Screen reader announces correctly (aria-live, aria-selected)

## Batch Execution Plan

**Batch 1** (Steps 1-2): Hook extraction — highest impact, enables all other work
**Batch 2** (Steps 3-5): Polling removal + loading skeletons — performance wins
**Batch 3** (Steps 6-8): Terminology + a11y + progressive disclosure — UX polish
**Batch 4** (Steps 9-11): Board actions + E2E fixes + tab navigation — completeness
**Batch 5** (Steps 12-13): Tech debt — persistence + schema fixes
