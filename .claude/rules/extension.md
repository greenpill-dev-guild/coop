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

## Adding Background Handlers

Background handlers process `RuntimeRequest` messages from views. To add a new handler:

1. **Define the request type** in `@coop/shared` contracts (`schema.ts`) as a new variant of the RuntimeRequest union.
2. **Add the handler function** in `background/handlers/`. Group by domain (capture, review, coop, archive, etc.). Each handler takes `(request, context)` and returns a response object.
3. **Register the handler** in `background/handlers/receiver.ts` — add a `case` to the request type switch.
4. **Return shape**: Always `{ ok: boolean; error?: string; data?: unknown }`. Never throw from handlers — catch and return `{ ok: false, error: message }`.
5. **Side effects** (sounds, badge updates): Return `soundEvent` or `badgeUpdate` in the response — the view handles playback/display.

## Adding Action Executors

Action executors handle `PolicyActionClass` items in `background/handlers/action-executors.ts`. To add a new executor:

1. **Define the action class** as a new `PolicyActionClass` variant in `@coop/shared`.
2. **Add the executor** to the `ACTION_EXECUTORS` map in `action-executors.ts`. Key = action class string, value = async function `(action, context) => ActionResult`.
3. **Context**: executors receive `ActionExecutorContext` with `db`, `coopId`, `identity`, and helpers.
4. **Testing**: Add a test case in `background/handlers/__tests__/` — mock the db and assert the executor returns the expected result.
