---
feature: scoring-diagnostics
title: Scoring Diagnostics and Test Expansion QA pass 2
lane: qa
agent: claude
status: backlog
source_branch: feature/scoring-diagnostics
work_branch: qa/claude/scoring-diagnostics
depends_on:
  - qa-codex.todo.md
skills:
  - qa
  - ui
  - e2e
qa_order: 2
handoff_in: handoff/qa-claude/scoring-diagnostics
updated: 2026-04-01
---

# QA Pass 2

Claude runs the second QA pass only after Codex QA is done and `handoff/qa-claude/scoring-diagnostics` exists.

## Focus

- UX regressions
- Interaction gaps
- End-to-end behavior
- Accessibility and visual issues

## Tasks

- [ ] Validate the primary flow from the user perspective
- [ ] Note findings with file references
- [ ] Fix or hand off issues as appropriate

## Verification

- [ ] Appropriate E2E or manual validation was run
- [ ] Findings are captured in `../eval/qa-report.md`
