---
feature: next-step-review
title: Next-Step Review runtime lane
lane: api
agent: codex
status: done
source_branch: feature/next-step-review
work_branch: codex/api/next-step-review
depends_on:
  - ../spec.md
  - ./state.codex.todo.md
owned_paths:
  - packages/extension/src/runtime/messages.ts
  - packages/extension/src/background/handlers/review.ts
  - packages/extension/src/background/dashboard.ts
  - packages/extension/src/background.ts
  - packages/extension/src/background/handler-registry.ts
done_when:
  - record-review-feedback
  - activeReviewItemFeedbacks
skills:
  - api
  - state-logic
updated: 2026-05-06
---

# Runtime Lane

## Objective

Wire local review feedback through the extension runtime and dashboard so counts, proactive signals,
and review surfaces all use the same suppression truth.

## Files

- `packages/extension/src/runtime/messages.ts`
- `packages/extension/src/background/handlers/review.ts`
- `packages/extension/src/background/dashboard.ts`
- `packages/extension/src/background.ts`
- `packages/extension/src/background/handler-registry.ts`
- Targeted background tests under `packages/extension/src/background/**/__tests__`

## Tasks

- [x] Add runtime request `record-review-feedback`.
- [x] Add `activeReviewItemFeedbacks` to `DashboardResponse`.
- [x] Persist feedback from the background review handler.
- [x] For `not-useful`, dismiss matching tab routings or stale observations when those statuses
  already exist.
- [x] For `remind-later`, suppress without mutating source routings, drafts, or observations.
- [x] Filter dashboard summary counts, tab routings, coop badges, and proactive signals with active
  feedback.

## Verification

- [x] `bun run test -- packages/extension/src/background/handlers/__tests__/review-handlers.test.ts`
- [x] `bun run test -- packages/extension/src/background/__tests__/dashboard-assembly.test.ts packages/extension/src/background/__tests__/dashboard.test.ts`

## Handoff Notes

- Runtime boundary change: `record-review-feedback` is extension-local and not a server/API route.
- Default snooze is three days; existing ritual cadence is free text and not parsed in this v1.
- `refreshBadge` is queued after feedback so open surfaces reload through existing dashboard update
  notifications.
