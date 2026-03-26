# UI Action Coverage Map

This map tracks the test surfaces that now cover popup, sidepanel, persistence, sync, and on-chain action paths. It is intentionally specific about what is covered and what is still missing.

## Popup

| Action class | Unit / integration coverage | Browser E2E coverage | Live probe coverage | Known gaps |
|---|---|---|---|---|
| Roundup / capture-tab state handling | `test:unit:popup-actions` via `packages/extension/src/views/Popup/__tests__/PopupApp.test.tsx`, `packages/extension/src/views/Popup/__tests__/popup-actions.integration.test.tsx`, `packages/extension/src/views/shared/__tests__/useCaptureActions.test.ts`, `packages/extension/src/views/shared/__tests__/capture-preflight.test.ts` | No passing real-browser roundup / active-tab capture coverage yet. The current `test:e2e:popup` suite only proves popup recovery around capture failures; the actual roundup and active-tab browser cases remain `fixme`. | None | Real Chrome popup automation for roundup and active-tab capture is still `fixme` in `e2e/popup-actions.spec.cjs` because a tab-backed `popup.html` session does not faithfully reproduce those dispatch paths yet. |
| Screenshot, file, and audio review/save flows | Same popup unit slice above | `test:e2e:popup` currently proves file review/save, audio denial/retry, and post-failure recovery. Screenshot browser coverage is still skipped in that suite. | None | Browser coverage is smoke-level, not full matrix expansion for every error variant. |
| Popup sync badge semantics | `packages/extension/src/views/Popup/__tests__/PopupApp.test.tsx`, `packages/extension/src/views/Popup/__tests__/popup-sync-status.test.ts` | `test:e2e:sync` via `e2e/sync-resilience.spec.cjs` | None | Browser sync coverage uses runtime-health reporting rather than real signaling fault injection. |

## Sidepanel

| Action class | Unit / integration coverage | Browser E2E coverage | Live probe coverage | Known gaps |
|---|---|---|---|---|
| Create / join coop, publish/share, invite, receiver pairing, archive/settings round-trip | `test:unit:sidepanel-actions` via `packages/extension/src/views/Sidepanel/__tests__/action-persistence.integration.test.tsx`, `packages/extension/src/views/Sidepanel/hooks/__tests__/useDashboard.test.ts` | Existing `test:e2e:receiver-sync` covers receiver publish into multiple coops | None | The new targeted validate slices do not run `test:e2e:receiver-sync` because it is materially heavier and less review-friendly than the new resilience slice. The existing broader `SidepanelApp.test.tsx` coverage is not part of the targeted slice because of the current handler mock-resolution issue. |
| Operator console queue / pass / policy actions | `packages/extension/src/views/Sidepanel/__tests__/operator-console.test.tsx` | None | None | Browser E2E does not yet drive operator console actions end to end. |
| Member smart-account and garden-pass sidepanel actions | `test:unit:onchain-ui` via `packages/extension/src/views/Sidepanel/hooks/__tests__/useSidepanelOnchainActions.test.ts`, `packages/extension/src/views/Sidepanel/__tests__/operator-console.test.tsx` | None | `probe:onchain-live`, `probe:session-key-live` document release-time rehearsal only | Handler-level persistence expansion for these flows remains limited by the current background-handler mock-resolution issue described below. |

## Persistence Seams

| Seam | Coverage | Known gaps |
|---|---|---|
| Popup actions causing dashboard refresh and persisted state re-read | `packages/extension/src/views/Popup/__tests__/popup-actions.integration.test.tsx`, `packages/extension/src/views/Popup/__tests__/PopupApp.test.tsx` | Browser popup smoke does not yet prove roundup/capture-tab persistence in the real Chrome popup path. |
| Sidepanel actions round-tripping through refreshed dashboard state | `packages/extension/src/views/Sidepanel/__tests__/action-persistence.integration.test.tsx` | Background handler persistence tests are not expanded for receiver routing/archive receipts because the current handler test layer resolves through real background context in this Bun/Vitest environment. |
| Outbox and review publish persistence | Existing `packages/extension/src/background/handlers/__tests__/review-handlers.test.ts` | Receiver multi-coop routing still lacks the dedicated handler test originally planned. |

