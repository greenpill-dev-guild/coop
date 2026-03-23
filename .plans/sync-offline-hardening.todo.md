# Sync & Offline Hardening

**GitHub Issue**: —
**Branch**: `feature/sync-offline-hardening`
**Status**: IMPLEMENTED (Phases 1-3; Phase 4 deferred — needs design input)
**Created**: 2026-03-22
**Last Updated**: 2026-03-22

## Context

Oracle investigation mapped the full sync lifecycle (Yjs CRDT via y-webrtc + y-websocket + y-indexeddb) and identified 8 gaps ranging from high to low severity. Two gaps compound: STUN-only ICE + no blob server fallback = hard failure for companion PWA users behind restrictive NATs.

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Add blob relay over yws WebSocket, not a new HTTP upload endpoint | Reuses existing authenticated WS connection; avoids new auth surface; keeps local-first principle intact |
| 2 | TURN via Metered.ca (free tier) for launch, self-hosted coturn later | Metered has a free 500MB/mo TURN tier; removes the NAT blocker immediately without ops overhead |
| 3 | Outbox tracking in Dexie, not a separate queue service | Local-first: outbox lives alongside the data it tracks; no new infra dependency |
| 4 | Field-level Y.Map for artifacts is Phase 3, not Phase 1 | Requires migration of all existing docs; lower collision probability with small groups; ship safety nets first |
| 5 | Server-side yws persistence via y-leveldb on Fly volume | Fly volumes survive restarts; y-leveldb is the canonical Yjs persistence adapter; minimal code change |
| 6 | Awareness integration deferred to Phase 4 | UX enhancement, not a correctness fix; requires design input for presence indicators |
| 7 | Online/offline listener in background worker, not sidepanel | Background worker is the single source of truth for RuntimeHealth; sidepanel is ephemeral |
| 8 | Offscreen polling → message-driven wake with 10s heartbeat fallback | Eliminates 1.5s polling; chrome.runtime.onMessage is the MV3-idiomatic wake mechanism |

## Requirements Coverage

| Requirement | Planned Step | Status |
|-------------|--------------|--------|
| Blob sync works behind NAT | Steps 1, 2, 3, 4, 5 | DONE |
| User sees pending outbound sync state | Step 9 | DONE |
| Concurrent artifact edits don't clobber | Step 10 | DONE |
| Server survives restarts without data loss | Step 6 | DONE |
| WebRTC connects behind symmetric NAT | Step 1 | DONE |
| Users see who's online | Steps 11, 12 | DEFERRED |
| Instant UI update on reconnect | Step 7 | DONE |
| Offscreen doesn't drain battery | Step 8 | DONE |

## CLAUDE.md Compliance

- [x] All new modules in shared package
- [x] Barrel imports from @coop/shared
- [x] Single root .env only (TURN creds go in .env.local)
- [x] Zod validation at trust boundaries (blob relay messages)
- [x] No React hooks in shared

## Impact Analysis

### Files to Modify

**Phase 1 (Transport Safety Net)**
- `packages/api/config.ts` — Add TURN server config
- `packages/api/src/ws/yjs-sync.ts` — Add blob relay message handling
- `packages/api/src/ws/index.ts` — Mount blob relay on yws route
- `packages/shared/src/modules/blob/channel.ts` — Add WebSocket fallback transport
- `packages/shared/src/modules/blob/sync.ts` — Add blob relay message types
- `packages/extension/src/views/Sidepanel/hooks/useSyncBindings.ts` — Pass websocket to blob channel

**Phase 2 (Offline Resilience)**
- `packages/shared/src/modules/coop/sync.ts` — Outbox tracking types and helpers
- `packages/shared/src/modules/storage/db.ts` — Add `syncOutbox` table to Dexie schema
- `packages/extension/src/background/context.ts` — Add online/offline event listener
- `packages/extension/src/background/dashboard.ts` — Surface outbox status
- `packages/extension/src/runtime/receiver-sync-offscreen.ts` — Replace polling with message-driven wake
- `packages/extension/src/views/Popup/helpers.ts` — Show pending sync count

