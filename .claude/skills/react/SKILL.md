---
name: react
description: React patterns - component architecture, state management (Zustand, XState), hook composition, and render performance. Use when building React components, managing state with Zustand, composing hooks, or diagnosing re-render performance issues.
version: "1.0.0"
status: active
packages: ["shared", "app", "extension"]
dependencies: []
last_updated: "2026-03-12"
last_verified: "2026-03-12"
---

# React Skill

Complete React guide: state management, component composition, and performance optimization.

---

## Activation

When invoked:
- Identify state category (local/global/server/form/flow) before choosing a tool.
- Keep hooks in `@coop/shared` only.
- Use granular Zustand selectors to limit re-renders.

## Part 1: State Management

### State Categories

| Type | Description | Solutions |
|------|-------------|-----------|
| **Local State** | Component-specific UI | useState, useReducer |
| **Global State** | Shared across components | Zustand (Coop default) |
| **Local-First Data** | Dexie + Yjs persistence | Dexie live queries, Yjs observeDeep |
| **URL State** | Route params, search | React Router |
| **Form State** | Input values, validation | React Hook Form + Zod |
| **Complex Flows** | Multi-step workflows, state machines | XState (Coop flows/) |

**Coop uses:** Zustand + XState + Dexie + Yjs

### Zustand Patterns

#### Basic Store

```typescript
// packages/shared/src/stores/appStore.ts
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface AppState {
  user: User | null;
  theme: "light" | "dark";
  setUser: (user: User | null) => void;
  toggleTheme: () => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        theme: "light",
        setUser: (user) => set({ user }),
        toggleTheme: () =>
          set((state) => ({
            theme: state.theme === "light" ? "dark" : "light",
          })),
      }),
      { name: "app-storage" }
    )
  )
);
```

#### Granular Selectors (Prevent Re-renders)

```typescript
// Bad: Subscribes to entire store, re-renders on any change
const state = useAppStore();

// Good: Subscribes only to what's needed
const user = useAppStore((state) => state.user);
const theme = useAppStore((state) => state.theme);

// Better: Export selector hooks
export const useUser = () => useAppStore((state) => state.user);
export const useTheme = () => useAppStore((state) => state.theme);
```

#### Slice Pattern (Scalable)

```typescript
import { StateCreator } from "zustand";

export interface UserSlice {
  user: User | null;
  isAuthenticated: boolean;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
}

export const createUserSlice: StateCreator<
  UserSlice & UiSlice,
  [],
  [],
  UserSlice
> = (set, get) => ({
  user: null,
  isAuthenticated: false,
  login: async (credentials) => {
    const user = await authApi.login(credentials);
    set({ user, isAuthenticated: true });
  },
  logout: () => set({ user: null, isAuthenticated: false }),
});
```

### Combining Client + Local-First State

Use Zustand for UI state (sidebar, modals, preferences) and Dexie live queries for persistent local data (coops, tabs, drafts). Never duplicate Dexie data into Zustand -- let Dexie's reactive queries manage data.

### Advanced Zustand Patterns

#### Persist Middleware

Coop stores use `persist` for state survival across sessions:

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      debugMode: false,
      isOfflineBannerVisible: false,
      toggleDebug: () => set((s) => ({ debugMode: !s.debugMode })),
    }),
    {
      name: "coop:debug-mode", // localStorage key
      partialize: (state) => ({ debugMode: state.debugMode }), // Only persist specific fields
    }
  )
);
```

**`partialize` is critical** -- without it, transient UI state (modals, banners) gets persisted and restored on refresh, causing stale UI.

#### Store Testing

```typescript
beforeEach(() => {
  act(() => useCreateCoopStore.getState().reset()); // Reset between tests
});

test("advances step when valid", () => {
  act(() => {
    useCreateCoopStore.getState().setField("name", "My Coop");
    useCreateCoopStore.getState().nextStep();
  });
  expect(useCreateCoopStore.getState().currentStep).toBe(1);
});
```

#### When to Use Which Middleware

| Middleware | Use When |
|-----------|----------|
| `persist` | State must survive page refresh (drafts, preferences) |
| `devtools` | Development debugging (Redux DevTools integration) |
| `immer` | Deep nested state updates (avoid in Coop -- prefer flat state) |

### Hook Boundary Rule

**All state hooks MUST be in `@coop/shared`:**

```typescript
// Correct: Import from shared
import { useAuth, useCoops, useUIStore } from "@coop/shared";

// Wrong: Define hooks in app/extension
export function useLocalState() { /* ... */ }
```

---

## Part 2: Component Composition

### Core Principle

> **Composition over configuration** -- Instead of adding props to customize behavior, compose smaller specialized components.

### Avoid Boolean Prop Explosion

```typescript
// Bad: Boolean prop explosion
<Button primary large withIcon loading disabled outlined />

// Good: Composition + explicit variants
<Button variant="primary" size="lg">
  <Button.Icon name="save" />
  <Button.Text>Save</Button.Text>
</Button>
```

### Compound Components

```typescript
// Good: Compound component pattern
<Card>
  <Card.Header>
    <Card.Title>Coop Details</Card.Title>
  </Card.Header>
  <Card.Content>
    {/* Content */}
  </Card.Content>
  <Card.Footer>
    <Card.Actions>
      <Button>Edit</Button>
    </Card.Actions>
  </Card.Footer>
