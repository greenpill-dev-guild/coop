# Filecoin Cold Storage Memory Layer

> Strengthen Coop's Filecoin integration from demo-ready archival to a verifiable, permanent memory layer for community knowledge.

## Context

Coop archives knowledge (artifacts + snapshots) to Storacha (IPFS hot) which brokers Filecoin deals (cold storage). The pipeline works end-to-end but lacks the provenance and retrieval guarantees needed for a true permanent memory layer.

**What works today:**
- Artifact and snapshot bundling with JSON payloads
- UCAN-delegated uploads to Storacha via trusted-node architecture
- CID tracking (root, shard, piece)
- Filecoin deal lifecycle tracking (pending → offered → indexed → sealed)
- Archive story/narrative layer for dashboard display
- JSON and text bundle exports

**What's missing:**
- No on-chain link between Safe identity and archive CIDs
- No schema versioning for forward compatibility
- No hash chain between snapshots
- Inclusion proofs discarded (only boolean tracked)
- No programmatic retrieval from gateway
- No automated Filecoin status polling
- JSON-only payloads (binary assets not archived)
- Unbounded snapshot growth

## Phase 1: Foundation (schema + versioning + chain linking)

### 1.1 Add schema version to archive bundles
- [ ] Add `schemaVersion: z.number().int().positive()` to `archiveBundleSchema` in `contracts/schema.ts`
- [ ] Set initial version to `1`
- [ ] Update `createArchiveBundle` in `archive.ts` to include `schemaVersion: 1`
- [ ] Update mock receipt creation to include schema version
- [ ] Write migration note: future schema changes bump the version, old bundles self-describe

### 1.2 Add previousSnapshotCid to snapshots
- [ ] Add `previousSnapshotCid: z.string().optional()` to snapshot bundle payload
- [ ] In `createArchiveBundle` (scope=snapshot), look up the latest snapshot receipt's `rootCid` from `state.archiveReceipts` and include as `previousSnapshotCid`
- [ ] This creates a verifiable hash chain: anyone with the latest CID can walk back through the entire history via IPFS

### 1.3 Store full inclusion proofs
- [ ] Update `summarizeArchiveFilecoinInfo` in `archive.ts` to store the full inclusion proof bytes (base64-encoded), not just `inclusionProofAvailable: boolean`
- [ ] Update `archiveFilecoinInfoSchema` in `schema.ts` with `inclusionProof: z.string().optional()` per aggregate
- [ ] This enables independent verification without going back to Storacha

## Phase 2: On-chain CID anchoring

### 2.1 Design the anchoring mechanism
- [ ] Decide approach: (a) Simple Safe module that stores `rootCid → timestamp` mappings, (b) Safe transaction with CID in calldata, or (c) Dedicated registry contract the Safe calls
- [ ] Consider gas costs on Arbitrum vs Sepolia
- [ ] Consider batching: anchor multiple CIDs in one transaction
- [ ] Design the schema: `anchorArchive(bytes32 rootCid, bytes32 pieceCid, uint8 scope, uint256 timestamp)`

### 2.2 Implement the anchor contract
- [ ] Write a minimal Solidity contract (or Safe module) for CID anchoring
- [ ] Deploy to Sepolia for testing
- [ ] Add contract address to chain config (`getCoopChainConfig`)

### 2.3 Wire anchoring into the archive flow
- [ ] After `uploadArchiveBundleToStoracha` succeeds, submit an anchor transaction via the Safe (ERC-4337 UserOp)
- [ ] Store the anchor transaction hash in the archive receipt
- [ ] Add `anchorTxHash: z.string().optional()` to `archiveReceiptSchema`
- [ ] Update the receipt lifecycle: `uploaded → anchored → offered → sealed`

### 2.4 Update UI
- [ ] Show anchor status on archive receipt cards ("Anchored on Arbitrum" with tx link)
- [ ] Add anchor tx to export bundles

## Phase 3: Per-coop archive ownership

### 3.1 Split archive config (public/secret)
- [ ] Create `coopArchiveConfigSchema` with public fields: `spaceDid`, `delegationIssuer`, `gatewayBaseUrl`, `allowsFilecoinInfo`, `expirationSeconds`
- [ ] Add `archiveConfig: coopArchiveConfigSchema.optional()` to `CoopSharedState`
- [ ] Add `'archiveConfig'` to `sharedKeys` in `sync.ts`
- [ ] Create `setCoopArchiveSecrets(db, coopId, secrets)` / `getCoopArchiveSecrets(db, coopId)` in `db.ts` for private fields (`agentPrivateKey`, `spaceDelegation`, `proofs`)

