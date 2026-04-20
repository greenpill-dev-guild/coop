---
feature: <feature-slug>
title: <Feature Title> UI lane
lane: ui
agent: claude
status: backlog
source_branch: <source-branch>
work_branch: claude/ui/<feature-slug>
depends_on:
  - ../spec.md
skills:
  - ui
  - react
  - accessibility
handoff_out: handoff/qa-codex/<feature-slug>
updated: <YYYY-MM-DD>
---

# UI Lane

## Objective

Describe the user-interface slice Claude should own.
Keep file ownership tight. If work spills into state/api/contracts surfaces without an explicit
handoff, stop and call it out in `Handoff Notes`.

## Files

- `packages/extension/...`
- `packages/app/...`

## Tasks

- [ ] Audit existing UI patterns/components before adding new ones
- [ ] Implement the UI changes
- [ ] Add or update UI tests where appropriate
- [ ] Keep file ownership tight or document justified spillover
- [ ] Document any UX tradeoffs

## Verification

- [ ] Appropriate validation tier was run
- [ ] Any visual changes were checked in browser

## Handoff Notes

What the first QA lane should pay attention to after UI work is done.
List any human judgment callouts: new dependencies, shared-contract implications, runtime boundary
changes, or ownership blur introduced by the UI work.
