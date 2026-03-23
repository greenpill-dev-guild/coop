---
title: "UI Review Issues"
slug: /reference/ui-review-issues
sidebar_label: UI Review Issues
---

# UI Review - Issues, Regressions & Confusion Areas

**Date**: 2026-03-13
**Branch**: `release/0.0`
**Reviewer**: Claude Code (deep codebase audit)
**Validated**: All 20 claims verified against source code. Corrections applied.

**Last Re-Audited**: 2026-03-22 — Major restructuring of extension UI. File references, line numbers, status labels, and tab names updated.

---

## Critical Issues

### 1. Monolithic Component Architecture
**Severity**: High (maintainability, testability)
**Status**: RESOLVED (2026-03-22 re-audit)

- `packages/app/src/app.tsx`: ~~1,771 lines~~ **836 lines** (components extracted)
- `packages/extension/src/views/Sidepanel/SidepanelApp.tsx`: ~~3,135 lines~~ ~~1,055 lines~~ **174 lines** (thin shell; logic fully decomposed)
- `packages/extension/src/background.ts`: ~~5,794 lines~~ **737 lines** (handlers extracted to `background/handlers/`)
- `packages/extension/src/views/Popup/PopupApp.tsx`: **88 lines** (thin shell; routing via `PopupScreenRouter.tsx`)

**Sidepanel decomposition** (from the former monolith):
- `SidepanelTabRouter.tsx` (217 lines) — tab switch/render logic
- `hooks/useSidepanelOrchestration.ts` (1,163 lines) — all sidepanel action handlers
- `hooks/useDashboard.ts` (360 lines) — dashboard data, derived state, push-notification listener
- `hooks/useSyncBindings.ts` (212 lines) — Yjs/WebRTC sync lifecycle per coop
- `hooks/useOnboarding.ts` (99 lines) — onboarding state + chrome.storage.sync migration
- `hooks/useCoopForm.ts`, `hooks/useDraftEditor.ts`, `hooks/useTabCapture.ts` — domain-specific hooks
- `tabs/RoostTab.tsx` (160), `tabs/ChickensTab.tsx` (356), `tabs/CoopsTab.tsx` (193), `tabs/NestTab.tsx` (890) — per-tab components
- `tabs/NestAgentSection.tsx`, `tabs/NestArchiveSection.tsx`, `tabs/NestInviteSection.tsx`, `tabs/NestReceiverSection.tsx`, `tabs/NestSettingsSection.tsx` — Nest sub-sections
- `operator-sections/` directory (11 files) — replaces deleted `operator-sections.tsx`
- `TabStrip.tsx` (160), `TabCoopSelector.tsx` (38), `OperatorConsole.tsx` (198), `cards.tsx` (712), `helpers.ts` (176)

**Popup decomposition**:
- `PopupScreenRouter.tsx` (143 lines) — screen switch/render
- `hooks/usePopupOrchestration.ts` (899 lines) — all popup state and action handlers
- Individual screen components: `PopupHomeScreen`, `PopupDraftListScreen`, `PopupFeedScreen`, `PopupProfilePanel`, `PopupCreateCoopScreen`, `PopupJoinCoopScreen`, `PopupNoCoopScreen`, `PopupDraftDetailScreen`

**Remaining**: `useSidepanelOrchestration.ts` (1,163 lines) and `usePopupOrchestration.ts` (899 lines) are large but contain action handler wiring, not rendering logic. Further extraction possible but not critical.

### 2. Polling-Based State Updates (No Event-Driven Architecture)
**Severity**: High (performance, battery)
**Status**: PARTIALLY RESOLVED (2026-03-22 re-audit)

- ~~Extension sidepanel polls dashboard every 3.5 seconds~~ **RESOLVED**: Sidepanel now uses `chrome.runtime.onMessage` listener for `DASHBOARD_UPDATED` push notifications from background (`hooks/useDashboard.ts:296-309`). No polling timer.
- Receiver app runs reconciliation every **2 seconds** (`app.tsx` — reconciliation interval, exact line varies)
- QR scanner polls with BarcodeDetector every **500ms** (`app.tsx` — BarcodeDetector loop, exact line varies)

**Impact**: Receiver app and QR scanner still use polling. Sidepanel battery concern is resolved.

### 3. No Loading States or Skeletons
**Severity**: Medium (UX)
**Status**: RESOLVED (2026-03-15 re-audit)

- Skeleton component added: `packages/app/src/components/Skeleton.tsx`
- Skeleton loading patterns in: `SidepanelApp.tsx`, tab components, `cards.tsx`
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
**Status**: RESOLVED (2026-03-22 re-audit)

- ~~Onboarding uses `localStorage.setItem('coop-onboarding-complete', '1')` (`sidepanel-app.tsx:784`)~~ **Now uses `chrome.storage.sync`** as the primary store (`hooks/useOnboarding.ts:27, 75`).
- One-time migration from `localStorage` to `chrome.storage.sync` is implemented (`useOnboarding.ts:30-49`): detects legacy `localStorage` flag, copies to sync storage, and removes the local entry.
- UI preferences also use `chrome.storage.sync` (`background.ts`) — storage is now consistent.
- Onboarding overlay focus management also improved: uses `inert` attribute on siblings and auto-focuses the primary button (`OnboardingOverlay.tsx:31-51, 54-57`).

