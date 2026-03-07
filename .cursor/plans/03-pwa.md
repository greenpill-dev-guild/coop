# Plan 03 - PWA Companion

## Scope

Turn `packages/pwa` into a voice-first mobile companion synchronized with Coop anchor services.

## Current State

- Basic React app exists.
- Basic share code and speech interactions exist.
- No robust PWA/offline/sync setup yet.

## Todos

1. Add PWA manifest and service-worker setup via Vite PWA plugin.
2. Implement anchor connection for Coop room sync.
3. Redesign UI for voice-first primary flow.
4. Persist Coop membership and local drafts in IndexedDB.
5. Implement feed retrieval and live update rendering.
6. Add offline queue for deferred transcript sync.

## Dependencies

- `04-shared-package.md` for membrane client and shared types.
- `02-anchor-node.md` for WS/REST contracts.

## Key Files

- `packages/pwa/vite.config.ts`
- `packages/pwa/src/main.tsx`
- `packages/pwa/index.html`
- `packages/pwa/src/lib/*` (new helper modules)
- `packages/pwa/public/manifest.webmanifest` (new)

## Dependencies to Install

- `vite-plugin-pwa`
- `idb-keyval`

## Done Criteria

- PWA is installable and works offline.
- Voice notes queue when offline and sync when online.
- Coop feed is visible and updates from anchor events.
