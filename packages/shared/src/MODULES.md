# @coop/shared Module Architecture

C4 Level 3 component map of the shared package.
20 domain modules, 1 schema layer, 1 utility layer, 1 sync-config, 2 style sheets, 2 entry points.

---

## Layer Diagram

Dependency flow from leaf to root. Arrows mean "depends on".

```
                             contracts/schema (Zod schemas + types)
                                        |
                                    utils/index
                                   /    |     \
                                  /     |      \
                            sync-config |    styles/tokens.css
                                 |      |    styles/a11y.css
                                 |      |
    +----------------------------+------+-------------------------------+
    |              |             |             |            |            |
  auth          coop         storage       receiver     transcribe     app
    |          / | \ \          |              |
    |         /  |  \ \         |              |
  onchain   blob  archive  greengoods      privacy
    |                          |               |
  member-account            erc8004         stealth
    |                        fvm
  session
    |
  policy --- permit --- operator
    |
  agent (reads from storage)

Entry points:
  index.ts      -> contracts + modules + sync-config + utils  (@coop/shared)
  app-entry.ts  -> contracts + app + receiver + storage + coop/board + archive/story + blob + transcribe + sync-config + utils  (@coop/shared/app)
```

---

## Contracts Layer

### contracts/

Single source of truth for all domain types. Every Zod schema lives here; types are inferred with `z.infer<>`.

| File | Purpose |
|------|---------|
| `schema.ts` | Barrel re-exporting all sub-schemas |
| `schema-enums.ts` | Shared enumerations (CaptureMode, MemberRole, CoopSpaceType, etc.) |
| `schema-identity.ts` | AuthSession, LocalPasskeyIdentity, PasskeyCredential |
| `schema-content.ts` | TabCandidate, ReadablePageExtract, CoopInterpretation, ReviewDraft, Artifact |
| `schema-coop.ts` | CoopSharedState, CoopProfile, CoopSoul, RitualDefinition, InviteCode, Member |
| `schema-receiver.ts` | ReceiverCapture, ReceiverPairingRecord, ReceiverSyncEnvelope |
| `schema-archive.ts` | ArchiveReceipt, ArchiveBundle, ArchiveDelegationMaterial |
| `schema-onchain.ts` | OnchainState (with legacy chain key migration preprocess) |
| `schema-agent.ts` | AgentObservation, AgentPlan, SkillManifest, SkillRun, AgentMemory, AgentLog, ActionProposal |
| `schema-policy.ts` | ActionPolicy, ActionBundle, ActionLogEntry, ExecutionPermit, PermitLogEntry |
| `schema-session.ts` | SessionCapability, SessionCapabilityLogEntry, EncryptedSessionMaterial |
| `schema-greengoods.ts` | GreenGoodsMemberBinding, GardenState, WorkApproval, Assessment, HypercertMintRequest |
| `schema-crypto.ts` | SignatureValidationResult, AuthorityClass, AuthorityActionMapping |
| `schema-sync.ts` | SyncRoomConfig, SyncRoomBootstrap, ICE config, signaling messages, CoopBlobRecord |
| `schema-privacy.ts` | PrivacyIdentity, StealthKeys, StealthMetaAddress, StealthAnnouncement, MembershipProof |
| `schema-erc8004.ts` | ERC-8004 agent identity and reputation schemas |

---

## Utility Layer

### utils/

Pure helper functions with no domain logic. Used by every module.

