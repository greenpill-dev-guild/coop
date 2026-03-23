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
    # ── Core ──
    app/               # Extension icon state, sound preferences
    auth/              # Passkey identity, WebAuthn sessions, auth<->member bridging
    coop/              # Core flows: create/join, sync (Yjs), pipeline, review, board, publish, outbox, capture exclusions
    storage/           # Dexie database (IndexedDB), CRUD helpers, encrypted export/import
    receiver/          # Mobile pairing, WebSocket relay, capture sync, retry logic

    # ── Media & Sync ──
    blob/              # Binary blob storage, peer-to-peer sync (WebRTC), relay (WebSocket), compression, resolution
    archive/           # Storacha upload, bundle creation, receipt tracking, restore from archive, export helpers
    transcribe/        # Local Whisper transcription via @huggingface/transformers (WebGPU/WASM)

    # ── Onchain ──
    onchain/           # Safe creation via Pimlico, chain config, provider factory, owner management, signature validation
    member-account/    # Kernel/Safe per-member smart accounts, address prediction, lifecycle management
    greengoods/        # Green Goods garden token: minting, domain management, pool creation, work submissions
    erc8004/           # ERC-8004 on-chain agent registry: identity registration, reputation, feedback
    fvm/               # Filecoin VM CoopRegistry: archive + membership registration on Filecoin

    # ── Agent ──
    agent/             # Agent harness: observations, plans, skill pipeline, output schemas, cross-session memory

    # ── Governance & Permissions ──
    policy/            # Action approval workflows: typed bundles, approval state machine, replay protection, execution
    permit/            # Execution permits: time-bounded capabilities, enforcement validation, audit logging
    session/           # Session keys: Rhinestone smart sessions, scoped execution, encrypted key wrapping
    operator/          # Anchor/trusted-node runtime: capability toggle, privileged action logging

    # ── Privacy ──
    privacy/           # Semaphore ZK membership proofs, anonymous publishing, Bandada group management, lifecycle
    stealth/           # ERC-5564 stealth addresses (secp256k1): key generation, address derivation, scanning
  styles/
    tokens.css         # CSS custom property system (palette, spacing, radii, shadows, typography, z-index, dark mode)
  utils/
    index.ts           # createId, hashText, toDeterministicAddress, base64url, etc.
  index.ts             # Barrel: re-exports contracts, modules, utils
```

### Export Topology

```
index.ts -> contracts/index.ts -> schema.ts (all Zod schemas + types)
         -> modules/index.ts   -> agent, app, archive, auth, blob, coop, erc8004, fvm,
                                  greengoods, member-account, onchain, operator, permit,
                                  policy, privacy, receiver, session, stealth, storage, transcribe
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

This gives runtime validation + TypeScript types from a single source. There are 2191 lines of schemas covering the full domain.

Key schema groups:
- **Identity**: `authSessionSchema`, `localPasskeyIdentitySchema`, `passkeyCredentialSchema`
- **Coop state**: `coopSharedStateSchema` (the top-level CRDT document shape), `coopProfileSchema`, `coopSoulSchema`, `ritualDefinitionSchema`
- **Content pipeline**: `tabCandidateSchema`, `readablePageExtractSchema`, `coopInterpretationSchema`, `reviewDraftSchema`, `artifactSchema`
- **Receiver**: `receiverCaptureSchema`, `receiverPairingRecordSchema`, `receiverSyncEnvelopeSchema`
- **Archive**: `archiveReceiptSchema`, `archiveBundleSchema`, `archiveDelegationMaterialSchema`
- **Onchain**: `onchainStateSchema` with legacy chain normalization preprocess
- **Agent**: `agentObservationSchema`, `agentPlanSchema`, `skillManifestSchema`, `skillRunSchema`, `agentMemorySchema`, `agentLogSchema`, `actionProposalSchema`
- **Policy & Permits**: `actionPolicySchema`, `actionBundleSchema`, `actionLogEntrySchema`, `executionPermitSchema`, `permitLogEntrySchema`
- **Sessions**: `sessionCapabilitySchema`, `sessionCapabilityLogEntrySchema`, `encryptedSessionMaterialSchema`
- **Green Goods**: `greenGoodsMemberBindingSchema`, `greenGoodsGardenBootstrapOutputSchema`, `greenGoodsWorkApprovalOutputSchema`, `greenGoodsAssessmentOutputSchema`
- **Blob**: `blobKindSchema`, `blobOriginSchema`, `coopBlobRecordSchema`, `artifactAttachmentSchema`
- **Privacy/Stealth**: `privacyIdentitySchema`, `stealthKeysSchema`, `stealthMetaAddressSchema`, `stealthAnnouncementSchema`
- **Member accounts**: `memberOnchainAccountSchema`, `localMemberSignerBindingSchema`
- **Authority**: `authorityClassSchema`, `authorityActionMappingSchema`
- **FVM**: `fvmRegistryStateSchema`, `fvmChainKeySchema`
- **ERC-8004**: schemas for agent identity/reputation registration

