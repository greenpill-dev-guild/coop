# Media Compression & Sharing System

**Branch**: `feature/media-compression-sharing`
**Status**: ACTIVE
**Created**: 2026-03-21
**Last Updated**: 2026-03-21

## Problem Statement

Binary media (audio, photos, screenshots, files) captured by coop members never reaches other members. When artifacts are published, only text metadata enters the shared Yjs state. The original media blob stays on the originating device with no path to peer access, no compression, and no durable archive of the actual content. Audio captures bypass the entire agent refinement pipeline because there is no transcription.

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Three-tier blob resolution: Local → Peer → Gateway | Local-first principle: instant from Dexie, fast from peers, durable from IPFS. Never depend on network for previously-seen content |
| 2 | Artifacts gain `attachments[]` with blob references, not inline blobs | Keeps Yjs membrane lightweight (text-only metadata). Blobs transfer via separate channel |
| 3 | New `coopBlobs` Dexie table for all blob storage | Single encrypted blob store for own captures, peer-fetched media, and cached gateway content |
| 4 | WebRTC data channel alongside y-webrtc for binary transfer | y-webrtc only handles Yjs CRDT sync (text). Binary needs its own channel with chunked transfer and progress |
| 5 | Browser-native image compression (OffscreenCanvas → WebP) | Zero dependencies, 90-95% size reduction. Works in service worker context |
| 6 | Local Whisper transcription via @huggingface/transformers | Already in node_modules. Transcripts make audio searchable, refinable by agent, and lightweight to sync |
| 7 | Store both transcript (eager sync) and audio blob (lazy sync) | Transcript is the "knowledge" (tiny, syncs immediately). Audio is the "evidence" (large, fetched on demand) |
| 8 | Storacha archive includes blobs alongside metadata | Current archives are metadata-only JSON. Blobs need durable storage too, bundled as CAR files |
| 9 | Dexie v15 migration for new tables | Clean schema upgrade following established v14 pattern |
| 10 | New `@coop/shared` module: `modules/blob/` | Blob compression, storage, resolution, and sync logic. Follows existing module boundary pattern |
| 11 | Eager vs lazy sync policy per attachment kind | Transcripts + thumbnails sync eagerly (< 50KB). Audio source + full images sync on-demand when member views |
| 12 | Per-artifact keyed Y.Map (Phase 4) | Fixes last-writer-wins on concurrent publishes. Deferred because it's a breaking Yjs schema change |

## Requirements Coverage

| Requirement | Planned Step | Phase |
|-------------|--------------|-------|
| Images compressed before storage | Steps 1-2 | Phase 1 |
| Screenshots compressed on capture | Step 3 | Phase 1 |
| PWA photos compressed on capture | Step 4 | Phase 1 |
| Blob store with encryption | Steps 5-6 | Phase 1 |
| Attachment schema on artifacts | Step 7 | Phase 2 |
| Publish flow carries attachments | Step 8 | Phase 2 |
| Peer blob request/response protocol | Steps 9-10 | Phase 2 |
| Blob resolution (local → peer → gateway) | Step 11 | Phase 2 |
| Audio transcription via local Whisper | Steps 12-13 | Phase 3 |
| Transcript as eager-sync attachment | Step 14 | Phase 3 |
| Audio in agent refinement pipeline | Step 15 | Phase 3 |
| Archive bundles include blobs | Steps 16-17 | Phase 4 |
| Gateway retrieval as Tier 3 fallback | Step 18 | Phase 4 |
| Yjs per-artifact map migration | Steps 19-20 | Phase 4 |
| Yjs horizon compaction | Step 21 | Phase 4 |

## CLAUDE.md Compliance

- [x] All new modules in `@coop/shared` (`modules/blob/`, `modules/transcribe/`)
- [x] Barrel imports from `@coop/shared`
- [x] Single root `.env.local` only (Whisper model path via VITE_ var if needed)
- [x] Dexie migration follows established versioning pattern
- [x] Error handling: surface failures to user, never swallow
- [x] Local-first: all blobs stored locally, network is optional enhancement

## Impact Analysis

### Files to Create

