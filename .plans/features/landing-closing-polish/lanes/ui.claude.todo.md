---
feature: landing-closing-polish
title: Landing Closing Polish UI lane
lane: ui
agent: claude
status: backlog
source_branch: feature/landing-closing-polish
work_branch: claude/ui/landing-closing-polish
depends_on:
  - ../spec.md
skills:
  - ui
  - react
  - accessibility
handoff_out: handoff/qa-codex/landing-closing-polish
updated: 2026-05-26
---

# UI Lane

## Objective

Implement the tiny closing-section polish preserved from the legacy flat plan.
Keep file ownership tight. If work spills into state/api/contracts surfaces without an explicit
handoff, stop and call it out in `Handoff Notes`.

## Files

- `packages/app/src/views/Landing/sections/ArrivalJourneySection.tsx`
- `packages/app/src/views/Landing/index.tsx`
- `packages/app/src/i18n/translations.json`
- `packages/app/src/styles.css`

## Tasks

- [ ] Add one CTA inside `.why-build-heading-card` that links to `#ritual`.
- [ ] Add footer credibility copy and a resource-nav accessible label.
- [ ] Add only the minimal CSS needed for `.why-build-cta`, `.landing-footer-brand`, and `.landing-footer-credibility`.
- [ ] Add or update UI tests where appropriate
- [ ] Keep file ownership tight or document justified spillover
- [ ] Document any UX tradeoffs

## Verification

- [ ] Appropriate validation tier was run
- [ ] Desktop and mobile bottom-of-page screenshots were checked
- [ ] CTA click scrolls to `#ritual`

## Handoff Notes

QA should verify the bottom-of-page layout, CTA target, translations, and no horizontal overflow.
Human judgment callouts: none expected; new dependencies, shared-contract changes, and runtime boundary changes are out of scope.