### Dexie Persistence (IndexedDB)

`CoopDexie` in `storage/db.ts` is the local database.

Tables:
- `tabCandidates` -- Raw captured browser tabs
- `pageExtracts` -- Cleaned text extractions from tab content
- `reviewDrafts` -- AI-shaped drafts waiting for human review (indexed by `workflowStage`)
- `coopDocs` -- Encoded Yjs documents (binary `Uint8Array`)
- `captureRuns` -- Capture batch state tracking
- `settings` -- Key-value store for auth sessions, sound prefs, device identity
- `identities` -- Local passkey identity records
- `localMemberSignerBindings` -- Per-member signer key bindings for member accounts
- `receiverPairings` -- Mobile device pairing records
- `receiverCaptures` -- Captures synced from paired devices
- `receiverBlobs` -- Binary blobs for receiver captures (stored in transaction with capture)
- `actionBundles` -- Policy action bundles awaiting approval/execution
- `actionLogEntries` -- Audit log for action bundle lifecycle
- `replayIds` -- Consumed replay IDs for double-execution prevention
- `executionPermits` -- Time-bounded execution permits
- `permitLogEntries` -- Audit log for permit lifecycle
- `sessionCapabilities` -- Session key capabilities
- `sessionCapabilityLogEntries` -- Audit log for session lifecycle
- `encryptedSessionMaterials` -- Encrypted session key private material
- `agentObservations` -- Agent observation queue
- `agentPlans` -- Agent execution plans
- `skillRuns` -- Individual skill execution records
- `tabRoutings` -- Tab routing decisions cache
- `knowledgeSkills` -- Loaded skill manifests
- `coopKnowledgeSkillOverrides` -- Per-coop skill manifest overrides
- `agentLogs` -- Structured agent log spans
- `agentMemories` -- Cross-session agent memory persistence
- `privacyIdentities` -- Semaphore identity records per coop/member
- `stealthKeyPairs` -- ERC-5564 stealth key pair records
- `encryptedLocalPayloads` -- Encrypted binary payloads (blob storage backend)
- `coopBlobs` -- Blob metadata records (references encrypted payloads)
- `syncOutbox` -- Offline-first sync outbox for pending publish/sync operations

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

`coop/inference.ts` defines the `LocalInferenceProvider` interface (heuristic or local-model backed) with `detectLocalInferenceCapability()` for runtime environment detection.

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

