# Coop Handover Report

Date: 2026-03-28
Repo: `/Users/afo/Code/greenpill/coop`
Mode: mock-first release readiness

## Final Status

The mock-first automated release bar is green.

- Coverage now meets repo thresholds.
- `bun run build` passes.
- `bun run validate:store-readiness` passes.
- `bun run validate:production-readiness` passes.
- Live onchain/archive/session rails remain intentionally gated behind a second release bar.

The remaining release work is now human verification in real Chrome for popup permission-sensitive
flows, plus the separate live-rails gate.

## Exact Validation Results

### Required path

- `bun run test`
  - passed
  - `218` test files
  - `2576` tests
  - duration: `144.78s`

- `bun run test:coverage`
  - passed
  - `218` test files
  - `2576` tests
  - duration: `422.91s`
  - statements: `85.03%`
  - lines: `85.03%`
  - functions: `85.17%`
  - branches: `76.13%`

- `bun run build`
  - passed
  - app build time observed in this pass: `6.68s` to `9.41s`
  - extension build time observed in this pass: `20.3s` to `24.7s`
  - extension output total size: `116.83 MB`

- `bun run validate:store-readiness`
  - passed
  - Chrome Web Store audit passed
  - dist size: `52.04 MB`
  - `background.js`: `498.25 kB / 700.00 kB`
  - `chunks/transformers-*.js`: `869.21 kB / 1.00 MB`
  - `chunks/webllm-*.js`: `5.89 MB / 6.50 MB`
  - `assets/ort-wasm-simd-threaded.jsep.wasm`: `21.60 MB / 25.00 MB`
  - receiver origins: `https://coop.town/*`

- `COOP_PLAYWRIGHT_APP_PORT=3312 COOP_PLAYWRIGHT_API_PORT=4446 bun run validate:production-readiness`
  - passed
  - initial rerun without overrides failed only because local port `127.0.0.1:4445` was already in use
  - override resolved the workstation conflict without code changes

## What Changed In This Pass

### Source fixes

- Fixed duplicate `createdDraftIds` accumulation in
  `packages/extension/src/runtime/agent-output-handlers.ts`.
- Fixed receiver blob/encrypted-payload migration behavior in
  `packages/shared/src/modules/storage/db-crud-receiver.ts` so legacy payloads are preserved
  correctly during migration paths.
- Added loader injection seam in `packages/shared/src/modules/transcribe/loader.ts` to make the
  transformer availability path testable without changing runtime behavior.

### Coverage work

Added high-signal tests across the release-critical surfaces called out in the handoff:

- app hooks
  - `packages/app/src/hooks/__tests__/useCapture.behavior.test.ts`
  - `packages/app/src/hooks/__tests__/useReceiverSettings.behavior.test.ts`
  - `packages/app/src/hooks/__tests__/useReceiverSync.behavior.test.ts`
- receiver UI
  - `packages/app/src/views/Receiver/__tests__/receiver-view-actions.test.tsx`
- extension runtime
  - `packages/extension/src/runtime/__tests__/agent-output-handlers.test.ts`
- popup
  - `packages/extension/src/views/Popup/hooks/__tests__/usePopupDraftHandlers.test.ts`
- sidepanel UI and hooks
  - `packages/extension/src/views/Sidepanel/__tests__/agent-observations-section.test.tsx`
  - `packages/extension/src/views/Sidepanel/__tests__/archive-setup-wizard.test.tsx`
  - `packages/extension/src/views/Sidepanel/__tests__/cards-coverage.test.tsx`
  - `packages/extension/src/views/Sidepanel/__tests__/coop-switcher.test.tsx`
  - `packages/extension/src/views/Sidepanel/__tests__/green-goods-action-cards.test.tsx`
  - `packages/extension/src/views/Sidepanel/__tests__/knowledge-skills-section.test.tsx`
  - `packages/extension/src/views/Sidepanel/hooks/__tests__/useDraftEditor-actions.test.ts`
  - `packages/extension/src/views/Sidepanel/hooks/__tests__/useSidepanelActions.test.ts`
  - `packages/extension/src/views/Sidepanel/hooks/__tests__/useSidepanelAgent.test.ts`
  - `packages/extension/src/views/Sidepanel/hooks/__tests__/useSidepanelCoopManagement.test.ts`
  - `packages/extension/src/views/Sidepanel/hooks/__tests__/useSidepanelDrafts.test.ts`
  - `packages/extension/src/views/Sidepanel/hooks/__tests__/useSidepanelGreenGoods.test.ts`
  - `packages/extension/src/views/Sidepanel/hooks/__tests__/useSyncBindings.test.ts`
  - `packages/extension/src/views/Sidepanel/hooks/__tests__/useTabCapture.test.ts`
  - `packages/extension/src/views/shared/__tests__/useCoopActions.test.ts`
