---
feature: hackathon-release-readiness
title: Hackathon release extension polish lane
lane: ui
agent: claude
status: done
source_branch: main
work_branch: claude/ui/hackathon-release-readiness
depends_on:
  - ../spec.md
  - state.codex.todo.md
  - api.codex.todo.md
tags:
  - Polish
skills:
  - ui
  - react
  - accessibility
handoff_out: handoff/qa-codex/hackathon-release-readiness
updated: 2026-03-30
---

# UI Lane

## Category

Polish.

## Objective

Only after the setup and sync lanes are stable, make the extension experience feel crisp, legible,
and demo-ready without reopening shared logic or network behavior.

## Files

- `packages/extension/src/views/Sidepanel/tabs/ChickensTab.tsx`
- `packages/extension/src/views/Sidepanel/cards.tsx`
- `packages/extension/src/views/Sidepanel/tabs/RoostTab.tsx`
- `packages/extension/src/views/Popup/PopupHomeScreen.tsx`
- directly-related CSS only

## Tasks

- [x] Finalize Chickens so the synthesis/review path feels obvious and user-friendly.
- [x] Use preview images and favicons where the state lane makes them safely available.
- [x] Optimize Roost for action and exploration without letting it become a second settings panel.
- [x] Make the home chicken more playful with restrained motion, tooltips, and light sound cues if
      they remain tasteful and low-risk.
- [x] Leave a short defer list for any non-blocking visual ideas that should not delay release.

## Defer List

Non-blocking visual ideas that should not delay release:

1. **Wire YardItem titles through orchestration hook** — `usePopupOrchestration` currently builds
   `YardItem` without a `title` field. Once wired, chicken tooltips will show the draft/artifact
   title instead of the generic "Draft chicken" / "Shared chick" label. Low effort, no risk.
2. **Sound cue on Roundup** — A short rooster-call audio clip on the "Roundup Chickens" button
   click. Spec says sound only on explicit interaction. Needs a royalty-free audio asset and Web
   Audio API integration in the popup view. Deferred because the audio asset is not available.
3. **Animated preview rail shimmer** — A subtle shimmer on the preview image rail while it loads.
   Would improve perceived performance for slow-loading og:image URLs. Low priority.
4. **Compact card swipe-to-dismiss** — Touch gesture to dismiss stale observations or archive
   drafts. Would need a gesture library or manual pointer tracking. Out of scope for hackathon.
5. **Roost recent activity deep link** — Clicking a recent activity item should navigate to the
   artifact in the Coops tab. Needs cross-tab navigation plumbing in the sidepanel router.

## Verification

- [ ] smallest relevant extension build
- [ ] browser check of changed UI surfaces
- [ ] `bun run validate:core-loop` if the primary extension workflow changes materially

## Handoff Notes

- Keep file ownership tight. Do not reopen state/api/contracts files without an explicit handoff.
- Hand off to Codex QA only after the UI is visually checked and any safe defers are documented.
