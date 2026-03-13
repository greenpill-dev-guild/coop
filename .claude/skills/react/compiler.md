# React Compiler & Memoization

> Back to [SKILL.md](./SKILL.md)

## Table of Contents

- [Compiler is Enabled](#react-compiler-is-enabled)
- [What the Compiler Handles](#what-the-compiler-handles-automatically)
- [When Manual Memoization is Still Needed](#when-manual-memoization-is-still-needed)
- [Anti-Patterns with the Compiler](#anti-patterns-with-the-compiler)
- [When to Profile Before Memoizing](#when-to-profile-before-memoizing)
- [Shared Package Exception](#shared-package-exception)

---

## React Compiler is Enabled

Coop uses `babel-plugin-react-compiler` in Vite configs. The compiler **automatically memoizes** components, hooks, and expressions -- eliminating most manual `useMemo`, `useCallback`, and `React.memo` usage.

```typescript
// vite.config.ts
react({
  babel: {
    plugins: [["babel-plugin-react-compiler", {}]],
  },
})
```

## What the Compiler Handles Automatically

| Pattern | Manual Code | Compiler | Action |
|---------|------------|----------|--------|
| Memoizing a computation | `useMemo(() => expensive(x), [x])` | Auto-memoized | **Don't add useMemo** |
| Stabilizing a callback | `useCallback((e) => handler(e), [dep])` | Auto-memoized | **Don't add useCallback** |
| Preventing child re-renders | `React.memo(Child)` | Auto-skipped | **Don't add React.memo** |
| Object literals in JSX | `style={{ color: 'red' }}` | Auto-memoized | **Don't wrap in useMemo** |

## When Manual Memoization is STILL Needed

The compiler cannot optimize everything. Use manual memoization for:

```typescript
// 1. Values passed to non-React APIs (third-party libraries, Web APIs)
const config = useMemo(() => buildConfig(data), [data]);
thirdPartyLib.init(config); // Compiler can't track external consumption

// 2. Expensive computations in custom hooks consumed by multiple components
// The compiler optimizes per-component, not across component boundaries
export function useFilteredTabs(tabs: Tab[], filters: Filters) {
  return useMemo(
    () => tabs.filter(t => matchesFilters(t, filters)),
    [tabs, filters]
  );
}
```

## Anti-Patterns with the Compiler

```typescript
// BAD: Add useMemo/useCallback "just in case"
const memoized = useMemo(() => items.map(transform), [items]);
// The compiler already handles this -- the useMemo is redundant noise

// GOOD: Write plain code and let the compiler optimize
const transformed = items.map(transform);

// BAD: Wrap components in React.memo by default
export default React.memo(CoopCard);
// The compiler already skips re-renders when props haven't changed

// GOOD: Export components directly
export default CoopCard;
```

## When to Profile Before Memoizing

If you suspect a performance issue:

1. **Use React DevTools Profiler** -- identify which components re-render
2. **Check the compiler output** -- `npx react-compiler-healthcheck` validates the compiler is working
3. **Only then** add manual optimization if the compiler misses something

## Shared Package Exception

Hooks in `@coop/shared` may still benefit from manual memoization because:
- They're consumed by both `app` and `extension` (compiler optimizes per-app build)
- Complex derived state in hooks should be explicitly memoized for clarity
