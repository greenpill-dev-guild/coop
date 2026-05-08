# Autoresearch — QA Report

Metadata normalized on April 9, 2026. This pack has real eval/state/runtime implementation in the
repo, but UI completion and both QA passes are still open in the plan.

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
  - `bun run validate:quick` was run; typecheck passed, then lint failed on existing Receiver app
    issues outside this autoresearch QA diff.
- **Residual Risks**:
  - UI remains backlog: budget slider, quality-floor editor, journal pagination, and explicit
    loading states are still unshipped, so the feature remains active and QA pass 2 remains blocked.
  - Direct `[skillId+isActive]` boolean compound-index query tests remain skipped under
    `fake-indexeddb`; the table declares the index, and runtime active lookup is covered through the
    scan-based fallback.
  - Coverage percentage was not measured; this pass used the requested targeted tests plus quick
    validation.
  - Repo-level quick validation remains blocked by `packages/app/src/views/Receiver/ReceiverShell.tsx`
    SVG title lint errors and `packages/app/src/styles.css` formatting drift.

## QA Pass 2 (Claude)

- **Date**: —
- **Status**: blocked
- **Findings**: —
- **Residual Risks**: UI lane remains backlog, so UX/E2E QA is not ready to run.
