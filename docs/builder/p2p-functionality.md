---
title: P2P Functionality
slug: /builder/p2p-functionality
---

# P2P Functionality

Coop's sync story is local-first replication with peer-to-peer transport, not "ship every state
change through a central app server."

## The Stack

The current sync layer combines:

- Yjs for CRDT state
- y-indexeddb for local persistence
- y-webrtc for direct browser-to-browser transport
- a lightweight signaling relay so peers can discover each other
- WebSocket Yjs document sync (`wss://api.coop.town/yws`) as a server-side fallback when peer-to-peer connections are unavailable
- blob relay for binary asset transport (photos, audio, files) via WebRTC data channels, running alongside but separate from CRDT sync
- an outbox pattern for offline-first publish reliability with automatic retry

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#5a7d10', 'primaryTextColor': '#4f2e1f', 'primaryBorderColor': '#6b4a36', 'lineColor': '#6b4a36', 'secondaryColor': '#fcf5ef', 'tertiaryColor': '#fff8f2'}}}%%
sequenceDiagram
    participant Member as Member Browser
    participant Dexie as Dexie (Local)
    participant Yjs as Yjs Doc
    participant Signal as Signaling Relay
    participant Peer as Peer Browser
    participant Archive as Filecoin

    Member->>Dexie: Capture → local draft
    Member->>Dexie: Review → approved
    Member->>Yjs: Publish → shared state
    Yjs->>Signal: Announce via signaling
    Signal->>Peer: Peer discovery
    Yjs->>Peer: WebRTC sync
    Member->>Archive: Archive with receipt
```

## What Syncs And What Does Not

Shared coop state syncs across peers. Local draft and intake state does not become shared just
because it exists in the browser.

This distinction is essential to Coop's product model:

- shared artifacts, membership state, and archive receipts can replicate
- local review material can stay device-local until publish

## Room Model

Sync rooms are derived from coop identity and room secrets. The signaling server helps establish the
connection, but it is not the long-term owner of the shared data.

## Current Constraints

The long-form scaling review highlights the biggest current risk: not Yjs itself, but how some
shared arrays are written into the document. JSON-serializing full arrays into a Yjs map weakens the
merge story and creates avoidable concurrency risk.

That is why the roadmap prioritizes CRDT correctness work ahead of more ambitious agent features.

## Blob Relay

Binary captures (photos, audio recordings, files) are too large for CRDT state. The blob relay
(`packages/shared/src/modules/blob/relay.ts`) transports them separately over WebRTC data channels
using a chunked protocol. A peer advertises available blobs via a `BlobRelayManifest`, and other peers
request specific blobs by ID. The relay responds with sequenced `BlobRelayChunk` messages, each
carrying a slice of the binary data along with chunk index and total count so the receiver can
reassemble. All relay messages cross a trust boundary and are validated with Zod schemas on arrival.

## Outbox

The outbox (`packages/shared/src/modules/coop/outbox.ts`) queues publish operations when the device
is offline or sync fails. Each entry records the coop, entity key, type, and retry count. When
connectivity returns, pending entries are flushed in order. Entries transition through `pending`,
`synced`, and `failed` states, with failed entries incrementing a retry counter and capturing the last
error. Stale entries older than seven days are pruned automatically.

## Why Builders Should Care

P2P behavior touches:

- join and bootstrap flows
- feed consistency
- receiver-to-extension handoff expectations
- archive provenance and board views

If sync semantics get sloppy, the whole "local-first but shared" promise gets harder to trust.
