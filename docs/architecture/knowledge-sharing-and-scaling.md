---
title: "Knowledge Sharing, Agent Synthesis & Scaling"
sidebar_label: "Knowledge & Scaling"
sidebar_position: 3
---

# Knowledge Sharing, Agent Synthesis & Scaling Architecture

**Status**: Architectural assessment with remediation plan
**Updated**: 2026-03-13
**Scope**: Knowledge flow, agent feedback loop, Yjs scaling, long-term storage
**Audience**: Core contributors, protocol reviewers, grant evaluators

---

## 1. Executive Summary

Coop is a browser-first, local-first knowledge commons. Knowledge enters through browser tabs, mobile captures, and agent observations. It flows through a six-stage pipeline (capture, draft, publish, sync, feed, archive) with a fully autonomous in-browser agent that synthesizes insights and proposes actions back into the shared knowledge graph.

The architecture is fundamentally sound for current scale (small coops, \<20 members, \<500 artifacts). **The critical risk is not the choice of CRDT library (Yjs scales well) but how we use it.** Storing entire state arrays as JSON strings inside Y.Map values defeats CRDT merge semantics, causes silent data loss on concurrent edits, and bloats document size proportional to total operations rather than current state size.

This document maps the full architecture, identifies concrete performance and scaling constraints, and proposes a phased remediation plan.

---

## 2. Knowledge Flow Pipeline

### 2.1 The Six Stages

```
CAPTURE → DRAFT → PUBLISH → SYNC → FEED → ARCHIVE
   │         │        │        │       │        │
   │         │        │        │       │        └─ Storacha/Filecoin (CID-addressed, cryptographic proof)
   │         │        │        │       └────────── CoopSharedState.artifacts[] (Yjs Y.Doc)
   │         │        │        └────────────────── y-indexeddb + y-webrtc (P2P mesh, max 8 peers)
   │         │        └─────────────────────────── publishDraftToCoops() → sibling Artifact per coop
   │         └──────────────────────────────────── ReviewDraft in Dexie (local-only, "the Roost")
   └────────────────────────────────────────────── Browser tabs, mobile receiver, agent observations
```

### 2.2 Capture Sources

Knowledge enters the system from three independent sources:

| Source | Storage | Trigger | Data Shape |
|--------|---------|---------|------------|
| **Browser tabs** | `tabCandidates` + `pageExtracts` (Dexie) | User keyboard shortcut or tab roundup | Title, headings, paragraphs, canonical URL, domain |
| **Mobile receiver** | `receiverCaptures` + `receiverBlobs` (Dexie) | Photo, audio, file, or link from paired PWA device | Base64 asset, metadata, HMAC-signed envelope |
| **Agent observations** | `agentObservations` (Dexie) | High-confidence draft (≥0.24), receiver backlog, ritual review due | Trigger type, fingerprint, linked draft/capture IDs |

### 2.3 Draft Stage (Local-Only)

All captured knowledge enters a local review queue before it can become shared:

```typescript
ReviewDraft {
  id, title, summary, sources[], tags[], category,
  whyItMatters, suggestedNextStep, suggestedTargetCoopIds[],
  confidence, archiveWorthiness, provenance,
  workflowStage: 'candidate' | 'ready',
  createdAt
}
```

- Stored in Dexie `reviewDrafts` table (indexed by category, createdAt, workflowStage, provenance)
- Never leaves the device until explicit publish
- `provenance` tracks origin: tab capture, agent-generated, receiver intake
- `archiveWorthiness` flags candidates for long-term preservation

### 2.4 Publish Flow

Publishing is an explicit, user-initiated action that moves local knowledge into the shared CRDT:

1. **Resolve actors**: Validate membership via `resolvePublishActorsForTargets()` (checks auth session + coop membership)
2. **Create sibling artifacts**: One `Artifact` per target coop (same `originId`, different `targetCoopId`)
3. **Write to Y.Doc**: `updateCoopState()` appends artifacts, rebuilds `reviewBoard` index
4. **Update memory profile**: Increment domain/tag/category counts, trim exemplar artifacts to 12 most recent
5. **Sync to peers**: Y.Doc update propagates via y-indexeddb (local) and y-webrtc (remote)

