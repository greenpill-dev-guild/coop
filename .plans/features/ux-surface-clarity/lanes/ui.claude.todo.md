---
feature: ux-surface-clarity
title: UX Surface Clarity UI lane
lane: ui
agent: claude
status: done
source_branch: feature/ux-surface-clarity
work_branch: claude/ui/ux-surface-clarity
depends_on:
  - ../spec.md
skills:
  - ui
  - react
  - accessibility
owned_paths:
  - packages/extension/src/views/Sidepanel/tabs
  - packages/extension/src/views/Sidepanel/cards
  - packages/extension/src/views/Popup
handoff_out: handoff/qa-codex/ux-surface-clarity
updated: 2026-05-05
---

# UI Lane

## Objective

Compress the default extension surface around capture, review, focus, sharing, members, and basic
settings. Hide advanced rails and debug/operator controls behind `uiMode === 'advanced'`.

Keep file ownership tight. If work spills into state/api/contracts surfaces without an explicit
handoff, stop and call it out in `Handoff Notes`.

## Files

- `packages/extension/src/views/Sidepanel/tabs/RoostTab.tsx`
- `packages/extension/src/views/Sidepanel/tabs/RoostAgentSection.tsx`
- `packages/extension/src/views/Sidepanel/tabs/CoopsTab.tsx`
- `packages/extension/src/views/Sidepanel/cards/ArchiveReceiptCard.tsx`
- `packages/extension/src/views/Sidepanel/tabs/NestTab.tsx`
- `packages/extension/src/views/Sidepanel/tabs/NestSettingsSection.tsx`
- `packages/extension/src/views/Sidepanel/tabs/NestMembersSection.tsx`
- `packages/extension/src/views/Popup/PopupProfilePanel.tsx`
- Targeted tests under `packages/extension/src/views/Sidepanel/tabs/__tests__` and
  `packages/extension/src/views/Popup/__tests__`

## Tasks

- [x] Read existing Sidepanel/Popup component patterns before changing layout.
- [x] Add the "Show advanced controls" toggle to Nest Settings using `updateUiPreferences`.
- [x] Pass/read `dashboard.uiPreferences.uiMode` where render gates are needed.
- [x] In simple mode, hide Roost knowledge stats, recent observation dumps, decision history, and
  agent memories. Keep pending approvals and the run-now heartbeat reachable only if needed.
- [x] Hide Roost Garden unless the active coop has `greenGoods.enabled`.
- [x] In simple mode, hide Coops saved-proof detail card, proof export action, onchain anchor, and
  FVM affordances.
- [x] In simple mode, hide Nest Agent and Sources tab pills and their sections.
- [x] In simple mode, hide Nest Autoresearch and advanced Settings cards: Privacy Exclusions, Local
  Helper, Data, and Nest Setup.
- [x] In simple mode, hide private payment/stealth address details from Members.
- [x] Hide popup Agent Cadence in simple mode; avoid broader popup redesign unless a clear advanced
  leak is found.
- [x] Add targeted render tests for representative simple/advanced states.
- [x] Keep file ownership tight or document justified spillover.
- [x] Document any UX tradeoffs in `../eval/implementation-notes.md`.

## Verification

- [x] `bun run validate:sidepanel-settings`
- [x] Targeted Vitest files for changed Sidepanel/Popup components.
- [ ] Browser or Playwright visual sweep of simple and advanced mode.

## Handoff Notes

- Confirm simple mode has no advanced-language leaks: autoresearch, sources, FVM, ERC-8004,
  stealth, raw proof/CID details, policy, permits, graph stats, or agent telemetry.
- Confirm advanced mode restores existing controls without behavior changes.
- Confirm popup layout remains consistent and stable.
- Human judgment callout: simple mode hides the Roost Agent sub-tab when there are no pending
  approvals, but shows it for pending approvals; advanced mode restores the full heartbeat,
  knowledge, observation, decision, and memory surfaces.
- Manual visual/browser sweep remains for QA because this pass used targeted render tests plus the
  sidepanel settings build gate, not an interactive browser pass.
