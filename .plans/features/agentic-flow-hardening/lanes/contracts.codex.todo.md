---
feature: agentic-flow-hardening
title: Agentic Flow Hardening contracts lane
lane: contracts
agent: codex
status: done
source_branch: feature/agentic-flow-hardening
work_branch: codex/contracts/agentic-flow-hardening
depends_on:
  - ../spec.md
owned_paths:
  - packages/shared/src/contracts/schema-sync.ts
  - packages/shared/src/contracts/__tests__/schema-sync.test.ts
done_when:
  - iceConfigResponseSchema
  - signalingMessageSchema
skills:
  - contracts
  - onchain
  - permissions
updated: 2026-05-26
---

# Contracts Lane

## Objective

Add shared sync/message Zod schemas and inferred types without changing public wire shapes.

`done_when` should use concrete, searchable evidence strings that will exist under `owned_paths`
when the lane is truly complete.
Keep changes inside `owned_paths` where possible. If work spills beyond them, explain why in
`Handoff Notes`.

## Files

- `packages/shared/src/modules/onchain/...`
- `packages/shared/src/modules/policy/...`
- `packages/shared/src/modules/session/...`

## Tasks

- [x] Add ICE config response and rate-limit error schemas.
- [x] Add subscribe, unsubscribe, publish, ping, and union signaling schemas.
- [x] Export inferred TypeScript types from shared contracts.
- [x] Add targeted schema tests.
- [x] Keep work inside `owned_paths` or document justified spillover.
- [x] Document any live-probe follow-up.

## Verification

- [x] `vitest run packages/shared/src/contracts/__tests__/schema-sync.test.ts packages/api/src/routes/__tests__/sync.test.ts packages/api/src/ws/__tests__/handler.test.ts`
- [x] `bun run validate:smoke`

## Handoff Notes

Public contract callout: schemas document existing ICE/signaling shapes. No route, WebSocket message name, chain-mode, permission, or persisted-state changes.
