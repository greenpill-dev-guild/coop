---
feature: next-step-review
title: Next-Step Review QA pass 2
lane: qa
agent: claude
status: blocked
source_branch: feature/next-step-review
work_branch: qa/claude/next-step-review
depends_on:
  - qa-codex.todo.md
skills:
  - qa
  - ui
  - e2e
qa_order: 2
handoff_in: handoff/qa-claude/next-step-review
updated: 2026-05-06
---

# QA Pass 2

Claude runs the second QA pass only after Codex QA is done and
`handoff/qa-claude/next-step-review` exists.

## Focus

- Browser/visual sweep of Roost and Chickens in simple and advanced mode.
- Card density, text wrapping, and button affordance quality.
- End-to-end review feedback behavior after dashboard reload.
- Confirmation that publish/share/push confirmation remains explicit.

## Tasks

- [ ] Validate Roost "What's Next" copy from a user perspective.
- [ ] Validate Chickens `Not useful` and `Remind later` actions in a browser.
- [ ] Confirm active feedback suppresses badge/review counts after reload.
- [ ] Confirm advanced mode still restores existing agent/operator surfaces.
- [ ] Note findings with file references and capture any residual visual issues.

## Verification

- [ ] Browser or Playwright visual validation was run.
- [ ] Findings are captured in `../eval/qa-report.md`.
- [ ] Remaining judgment callouts are explicit in `../eval/qa-report.md`.