| Export | Purpose |
|--------|---------|
| `createId(prefix)` | UUID-based IDs with semantic prefix (e.g. `coop-abc123`) |
| `nowIso()` | ISO timestamp for all stored dates (never use `Date.now()` directly) |
| `hashText(value)` | keccak256 of a string via viem |
| `hashJson(value)` | keccak256 of canonical JSON (deterministic key ordering) |
| `toDeterministicAddress(seed)` | Reproducible Ethereum address from a seed string |
| `toDeterministicBigInt(seed)` | Reproducible bigint from a seed string (salt nonces) |
| `assertHexString(value)` | Runtime hex string assertion returning `0x${string}` |
| `slugify(value)` | URL-safe slug from arbitrary text |
| `unique(items)` | Deduplicate array via Set |
| `clamp(value, min, max)` | Numeric clamping |
| `groupBy(items, key)` | Group array into Record by key function |
| `asArray(value)` | Normalize `T | T[] | undefined` to `T[]` |
| `encodeBase64Url()` / `decodeBase64Url()` | URL-safe base64 for invite codes and payloads |
| `bytesToBase64()` / `bytesToBase64Url()` / `base64ToBytes()` | Binary-to-base64 conversions |
| `canonicalizeUrl(rawUrl)` | Strips tracking params, credentials, and hash fragments |
| `sanitizeTextForInference(value)` | Redacts emails, tokens, secrets, phone numbers from text |
| `sanitizeValueForInference(value)` | Deep-sanitize objects/arrays for safe LLM inference |
| `extractDomain(rawUrl)` | Hostname without `www.` prefix |
| `truncateWords(value, max)` | Word-boundary truncation with ellipsis |
| `compactWhitespace(value)` | Collapse runs of whitespace to single space |

### sync-config.ts

WebRTC and signaling configuration shared across all sync layers.

| Export | Purpose |
|--------|---------|
| `defaultSignalingUrls` | `['wss://api.coop.town']` |
| `defaultWebsocketSyncUrl` | `'wss://api.coop.town/yws'` |
| `defaultIceServers` | Google STUN servers for WebRTC |
| `parseSignalingUrls(raw)` | Parse comma-separated URL string to array |
| `filterUsableSignalingUrls(urls)` | Keep only valid ws/wss/http/https protocols |
| `buildIceServers(turn?)` | Merge STUN defaults with optional TURN config |

---

## Module Groups

### Core

#### agent

Agent harness, skill pipeline, observation triggers, inference cascade, cross-session memory.

| File | Key Exports |
|------|-------------|
| `agent.ts` | `skillOutputSchemas`, `createAgentObservation()`, `updateAgentObservation()`, `buildAgentObservationFingerprint()`, `createAgentPlanStep()`, `evaluateAgentPlanStep()`, `shouldTriggerAgentPlan()`, `SKILL_REGISTRY` |
| `memory.ts` | `createAgentMemory()`, `queryAgentMemories()`, `pruneAgentMemories()` |

**Dependencies**: contracts/schema, utils, storage (memory persistence via Dexie)

---

#### app

Shared app-shell helpers for browser environment detection, icon state, sound, clipboard, and haptics.

| File | Key Exports |
|------|-------------|
| `capabilities.ts` | `BrowserUxCapabilities`, `detectBrowserUxCapabilities()` |
| `surface.ts` | `AppSurface`, `AppPlatform`, `detectAppSurface()` |
| `icon-state.ts` | Extension icon badge state management |
| `sound.ts` | Sound preferences, `shouldPlaySound()`, `soundPattern()` |
| `playback.ts` | Audio playback helpers |
| `clipboard.ts` | Clipboard read/write |
| `haptics.ts` | Vibration API wrapper |

**Dependencies**: contracts/schema (leaf module, minimal deps)

---

#### auth

Passkey-first identity and WebAuthn session management.

| File | Key Exports |
|------|-------------|
| `auth.ts` | `createPasskeySession()`, `restorePasskeyAccount()`, `sessionToMember()`, `authSessionToLocalIdentity()` |
| `identity.ts` | `ensurePasskeyIdentity()`, `createMockPasskeyIdentity()`, `resolveLocalIdentity()` |

**Dependencies**: contracts/schema, utils, coop/member-factory

---

#### coop

Core coop lifecycle: create/join, sync (Yjs/WebRTC), content pipeline, review, board, publish, outbox.

