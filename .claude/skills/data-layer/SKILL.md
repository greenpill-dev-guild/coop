---
name: data-layer
user-invocable: false
description: Local-first data layer - Dexie (IndexedDB), Yjs (CRDT sync), y-webrtc (peer transport), storage quotas, draft persistence. Use for local persistence, peer sync, offline features, and storage design.
version: "1.0.0"
status: active
packages: ["shared", "extension"]
dependencies: []
last_updated: "2026-03-12"
last_verified: "2026-03-12"
---

# Data Layer Skill

Unified local-first data layer guide: Dexie for structured storage, Yjs for CRDT sync, y-webrtc for peer transport, storage quotas, and media management.

---

## Activation

When invoked:
- Coop is **local-first**: all data stays local until explicit publish/sync.
- Use Dexie for structured data (coops, tabs, drafts, preferences).
- Use Yjs for real-time collaborative editing (shared documents, flow boards).
- Use y-webrtc for peer-to-peer transport.

---

## Part 1: Dexie (Structured Storage)

### Core Concept

Coop uses Dexie as the IndexedDB abstraction layer. All structured data lives in Dexie tables, queried reactively via `useLiveQuery`.

```typescript
import Dexie from "dexie";

class CoopDatabase extends Dexie {
  coops!: Dexie.Table<Coop, string>;
  tabs!: Dexie.Table<Tab, string>;
  drafts!: Dexie.Table<Draft, string>;
  preferences!: Dexie.Table<Preference, string>;

  constructor() {
    super("coopDB");
    this.version(1).stores({
      coops: "id, safeAddress, createdAt",
      tabs: "id, coopId, url, createdAt",
      drafts: "id, coopId, updatedAt",
      preferences: "key",
    });
  }
}

export const db = new CoopDatabase();
```

### Reactive Queries

```typescript
import { useLiveQuery } from "dexie-react-hooks";

function CoopList() {
  const coops = useLiveQuery(() => db.coops.toArray());

  if (!coops) return <Skeleton />;
  return coops.map((c) => <CoopCard key={c.id} coop={c} />);
}

// Filtered query
function TabList({ coopId }: { coopId: string }) {
  const tabs = useLiveQuery(
    () => db.tabs.where("coopId").equals(coopId).toArray(),
    [coopId]
  );

  return tabs?.map((t) => <TabCard key={t.id} tab={t} />);
}
```

### Write Operations

```typescript
// Add a tab
await db.tabs.add({
  id: crypto.randomUUID(),
  coopId,
  url: tab.url,
  title: tab.title,
  createdAt: Date.now(),
});

// Update a draft
await db.drafts.put({
  id: draftId,
  coopId,
  content: editorContent,
  updatedAt: Date.now(),
});

// Delete
await db.tabs.delete(tabId);

// Bulk operations
await db.tabs.bulkAdd(tabsArray);
```

### Schema Versioning

```typescript
class CoopDatabase extends Dexie {
  constructor() {
    super("coopDB");

    // V1: Initial schema
    this.version(1).stores({
      coops: "id, safeAddress, createdAt",
      tabs: "id, coopId, url, createdAt",
    });

    // V2: Add drafts and preferences
    this.version(2).stores({
      coops: "id, safeAddress, createdAt",
      tabs: "id, coopId, url, createdAt",
      drafts: "id, coopId, updatedAt",
      preferences: "key",
    });

    // V3: Add index for tab status
    this.version(3).stores({
      coops: "id, safeAddress, createdAt",
      tabs: "id, coopId, url, status, createdAt",
      drafts: "id, coopId, updatedAt",
      preferences: "key",
    });
  }
}
```

---

## Part 2: Yjs (CRDT Sync)

### Core Concept

Yjs provides conflict-free replicated data types (CRDTs) for real-time collaboration between peers. Each coop's shared state is a Yjs document.

```typescript
import * as Y from "yjs";

// Create a Yjs document for a coop
const ydoc = new Y.Doc();

// Shared data structures
const yTabs = ydoc.getArray<Tab>("tabs");
const yMeta = ydoc.getMap("metadata");
const yContent = ydoc.getText("content");
```

### Observing Changes

```typescript
// React to changes in shared state
yTabs.observeDeep((events) => {
  for (const event of events) {
    console.log("Tabs changed:", event.changes);
  }
});

// Map observation
yMeta.observe((event) => {
  for (const [key, change] of event.changes.keys) {
    console.log(`${key}: ${change.action}`);
  }
});
```

### Modifying Shared State

```typescript
// Transactional updates (batched, efficient)
ydoc.transact(() => {
  yTabs.push([newTab]);
  yMeta.set("lastUpdated", Date.now());
});

// Text editing
yContent.insert(0, "Hello ");
yContent.delete(6, 5); // Delete 5 chars at position 6
```

### React Integration

```typescript
import { useYjs } from "@coop/shared";

function SharedEditor({ coopId }: { coopId: string }) {
  const { ydoc, yText, connected, peers } = useYjs(coopId);

  // yText is a Y.Text bound to the editor
  return (
    <div>
      <p>{connected ? `${peers} peers connected` : "Offline"}</p>
      <Editor yText={yText} />
    </div>
  );
}
```

---

## Part 3: y-webrtc (Peer Transport)

### Connection Setup

