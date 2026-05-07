# UX Surface Clarity

**Feature**: `ux-surface-clarity`
**Status**: Active
**Source Branch**: `feature/ux-surface-clarity`
**Created**: `2026-05-05`
**Last Updated**: `2026-05-05`

## Summary

Coop is a local-first browser assistant for turning scattered knowledge into reviewed
opportunities and shared memory for your community or project.

The engineering substrate is already release-ready in the mock-first public posture. This feature
compresses the default product surface so Coop feels friendly, focused, and useful without asking
users to manage an agent plane. Advanced rails stay implemented and tested, but they move behind a
single persisted advanced-controls setting.

## Why Now

- Recent validation shows the core loop and release gates are healthy: capture, refine, review,
  share, auth, archive, sync, and mock-first production readiness all read as operational.
- The remaining v1 risk is surface sprawl. Default users can still encounter agent telemetry,
  knowledge graph stats, proof internals, privacy/stealth concepts, source registries, and
  autoresearch controls before the main product mental model has landed.
- The consumer-AI product lesson is clear: useful assistants should reduce management burden. Coop
  should notice and prepare useful work, then ask before consequential sharing or publishing.

## Scope

### In Scope

- Add a persisted UI preference: `uiMode: 'simple' | 'advanced'`, defaulting to `simple`.
- Add one Nest Settings control: "Show advanced controls".
- In simple mode, make the primary sidepanel feel like three jobs:
  - Roost: focus on what needs attention now.
  - Chickens: review drafts and push them.
  - Coops: see what the community or project has saved together.
- Hide or collapse advanced/debug surfaces in simple mode:
  - Roost agent debug surfaces: knowledge stats, recent observation dumps, decision history, and
    agent memories.
  - Roost Garden tab unless the active coop has Green Goods enabled.
  - Coops saved-proof detail card, proof export action, onchain anchor controls, and FVM controls.
  - Nest Agent and Sources tabs.
  - Nest Autoresearch.
  - Nest Settings cards for Privacy Exclusions, Local Helper, Data, and Nest Setup.
  - Nest private payment/stealth address display.
  - Popup agent cadence or other advanced controls if they leak the agent control plane.
- Keep popup layout changes conservative and avoid broad restyling unless an advanced control is
  clearly leaking into the default path.
- Add or update targeted tests for the new preference and render gates.

### Out Of Scope

- No deletion of privacy, stealth, FVM, ERC-8004, autoresearch, or graph modules.
- No dependency changes.
- No new feature-flag service or build-time env split.
- No broad popup redesign.
- No live-rails behavior changes.
- No API server changes.
- No onchain/session/permit/policy contract changes.
- No module-size optimization unless the existing store-readiness gate regresses.

## User-Facing Outcome

- New users see a friendly project/community tool that captures knowledge, prepares drafts, and
  helps the group decide what to keep.
- Coop still works locally by default and keeps publish/share/archive moments explicit.
- Trusted operators can turn on advanced controls in Nest when they need builder surfaces.
- A seven- or ten-year-old should be able to understand the default path: save useful things,
  review what Coop found, and share the good stuff with the group.
- Existing advanced capabilities remain available for builders and future local-AI work.

## Technical Notes

- Primary code surfaces are `@coop/shared` UI preference schema/storage and extension UI render
  gates.
- Use the existing `UiPreferences` path instead of a new settings table:
  - `packages/shared/src/contracts/schema-coop.ts`
  - `packages/shared/src/modules/storage/db-crud-coop.ts`
  - `packages/extension/src/background/context-ui.ts`
  - `packages/extension/src/views/Sidepanel/hooks/useDashboard.ts`
