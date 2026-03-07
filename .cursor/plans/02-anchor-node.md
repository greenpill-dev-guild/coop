# Plan 02 - Anchor Node Backend

## Scope

Implement production-grade Coop backend behavior in `packages/anchor` for inference, Coop lifecycle, relay, and storage.

## Current State

- Fastify server and minimal routes exist.
- WS relay exists but is broadcast-only.
- Inference, storacha, and pillar logic are mostly stubs.

## Todos

1. Implement real AI inference service and pillar-specific prompt flows.
2. Replace placeholder pillar handlers with structured extraction logic.
3. Integrate Storacha upload flow with real CID outputs.
4. Add Coop management REST API (`create`, `join`, `get`, `feed`, `members`).
5. Implement room-scoped WS protocol with typed message events.
6. Replace in-memory state with SQLite persistence.
7. Add CORS setup for extension and local PWA origins.

## Dependencies

- `04-shared-package.md` for message contracts and API types.
- `07-skills-system.md` for handler conventions.

## Key Files

- `packages/anchor/src/ai/inference.ts`
- `packages/anchor/src/agent/pillars.ts`
- `packages/anchor/src/agent/runtime.ts`
- `packages/anchor/src/storage/storacha.ts`
- `packages/anchor/src/api/routes.ts`
- `packages/anchor/src/server.ts`
- `packages/anchor/src/auth/keys.ts`

## Dependencies to Install

- `@anthropic-ai/sdk`
- `@storacha/client`
- `better-sqlite3`
- `@fastify/cors`

## Done Criteria

- Coop REST and WS flows run end-to-end.
- At least one pillar performs real structured inference.
- Cold storage upload returns real CID metadata.
