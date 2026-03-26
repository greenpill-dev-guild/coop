# UI Action Coverage Hardening

**Branch**: `refactor/ui-action-coverage-hardening`
**Status**: ACTIVE
**Created**: 2026-03-25
**Last Updated**: 2026-03-25

## Context

Coop already has strong unit coverage in shared sync modules, background handlers, and many popup/sidepanel view tests. The weak point is action confidence across layers:

- popup actions are mostly validated with mocked runtime-message tests rather than real extension flows
- sidepanel action coverage is broad at the UI level, but uneven for full persistence-and-refresh verification
- sync is well tested in shared modules and has one strong receiver E2E, but lacks browser-level fault injection and UI-state verification
- on-chain flows have solid schema and mocked execution coverage, but limited repeatable end-to-end rehearsal from the extension surfaces

This plan closes those gaps without changing the extension dev-environment direction. WXT-driven environment improvements are explicitly out of scope here.

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Prioritize action-matrix coverage over broad snapshot expansion | Functional confidence is the current gap, not more screenshots |
| 2 | Add real-browser popup smoke tests before expanding sidepanel E2E | Popup has the weakest real Chrome API coverage today |
| 3 | Keep most deterministic validation in mock mode, with live probes as opt-in rehearsal | CI needs repeatability; live chain tests should stay explicit and bounded |
| 4 | Treat sync as a three-layer concern: shared CRDT logic, extension runtime filtering, browser E2E | No single layer proves the whole sync story |
| 5 | Add validation suites for high-value slices rather than only growing `bun run test` | Makes coverage executable for day-to-day work and review gates |
| 6 | Verify persistence through dashboard refresh where possible | A callback firing is weaker than observing stored state come back through the UI |

## Requirements Coverage

| Requirement | Planned Step | Status |
|-------------|--------------|--------|
| Popup actions validate end-to-end in a real extension session | Steps 1-2 | |
| Sidepanel actions verify persistence and refreshed state, not just callback wiring | Steps 3-4 | |
| Saving flows across notes, captures, drafts, share, archive, invite, and receiver intake are covered | Steps 2-4 | |
| Sync has browser-level coverage for pair, route, reconnect, and degraded-state UI | Steps 5-7 | |
| On-chain features have clear mock-path UI coverage plus explicit live rehearsal coverage | Steps 8-9 | |
| Validation scripts expose these slices as first-class quality gates | Step 10 | |
| Test inventory and remaining risk are documented for future audits | Step 11 | |

## CLAUDE.md Compliance

- [x] Test commands use `bun run test`, never `bun test`
- [x] No package-specific `.env` files
- [x] New behavior tests prefer existing extension/shared patterns before inventing new harnesses
- [x] Scope stays within app/extension/shared test and validation layers

## Impact Analysis

### Files to Modify

- `package.json` - add focused test scripts for popup/sidepanel/sync coverage slices
- `scripts/validate.ts` - register new validation suites for popup actions, sync hardening, and on-chain UI confidence
- `e2e/extension.spec.cjs` - expand or split high-value sidepanel workflows where that is the right browser harness
- `e2e/receiver-sync.spec.cjs` - extend receiver/sync scenarios for reconnect, multi-coop routing, and UI verification
- `e2e/helpers/extension-build.cjs` - reuse the current extension-build helper for any new browser suites
- `packages/extension/src/views/Popup/__tests__/PopupApp.test.tsx` - fill popup integration gaps where mocked tests are still the right layer
- `packages/extension/src/views/shared/__tests__/useCaptureActions.test.ts` - keep state-machine coverage aligned with new popup browser tests
- `packages/extension/src/views/Sidepanel/__tests__/SidepanelApp.test.tsx` - add dashboard-refresh-backed assertions for top-level actions
- `packages/extension/src/views/Sidepanel/__tests__/nest-sections.test.tsx` - deepen persistence assertions for invites, receiver intake, archive, and settings actions
- `packages/extension/src/views/Sidepanel/__tests__/operator-console.test.tsx` - add stronger action-queue and session-capability transition assertions
- `packages/extension/src/background/handlers/__tests__/*.test.ts` - extend storage/persistence verification where UI flows depend on them
- `packages/extension/src/runtime/__tests__/receiver.test.ts` - expand active-coop/member scoping and intake visibility edge cases
- `packages/shared/src/modules/coop/__tests__/sync.test.ts` - add reconnect/conflict/degraded transport cases
- `packages/shared/src/modules/receiver/__tests__/sync.test.ts` - add browser-like replication and recovery cases
- `scripts/probe-onchain-live.ts` - keep live Safe rehearsal aligned with UI expectations
- `scripts/probe-session-key-live.ts` - keep Smart Session rehearsal aligned with current product scope

### Files to Create