**Phase 3 (Conflict Resolution)**
- `packages/shared/src/modules/coop/sync.ts` — Per-field Y.Map for artifact properties
- `packages/shared/src/contracts/schema.ts` — Artifact field keys constant

**Phase 4 (Presence & Polish)**
- `packages/shared/src/modules/coop/sync.ts` — Awareness local state helpers
- `packages/extension/src/views/Sidepanel/hooks/useSyncBindings.ts` — Set awareness state
- `packages/extension/src/views/Sidepanel/tabs/NestTab.tsx` — Presence indicator UI

### Files to Create

- `packages/shared/src/modules/blob/relay.ts` — Blob relay protocol (WS fallback)
- `packages/shared/src/modules/coop/outbox.ts` — Outbox tracking module

## Test Strategy

- **Unit tests**: Blob relay encode/decode, outbox state machine, chunk reassembly over WS, awareness state helpers
- **Integration tests**: Blob transfer via WebSocket fallback (mock WS), outbox flush on reconnect, field-level merge correctness
- **E2E tests**: Two-profile publish with one profile "offline" (signaling blocked), verify sync resumes; blob transfer between profiles

---

## Phase 1: Transport Safety Net

_Unblock blob sync behind NAT. This is the highest-severity gap — companion PWA users can't sync audio/photos without it._

### Step 1: Add TURN server configuration

**Files**: `packages/api/config.ts`, `.env.local`
**Details**:
- Add `VITE_COOP_TURN_URLS`, `VITE_COOP_TURN_USERNAME`, `VITE_COOP_TURN_CREDENTIAL` to env documentation
- Register for Metered.ca free TURN tier, add credentials to `.env.local`
- `buildIceServers()` already supports TURN — this step just ensures credentials are always configured in deployed environments
- Update `packages/api/config.ts` to include a comment documenting the TURN requirement for production

**Verify**: `buildIceServers({ urls: process.env.VITE_COOP_TURN_URLS, ... })` returns STUN + TURN entries

### Step 2: Blob relay protocol definition

**Files**: `packages/shared/src/modules/blob/relay.ts`, `packages/shared/src/modules/blob/sync.ts`
**Details**:
- Define `BlobRelayMessage` types: `blob-relay-request`, `blob-relay-chunk`, `blob-relay-not-found`, `blob-relay-manifest`
- These mirror the existing `BlobSyncMessage` types but are framed for WebSocket transport (server acts as relay between peers)
- Add Zod schemas for relay messages (trust boundary: messages arrive from server WS)
- Add `encodeBlobRelayMessage()` / `decodeBlobRelayMessage()` using the same base64 encoding as the WebRTC variant
- Export from barrel

**Verify**: Unit tests for encode/decode roundtrip, Zod validation rejects malformed messages

### Step 3: Server-side blob relay handler

**Files**: `packages/api/src/ws/yjs-sync.ts`
**Details**:
- Extend the yws message handler to recognize blob relay messages (new message type constant `messageBlobRelay = 2`)
- When a `blob-relay-request` arrives, broadcast it to all other connections in the same room
- When `blob-relay-chunk` or `blob-relay-not-found` arrives, forward to the connection that sent the original request (track pending request origins)
- The server never stores blob data — pure relay
- Add rate limiting: max 10 concurrent relay requests per connection, max 50MB per room per minute

**Verify**: Unit test: two mock WSContexts in the same room can exchange blob relay messages through the handler

### Step 4: Client-side WebSocket blob fallback

**Files**: `packages/shared/src/modules/blob/channel.ts`
**Details**:
- Add optional `websocketProvider` parameter to `createBlobSyncChannel()` input
- When `requestBlob()` fails to find the blob via WebRTC data channels (all peers return null or no peers available), fall back to sending a `blob-relay-request` through the WebSocket connection
- Listen for incoming `blob-relay-chunk` messages on the WebSocket and reassemble using existing `reassembleChunks()`
- Listen for incoming `blob-relay-request` messages (another peer asking for a blob through the relay) and respond via the WebSocket
- Maintain the same timeout (30s) and backpressure behavior as the WebRTC path