| File | Key Exports |
|------|-------------|
| `flows.ts` | `createCoop()`, `joinCoop()`, `generateInviteCode()`, `parseInviteCode()`, `acceptInvite()` |
| `sync.ts` | `createCoopDoc()`, `readCoopState()`, `writeCoopState()`, `updateCoopState()`, `encodeCoopDoc()`, `connectSyncProviders()`, `deriveSyncRoomId()`, `createSyncRoomConfig()`, `summarizeSyncTransportHealth()` |
| `pipeline.ts` | `buildReadablePageExtract()`, `interpretExtractForCoop()`, `shapeReviewDraft()`, `runPassivePipeline()` |
| `board.ts` | `buildBoardSnapshot()`, `buildBoardGraph()`, board node/edge types |
| `review.ts` | `createReceiverDraftSeed()`, `computeDraftVisibility()`, draft section helpers |
| `publish.ts` | `buildReviewBoard()`, `promoteToArtifact()`, `updateMemoryProfileFromArtifacts()` |
| `outbox.ts` | `createOutboxEntry()`, `addOutboxEntry()`, `markOutboxSynced()`, `markOutboxFailed()`, `getPendingOutboxEntries()` |
| `presets.ts` | `getRitualLenses()`, `formatCoopSpaceTypeLabel()`, ritual/space presets |
| `capture-exclusions.ts` | `CAPTURE_EXCLUSION_DEFAULTS`, `isDomainExcluded()` |
| `inference.ts` | `LocalInferenceProvider` interface, `detectLocalInferenceCapability()` |
| `synthesis.ts` | `synthesizeCoopFromPurpose()`, `synthesizeTranscriptsToPurpose()`, `summarizeRitualArtifact()`, `summarizeSoulArtifact()` |
| `setup-insights.ts` | `toSetupInsights()`, `createDefaultSetupSummary()`, `emptySetupInsightsInput()` |
| `memory-profile.ts` | `buildMemoryProfileSeed()`, memory profile update helpers |
| `member-factory.ts` | `createMember()`, `createDeviceBoundWarning()` |

**Dependencies**: contracts/schema, utils, sync-config, blob/relay, archive/story, greengoods, member-account, onchain, transcribe/types

---

#### storage

Dexie (IndexedDB) persistence layer. 33 tables, CRUD helpers, encrypted export/import.

| File | Key Exports |
|------|-------------|
| `db-schema.ts` | `CoopDexie` class (Dexie subclass), `createCoopDb()`, table type definitions |
| `db-crud-content.ts` | `savePageExtract()`, `saveTabCandidate()`, `saveReviewDraft()`, `mergeCoopStateUpdate()`, `findDuplicatePageExtract()` |
| `db-crud-coop.ts` | `loadCoopState()`, `saveCoopState()`, `migrateLegacyChainKeys()`, `listCoopDocs()` |
| `db-crud-receiver.ts` | `saveReceiverCapture()`, `saveReceiverPairing()`, `getReceiverCaptures()` |
| `db-crud-agent.ts` | `saveAgentObservation()`, `saveAgentPlan()`, `saveSkillRun()`, `saveAgentMemory()`, `listAgentMemories()`, `deleteAgentMemories()` |
| `db-crud-policy.ts` | `saveActionBundle()`, `saveActionLogEntry()`, `saveExecutionPermit()`, `savePermitLogEntry()` |
| `db-crud-session.ts` | `saveSessionCapability()`, `saveSessionCapabilityLogEntry()`, `saveEncryptedSessionMaterial()` |
| `db-crud-fvm.ts` | `saveFvmSignerBinding()`, `getFvmSignerBinding()` |
| `db-crud-privacy.ts` | `savePrivacyIdentity()`, `getPrivacyIdentity()`, `getPrivacyIdentitiesForCoop()`, `saveStealthKeyPair()` |
| `db-encryption.ts` | `encryptForLocalStorage()`, `decryptFromLocalStorage()`, `LOCAL_DATA_PLACEHOLDER_PREFIX` |
| `db-maintenance.ts` | `hydrateCoopDocs()`, `pruneStaleRecords()`, `normalizeLegacyState()` |
| `portability.ts` | `exportDatabaseToEncryptedBlob()`, `importDatabaseFromEncryptedBlob()`, PBKDF2 key derivation (200K iterations) |