| File | Purpose |
|------|---------|
| `packages/shared/src/modules/blob/index.ts` | Barrel exports for blob module |
| `packages/shared/src/modules/blob/compress.ts` | Image compression (canvas → WebP), audio bitrate normalization |
| `packages/shared/src/modules/blob/store.ts` | Dexie blob CRUD with encryption, resolution logic |
| `packages/shared/src/modules/blob/sync.ts` | Peer blob request/response protocol over WebRTC data channel |
| `packages/shared/src/modules/blob/resolve.ts` | Three-tier resolver: local → peer → gateway |
| `packages/shared/src/modules/blob/types.ts` | BlobRecord, BlobRequest, BlobResponse, AttachmentRef types |
| `packages/shared/src/modules/transcribe/index.ts` | Barrel exports for transcription module |
| `packages/shared/src/modules/transcribe/whisper.ts` | Local Whisper pipeline via @huggingface/transformers |
| `packages/shared/src/modules/transcribe/types.ts` | TranscriptionResult, TranscriptionStatus types |
| `packages/shared/src/modules/blob/__tests__/compress.test.ts` | Compression unit tests |
| `packages/shared/src/modules/blob/__tests__/store.test.ts` | Blob store unit tests |
| `packages/shared/src/modules/blob/__tests__/resolve.test.ts` | Resolver unit tests |
| `packages/shared/src/modules/blob/__tests__/sync.test.ts` | Sync protocol unit tests |
| `packages/shared/src/modules/transcribe/__tests__/whisper.test.ts` | Transcription unit tests |

### Files to Modify

| File | Changes |
|------|---------|
| `packages/shared/src/contracts/schema.ts` | Add `artifactAttachmentSchema`, `coopBlobRecordSchema`, extend `artifactSchema` with `attachments` |
| `packages/shared/src/modules/storage/db.ts` | v15 migration: add `coopBlobs` table, update encrypted payload kinds |
| `packages/shared/src/modules/coop/sync.ts` | Wire blob sync channel alongside WebrtcProvider |
| `packages/shared/src/modules/coop/publish.ts` | `createSiblingArtifacts` carries attachment refs from draft provenance |
| `packages/shared/src/modules/coop/review.ts` | `createReceiverDraftSeed` includes attachment refs for media captures |
| `packages/shared/src/modules/receiver/capture.ts` | Compress before storage; create blob record alongside capture |
| `packages/shared/src/modules/receiver/limits.ts` | Update limits to reflect post-compression expectations |
| `packages/shared/src/modules/archive/archive.ts` | `createArchiveBundle` includes blob CIDs for attachments |
| `packages/shared/src/modules/archive/storacha.ts` | Upload blob files alongside JSON metadata |
| `packages/shared/src/modules/archive/archive.ts` | `retrieveArchiveBundle` can fetch blob content by CID |
| `packages/shared/src/modules/index.ts` | Export new `blob` and `transcribe` modules |
| `packages/extension/src/background/handlers/capture.ts` | `captureVisibleScreenshot` compresses PNG → WebP before storage |
| `packages/app/src/hooks/useCapture.ts` | Audio recording: add bitrate constraint, trigger transcription on stop |

---

## Test Strategy

### Unit Tests
- **Compression**: Verify WebP output, size reduction ratio, dimension capping, format detection
- **Blob store**: CRUD operations, encryption round-trip, resolution order
- **Sync protocol**: Message serialization, chunked transfer assembly, error handling
- **Transcription**: Mock Whisper pipeline, transcript schema validation
- **Attachment schema**: Zod parsing, default values, backward compat with attachment-less artifacts

### Integration Tests
- **Capture → compress → store → publish → resolve**: Full pipeline from screenshot to peer viewing
- **Receiver sync with compressed blobs**: PWA captures compressed media, syncs to extension
- **Archive with blobs**: Bundle creation includes blob CIDs, retrieval reconstructs

### E2E Tests (Playwright)
- **Two-profile flow**: Member A captures screenshot → publishes → Member B sees artifact → requests blob → views image
- **Offline resilience**: Member B views previously-fetched blob while offline

---

## Phase 1: Compression Foundation + Blob Store

**Goal**: Every image and screenshot is compressed before storage. New blob store holds encrypted media. No sharing yet — this phase optimizes local storage.

**Deliverable**: Compressed captures stored locally, visible reduction in IndexedDB usage.

