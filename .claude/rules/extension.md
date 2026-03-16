---
paths:
  - "packages/extension/src/**/*.ts"
  - "packages/extension/src/**/*.tsx"
  - "packages/extension/public/**"
---

# Extension Package Rules

- The extension is the PRIMARY product surface. It is a Chrome MV3 extension with background service worker, popup, and sidepanel.
- All domain logic MUST live in `@coop/shared`. The extension runtime is thin — it orchestrates shared functions and manages Chrome APIs.
- Views never directly access Dexie or Yjs. Everything goes through runtime messages to the background.
- Never play sounds in the service worker. Return `soundEvent` in the response and let the view handle audio via Web Audio API.
- Never use `setInterval` in the background. Use `chrome.alarms` for scheduled work.
- Never use `window` in the background service worker. It does not exist.
- Never assume the service worker is alive. It may restart at any time; re-initialize from Dexie.
- Never skip HMAC validation on receiver sync envelopes.
- Message bridge: all view<->background communication uses `chrome.runtime.sendMessage()` with `RuntimeRequest` discriminated union.
- Config resolution: env vars read via `import.meta.env.VITE_*` and resolved through `runtime/config.ts`.
