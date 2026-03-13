# Vitest Patterns for Coop

> Back to [SKILL.md](./SKILL.md)

## Table of Contents

- [Testing Hooks](#testing-hooks)
- [Testing Components](#testing-components)
- [Mock Factories](#using-mock-factories)
- [Hook Cleanup Testing](#testing-hook-cleanup-rules-1-3)
- [Mutation Error Path Testing](#testing-mutation-error-paths)
- [Offline Scenario Testing](#testing-offline-scenarios)
- [Yjs/CRDT Testing](#testing-yjs-crdt-sync)
- [Critical Paths for Shared Package](#critical-paths-for-shared-package)

---

## Testing Hooks

```typescript
import { renderHook, waitFor } from "@testing-library/react";

const wrapper = ({ children }) => (
  <TestProviders>
    {children}
  </TestProviders>
);

test("useCoop fetches coop data", async () => {
  const { result } = renderHook(() => useCoop(coopId), { wrapper });

  await waitFor(() => {
    expect(result.current.isSuccess).toBe(true);
  });

  expect(result.current.data.safeAddress).toBeDefined();
});
```

## Testing Components

```typescript
import { render, screen, fireEvent } from "@testing-library/react";

test("CoopCard displays coop name", () => {
  render(<CoopCard coop={mockCoop} />);
  expect(screen.getByText("My Coop")).toBeInTheDocument();
});

test("CoopCard calls onSelect when clicked", async () => {
  const onSelect = vi.fn();
  render(<CoopCard coop={mockCoop} onSelect={onSelect} />);

  await fireEvent.click(screen.getByRole("button"));

  expect(onSelect).toHaveBeenCalledWith(mockCoop.id);
});
```

## Using Mock Factories

```typescript
// packages/shared/src/__tests__/test-utils/mock-factories.ts
import { createMockCoop, createMockTab } from "./mock-factories";

test("tab collection flow", () => {
  const coop = createMockCoop({ name: "Test Coop" });
  const tab = createMockTab({ coopId: coop.id });

  expect(tab.coopId).toBe(coop.id);
});
```

## Testing Hook Cleanup (Rules 1-3)

Hooks that use timers, event listeners, or async effects must clean up on unmount. Verify cleanup to prevent memory leaks.

### Rule 1: Timer cleanup -- verify setTimeout/setInterval is cleared

```typescript
test("useDelayedSync clears timer on unmount", () => {
  vi.useFakeTimers();
  const callback = vi.fn();
  const { result, unmount } = renderHook(() => useDelayedSync(callback, 3000));

  result.current(); // Schedule
  unmount();        // Unmount before timer fires
  vi.advanceTimersByTime(5000);

  expect(callback).not.toHaveBeenCalled();
  vi.useRealTimers();
});
```

### Rule 2: Event listener cleanup -- verify removeEventListener on unmount

```typescript
test("useEventListener removes listener on unmount", () => {
  const handler = vi.fn();
  const addSpy = vi.spyOn(window, "addEventListener");
  const removeSpy = vi.spyOn(window, "removeEventListener");

  const { unmount } = renderHook(() => useWindowEvent("resize", handler));

  expect(addSpy).toHaveBeenCalledWith("resize", expect.any(Function));
  unmount();
  expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
});
```

### Rule 3: Async cleanup -- verify isMounted guard prevents stale updates

```typescript
test("useAsyncEffect skips state update after unmount", async () => {
  const setState = vi.fn();
  const { unmount } = renderHook(() =>
    useAsyncEffect(async ({ isMounted }) => {
      await new Promise((r) => setTimeout(r, 100));
      if (isMounted()) setState("data");
    }, [])
  );

  unmount(); // Unmount before async completes
  await vi.advanceTimersByTimeAsync(200);
  expect(setState).not.toHaveBeenCalled();
});
```

## Testing Mutation Error Paths

Every mutation hook must test error handling. Verify that errors are logged, tracked, and surfaced to the user.

### Hook-level error testing

```typescript
test("mutation calls error handler on failure", async () => {
  const mockError = new Error("Safe transaction failed");
  vi.mocked(executeSafeTransaction).mockRejectedValueOnce(mockError);

  const { result } = renderHook(() => useMutationHook(), { wrapper });

  result.current.mutate(payload);

  await waitFor(() => {
    expect(result.current.isError).toBe(true);
  });
  expect(mockLogger.error).toHaveBeenCalledWith(
    expect.stringContaining("failed"),
    expect.objectContaining({ error: mockError })
  );
});
```

### Component-level error testing

```typescript
test("shows error toast on publish failure", async () => {
  vi.mocked(usePublish).mockReturnValue({
    mutateAsync: vi.fn().mockRejectedValue(new Error("archive failed")),
    isPending: false,
  });

  render(<PublishButton />, { wrapper });
  await userEvent.click(screen.getByRole("button"));

  expect(screen.getByText(/publish failed/i)).toBeInTheDocument();
});
```

## Testing Yjs CRDT Sync

Test Yjs document merge behavior with separate Y.Doc instances:

```typescript
import * as Y from "yjs";

test("concurrent edits merge correctly", () => {
  const doc1 = new Y.Doc();
  const doc2 = new Y.Doc();

  // Simulate two peers editing
  const text1 = doc1.getText("content");
  const text2 = doc2.getText("content");

  text1.insert(0, "Hello ");
  text2.insert(0, "World");

  // Sync doc1 -> doc2
  const update1 = Y.encodeStateAsUpdate(doc1);
  Y.applyUpdate(doc2, update1);

  // Sync doc2 -> doc1
  const update2 = Y.encodeStateAsUpdate(doc2);
  Y.applyUpdate(doc1, update2);

  // Both docs should have merged content
  expect(text1.toString()).toBe(text2.toString());
  expect(text1.toString()).toContain("Hello");
  expect(text1.toString()).toContain("World");
});
```

## Testing Offline Scenarios

Coop uses Dexie + Yjs for local-first operation. Test offline paths with mock network state and fake-indexeddb.

```typescript
import "fake-indexeddb/auto";

test("stores tabs locally when offline", async () => {
  // Simulate offline
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

  const { result } = renderHook(() => useTabCollection(), { wrapper });

  await act(async () => {
    await result.current.addTab({
      url: "https://example.com",
      title: "Test Tab",
    });
  });

  const tabs = result.current.getTabs();
  expect(tabs).toHaveLength(1);
  expect(tabs[0].title).toBe("Test Tab");
});

test("syncs local tabs when back online", async () => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  // ... trigger sync, verify data propagates
});
```

## Critical Paths for Shared Package

These paths require **80%+ coverage** with 100% for auth and crypto:

| Path | Files | Why Critical |
|------|-------|-------------|
| **Authentication** | `modules/auth/` | Passkey identity, session management |
| **Coop Operations** | `modules/coop/` | Core coop creation/join/publish |
| **Storage** | `modules/storage/` | Dexie persistence, Yjs sync |
| **Archive** | `modules/archive/` | Storacha upload and lifecycle |
| **Onchain** | `modules/onchain/` | Safe creation, ERC-4337 operations |
| **Receiver** | `modules/receiver/` | PWA pair/sync |
| **Flows** | `flows/` | XState flow board state machines |
