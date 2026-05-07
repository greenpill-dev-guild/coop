---
feature: next-step-review
title: Next-Step Review UI lane
lane: ui
agent: claude
status: done
source_branch: feature/next-step-review
work_branch: claude/ui/next-step-review
depends_on:
  - ../spec.md
  - ./state.codex.todo.md
  - ./api.codex.todo.md
owned_paths:
  - packages/extension/src/views/Sidepanel/tabs
  - packages/extension/src/views/Sidepanel/hooks/useDraftEditor.ts
  - packages/extension/src/global.css
done_when:
  - recordReviewFeedback
  - Remind later
  - Not useful
skills:
  - ui
  - react
  - accessibility
updated: 2026-05-06
---

# UI Lane

## Objective

Make Roost and Chickens feel like a plain-language next-step assistant instead of an agent
management surface.

## Files

- `packages/extension/src/views/Sidepanel/tabs/RoostFocusSection.tsx`
- `packages/extension/src/views/Sidepanel/tabs/ChickensTab.tsx`
- `packages/extension/src/views/Sidepanel/tabs/ChickensCompactCard.tsx`
- `packages/extension/src/views/Sidepanel/tabs/chickens-helpers.ts`
- `packages/extension/src/views/Sidepanel/hooks/useDraftEditor.ts`
- `packages/extension/src/global.css`
- Targeted Sidepanel render tests

## Tasks

- [x] Replace raw Roost "stale observation" copy with fresh-look language.
- [x] Replace simple-mode "Run Agent" action copy with "Refresh suggestions".
- [x] Replace agent-plan approval framing with prepared-action review framing.
- [x] Add `Not useful` and `Remind later` card actions.
- [x] Add stable feedback subjects for signal, draft, merged signal+draft, and observation cards.
- [x] Update card details around what Coop noticed, why it may matter, and suggested next move.
- [x] Keep publish/share/push confirmation behavior unchanged.

## Verification

- [x] `bun run test -- packages/extension/src/views/Sidepanel/tabs/__tests__/RoostFocusSection.test.tsx packages/extension/src/views/Sidepanel/tabs/__tests__/RoostTab-interactions.test.tsx`
- [x] `bun run test -- packages/extension/src/views/Sidepanel/tabs/__tests__/ChickensTab-interactions.test.tsx packages/extension/src/views/Sidepanel/tabs/__tests__/ChickensTab-subheader.test.tsx`

## Handoff Notes

- Human judgment callout: the UI lane was implemented in this Codex pass by explicit user request.
- Visual QA still needs a real browser sweep to confirm button density and text wrapping on the
  compact review cards.
