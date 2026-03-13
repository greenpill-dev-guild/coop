# Shared Package Context

The `@coop/shared` package is the single source of truth for all domain logic, schemas, persistence, sync, and onchain integration. Extension and app packages are thin runtimes that import from shared.

## Architecture

### Module Map

```
packages/shared/src/
  contracts/
    schema.ts          # ALL Zod schemas + type exports (single source of truth)
    index.ts           # Re-exports schema
  modules/
    app/               # Extension icon state, sound preferences
    archive/           # Storacha upload, bundle creation, receipt tracking
    auth/              # Passkey identity, WebAuthn sessions, auth<->member bridging
    coop/              # Core flows: create/join, sync (Yjs), pipeline, review, board, publish
    onchain/           # Safe creation via Pimlico, chain config, mock/live modes
    receiver/          # Mobile pairing, WebSocket relay, capture sync, retry logic
    storage/           # Dexie database (IndexedDB), CRUD helpers
  utils/
    index.ts           # createId, hashText, toDeterministicAddress, base64url, etc.
  index.ts             # Barrel: re-exports contracts, modules, utils
```

### Export Topology

```
index.ts -> contracts/index.ts -> schema.ts (all Zod schemas + types)
         -> modules/index.ts   -> app, archive, auth, coop, onchain, receiver, storage
         -> utils/index.ts     -> utility functions
```

Everything flows through barrel exports. Consumers use `import { x } from '@coop/shared'`.

## Key Patterns

### Schema-First Types

All domain types are defined as Zod schemas in `contracts/schema.ts`, then inferred:

```typescript
export const memberSchema = z.object({ ... });
export type Member = z.infer<typeof memberSchema>;
```

This gives runtime validation + TypeScript types from a single source. There are 50+ schemas covering the full domain: CoopProfile, Member, Artifact, ReviewDraft, ReceiverCapture, ArchiveReceipt, OnchainState, etc.

Key schema groups:
- **Identity**: `authSessionSchema`, `localPasskeyIdentitySchema`, `passkeyCredentialSchema`
- **Coop state**: `coopSharedStateSchema` (the top-level CRDT document shape), `coopProfileSchema`, `coopSoulSchema`, `ritualDefinitionSchema`
- **Content pipeline**: `tabCandidateSchema`, `readablePageExtractSchema`, `coopInterpretationSchema`, `reviewDraftSchema`, `artifactSchema`
- **Receiver**: `receiverCaptureSchema`, `receiverPairingRecordSchema`, `receiverSyncEnvelopeSchema`
- **Archive**: `archiveReceiptSchema`, `archiveBundleSchema`, `archiveDelegationMaterialSchema`
- **Onchain**: `onchainStateSchema` with legacy chain normalization preprocess

### Dexie Persistence (IndexedDB)

`CoopDexie` in `storage/db.ts` is the local database. Currently at schema version 4.

Tables:
- `tabCandidates` — Raw captured browser tabs
- `pageExtracts` — Cleaned text extractions from tab content
- `reviewDrafts` — AI-shaped drafts waiting for human review (indexed by `workflowStage`)
- `coopDocs` — Encoded Yjs documents (binary `Uint8Array`)
- `captureRuns` — Capture batch state tracking
- `settings` — Key-value store for auth sessions, sound prefs, device identity
- `identities` — Local passkey identity records
- `receiverPairings` — Mobile device pairing records
- `receiverCaptures` — Captures synced from paired devices
- `receiverBlobs` — Binary blobs for receiver captures (stored in transaction with capture)

Pattern: Every CRUD function takes `db: CoopDexie` as first argument. Multi-table writes use `db.transaction('rw', ...)`.

### Yjs CRDT Sync

`coop/sync.ts` manages the shared state document:

- `CoopSharedState` is the canonical shape (profile, members, artifacts, syncRoom, onchainState, etc.)
- State is stored in a `Y.Map<string>` under the key `"coop"`, with each field JSON-serialized
- `writeCoopState()` / `readCoopState()` convert between `CoopSharedState` and `Y.Doc`
- `updateCoopState(doc, updater)` reads, applies a pure function, writes back
- `connectSyncProviders()` sets up `IndexeddbPersistence` + `WebrtcProvider` for live sync
- Sync rooms are derived deterministically: `deriveSyncRoomId(coopId, roomSecret)`
- Bootstrap rooms use the `bootstrap:` prefix pattern for invited members before full sync

### Content Pipeline

The passive capture pipeline in `coop/pipeline.ts`:

1. `TabCandidate` -> `buildReadablePageExtract()` -> `ReadablePageExtract`
2. `interpretExtractForCoop(extract, coop, adapter?)` -> `CoopInterpretation` (relevance scoring, lens classification, category/tag derivation)
3. `shapeReviewDraft(extract, interpretation, coopProfile)` -> `ReviewDraft`
4. `runPassivePipeline({ candidate, page, coops })` orchestrates all three steps, filters by 0.18 relevance threshold

The `InferenceAdapter` interface allows plugging in local models (WebGPU path planned), but currently uses keyword-based classification.

