---
feature: next-step-review
title: Next-Step Review state lane
lane: state
agent: codex
status: done
source_branch: feature/next-step-review
work_branch: codex/state/next-step-review
depends_on:
  - ../spec.md
owned_paths:
  - packages/shared/src/contracts/schema-agent.ts
  - packages/shared/src/modules/storage/db-schema.ts
  - packages/shared/src/modules/storage/db-crud-agent.ts
  - packages/shared/src/modules/storage/__tests__/db.test.ts
done_when:
  - ReviewItemFeedback
  - reviewItemFeedbacks
  - listActiveReviewItemFeedbacks
skills:
  - state-logic
  - shared
  - storage
updated: 2026-05-06
---

# State Lane

## Objective

Add local-only review item feedback so Coop can suppress or snooze low-salience review items without
deleting local drafts or changing shared coop state.

## Files

- `packages/shared/src/contracts/schema-agent.ts`
- `packages/shared/src/modules/storage/db-schema.ts`
- `packages/shared/src/modules/storage/db-crud-agent.ts`
- `packages/shared/src/modules/storage/__tests__/db.test.ts`

## Tasks

- [x] Add `ReviewItemFeedback` schema for signals, drafts, and observations.
- [x] Add Dexie `reviewItemFeedbacks` table at the next DB version.
- [x] Add CRUD helpers for saving feedback, listing feedback, and filtering active suppressions.
- [x] Preserve local-first behavior; feedback is not synced, published, archived, or written onchain.
- [x] Add storage tests for persistence and `remind-later` expiry.

## Verification

- [x] `bun run test -- packages/shared/src/modules/storage/__tests__/db.test.ts`

## Handoff Notes

- Persisted-state change: new local Dexie table `reviewItemFeedbacks` at version 24.
- Human judgment callout: feedback records are intentionally local-only and do not delete drafts.
- `remind-later` without `remindAt` is treated as active; runtime always supplies a default.
