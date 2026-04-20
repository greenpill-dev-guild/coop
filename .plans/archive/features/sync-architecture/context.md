# Sync Architecture — Existing Worktree Work

> Generated 2026-03-31 from worktree review. These 3 worktrees contain prior sync work
> that forked from `c26c4de` (2026-03-28) and are 19 commits behind current main.

## Current Main State (3d7a686)

Main has since landed critical sync fixes:

- **cc12685** — `fix(shared): resolve sync data loss with per-member CRDT maps and origin tagging`
  - Added `ORIGIN_LOCAL` tagging to `writeCoopState`
  - Added Dexie transaction wrappers around `mergeCoopStateUpdate`
  - Added Zod `safeParse` + `_validationWarning` recovery in merge path
  - Introduced per-member CRDT maps (`coop-members-v2`)
- **3d7a686** — `fix(shared,client): stabilize Yjs sync runtime and status`
  - Added `SyncHealthState` type
  - Added `syncHealthByCoop` aggregation map to `useSyncBindings`

---

## Worktree 1: Structured Sync Status Model

**Branch:** `worktree-agent-a915719c` | **Commit:** `23380b6`
**Risk:** Low | **Rebase difficulty:** Straightforward

### What it does

Adds a richer, structured sync status model (`structuredSync`) that maps `CoopSyncRuntime`
into user-facing labels, replacing the existing string-based `syncLabel`/`syncTone`/`syncDetail`.

### New APIs and types

- `deriveStructuredSync()` — pure function in `dashboard.ts` (~104 lines)
  - Inputs: `CoopSyncRuntime` + runtime health + outbox count
  - Output: `{ runtime, label, detail, tone }`
- Label vocabulary: `Local | Bridge | Connected | Syncing | Offline | Error`
- `CoopSyncRuntime` interface in `messages.ts`:
  - `mode`, `peerCount`, `broadcastPeerCount`, `signalingConnectionCount`
  - `configuredSignalingCount`, `websocketConnected`
  - `lastRemoteUpdateAt`, `lastPersistAt`, `lastError`, `active`
- `RuntimeSummary.sync` and `PopupSnapshot.sync` fields
- `getCoopSyncRuntime()` and `stateKeys.coopSyncRuntime` in `context.ts`

### Bug fix included

- `lastCaptureError` no longer pollutes sync status display

### Tests added

- 7 tests for `summarizeSyncStatus` structured labels in `dashboard-assembly.test.ts`
- 5 tests for `popupSyncStatus` structured path in `popup-sync-status.test.ts`

### Conflicts with main

- Modifies `useSyncBindings.ts` to remove per-coop health aggregation map
  (main added `syncHealthByCoop` since fork — straightforward resolution)

---

## Worktree 2: Offscreen Coop Sync Runtime

**Branch:** `worktree-agent-a8c946e7` | **Commit:** `c96442b`
**Risk:** Medium | **Rebase difficulty:** Medium (needs ORIGIN_LOCAL port)

### What it does

Moves all WebRTC/WebSocket sync provider management out of the sidepanel React tree
(`useSyncBindings` hook) into a dedicated MV3 offscreen document. Sync stays alive
even when the sidepanel is closed.

### New files

| File | Lines | Purpose |
|------|-------|---------|
| `extension/src/runtime/coop-sync-offscreen.ts` | 242 | Full offscreen sync runtime |
| `extension/src/runtime/__tests__/coop-sync-offscreen.test.ts` | 323 | Integration tests |

### Architecture

```
Sidepanel (React)                    Offscreen Document
┌─────────────────┐                 ┌──────────────────────┐
│ useSyncBindings  │ ──message──▶   │ coop-sync-offscreen  │
│ (thin shim, 21  │                 │                      │
│  lines now)     │                 │ CoopSyncBinding map  │
│                 │ ◀──runtime──    │ Y.Doc per coop       │
│ Reads runtime   │   report        │ WebRTC + WebSocket   │
│ from storage    │                 │ providers            │
└─────────────────┘                 │ Health reporting     │
                                    │ Persistence via bg   │
                                    └──────────────────────┘
```

### Key functions