### 6. Legacy Chain Key Normalization
**Severity**: Low (tech debt)
**Status**: CONFIRMED, runs on every parse via `z.preprocess()`

- `schema.ts` defines `legacyOnchainChainKeyMap` converting `celo`->`arbitrum`, `celo-sepolia`->`sepolia`
- Uses `z.preprocess(normalizeLegacyOnchainState, ...)` on the onchain state schema
- This runs on every `.parse()` or `.safeParse()` call. Should be a one-time migration or removed if no legacy data exists

---

## UX Confusion Areas

### 7. Terminology Inconsistency Across Surfaces
**Severity**: Medium (user comprehension)
**Status**: PARTIALLY RESOLVED (2026-03-22 re-audit)

| Concept | Extension Sidepanel | Extension Popup | E2E Tests | Landing Page |
|---------|-------------------|-----------------|-----------|--------------|
| Tab queue | "Chickens" tab | Drafts screen | "Loose Chickens" | "Loose Chickens" |
| Review queue | "Roost" tab | Home screen | "Roost" | "Roost" |
| Shared feed | "Coops" tab | Feed screen | "Coop Feed" (stale) | "Coop Feed" |
| Settings | "Nest" tab | Profile panel | "Nest" / "Nest Tools" (stale) | |
| Capture action | "Round up" | "Round up" / capture buttons | "Round up" | "Round up" |
| Agent section | "Trusted Helpers" (in Nest) | | "Agent Skills"/"Helper Runs" | |

Current sidepanel tabs are `['roost', 'chickens', 'coops', 'nest']` (`SidepanelApp.tsx:8`). The old tab names `['Chickens', 'Roost', 'Home', 'Feed']` are no longer used.

E2E tests have been partially updated: `extension.spec.cjs` now uses exact names like `'Nest'`, `'Loose Chickens'`, `'Roost'` via `openPanelTab()`, but still references stale labels `'Coop Feed'` (now "Coops" tab) and `'Nest Tools'` (now within "Nest" tab). The `receiver-sync.spec.cjs` also references `'Flock Meeting'` and `'Coop Feed'` which no longer match tab names.

### 8. Receiver vs Extension Capture: Parallel Code Paths
**Severity**: Medium (architecture)
**Status**: CONFIRMED

Two completely separate capture systems:
- **Extension**: `tab-capture.ts` -> `chrome.scripting.executeScript()` -> `coop-extension` Dexie DB
- **Receiver**: `stashCapture()` -> `createReceiverCapture()` -> separate `receiverDb` with sync state lifecycle

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
- Stored in coop state via `flows.ts`
- Used for agent context logging and message payloads
- **No scheduling, cron, or trigger logic exists** that uses these values to conduct reviews

### 11. Board View: Limited Interactivity
**Severity**: Medium (UX flow)
**Status**: PARTIALLY CONFIRMED

- Board opens via deep link from extension (`/board/:coopId#snapshot=...`)
- Read-only graph: nodes not draggable/selectable, pan/zoom only
- **Has**: Collapsible sidebar via `<details>` elements, archive receipt links to Storacha gateway
- **Missing**: No actions to edit/publish/moderate content, no path back to extension (only "Back to landing")

### 12. Operator Console: Progressive Disclosure
**Severity**: Low-Medium
**Status**: RESOLVED (2026-03-22 re-audit)

- ~~All sections fully visible immediately, zero `<details>` or `<summary>` elements~~ **Now fully decomposed** into `operator-sections/` directory with 11 files.
- All operator sections now use `<details className="panel-card collapsible-card">` with `<summary>` elements for progressive disclosure. Verified in: `PermitSection.tsx`, `SkillManifestSection.tsx`, `KnowledgeSkillsSection.tsx`, `AgentObservationsSection.tsx`, `SessionCapabilitySection.tsx`, `GardenRequestsSection.tsx`, `AgentMemorySection.tsx`, `TrustedNestControlsSection.tsx`, `PolicyAndQueueSection.tsx`.
- Some sections default to `open` (e.g., `SkillManifestSection`, `AgentObservationsSection`), others start collapsed.

---

## Accessibility Gaps

### 13. Focus Management in Modals
**Severity**: Medium (a11y)
**Status**: PARTIALLY RESOLVED (2026-03-22 re-audit)

- ~~Onboarding overlay: no focus trap, no inert attribute~~ **RESOLVED**: `OnboardingOverlay.tsx` now sets `inert` on sibling elements (lines 31-51), auto-focuses primary button (lines 54-57), and handles Escape key (lines 71-76).
- QR scanner overlay (`PairingPanel.tsx`): No `role="dialog"`, no focus management — **still open**.
- Tab key can still reach elements behind the QR scanner overlay.

