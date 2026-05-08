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

- Status: done on `main` (closed by explicit user direction so the visual proof and the plan
  updates land in the same scope as QA pass 1).
- Commands:
  - `bun run test packages/shared/src/modules/storage/__tests__/db.test.ts packages/extension/src/background/handlers/__tests__/review-handlers.test.ts packages/extension/src/views/Sidepanel/tabs/__tests__/ChickensTab-interactions.test.tsx packages/extension/src/background/__tests__/dashboard-assembly.test.ts packages/extension/src/views/Sidepanel/tabs/__tests__/RoostFocusSection.test.tsx`
    - Result: 5 files passed, 134 tests passed.
  - `cd packages/extension && bun run build`
    - Result: built `packages/extension/.output/chrome-mv3` cleanly in ~8s.
  - `COOP_E2E_USE_EXISTING_EXTENSION=1 bunx playwright test e2e/visual-next-step-review.spec.cjs --project=desktop --reporter=line`
    - Result: 3 specs passed. Screenshots saved under `e2e/qa-screenshots/next-step-review/`.
- Browser evidence (regenerate via the Playwright command above; screenshots land under
  `e2e/qa-screenshots/next-step-review/` and are intentionally not tracked in git):
  - `01-roost-simple-light.png` — Roost simple mode shows the new `What's Next` heading, plain
    `All caught up.` empty state, and the Signals/Drafts/Fresh look stat strip with no
    `Stale observation` or `Run Agent` framing.
  - `02-roost-simple-dark.png` — Same layout in dark theme.
  - `03-chickens-review-light.png` — Chickens Review segment renders with the redesigned Review and
    Shared subheader pills and the existing roundup permission prompt.
  - `04-chickens-shared-light.png` — Shared segment surfaces the orientation summary card with the
    seeded coop's setup items.
  - `05-nest-advanced-toggle.png` — Nest Settings sub-tab renders the
    `Show advanced controls` field flipped to `On`; advanced-only blocks (Privacy Exclusions,
    Recent Roundups, Nest Setup) appear collapsed below.
  - `06-roost-advanced.png` — After flipping advanced mode, Roost regains the Focus / Agent /
    Garden subtab row.
- Findings:
  - Roost `What's Next` copy in simple mode passes the visual sweep. The Playwright assertions in
    `e2e/visual-next-step-review.spec.cjs` also fail the test if `Run Agent` or
    `Stale observation` ever leak back into the simple-mode surface.
  - Chickens Review/Shared segment switch and the orientation summary card render cleanly in
    light theme with no obvious visual regressions versus the existing baselines.
  - Advanced-mode toggle from Nest Settings restores Roost's Agent and Garden subtabs; the
    operator surface is not lost when uiMode flips.
  - Compact card feedback actions: visual button affordance with seeded review items was not added
    in this pass because the existing `create-coop` seed path does not produce drafts. The unit
    layer in `packages/extension/src/views/Sidepanel/tabs/__tests__/ChickensTab-interactions.test.tsx`
    covers the click-to-record-feedback flow, the dashboard suppression after `not-useful`, and
    the remindAt restoration for `remind-later`.
  - Publish/share/push remain explicit: `packages/extension/src/views/Sidepanel/tabs/ChickensPushControls.tsx`
    surfaces a `Push to <Coop>` button (or per-coop pills) and only invokes
    `draftEditor.publishDraft` / `draftEditor.promoteSignalAndPublish` from a direct user click.

## Residual Risk

- The compact card with seeded review items, including the `Not useful` and `Remind later` button
  affordances, was not captured as a screenshot. Unit coverage is strong, so the residual risk is
  visual-only (density, wrapping, focus rings under populated state).
- `Remind later` still uses a fixed three-day fallback because structured review scheduling does
  not exist in v1; this is documented in `spec.md` and is unchanged by QA pass 2.
- `bun run validate:quick` on `main` continues to fail on unrelated receiver app lint/format drift
  (`packages/app/src/views/Receiver/ReceiverShell.tsx` `lint/a11y/noSvgWithoutTitle` and
  `packages/app/src/styles.css` Biome formatting). These app surfaces are out of scope for this
  feature pack and have an active dirty working tree from other agents; the broader gate stays red
  until those drift issues are addressed in their own lane.