### Step 1: Blob module types and schemas

**Files**: `packages/shared/src/modules/blob/types.ts`, `packages/shared/src/contracts/schema.ts`

Define core types:

```typescript
// blob/types.ts
export interface CoopBlobRecord {
  blobId: string;              // createId('blob')
  sourceEntityId: string;      // captureId or artifactId that produced this
  coopId: string;
  mimeType: string;            // 'image/webp', 'audio/webm', etc.
  byteSize: number;
  kind: BlobKind;              // 'image' | 'audio-source' | 'audio-transcript' | 'file'
  origin: BlobOrigin;          // 'self' | 'peer' | 'gateway'
  archiveCid?: string;         // set after Storacha upload
  createdAt: string;
  accessedAt: string;          // for LRU eviction
}

export type BlobKind = 'image' | 'audio-source' | 'audio-transcript' | 'file';
export type BlobOrigin = 'self' | 'peer' | 'gateway';

// Attachment reference (lives on artifact in shared state)
export interface ArtifactAttachment {
  blobId: string;
  mimeType: string;
  byteSize: number;
  kind: BlobKind;
  archiveCid?: string;         // populated after archive
  thumbnailDataUrl?: string;   // tiny inline preview (< 2KB data URI)
}
```

Add Zod schemas to `schema.ts`:
- `coopBlobRecordSchema`
- `artifactAttachmentSchema`
- Extend `artifactSchema` with `attachments: z.array(artifactAttachmentSchema).default([])`

**Verification**: `bun run test` — schema parsing tests pass, existing artifact tests still pass with empty default.

### Step 2: Image compression utility

**Files**: `packages/shared/src/modules/blob/compress.ts`, `packages/shared/src/modules/blob/__tests__/compress.test.ts`

```typescript
// compress.ts
export async function compressImage(input: {
  blob: Blob;
  maxWidth?: number;       // default: 1920
  maxHeight?: number;      // default: 1080
  quality?: number;        // default: 0.82
  format?: 'webp' | 'jpeg'; // default: 'webp'
}): Promise<{ blob: Blob; width: number; height: number }>;

export async function generateThumbnailDataUrl(input: {
  blob: Blob;
  maxSize?: number;        // default: 64px
  quality?: number;        // default: 0.5
}): Promise<string>;       // returns data:image/webp;base64,... (< 2KB)
```

Implementation uses `OffscreenCanvas` (available in service worker / background script) with fallback to `HTMLCanvasElement` for main thread:

1. Decode image via `createImageBitmap(blob)`
2. Calculate scaled dimensions preserving aspect ratio
3. Draw to canvas at target size
4. `canvas.convertToBlob({ type: 'image/webp', quality })` or `canvas.toDataURL()` for thumbnail

Tests: Verify with synthetic 100x100 PNG that output is WebP, smaller than input, dimensions correct.

**Verification**: `bun run test packages/shared/src/modules/blob/__tests__/compress.test.ts`

### Step 3: Wire compression into screenshot capture

**Files**: `packages/extension/src/background/handlers/capture.ts`

Modify `captureVisibleScreenshot()`:

```typescript
// Before: stores raw PNG
const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
const rawBlob = await (await fetch(dataUrl)).blob();

// After: compress to WebP
const { blob: compressedBlob } = await compressImage({ blob: rawBlob });
const thumbnail = await generateThumbnailDataUrl({ blob: rawBlob });
// Store compressedBlob instead of rawBlob
```

Update the `ReceiverCapture` creation to use compressed blob's size and `image/webp` mimeType.

**Verification**: Manual test — capture screenshot, verify IndexedDB blob is WebP and < 500KB.

### Step 4: Wire compression into PWA photo capture

**Files**: `packages/app/src/hooks/useCapture.ts`

In the photo capture flow, compress before `createReceiverCapture()`:

```typescript
// After user selects/captures photo
const { blob: compressed } = await compressImage({ blob: rawPhotoBlob });
const capture = createReceiverCapture({ ...input, blob: compressed });
```

**Verification**: Manual test — capture photo from PWA, verify compressed blob stored.

### Step 5: Dexie v15 migration — coopBlobs table

**Files**: `packages/shared/src/modules/storage/db.ts`