### 14. ~~Missing ARIA on Dynamic Content~~: PARTIALLY REGRESSED
**Status**: NEEDS VERIFICATION

- ~~Tab strip buttons had `aria-selected` and sync status had `aria-live="polite"` regions~~ — After the restructuring, `TabStrip.tsx` (160 lines) does **not** contain `aria-selected` or `aria-live` attributes. These may need to be re-added to `SidepanelFooterNav` in the new `TabStrip.tsx`.

Remaining gaps: Draft cards lack `aria-expanded` for collapsible editing state; agent dashboard updates have no live region announcements.

### 15. Keyboard Navigation Gaps
**Severity**: Low
**Status**: CONFIRMED, no `onKeyDown` handlers on tab strip

- Extension tab strip (`TabStrip.tsx`): no arrow-key navigation between tabs (only `onClick`)
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

- `app.tsx` creates/revokes blob URLs via `createPreviewUrl()`/`revokePreviewUrl()`
- No batching or guards to prevent rapid churn during frequent `refreshLocalState` cycles (every 2s when paired)

### 18. Sync Binding Per Coop: Lazy Init Present, No Pooling
**Severity**: Low
**Status**: CONFIRMED (updated file reference)

- Lazy initialization **IS present**: `hooks/useSyncBindings.ts:57` checks `if (!existing)` before creating bindings
- **No connection pooling**: Each coop gets its own full WebRTC + IndexedDB provider stack
- User in 5 coops = 5 separate WebRTC connections (but only created on demand)

---

## Test Coverage Gaps

### 19. E2E Test Staleness
**Severity**: Medium
**Status**: PARTIALLY RESOLVED (2026-03-22 re-audit)

~~E2E tests use regex fallbacks masking label mismatches.~~ The `openPanelTab` helper now uses `exact: true` matching in all E2E specs. However, some tab name references are stale:

- `extension.spec.cjs:245`: `openPanelTab(memberProfile.page, 'Coop Feed')` — tab is now "Coops"
- `extension.spec.cjs:247`: `openPanelTab(creatorProfile.page, 'Nest Tools')` — no such tab; content is within "Nest"
- `extension.spec.cjs:257, 420, 459`: `openPanelTab(..., 'Coop Feed')` — tab is now "Coops"
- `receiver-sync.spec.cjs:376`: `openPanelTab(reviewPage, 'Flock Meeting')` — no such tab
- `receiver-sync.spec.cjs:470, 476`: `openPanelTab(reviewPage, 'Coop Feed')` — tab is now "Coops"

These will fail at runtime because `exact: true` matching requires the exact current tab label.

### 20. Board View Minimal Test Coverage
**Severity**: Low-Medium
**Status**: CONFIRMED, exactly 2 `it()` blocks

- `BoardApp.test.tsx`: 2 test cases with comprehensive assertions (~15+ each)
- No tests for: edge styling, node card rendering by kind, archive story section, responsive layout, error/empty states

---

## Validated Recommendations (Priority Order)

1. ~~**Extract state into custom hooks**~~: DONE — `SidepanelApp.tsx` (174 lines), `PopupApp.tsx` (88 lines), `background.ts` (737 lines). Fully decomposed into orchestration hooks, tab components, screen routers, and operator-section components.
2. ~~**Replace polling with message-based updates**~~: DONE for sidepanel — `useDashboard.ts` uses `chrome.runtime.onMessage` listener for `DASHBOARD_UPDATED` push notifications. Receiver app still polls.
3. ~~**Add loading skeletons**~~: DONE — Skeleton component + CSS + tests added
4. **Unify terminology**: Pick one name per concept and enforce across all surfaces. Sidepanel tabs are now `['roost', 'chickens', 'coops', 'nest']`; E2E tests and onboarding steps still reference old names.
5. ~~**Add focus traps to modals**~~: DONE for onboarding overlay (inert + auto-focus). QR scanner overlay still needs focus management.
6. ~~**Progressive disclosure for Operator Console**~~: DONE — All operator sections now use `<details>/<summary>` with collapsible cards.
7. **Board view actions**: Add "Back to extension" link and share/export buttons
8. **Fix E2E test labels**: Replace stale `'Coop Feed'`, `'Nest Tools'`, `'Flock Meeting'` with current tab names (`'Coops'`, `'Nest'`)
9. **Document the meeting/ritual lifecycle**: Either implement scheduling or remove inert form fields
10. **Add arrow-key navigation to tab strip**: WAI-ARIA tabs pattern. Also re-add `aria-selected` to `TabStrip.tsx` (lost during restructuring).
11. **Re-add ARIA attributes to TabStrip**: `aria-selected` and `aria-live` regions were present in the old monolith but are missing from the new `TabStrip.tsx`.

### Removed from recommendations (verified as already done):
- ~~Verify audio migration~~: Migration is complete
- ~~Onboarding persistence mismatch~~: Now uses `chrome.storage.sync` with localStorage migration
- ~~Operator console progressive disclosure~~: All sections use `<details>/<summary>`
- ~~Sidepanel polling~~: Replaced with `chrome.runtime.onMessage` push
