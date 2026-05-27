---
feature: agentic-flow-hardening
title: Agentic Flow Hardening API lane
lane: api
agent: codex
status: done
source_branch: feature/agentic-flow-hardening
work_branch: codex/api/agentic-flow-hardening
depends_on:
  - ../spec.md
  - contracts.codex.todo.md
owned_paths:
  - packages/api/src/routes/sync.ts
  - packages/api/src/routes/__tests__/sync.test.ts
  - packages/api/src/ws/handler.ts
  - packages/api/src/ws/types.ts
  - packages/api/src/ws/__tests__/handler.test.ts
  - packages/shared/src/sync-config.ts
done_when:
  - iceConfigResponseSchema.parse
  - signalingMessageSchema.safeParse
  - fetchServerMintedIceConfig
skills:
  - api
  - hono
  - contracts
updated: 2026-05-26
---

# API Lane

## Objective

Consume the shared sync/message schemas in API and shared client boundaries while preserving current behavior.

`done_when` should use concrete, searchable evidence strings that will exist under `owned_paths`
when the lane is truly complete.
Keep changes inside `owned_paths` where possible. If work spills beyond them, explain why in
`Handoff Notes`.

## Files

- `packages/api/...`
- Shared request/response contracts
- Runtime message handlers if affected

## Tasks

- [x] Parse `/sync/ice` success and rate-limit payloads through shared schemas.
- [x] Parse fetched ICE configs with shared schema and keep `null` fallback for invalid/unreachable responses.
- [x] Parse WebSocket signaling messages through shared schema.
- [x] Preserve tolerant drop behavior and publish passthrough fields.
- [x] Add or update API tests.
- [x] Keep work inside `owned_paths` or document justified spillover.
- [x] Capture any migration or rollout notes.

## Verification

- [x] `vitest run packages/shared/src/contracts/__tests__/schema-sync.test.ts packages/api/src/routes/__tests__/sync.test.ts packages/api/src/ws/__tests__/handler.test.ts`
- [x] `bun run validate:smoke`

## Handoff Notes

QA should verify that malformed JSON, missing type, invalid publish topic, non-string subscribe topics, publish passthrough, and ICE fallback behavior remain intact. No route or WebSocket message names changed.
