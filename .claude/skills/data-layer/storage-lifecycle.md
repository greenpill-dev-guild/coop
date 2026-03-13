# Storage Lifecycle & Management

Schema versioning, storage quota management, draft persistence, data lifecycle, and testing patterns for Dexie/IndexedDB.

---

## Schema Versioning

### Dexie Version Upgrade Pattern

Dexie uses integer versioning. Each schema change increments the version:

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

    // V3: Data migration example
    this.version(3)
      .stores({
        coops: "id, safeAddress, createdAt",
        tabs: "id, coopId, url, status, createdAt",
        drafts: "id, coopId, updatedAt",
        preferences: "key",
      })
      .upgrade((tx) => {
        // Migrate existing tabs to have status field
        return tx.table("tabs").toCollection().modify((tab) => {
          tab.status = tab.status ?? "active";
        });
      });
  }
}
```

### Migration Rules

| Rule | Details |
|------|---------|
| **Always increment version** | Never reuse a version number |
| **Migrations are additive** | Never delete tables in upgrades (handle in cleanup) |
| **Use upgrade callbacks** | Dexie's `.upgrade()` runs data transforms |
| **Test each migration path** | Test V1->V3, V2->V3, and fresh V3 installs |
| **Keep migration history** | Document each version's changes |

---

## Storage Quota Management

### Quota Detection

```typescript
async function getStorageQuota() {
  if (!navigator.storage?.estimate) return null;
  const { usage, quota } = await navigator.storage.estimate();
  const used = (usage ?? 0) / (1024 * 1024);
  const total = (quota ?? 0) / (1024 * 1024);
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

### Storage Budget per Table

| Table | Budget | Rationale |
|-------|--------|-----------|
| `coops` | < 5MB | Metadata records, compact |
| `tabs` | < 20MB | URL + title + metadata |
| `drafts` | < 10MB | Auto-saved content |
| `yjsStates` | < 20MB | Binary Yjs state updates |
| `preferences` | < 1MB | Key-value settings |
| **Total target** | < 56MB | Leave headroom for browser overhead |

---

## Draft Persistence

### Auto-Save Drafts

```typescript
function useDraftAutoSave(coopId: string, content: string) {
  useEffect(() => {
    const timer = setTimeout(async () => {
      await db.drafts.put({
        id: `draft-${coopId}`,
        coopId,
        content,
        updatedAt: Date.now(),
      });
    }, 2000); // Debounce 2s

    return () => clearTimeout(timer);
  }, [coopId, content]);
}

function useDraftResume(coopId: string) {
  return useLiveQuery(
    () => db.drafts.get(`draft-${coopId}`),
    [coopId]
  );
}
```

---

## Data Lifecycle

### TTL (Time-To-Live) Patterns

```typescript
const TTL = {
  draft: 7 * 24 * 60 * 60 * 1000,     // 7 days
  archivedTab: 60 * 24 * 60 * 60 * 1000, // 60 days
  yjsState: null,                         // Until published
  preference: null,                       // Never expires
};
```

---

## Testing

### Mock Pattern

```typescript
import "fake-indexeddb/auto";

describe("CoopDatabase", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("stores and retrieves coops", async () => {
    await db.coops.add(mockCoop);
    const coops = await db.coops.toArray();
    expect(coops).toHaveLength(1);
  });

  it("migrates from V1 to V2", async () => {
    // Create V1 database, add data, close
    // Open with V2 schema, verify migration
  });
});
```

### What to Test

| Scenario | Test |
|----------|------|
| Fresh install | All tables created, indexes present |
| Version upgrade | Each migration path works |
| Quota exceeded | Graceful degradation, cleanup triggered |
| Draft persistence | Content survives page reload |
| Yjs state persistence | State restored after offline |