**Dependencies**: contracts/schema, utils, coop/pipeline, coop/sync, fvm, receiver/capture

---

#### receiver

PWA receiver for cross-device capture sync (phone to extension).

| File | Key Exports |
|------|-------------|
| `pairing.ts` | `createReceiverPairingPayload()`, `toReceiverPairingRecord()`, `buildReceiverPairingDeepLink()`, `verifyReceiverPairingHmac()` |
| `capture.ts` | `createReceiverCapture()`, `createReceiverDeviceIdentity()` |
| `sync.ts` | `signReceiverSyncEnvelope()`, `verifyReceiverSyncEnvelope()`, `connectReceiverDocSync()` |
| `relay.ts` | `connectReceiverSyncRelay()`, HMAC-SHA256 frame signing |
| `bridge.ts` | `ingestReceiverCapture()`, schema validation at trust boundary |
| `retry.ts` | `shouldRetryReceiverSync()`, exponential backoff with configurable limits |
| `limits.ts` | `RECEIVER_CAPTURE_LIMITS`, per-kind size/count constraints |

**Dependencies**: contracts/schema, utils, sync-config

---

#### transcribe

Local audio transcription via Whisper (WebGPU/WASM, no cloud).

| File | Key Exports |
|------|-------------|
| `whisper.ts` | `isWhisperSupported()`, `transcribeAudio()`, `resetWhisperPipeline()` |
| `loader.ts` | `loadTransformers()` dynamic import for `@huggingface/transformers` |
| `types.ts` | `TranscriptionResult`, `TranscriptionSegment` |

**Dependencies**: none (leaf module, dynamic import only)

---

### Media & Sync

#### blob

Binary asset storage, peer-to-peer sync (WebRTC), relay (WebSocket), compression, three-tier resolution.

| File | Key Exports |
|------|-------------|
| `store.ts` | `saveCoopBlob()`, `getCoopBlob()`, `listCoopBlobs()`, `deleteCoopBlob()`, `pruneCoopBlobs()`, `touchCoopBlobAccess()` |
| `sync.ts` | `BlobSyncMessage`, `chunkBlob()`, `reassembleChunks()`, `EAGER_SYNC_KINDS`, `LAZY_SYNC_KINDS`, `BLOB_CHUNK_SIZE` |
| `channel.ts` | `createBlobSyncChannel()`, `BlobRelayTransport` interface |
| `relay.ts` | `BlobRelayMessage`, `encodeBlobRelayMessage()`, `decodeBlobRelayMessage()`, `MESSAGE_BLOB_RELAY` |
| `compress.ts` | `compressImage()`, `generateThumbnailDataUrl()` |
| `resolve.ts` | `resolveBlob()` (local -> peer -> gateway), `fetchBlobFromGateway()` |

**Dependencies**: contracts/schema, utils, storage/db, archive/crypto, archive/verification

---

#### archive

Storacha/Filecoin upload, bundle creation, receipt tracking, restore from archive.

| File | Key Exports |
|------|-------------|
| `archive.ts` | `createArchiveBundle()`, `recordArchiveReceipt()`, `createMockArchiveReceipt()`, `applyArchiveAnchor()`, `mergeCoopArchiveConfig()`, `summarizeArchiveFilecoinInfo()` |
| `storacha.ts` | `uploadArchiveBundleToStoracha()`, `requestArchiveDelegation()` |
| `setup.ts` | `provisionStorachaSpace()`, `extractClientCredentials()` |
| `crypto.ts` | `encryptArchivePayloadEnvelope()`, `decryptArchiveBlobBytes()` |
| `verification.ts` | `computeStorachaFileRootCid()`, `serializeArchiveInclusionProof()`, `verifyArchiveInclusionProof()` |
| `filecoin-witness.ts` | `createArchiveOnChainSealWitnessArtifact()` |
| `export.ts` | `exportReviewDraftJson()`, `exportArtifactJson()`, `exportCoopSnapshotJson()` |
| `restore.ts` | `restoreCoopFromArchive()` |
| `story.ts` | `buildCoopArchiveStory()`, `describeArchiveReceipt()`, `isArchiveWorthy()`, `withArchiveWorthiness()` |