**Verify**: Unit test with mocked WebSocket: blob request falls through WebRTC (no peers), succeeds via WS relay

### Step 5: Wire WebSocket provider into blob channel

**Files**: `packages/extension/src/views/Sidepanel/hooks/useSyncBindings.ts`
**Details**:
- Pass `providers.websocket` to `createBlobSyncChannel()` when instantiating blob sync in the sidepanel
- Ensure `disconnect()` cleanup tears down both transports

**Verify**: Manual: open sidepanel, confirm blob channel logs show WS fallback available

---

## Phase 2: Offline Resilience

_Give users confidence that their work won't be lost and will sync when connectivity returns._

### Step 6: Server-side yws persistence

**Files**: `packages/api/src/ws/yjs-sync.ts`, `packages/api/package.json`
**Details**:
- Add `y-leveldb` dependency
- On `createRoom()`, bind a `LeveldbPersistence` instance to the room's doc using the room name as the LevelDB key
- Store LevelDB data on a Fly volume (path: `/data/yjs-rooms/`)
- On room creation, load existing state from LevelDB before accepting connections
- Adjust `destroyRoom()` to flush pending writes before closing the LevelDB instance
- Keep the 30s cleanup timer for the in-memory doc, but LevelDB persists beyond it

**Verify**: Unit test: create room, write state, destroy room, recreate room — state is recovered. Integration: restart API server, reconnect client, verify doc state survives.

### Step 7: Proactive online/offline listener

**Files**: `packages/extension/src/background/context.ts`, `packages/extension/src/background.ts`
**Details**:
- In the background worker startup, add `self.addEventListener('online', handler)` and `self.addEventListener('offline', handler)`
- On `online`: immediately call `setRuntimeHealth({ offline: false })` and trigger a dashboard refresh
- On `offline`: immediately call `setRuntimeHealth({ offline: true })` and trigger a dashboard refresh
- Remove the passive `navigator.onLine` check from `getRuntimeHealth()` — it's now event-driven
- This ensures the popup status updates within milliseconds of connectivity change, not on next poll

**Verify**: Unit test: simulate online/offline events, verify RuntimeHealth updates immediately

### Step 8: Replace offscreen polling with message-driven wake

**Files**: `packages/extension/src/runtime/receiver-sync-offscreen.ts`
**Details**:
- Remove the `window.setInterval(() => void refreshBindings(), 1500)` polling loop
- Instead, call `refreshBindings()` only when:
  1. `chrome.runtime.onMessage` receives a `refresh-receiver-bindings` message (sent by background worker when pairings change)
  2. A heartbeat `setInterval` at 10s (fallback for missed messages, not the primary trigger)
  3. On initial load (already happens)
- Update the background worker to send `refresh-receiver-bindings` when receiver pairings are added/removed
- Net effect: ~7x fewer polling cycles, same responsiveness for actual pairing changes

**Verify**: Unit test: mock chrome.runtime.onMessage, verify refreshBindings called on message. Verify 10s heartbeat fires.

### Step 9: Sync outbox tracking

**Files**: `packages/shared/src/modules/coop/outbox.ts`, `packages/shared/src/modules/storage/db.ts`, `packages/extension/src/background/dashboard.ts`, `packages/extension/src/views/Popup/helpers.ts`
**Details**:
- Add `syncOutbox` table to Dexie schema: `{ id, coopId, type, payload, createdAt, status, retryCount, lastError }`
  - `type`: `'artifact-publish' | 'state-update' | 'blob-push'`
  - `status`: `'pending' | 'synced' | 'failed'`
