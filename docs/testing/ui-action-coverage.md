---
title: "UI Action Coverage Map"
slug: /testing/ui-action-coverage
---

# UI Action Coverage Map

This map tracks the real test surfaces that cover popup, sidepanel, persistence, sync, and
on-chain action paths. It is intentionally specific about what is browser-covered, what is
unit-covered, and what still needs manual or live rehearsal.

## Popup

| Action class | Unit / integration coverage | Browser E2E coverage | Live probe coverage | Known gaps |
|---|---|---|---|---|
| Real popup roundup into drafts | `test:unit:popup-actions` via `packages/extension/src/views/Popup/__tests__/PopupApp.test.tsx`, `packages/extension/src/views/Popup/__tests__/popup-actions.integration.test.tsx`, `packages/extension/src/views/shared/__tests__/useCaptureActions.test.ts`, `packages/extension/src/views/shared/__tests__/capture-preflight.test.ts`, `packages/extension/src/views/Popup/hooks/__tests__/usePopupRecording.test.ts`, and `packages/extension/src/views/Popup/hooks/__tests__/usePopupOrchestration.test.ts` | `test:e2e:popup` proves real action-popup roundup into popup drafts. | None | Successful popup `Capture Tab` still depends on manual verification because automation does not receive the same popup `activeTab` grant as a real user click. |
| Capture-tab and screenshot manual gates | Same popup unit slice above | `test:e2e:popup` proves the exact popup-surface manual-gate copy for `Capture Tab` and `Screenshot`, and also proves the exact screenshot permission error when automation lacks a real popup `activeTab` grant. | None | Successful screenshot save from the real popup is still manual-only for the same Chromium permission reason. |
| File review/save, audio denial retry, and post-failure recovery | Same popup unit slice above | `test:e2e:popup` proves file review cancel/save, microphone denial plus retry, and that the popup remains usable after a failed capture action. | None | Browser coverage is smoke-level, not an exhaustive matrix of every review variant. |
| Popup sync badge semantics | `packages/extension/src/views/Popup/__tests__/PopupApp.test.tsx` and `packages/extension/src/views/Popup/__tests__/popup-sync-status.test.ts` | `test:e2e:sync` via `e2e/sync-resilience.spec.cjs` proves degraded and recovered sync status across popup reopen. | None | Browser sync coverage uses persisted runtime-health reporting rather than real signaling fault injection. |

## Sidepanel

| Action class | Unit / integration coverage | Browser E2E coverage | Live probe coverage | Known gaps |
|---|---|---|---|---|
| Create / join coop, publish/share, invite, board/archive handoff | `test:unit:sidepanel-actions` via `packages/extension/src/views/Sidepanel/__tests__/action-persistence.integration.test.tsx`, `packages/extension/src/views/Sidepanel/hooks/__tests__/useDashboard.test.ts`, and `packages/extension/src/views/Sidepanel/hooks/__tests__/useSidepanelOrchestration.test.ts` | `test:e2e:extension` covers create/join, publish, and board/archive handoff. | None | The full sidepanel surface is still larger than the browser slice, so some non-critical UI branches remain unit-only. |
| Receiver pair -> intake -> multi-coop publish | `test:unit:sync-hardening` covers receiver runtime state and invite persistence through `packages/extension/src/runtime/__tests__/receiver.test.ts` and `packages/extension/src/background/handlers/__tests__/receiver-invite-handlers.test.ts` | `test:e2e:receiver-sync` covers pairing, private intake sync, sidepanel-closed runtime, and multi-coop publish. | None | This is a heavier browser suite and is not a substitute for true network-fault choreography. |
| Operator console trusted-helper loop | `packages/extension/src/views/Sidepanel/__tests__/operator-console.test.tsx`, `test:unit:agent-loop`, and `test:unit:onchain-ui` | `test:e2e:agent-loop` covers the focused trusted-helper run loop. `test:e2e:extension` also exercises the same `@agent-loop` slice inside the broader extension flow. | None | Browser E2E does not drive every operator policy branch end to end. |
| Member smart-account provisioning and garden-pass issuance | `test:unit:onchain-ui` via `packages/extension/src/views/Sidepanel/hooks/__tests__/useSidepanelOnchainActions.test.ts`, `packages/extension/src/views/Sidepanel/__tests__/operator-console.test.tsx`, and `packages/extension/src/background/handlers/__tests__/member-account-handlers.test.ts` | `test:e2e:extension` now drives mock-path member-account provisioning and garden-pass issuance in the real sidepanel. | `probe:onchain-live`, `probe:session-key-live` | Live wallet and live Smart Session execution remain opt-in and are not part of the default browser release slice. |

## Persistence Seams

| Seam | Coverage | Known gaps |
|---|---|---|
| Popup actions causing dashboard refresh and persisted state re-read | `packages/extension/src/views/Popup/__tests__/popup-actions.integration.test.tsx` and `packages/extension/src/views/Popup/__tests__/PopupApp.test.tsx` | Browser popup smoke now proves real-popup roundup creates drafts. Successful popup active-tab and screenshot saves still rely on unit coverage plus manual verification. |
| Receiver invite persistence and member-scoped receiver visibility | `test:unit:sync-hardening` via `packages/extension/src/runtime/__tests__/receiver.test.ts`, `packages/extension/src/background/handlers/__tests__/receiver-invite-handlers.test.ts`, and `packages/extension/src/views/Sidepanel/hooks/__tests__/useDashboard.test.ts` | True peer reconnect and transport churn are still heavier than the deterministic test layer. |
| Archive receipt recovery, attachment upload reconciliation, and archive-config UI state | `test:unit:archive-hardening` via `packages/extension/src/background/handlers/__tests__/archive-handlers.test.ts` and `packages/extension/src/views/Sidepanel/__tests__/archive-config-ui.test.ts` | No full browser E2E drives the live archive delegation path. Mock-path archive confidence still comes from unit tests plus the board/archive browser handoff. |
| Green Goods member-account state surviving Yjs serialization | `packages/shared/src/modules/coop/__tests__/sync.test.ts` now asserts `memberAccounts` round-trip through coop doc encoding. `test:e2e:extension` then proves the sidepanel can provision the account and issue a garden pass against persisted state. | Live member-account execution is still opt-in through the live probes, not part of the default release gate. |