Add new Dexie table in v15 migration:

```typescript
// Schema v15
db.version(15).stores({
  coopBlobs: 'blobId, sourceEntityId, coopId, kind, origin, createdAt, accessedAt',
});
```

Add `EncryptedLocalPayloadKind` value: `'coop-blob'`.

**Verification**: `bun run test packages/shared/src/modules/storage/__tests__/db.test.ts` — migration applies cleanly.

### Step 6: Blob store CRUD with encryption

**Files**: `packages/shared/src/modules/blob/store.ts`, `packages/shared/src/modules/blob/__tests__/store.test.ts`

```typescript
export async function saveCoopBlob(db: CoopDexie, record: CoopBlobRecord, bytes: Uint8Array): Promise<void>;
export async function getCoopBlob(db: CoopDexie, blobId: string): Promise<{ record: CoopBlobRecord; bytes: Uint8Array } | null>;
export async function deleteCoopBlob(db: CoopDexie, blobId: string): Promise<void>;
export async function listCoopBlobs(db: CoopDexie, coopId: string): Promise<CoopBlobRecord[]>;
export async function touchCoopBlobAccess(db: CoopDexie, blobId: string): Promise<void>;  // update accessedAt for LRU
export async function pruneCoopBlobs(db: CoopDexie, options: { maxTotalBytes?: number; maxAge?: number }): Promise<number>;
```

Uses `buildEncryptedLocalPayloadRecord` with kind `'coop-blob'` for encryption at rest. Metadata in `coopBlobs` table, encrypted bytes in `encryptedLocalPayloads`.

Pruning: LRU eviction based on `accessedAt` when total blob storage exceeds threshold (default: 200MB). Only evicts `origin: 'peer' | 'gateway'` blobs — never deletes your own captures.

Tests: Round-trip save/get, encryption verification, prune behavior.

**Verification**: `bun run test packages/shared/src/modules/blob/__tests__/store.test.ts`

### Step 7: Barrel exports and module wiring

**Files**: `packages/shared/src/modules/blob/index.ts`, `packages/shared/src/modules/index.ts`

Export all public functions and types from blob module. Add to shared barrel.

**Verification**: `bun build` — clean build with new exports.

---

## Phase 2: Attachment Schema + Peer Blob Transfer

**Goal**: Published artifacts carry attachment references. Other coop members can request and receive binary blobs via WebRTC. Three-tier resolution works.

**Deliverable**: Member A publishes artifact with image → Member B sees it and can view the image.

### Step 8: Publish flow carries attachments

**Files**: `packages/shared/src/modules/coop/review.ts`, `packages/shared/src/modules/coop/publish.ts`

Modify `createReceiverDraftSeed()` to build attachment refs:

```typescript
// When draft is seeded from a photo/audio/file capture:
const attachments: ArtifactAttachment[] = [];
if (capture.kind === 'photo' || capture.kind === 'audio' || capture.kind === 'file') {
  attachments.push({
    blobId: blobRecord.blobId,  // from Phase 1 blob store
    mimeType: capture.mimeType,
    byteSize: capture.byteSize,
    kind: mapCaptureKindToBlobKind(capture.kind),
    thumbnailDataUrl: thumbnail,  // tiny inline preview
  });
}
```

Modify `createSiblingArtifacts()` to carry `attachments` from draft to artifact.

**Verification**: Unit test — publish a draft with attachments, verify artifact in shared state has attachment refs.

### Step 9: Blob sync protocol — message types

**Files**: `packages/shared/src/modules/blob/sync.ts`

Define the peer-to-peer blob transfer protocol:

```typescript
// Request: "I need blob X"
interface BlobRequest {
  type: 'blob-request';
  blobId: string;
  requestId: string;
}

// Response: chunked binary transfer
interface BlobChunk {
  type: 'blob-chunk';
  requestId: string;
  blobId: string;
  chunkIndex: number;
  totalChunks: number;
  data: Uint8Array;            // 64KB chunks
}

// Response: blob not available
interface BlobNotFound {
  type: 'blob-not-found';
  requestId: string;
  blobId: string;
}

// Manifest: "I have these blobs available"
interface BlobManifest {
  type: 'blob-manifest';
  blobIds: string[];           // broadcast on connect
}
```