```typescript
Artifact {
  id, originId, targetCoopId,
  title, summary, sources[], tags[], category,
  whyItMatters, suggestedNextStep,
  createdBy (memberId), createdAt,
  reviewStatus: 'draft' | 'published' | 'reviewed' | 'actioned',
  archiveStatus: 'not-archived' | 'pending' | 'archived',
  archiveReceiptIds[]
}
```

### 2.5 Sync Layer

Two-layer real-time synchronization:

| Layer | Transport | Purpose | Config |
|-------|-----------|---------|--------|
| **y-indexeddb** | Browser IndexedDB | Local persistence across page reloads | Room ID: `coop-room-{hash(coopId:roomSecret)}` |
| **y-webrtc** | WebRTC data channels + BroadcastChannel | P2P sync between browser instances | Password: `roomSecret`, max 8 peers |

Room ID derivation:
```typescript
roomId = `coop-room-${hashText(`${coopId}:${roomSecret}`).slice(2, 18)}`
```

Sync health is reported every 2500ms with event-triggered updates on `status`, `synced`, and `peers` changes. Reconnection is scheduled at 1200ms delay after disconnect.

No awareness protocol is used; there is no cursor/presence tracking. All shared state is structured knowledge data.

### 2.6 Coop Feed & Board

The shared knowledge base is `CoopSharedState.artifacts[]`, visualized through `CoopBoardSnapshot`:

**Six node types** form a causal graph:
```
Member → Capture → Draft → Coop → Artifact → Archive
         (captured-by)  (seeded-from)  (routed-to)  (published-to)  (archived-in)
```

**Lane layout** for visualization:
```
40px      320px      620px      920px      1180px      1480px
Member    Capture    Draft      Coop       Artifact    Archive
```

**Story narrative**: `"{captures} finds moved from loose chickens through {drafts} drafts into {artifacts} shared finds, with {receipts} saved proof items keeping the trail visible."`

---

## 3. Agent Synthesis Loop

### 3.1 Overview

The agent runs entirely in-browser, with no cloud APIs and no data leaving the device. It executes in the extension's offscreen document on a 1.5-second polling interval:

```
OBSERVE → PLAN → EXECUTE (skill DAG) → SYNTHESIZE → PROPOSE → APPROVE
```

### 3.2 Observation & Trigger System

The background worker emits `AgentObservation` records when local state changes:

| Trigger | Source | Example |
|---------|--------|---------|
| `high-confidence-draft` | ReviewDraft with confidence ≥ 0.24 | Tab roundup produces a strong funding lead |
| `receiver-backlog` | ReceiverCapture needing intake | Mobile user sent a meeting photo |
| `ritual-review-due` | Weekly review cadence reached | 7 days since last review digest |
| `stale-archive-receipt` | Archive receipt needs status refresh | Filecoin deal status unknown |
| `green-goods-*` (6 triggers) | Green Goods garden lifecycle | Garden bootstrap, sync, assessment |

Observations are deduplicated by fingerprint (`buildAgentObservationFingerprint()`). After 3 consecutive failures, an observation transitions to `stalled` status and stops retrying.

### 3.3 Skill DAG & Execution

Skills are selected by trigger type, then topologically sorted using Kahn's algorithm with alphabetical tie-breaking:

**Opportunity → Funding Lead Pipeline:**
```
opportunity-extractor (root) → provides: candidates
    │
    └─ grant-fit-scorer (depends: opportunity-extractor) → provides: scores
           │
           └─ capital-formation-brief (depends: grant-fit-scorer) → creates: funding-lead draft
```

**Review & Publishing:**
```
review-digest → creates: insight draft
publish-readiness-check → proposes: publish-ready-draft action
```

**ERC-8004 Agent Registry:**
```
erc8004-register (root) → provides: agent-identity
erc8004-feedback (root) → provides: agent-feedback
```

