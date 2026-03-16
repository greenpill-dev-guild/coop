---
sidebar_label: UI Review Issues
sidebar_position: 5
---

# UI Review - Issues, Regressions & Confusion Areas

**Date**: 2026-03-13
**Branch**: `release/0.0`
**Reviewer**: Claude Code (deep codebase audit)
**Validated**: All 20 claims verified against source code. Corrections applied.

**Last Re-Audited**: 2026-03-15 — Status labels updated against current `main` branch.

---

## Critical Issues

### 1. Monolithic Component Architecture
**Severity**: High (maintainability, testability)
**Status**: LARGELY RESOLVED (2026-03-15 re-audit)

- `packages/app/src/app.tsx`: ~~1,771 lines~~ **518 lines** (major refactor, components extracted)
- `packages/extension/src/views/Sidepanel/SidepanelApp.tsx`: ~~3,135 lines~~ **1,055 lines** (hooks and components extracted)
- `packages/extension/src/background.ts`: ~~5,794 lines~~ **632 lines** (massive refactor)
- Extracted: `TabStrip.tsx`, `OperatorConsole.tsx`, `CoopSwitcher.tsx`, `cards.tsx`, `tabs.tsx`, `ArchiveSetupWizard.tsx`, `OnboardingOverlay.tsx`
- Custom hooks extracted: `useOnboarding`, `useSyncBindings`, `useCoopForm`, `useDraftEditor`, `useDashboard`, `useTabCapture`

**Remaining**: Files are still large by component standards but no longer monolithic. Further extraction possible but not critical.

### 2. Polling-Based State Updates (No Event-Driven Architecture)
**Severity**: High (performance, battery)
**Status**: CONFIRMED

- Extension sidepanel polls dashboard every **3.5 seconds** (`sidepanel-app.tsx:572-575`)
- Receiver app runs reconciliation every **2 seconds** (`app.tsx:1491-1493`)
- QR scanner polls with BarcodeDetector every **500ms** (`app.tsx:1020-1035`)

**Impact**: Unnecessary CPU/battery drain. Chrome may throttle the extension. Mobile devices especially affected.

### 3. No Loading States or Skeletons
**Severity**: Medium (UX)
**Status**: RESOLVED (2026-03-15 re-audit)

- Skeleton component added: `packages/app/src/components/Skeleton.tsx`
- Skeleton loading patterns in: `SidepanelApp.tsx`, `tabs.tsx`, `cards.tsx`
- Skeleton CSS in: `styles.css`, `global.css`
- Test coverage: `skeleton-loading.test.tsx`

**Remaining**: Board view initial load may still lack skeleton.

---

## Regressions & Tech Debt

### 4. ~~Audio Asset Format Migration Incomplete~~ - NOT A REGRESSION
**Status**: VERIFIED COMPLETE

- `.wav` files deleted, `.mp3` replacements added in both extension and app packages
- `playback.ts:6-10` correctly maps all sound events to `.mp3` files
- Both packages have identical audio files

~~No action needed.~~

### 5. Onboarding Persistence Mismatch
**Severity**: Low-Medium
**Status**: CONFIRMED

- Onboarding uses `localStorage.setItem('coop-onboarding-complete', '1')` (`sidepanel-app.tsx:784`)
- UI preferences use `chrome.storage.sync` (`background.ts:331-342`)
- Result: User completes onboarding on one machine, sees it again on another with the same Chrome profile

### 6. Legacy Chain Key Normalization
**Severity**: Low (tech debt)
**Status**: CONFIRMED, runs on every parse via `z.preprocess()`

- `schema.ts:746-749` defines `legacyOnchainChainKeyMap` converting `celo`→`arbitrum`, `celo-sepolia`→`sepolia`
- `schema.ts:814-815` uses `z.preprocess(normalizeLegacyOnchainState, ...)` on the onchain state schema
- This runs on every `.parse()` or `.safeParse()` call. Should be a one-time migration or removed if no legacy data exists

---

## UX Confusion Areas

### 7. Terminology Inconsistency Across Surfaces
**Severity**: Medium (user comprehension)
**Status**: CONFIRMED