- `fetchCoopSyncConfig()` — offscreen asks background for coop list
- `refreshBindings()` — reconciles binding map, creates/tears-down per coop
- `reportCoopSyncRuntime(coopId, patch)` — offscreen reports health to background
- `resolveMode(providers)` — maps provider state to sync mode string

### Background message handlers added

- `get-coop-sync-config` — returns coop list to offscreen
- `refresh-coop-sync-bindings` — triggers binding reconciliation
- `report-coop-sync-runtime` — stores per-coop runtime state

### Gap: ORIGIN_LOCAL not ported

Main's `cc12685` added `ORIGIN_LOCAL` origin tagging to filter local writes in
`useSyncBindings`. The offscreen runtime's `onDocUpdate` handler does **not** include
this filter — it needs to be ported to avoid sync echo loops.

### Conflicts with main

- Replaces entire `useSyncBindings.ts` body (main expanded it since fork)
- Modifies `background.ts` message handlers
- Shares `CoopSyncRuntime` type with Worktree 1 (nearly identical, minor typing diff)

---

## Worktree 3: V2 Storage (Reference Only)

**Branch:** `worktree-agent-a3afb886` | **Commit:** `4a069ef`
**Risk:** High — contradicts main's safety fixes | **Do not merge as-is**

### What it does

Simplifies the storage layer by removing safety mechanisms that main intentionally added:

- Removes Dexie transaction wrappers from `saveCoopState` / `mergeCoopStateUpdate`
- Removes Zod `safeParse` + `_validationWarning` recovery path
- Removes encrypted-local-payload indirection for privacy/stealth records
- Deletes `db-encryption.ts`, `listPrivacyIdentities`, `listStealthKeyPairs`
- Deletes `db-crud-content-sync.test.ts` (R4/R7 atomicity tests)

### Extractable piece

The privacy/stealth simplification (removing encrypted-payload indirection in
`db-crud-privacy.ts`) is independent of the sync safety work and could be
cherry-picked separately if we decide to simplify that path.

### Why it conflicts

Main's `cc12685` explicitly added Dexie transactions (R4) and Zod safe-parse (R7)
to prevent data loss during sync merges. This worktree removes both.

---

## Dependencies Between Worktrees

```
WT1 (sync status)     WT2 (offscreen sync)     WT3 (v2 storage)
       │                       │                       │
       │                       │                       │
       ├── CoopSyncRuntime ────┤                       │
       │   type (shared)       │                       │
       │                       │                       │
       ├── getCoopSyncRuntime  ├── calls               │
       │   in context.ts       │   mergeCoopStateUpdate ├── modifies same fn
       │                       │                       │   (removes safety)
       │                       │                       │
       └── consumes runtime ───┘                       │
           to build labels         independent ────────┘
```

WT1 and WT2 share the `CoopSyncRuntime` interface (minor typing divergence:
WT1 uses strict label union, WT2 uses `string`). WT3 is independent at the
type level but touches `mergeCoopStateUpdate` which WT2's offscreen doc calls.

## Recommended Landing Order

1. **WT1 (sync status)** — additive, safe, good UX improvement
2. **WT2 (offscreen sync)** — architectural, port `ORIGIN_LOCAL` from main first
3. **WT3** — cherry-pick privacy simplification only, skip storage regression

---

# Sync Remediation Plan

## Summary
- Validation is strong on the core concerns: coop live sync is currently sidepanel-owned, healthy transport detail is collapsed before the UI sees it, capture failures leak into sync status, `bun dev` points the extension at local signaling plus local `/yws`, and `test:e2e:sync` is still a synthetic runtime-health test with a stale `Healthy` expectation.
- The earlier audit needs one correction: `members` already has a v2 keyed Yjs path and should not be treated as legacy-only anymore.
- Re-validation surfaced one additional gap: `agentIdentity` and `fvmState` exist in `coopSharedStateSchema` but are missing from the serialized `sharedKeys`, so they are not persisted through the coop doc at all.
- Chosen direction: all-in-one remediation, offscreen-owned coop sync runtime, rolling-compatible Yjs migration.