Chunk size: 64KB (fits comfortably in WebRTC data channel message limits).

Serialization: CBOR or MessagePack for binary-friendly encoding (avoid base64 overhead).

**Verification**: Unit test — serialize/deserialize protocol messages.

### Step 10: WebRTC data channel for blob transfer

**Files**: `packages/shared/src/modules/blob/sync.ts`, `packages/shared/src/modules/coop/sync.ts`

Approach: Alongside the existing `WebrtcProvider` (which handles Yjs CRDT sync), establish a **custom signaling-based data channel** for blob transfer.

Options (ranked by complexity):
1. **Piggyback on y-webrtc awareness** — Use `webrtc.room.webrtcConns` to access existing peer connections and add a labeled data channel (`'coop-blob'`). Requires accessing y-webrtc internals.
2. **Separate simple-peer connections** — Create parallel peer connections using the same signaling server for blob-only transfer.
3. **WebSocket relay fallback** — If direct p2p fails, relay blob chunks through the signaling/API server.

Recommended: Option 1 with Option 3 as fallback.

```typescript
export function createBlobSyncChannel(input: {
  webrtcProvider: WebrtcProvider;
  db: CoopDexie;
  coopId: string;
  onBlobReceived?: (blobId: string) => void;
}): BlobSyncChannel;

interface BlobSyncChannel {
  requestBlob(blobId: string): Promise<Uint8Array | null>;
  getAvailablePeers(): string[];
  broadcastManifest(): void;
  destroy(): void;
}
```

When a peer connects:
1. Access their `RTCPeerConnection` via y-webrtc room internals
2. Create labeled data channel `'coop-blob'`
3. Exchange `BlobManifest` messages
4. Handle `BlobRequest` by reading from local blob store and sending chunks
5. Handle incoming `BlobChunk` by assembling and saving to local blob store

**Verification**: Integration test with two mock peers — request blob, verify chunked transfer and reassembly.

### Step 11: Three-tier blob resolver

**Files**: `packages/shared/src/modules/blob/resolve.ts`, `packages/shared/src/modules/blob/__tests__/resolve.test.ts`

```typescript
export async function resolveBlob(input: {
  db: CoopDexie;
  blobId: string;
  attachment: ArtifactAttachment;
  blobSync?: BlobSyncChannel;
}): Promise<{ bytes: Uint8Array; source: BlobOrigin } | null> {
  // Tier 1: Local Dexie
  const local = await getCoopBlob(input.db, input.blobId);
  if (local) {
    await touchCoopBlobAccess(input.db, input.blobId);
    return { bytes: local.bytes, source: 'self' };
  }

  // Tier 2: Peer fetch via WebRTC
  if (input.blobSync) {
    const peerBytes = await input.blobSync.requestBlob(input.blobId);
    if (peerBytes) {
      // Cache locally for future access
      await saveCoopBlob(input.db, { ...buildRecord(input), origin: 'peer' }, peerBytes);
      return { bytes: peerBytes, source: 'peer' };
    }
  }

  // Tier 3: IPFS gateway (if archived)
  if (input.attachment.archiveCid) {
    const gatewayBytes = await fetchBlobFromGateway(input.attachment.archiveCid);
    if (gatewayBytes) {
      await saveCoopBlob(input.db, { ...buildRecord(input), origin: 'gateway' }, gatewayBytes);
      return { bytes: gatewayBytes, source: 'gateway' };
    }
  }

  return null;
}
```

Tests: Mock each tier, verify fallback order, verify caching on fetch.

**Verification**: `bun run test packages/shared/src/modules/blob/__tests__/resolve.test.ts`

---

## Phase 3: Audio Transcription

**Goal**: Audio captures are transcribed locally via Whisper. Transcripts become the primary "knowledge" representation of audio in the coop. Agent refinement pipeline can process audio through transcripts.

**Deliverable**: Record audio → see transcript → transcript syncs to coop as lightweight attachment → agent can tag/categorize.

### Step 12: Whisper transcription module

**Files**: `packages/shared/src/modules/transcribe/whisper.ts`, `packages/shared/src/modules/transcribe/types.ts`

