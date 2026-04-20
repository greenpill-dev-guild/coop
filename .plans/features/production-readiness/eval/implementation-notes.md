# Implementation Notes

## 2026-03-27

- Created the production-readiness feature pack.
- Initial blocker set:
  - lint failures stop `validate:production-readiness`
  - popup screenshot-review save flow is flaky
  - coverage scope does not include enough release-critical UI
  - live-rails env contract is incomplete for promotion
- Stabilized the popup and receiver test surfaces that were failing or flaking under coverage:
  - cleared persisted browser storage between popup integration tests
  - replaced slow typing paths with direct input events in the screenshot review and operator flows
  - widened async waits where coverage instrumentation exposed legitimate latency
  - fixed `usePersistedPopupState` so mocked `chrome.storage.local.set` values are handled safely
- Cleared the lint gate:
  - removed the `useMemo` dependency trap in `usePopupOrchestration.ts`
  - fixed the `heartbeat.ts` template-literal lint issue
  - fixed workspace formatting drift
- Broadened release-critical coverage in `vitest.config.ts`:
  - include `packages/extension/src/views/**/*.{ts,tsx}`
  - stop excluding `packages/app/src/views/**`
  - disable file parallelism while coverage is enabled to avoid the `.tmp/coverage-0.json` race
- Updated release documentation so staged launch and live-rails promotion are separate gates:
  - `docs/reference/demo-and-deploy-runbook.md`
  - `docs/reference/chrome-web-store-checklist.md`
- Validation outcomes on this pass:
  - `bun run plans:validate` passed
  - `bun run lint` passed
  - targeted popup, sidepanel, app, runtime, and shared coverage regressions were repaired
  - `bun run test:coverage` completed all assertions: `195` files passed, `2484` tests passed
  - coverage thresholds failed after the broader UI scope was included:
    - statements: `77.29%` vs required `85%`
    - branches: `76.41%` vs required `85%`
    - functions: `77.57%` vs required `85%`
    - lines: `77.29%` vs required `85%`
- Outcome:
  - staged launch remains blocked on insufficient release-critical coverage
  - Claude UI handoff is not justified yet because the Codex stabilization gate is still red

## 2026-04-01

- Repaired the app-side baseline regressions that were breaking the current branch:
  - wrapped the landing page with its own `I18nProvider` and restored compatibility with both
    `devEnvironment` and `devEnvironmentState` props
  - aligned the landing route in `packages/app/src/app.tsx` with the updated landing component
  - fixed app test drift in receiver/capture hooks where mocks no longer matched the stricter
    runtime contracts
- Cleared the initial red-path tests:
  - `packages/app/src/__tests__/Landing.test.tsx` now passes after updating the footer assertions to
    the current product surface
  - `packages/extension/src/background/handlers/__tests__/session-execution.test.ts` now matches
    the current live install path that uses `sendSmartAccountTransactionWithCoopGasFallback`
  - `bun run test:e2e:app` passes again after replacing the brittle duplicate-text selector with a
    footer-scoped assertion
- Stabilized extension fixture contracts to reduce type drift at the source:
  - added extension test factories for `AuthSession`, `UiPreferences`, and runtime config
  - made `makeCoopState` accept nested partial overrides for `profile`, `onchainState`,
    `syncRoom`, and `memoryProfile`
  - updated default dashboard fixtures to current `providerMode`, auth-session, and recent-capture
    shapes
- Fixed several source-level contract drifts uncovered by typecheck:
  - expanded `SidepanelIntentSegment` to include the segments the UI already routes to
  - narrowed `promote-signal-to-draft` to `ReviewDraft['category']`
  - updated ritual-review eligibility to use `workflowStage === 'ready'` instead of impossible
    draft statuses
  - tightened archive receipt witness typing in shared archive code
- Validation outcomes on this pass:
  - targeted landing + session tests: `27 passed`
  - `bun run test:e2e:app`: `3 passed, 1 skipped`
  - `bun run build`: previously green and still not touched by the app fixes
  - `bun run validate:store-readiness`: previously green and still the right staged-launch budget
    signal
  - `bun run validate:typecheck`: still red, but now concentrated mainly in extension test-fixture
    drift plus a smaller set of popup/runtime harness mismatches
- Current blocker buckets:
  - extension tests still hardcode legacy shapes for auth sessions, coop state, invite/bootstrap,
    Green Goods garden data, and inference-bridge mocks
  - some popup/runtime test harnesses still rely on over-narrow local types that collapse to
    `never`
  - a few remaining source-adjacent issues are still mixed into the test backlog, notably archive
    receipt follow-up typing and popup form handler assumptions
- Recommended next execution order:
  - finish the shared test-factory sweep for Green Goods, receiver, and popup harnesses
  - clear the remaining source-adjacent type errors before widening into lower-priority test files
  - rerun `bun run validate:typecheck`, then `bun run test`, then `bun run validate quick`
  - return to the staged-launch coverage gate only after the baseline is green again

## 2026-04-09

- Normalized the release-truth metadata around this pack so the plan files and docs all say the
  same thing again.
- Updated `docs/reference/current-release-status.md`,
  `docs/reference/testing-and-validation.md`, `docs/reference/demo-and-deploy-runbook.md`, and
  `docs/reference/chrome-web-store-checklist.md` to reflect the current blocked staged-launch bar
  instead of the older green claim from March 28, 2026.
- Marked the contracts lane as done for this pack because the staged-vs-live release contract is
  now explicitly documented again. The state lane remains the active blocker because the automated
  staged-launch bar is still red on coverage and broader production-readiness validation.

## 2026-04-19 Post-hardening reconciliation

- Hardening commit 484078d expanded agent-runtime + shared-policy coverage substantially (agent
  runner, provider contracts, release gates, trace records, risk-tag propagation, autoresearch QA
  state, graph persistence). This addresses known coverage gaps in extension runtime and shared
  policy, but it does not change the staged-launch posture: the release-critical gap called out in
  `docs/reference/current-release-status.md` and `eval/qa-report.md` sits in `packages/app`
  hooks and `packages/extension/src/views/Sidepanel/**`, not in runtime code.
- `bun run validate quick` and `bun run validate smoke` are green on `main` after 484078d.
  `bun run test:coverage` was not re-run during this reconciliation; the staged-launch gate stays
  `blocked` until coverage is rerun on the broadened Sidepanel + app-hook scope.
- Lane flips: none. `state` lane stays `blocked` because the coverage gate has not been re-measured
  and no Sidepanel/app-hook tests were added specifically for the broadened coverage scope. Do not
  green `current-release-status.md` until coverage is re-measured.
- Canonical blocker set is unchanged: app hooks + Sidepanel codepaths still need coverage, live
  rails remain a separate second gate.