**Dependencies**: contracts/schema, utils, coop/sync, coop/memory-profile, onchain, storage/db

---

### Onchain

#### onchain

Safe creation via Pimlico, chain configuration, provider factory, owner management, signature validation.

| File | Key Exports |
|------|-------------|
| `onchain.ts` | `deployCoopSafeAccount()`, `getCoopChainConfig()`, `createUnavailableOnchainState()`, `CoopOnchainMode`, `encodeArchiveAnchorCalldata()`, `decodeArchiveAnchorCalldata()` |
| `provider.ts` | `createCoopPublicClient()`, Kohaku light client integration |
| `authority.ts` | `AUTHORITY_ACTION_MAP`, `getAuthorityForAction()`, authority class definitions |
| `safe-owners.ts` | `addSafeOwner()`, `removeSafeOwner()`, `swapSafeOwner()`, `changeThreshold()` |
| `signatures.ts` | `validateSignature()`, universal validation (EOA, ERC-1271, ERC-6492) |

**Dependencies**: contracts/schema, utils, auth (restorePasskeyAccount). External: viem, permissionless, @rhinestone/module-sdk

---

#### member-account

Per-member smart account provisioning (Kernel/Safe) and execution.

| File | Key Exports |
|------|-------------|
| `member-account.ts` | `createMemberAccountRecord()`, `predictMemberAccountAddress()`, `sendTransactionViaMemberAccount()`, `provisionMemberAccounts()`, `resolveMembersNeedingAccounts()`, `createLocalMemberSignerBinding()`, lifecycle status helpers |

**Dependencies**: contracts/schema, utils, auth, onchain

---

#### greengoods

Green Goods garden maintenance, member work submission, operator approvals, Hypercert packaging.

| File | Key Exports |
|------|-------------|
| `greengoods.ts` | Barrel re-exporting all sub-modules |
| `greengoods-garden.ts` | `createGreenGoodsGarden()`, `syncGreenGoodsGardenProfile()`, `setGreenGoodsGardenDomains()`, `createGreenGoodsGardenPools()` |
| `greengoods-state.ts` | `createInitialGreenGoodsState()`, `updateGreenGoodsState()` |
| `greengoods-work.ts` | `submitGreenGoodsWorkSubmission()`, `submitGreenGoodsWorkApproval()` |
| `greengoods-hypercert.ts` | `mintGreenGoodsHypercert()`, `createGreenGoodsAssessment()` |
| `greengoods-gardener.ts` | `addGreenGoodsGardener()`, `removeGreenGoodsGardener()` |
| `greengoods-authorization.ts` | `syncGreenGoodsGapAdmins()` |
| `greengoods-impact.ts` | `submitGreenGoodsImpactReport()` (legacy) |
| `greengoods-deployments.ts` | `getGreenGoodsDeployment()`, per-chain contract addresses, `ZERO_BYTES32` |
| `greengoods-abis.ts` | Contract ABIs for garden token, pool, hypercert, GAP |

**Dependencies**: contracts/schema, utils, auth, onchain

---

#### erc8004

ERC-8004 on-chain agent registry: identity registration, reputation, feedback.

| File | Key Exports |
|------|-------------|
| `erc8004.ts` | `registerAgentIdentity()`, `updateAgentURI()`, `buildAgentManifest()`, `encodeAgentManifestURI()`, `giveAgentFeedback()`, `readAgentFeedbackHistory()`, `readAgentReputation()`, `buildAgentLogExport()`, `getErc8004Deployment()` |

**Dependencies**: contracts/schema, utils, onchain (chain config + public client)

---

#### fvm

Filecoin VM CoopRegistry for archive and membership registration.

