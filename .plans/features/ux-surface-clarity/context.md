# Context For UX Surface Clarity

## Existing References

- `.plans/README.md`: canonical active feature-pack shape and lane metadata rules.
- `docs/reference/current-release-status.md`: current public-release posture, currently dated
  April 20, 2026 and likely needs a separate release-truth refresh after the May 5 validation run.
- `docs/reference/chrome-web-store-checklist.md`: public-store manual gates, including real Chrome
  popup `Capture Tab` and `Screenshot` checks.
- `.plans/features/production-readiness/`: mock-first release gate and store-readiness context.
- `.plans/features/agent-knowledge-sandbox/`: intelligence substrate that should remain mostly
  behind the default UX.
- `.plans/features/autoresearch/`: state/API/contracts are present, but UI should not ship in the
  default v1 surface.

## Relevant Codepaths

- Preference schema and persistence:
  - `packages/shared/src/contracts/schema-coop.ts`
  - `packages/shared/src/modules/storage/db-crud-coop.ts`
  - `packages/extension/src/background/context-ui.ts`
  - `packages/extension/src/views/Sidepanel/hooks/useDashboard.ts`
- Default sidepanel surfaces:
  - `packages/extension/src/views/Sidepanel/tabs/RoostTab.tsx`
  - `packages/extension/src/views/Sidepanel/tabs/RoostAgentSection.tsx`
  - `packages/extension/src/views/Sidepanel/tabs/RoostKnowledgeSection.tsx`
  - `packages/extension/src/views/Sidepanel/tabs/RoostDecisionHistory.tsx`
  - `packages/extension/src/views/Sidepanel/tabs/RoostGardenSection.tsx`
  - `packages/extension/src/views/Sidepanel/tabs/CoopsTab.tsx`
  - `packages/extension/src/views/Sidepanel/cards/ArchiveReceiptCard.tsx`
- Operator/basic Nest surfaces:
  - `packages/extension/src/views/Sidepanel/tabs/NestTab.tsx`
  - `packages/extension/src/views/Sidepanel/tabs/NestSettingsSection.tsx`
  - `packages/extension/src/views/Sidepanel/tabs/NestMembersSection.tsx`
  - `packages/extension/src/views/Sidepanel/tabs/NestInviteSection.tsx`
  - `packages/extension/src/views/Sidepanel/tabs/NestAutoresearchSection.tsx`
  - `packages/extension/src/views/Sidepanel/tabs/NestSourcesSection.tsx`
- Popup surfaces:
  - `packages/extension/src/views/Popup/PopupProfilePanel.tsx`
  - `packages/extension/src/views/Popup/PopupInviteHubScreen.tsx`
  - `packages/extension/src/views/Popup/PopupInviteCards.tsx`

## Constraints

- Keep this pass hide-don't-remove. Do not delete modules or skills while release gates are green.
- Keep all default public release behavior mock-first unless a separate live-rails pass is
  intentionally started.
- Keep popup changes conservative; the popup is already a relatively clean primary surface.
- Do not introduce package-specific `.env` files, build-time feature flags, or remote config.
- Do not deep import from shared internals.
- Existing persisted preferences must parse safely through defaults.
- Avoid surfacing an agent-management mental model in simple mode.
- The default product should be understandable to a non-technical community/project member, including
  children using Coop for school, hobby, or group projects.

## Notes For Agents

- Product thesis: Coop is a local-first browser assistant for turning scattered knowledge into
  reviewed opportunities and shared memory for your community or project.
- Consumer-AI lesson: do not create another inbox or manager layer. Coop should quietly prepare
  useful work and ask before consequential sharing.
- Permission ladder for v1:
  - Read local/browser context quietly.
  - Suggest what matters.
  - Draft reviewable outputs.
  - Ask before publishing, sharing, archiving, or live actions.
  - Keep autonomous/live rails advanced.
- Claude should focus on UI clarity, render gates, copy, visual consistency, and accessibility.
- Codex should focus on the `uiMode` preference, schema/defaults, persistence, and targeted
  regression tests.
- Shared assumption: advanced mode restores existing capabilities but does not change behavior.