**Skip conditions** prevent unnecessary execution:
- `no-candidates`: No opportunity candidates from prior skill
- `no-scores`: No grant fit scores from prior skill
- `no-draft`: No draft context available

### 3.4 Three-Tier Inference Cascade

Each skill runs through a fallback chain until one succeeds:

| Tier | Provider | Model | Runtime | Max Tokens |
|------|----------|-------|---------|------------|
| 1 | WebLLM | Qwen2-0.5B-Instruct (q4f16_1) | WebGPU | 700 |
| 2 | transformers.js | Qwen2.5-0.5B-Instruct (q4) | WASM | 512 |
| 3 | Heuristic rules | Deterministic | JS | N/A |

**Output reliability pipeline:**
1. `extractJsonBlock()`: Pull JSON from markdown fences or raw text
2. `repairJson()`: Fix control chars, trailing commas, truncated strings, unmatched braces
3. Zod schema validation: If fails, retry once with error appended to prompt

### 3.5 Agent → Shared Knowledge Feedback

The agent's outputs feed back into the knowledge pipeline at two points:

**1. Draft creation**: Skills generate `ReviewDraft` records:
- `capital-formation-brief` → category `funding-lead`, confidence 0.82
- `review-digest` → category `insight`, confidence 0.76
- Agent-generated drafts have `provenance: 'agent'`

**2. Action proposals**: Skills propose mutations to shared state:
- `publish-readiness-check` → proposes `publish-ready-draft` action
- Green Goods skills → propose garden/pool creation, sync, assessment actions

**Approval modes:**
| Mode | Behavior |
|------|----------|
| `advisory` | Output recorded, no action proposed |
| `proposal` | Queued for human review in operator console |
| `auto-run-eligible` | Executes immediately if skill is in `autoRunSkillIds` |

**Full cycle data flow:**
```
1. Draft published → background emits observation (fingerprinted)
2. Agent cycle picks up pending observation
3. buildSkillContext() hydrates coopDoc → readCoopState()
4. selectKnowledgeSkills() scores external SKILL.md files, injects top 3
5. Skills execute in DAG order through inference cascade
6. Skill outputs → ReviewDraft records saved to Dexie
7. publish-readiness-check → ActionProposal dispatched to background
8. If auto-execute: background mutates Y.Doc → encodeCoopDoc → Dexie
9. y-webrtc broadcasts update to all connected peers
```

### 3.6 External Knowledge Skills

The SKILL.md protocol enables importing domain knowledge from external sources:

```typescript
KnowledgeSkill {
  id, url,           // e.g. https://ethskills.com/gas/SKILL.md
  name, description, domain,
  content,           // markdown body
  contentHash,       // detect updates on refresh
  triggerPatterns[],  // keywords to match observation title/summary
  enabled            // global default, with per-coop overrides
}
```

Selection: `selectKnowledgeSkills()` scores all enabled skills against observation text (title + summary), returns top 3 for injection into the skill prompt as "Domain knowledge" context.

Per-coop overrides allow disabling specific knowledge skills via `CoopKnowledgeSkillOverride`.

---

## 4. Shared State Architecture (CoopSharedState)

### 4.1 CRDT Document Structure

All shared coop state lives in a single `Y.Doc` with a flat `Y.Map<string>` at root key `"coop"`:

```typescript
CoopSharedState {
  profile: CoopProfile,             // name, purpose, createdAt
  setupInsights: SetupInsights,     // onboarding data
  soul: CoopSoul,                   // narrative identity
  rituals: RitualDefinition[],      // governance frameworks (4 types)
  members: Member[],                // contributors (creator | trusted | member)
  invites: InviteCode[],            // pending memberships (with bootstrap snapshots)
  artifacts: Artifact[],            // published knowledge
  reviewBoard: ReviewBoardGroup[],  // indexed groups (by category, by member)
  archiveReceipts: ArchiveReceipt[],// Storacha/Filecoin proofs
  memoryProfile: CoopMemoryProfile, // aggregates (top domains, tags, categories, exemplars)
  syncRoom: SyncRoomConfig,         // peer discovery config
  onchainState: OnchainState,       // Safe/ERC-4337 account state
  greenGoods?: GreenGoodsGardenState
}
```

