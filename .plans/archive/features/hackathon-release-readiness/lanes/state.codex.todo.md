---
feature: hackathon-release-readiness
title: Hackathon release setup and metadata bug lane
lane: state
agent: codex
status: done
source_branch: main
work_branch: codex/state/hackathon-release-readiness
depends_on:
  - ../spec.md
owned_paths:
  - packages/extension/src/views/shared
  - packages/extension/src/views/Popup
  - packages/extension/src/views/Sidepanel
  - packages/extension/src/runtime
  - packages/shared/src/modules/coop
done_when:
  - greenGoodsConnectLaterCopy
  - passkeyTrustExplainer
  - previewCardImageUrl
tags:
  - Bug
  - Polish
skills:
  - testing
  - debug
  - react
  - shared
updated: 2026-03-30
---

# State Lane

## Category

Bug fixing with light plumbing needed for later UI polish.

## Codex CLI

- Model: `gpt-5.4`
- Reasoning effort: `high`
- Suggested invocation:

```bash
cat .plans/features/hackathon-release-readiness/lanes/state.codex.todo.md | codex exec -C /Users/afo/Code/greenpill/coop -m gpt-5.4 -c model_reasoning_effort="high" -
```

## Objective

Fix the setup-flow inconsistencies that directly affect first-run trust and make sure preview
metadata is available for later Chickens/Roost polish without having the UI lane reopen shared
logic.

## Files

- `packages/extension/src/views/shared/useCoopActions.ts`
- `packages/extension/src/views/Popup/PopupCreateCoopScreen.tsx`
- `packages/extension/src/views/Popup/PopupJoinCoopScreen.tsx`
- `packages/extension/src/views/Sidepanel/hooks/useCoopForm.ts`
- `packages/extension/src/views/Sidepanel/setup-insights.ts`
- `packages/extension/src/views/Sidepanel/tabs/NestTab.tsx`
- `packages/extension/src/runtime/tab-capture.ts`
- `packages/shared/src/modules/coop/pipeline.ts`
- `packages/shared/src/modules/coop/review.ts`

## Tasks

- [ ] Make Green Goods setup optional everywhere; popup create must not auto-enable it.
- [ ] Add clear passkey rationale to create/join flows without changing the auth model.
- [ ] Preserve or improve "connect later" language for Green Goods where the product already
      supports deferred setup.
- [ ] Ensure preview image, social-preview, and favicon metadata survives capture and review for
      downstream UI rendering.
- [ ] Add or update focused unit/integration coverage for the changed setup and metadata paths.

## Verification

- [ ] `bun run validate:popup-slice`
- [ ] targeted tests for changed popup/sidepanel/shared files
- [ ] smallest relevant extension build

## Handoff Notes

- Call out any data-shape changes for preview metadata explicitly for the Claude UI lane.
- If a true "connect existing garden later" implementation would require new backend or protocol
  behavior, stop at honest defer-copy rather than inventing unsupported behavior.