| File | Key Exports |
|------|-------------|
| `abi.ts` | `coopRegistryAbi` (registerArchive, registerMembership) |
| `fvm.ts` | `createFvmPublicClient()`, `encodeFvmRegisterArchiveCalldata()`, `encodeFvmRegisterMembershipCalldata()`, `createMockFvmRegistryState()`, `createLocalFvmSignerMaterial()`, `buildLocalFvmSignerBindingId()` |

**Dependencies**: contracts/schema, utils (no onchain dependency -- standalone Filecoin client)

---

### Governance & Permissions

#### policy

Action approval workflows: typed bundles, approval state machine, replay protection, execution.

| File | Key Exports |
|------|-------------|
| `policy.ts` | `createPolicy()`, `createDefaultPolicies()` |
| `action-bundle-core.ts` | `createActionBundle()`, EIP-712 typed data hashing, 24h TTL default |
| `action-bundle.ts` | Barrel: `action-payload-parsers`, `action-bundle-core`, `action-builders-*` |
| `action-builders-archive.ts` | Archive-specific action bundle builders |
| `action-builders-safe.ts` | Safe operation action bundle builders |
| `action-builders-greengoods.ts` | Green Goods action bundle builders |
| `action-payload-parsers.ts` | Parse typed payloads from action bundles |
| `approval.ts` | `submitApproval()`, `rejectBundle()`, `canTransition()`, status state machine (proposed -> approved/rejected -> executed/failed/expired) |
| `executor.ts` | `executeBundle()`, `validateExecution()`, `ActionHandlerRegistry` |
| `replay.ts` | `createReplayGuard()`, `checkReplayId()`, `recordExecutedReplayId()` |
| `log.ts` | `createActionLogEntry()`, 100-entry rolling audit log |

**Dependencies**: contracts/schema, utils (no cross-module deps -- self-contained)

---

#### permit

Execution permits with time-bounded capabilities, enforcement, and audit logging.

| File | Key Exports |
|------|-------------|
| `permit.ts` | `createExecutionPermit()`, `revokePermit()`, `computePermitStatus()`, `consumePermitUse()` |
| `enforcement.ts` | `validatePermitForExecution()` (expiry, revocation, action/target allowlist, executor identity, replay) |
| `log.ts` | `createPermitLogEntry()`, `appendPermitLog()`, `formatPermitLogEventLabel()`, 100-entry rolling limit |

**Dependencies**: contracts/schema, utils, policy/replay (shared replay guard)

---

#### session

Scoped execution permissions via Rhinestone smart session keys.

| File | Key Exports |
|------|-------------|
| `session.ts` | `createSessionCapability()`, `computeSessionCapabilityStatus()`, `revokeSessionCapability()`, `buildSmartSession()`, `wrapUseSessionSignature()`, `encryptSessionPrivateKey()`, `decryptSessionPrivateKey()`, `validateSessionCapabilityForBundle()`, `SESSION_CAPABLE_ACTION_CLASSES` |

**Dependencies**: contracts/schema, utils, greengoods (deployment addresses), onchain (chain config). External: @rhinestone/module-sdk, viem/account-abstraction

---

#### operator

Anchor/trusted-node runtime behavior and privileged action audit logging.

| File | Key Exports |
|------|-------------|
| `operator.ts` | `createAnchorCapability()`, `isAnchorCapabilityActive()`, `describeAnchorCapabilityStatus()`, `createPrivilegedActionLogEntry()`, `appendPrivilegedActionLog()` |

**Dependencies**: contracts/schema, utils (minimal -- self-contained governance module)

---

### Privacy

#### privacy

Semaphore ZK membership proofs, anonymous publishing, Bandada group management.

| File | Key Exports |
|------|-------------|
| `membership.ts` | `createPrivacyIdentity()`, `restorePrivacyIdentity()`, `createMembershipGroup()` |
| `membership-proof.ts` | `generateMembershipProof()`, `verifyMembershipProof()` |
| `anonymous-publish.ts` | `generateAnonymousPublishProof()` |
| `groups.ts` | `createBandadaGroup()`, `addBandadaMember()`, `removeBandadaMember()`, `syncBandadaGroupState()` |
| `lifecycle.ts` | `initializeCoopPrivacy()`, `initializeMemberPrivacy()` |