### 4.2 Current Read/Write Pattern

**Write** (`sync.ts:82-89`):
```typescript
export function writeCoopState(doc: Y.Doc, state: CoopSharedState) {
  const root = doc.getMap<string>(ROOT_KEY);
  doc.transact(() => {
    for (const key of sharedKeys) {
      root.set(key, JSON.stringify(state[key]));
    }
  });
}
```

**Read** (`sync.ts:91-101`):
```typescript
export function readCoopState(doc: Y.Doc): CoopSharedState {
  const root = doc.getMap<string>(ROOT_KEY);
  const raw = Object.fromEntries(
    sharedKeys.map((key) => {
      const value = root.get(key);
      return [key, value ? JSON.parse(value) : undefined];
    }),
  );
  return coopSharedStateSchema.parse(raw);
}
```

**Update** (`sync.ts:103-111`):
```typescript
export function updateCoopState(doc: Y.Doc, updater: (state: CoopSharedState) => CoopSharedState) {
  const current = readCoopState(doc);
  const next = updater(current);
  writeCoopState(doc, next);
}
```

Every mutation is a full read → transform → full write of all 13 fields.

---

## 5. The JSON-in-CRDT Problem

### 5.1 Why This Is Critical

The current pattern stores entire arrays (artifacts, members, invites, archiveReceipts) as JSON strings inside Y.Map values. This defeats the core value proposition of using a CRDT.

### 5.2 Silent Data Loss on Concurrent Edits

When two peers edit different parts of the same field concurrently:

```
Peer A: adds artifact "Funding Lead #3" → JSON.stringify(artifacts) → root.set('artifacts', '...')
Peer B: adds artifact "Research Note #7" → JSON.stringify(artifacts) → root.set('artifacts', '...')
```

Yjs resolves Y.Map key conflicts by picking the peer with the higher client ID. **One peer's artifact silently disappears.** The `artifacts` array is an opaque string to Yjs, it cannot merge individual array elements.

This is not a theoretical risk. Any two members publishing artifacts within the same sync window will hit this.

### 5.3 Unbounded Document Bloat

Y.Map retains every historical value per key for conflict resolution. Coop writes all 13 keys on every state mutation. The Liveblocks benchmarks quantify the cost:

| Pattern | Size after 100k operations on 10 keys |
|---------|---------------------------------------|
| Y.Map (current) | 524 KB |
| YKeyValue (y-utility) | 271 bytes |

**That is a 1,936x difference.**

The growth is proportional to total operations, not current state size. Over months of active use, the Y.Doc will grow far beyond the actual data it represents.

### 5.4 Sync Amplification

Changing `profile.name` triggers `writeCoopState()`, which re-serializes and re-sets all 13 keys. Each `root.set()` generates a Yjs update that transmits the entire JSON string for that key to all peers.

Worse, each invite contains an `InviteCoopBootstrapSnapshot` that embeds the full coop state. Five invites with 50 artifacts means the artifact list is stored 6 times in the document, all re-transmitted on any state change.

### 5.5 Read Path Overhead

Every `readCoopState()` call:
1. JSON-parses all 13 fields (including fields the caller does not need)
2. Runs full Zod schema validation (`coopSharedStateSchema.parse()`)
3. Returns a complete `CoopSharedState` object

This runs on every Y.Doc update (debounced 280ms in the sidepanel) and on every agent cycle. There is no way to read a single field without parsing all 13.

---

## 6. Performance Impact on Users

### 6.1 Runtime Overhead