```typescript
import { WebrtcProvider } from "y-webrtc";

// Connect peers via WebRTC signaling
const provider = new WebrtcProvider(
  `coop-${coopId}`, // Room name
  ydoc,
  {
    signaling: [signalingServerUrl],
    password: coopSecret, // Optional encryption
  }
);

// Monitor connection state
provider.on("status", ({ connected }: { connected: boolean }) => {
  console.log("WebRTC connected:", connected);
});

// Clean up
provider.destroy();
```

### API Server

```bash
# Start the API server locally (includes WebRTC signaling)
bun dev:api
```

The API server facilitates WebRTC peer discovery via signaling. Once peers discover each other, data flows directly peer-to-peer.

### Persistence Bridge (Dexie <-> Yjs)

Yjs state needs to be persisted to Dexie for offline access:

```typescript
import * as Y from "yjs";

// Save Yjs state to Dexie
async function persistYjsState(coopId: string, ydoc: Y.Doc) {
  const state = Y.encodeStateAsUpdate(ydoc);
  await db.yjsStates.put({
    coopId,
    state: state,
    updatedAt: Date.now(),
  });
}

// Restore Yjs state from Dexie
async function restoreYjsState(coopId: string, ydoc: Y.Doc) {
  const saved = await db.yjsStates.get(coopId);
  if (saved) {
    Y.applyUpdate(ydoc, saved.state);
  }
}
```

---

## Part 4: Storage Quota Management

### Quota Detection

```typescript
async function getStorageQuota() {
  if (!navigator.storage?.estimate) return null;
  const { usage, quota } = await navigator.storage.estimate();
  const used = (usage ?? 0) / (1024 * 1024); // MB
  const total = (quota ?? 0) / (1024 * 1024); // MB
  const percentUsed = total > 0 ? (used / total) * 100 : 0;

  return {
    used,
    quota: total,
    percentUsed,
    isLow: percentUsed > 75,
    isCritical: percentUsed > 90,
  };
}
```

### Tiered Cleanup Strategy

```typescript
async function tieredCleanup(): Promise<CleanupResult> {
  const quota = await getStorageQuota();
  if (!quota) return { freedMB: 0, actions: [] };

  const result: CleanupResult = { freedMB: 0, actions: [] };

  // Tier 1: Clean old drafts (> 30 days)
  if (quota.percentUsed > 75) {
    await db.drafts.where("updatedAt").below(Date.now() - 30 * 86400000).delete();
    result.actions.push("Cleaned old drafts");
  }

  // Tier 2: Clean archived tabs (> 60 days)
  if (quota.percentUsed > 85) {
    await db.tabs.where("status").equals("archived").delete();
    result.actions.push("Cleaned archived tabs");
  }

  // Tier 3: User action required
  if (quota.percentUsed > 90) {
    result.actions.push("User intervention required");
  }

  return result;
}
```

---

## Reference Files

For detailed patterns beyond core Dexie/Yjs usage:

- **[storage-lifecycle.md](./storage-lifecycle.md)** -- Schema versioning details, storage quota thresholds, draft persistence patterns, data lifecycle (TTL patterns), and testing patterns.

- **[service-worker.md](./service-worker.md)** -- Service worker registration, cache strategies, background sync, SW update flow, and connectivity detection.

---

## Anti-Patterns

### Dexie/Storage

- **Never use localStorage for structured data** -- use Dexie (localStorage is sync, 5MB limit, no indexes)
- **Never store large media in localStorage** -- use Dexie/IndexedDB
- **Never assume storage is available** -- always handle `QuotaExceededError`
- **Never skip schema versioning** -- always increment version for schema changes

### Yjs/Sync

- **Never modify Yjs state outside transactions** -- use `ydoc.transact()`
- **Never forget to destroy WebrtcProvider** -- clean up on unmount
- **Never persist Yjs state without debouncing** -- batch writes to Dexie
- **Never assume peers are connected** -- always handle offline state

---

## Quick Reference Checklists

### Before Adding Local-First Features

- [ ] Data stored in Dexie tables (not localStorage)
- [ ] Dexie schema versioned correctly
- [ ] Reactive queries via `useLiveQuery`
- [ ] Yjs document created for collaborative data
- [ ] y-webrtc provider with proper cleanup
- [ ] Yjs state persisted to Dexie for offline
- [ ] Storage quota checked for critical threshold

### Before Modifying Dexie Schema

- [ ] Version number incremented
- [ ] Migration handles upgrade from all previous versions
- [ ] Tests cover fresh install AND each upgrade path
- [ ] Existing data preserved through migration
- [ ] Indexes match query patterns

---

## Decision Tree

```text
What data layer work?
|
+-- Structured data (coops, tabs)? --> Dexie tables + useLiveQuery
|
+-- Collaborative editing? ----------> Yjs + y-webrtc
|                                       -> Y.Text for text, Y.Array for lists
|                                       -> Persist to Dexie for offline
|
+-- Schema change needed? -----------> Increment Dexie version
|                                       -> Add migration in constructor
|
+-- Storage running low? ------------> Tiered cleanup strategy
|                                       -> Clean old drafts first
|
+-- Peer sync issue? ----------------> Check WebrtcProvider status
|                                       -> Verify API server
|
+-- Form needs auto-save? -----------> Dexie draft persistence
|
+-- Testing storage? ----------------> Use fake-indexeddb
                                        -> Test migration paths
```

## Related Skills

- `web3` -- Safe operations that produce onchain state
- `error-handling-patterns` -- Categorizing sync failures
- `react` -- State management for offline indicators
- `testing` -- Mock patterns for Dexie/Yjs in Vitest
- `performance` -- Storage performance and memory management