**Dependencies**: contracts/schema, utils, stealth, storage/db. External: @semaphore-protocol/core, @bandada/api-sdk

---

#### stealth

ERC-5564 stealth addresses using secp256k1. Pure cryptographic operations, no network access.

| File | Key Exports |
|------|-------------|
| `stealth.ts` | `generateStealthKeys()`, `computeStealthMetaAddress()`, `generateStealthAddress()`, `checkStealthAddress()`, `computeStealthPrivateKey()`, `prepareStealthAnnouncement()` |

**Dependencies**: contracts/schema (leaf module). External: ox (Secp256k1), viem/utils

---

## Sync & Storage Layer

### Dexie (IndexedDB)

`CoopDexie` is the local database in `storage/db-schema.ts`. Currently at schema version 4. 33 tables covering content, coops, receiver, agent, policy, sessions, privacy, blobs, and settings.

Every CRUD function takes `db: CoopDexie` as its first argument. Multi-table writes use `db.transaction('rw', ...)`.

### Yjs (CRDT Sync)

`coop/sync.ts` manages the shared state document:

- `CoopSharedState` is stored in a `Y.Map<string>` under key `"coop"`, each field JSON-serialized
- Read/write via `readCoopState()` / `writeCoopState()` / `updateCoopState(doc, updater)`
- `connectSyncProviders()` sets up `IndexeddbPersistence` + `WebrtcProvider` + optional `WebsocketProvider`
- Sync rooms are deterministic: `deriveSyncRoomId(coopId, roomSecret)`
- Bootstrap rooms use `bootstrap:` prefix for invited members before full sync
- Blob relay is multiplexed over the same WebRTC data channel via `MESSAGE_BLOB_RELAY` (message type 2)

### Receiver Sync

Uses WebSocket relay (not WebRTC) because service workers lack `RTCPeerConnection`. Relay frames are HMAC-SHA256 signed with the pair secret. Failed syncs use exponential backoff retry.

---

## Styles & Tokens

### styles/tokens.css

CSS custom property system imported by both app and extension entry points. Light/dark mode with system preference detection and explicit `data-theme` override.

| Category | Tokens |
|----------|--------|
| **Palette** | `--coop-cream`, `--coop-brown`, `--coop-brown-soft`, `--coop-green`, `--coop-orange`, `--coop-mist`, `--coop-ink`, `--coop-error` |
| **Alpha palette** | `--coop-brown-{4..20}`, `--coop-green-{12..16}`, `--coop-orange-{15..18}` via `color-mix()` |
| **Shadows** | `--coop-shadow-sm`, `--coop-shadow-md`, `--coop-shadow-lg` |
| **Radii** | `--coop-radius-pill` (999px) through `--coop-radius-xs` (6px), 10 scale stops |
| **Z-index** | `--coop-z-base` (0) through `--coop-z-overlay` (100), 7 scale stops |
| **Spacing** | `--coop-space-3xs` (0.15rem) through `--coop-space-xl` (2rem) |
| **Typography** | `--coop-font-display` (Gill Sans), `--coop-font-body` (Avenir Next), `--coop-font-mono` (SFMono) |
| **Transitions** | `--coop-ease` (180ms ease) |
| **Surfaces** | `--coop-surface`, `--coop-surface-card`, `--coop-surface-elevated`, `--coop-surface-input`, `--coop-surface-strong`, `--coop-overlay` |
| **Semantic** | `--coop-text`, `--coop-text-soft`, `--coop-border`, `--coop-panel`, `--coop-field`, `--coop-pill-bg`, `--coop-pill-text`, `--coop-primary`, `--coop-text-action`, `--coop-active-bg`, `--coop-scrollbar`, `--coop-placeholder`, `--coop-page-gradient` |

### styles/a11y.css

Accessibility utilities: focus indicators (`outline: 2px solid var(--coop-orange)`), `.sr-only` class, live region baseline, 44px minimum touch targets for receiver shell, and `prefers-reduced-motion` suppression.