| Component | Idle Cost | Active Cost | Frequency |
|-----------|-----------|-------------|-----------|
| Agent cycle (no work) | 5-10ms (2 IDB reads) |  | Every 1.5s |
| Agent cycle (full, 8 obs) |  | 500-1500ms (100+ IDB ops + inference) | Variable |
| Sidepanel state read | 2-5ms (JSON parse + Zod) |  | Every 280ms on doc update |
| WebLLM model load |  | 30-60s first load | Once per session |
| WebLLM VRAM held | 500-800 MB | Same | Persistent until extension unload |
| transformers.js fallback |  | 400-600 MB RAM peak | Once per session |
| Agent log writes | 2 rows/cycle | 50-60 rows/cycle | Every 1.5s |
| Receiver relay WebSocket | 0ms (idle) | Exponential backoff on failure | On demand |
| Offscreen document baseline | ~15-20 MB | Same | Persistent |

### 6.2 Specific User-Facing Risks

**Battery drain**: The offscreen document runs two `setInterval` loops at 1.5s continuously, even when idle. On laptops, this prevents the extension from being fully idle and contributes to battery drain.

**GPU memory pressure**: WebLLM loads a 250-350MB quantized model into VRAM and never releases it. Users running GPU-intensive applications (video editing, gaming, other AI tools) will contend for VRAM.

**Storage growth**: Agent logs accumulate unbounded, no TTL, no cleanup. Active usage produces ~115KB/day of log entries. Combined with Y.Doc bloat from the JSON-in-CRDT pattern, IndexedDB will grow faster than the actual knowledge content warrants.

**Receiver blob storage**: Photos and audio from mobile captures are stored as `dataBase64` in the `receiverBlobs` table. A few dozen photos can consume significant IndexedDB quota (~50MB implicit browser limit) with no eviction pipeline.

---

## 7. Long-Term Memory & Storage

### 7.1 Storage Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (IndexedDB via Dexie)                              │
│                                                             │
│  coopDocs        ─ Encoded Y.Docs (CRDT state snapshots)    │
│  reviewDrafts    ─ Local-only drafts (pre-publish)          │
│  tabCandidates   ─ Captured browser tabs                    │
│  pageExtracts    ─ Extracted tab content                    │
│  receiverCaptures─ Mobile capture metadata                  │
│  receiverBlobs   ─ Mobile capture binary data (base64)      │
│  agentObservations─ Agent trigger records                   │
│  agentLogs       ─ Structured trace spans (unbounded)       │
│  knowledgeSkills ─ External SKILL.md catalog                │
│  identities      ─ Passkey-based local identities           │
│  settings        ─ App preferences, auth, archive config    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Yjs CRDT (in-memory, synced across peers)                  │
│                                                             │
│  CoopSharedState ─ Full shared state (13 fields)            │
│    └─ artifacts, members, invites, archiveReceipts,         │
│       memoryProfile, reviewBoard, rituals, ...              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Storacha / IPFS (content-addressed, replicated)            │
│                                                             │
│  Archive bundles ─ JSON blobs (artifact or snapshot scope)  │
│  Root CIDs       ─ IPFS content hashes                      │
│  Shard CIDs      ─ IPLD DAG shards                         │
│  Piece CIDs      ─ Filecoin piece identifiers              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Filecoin (cryptographic proof, multi-year persistence)     │
│                                                             │
│  Sealed deals    ─ Aggregated piece CIDs                    │
│  Deal proofs     ─ On-chain verification                    │
│  Status tracking ─ pending → offered → indexed → sealed    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Archive Pipeline

**Step 1: Bundle creation:**
```typescript
createArchiveBundle({
  scope: 'artifact' | 'snapshot',
  state: CoopSharedState,
  artifactIds?: string[]
})
```
- `artifact` scope: selected artifacts with tags/sources
- `snapshot` scope: full state (profile, soul, rituals, artifacts, reviewBoard, receipts)

**Step 2: UCAN delegation:**
- Ed25519 agent key issues time-limited delegation (default 600s)
- Abilities granted: `filecoin/offer`, `space/blob/add`, `space/index/add`, `upload/add`
- Follow-up delegations grant only `filecoin/info`

**Step 3: Upload to Storacha:**
- Serialize bundle as JSON blob → `client.uploadFile()`
- Collect `shardCids[]` and `pieceCids[]` as pieces are stored
- Returns `rootCid` + `gatewayUrl` (`storacha.link/ipfs/{rootCid}`)

