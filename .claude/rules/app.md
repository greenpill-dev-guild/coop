---
paths:
  - "packages/app/src/**/*.ts"
  - "packages/app/src/**/*.tsx"
  - "packages/app/src/**/*.css"
---

# App Package Rules

- The app serves two purposes: (1) public landing page and (2) receiver PWA shell for mobile pairing + desktop board.
- All domain logic MUST be imported from `@coop/shared`. The app contains no business logic of its own.
- The receiver uses a SEPARATE Dexie instance (`coop-receiver`), not the extension's `coop-v1`. Never mix them.
- Routes are path-based with manual resolution. Never add routing libraries.
- State uses React `useState`/`useEffect` directly. Never add state management libraries.
- Handoff pattern: extract payload from URL hash/search, then immediately strip via `history.replaceState()`. Never leave payload data in URLs.
- Never assume the extension is installed. The landing page works standalone.
- Never import from `@coop/shared` deep paths. Use the barrel export.