- Main UI surfaces:
  - `packages/extension/src/views/Sidepanel/tabs/RoostTab.tsx`
  - `packages/extension/src/views/Sidepanel/tabs/RoostAgentSection.tsx`
  - `packages/extension/src/views/Sidepanel/tabs/CoopsTab.tsx`
  - `packages/extension/src/views/Sidepanel/tabs/NestTab.tsx`
  - `packages/extension/src/views/Sidepanel/tabs/NestSettingsSection.tsx`
  - `packages/extension/src/views/Sidepanel/tabs/NestMembersSection.tsx`
  - `packages/extension/src/views/Popup/PopupProfilePanel.tsx`
- If implementation needs state and UI in the same branch, keep the diff tightly scoped and call
  out the cross-lane ownership blur in handoff notes.
- Existing settings are parsed through Zod defaults, so adding an optional `uiMode` default should
  preserve existing installs.

## Lane Split

| Lane | Agent | Expected Scope |
|------|-------|----------------|
| UI | Claude | Simple/advanced render gates, settings toggle, conservative popup cleanup, copy polish |
| State | Codex | `UiPreferences.uiMode` schema/defaults/persistence and targeted tests |
| API | Codex | Not applicable |
| Contracts | Codex | Not applicable |
| QA 1 | Codex | State/render-gate regression check and targeted validation |
| QA 2 | Claude | UX, accessibility, visual sweep, and manual core-flow confirmation |

## Acceptance Criteria

- [x] `uiMode` defaults to `simple` for existing and new installs.
- [x] Nest Settings exposes a single "Show advanced controls" toggle that persists through the
  existing `set-ui-preferences` path.
- [x] Simple mode keeps default navigation focused on Roost, Chickens, Coops, and basic Nest
  member/settings workflows.
- [x] Simple mode does not expose agent telemetry, knowledge graph stats, raw proof/CID detail,
  FVM/ERC-8004 affordances, stealth/private payment controls, source registries, autoresearch, or
  local-helper/data-reset/setup internals.
- [x] Advanced mode restores those controls without changing their underlying behavior.
- [x] Popup changes are limited to hiding advanced controls; no broad layout or flow rewrite.
- [x] Targeted tests cover preference defaults and representative simple/advanced render behavior.
- [x] `bun run validate:quick` and `bun run validate:sidepanel-settings` pass at minimum.
- [ ] A final release candidate still clears `bun run validate:public-release`,
  `bun run validate:store-readiness`, and the manual Chrome popup capture/screenshot gate.

## Validation Plan

- Unit: shared storage/schema tests for `uiMode`; UI tests for Nest Settings, Roost, Coops, and
  popup profile render gates.
- Integration: `bun run validate:sidepanel-settings`.
- E2E: use existing public-release/production-readiness gate before submission; do not add a new
  broad E2E unless a rendered flow cannot be covered by targeted tests.
- Manual: load simple mode and advanced mode in the extension, screenshot/inspect Roost, Chickens,
  Coops, Nest, and popup profile. Confirm simple mode has no advanced-language leaks.

## References

- Related docs:
  - `.plans/README.md`
  - `docs/reference/current-release-status.md`
  - `docs/reference/chrome-web-store-checklist.md`
- Relevant files:
  - `packages/shared/src/contracts/schema-coop.ts`
  - `packages/extension/src/background/context-ui.ts`
  - `packages/extension/src/views/Sidepanel/tabs/NestSettingsSection.tsx`
  - `packages/extension/src/views/Sidepanel/tabs/RoostTab.tsx`
  - `packages/extension/src/views/Sidepanel/tabs/RoostAgentSection.tsx`
  - `packages/extension/src/views/Sidepanel/tabs/CoopsTab.tsx`
  - `packages/extension/src/views/Sidepanel/tabs/NestTab.tsx`
  - `packages/extension/src/views/Sidepanel/tabs/NestMembersSection.tsx`
  - `packages/extension/src/views/Popup/PopupProfilePanel.tsx`
- Open questions:
  - Should the Roost Agent sub-tab be hidden in simple mode unless pending approvals exist, or
    always visible as a lightweight "Helper" surface?
  - Should the proof export icon remain in simple mode as a plain "Export" action, or only appear
    in advanced mode with saved-proof detail?