## Sync

| Layer | Coverage | Known gaps |
|---|---|---|
| Shared transport health summaries | `packages/shared/src/modules/coop/__tests__/sync.test.ts` and `packages/shared/src/modules/coop/__tests__/sync-health.test.ts` | None in the deterministic helper layer. |
| Shared receiver replication and malformed payload recovery | `packages/shared/src/modules/receiver/__tests__/sync.test.ts` | None in the deterministic helper layer. |
| Popup and dashboard sync-state semantics | `packages/extension/src/views/Popup/__tests__/popup-sync-status.test.ts`, `packages/extension/src/views/Popup/__tests__/PopupApp.test.tsx`, and `packages/extension/src/views/Sidepanel/hooks/__tests__/useDashboard.test.ts` | Sidepanel surfaces do not expose a richer dedicated sync UI than the shared dashboard state they consume. |
| Browser sync resilience | `test:e2e:sync` via `e2e/sync-resilience.spec.cjs` | This proves persisted degraded and recovered runtime-health behavior, not real signaling loss or peer reconnect choreography. |
| Browser receiver pair -> intake -> multi-coop publish | `test:e2e:receiver-sync` via `e2e/receiver-sync.spec.cjs` | This suite is intentionally heavier than the targeted sync slice and still does not simulate every signaling failure mode. |

## On-Chain

| Capability | Mock-path coverage | Live rehearsal coverage | Known gaps |
|---|---|---|---|
| Passkey -> shared wallet bootstrapping helpers | `packages/shared/src/modules/auth/__tests__/auth-onchain.test.ts` | `probe:onchain-live` | None in helper logic. Live deployment remains opt-in. |
| Member smart-account provisioning from sidepanel actions | `packages/extension/src/views/Sidepanel/hooks/__tests__/useSidepanelOnchainActions.test.ts`, `packages/extension/src/views/Sidepanel/__tests__/operator-console.test.tsx`, and `packages/extension/src/background/handlers/__tests__/member-account-handlers.test.ts` | `test:e2e:extension` covers the mock-path browser flow. `probe:onchain-live` covers the live shared-wallet boundary. | Full live wallet execution is intentionally outside default release automation. |
| Garden-pass issue / revoke / status labeling | `packages/extension/src/views/Sidepanel/hooks/__tests__/useSidepanelOnchainActions.test.ts` and `packages/extension/src/views/Sidepanel/__tests__/operator-console.test.tsx` | `test:e2e:extension` covers mock-path issuance. `probe:session-key-live` covers live rehearsal when the Safe supports the required modules. | Full live execution can still skip when the probe Safe lacks ERC-7579 support. |
| Trusted-node archive delegation and follow-up | `test:unit:archive-live` and `packages/extension/src/background/handlers/__tests__/archive-handlers.test.ts` | `probe:archive-live` | No full browser E2E currently drives the live archive delegation path. |
| Filecoin / FVM registry registration | `packages/shared/src/modules/fvm/__tests__/fvm.test.ts` and `packages/shared/src/modules/fvm/__tests__/schema.test.ts` | None | The deployment map is not populated in repo, and runtime registration still depends on operator-controlled signing material. |

## Validation Slices

- `bun run test:unit:popup-actions`
- `bun run test:unit:sidepanel-actions`
- `bun run test:unit:archive-hardening`
- `bun run test:unit:sync-hardening`
- `bun run test:unit:onchain-ui`
- `bun run test:unit:agent-loop`
- `bun run test:e2e:popup`
- `bun run test:e2e:sync`
- `bun run validate:store-readiness`
- `bun run validate:production-readiness`
- `bun run validate:production-live-readiness`

## Live Probe Notes

- `bun run probe:onchain-live`
  Proves the shared-wallet deployment boundary used by the extension's live shared-wallet mode.
- `bun run probe:session-key-live`
  Phase 1 proves local garden-pass validation, rejection, and revocation semantics that back the
  session-capability UI. Phase 2 proves live enable -> execute -> revoke only when the deployed
  Safe has ERC-7579 support.
- `bun run probe:archive-live`
  Proves trusted-node archive delegation material can be issued for a live archive configuration.

## Residual Risk

- Popup roundup and popup failure states are browser-covered, but successful popup `Capture Tab`
  and `Screenshot` saves still require manual verification because Chrome does not grant popup
  `activeTab` in the same way under automation.
- Browser sync resilience now covers persisted degraded and recovered runtime health, but not full
  transport loss and peer reconnection orchestration.
- Live Smart Session execution can still be partially blocked by missing ERC-7579 support on the
  probe Safe.
- Live archive delegation and Filecoin registry registration remain operator-facing paths rather
  than default browser release checks.
