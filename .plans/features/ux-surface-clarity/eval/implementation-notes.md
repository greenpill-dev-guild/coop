# Implementation Notes For UX Surface Clarity

## What Changed

- Added persisted `uiMode: 'simple' | 'advanced'` to `UiPreferences`, defaulting to `simple`
  through the existing Zod/Dexie/chrome storage sync path.
- Added a Nest Settings "Show advanced controls" preference that writes through
  `set-ui-preferences`.
- Gated advanced sidepanel and popup surfaces in simple mode:
  - Roost hides the agent-management sub-tab unless approvals need attention, hides agent
    telemetry/debug content, and hides Garden unless Green Goods is enabled.
  - Coops hides proof export and saved-proof detail cards, which also hides onchain anchor and FVM
    affordances from the default view.
  - Nest hides Agent, Sources, Autoresearch, Privacy Exclusions, Local Helper, Data, Nest Setup, and
    stealth/private payment details.
  - Popup profile hides Agent Cadence.
- Added targeted state/background and render-gate tests for defaulting, advanced round-trip, and
  representative simple/advanced UI behavior.
- Serialized background UI preference hydrate/save operations and made default seeding idempotent
  so the Nest Settings toggle cannot be overwritten by concurrent dashboard hydration.

## Tradeoffs

- Simple mode still exposes pending agent approvals in Roost when they require user judgment. The
  full heartbeat, knowledge graph, observation, decision-history, and memory surfaces stay advanced.
- Recent Roundups remain visible in Settings because they explain ordinary capture behavior, while
  privacy exclusion configuration and local-helper internals are advanced.
- State and UI lanes landed in the same implementation pass by user request; no API, contracts,
  onchain, permit, policy, or session behavior was changed.
- The QA pass 2 browser probe found the preference race only after driving the built extension in
  Chromium; unit render gates alone did not expose the message-traffic timing issue.

## Validation

- `bun run test packages/shared/src/modules/storage/__tests__/db.test.ts packages/extension/src/background/__tests__/context.test.ts`
- `bun run test packages/extension/src/views/Sidepanel/tabs/__tests__/NestSettingsSection-interactions.test.tsx packages/extension/src/views/Sidepanel/tabs/__tests__/RoostTab-interactions.test.tsx packages/extension/src/views/Sidepanel/tabs/__tests__/RoostAgentSection.test.tsx packages/extension/src/views/Sidepanel/tabs/__tests__/CoopsTab-subheader.test.tsx packages/extension/src/views/Popup/__tests__/PopupProfilePanel.test.tsx`
- `bun run validate:sidepanel-settings`
- `bun run validate:quick`
- `node /private/tmp/coop-ux-surface-qa2.cjs`

## Follow-Ups

- QA pass 1 performed a second source/readback check that API/contracts/onchain/permit/policy paths
  stayed untouched, and fixed the remaining simple-mode leaks found during review.
- QA pass 2 completed the browser/visual sweep for simple and advanced mode.
- Separately refresh release-truth docs after the next full public-release validation run.
- Separately refresh the broad visual snapshot suite; current missing baselines and stale locators
  make it unsuitable as a clean release signal.