```typescript
// types.ts
export interface TranscriptionResult {
  text: string;
  language: string;
  duration: number;           // seconds
  segments: TranscriptionSegment[];
  modelId: string;
}

export interface TranscriptionSegment {
  start: number;              // seconds
  end: number;
  text: string;
  confidence: number;
}

// whisper.ts
export async function transcribeAudio(input: {
  audioBlob: Blob;
  modelId?: string;            // default: 'onnx-community/whisper-tiny.en'
  onProgress?: (progress: number) => void;
}): Promise<TranscriptionResult>;

export async function isWhisperSupported(): Promise<boolean>;
// Check: WebGPU available, sufficient memory, model downloadable
```

Implementation strategy:
1. Use `@huggingface/transformers` pipeline API (already available)
2. Default model: `whisper-tiny.en` (~40MB, fast, English) with upgrade path to `whisper-small` for multilingual
3. WebGPU backend preferred, WASM fallback
4. Model cached in browser Cache API after first download
5. Transcription runs in a Web Worker to avoid blocking UI

**Verification**: Unit test with a short synthetic audio blob, verify transcript structure.

### Step 13: Wire transcription into audio capture flow

**Files**: `packages/app/src/hooks/useCapture.ts`, `packages/extension/src/background/handlers/capture.ts`

After audio recording stops in PWA:

```typescript
recorder.onstop = async () => {
  const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });

  // Save audio blob immediately (don't block on transcription)
  const capture = createReceiverCapture({ ...input, blob });
  await saveReceiverCapture(db, capture, blob);

  // Transcribe in background
  if (await isWhisperSupported()) {
    const result = await transcribeAudio({ audioBlob: blob });
    // Save transcript as separate blob
    const transcriptBlob = new Blob([JSON.stringify(result)], { type: 'application/json' });
    await saveCoopBlob(db, {
      blobId: createId('blob'),
      sourceEntityId: capture.id,
      kind: 'audio-transcript',
      ...
    }, new Uint8Array(await transcriptBlob.arrayBuffer()));
    // Update capture with transcript reference
    await linkTranscriptToCapture(db, capture.id, transcriptBlobId);
  }
};
```

Transcription is non-blocking — the capture saves immediately, transcript arrives later and gets linked.

**Verification**: Manual test — record audio, verify transcript blob appears alongside audio blob.

### Step 14: Transcript as eager-sync attachment

**Files**: `packages/shared/src/modules/coop/review.ts`, `packages/shared/src/modules/coop/publish.ts`

When seeding a draft from an audio capture with a transcript:

```typescript
// Draft gets two attachments:
attachments: [
  {
    blobId: transcriptBlobId,
    kind: 'audio-transcript',
    mimeType: 'application/json',
    byteSize: transcriptBytes,
    // No archiveCid yet
  },
  {
    blobId: audioBlobId,
    kind: 'audio-source',
    mimeType: 'audio/webm',
    byteSize: audioBytes,
  },
]
```

Sync policy in `BlobSyncChannel`:
- `audio-transcript` and `image` (thumbnails): **eager** — automatically pushed to all connected peers on publish
- `audio-source` and `file`: **lazy** — only transferred on explicit peer request (user clicks play/download)

Draft summary is populated from transcript text instead of placeholder:

```typescript
// Before: "Summary placeholder: describe what this audio recording covers..."
// After: First 2-3 sentences of transcript
summary: truncateToSentences(transcriptionResult.text, 3),
```

**Verification**: Unit test — publish audio artifact, verify transcript attachment is eager-flagged, summary comes from transcript.

### Step 15: Audio in agent refinement pipeline

**Files**: `packages/shared/src/modules/coop/pipeline.ts`, `packages/shared/src/modules/agent/` (skill integration)

Enable the agent to process audio captures by giving it transcript text:

```typescript
// When building interpretation for a receiver capture:
if (capture.kind === 'audio' && transcript) {
  // Feed transcript text through existing interpretExtractForCoop()
  // Reuse the same keyword matching, relevance scoring, category inference
  const pseudoExtract = {
    cleanedTitle: capture.title,
    salientTextBlocks: [transcript.text],
    topHeadings: transcript.segments.slice(0, 3).map(s => s.text),
    // ...
  };
  const interpretation = interpretExtractForCoop({ extract: pseudoExtract, ... });
}
```