**Step 4: Record receipt:**
- Update artifact `archiveStatus` → `'archived'`
- Append `archiveReceiptIds[]` on each archived artifact
- Update `memoryProfile.archiveSignals` (tag/domain counts)
- Persist receipt in `CoopSharedState.archiveReceipts[]`

**Step 5: Follow-up (live mode):**
- Query Filecoin aggregation and deal state via `filecoin/info`
- Track status progression: `pending` → `offered` → `indexed` → `sealed`
- Increment `followUp.refreshCount`, track errors

### 7.3 Export Capabilities

| Function | Output |
|----------|--------|
| `exportCoopSnapshotJson(state)` | Full state JSON with timestamp |
| `exportArtifactTextBundle(artifact)` | Markdown with metadata |
| `exportSnapshotTextBundle(state)` | Markdown summary of coop |
| `exportArchiveReceiptTextBundle(receipt)` | Markdown with Filecoin deal IDs |

### 7.4 What Is Missing

| Gap | Risk | Impact |
|-----|------|--------|
| **No storage quota monitoring** | IndexedDB writes fail silently at ~50MB | Data loss without warning |
| **No eviction policy** | Old captures, synced blobs, completed logs accumulate | Storage pressure grows monotonically |
| **No memory decay** | `memoryProfile` tag/domain counts grow forever | Aggregate stats become noisy over months |
| **No archive receipt pruning** | Sealed receipts stay in Y.Doc indefinitely | Document bloat with write-once reference data |
| **No receiver blob archival** | Base64 photos/audio stay in IndexedDB | A few dozen captures can fill quota |
| **No agent log rotation** | Log table grows unbounded | ~115KB/day of trace data with no cleanup |

---

## 8. Scaling Assessment: Does Yjs Scale for Coop?

### 8.1 Yjs Raw Performance

Yjs itself is not the bottleneck. In the official CRDT benchmarks:

- Parses 2 million operations in under 1 second
- 30x faster than reference CRDT implementations
- ~10% the RAM of Automerge (pre-Rust rewrite)
- Documents under 1MB: encoding/decoding well under 16ms
- Documents at 2MB: 4-5 second initial loads (network + decode combined)
- Documents at 15.7MB: memory balloons from 18MB to 95MB in-heap (5x multiplier)

For Coop's use case (small groups, \<100 artifacts, \<20 members), raw Y.Doc size stays well under 1MB for months of normal use.

### 8.2 The Constraint Is Usage Pattern, Not Library Choice

The JSON-in-CRDT anti-pattern (Section 5) creates three compounding scaling limits that are independent of Yjs performance:

1. **Merge correctness**: Concurrent edits to different array elements cause silent data loss
2. **Size growth**: O(total operations) rather than O(current state)
3. **Sync bandwidth**: Full JSON blob retransmitted on any sub-field change

### 8.3 y-webrtc Mesh Limits

| Peers | Connections (mesh) | Viable? |
|-------|--------------------|---------|
| 4 | 6 | Comfortable |
| 8 | 28 | Fine for data-only (no audio/video) |
| 16 | 120 | Degraded, need SFU or server relay |
| 50+ | 1,225 | Not viable as mesh |

Current `maxConns: 8` is adequate for Coop's target group size. Data-only WebRTC mesh at 8 peers works well. Beyond that, a server-mediated provider (y-websocket) is needed.

### 8.4 Alternative CRDT Providers

| Alternative | Tradeoff for Coop |
|-------------|-------------------|
| **Loro** | Rust/WASM, movable lists/trees, but immature ecosystem, no y-webrtc equivalent |
| **Automerge** | JSON data model (more natural), but historically slower, needs custom WebRTC transport |
| **cr-sqlite / ElectricSQL** | SQL-based CRDTs, requires relational rearchitecture, overkill for shared state |
| **Liveblocks / PartyKit** | Hosted Yjs backends, conflicts with local-first philosophy |
| **Custom libp2p** | Maximum control, massive implementation effort, not justified |