### Identity & Auth

Passkey-first identity via `viem/account-abstraction`:
- `createPasskeySession()` creates a WebAuthn credential and derives a deterministic address
- `restorePasskeyAccount()` rehydrates a viem `WebAuthnAccount` from stored credential
- `ensurePasskeyIdentity()` handles create-or-reuse logic with mock mode support
- `authSessionToLocalIdentity()` bridges auth sessions to persistent identity records
- `sessionToMember()` converts an auth session to a coop `Member`

Address derivation: `toDeterministicAddress(seed)` uses `keccak256(stringToHex(seed)).slice(2, 42)` then `getAddress()`.

### Onchain Integration (Safe + ERC-4337)

`onchain/onchain.ts` handles Safe smart account creation:
- Two chains supported: `sepolia` (dev) and `arbitrum` (prod)
- `deployCoopSafeAccount()` creates a Safe v1.4.1 via Pimlico bundler with passkey as owner
- Salt nonce is deterministic from coop seed: `toDeterministicBigInt(coopSeed)`
- Modes: `mock` (deterministic fake addresses), `live` (real Pimlico deployment)
- `createUnavailableOnchainState()` generates a placeholder when passkeys/Pimlico aren't configured

### Receiver (Mobile Capture Sync)

The receiver module handles cross-device capture from paired mobile devices:

- **Pairing**: `createReceiverPairingPayload()` generates a signed pairing with HMAC auth
- **Deep links**: `buildReceiverPairingDeepLink(baseUrl, payload)` for QR code generation
- **Relay**: `connectReceiverSyncRelay()` manages WebSocket connections for capture frames
- **Auth**: Relay frames are HMAC-SHA256 signed with the pair secret
- **Retry**: Exponential backoff with configurable limits per capture

Protocol flow: Phone captures -> `ReceiverSyncEnvelope` (capture + asset + auth) -> WebSocket relay -> Extension ingests and creates `ReviewDraft`

### Archive (Storacha/Filecoin)

`archive/` handles content preservation:
- `createArchiveBundle()` builds a JSON payload (artifact-scoped or full snapshot)
- `requestArchiveDelegation()` fetches UCAN delegation from issuer URL
- `uploadArchiveBundleToStoracha()` uploads via `@storacha/client` with space delegation
- `recordArchiveReceipt()` updates coop state with receipt and archive signals
- Mock mode: `createMockArchiveReceipt()` generates deterministic pseudo-CIDs

### Utility Functions

`utils/index.ts` provides core helpers used everywhere:
- `createId(prefix)` — UUID-based IDs with semantic prefix (e.g., `coop-abc123`)
- `hashText(value)` / `hashJson(value)` — keccak256 via viem
- `toDeterministicAddress(seed)` — Reproducible addresses from seeds
- `encodeBase64Url()` / `decodeBase64Url()` — URL-safe base64 for invite codes and payloads
- `canonicalizeUrl()` — Strips tracking params and hash
- `truncateWords()` — Word-boundary truncation with ellipsis

## Anti-Patterns

- **Never import from deep paths** (`@coop/shared/modules/coop/flows`). Use `@coop/shared`.
- **Never define domain types outside `schema.ts`**. All Zod schemas live there. Utility interfaces (like `CoopDocRecord`) in their module files are OK.
- **Never create hooks in shared**. Shared is pure functions and types. UI hooks belong in extension/app.
- **Never skip Zod validation** for data crossing trust boundaries (invite codes, receiver sync envelopes, onchain state).
- **Never hardcode chain IDs**. Use `getCoopChainConfig(chainKey)`.
- **Never use `Date.now()` directly for stored timestamps**. Use `nowIso()`.
- **Never store raw Yjs docs in Dexie**. Use `encodeCoopDoc()` to get `Uint8Array` first.

## Key Files

- `contracts/schema.ts` — All domain schemas and types (636 lines, the contract)
- `modules/coop/flows.ts` — createCoop, joinCoop, generateInviteCode, parseInviteCode
- `modules/coop/sync.ts` — Yjs document management, WebRTC sync providers
- `modules/coop/pipeline.ts` — Passive capture pipeline, relevance scoring, draft shaping
- `modules/coop/board.ts` — React Flow board snapshot creation and graph building
- `modules/coop/review.ts` — Draft visibility, receiver draft seeding, meeting mode sections
- `modules/storage/db.ts` — Dexie schema (4 versions), all CRUD functions
- `modules/auth/auth.ts` — Passkey session creation and restoration
- `modules/auth/identity.ts` — Local identity CRUD, mock identity creation
- `modules/onchain/onchain.ts` — Safe deployment, chain config, mock/live modes
- `modules/receiver/pairing.ts` — Pairing payload creation, validation, deep links
- `modules/receiver/relay.ts` — WebSocket relay with reconnect, HMAC signing
- `modules/archive/storacha.ts` — Storacha client, delegation, upload
- `modules/archive/archive.ts` — Bundle creation, receipt recording
- `utils/index.ts` — ID generation, hashing, base64url, URL utilities