| Concept | Extension Sidepanel | App (PWA) | E2E Tests | Landing Page |
|---------|-------------------|-----------|-----------|--------------|
| Tab queue | "Loose Chickens" |  | "Loose Chickens" | "Loose Chickens" |
| Review queue | "The Roost" | "Inbox" / "Roost" | "Roost" | "Roost" |
| Shared feed | "The Feed" / "Coop Feed" |  | "Coop Feed" / "Feed" | "Coop Feed" |
| Home/Settings | "Home" tab | "Pair" route | "Coops"/"Nest" (stale) |  |
| Capture action | "Round up" | "Hatch" / "Capture" | "Round up" | "Round up" |
| Agent section | "Trusted Helpers" |  | "Agent Skills"/"Helper Runs" |  |

Current sidepanel tabs are `['Chickens', 'Roost', 'Home', 'Feed']` (`sidepanel-app.tsx:77`). E2E tests use regex fallbacks for defunct labels like `/^(Coops|Nest)$/i` and `/^(Settings|Nest Tools)$/i`.

### 8. Receiver vs Extension Capture: Parallel Code Paths
**Severity**: Medium (architecture)
**Status**: CONFIRMED

Two completely separate capture systems:
- **Extension**: `tab-capture.ts` → `chrome.scripting.executeScript()` → `coop-extension` Dexie DB
- **Receiver**: `stashCapture()` → `createReceiverCapture()` → separate `receiverDb` with sync state lifecycle

Different UIs, different sync mechanisms, different status labels, independent storage.

### 9. Agent Confidence Threshold: Intentionally Low
**Severity**: Low (by design, not a bug)
**Status**: CONFIRMED, intentional calibration

- `AGENT_HIGH_CONFIDENCE_THRESHOLD = 0.24` (`agent-config.ts:10`)
- Comment explains: "Passive pipeline relevance scores for strong funding/opportunity pages currently cluster around the low 0.20s, so the agent trigger threshold needs to track that calibrated range instead of assuming a near-1.0 confidence scale."
- No user-facing control to adjust this threshold, consider exposing as a setting

### 10. Meeting/Ritual Settings: Unclear When They Apply
**Severity**: Low-Medium
**Status**: CONFIRMED, settings are stored but inert

- Meeting settings (`weeklyReviewCadence`, `facilitatorExpectation`, `defaultCapturePosture`) collected in forms
- Stored in coop state via `flows.ts:240-243`
- Used for agent context logging (`agent-runner.ts:297`) and message payloads
- **No scheduling, cron, or trigger logic exists** that uses these values to conduct reviews

### 11. Board View: Limited Interactivity
**Severity**: Medium (UX flow)
**Status**: PARTIALLY CONFIRMED

- Board opens via deep link from extension (`/board/:coopId#snapshot=...`)
- Read-only graph: nodes not draggable/selectable, pan/zoom only
- **Has**: Collapsible sidebar via `<details>` elements, archive receipt links to Storacha gateway
- **Missing**: No actions to edit/publish/moderate content, no path back to extension (only "Back to landing")

### 12. Operator Console: No Progressive Disclosure
**Severity**: Low-Medium
**Status**: CONFIRMED, zero `<details>` or `<summary>` elements

- All sections (Trusted Helpers, Garden Requests, Approval Rules, Waiting Chores, Permits, Session Capabilities) fully visible immediately
- Contrast: Board sidebar properly uses `<details>` for collapse, Operator Console lacks this pattern

---

## Accessibility Gaps

### 13. Focus Management in Modals
**Severity**: Medium (a11y)
**Status**: CONFIRMED

- Onboarding overlay (`onboarding-overlay.tsx:33-56`): Uses `<dialog>` with `aria-label` but **no focus trap, no inert attribute**
- QR scanner overlay (`PairingPanel.tsx`): No `role="dialog"`, no focus management
- Tab key can reach elements behind both overlays

### 14. ~~Missing ARIA on Dynamic Content~~: ALREADY IMPLEMENTED
**Status**: INCORRECT, features are present

- Tab strip buttons **do have** `aria-selected={panelTab === tab}` (`sidepanel-app.tsx:2268`)
- Sync status **does have** `<output aria-live="polite">` regions (`sidepanel-app.tsx:2280, 2284`)