This means audio captures now get:
- Proper category inference (not hardcoded 'thought' at 0.34)
- Keyword-based relevance scoring against coop soul
- Domain continuity scoring
- Tag extraction from transcript content

**Verification**: Unit test — mock transcript, verify interpretation produces real categories and relevance scores.

---

## Phase 4: Durable Archive + Yjs Evolution

**Goal**: Archive bundles include actual media blobs (not just metadata). Gateway retrieval works as Tier 3 fallback. Yjs membrane evolves to per-artifact granularity with growth management.

**Deliverable**: Full data durability on Filecoin. Yjs scales to hundreds of artifacts without membrane bloat.

### Step 16: Archive bundles include blob content

**Files**: `packages/shared/src/modules/archive/archive.ts`

Extend `createArchiveBundle()` to collect blob references:

```typescript
export function createArchiveBundle(input: {
  scope: ArchiveBundle['scope'];
  state: CoopSharedState;
  artifactIds?: string[];
  blobs?: Map<string, Uint8Array>;   // blobId → bytes (fetched from local store before call)
}) {
  const payload = { ...existingPayload };

  // Add blob manifest to payload
  if (input.blobs && input.blobs.size > 0) {
    payload.blobManifest = Array.from(input.blobs.entries()).map(([blobId, bytes]) => ({
      blobId,
      byteSize: bytes.length,
      // Actual bytes uploaded as separate files in CAR
    }));
  }

  return { ...bundle, payload, blobBytes: input.blobs };
}
```

**Verification**: Unit test — bundle with blobs produces manifest.

### Step 17: Storacha upload with blob files

**Files**: `packages/shared/src/modules/archive/storacha.ts`

Extend upload to handle binary blob files alongside JSON metadata:

```typescript
export async function uploadArchiveBundleToStoracha(input: {
  bundle: ArchiveBundle;
  delegation: ArchiveDelegationMaterial;
  blobBytes?: Map<string, Uint8Array>;
}) {
  // 1. Upload each blob as separate file, collect CIDs
  const blobCids = new Map<string, string>();
  if (input.blobBytes) {
    for (const [blobId, bytes] of input.blobBytes) {
      const blobFile = new Blob([bytes]);
      const blobCid = await client.uploadFile(blobFile);
      blobCids.set(blobId, blobCid.toString());
    }
  }

  // 2. Embed blob CIDs in metadata payload
  const enrichedPayload = {
    ...input.bundle.payload,
    blobCids: Object.fromEntries(blobCids),
  };

  // 3. Upload metadata JSON (with blob CID references)
  const metaBlob = new Blob([JSON.stringify(enrichedPayload, null, 2)], {
    type: 'application/json',
  });
  const root = await client.uploadFile(metaBlob, { ... });

  return { ...result, blobCids: Object.fromEntries(blobCids) };
}
```

After upload, update artifact attachments with `archiveCid` from the blob CID map.

**Verification**: Integration test with mock Storacha client — verify blob CIDs returned and wired to attachments.

### Step 18: Gateway retrieval for blob content

**Files**: `packages/shared/src/modules/blob/resolve.ts`, `packages/shared/src/modules/archive/archive.ts`

Implement `fetchBlobFromGateway()` used in Tier 3 of the resolver:

```typescript
export async function fetchBlobFromGateway(cid: string, options?: {
  gatewayBaseUrl?: string;      // default: 'https://storacha.link'
  timeout?: number;             // default: 30_000
}): Promise<Uint8Array | null> {
  const url = `${gatewayBaseUrl}/ipfs/${cid}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  if (!response.ok) return null;
  return new Uint8Array(await response.arrayBuffer());
}
```

Reuse existing CID verification pattern from `retrieveArchiveBundle()`.

**Verification**: Unit test with mock fetch — verify bytes returned and CID-checked.

### Step 19: Yjs per-artifact keyed map — schema migration

**Files**: `packages/shared/src/modules/coop/sync.ts`

Replace the artifacts JSON blob with a nested `Y.Map`:

```typescript
// Before (current):
coopMap.set('artifacts', JSON.stringify(state.artifacts));

