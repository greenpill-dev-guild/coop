# QA Report For UX Surface Clarity

## QA Pass 1: Codex

- Status: passed after fixing first-pass findings
- Commands:
  - `bun run test packages/extension/src/views/Sidepanel/__tests__/coops-subheader-integration.test.tsx packages/extension/src/views/Sidepanel/tabs/__tests__/RoostTab-subheader.test.tsx packages/extension/src/views/Sidepanel/__tests__/nest-sections.test.tsx packages/extension/src/views/Popup/hooks/__tests__/usePopupOrchestration.test.ts`
  - `bun run test packages/shared/src/modules/storage/__tests__/db.test.ts packages/extension/src/background/__tests__/context.test.ts packages/extension/src/views/Sidepanel/tabs/__tests__/NestSettingsSection-interactions.test.tsx packages/extension/src/views/Sidepanel/tabs/__tests__/RoostTab-interactions.test.tsx packages/extension/src/views/Sidepanel/tabs/__tests__/RoostAgentSection.test.tsx packages/extension/src/views/Sidepanel/tabs/__tests__/CoopsTab-subheader.test.tsx packages/extension/src/views/Popup/__tests__/PopupProfilePanel.test.tsx packages/extension/src/views/Sidepanel/__tests__/coops-subheader-integration.test.tsx packages/extension/src/views/Sidepanel/tabs/__tests__/RoostTab-subheader.test.tsx packages/extension/src/views/Sidepanel/__tests__/nest-sections.test.tsx packages/extension/src/views/Popup/hooks/__tests__/usePopupOrchestration.test.ts`
  - `git diff --name-only -- packages/api packages/contracts packages/shared/src/modules/onchain packages/shared/src/modules/policy packages/shared/src/modules/session packages/shared/src/modules/permit packages/extension/src/background/handlers/session-handlers.ts packages/extension/src/background/handlers/permit-handlers.ts`
  - `bun run validate:sidepanel-settings`
  - `bun run validate:quick`
  - `bun run plans validate`
- Findings:
  - Fixed: simple Nest Settings no longer exposes saved-proof export or Filecoin archive setup.
  - Fixed: popup home no longer exposes Sources or fetches source health in simple mode.
  - Fixed: legacy Coops/Roost tests now assert simple-mode hiding and advanced-mode restoration.
  - Confirmed: API, contracts, onchain, permit, policy, and session paths have no diff.

## QA Pass 2: Claude

- Status: passed after fixing a preference persistence race
- Commands:
  - `bun run test:visual --project=desktop --reporter=line`
  - `node /private/tmp/coop-ux-surface-qa2.cjs`
  - `bun run test packages/extension/src/background/__tests__/context.test.ts`
  - `bun run test packages/shared/src/modules/storage/__tests__/db.test.ts packages/extension/src/background/__tests__/context.test.ts`
  - `bun run test packages/extension/src/views/Sidepanel/tabs/__tests__/NestSettingsSection-interactions.test.tsx packages/extension/src/views/Sidepanel/tabs/__tests__/RoostTab-interactions.test.tsx packages/extension/src/views/Sidepanel/tabs/__tests__/RoostAgentSection.test.tsx packages/extension/src/views/Sidepanel/tabs/__tests__/CoopsTab-subheader.test.tsx packages/extension/src/views/Popup/__tests__/PopupProfilePanel.test.tsx packages/extension/src/views/Sidepanel/__tests__/coops-subheader-integration.test.tsx packages/extension/src/views/Sidepanel/tabs/__tests__/RoostTab-subheader.test.tsx packages/extension/src/views/Sidepanel/__tests__/nest-sections.test.tsx packages/extension/src/views/Popup/hooks/__tests__/usePopupOrchestration.test.ts`
  - `bun run validate:sidepanel-settings`
  - `bun run validate:quick`
- Findings:
  - Fixed: Nest Settings could send an advanced-mode `set-ui-preferences` message while repeated
    background default hydration kept the UI reading `uiMode: 'simple'`. UI preference hydrate/save
    operations are now serialized, and default seeding is idempotent for the service-worker
    lifetime.
  - Confirmed: simple mode hides Roost Agent/Garden, Coops proof export, Nest Agent/Sources, Nest
    proof/Filecoin/Privacy/Local Helper/Data/Setup controls, popup Sources, and popup Agent Cadence.
  - Confirmed: advanced mode restores Nest Agent/Sources, Nest Settings advanced controls, Roost
    Agent/Garden, Coops Export Proof, popup Sources, and popup Agent Cadence without changing the
    underlying behavior.
  - Confirmed: advanced `uiMode` persists across sidepanel reload after using the Nest Settings
    toggle.
  - Note: `bun run test:visual --project=desktop --reporter=line` is not currently usable as a
    clean QA gate because the existing suite has missing committed screenshot baselines plus stale
    locator/role assumptions in popup and sidepanel visual specs. The focused browser probe covered
    this feature's visual/interaction gates instead.

## Residual Risk

- Release-candidate validation still needs the broader public-release/store-readiness gates before
  submission.
- The broad visual snapshot suite should be refreshed separately before using it as a release gate.