**Verdict: No provider switch needed.** The fix is architectural, how we structure data inside the Y.Doc, not which CRDT library we use.

---

## 9. Remediation Plan

### Phase 1: Fix the Anti-Pattern (Critical, prevents data loss)

**Replace JSON strings with native Yjs types for collection fields.**

```typescript
// CURRENT: broken for concurrent edits
root.set('artifacts', JSON.stringify(state.artifacts));

// TARGET: correct CRDT merge
const artifacts = doc.getArray<Y.Map<string>>('artifacts');
// Push individual artifacts as Y.Map instances
// Update individual fields within artifact Y.Maps
// Yjs merges concurrent array pushes and field updates automatically
```

Scalar fields that rarely update concurrently (`profile`, `soul`, `onchainState`, `syncRoom`) should migrate to `YKeyValue` from `y-utility`:
- Y.Array-based key-value store
- Document size depends only on current state, not operation count
- 1,936x smaller than Y.Map for write-heavy keys (benchmarked)

**Migration path:**
1. Add a `docVersion` field to detect format
2. On load, if `docVersion < 2`, migrate JSON strings to native types
3. All peers must upgrade before the migration window closes
4. Fallback: read both formats during transition period

### Phase 2: Separate Invite Bootstrap from Sync State

Stop embedding full `CoopSharedState` snapshots inside invite codes that live in the Y.Doc:

- Invite codes contain only join metadata: `coopId`, `roomId`, `signalingUrls`, `inviteProof`
- The joining peer receives full state via Yjs sync after connecting to the room
- Eliminates quadratic invite-size growth (invites × artifacts × invite count)

### Phase 3: Runtime Performance Fixes

| Fix | Implementation | Impact |
|-----|----------------|--------|
| **Idle backoff** | Increase agent cycle to 10-30s when no pending observations | 6-20x reduction in idle CPU |
| **WebLLM unloading** | Call `teardown()` after 5 minutes of inactivity | Release 500-800MB VRAM |
| **Agent log rotation** | Cap at 1000 rows, delete oldest on insert | Bounded storage (~500KB max) |
| **Selective reads** | `readCoopField(doc, 'artifacts')`: parse only needed field | Skip JSON-parsing 12 unused fields |
| **Quota monitoring** | `navigator.storage.estimate()` in agent cycle | Early warning before silent write failures |
| **Receiver blob pipeline** | Archive to Storacha after sync, replace with CID reference | Free IndexedDB space after archival |

### Phase 4: Enable V2 Encoding

Switch to `Y.encodeStateAsUpdateV2` for smaller wire payloads and IndexedDB records. All clients must use matching encoding. Wire size improvements can be dramatic (1.98MB → 62 bytes in benchmarks for Y.Map operations).

Note: V2 encoding reduces transmission and storage size but does not reduce in-memory document size.

### Phase 5: Subdocuments (When Needed)

If users join many coops simultaneously, use Yjs subdocuments to lazy-load per-coop state:

```
Root Y.Doc: { coopIds: Y.Array<string> }
  └─ Per-coop subdoc: { coopState: ... }  (loaded on demand)
```

Trade-off: no atomic cross-document transactions. Acceptable since each coop is independent.

Not urgent while users typically have 1-3 coops.

### Phase 6: Server-Mediated Sync (When Needed)

If group size exceeds 8 peers or signaling reliability becomes an issue, add y-websocket with a lightweight persistent server:

- **Cloudflare Durable Objects**: natural fit (stateful, low-latency, global)
- Server acts as a persistent peer, sync happens even when no browser tabs are open
- Maintains local-first semantics (server is a peer, not an authority)
- Enables offline members to receive updates when they come back online

---

## 10. Receiver Sync Architecture

### 10.1 Two-Channel Design

The receiver (mobile PWA → extension) uses two parallel channels to handle different runtime constraints:

**Channel 1: Receiver CRDT (Yjs)**
- Dedicated `Y.Doc("receiver-sync")` with nested `Y.Map("captures")`
- Connected via y-indexeddb + y-webrtc (if `RTCPeerConnection` available)
- Used when both devices support WebRTC