~~No action needed for tab strip or sync status ARIA.~~

Remaining gaps: Draft cards lack `aria-expanded` for collapsible editing state; agent dashboard updates have no live region announcements.

### 15. Keyboard Navigation Gaps
**Severity**: Low
**Status**: CONFIRMED, no `onKeyDown` handlers on tab strip

- Extension tab strip: no arrow-key navigation between tabs (only `onClick`)
- Draft editor: no keyboard shortcut to save/publish
- Receiver egg button: Enter/Space works but no visual focus indicator beyond browser default

---

## Performance Concerns

### 16. Unbounded Yjs Document Growth
**Severity**: Medium (long-term)
**Status**: CONFIRMED, no gc/compaction/truncation in sync.ts or receiver/sync.ts

- Coop state stored as single Yjs Y.Map with 13 top-level keys
- Each key contains full arrays (all members, all artifacts, all receipts)
- Found `Y.encodeStateAsUpdate(doc)` but no `Y.gc()` or compaction logic
- Over time, active coops will accumulate unbounded CRDT history

### 17. Blob URL Lifecycle
**Severity**: Low
**Status**: CONFIRMED

- `app.tsx:249-257` creates/revokes blob URLs via `createPreviewUrl()`/`revokePreviewUrl()`
- No batching or guards to prevent rapid churn during frequent `refreshLocalState` cycles (every 2s when paired)

### 18. Sync Binding Per Coop: Lazy Init Present, No Pooling
**Severity**: Low
**Status**: PARTIALLY CONFIRMED

- Lazy initialization **IS present**: `sidepanel-app.tsx:655` checks `if (!existing)` before creating bindings
- **No connection pooling**: Each coop gets its own full WebRTC + IndexedDB provider stack
- User in 5 coops = 5 separate WebRTC connections (but only created on demand)

---

## Test Coverage Gaps

### 19. E2E Test Staleness
**Severity**: Medium
**Status**: CONFIRMED

E2E tests use regex fallbacks masking label mismatches:
- `extension.spec.cjs:182`: `/^(Coops|Nest)$/i` (no such tab exists; current: "Home")
- `extension.spec.cjs:242`: `/^(Settings|Nest Tools)$/i` (now collapsible inside Home)
- `extension.spec.cjs:235`: `/^(Feed|Coop Feed)$/i` (current: "Feed")

Tests may pass via regex fallback but test the wrong UI element.

### 20. Board View Minimal Test Coverage
**Severity**: Low-Medium
**Status**: CONFIRMED, exactly 2 `it()` blocks

- `BoardApp.test.tsx:166, 181`: 2 test cases with comprehensive assertions (~15+ each)
- No tests for: edge styling, node card rendering by kind, archive story section, responsive layout, error/empty states

---

## Validated Recommendations (Priority Order)

1. ~~**Extract state into custom hooks**~~: DONE — `app.tsx` (518 lines), `SidepanelApp.tsx` (1,055 lines), `background.ts` (632 lines). Hooks extracted: `useCapture`, `useSync`, `usePairing`, `useDashboard`, `useDraftEditor`, `useCoopForm`, `useOnboarding`, `useSyncBindings`, `useTabCapture`
2. **Replace polling with message-based updates**: Use `chrome.runtime.onMessage` from background to sidepanel instead of 3.5s polling
3. ~~**Add loading skeletons**~~: DONE — Skeleton component + CSS + tests added
4. **Unify terminology**: Pick one name per concept and enforce across all surfaces
5. **Add focus traps to modals**: Onboarding overlay, QR scanner
6. **Progressive disclosure for Operator Console**: Collapse advanced sections by default using `<details>`
7. **Board view actions**: Add "Back to extension" link and share/export buttons
8. **Fix E2E test labels**: Replace regex fallbacks with current tab names
9. **Document the meeting/ritual lifecycle**: Either implement scheduling or remove inert form fields
10. **Add arrow-key navigation to tab strip**: WAI-ARIA tabs pattern

### Removed from recommendations (verified as already done):
- ~~Verify audio migration~~: Migration is complete
- ~~Add aria-selected to tabs~~: Already implemented
- ~~Add aria-live for sync status~~: Already implemented
