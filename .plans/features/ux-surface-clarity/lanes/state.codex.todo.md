---
feature: ux-surface-clarity
title: UX Surface Clarity state lane
lane: state
agent: codex
status: done
source_branch: feature/ux-surface-clarity
work_branch: codex/state/ux-surface-clarity
depends_on:
  - ../spec.md
owned_paths:
  - packages/shared/src/contracts/schema-coop.ts
  - packages/shared/src/modules/storage/db-crud-coop.ts
  - packages/shared/src/modules/storage/__tests__/db.test.ts
  - packages/extension/src/background/context-ui.ts
  - packages/extension/src/background/__tests__/context.test.ts
done_when:
  - uiMode
  - advanced
  - simple
skills:
  - state-logic
  - shared
  - storage
updated: 2026-05-05
---

# State Lane

## Objective

Add the persisted `uiMode` preference that lets the UI switch between a default simple surface and
an advanced builder/operator surface.

Keep this to the existing `UiPreferences` path. Do not add a new settings table, env flag, or
feature-flag service.

## Files

- `packages/shared/src/contracts/schema-coop.ts`
- `packages/shared/src/modules/storage/db-crud-coop.ts`
- `packages/shared/src/modules/storage/__tests__/db.test.ts`
- `packages/extension/src/background/context-ui.ts`
- `packages/extension/src/background/__tests__/context.test.ts`

## Tasks

- [x] Add `uiMode: z.enum(['simple', 'advanced']).default('simple')` to `uiPreferencesSchema`.
- [x] Confirm existing stored preference objects hydrate with `uiMode: 'simple'`.
- [x] Confirm `saveResolvedUiPreferences` round-trips `uiMode: 'advanced'`.
- [x] Update storage/background tests for default and persisted values.
- [x] Keep work inside `owned_paths` or document justified spillover.

## Verification

- [x] `bun run test packages/shared/src/modules/storage/__tests__/db.test.ts packages/extension/src/background/__tests__/context.test.ts`
- [x] `bun run validate:quick`

## Handoff Notes

- Persisted-state change: existing installs must default to simple mode without losing other
  preferences.
- Public contract note: `UiPreferences` changes are extension-internal UI contract changes, not API
  or onchain contract changes.
- Existing stored preference objects hydrate through Zod defaults, so no migration table or backfill
  was added.
- UI work landed in the same implementation pass by user request; sidepanel UI validation passed.