## Implementation Changes
- Move coop sync ownership out of the sidepanel and into the existing offscreen runtime pattern. The sidepanel and popup become consumers of background state only; they no longer create or destroy coop sync providers.
- Add a dedicated coop-sync runtime contract between background and offscreen: `get-coop-sync-config`, `refresh-coop-sync-bindings`, and `report-coop-sync-runtime`. Retire `report-sync-health` after all callers are removed.
- Persist per-coop sync runtime separately from generic `RuntimeHealth`. The new typed status should include `mode`, `peerCount`, `broadcastPeerCount`, `signalingConnectionCount`, `configuredSignalingCount`, `websocketConnected`, `lastRemoteUpdateAt`, `lastPersistAt`, `lastError`, and `active`.
- Scope sync presentation to the active coop. Aggregate counts can still exist, but the primary badge/detail must always describe the currently selected coop.
- Remove `lastCaptureError` from the sync summary path. Capture problems stay in capture/runtime status and never drive the sync badge.
- Extend `RuntimeSummary` and `PopupSnapshot` with a structured `sync` object while keeping `syncLabel`, `syncDetail`, and `syncTone` as derived compatibility fields during migration.
- Replace popup string parsing with structured mapping: `Local` for inactive/local-only, `Bridge` for websocket-only, `Connected` for webrtc or mixed, `Syncing` when outbox work is pending, `Offline` for browser offline, and `Error` for degraded runtime failure.
- Add a dedicated sync detail surface in Nest/Coops that shows signaling URLs, websocket sync URL, transport mode, peer counts, and last remote update time.
- Keep legacy root JSON writes for one stable release, but stop treating them as canonical data.
- Add canonical v2 Yjs storage for all shared fields that can still lose data or be dropped: nested Y.Maps for `profile`, `setupInsights`, `soul`, `syncRoom`, `onchainState`, `archiveConfig`, `agentIdentity`, `fvmState`, and top-level `greenGoods`; keyed Y.Map-of-Y.Map collections for `artifacts`, `members`, `invites`, `archiveReceipts`, `memberAccounts`, and `greenGoods.memberBindings`; Y.Array with read-time dedupe for `memberCommitments`.
- Make `reviewBoard` and `memoryProfile` derived state instead of authoritative synced state. Recompute them from canonical artifact/archive data on read and before legacy mirror writes.
- Fix the immediate serialization omission for `agentIdentity` and `fvmState` as part of the same migration, not as a follow-up.

## Test Plan
- Replace the current sync E2E with a real two-profile local API flow that proves cross-profile propagation against local signaling and local `/yws`, including the case where one sidepanel is closed.
- Add shared sync regression tests for concurrent merges across `invites`, `archiveReceipts`, `memberAccounts`, `memberCommitments`, `greenGoods.memberBindings`, and for `agentIdentity` / `fvmState` round-trip persistence.
- Add offscreen coop-sync controller tests for startup, background wake, reconnect, sidepanel-closed operation, runtime reporting, and teardown.
- Update dashboard and popup tests to assert the structured sync model and the new label mapping instead of string heuristics.
- Repair the current `test:unit:sync-hardening` receiver-invite breakage in this worktree before using that suite as a release gate.
- Treat the new two-profile E2E plus the sync-hardening unit slice as blocking validation for sync work.

## Acceptance Criteria
- Two local browser profiles started from `bun dev` keep coop sync active even with the sidepanel closed.
- The active-coop UI always distinguishes local-only, websocket-only, direct-peer, pending-sync, offline, and degraded/error states.
- Sync status never derives from capture failures or unrelated runtime issues.
- No shared coop-state field is silently dropped from serialization.
- Concurrent updates to migrated shared collections merge without last-writer-wins data loss.
- Legacy docs and mixed-version peers continue to load and sync during the rolling-compat window.

## Assumptions
- `reviewBoard` and `memoryProfile` are projections, not source-of-truth sync fields.
- The existing offscreen document is extended to host coop sync alongside receiver sync rather than creating a second offscreen surface.
- The current receiver-invite test failures are worktree drift, not evidence against the sync findings, but they must be resolved before sync can be considered release-ready.