- `e2e/popup-actions.spec.cjs` - dedicated popup browser smoke suite for capture and note actions
- `e2e/sync-resilience.spec.cjs` - focused browser suite for reconnect, multi-profile sync, and degraded-state verification
- `packages/extension/src/views/Sidepanel/__tests__/action-persistence.integration.test.tsx` - sidepanel action matrix backed by dashboard refresh
- `packages/extension/src/views/Popup/__tests__/popup-actions.integration.test.tsx` - popup action matrix with mocked runtime but persistence-shaped assertions
- `packages/extension/src/background/handlers/__tests__/receiver-sync-routing.test.ts` - focused receiver routing and publish-path handler coverage
- `docs/testing/ui-action-coverage.md` - living map of action coverage, suites, and known gaps

## Test Strategy

- **Popup browser tests**: real extension Playwright flow for roundup, capture tab, screenshot review/save, file review/save, audio denial/retry, and popup recovery after failure
- **Popup integration tests**: keep deterministic hook/state coverage for navigation, pending capture state, and exact message contracts
- **Sidepanel integration tests**: verify high-value actions by observing dashboard state after action completion
- **Handler tests**: cover persistence contracts, outbox writes, receiver intake routing, and publish/archive/member-account mutations
- **Sync shared tests**: Yjs replication, malformed data recovery, reconnect, and transport health summaries
- **Sync browser tests**: pair receiver, publish to multiple coops, simulate degraded/recovered transport, verify UI indicators
- **On-chain tests**:
  - mock-path UI and handler tests for member-account/session/operator actions
  - opt-in live probes for Safe deployment and Smart Session rehearsal
- **Validation gates**: new targeted suites that can run independently during feature work and in review

## Implementation Steps

### Step 1: Create a popup browser smoke suite
**Files**: `e2e/popup-actions.spec.cjs`, `package.json`
**Details**:
- Add a dedicated Playwright suite for popup-only workflows instead of relying on visual snapshots and sidepanel-heavy E2E
- Cover:
  - roundup on a normal HTTPS page
  - capture active tab on a normal HTTPS page
  - screenshot review modal open/save/cancel
  - file review modal open/save/cancel
  - microphone denial and retry UI
  - popup remains usable after a failed capture action
- Use a dedicated persistent Chromium profile and extension loading pattern matching existing extension E2E
**Verify**: `bun run test:e2e:popup` passes locally in mock mode

### Step 2: Fill the popup action matrix at the integration-test layer
**Files**: `packages/extension/src/views/Popup/__tests__/PopupApp.test.tsx`, `packages/extension/src/views/Popup/__tests__/popup-actions.integration.test.tsx`, `packages/extension/src/views/shared/__tests__/useCaptureActions.test.ts`
**Details**:
- Add missing popup assertions for:
  - failed/zero-result roundup and capture-tab staying on Home
  - precise unsupported/permission-denied screenshot messaging
  - review modal for file and audio flows, not just screenshots
  - success path causing dashboard reload and visible state refresh
  - repeated action attempts while busy
- Keep message-contract tests close to `useCaptureActions`
**Verify**: popup unit/integration slice passes with no act warnings or brittle selector failures

### Step 3: Add a sidepanel action persistence matrix
**Files**: `packages/extension/src/views/Sidepanel/__tests__/action-persistence.integration.test.tsx`, `packages/extension/src/views/Sidepanel/__tests__/SidepanelApp.test.tsx`, `packages/extension/src/views/Sidepanel/__tests__/nest-sections.test.tsx`
**Details**:
- Add a focused suite that exercises high-value sidepanel actions and verifies the refreshed dashboard state rather than only callback invocation
- Cover:
  - create/join coop
  - publish/share to feed
  - invite create/revoke
  - receiver pairing generation and selection
  - archive snapshot / export affordances
  - settings toggles that should round-trip through dashboard refresh
- Reuse popup/sidepanel harness patterns where possible
**Verify**: sidepanel action suite passes and fails meaningfully when persistence wiring regresses

### Step 4: Strengthen background handler tests for persisted actions
**Files**: `packages/extension/src/background/handlers/__tests__/review-handlers.test.ts`, `packages/extension/src/background/handlers/__tests__/receiver-invite-handlers.test.ts`, `packages/extension/src/background/handlers/__tests__/member-account-handlers.test.ts`, `packages/extension/src/background/handlers/__tests__/receiver-sync-routing.test.ts`
**Details**:
- Extend handler tests to explicitly prove:
  - outbox writes after publish
  - receiver intake routing by active coop/member
  - archive/save actions persist receipts or state transitions
  - member-account actions update both local storage and coop doc state
  - receiver publish flow into multiple coops preserves scoping
**Verify**: handler test slice passes and covers the persistence seams the UI relies on