**Channel 2: Receiver Relay (WebSocket)**
- For service workers that lack `RTCPeerConnection`
- HMAC-SHA256 signed frames for authentication
- Pub/sub topics: `coop-receiver-sync/{roomId}/capture` and `/ack`
- Exponential backoff reconnection: `Math.min(1200ms × 1.5^N, 30s) + jitter`, max 15 attempts

### 10.2 Envelope Structure

```typescript
ReceiverSyncEnvelope {
  capture: { id, deviceId, pairingId, coopId, memberId, kind, title, note, ... },
  asset: { captureId, mimeType, byteSize, fileName, dataBase64 },
  auth: { version: 1, algorithm: 'hmac-sha256', pairingId, signedAt, signature }
}
```

### 10.3 Sync States

`local-only` → `queued` → `synced` (or `failed` with retryCount/nextRetryAt)

---

## 11. Observability

### 11.1 Agent Trace Logging

Each agent cycle gets a unique `traceId`. All spans (cycle, observation, skill, action) are correlated:

```typescript
AgentLog {
  id, traceId,
  spanType: 'cycle' | 'observation' | 'skill' | 'action',
  level: 'info' | 'warn' | 'error',
  message, skillId?, observationId?,
  data?: { provider, durationMs, retryCount, ... },
  timestamp
}
```

### 11.2 Cycle Result Metrics

```typescript
AgentCycleResult {
  processedObservationIds, createdPlanIds, createdDraftIds,
  completedSkillRunIds, autoExecutedActionCount, errors,
  traceId, totalDurationMs,
  skillRunMetrics: [{ skillId, provider, durationMs, retryCount, skipped }]
}
```

### 11.3 Sync Transport Health

```typescript
summarizeSyncTransportHealth(webrtc?) → {
  syncError, configuredSignalingCount, signalingConnectionCount,
  peerCount, broadcastPeerCount, note
}
```

---

## 12. Key Files Reference

| Component | Path |
|-----------|------|
| **CRDT sync** | `packages/shared/src/modules/coop/sync.ts` |
| **Publish flow** | `packages/shared/src/modules/coop/publish.ts` |
| **Board/feed** | `packages/shared/src/modules/coop/board.ts` |
| **Coop flows** | `packages/shared/src/modules/coop/flows.ts` |
| **Storage (Dexie)** | `packages/shared/src/modules/storage/db.ts` |
| **Schema contracts** | `packages/shared/src/contracts/schema.ts` |
| **Archive core** | `packages/shared/src/modules/archive/archive.ts` |
| **Storacha client** | `packages/shared/src/modules/archive/storacha.ts` |
| **Archive export** | `packages/shared/src/modules/archive/export.ts` |
| **Receiver sync** | `packages/shared/src/modules/receiver/sync.ts` |
| **Receiver relay** | `packages/shared/src/modules/receiver/relay.ts` |
| **Agent runner** | `packages/extension/src/runtime/agent-runner.ts` |
| **Agent harness** | `packages/extension/src/runtime/agent-harness.ts` |
| **Agent models** | `packages/extension/src/runtime/agent-models.ts` |
| **Agent knowledge** | `packages/extension/src/runtime/agent-knowledge.ts` |
| **WebLLM bridge** | `packages/extension/src/runtime/agent-webllm-bridge.ts` |
| **Agent config** | `packages/extension/src/runtime/agent-config.ts` |
| **Agent logger** | `packages/extension/src/runtime/agent-logger.ts` |
| **Background worker** | `packages/extension/src/background.ts` |
| **Sync bindings** | `packages/extension/src/views/Sidepanel/hooks/useSyncBindings.ts` |
| **Privacy** | `packages/shared/src/modules/privacy/` |
| **Stealth addresses** | `packages/shared/src/modules/stealth/stealth.ts` |
| **Operator console** | `packages/extension/src/views/Sidepanel/OperatorConsole.tsx` |
| **Signaling server** | `packages/signaling/server.mjs` |
