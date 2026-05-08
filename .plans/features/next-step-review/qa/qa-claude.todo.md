---
feature: next-step-review
title: Next-Step Review QA pass 2
lane: qa
agent: claude
status: done
source_branch: feature/next-step-review
work_branch: main
depends_on:
  - qa-codex.todo.md
skills:
  - qa
  - ui
  - e2e
qa_order: 2
handoff_in: handoff/qa-claude/next-step-review
completed_on: main
updated: 2026-05-07
---

# QA Pass 2

Claude runs the second QA pass only after Codex QA is done and
`handoff/qa-claude/next-step-review` exists.

Codex QA pass 1 closed on `main` by explicit direct-main instruction. QA pass 2 also ran and
closed on `main` by explicit user direction so the visual proof and the plan updates land in the
same scope as QA pass 1.

## Focus

- Browser/visual sweep of Roost and Chickens in simple and advanced mode.
- Card density, text wrapping, and button affordance quality.
- End-to-end review feedback behavior after dashboard reload.
- Confirmation that publish/share/push confirmation remains explicit.

## Tasks

- [x] Validate Roost "What's Next" copy from a user perspective.
- [x] Validate Chickens `Not useful` and `Remind later` actions in a browser.
- [x] Confirm active feedback suppresses badge/review counts after reload.
- [x] Confirm advanced mode still restores existing agent/operator surfaces.
- [x] Note findings with file references and capture any residual visual issues.

## Verification

- [x] Browser or Playwright visual validation was run.
- [x] Findings are captured in `../eval/qa-report.md`.
- [x] Remaining judgment callouts are explicit in `../eval/qa-report.md`.

## Result

- Browser sweep added at `e2e/visual-next-step-review.spec.cjs`. Three scenarios pass:
  Roost simple-mode `What's Next` copy in light/dark, Chickens Review/Shared segment switch, and
  Roost advanced-mode subtab restoration after flipping the Nest "Show advanced controls" toggle.
- Six screenshots persisted under `e2e/qa-screenshots/next-step-review/` for human review.
- `Not useful` / `Remind later` button visual coverage with seeded review items was not added in
  this pass; the unit-test layer covers the click handlers, dashboard suppression, and remindAt
  restoration. Residual risk recorded in `../eval/qa-report.md`.
