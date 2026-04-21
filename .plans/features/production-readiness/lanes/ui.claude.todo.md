---
feature: production-readiness
title: Production readiness UI polish lane
lane: ui
agent: claude
status: done
source_branch: main
work_branch: claude/ui/production-readiness
depends_on:
  - ../spec.md
  - state.codex.todo.md
skills:
  - ui
  - react
  - accessibility
updated: 2026-04-19
---

# UI Lane

- Scope is limited to shipped release surfaces:
  - popup capture and review flows
  - screenshot review dialog clarity
  - Chickens and Sidepanel information hierarchy
  - spacing, typography, tokens, and accessibility polish
- Claude should not reopen infra, coverage policy, or live-rails contract work unless a UI issue
  reveals a real launch blocker.
- Exit with:
  - a concise UI acceptance checklist in `../qa/qa-claude.todo.md`
  - any safe-to-defer polish items called out explicitly

## Summary (2026-04-19)

- Closed `done`. Full acceptance checklist + deferrable polish list lives
  in `../qa/qa-claude.todo.md` — this lane and `qa_pass_2` closed in the
  same pass, sequencing was formal-only (per spec note: "QA 2 · Claude ·
  optional follow-on UX review").
- No launch blockers found. Popup capture / review dialog, Chickens
  segments + time groups + filters, Roost Focus/Agent/Garden sub-tabs,
  Nest operator sub-tabs, Receiver shell nav, and design tokens all meet
  the staged-launch bar.
- Source fixes applied inside the shipped sidepanel surface (scope
  called out in the lane's prose focus list):
  - `RoostTab.tsx` — added `aria-pressed` to the three Roost sub-tab
    buttons.
  - `NestTab.tsx` — added `aria-pressed` to the four Nest sub-tab
    buttons.
  - Rationale: match the `aria-pressed` contract already used by
    `ChickensTab` segment tags through `PopupSubheader`. Screen readers
    now announce these sub-tabs as toggle buttons instead of unlabeled
    ones. One real a11y gap, two-line fix, no behavior change. Verified
    with `bun run test` on Roost + Nest interaction suites (102 tests
    green) and `bun run validate quick` green.
- Visual verification on a running dev build was not performed in this
  pass — same trade-off taken on `agent-judgment-cues` QA pass 2. If the
  team wants live-build screenshots of each shipped surface, that is a
  separate follow-up pass.

## Deferrable Polish (Documented In qa-claude.todo.md)

Full list lives in the QA pass 2 file. Short form:

1. Receiver status summary separator phrasing (middot vs comma / span).
2. Waiting-chores coopId badge readability for new operators.
3. Alpha-tint contrast sweep with axe-core on dev build.
4. Chickens time-group overflow threshold tuning.
5. Dark-mode roll-through across every shipped surface before public
   launch.
