# QA Report For Next-Step Review

## QA Pass 1: Codex

- Status: done on `main`.
- Commands:
  - `bun run test -- packages/shared/src/modules/storage/__tests__/db.test.ts packages/extension/src/background/handlers/__tests__/review-handlers.test.ts`
  - `bun run test -- packages/extension/src/views/Sidepanel/tabs/__tests__/ChickensTab-interactions.test.tsx`
  - `bun run test -- packages/extension/src/background/__tests__/dashboard-assembly.test.ts`
    - RED: failed before the dashboard matcher fix with `expected 1 to be +0` for snoozed draft
      feedback still counting a related routed signal.
    - GREEN: passed after the matcher used `draftId`, `extractId`, or `sourceCandidateId`.
  - Combined targeted suite covering storage, review handlers, dashboard assembly, dashboard labels,
    Roost, and Chickens: 8 files passed, 176 tests passed.
  - `bun run plans validate`
  - `bun run validate:quick`
- Findings:
  - Initial RED run failed on missing `saveReviewItemFeedback`, as expected.
  - QA pass 1 found one narrow dashboard regression: draft review feedback could hide the draft but
    leave a related routed signal counted when the routing was matched by source metadata rather
    than `draftId`.
  - Fixed in `packages/extension/src/background/dashboard.ts` and covered in
    `packages/extension/src/background/__tests__/dashboard-assembly.test.ts`.
  - Targeted implementation tests passed after adding shared/runtime/UI behavior and the QA
    regression test.
  - Plan validation passed after moving `qa_pass_1` to `done` and `qa_pass_2` to `ready`.
  - `bun run validate:quick` typechecked successfully, then failed during lint on unrelated receiver
    app files:
    - `packages/app/src/views/Receiver/ReceiverShell.tsx` has pre-existing
      `lint/a11y/noSvgWithoutTitle` findings.
    - `packages/app/src/styles.css` has pre-existing Biome formatting drift.
    - These app surfaces were not changed in this QA pass.

## QA Pass 2: Claude

- Status: ready in plan state, but not runnable until `handoff/qa-claude/next-step-review` exists.
- Commands:
  - Pending browser/visual validation.
- Findings:
  - Pending real browser validation of Roost and Chickens simple/advanced modes.
  - Codex did not create the handoff branch because this pass was explicitly constrained to stay on
    `main`.

## Residual Risk

- No browser/visual sweep has been run yet for the new compact card feedback actions.
- `Remind later` uses a fixed three-day fallback because structured review scheduling does not exist
  in v1.
- QA pass 2 should still verify card density, wrapping, and reload behavior in a browser before
  release handoff.