- shared
  - `packages/shared/src/modules/storage/__tests__/db-maintenance.test.ts`
  - `packages/shared/src/modules/transcribe/__tests__/loader.test.ts`

### Coverage outcome against the previously weak targets

- `packages/app/src/hooks/useCapture.ts`: materially improved coverage, no threshold blocker remains
- `packages/app/src/hooks/useReceiverSync.ts`: materially improved from the prior handoff baseline
- `packages/extension/src/runtime/agent-output-handlers.ts`: high-signal behavior now covered
- `packages/shared/src/modules/storage/db-maintenance.ts`: high coverage
- `packages/shared/src/modules/transcribe/loader.ts`: high coverage

## Manual QA Still Required In Real Chrome

Automation now proves the popup happy-path shell, roundup flows, file review/save, audio retry, and
failure recovery. The remaining human gate is Chrome permission behavior that automation cannot
faithfully reproduce.

### Required popup checklist

1. Load the unpacked release build in Chrome.
2. Open a normal `https://` page, then real-click popup `Capture Tab`.
   - confirm the save succeeds
   - confirm the resulting review/save flow lands in the expected popup or sidepanel state
3. Open a normal `https://` page, then real-click popup `Screenshot`.
   - confirm the save succeeds
   - confirm the resulting review/save flow lands in the expected popup or sidepanel state
4. Trigger popup `Roundup Chickens` on a profile that has not yet granted broad webpage access.
   - confirm the Chrome host-permission prompt appears
   - confirm accept path works
   - confirm deny path shows the expected message:
     `Coop needs webpage access to round up and capture standard sites.`
5. Trigger popup microphone recording from a fresh profile.
   - deny microphone once and confirm inline recovery copy appears
   - retry and allow microphone access
   - confirm the recorded voice note saves successfully
6. Confirm popup capture guards still reject unsupported pages with the expected copy.
   - `Capture Tab`: `Open a standard web page before capturing this tab.`
   - `Screenshot`: `Open a standard web page before taking a screenshot.`

### Why this still needs a human

- Popup `activeTab` grants are not reproduced reliably when the popup is opened programmatically.
- Chrome permission prompts for webpage access and microphone access are browser-owned UI and are
  only partially simulated in automation.

## Extension Build Bottleneck Review

No build-graph refactor was shipped in this pass.

That was deliberate. The current build is heavy, but the release budgets now pass, and the obvious
optimization paths would change packaging behavior close to the release line.

### Current evidence

- WXT extension build time during this pass stayed around `20s` to `25s`.
- The current build is dominated by local-model/runtime assets:
  - `agent-webllm-worker.js`: `6 MB`
  - `chunks/webllm-*.js`: `5.89 MB`
  - `inference-worker.js`: `895.99 kB`
  - `chunks/transformers-*.js`: `869.21 kB`
  - `assets/ort-wasm-simd-threaded.jsep.wasm`: `21.60 MB`
- Vite still reports that `background/handlers/capture.ts` and `background/handlers/actions.ts`
  are both statically and dynamically imported, so the intended lazy split does not currently
  materialize.

### Assessment

- Build time is still a quality-of-life issue for iteration.
- Build time is not the blocking release risk anymore.
- The safer release choice in this pass was to keep the passing packaging shape intact and document
  the build graph debt instead of forcing a late chunking change.

### Recommended post-release follow-up

1. Decide whether `capture.ts` and `actions.ts` should be fully eager or fully lazy in the
   background graph.
2. Audit why the ONNX wasm asset appears multiple times in the raw output listing and confirm
   whether that is a packaging duplication or only repeated reporting.
3. Revisit worker/model chunking only after a separate verification pass, because these assets sit
   on the critical local-AI path.

## Remaining Risks

### Not a blocker for mock-first release

- Real Chrome popup permission QA is still outstanding.
- Extension build time is still heavier than ideal.

### Still a deliberate blocker

- Live onchain rails
- Live archive delegation
- Live session-key execution

Those remain a second gate and should not be enabled by default for this release candidate.

## Recommended Next Actions

1. Run the real-Chrome popup checklist above on the unpacked release build.
2. Record the exact result of each permission path in release notes or QA notes.
3. Keep `VITE_COOP_ONCHAIN_MODE`, `VITE_COOP_ARCHIVE_MODE`, and `VITE_COOP_SESSION_MODE` on the
   mock-first release path for any public-store candidate.
4. Treat build-graph optimization as the next focused hardening pass, not a release-line tweak.

## Release Readiness Call

- Internal use: ready
- Private pilot: ready
- Public Chrome Web Store release: ready after the manual Chrome popup checklist is completed
- Live onchain/archive/session release: not ready