// After:
const artifactsMap = doc.getMap('coop-artifacts');  // separate Y.Map
for (const artifact of state.artifacts) {
  artifactsMap.set(artifact.id, JSON.stringify(artifact));
}
```

**Migration strategy** (backward-compatible):
1. On read: check for new `coop-artifacts` map first, fall back to old `artifacts` string
2. On write: write to BOTH old and new formats during transition period
3. After all members upgrade: stop writing old format

This is the highest-risk step. Requires careful Yjs state migration:
- New peers joining get the new format via bootstrap snapshot
- Existing peers receive the new map via Yjs sync
- Old `artifacts` key kept read-only for backward compat until confirmed all peers upgraded

**Verification**: Unit test — read/write both formats, verify migration from old → new.

### Step 20: Yjs per-artifact observe and merge

**Files**: `packages/shared/src/modules/coop/sync.ts`

With per-artifact keys, Yjs now merges at artifact granularity:
- Two members publishing different artifacts: both appear (no last-writer-wins conflict)
- Two members editing same artifact: last-writer-wins per artifact (acceptable)
- Deletes: `artifactsMap.delete(artifactId)` propagates correctly

Wire `artifactsMap.observe()` for UI reactivity.

**Verification**: Integration test — simulate concurrent publishes from two docs, verify both artifacts present.

### Step 21: Yjs horizon compaction

**Files**: `packages/shared/src/modules/coop/sync.ts`, `packages/shared/src/modules/archive/archive.ts`

Implement artifact horizon: artifacts beyond the most recent N (default: 200) or older than M days (default: 90) are archived out of the live Yjs doc:

```typescript
export async function compactCoopArtifacts(input: {
  doc: Y.Doc;
  state: CoopSharedState;
  maxLiveArtifacts?: number;   // default: 200
  maxAgeDays?: number;         // default: 90
}): Promise<{ archivedIds: string[]; archiveBundle: ArchiveBundle }>;
```

Flow:
1. Identify artifacts beyond horizon
2. Create archive bundle with those artifacts + their blobs
3. Upload to Storacha
4. Store archive receipt with CID range
5. Remove from live Yjs doc
6. Keep a `compactionPointer` in shared state (latest archived batch CID)

Members can still access compacted artifacts via the archive receipt CIDs (Tier 3 resolution).

**Verification**: Unit test — 250 artifacts, verify 50 oldest compacted, receipt created, live doc has 200.

---

## Validation Checklist

### Per-Phase Gates

| Phase | Gate | Command |
|-------|------|---------|
| Phase 1 | Types compile, compression tests pass, blob store tests pass | `bun run test && bun build` |
| Phase 2 | Publish carries attachments, resolver tests pass, sync protocol tests pass | `bun run test && bun build` |
| Phase 3 | Transcription tests pass, transcript shows in draft summary | `bun run test && bun build` |
| Phase 4 | Archive includes blobs, gateway fetch works, Yjs migration tests pass | `bun run validate full` |

### Cross-Cutting Verification

- [ ] Existing tests still pass (no regressions)
- [ ] Artifacts without attachments work unchanged (backward compat)
- [ ] Screenshot capture produces WebP < 500KB (was 2-5MB PNG)
- [ ] Audio capture produces transcript within 30s of recording stop
- [ ] Two-profile E2E: publish with image → peer receives → image displays
- [ ] Offline: previously-fetched blobs render without network
- [ ] IndexedDB total stays under 200MB with pruning active
- [ ] Yjs doc size stable with 200-artifact horizon

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| y-webrtc internals change, breaking data channel piggyback | Phase 2 blocked | Fallback: parallel simple-peer connections via same signaling |
| Whisper model too large for mobile browsers | Phase 3 degraded on low-end devices | Graceful fallback: skip transcription, use metadata-only draft (current behavior) |
| WebP not supported in very old browsers | Phase 1 minor | Fallback to JPEG compression (still 80%+ reduction) |
| Yjs migration corrupts existing coop state | Phase 4 critical | Dual-write period, read from both, automated rollback if new format empty |
| Storacha gateway rate-limited or slow | Phase 4 degraded | Tier 3 is last resort; Tier 1+2 handle 95% of access. Add retry + exponential backoff |
| IndexedDB quota exceeded on heavy media usage | Phase 1-2 | LRU pruning of peer/gateway blobs, user-facing storage indicator |
