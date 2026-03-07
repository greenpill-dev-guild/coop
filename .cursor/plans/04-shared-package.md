# Plan 04 - Shared Package

## Scope

Upgrade `packages/shared` from interface-only scaffolding into reusable, concrete shared foundations across extension, PWA, and anchor.

## Current State

- Core types and interfaces exist.
- Storage and membrane abstractions are defined.
- Concrete implementations are missing.

## Todos

1. Implement concrete storage layers (IndexedDB, REST, cold storage adapter).
2. Move membrane client implementation into shared package.
3. Define message type constants and helper constructors.
4. Add request/response types for Coop and skill APIs.
5. Export a factory for three-layer storage assembly.

## Dependencies

- Upstream API behavior from `02-anchor-node.md`.
- Consumer requirements from `01-extension.md` and `03-pwa.md`.

## Key Files

- `packages/shared/src/types/index.ts`
- `packages/shared/src/protocols/membrane.ts`
- `packages/shared/src/storage/three-layer.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/storage/*` (new)
- `packages/shared/src/protocols/*` (new)

## Dependencies to Install

- `idb-keyval`

## Done Criteria

- Extension and PWA can import one shared membrane client.
- Storage interfaces have concrete runtime implementations.
- Anchor and clients share API/message contracts from one source.