</Card>
```

### State Encapsulation in Providers

```typescript
// Bad: State leaked to consumers
function ParentComponent() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("");
  return <ItemList items={items} setItems={setItems} filter={filter} />;
}

// Good: State encapsulated in provider
function ItemListProvider({ children }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("");

  const filteredItems = useMemo(
    () => items.filter(i => i.name.includes(filter)),
    [items, filter]
  );

  return (
    <ItemListContext value={{ items: filteredItems, setFilter }}>
      {children}
    </ItemListContext>
  );
}
```

### Explicit Variants Over Boolean Modes

```typescript
// Bad: Boolean mode
<Input error={true} />
<Input success={true} />

// Good: Explicit variant
<Input variant="error" />
<Input variant="success" />
```

### React 19 Patterns

Coop runs **React 19**. Use these new APIs:

#### `use()` for Context and Promises

```typescript
import { Suspense, use, useMemo } from "react";

// Replace useContext
const value = use(MyContext);

// Read a promise (suspends until resolved)
function CoopDetails({ coopPromise }: { coopPromise: Promise<Coop> }) {
  const coop = use(coopPromise); // Suspends component
  return <h1>{coop.name}</h1>;
}

// Create the promise once per id, outside JSX
function CoopDetailsContainer({ id }: { id: string }) {
  const coopPromise = useMemo(() => fetchCoop(id), [id]);

  return (
    <Suspense fallback={<Skeleton />}>
      <CoopDetails coopPromise={coopPromise} />
    </Suspense>
  );
}
```

#### `useOptimistic()` for Instant UI Feedback

```typescript
import { useOptimistic } from "react";

function TabList({ tabs }: { tabs: Tab[] }) {
  const [optimisticTabs, addOptimistic] = useOptimistic(
    tabs,
    (current, newTab: Tab) => [...current, newTab]
  );

  const handleAdd = async (tab: Tab) => {
    addOptimistic({ ...tab, status: "pending" });
    await saveTab(tab);
  };

  return optimisticTabs.map((t) => <TabCard key={t.id} tab={t} />);
}
```

#### When to Use React 19 vs Existing Patterns

| Task | React 19 | Existing |
|------|----------|----------|
| Read context | `use(Context)` | `useContext(Context)` -- both work |
| Form submission | `useActionState` | React Hook Form + Zod (preferred for validation) |
| Optimistic UI | `useOptimistic` | Manual state + rollback |
| Async data | `use(promise)` + Suspense | Dexie live queries (preferred for local-first) |
| Ref cleanup | Return cleanup from ref callback | `useEffect` cleanup |

**Note:** For Coop, Dexie live queries remain the primary data source (local-first, reactive). Use `use()` for simple one-shot reads where Dexie is overkill.

---

## Part 3: React Compiler & Memoization

> For full React Compiler integration details, see [compiler.md](./compiler.md)

Coop uses `babel-plugin-react-compiler` in Vite configs. The compiler **automatically memoizes** components, hooks, and expressions -- eliminating most manual `useMemo`, `useCallback`, and `React.memo` usage.

**Key rules:**
- Don't add `useMemo`, `useCallback`, or `React.memo` by default -- the compiler handles it
- Manual memoization still needed for: values passed to non-React APIs, shared hooks consumed across apps
- Hooks in `@coop/shared` may still benefit from manual memoization (compiler optimizes per-app build)
- When in doubt, profile first with React DevTools Profiler

---

## Part 4: Performance Optimization

> For detailed performance patterns and bundle budgets, see [performance.md](./performance.md)

**Critical rules:**
- Eliminate request waterfalls -- use `Promise.all` for independent fetches
- Use direct imports from large libraries (e.g., `import format from "date-fns/format"`)
- Dynamic import for below-fold content (`lazy(() => import(...))`)
- Use granular Zustand selectors, never subscribe to entire store
- Virtualize long lists (50+ items) with @tanstack/react-virtual
- CSS animations only (`transform`, `opacity`)

**Bundle Budgets:** Main < 150KB, per-route < 50KB, total JS < 400KB (gzipped)

---

## Quick Reference

**Before committing:** No serial awaits (use `Promise.all`), dynamic imports for below-fold, direct imports from large libs, long lists virtualized (50+ items), CSS-only animations.

**Before designing a component:** Compose from smaller pieces, use explicit variants (not boolean props), use providers to avoid prop drilling, follow existing Coop patterns.

**State management:** Zustand for UI state, Dexie for local-first data, granular selectors only, all hooks in `@coop/shared`, forms via React Hook Form + Zod.

## Anti-Patterns

- Creating hooks in `app` or `extension` instead of `shared`
- Selecting full Zustand state (`state => state`) in UI components
- Introducing waterfalls when data can be fetched in parallel
- Using deep imports from `@coop/shared/*` instead of barrel imports
- Memoizing trivial values without measured performance impact

## Related Skills

- `data-layer` -- Dexie + Yjs local-first patterns that integrate with React components
- `architecture` -- Clean Architecture and composition patterns for React
- `testing` -- Vitest and React Testing Library patterns for component tests
- `performance` -- React Profiler, re-render optimization, and bundle analysis
- `ui-compliance` -- WCAG accessibility, responsive design for React components
- `frontend-design` -- Visual design direction and aesthetic choices for React UIs