- When `publishDraftToCoops()` is called, also write an outbox entry with `status: 'pending'`
- On Yjs `update` event (in `useSyncBindings`), check if the update includes the outbox entry's payload and mark it `synced`
- In `summarizeSyncStatus()`, include pending outbox count: "2 changes pending sync"
- In popup helpers, show a subtle indicator when outbox has pending items
- Outbox entries older than 7 days with `status: 'synced'` are auto-pruned

**Verify**: Unit test: create outbox entry, simulate sync, verify status transition. UI test: verify pending count shows in popup.

---

## Phase 3: Conflict Resolution

_Reduce data loss from concurrent edits to the same artifact._

### Step 10: Per-field artifact Y.Map

**Files**: `packages/shared/src/modules/coop/sync.ts`, `packages/shared/src/contracts/schema.ts`
**Details**:
- Define a new Y.Map key `coop-artifacts-v2` where each artifact is itself a `Y.Map` of field→value (not a JSON string)
- Artifact fields: `title`, `summary`, `sources`, `tags`, `category`, `reviewStatus`, `archiveStatus`, etc.
- `writeCoopState()` writes to all three formats (old monolithic, per-artifact JSON, per-field) during migration window
- `readCoopState()` prefers `coop-artifacts-v2` > `coop-artifacts` > old format
- Two peers editing `title` vs `tags` on the same artifact now merge cleanly instead of clobbering
- Same-field conflicts still use last-writer-wins (Yjs Y.Map semantics), but the blast radius is one field, not the whole artifact
- Migration: existing docs auto-upgrade on first write from an updated client; old clients can still read/write the JSON format

**Verify**: Unit test: two Y.Docs, concurrent edits to different fields of the same artifact, merge via Y.applyUpdate, verify both fields preserved. Test backward compat: read from v2 map, fall back to v1 when v2 is empty.

---

## Phase 4: Presence & Polish

_UX enhancements that depend on Phases 1-3 being stable._

### Step 11: Awareness protocol integration

**Files**: `packages/shared/src/modules/coop/sync.ts`, `packages/extension/src/views/Sidepanel/hooks/useSyncBindings.ts`
**Details**:
- Add `setAwarenessState(provider, { userId, displayName, color, activeView })` helper in sync.ts
- In `useSyncBindings`, after connecting providers, call `setAwarenessState()` with the authenticated user's info
- Add `observeAwareness(provider, callback)` that returns peer presence data
- This enables future UI work (who's online indicator, cursor presence)

**Verify**: Unit test: set awareness state, observe from another doc, verify state propagates

### Step 12: Presence indicator in Nest tab

**Files**: `packages/extension/src/views/Sidepanel/tabs/NestTab.tsx`
**Details**:
- Add a "Members online" section showing awareness-reported peers
- Show colored dots next to member names with their `activeView`
- Gracefully handle: no awareness data (show nothing), single user (show "Just you")

**Verify**: Manual two-profile test: both profiles see each other in the Nest tab presence section

---

## Validation

- [ ] `bun format && bun lint` passes
- [ ] `bun run test` passes (including new unit tests)
- [ ] `bun build` succeeds
- [ ] `bun run validate core-loop` passes
- [ ] Two-profile manual test: blob sync works with WebRTC blocked (TURN disabled, WS relay active)
- [ ] Two-profile manual test: offline publish shows pending indicator, syncs on reconnect
- [ ] TypeScript strict mode passes across all packages

## Incremental Shipping Strategy

Each phase is independently shippable and valuable:

| Phase | PR | User-facing impact |
|-------|----|--------------------|
| 1 | `feature/blob-ws-relay` | Companion PWA blob sync works for all users, not just those with open NAT |
| 2 | `feature/offline-resilience` | Users see sync status, offline transitions are instant, battery life improves |
| 3 | `feature/artifact-field-crdt` | Concurrent edits to different artifact fields merge instead of clobbering |
| 4 | `feature/presence-awareness` | "Who's online" in the Nest tab |

Phases 1 and 2 can be developed in parallel. Phase 3 depends on Phase 1 (same Y.Map patterns). Phase 4 depends on Phase 2 (awareness needs stable transport).
