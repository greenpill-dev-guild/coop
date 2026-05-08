# Autoresearch — QA Report

Metadata normalized on April 9, 2026. As of May 8, 2026, eval/state/runtime,
UI, and both QA passes are complete in the plan pack. `status.json` remains
`stage: active` because the planning schema only accepts `active` or `backlog`;
the implementation lanes are closed and the pack is ready for archive/cleanup.

## QA Pass 1 (Codex)

- **Date**: 2026-05-08
- **Status**: passed with residual risks
- **Findings**:
  - Targeted autoresearch/shared/runtime tests passed: 7 files, 87 tests passed, 2 skipped.
  - Confirmed schema round-trips/defaults/exports, experiment record ordering and pruning, variant
    activation/revert behavior, eval determinism, quality-floor enforcement, timeout reverts, and
    experiment journal writes for kept, reverted, and timeout outcomes.
  - Confirmed run-now error surfacing in `NestAutoresearchSection`: load/toggle/run failures render
    visible helper text and leave the Run now control usable after failure.
  - `bun run plans validate` passed.
  - `bun run validate:quick` passed after QA pass 2 corrected Receiver lint/format drift that had
    blocked the first QA pass 1 run.
- **Residual Risks**:
  - Direct `[skillId+isActive]` boolean compound-index query tests remain skipped under
    `fake-indexeddb`; the table declares the index, and runtime active lookup is covered through the
    scan-based fallback.
  - Coverage percentage was not measured; this pass used the requested targeted tests plus quick
    validation.

## QA Pass 2 (Claude)

- **Date**: 2026-05-08
- **Status**: passed
- **Findings**:
  - UI lane is complete in `NestAutoresearchSection`: the Nest Autoresearch section now renders
    disabled/empty states, per-skill enablement, experiments-per-cycle range control, time-budget
    select, quality-floor input validation, run-now loading/error feedback, journal filtering,
    score bars, trend cues, and 20-record pagination with a button fallback.
  - Runtime message handling accepts full config updates for `enabled`,
    `maxExperimentsPerCycle`, `timeBudgetMs`, and `qualityFloor` while validating merged config
    through `autoresearchConfigSchema`.
  - `NestAutoresearchSection.test.tsx` covers load/run failures, no-WebLLM disabled state,
    persisted settings across remount, budget/floor updates, run-now journal refresh, trend cues,
    skill filtering, and pagination: 8 tests passed.
  - Targeted autoresearch/shared/runtime/UI suite passed: 7 files, 92 tests passed, 2 skipped.
  - `bun run validate:sidepanel-settings` passed, including the extension build.
  - `bun run validate:quick` passed.
  - A first `bun run validate smoke` run failed while unrelated knowledge-source/graph files were
    changing in the dirty worktree. The failed subset was rerun and passed: 8 files, 65 tests.
    A full smoke rerun then passed: 328 unit files passed, 3 skipped; shared/app/extension build
    passed.
- **Residual Risks**:
  - Direct browser-driven extension E2E was not added in this pass. The QA proof is component,
    runtime, plans, quick, sidepanel-settings, and smoke validation.
  - Coverage percentage was not measured. The targeted UI/runtime assertions and smoke gate are the
    current proof surface.