---

## Entry Points

### `index.ts` -- Main barrel (`@coop/shared`)

```
export * from './contracts';   // All Zod schemas + types
export * from './modules';     // All 20 domain modules
export * from './sync-config'; // Signaling, ICE, WebSocket URLs
export * from './utils';       // Utility functions
```

Used by: extension, shared consumers. This is the standard import path for all downstream packages.

### `app-entry.ts` -- App surface (`@coop/shared/app`)

Narrower surface for the companion PWA. Cherry-picks from modules instead of re-exporting everything:

- Full re-exports: contracts, app, receiver, storage
- Selective re-exports: `coop/board`, `coop/setup-insights`, `coop/presets`, `coop/synthesis`, `archive/story`, `blob` (compress + saveCoopBlob), `transcribe`, `sync-config` (buildIceServers), `utils` (createId, nowIso)

Used by: `packages/app` only.

### Additional package.json exports

| Path | Points to |
|------|-----------|
| `@coop/shared/contracts` | `contracts/index.ts` (schemas only, no module logic) |
| `@coop/shared/sync-config` | `sync-config.ts` (sync URLs and ICE config) |
| `@coop/shared/agent` | `modules/agent/index.ts` (direct agent access) |
| `@coop/shared/archive` | `modules/archive/index.ts` (direct archive access) |

---

## Import Rules

```typescript
// Extension and shared consumers: standard barrel
import { createCoop, joinCoop, CoopDexie } from '@coop/shared';

// App shell only: narrower surface
import { detectAppSurface, buildIceServers } from '@coop/shared/app';

// NEVER import from deep source paths
// BAD: import { createCoop } from '@coop/shared/modules/coop/flows';
```

---

## Cross-Module Dependency Summary

| Module | Depends On (other modules) |
|--------|---------------------------|
| agent | storage |
| app | (leaf) |
| archive | coop/sync, coop/memory-profile, onchain, storage |
| auth | coop/member-factory |
| blob | storage, archive/crypto, archive/verification |
| coop | blob/relay, archive/story, greengoods, member-account, onchain, transcribe/types |
| erc8004 | onchain |
| fvm | (leaf -- standalone Filecoin client) |
| greengoods | auth, onchain |
| member-account | auth, onchain |
| onchain | auth |
| operator | (leaf) |
| permit | policy/replay |
| policy | (leaf) |
| privacy | stealth, storage |
| receiver | (leaf -- uses only sync-config) |
| session | greengoods, onchain |
| stealth | (leaf) |
| storage | coop/pipeline, coop/sync, fvm, receiver/capture |
| transcribe | (leaf) |

Leaf modules (no cross-module deps): app, fvm, operator, policy, receiver, stealth, transcribe.

---

## External Dependencies

| Library | Used By | Purpose |
|---------|---------|---------|
| `zod` | contracts, all modules | Runtime schema validation and type inference |
| `viem` | utils, onchain, auth, stealth, fvm, greengoods, session, erc8004, member-account | Ethereum client, ABI encoding, cryptographic primitives |
| `permissionless` | onchain, member-account | Safe + ERC-4337 smart account client |
| `@rhinestone/module-sdk` | onchain, session | Smart session module installation and signing |
| `yjs` | coop/sync | CRDT document sync |
| `y-webrtc` | coop/sync | WebRTC transport for Yjs |
| `y-websocket` | coop/sync | WebSocket transport for Yjs |
| `y-indexeddb` | coop/sync | IndexedDB persistence for Yjs |
| `dexie` | storage | IndexedDB wrapper |
| `ox` | stealth | secp256k1 curve operations (via @noble/curves) |
| `@storacha/client` | archive | Storacha (Filecoin) upload client |
| `@semaphore-protocol/core` | privacy | ZK membership proof generation/verification |
| `@bandada/api-sdk` | privacy | On-chain group management |
| `@openzeppelin/merkle-tree` | privacy | Merkle tree for group membership |
| `multiformats` | archive | CID computation for content-addressed storage |
