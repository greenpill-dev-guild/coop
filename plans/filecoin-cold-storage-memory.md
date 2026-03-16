# Filecoin Cold Storage Memory Layer

> Coop is a DataDAO for community knowledge. Members capture and curate knowledge collectively, govern what's worth preserving via a review board, and permanently archive it to Filecoin with full cryptographic provenance — hash-chained snapshots, inclusion proofs, and CIDs anchored on-chain via a Safe multisig.

## Context

Coop archives knowledge (artifacts + snapshots) to Storacha (IPFS hot) which brokers Filecoin deals (cold storage). The core pipeline works end-to-end. This plan covers the remaining work to make archiving self-service for coop creators, visible to users, and verifiable on both Arbitrum and Filecoin's FVM.

**What works today:**
- [x] Artifact and snapshot bundling with JSON payloads
- [x] UCAN-delegated uploads to Storacha via trusted-node architecture
- [x] CID tracking (root, shard, piece)
- [x] Filecoin deal lifecycle tracking (pending → offered → indexed → sealed)
- [x] Archive story/narrative layer for dashboard display
- [x] JSON and text bundle exports
- [x] Schema versioning (`schemaVersion: 1`) for forward compatibility
- [x] Hash chain between snapshots (`previousSnapshotCid`)
- [x] Full inclusion proofs stored (not just boolean)
- [x] On-chain CID anchoring via Safe calldata (Arbitrum)
- [x] Per-coop archive config split (public CRDT + private Dexie secrets)
- [x] Per-coop config resolution (per-coop first, global fallback)
- [x] Gateway retrieval with CID verification (`retrieveArchiveBundle`)
- [x] Background polling for unsealed receipts (manual trigger, batched)

**What's missing:**
- No in-app setup wizard — coop creators must configure 6+ env vars manually
- No Filecoin deal visibility in the UI (data exists, not surfaced)
- No public verification page for archived CIDs
- No FVM registry — archive CIDs only anchored on Arbitrum, not on Filecoin itself
- No automated polling scheduler (manual refresh only)
- Anchor UI incomplete (no tx link display)
- Archive config UI not built (creation form, settings panel)

## Phase 1: In-App Storacha Setup Wizard

> Goal: A coop creator enables Filecoin archiving with just an email address. No CLI, no env vars, no external console.

### 1.1 Storacha space provisioning helper

Create `shared/src/modules/archive/setup.ts`:

- [ ] `provisionStorachaSpace(input: { email, coopName, signal? })` — orchestrates the full setup:
  1. `StorachaClient.create()` → generates Ed25519 agent keypair
  2. `client.login(email)` → sends verification email, awaits confirmation
  3. `client.createSpace(`coop-${coopName}`, { account })` → provisions space with gateway auth
  4. Extracts agent private key, space DID, delegation proofs from client state
  5. Returns `{ publicConfig: CoopArchiveConfig, secrets: CoopArchiveSecrets }`
- [ ] `extractClientCredentials(client, space)` — serializes agent key + delegation into the existing schema shapes
- [ ] Handle errors: email verification timeout, network failures, space creation failures
- [ ] Unit tests with mocked Storacha client (same pattern as `storacha.test.ts`)

### 1.2 Background message handler

In `extension/src/background/handlers/archive.ts`:

- [ ] Add `handle-archive-setup` message type:
  - Receives `{ coopId, email, coopName }`
  - Calls `provisionStorachaSpace()`
  - Stores secrets via `setCoopArchiveSecrets(db, coopId, secrets)`
  - Writes public config to `CoopSharedState.archiveConfig` (CRDT-synced)
  - Returns `{ success: true, spaceDid }` or `{ error }`