### 3.2 Update background handlers
- [ ] Replace `requireTrustedNodeArchiveConfig()` with `resolveArchiveConfigForCoop(coopId)` that: checks per-coop config first, falls back to global config
- [ ] Update `createArchiveReceiptForBundle`, `handleRefreshArchiveStatus` to use per-coop resolution
- [ ] Add `set-coop-archive-config` message type

### 3.3 UI: Archive config in coop creation
- [ ] Add collapsible "Connect Storacha Space" section to coop creation form
- [ ] Fields: Space DID, Agent Private Key (password), Space Delegation (paste/upload), Gateway URL
- [ ] If skipped, coop starts in practice/mock mode

### 3.4 UI: Archive settings in Nest Tools
- [ ] Show per-coop archive config status (practice / live / live view-only)
- [ ] "Connect Storacha Space" button for unconfigured coops
- [ ] Config display (truncated space DID, gateway, issuer) with Update/Remove actions
- [ ] Only coop creator/operator sees the secrets form

### 3.5 UI: Per-coop archive status
- [ ] Update "Save mode" indicator to read from `coop.archiveConfig` presence
- [ ] Update Operator Console to show per-coop save mode
- [ ] Update "Refresh deep-save check" enablement per-coop

## Phase 4: Retrieval + verification

### 4.1 Implement gateway retrieval
- [ ] Create `retrieveArchiveBundle(receipt)` function in `archive.ts`
- [ ] Fetch from `gatewayUrl` via HTTP GET
- [ ] Verify response CID matches `rootCid` (recompute content hash)
- [ ] Parse and validate payload against `schemaVersion`
- [ ] Handle gateway errors, timeouts, CID mismatches

### 4.2 UI: Retrieve and inspect
- [ ] Add "View archived content" button on receipt cards
- [ ] Fetch from gateway, display the archived JSON payload
- [ ] Show verification status (CID match: yes/no)

### 4.3 Automated follow-up polling
- [ ] Add periodic background polling for receipts with status != 'sealed'
- [ ] Poll interval: every 6 hours for offered, every 24 hours for indexed
- [ ] Cap at N polls before marking as stale
- [ ] Update receipt follow-up metadata on each poll

## Phase 5: Rich payloads (future)

### 5.1 Archive binary assets
- [ ] For each artifact source URL, attempt to fetch and include as a blob in the archive bundle
- [ ] Store `previewImageUrl` content inline (base64 or separate CAR block)
- [ ] Track which assets were successfully captured vs URL-only references

### 5.2 Delta snapshots
- [ ] Instead of full coop state each time, compute a diff from `previousSnapshotCid`
- [ ] Store only new/changed artifacts and receipts
- [ ] Reduces payload growth from O(n) to O(delta)

## Key Files

| File | What changes |
|---|---|
| `shared/src/contracts/schema.ts` | Bundle schema (version), receipt schema (anchor), coop state (archiveConfig), filecoin info (proofs) |
| `shared/src/modules/archive/archive.ts` | Bundle creation (version, previousCid), receipt lifecycle (anchor status), proof storage |
| `shared/src/modules/archive/storacha.ts` | Per-coop delegation resolution |
| `shared/src/modules/storage/db.ts` | Per-coop archive secrets storage |
| `shared/src/modules/coop/sync.ts` | Add archiveConfig to sharedKeys |
| `extension/src/background.ts` | Per-coop config resolution, anchor transaction submission |
| `extension/src/runtime/messages.ts` | New message types for per-coop config |
| `extension/src/views/Sidepanel/SidepanelApp.tsx` | Archive config UI in creation + settings |
| `extension/src/views/Sidepanel/OperatorConsole.tsx` | Per-coop archive status |

## Dependencies

- Phase 1 has no external dependencies (schema + code changes only)
- Phase 2 requires Solidity contract development + deployment
- Phase 3 requires Phase 1 (schema version) but not Phase 2
- Phase 4 requires Phase 1 (schema version for validation)
- Phase 5 is independent, can happen anytime after Phase 1

## Success Criteria

- An archived bundle can self-describe its format (schema version)
- Snapshot history is walkable via CID chain without any centralized service
- Archive CIDs are provably linked to the coop's Safe address on-chain
- Each coop controls its own Storacha space and delegation
- Archived content can be retrieved, verified, and inspected from the UI
- Filecoin deal status is tracked to completion without manual intervention