## Sync

| Layer | Coverage | Known gaps |
|---|---|---|
| Shared transport health summaries | `packages/shared/src/modules/coop/__tests__/sync.test.ts`, `packages/shared/src/modules/coop/__tests__/sync-health.test.ts` | None in the deterministic helper layer. |
| Shared receiver replication / malformed payload recovery | `packages/shared/src/modules/receiver/__tests__/sync.test.ts` | None in the deterministic helper layer. |
| Popup / dashboard sync-state semantics | `packages/extension/src/views/Popup/__tests__/popup-sync-status.test.ts`, `packages/extension/src/views/Popup/__tests__/PopupApp.test.tsx`, `packages/extension/src/views/Sidepanel/hooks/__tests__/useDashboard.test.ts` | Sidepanel surfaces do not currently expose dedicated sync status UI beyond the shared dashboard state they consume. |
| Browser sync resilience | `test:e2e:sync` via `e2e/sync-resilience.spec.cjs` | This proves persisted degraded/recovered runtime-health behavior, not true network fault injection or peer reconnect choreography. |
| Browser receiver pair -> intake -> multi-coop publish | Existing `test:e2e:receiver-sync` via `e2e/receiver-sync.spec.cjs` | This suite is heavier than the new targeted sync slice and can take materially longer to run during review. |

## On-Chain

| Capability | Mock-path coverage | Live rehearsal coverage | Known gaps |
|---|---|---|---|
| Passkey -> shared wallet bootstrapping helpers | `packages/shared/src/modules/auth/__tests__/auth-onchain.test.ts` | `probe:onchain-live` | None in helper logic; live deployment remains opt-in. |
| Member smart-account provisioning and Green Goods submissions from sidepanel actions | `packages/extension/src/views/Sidepanel/hooks/__tests__/useSidepanelOnchainActions.test.ts`, `packages/extension/src/views/Sidepanel/__tests__/operator-console.test.tsx` | None directly; release-time confidence comes from `probe:onchain-live` and manual UI rehearsal | No browser E2E currently drives these sidepanel actions through a live or mock wallet surface. |
| Garden-pass issue / revoke / status labeling | `packages/extension/src/views/Sidepanel/hooks/__tests__/useSidepanelOnchainActions.test.ts`, `packages/extension/src/views/Sidepanel/__tests__/operator-console.test.tsx` | `probe:session-key-live` | Full live execution remains limited by missing ERC-7579 support on the current probe Safe deployment path. |

## Validation Slices

- `bun run test:unit:popup-actions`
- `bun run test:unit:sidepanel-actions`
- `bun run test:unit:sync-hardening`
- `bun run test:unit:onchain-ui`
- `bun run test:e2e:popup`
- `bun run test:e2e:sync`
- `bun run validate:popup-slice`
- `bun run validate:sync-hardening`
- `bun run validate:onchain-ui`

## Live Probe Notes

- `bun run probe:onchain-live`
  Proves the shared wallet deployment boundary used by the extension's live shared-wallet mode.
  Success criteria: deployed Safe address, deployment transaction hash, and a final capability message in stdout.
- `bun run probe:session-key-live`
  Phase 1 proves local garden-pass validation, rejection, and revocation semantics that back the extension session-capability UI.
  Phase 2 proves live enable -> execute -> revoke only when the deployed Safe has ERC-7579 support.
  Current limitation: the default Safe deployment path does not install the ERC-7579 adapter, so Phase 2 commonly skips even when Phase 1 passes.

## Residual Risk

- Popup real-browser roundup and active-tab capture remain partially covered because true Chrome action-popup automation is still constrained.
- The planned background handler expansion for receiver sync routing and some persisted archive/member-account seams is still blocked by a pre-existing mock-resolution issue in handler tests.
- Browser sync resilience now covers persisted degraded/recovered runtime health, but not full transport loss and peer reconnection orchestration.