- [ ] Add `handle-archive-disconnect` message type:
  - Clears per-coop secrets from Dexie
  - Removes `archiveConfig` from shared state
  - Existing receipts preserved (they're historical records)

### 1.3 Setup wizard UI

Sidepanel component (3-step flow):

- [ ] **Step 1 — Email**: Input field + "Continue" button. Show pricing context ("Free: 5GB · Paid: ~$0.01/GB/mo · Your space, your bill")
- [ ] **Step 2 — Verify**: "Check your email" with spinner. Auto-advances when `login()` resolves. Timeout after 5 minutes with retry option
- [ ] **Step 3 — Done**: Shows space DID (truncated), gateway URL, storage usage. "Archiving is live" confirmation
- [ ] Wire up via `handle-archive-setup` message to background
- [ ] Add to coop creation flow as optional collapsible section ("Enable Filecoin archiving")
- [ ] Add to Nest Tools / coop settings as "Filecoin Archiving" section with setup/disconnect

### 1.4 Archive status in coop settings

- [ ] Show archive config status: Off / Setting up / Live
- [ ] When live: truncated Space DID, gateway URL, receipt count, total archived size
- [ ] "Disconnect" button (clears config, preserves receipts)
- [ ] Only coop creator/operator sees setup controls

## Phase 2: Filecoin Deal Explorer (in-app)

> Goal: Make the Filecoin integration visible. Users see exactly where their knowledge is stored, which providers hold it, and the full deal lifecycle.

### 2.1 Deal details on archive receipt cards

- [ ] Surface existing `filecoinInfo` data in the archive receipt UI:
  - Piece CID (truncated, copyable)
  - Provider ID(s) (e.g. `f01234`) with link to `filfox.info/en/address/{provider}`
  - Deal ID(s) with link to `filfox.info/en/deal/{dealId}`
  - Deal status badge (pending → offered → indexed → sealed)
  - Inclusion proof available indicator
- [ ] Show aggregate info when available (which aggregate contains this piece)
- [ ] Timestamp of last Filecoin status update

### 2.2 Anchor transaction display

- [ ] Show "Anchored on Arbitrum" badge with tx hash link to block explorer
- [ ] Show anchor status: pending / anchored
- [ ] Link format: `arbiscan.io/tx/{anchorTxHash}` (Arbitrum) or `sepolia.arbiscan.io/tx/{anchorTxHash}` (Sepolia)

### 2.3 Coop archive summary

- [ ] Aggregate view in coop dashboard:
  - Total artifacts archived / total artifacts
  - Total snapshots taken
  - Number of unique Filecoin providers storing coop data
  - Number of sealed deals
  - Total data size on Filecoin
- [ ] Use existing `buildCoopArchiveStory()` as data source, extend if needed

## Phase 3: Public CID Verification Page

> Goal: Anyone can verify a coop's archive without the extension. A public page on `coop.town` that fetches from IPFS and shows provenance.

### 3.1 Verification route on landing site

In `packages/app`:

- [ ] Add route: `/verify/:cid`
- [ ] Fetch content from IPFS gateway (`https://storacha.link/ipfs/{cid}`)
- [ ] Parse the archive bundle JSON
- [ ] Display:
  - Coop name and ID (from `payload.coop`)
  - Archive scope (artifact or snapshot)
  - Schema version
  - Created at timestamp
  - Previous snapshot CID (if snapshot — link to `/verify/{previousCid}`)
  - Number of artifacts included
  - Content preview (artifact titles, tags)

### 3.2 On-chain verification

- [ ] If the bundle includes an anchor tx hash, verify on-chain:
  - Fetch tx from Arbitrum/Sepolia via public RPC
  - Decode calldata to confirm CID matches
  - Show "Anchored on Arbitrum at block N" with explorer link
- [ ] If FVM registry exists (Phase 4), also check FVM registration

### 3.3 Shareable verification links

- [ ] Archive receipt cards in the extension get a "Share verification link" button
- [ ] Copies `https://coop.town/verify/{rootCid}` to clipboard
- [ ] Works for anyone — no extension or account needed

## Phase 4: FVM Data Registry Contract

> Goal: Anchor archive CIDs on Filecoin itself, not just Arbitrum. The archive registry lives on the same network that stores the data.

### 4.1 Registry contract (Solidity on FVM)

- [ ] Write `CoopArchiveRegistry.sol`:
  ```solidity
  // Minimal registry — maps coop addresses to their archive CIDs
  struct ArchiveEntry {
      bytes32 rootCid;      // content root
      bytes32 pieceCid;     // Filecoin piece CID
      uint8 scope;          // 0 = artifact, 1 = snapshot
      uint48 timestamp;     // block.timestamp at registration
  }

  mapping(address => ArchiveEntry[]) public archives;

  event ArchiveRegistered(
      address indexed coop,
      bytes32 rootCid,
      bytes32 pieceCid,
      uint8 scope,
      uint48 timestamp
  );

  function register(bytes32 rootCid, bytes32 pieceCid, uint8 scope) external {
      archives[msg.sender].push(ArchiveEntry(rootCid, pieceCid, scope, uint48(block.timestamp)));
      emit ArchiveRegistered(msg.sender, rootCid, pieceCid, scope, uint48(block.timestamp));
  }

  function getArchives(address coop) external view returns (ArchiveEntry[] memory);
  function getArchiveCount(address coop) external view returns (uint256);
  ```
- [ ] Keep it minimal — no access control beyond `msg.sender` (the Safe calls it)
- [ ] Events for indexing (subgraph-ready)
- [ ] Deploy to Filecoin Calibration testnet first, then Filecoin mainnet

### 4.2 FVM chain config

In `shared/src/modules/onchain/`:

- [ ] Add Filecoin Calibration and Filecoin mainnet to chain config (`getCoopChainConfig`)
- [ ] viem already has Filecoin chain definitions (`viem/chains/definitions/filecoin`)
- [ ] Add registry contract address per chain
- [ ] Add FVM RPC endpoints

### 4.3 Dual-anchor flow

In `extension/src/background/handlers/archive.ts`:

- [ ] After Storacha upload succeeds, submit registration to FVM registry
  - Encode `register(rootCid, pieceCid, scope)` calldata
  - Submit via Safe on FVM (if coop has FVM Safe) or direct EOA tx
  - Store FVM tx hash in receipt alongside Arbitrum anchor
- [ ] Add to `archiveReceiptSchema`:
  - `fvmRegistryTxHash: z.string().optional()`
  - `fvmChainKey: coopChainKeySchema.optional()`
- [ ] Update receipt display to show dual-anchor status

### 4.4 FVM verification in public page

- [ ] On `/verify/:cid`, also query the FVM registry contract
- [ ] Show "Registered on Filecoin" with tx link to `filfox.info/en/tx/{hash}`
- [ ] Cross-reference: "Stored by provider X (Filecoin deal Y), registered on FVM, anchored on Arbitrum"

## Phase 5: Automated Polling + UI Polish

> Goal: Filecoin deal status tracked to completion without manual intervention.

### 5.1 Background polling scheduler

- [ ] Add periodic alarm/timer in extension background:
  - Every 6 hours: refresh receipts with status `offered`
  - Every 24 hours: refresh receipts with status `indexed`
  - Cap at 30 refresh attempts before marking as stale
- [ ] Use existing `pollUnsealedArchiveReceipts()` and `requestArchiveReceiptFilecoinInfo()`
- [ ] Only runs when `archiveMode === 'live'` and receipts exist

### 5.2 Archive receipt timeline

- [ ] Show lifecycle timeline on receipt detail view:
  ```
  Uploaded → Offered → Indexed → Sealed
  Mar 14     Mar 14    Mar 15    Mar 17
  ```
- [ ] Use `followUp` metadata for timestamps

## Phase 6: Rich Payloads (future)

### 6.1 Archive binary assets
- [ ] For each artifact source URL, attempt to fetch and include as a blob
- [ ] Store preview images inline (base64 or separate CAR block)
- [ ] Track which assets were successfully captured vs URL-only references

### 6.2 Delta snapshots
- [ ] Compute diff from `previousSnapshotCid` instead of full state
- [ ] Store only new/changed artifacts and receipts
- [ ] Reduces payload growth from O(n) to O(delta)

## Key Files

| File | What changes |
|---|---|
| `shared/src/modules/archive/setup.ts` | **NEW** — Storacha space provisioning wizard logic |
| `shared/src/modules/archive/storacha.ts` | Minor — credential extraction helpers |
| `shared/src/modules/archive/archive.ts` | Minor — FVM anchor fields on receipt |
| `shared/src/contracts/schema.ts` | FVM anchor fields, archive setup message types |
| `shared/src/modules/onchain/onchain.ts` | FVM chain config, registry calldata encoding |
| `extension/src/background/handlers/archive.ts` | Setup handler, disconnect handler, FVM registration, polling scheduler |
| `extension/src/views/` | Setup wizard UI, deal explorer, archive settings, receipt cards |
| `packages/app/src/` | `/verify/:cid` public verification page |
| `contracts/CoopArchiveRegistry.sol` | **NEW** — FVM registry contract |

## Dependencies

```
Phase 1 (Setup Wizard)     — No external deps. Storacha SDK already installed.
Phase 2 (Deal Explorer)    — No deps. Data already exists, needs UI.
Phase 3 (Verification)     — Depends on Phase 2 (receipt card links). App route only.
Phase 4 (FVM Registry)     — Independent. Needs Hardhat/Foundry for contract dev.
Phase 5 (Polling)          — Independent. Extension background only.
Phase 6 (Rich Payloads)    — Future. No current dependencies.
```

## Hackathon Priority

1. **Phase 1** — Setup wizard (makes archiving demo-able without env vars)
2. **Phase 2** — Deal explorer (makes Filecoin integration visible to judges)
3. **Phase 4** — FVM registry (strongest "we're a Filecoin project" signal)
4. **Phase 3** — Verification page (shareable proof, great for pitch)
5. **Phase 5** — Polling (nice-to-have, not demo-critical)

## Success Criteria

- A coop creator enables Filecoin archiving with just an email address
- Users see exactly which Filecoin providers store their knowledge and deal status
- Archive CIDs are registered on both Arbitrum (Safe anchor) and Filecoin FVM (registry)
- Anyone can verify a coop's archive via a public URL without the extension
- The coop is framed as a DataDAO: members govern knowledge, Safe controls the archive, Filecoin provides the storage guarantee