Additional onchain sub-modules:
- `onchain/authority.ts` -- Canonical authority-to-action mappings defining which authority class (safe-owner, session-executor, member-account) controls each action domain
- `onchain/safe-owners.ts` -- Safe owner management: add/remove/swap owners, change threshold, encoded calldata generation
- `onchain/signatures.ts` -- Universal signature validation via Ambire contract (EOA, ERC-1271, ERC-6492)
- `onchain/provider.ts` -- Public client factory with optional Kohaku light client verification mode

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
- `archive/archive.ts` -- `createArchiveBundle()` builds a JSON payload (artifact-scoped or full snapshot), `recordArchiveReceipt()` updates coop state
- `archive/storacha.ts` -- `uploadArchiveBundleToStoracha()` uploads via `@storacha/client` with space delegation, `requestArchiveDelegation()` fetches UCAN delegation
- `archive/setup.ts` -- `provisionStorachaSpace()` provisions a Storacha space for a coop
- `archive/export.ts` -- `exportReviewDraftJson()`, `exportArtifactJson()` for individual record export
- `archive/story.ts` -- Archive receipt detail formatting, worthiness assessment
- `archive/restore.ts` -- `restoreCoopFromArchive()` reconstructs `CoopSharedState` from an archive bundle CID, writes it back into Dexie as an encoded Yjs doc
- Mock mode: `createMockArchiveReceipt()` generates deterministic pseudo-CIDs

### Blob Module (Binary Asset Sync)

`blob/` handles binary asset storage and peer-to-peer synchronization:

- `blob/store.ts` -- Local blob persistence in Dexie via encrypted payloads. `saveCoopBlob()`, `getCoopBlob()`, `listCoopBlobs()`, `deleteCoopBlob()`, `pruneCoopBlobs()` with 200MB default quota. Blobs are stored encrypted using the `encryptedLocalPayloads` table.
- `blob/sync.ts` -- Binary protocol for blob sync over WebRTC data channels. Defines `BlobSyncMessage` types (request, chunk, not-found, manifest), `chunkBlob()` / `reassembleChunks()` for chunked transfer, `EAGER_SYNC_KINDS` (image) vs `LAZY_SYNC_KINDS` (audio, file).
- `blob/channel.ts` -- `createBlobSyncChannel()` creates a blob-aware WebRTC data channel with request/response semantics, backpressure (128KB high-water), and 30s request timeout. Serves incoming blob requests from local Dexie storage.
- `blob/relay.ts` -- `BlobRelayMessage` protocol for server-mediated blob transfer via WebSocket (fallback when peers can't connect directly). Message type `2` alongside Yjs sync (0) and awareness (1). Zod-validated at trust boundary.
- `blob/compress.ts` -- `compressImage()` for canvas-based image compression (OffscreenCanvas in service workers, HTMLCanvasElement fallback). `generateThumbnailDataUrl()` for preview thumbnails.
- `blob/resolve.ts` -- `resolveBlob()` implements three-tier resolution: local Dexie -> peer WebRTC -> Storacha gateway HTTP fetch. Returns bytes + origin source.

### Coop Module (Detailed Sub-modules)

Beyond the core flows, sync, and pipeline:
- `coop/outbox.ts` -- Offline-first publish queue. `createOutboxEntry()`, `addOutboxEntry()`, `markOutboxSynced()`, `markOutboxFailed()`, `getPendingOutboxEntries()`. 7-day prune age. Entries track retry count and last error.
- `coop/capture-exclusions.ts` -- URL domain patterns excluded from passive tab capture. `CAPTURE_EXCLUSION_DEFAULTS` covers email, banking, health, social-dm categories. `isDomainExcluded()` checks a URL against the configured exclusion list.
- `coop/publish.ts` -- Draft-to-artifact promotion, publish flow with coop state updates
- `coop/board.ts` -- React Flow board snapshot creation and graph building
- `coop/review.ts` -- Draft visibility, receiver draft seeding, meeting mode sections
- `coop/presets.ts` -- Ritual lens presets (knowledge, capital, governance, impact), coop space type presets
- `coop/setup-insights.ts` -- Setup insights input structure for coop creation wizard

### Storage Module (Detailed Sub-modules)

- `storage/db.ts` -- Dexie schema definitions, all CRUD functions, table declarations
- `storage/portability.ts` -- Encrypted database export/import. Uses PBKDF2 (200K iterations) for key derivation. `ALL_TABLE_NAMES` enumerates all 33 Dexie tables. Schema version `PORTABILITY_SCHEMA_VERSION = 1`. Supports full database backup and restore with password-based encryption.

### Agent Module

`agent/` powers the in-browser AI agent:

- `agent/agent.ts` -- Core agent primitives: `skillOutputSchemas` (registry of 16+ Zod-validated skill output schemas), `createAgentObservation()`, `updateAgentObservation()`, `createAgentPlanStep()` for building observation-plan-execution chains. Each observation has a deduplication fingerprint via `buildAgentObservationFingerprint()`.
- `agent/memory.ts` -- Cross-session agent memory: `createAgentMemory()` (content-hashed, scoped to coop or member), `queryAgentMemories()`, `pruneAgentMemories()`. Memories are Zod-validated and stored in Dexie.

### Member Account Module

`member-account/` manages per-member smart accounts (Kernel or Safe):

- `createMemberAccountRecord()` -- Creates account record pre-deployment
- `predictMemberAccountAddress()` -- Counterfactual address prediction via Pimlico
- `sendTransactionViaMemberAccount()` -- Execute transactions through a member's smart account
- Lifecycle: `markAccountDeploying()` -> `markAccountPredicted()` -> `markAccountActive()`, with `suspendMemberAccount()` / `reactivateMemberAccount()` for status management
- `createLocalMemberSignerBinding()` -- Links a local passkey to a member's on-chain account
- `resolveMembersNeedingAccounts()` -- Identifies members who need account provisioning

### Green Goods Module

`greengoods/` integrates with the Green Goods garden token contract:

- Garden lifecycle: `createGreenGoodsGarden()`, `syncGreenGoodsGardenProfile()`, `setGreenGoodsGardenDomains()`, `createGreenGoodsGardenPools()`
- Work submissions: `submitGreenGoodsWorkSubmission()`, `submitGreenGoodsWorkApproval()`, `submitGreenGoodsImpactReport()`, `createGreenGoodsAssessment()`
- Gardener management: `addGreenGoodsGardener()`, `removeGreenGoodsGardener()`
- GAP admin sync: `syncGreenGoodsGapAdmins()` for trusted member co-signing
- Member binding: `syncGreenGoodsMemberBindings()`, `resolveGreenGoodsGardenerBindingActions()`
- Domain mask helpers: `toGreenGoodsDomainMask()`, `fromGreenGoodsDomainMask()`
- Deployments per chain with `getGreenGoodsDeployment(chainKey)`

### ERC-8004 Module

`erc8004/` provides on-chain agent identity and reputation:

- `registerAgentIdentity()` -- Register an agent on the IdentityRegistry contract
- `updateAgentURI()` -- Update agent metadata URI
- `buildAgentManifest()` / `encodeAgentManifestURI()` -- Build and encode agent manifest for on-chain storage
- `giveAgentFeedback()` / `readAgentFeedbackHistory()` / `readAgentReputation()` -- Reputation system via ReputationRegistry contract
- `buildAgentLogExport()` -- Export agent logs for on-chain attestation
- Deployments on both `arbitrum` and `sepolia`

### FVM Module (Filecoin VM)

`fvm/` registers coop archives and memberships on Filecoin:

- `fvm/abi.ts` -- CoopRegistry ABI fragments (registerArchive, registerMembership)
- `fvm/fvm.ts` -- `createFvmPublicClient()`, `encodeFvmRegisterArchiveCalldata()`, `encodeFvmRegisterMembershipCalldata()`, `createMockFvmRegistryState()`
- Chain configs for `filecoin` (mainnet) and `filecoin-calibration` (testnet)

### Policy Module (Action Approval Workflows)

`policy/` implements bounded execution governance:

- `policy/policy.ts` -- `createDefaultPolicies()` generates approval-required policies for all action classes, `createPolicy()` for custom policies
- `policy/action-bundle.ts` -- `TypedActionBundle` creation with EIP-712 typed data hashing, validation, and TTL (24h default)
- `policy/approval.ts` -- Status state machine: proposed -> approved/rejected -> executed/failed/expired, with `canTransition()` guards
- `policy/executor.ts` -- Pre-execution validation (status, expiry, replay, digest) and `executeApprovedAction()` with handler registry
- `policy/replay.ts` -- `ReplayGuard` for double-execution prevention
- `policy/log.ts` -- `createActionLogEntry()` audit trail with 100-entry rolling limit

### Permit Module (Execution Permits)

`permit/` provides time-bounded delegated execution:

- `permit/permit.ts` -- `createExecutionPermit()`, `revokePermit()`, `computePermitStatus()` (active/expired/revoked/exhausted), `consumePermitUse()`
- `permit/enforcement.ts` -- `validatePermitForExecution()` checks expiry, revocation, action allowlist, target allowlist, executor identity, and replay protection
- `permit/log.ts` -- `createPermitLogEntry()` audit trail with 100-entry rolling limit

### Session Module (Session Keys)

`session/` implements Rhinestone smart session keys for bounded automation:

- `SESSION_CAPABLE_ACTION_CLASSES` -- Currently scoped to Green Goods garden operations
- `createSessionCapability()` / `computeSessionCapabilityStatus()` / `revokeSessionCapability()` -- Capability lifecycle
- `buildSmartSession()` -- Constructs Rhinestone session with time-frame and usage-limit policies
- `wrapUseSessionSignature()` / `encodeSmartSessionSignature()` -- Session key signing
- `encryptSessionPrivateKey()` / `decryptSessionPrivateKey()` -- Encrypted key storage with `coop-session-wrap-v1` context
- `validateSessionCapabilityForBundle()` -- Validates a session can execute a given action bundle

### Operator Module

`operator/` manages anchor/trusted-node capabilities:

- `createAnchorCapability()` -- Toggle anchor mode (enables live archive, Safe actions)
- `isAnchorCapabilityActive()` -- Check if current auth session matches the anchor actor
- `describeAnchorCapabilityStatus()` -- Human-readable status description
- `createPrivilegedActionLogEntry()` / `appendPrivilegedActionLog()` -- Audit log for privileged actions

### Privacy Module (Zero-Knowledge)

`privacy/` provides Semaphore-based anonymous membership proofs:

- `privacy/membership.ts` -- `createPrivacyIdentity()` (random Semaphore v4 identity), `restorePrivacyIdentity()` (deterministic from secret), `createMembershipGroup()` (off-chain Semaphore Group)
- `privacy/membership-proof.ts` -- `generateMembershipProof()`, `verifyMembershipProof()` -- ZK proof generation and verification
- `privacy/anonymous-publish.ts` -- `generateAnonymousPublishProof()` -- Proves coop membership without revealing which member, scoped to specific artifact
- `privacy/groups.ts` -- Bandada API SDK integration: `createBandadaGroup()`, `addBandadaMember()`, `removeBandadaMember()` for on-chain group management
- `privacy/lifecycle.ts` -- `initializeCoopPrivacy()` -- Generates Semaphore identity + stealth keys on coop creation/join

### Stealth Module (ERC-5564)

`stealth/` implements ERC-5564 stealth addresses using secp256k1:

- `generateStealthKeys()` -- Random spending + viewing key pair
- `computeStealthMetaAddress()` -- Derive meta-address from key pair
- `generateStealthAddress()` -- Create one-time stealth address from meta-address
- `checkStealthAddress()` -- Scan whether a stealth address belongs to a key pair (view tag optimization)
- `computeStealthPrivateKey()` -- Derive the spending key for a matched stealth address
- `prepareStealthAnnouncement()` -- Build announcement for on-chain publication
- All functions are pure cryptographic operations -- no network access

### Transcribe Module

`transcribe/` provides local audio transcription:

- `isWhisperSupported()` -- Checks if `@huggingface/transformers` is available
- `transcribeAudio()` -- Transcribes audio blob using local Whisper model (default: `onnx-community/whisper-tiny.en`). Prefers WebGPU, falls back to WASM. Pipeline instance is cached after first load.
- `resetWhisperPipeline()` -- Clears cached pipeline instance

### Design Tokens

`styles/tokens.css` is the CSS custom property system imported by both app and extension:

- **Palette**: `--coop-cream`, `--coop-brown`, `--coop-green`, `--coop-orange`, `--coop-mist`, `--coop-ink`, `--coop-error`
- **Alpha palette**: `--coop-brown-{4,6,8,12,14,16,18,20}`, `--coop-green-{12,14,16}`, `--coop-orange-{15,16,18}` via `color-mix()`
- **Borders/Lines**: `--coop-line`, `--coop-border`
- **Shadows**: `--coop-shadow-sm`, `--coop-shadow-md`, `--coop-shadow-lg`
- **Radii**: `--coop-radius-pill` (999px), `--coop-radius-card` (24px), `--coop-radius-card-lg` (28px), `--coop-radius-card-xl` (30px), `--coop-radius-input` (16px), `--coop-radius-input-lg` (20px), `--coop-radius-photo` (18px), `--coop-radius-chip` (12px), `--coop-radius-sm` (8px), `--coop-radius-xs` (6px), `--coop-radius-button` (14px), `--coop-radius-icon` (10px)
- **Z-index scale**: `--coop-z-base` (0), `--coop-z-sticky` (1), `--coop-z-dropdown` (10), `--coop-z-tooltip` (20), `--coop-z-toast` (25), `--coop-z-modal` (30), `--coop-z-overlay` (100)
- **Spacing**: `--coop-space-3xs` (0.15rem) through `--coop-space-xl` (2rem)
- **Typography**: `--coop-font-display` (Gill Sans), `--coop-font-body` (Avenir Next), `--coop-font-mono` (SFMono)
- **Transitions**: `--coop-ease` (180ms ease)
- **Surfaces**: `--coop-surface`, `--coop-surface-card`, `--coop-surface-elevated`, etc. (semantic UI tokens)
- **Dark mode**: Full palette override under `@media (prefers-color-scheme: dark)` with `:root:not([data-theme="light"])` guard

### Utility Functions

`utils/index.ts` provides core helpers used everywhere:
- `createId(prefix)` -- UUID-based IDs with semantic prefix (e.g., `coop-abc123`)
- `hashText(value)` / `hashJson(value)` -- keccak256 via viem
- `toDeterministicAddress(seed)` -- Reproducible addresses from seeds
- `encodeBase64Url()` / `decodeBase64Url()` -- URL-safe base64 for invite codes and payloads
- `canonicalizeUrl()` -- Strips tracking params and hash
- `truncateWords()` -- Word-boundary truncation with ellipsis

## Anti-Patterns

- **Never import from deep paths** (`@coop/shared/modules/coop/flows`). Use `@coop/shared`.
- **Never define domain types outside `schema.ts`**. All Zod schemas live there. Utility interfaces (like `CoopDocRecord`) in their module files are OK.
- **Never create hooks in shared**. Shared is pure functions and types. UI hooks belong in extension/app.
- **Never skip Zod validation** for data crossing trust boundaries (invite codes, receiver sync envelopes, onchain state, blob relay messages).
- **Never hardcode chain IDs**. Use `getCoopChainConfig(chainKey)`.
- **Never use `Date.now()` directly for stored timestamps**. Use `nowIso()`.
- **Never store raw Yjs docs in Dexie**. Use `encodeCoopDoc()` to get `Uint8Array` first.

## Key Files

- `contracts/schema.ts` -- All domain schemas and types (2191 lines, the contract)
- `modules/coop/flows.ts` -- createCoop, joinCoop, generateInviteCode, parseInviteCode
- `modules/coop/sync.ts` -- Yjs document management, WebRTC sync providers
- `modules/coop/pipeline.ts` -- Passive capture pipeline, relevance scoring, draft shaping
- `modules/coop/board.ts` -- React Flow board snapshot creation and graph building
- `modules/coop/review.ts` -- Draft visibility, receiver draft seeding, meeting mode sections
- `modules/coop/outbox.ts` -- Offline-first sync outbox with retry tracking
- `modules/coop/capture-exclusions.ts` -- URL patterns excluded from passive capture
- `modules/coop/publish.ts` -- Draft-to-artifact promotion, publish flow
- `modules/storage/db.ts` -- Dexie schema, all CRUD functions
- `modules/storage/portability.ts` -- Encrypted database export/import (PBKDF2)
- `modules/auth/auth.ts` -- Passkey session creation and restoration
- `modules/auth/identity.ts` -- Local identity CRUD, mock identity creation
- `modules/onchain/onchain.ts` -- Safe deployment, chain config, mock/live modes
- `modules/onchain/authority.ts` -- Authority class to action class mappings
- `modules/onchain/safe-owners.ts` -- Safe owner management calldata
- `modules/onchain/signatures.ts` -- Universal signature validation
- `modules/onchain/provider.ts` -- Public client factory with Kohaku light client
- `modules/blob/channel.ts` -- WebRTC data channel for blob sync
- `modules/blob/sync.ts` -- Binary blob chunking/reassembly protocol
- `modules/blob/relay.ts` -- WebSocket blob relay protocol
- `modules/blob/store.ts` -- Encrypted blob storage in Dexie
- `modules/blob/resolve.ts` -- Three-tier blob resolution (local -> peer -> gateway)
- `modules/blob/compress.ts` -- Image compression and thumbnail generation
- `modules/agent/agent.ts` -- Observation/plan/step creation, skill output schema registry
- `modules/agent/memory.ts` -- Cross-session memory persistence
- `modules/member-account/member-account.ts` -- Per-member Kernel/Safe smart accounts
- `modules/greengoods/greengoods.ts` -- Green Goods garden contract integration
- `modules/erc8004/erc8004.ts` -- ERC-8004 agent registry integration
- `modules/fvm/fvm.ts` -- Filecoin VM CoopRegistry integration
- `modules/policy/action-bundle.ts` -- Typed action bundles with EIP-712 hashing
- `modules/policy/executor.ts` -- Bounded execution validation and dispatch
- `modules/policy/replay.ts` -- Replay protection guard
- `modules/permit/permit.ts` -- Execution permit lifecycle
- `modules/permit/enforcement.ts` -- Permit validation for execution
- `modules/session/session.ts` -- Rhinestone smart session key management
- `modules/operator/operator.ts` -- Anchor capability and privileged action logging
- `modules/privacy/anonymous-publish.ts` -- Anonymous publish proof generation
- `modules/privacy/membership.ts` -- Semaphore identity and group creation
- `modules/privacy/lifecycle.ts` -- Privacy initialization on coop lifecycle events
- `modules/privacy/groups.ts` -- Bandada on-chain group management
- `modules/stealth/stealth.ts` -- ERC-5564 stealth address cryptography
- `modules/transcribe/whisper.ts` -- Local Whisper transcription
- `modules/archive/archive.ts` -- Bundle creation, receipt recording
- `modules/archive/storacha.ts` -- Storacha client, delegation, upload
- `modules/archive/restore.ts` -- Reconstruct CoopSharedState from archive
- `modules/archive/story.ts` -- Archive receipt formatting, worthiness assessment
- `modules/receiver/pairing.ts` -- Pairing payload creation, validation, deep links
- `modules/receiver/relay.ts` -- WebSocket relay with reconnect, HMAC signing
- `utils/index.ts` -- ID generation, hashing, base64url, URL utilities