### Step 5: Expand shared sync fault coverage
**Files**: `packages/shared/src/modules/coop/__tests__/sync.test.ts`, `packages/shared/src/modules/receiver/__tests__/sync.test.ts`, `packages/shared/src/modules/coop/__tests__/sync-health.test.ts`
**Details**:
- Add tests for:
  - reconnect after temporary signaling loss
  - mixed healthy/degraded signaling connection sets
  - concurrent updates from two docs before merge
  - malformed entries coexisting with valid replicated state
  - sync-health summaries that the UI exposes
- Keep these deterministic and fast in Vitest
**Verify**: sync unit slice passes and demonstrates transport-health edge coverage

### Step 6: Add browser-level sync resilience coverage
**Files**: `e2e/receiver-sync.spec.cjs`, `e2e/sync-resilience.spec.cjs`
**Details**:
- Extend existing receiver E2E or split a dedicated suite for:
  - pair receiver -> sync into intake -> publish across multiple coops
  - close/reopen extension surface and confirm synced state survives
  - simulate degraded transport and confirm the UI reports degraded/local state
  - reconnect and confirm state resumes cleanly
- Keep the scenarios mock-onchain/mock-archive by default
**Verify**: `bun run test:e2e:sync` passes locally with stable assertions

### Step 7: Verify sync indicators at the UI layer
**Files**: `packages/extension/src/views/Popup/__tests__/PopupApp.test.tsx`, `packages/extension/src/views/Sidepanel/hooks/__tests__/useDashboard.test.ts`, `packages/extension/src/views/Sidepanel/__tests__/SidepanelApp.test.tsx`
**Details**:
- Tie sync-health summaries to visible UI states in popup and sidepanel
- Add assertions for:
  - healthy
  - signaling-only
  - degraded/offline
  - dashboard error
- Ensure these tests use the same summary shapes returned by shared sync helpers
**Verify**: UI status tests fail if sync summary semantics drift

### Step 8: Expand mock-path on-chain UI coverage
**Files**: `packages/extension/src/views/Sidepanel/__tests__/operator-console.test.tsx`, `packages/extension/src/background/handlers/__tests__/member-account-handlers.test.ts`, `packages/shared/src/modules/auth/__tests__/auth-onchain.test.ts`
**Details**:
- Add stronger coverage for:
  - provisioning member accounts from the extension workflow
  - session capability issue/revoke UI transitions
  - policy action queue approve/reject/execute state transitions
  - user-visible chain/mode labeling and error states
- Keep mock mode first-class so these tests stay reliable in CI
**Verify**: on-chain UI slice passes without depending on live RPCs

### Step 9: Clarify and harden live on-chain rehearsal
**Files**: `scripts/probe-onchain-live.ts`, `scripts/probe-session-key-live.ts`, `docs/testing/ui-action-coverage.md`
**Details**:
- Document exactly what the live probes prove today, including the ERC-7579 limitation for Smart Sessions
- Add output expectations that map live probe phases back to UI capabilities
- Keep probes opt-in, but make their value explicit for release validation
**Verify**: live probes still skip cleanly without env vars and document their success criteria

### Step 10: Add targeted validation suites
**Files**: `package.json`, `scripts/validate.ts`
**Details**:
- Add new focused suites, for example:
  - `test:e2e:popup`
  - `test:e2e:sync`
  - `test:unit:popup-actions`
  - `test:unit:sidepanel-actions`
  - `validate:popup-slice`
  - `validate:sync-hardening`
  - `validate:onchain-ui`
- Keep them small enough to be used during feature work and review
**Verify**: each new validate target runs the intended slices and exits non-zero on regressions

### Step 11: Document action coverage and residual risk
**Files**: `docs/testing/ui-action-coverage.md`
**Details**:
- Add a living coverage map with sections for:
  - popup
  - sidepanel
  - persistence
  - sync
  - on-chain
- For each action class, note:
  - unit coverage
  - integration coverage
  - browser E2E coverage
  - live probe coverage
  - known gaps
- Use this as the reference for future audits and release checks
**Verify**: document matches the implemented suite names and can be kept current during follow-up work

## Validation

- [ ] `bun run validate typecheck`
- [ ] `bun run validate quick`
- [ ] `bun run validate popup-slice`
- [ ] `bun run validate sync-hardening`
- [ ] `bun run validate onchain-ui`
- [ ] `bun run validate core-loop`
- [ ] Targeted live probe documentation updated and internally consistent

## Notes For Execution

- Execute this plan in slices, not as one giant PR
- Recommended order:
  1. popup browser smoke suite
  2. popup/sidepanel action persistence matrix
  3. sync resilience and indicator verification
  4. on-chain mock-path coverage and live-probe documentation
- Treat any failing existing tests in these areas as blockers to expanding the slice
