# QA Report

## Phase 1 Integration Status

All four Phase 1 lanes merged to main. One test fix required post-merge (mock provider
missing `.on()` in new sync health aggregation test).

### State Lane

- Green Goods: popup create no longer auto-enables; both paths require explicit opt-in
- Passkey: trust explainer copy added to create/join flows
- Metadata: favicon + socialPreviewImageUrl survive capture → review pipeline
- New helper: `resolvePreviewCardImageUrl()` for UI fallback
- Tests: targeted Vitest passed; popup E2E sandbox-only failure (Chromium SIGABRT)

### API Lane

- Sync health: aggregated across all bound coops (degraded no longer masked by healthy)
- Invites: stale state cleared on revoke; receiver pairing marked active immediately
- Tests: new `useSidepanelInvites.test.ts` + extended sync health coverage

### Contracts Lane

- Archive: Filecoin registration blocked unless receipt is truly live + real registry config
- FVM: centralized registry-address resolution with operator checklist when incomplete
- UI: "Register on Filecoin" action hidden unless onchain mode is live
- Probe: archive-live requires real env; fallback only via `COOP_ALLOW_ARCHIVE_PROBE_FALLBACK=true`
- Tests: 43/43 focused tests passed
- Blocked: `validate:production-readiness` stops on pre-existing Biome lint failures in unrelated
  files — not a regression from this lane

### Docs Lane

- Landing: topbar nav with Install Extension CTA + footer links
- Install docs: 4-command fastest-path, clearer dev/zip distribution
- Demo: 7-beat storyboard (~7 min)
- Narrative: four bets, tenets, monetization — all marked provisional
- Verified: `docs:build` + `app build` passed

## Codex QA Pass

- Status: blocked (Phase 3)
- Commands run:
- Result:
- Blockers:
- Residual risks:

## Claude QA Pass

- Status: blocked (Phase 3)
- Manual flow checked:
- Result:
- Blockers:
- Nice-to-have polish:

## Release Decision

- Mock-first release candidate:
- Live-demo path:
- Notes:
