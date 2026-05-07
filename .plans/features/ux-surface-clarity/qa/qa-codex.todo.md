---
feature: ux-surface-clarity
title: UX Surface Clarity QA pass 1
lane: qa
agent: codex
status: done
source_branch: feature/ux-surface-clarity
work_branch: qa/codex/ux-surface-clarity
skills:
  - qa
  - state-logic
  - api
  - contracts
qa_order: 1
handoff_in: handoff/qa-codex/ux-surface-clarity
handoff_out: handoff/qa-claude/ux-surface-clarity
updated: 2026-05-05
---

# QA Pass 1

Codex runs the first QA pass after implementation lanes finish and the `handoff/qa-codex/ux-surface-clarity` branch exists.

## Implementation Handoff

- State and UI lanes are marked done after one combined implementation pass.
- Persisted-state callout: `UiPreferences.uiMode` defaults to `simple` via schema parsing; no
  migration or new settings table was added.
- UI ownership callout: Codex implemented UI render gates in this pass by explicit user request.
- Behavior boundary: API, contracts, onchain, permit, policy, and session behavior were not changed.
- Validation already passed:
  - `bun run test packages/shared/src/modules/storage/__tests__/db.test.ts packages/extension/src/background/__tests__/context.test.ts`
  - Targeted changed UI tests for Nest Settings, Roost, Coops, and Popup Profile
  - `bun run validate:sidepanel-settings`
  - `bun run validate:quick`
- QA pass 1 fixed the remaining source-reviewed simple-mode leaks: Nest Settings now hides proof
  export and Filecoin setup in simple mode, and popup home hides Sources in simple mode.
- Residual QA need: browser/visual sweep of simple and advanced mode remains for QA pass 2; no
  interactive browser pass was run during this pass.

## Focus

- State persistence
- Runtime messaging
- UI preference defaults
- Representative simple/advanced render gates
- Confirmation that API/contracts lanes stayed untouched
- Human judgment callouts from implementation handoff notes

## Tasks

- [x] Verify `uiMode` defaults and persistence.
- [x] Verify simple/advanced render gates for Roost, Coops, Nest, and popup profile.
- [x] Confirm API/contracts paths were not changed unless the plan was explicitly updated.
- [x] Run targeted validation suites.
- [x] Verify any human judgment callouts from implementation lanes
- [x] Capture findings and residual risks
- [ ] Create `handoff/qa-claude/ux-surface-clarity` when pass 2 should start

## Verification

- [x] Validation commands are recorded in `../eval/qa-report.md`
- [x] Any remaining risk is explicit

## QA Pass 1 Notes

- Corrected the P1 Nest Settings leak by keeping ordinary snapshot save/export visible while hiding
  saved-proof export and Filecoin archive setup unless advanced controls are enabled.
- Corrected the P2 popup leak by hiding the Sources status item and source-health runtime fetch
  unless advanced controls are enabled.
- Updated stale Coops/Roost legacy tests so default simple mode and advanced restoration are both
  covered.
- Confirmed no API, contracts, onchain, permit, policy, or session paths changed.
- QA pass 2 should run the manual browser/visual sweep and then cut the
  `handoff/qa-claude/ux-surface-clarity` branch when the workspace is ready for that handoff.
