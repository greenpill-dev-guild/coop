# Performance Optimization

> Back to [SKILL.md](./SKILL.md)

## Table of Contents

- [Eliminating Waterfalls](#critical-eliminating-waterfalls)
- [Bundle Size Optimization](#critical-bundle-size-optimization)
- [Re-render Optimization](#medium-re-render-optimization)
- [Rendering Performance](#medium-rendering-performance)

---

## CRITICAL: Eliminating Waterfalls

**The #1 performance killer in React apps.**

```typescript
// Bad: Waterfall
const user = await getUser();
const coops = await getCoops(user.id);

// Good: Parallel where possible
const [user, recentCoops] = await Promise.all([
  getUser(),
  getRecentCoops()
]);
```

## CRITICAL: Bundle Size Optimization

**Every KB matters for extension and PWA.**

```typescript
// Bad: Imports entire library
import { format } from "date-fns";

// Good: Direct import
import format from "date-fns/format";

// Good: Dynamic import for heavy components
const HeavyChart = lazy(() => import("./HeavyChart"));
```

**Bundle Budgets (Coop):**
- Main bundle: < 150KB gzipped
- Per-route chunk: < 50KB gzipped
- Total JS: < 400KB gzipped

## MEDIUM: Re-render Optimization

```typescript
// Bad: Entire store causes re-renders
const state = useAppStore();

// Good: Granular selector
const coops = useAppStore((state) => state.coops);
```

**When to use memoization (with React Compiler active):**
- The compiler handles most cases automatically (see [compiler.md](./compiler.md))
- Manual `useMemo`: Only for values passed to non-React APIs or shared hooks
- Manual `useCallback`: Only when debugging a specific re-render issue
- `React.memo`: Almost never needed -- compiler auto-skips unchanged props

## MEDIUM: Rendering Performance

- **CSS > JS for animations** -- `transform` and `opacity` only
- **Virtualize long lists** -- @tanstack/react-virtual for 50+ items
- **Avoid layout thrashing** -- Batch DOM reads/writes
