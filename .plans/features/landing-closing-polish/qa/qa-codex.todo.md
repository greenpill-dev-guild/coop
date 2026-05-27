---
feature: landing-closing-polish
title: Landing Closing Polish QA pass 1
lane: qa
agent: codex
status: blocked
source_branch: feature/landing-closing-polish
work_branch: qa/codex/landing-closing-polish
depends_on:
  - ../lanes/ui.claude.todo.md
skills:
  - qa
  - ui
qa_order: 1
handoff_in: handoff/qa-codex/landing-closing-polish
handoff_out: handoff/qa-claude/landing-closing-polish
updated: 2026-05-26
---

# QA Pass 1

Codex runs the first QA pass after implementation lanes finish and the `handoff/qa-codex/landing-closing-polish` branch exists.

## Focus

- Landing bottom-of-page behavior
- Translation completeness
- Responsive layout and overflow
- Human judgment callouts from implementation handoff notes

## Tasks

- [ ] Verify landing UI paths
- [ ] Run targeted validation suites
- [ ] Verify any human judgment callouts from implementation lanes
- [ ] Capture findings and residual risks
- [ ] Create `handoff/qa-claude/landing-closing-polish` when pass 2 should start

## Verification

- [ ] Validation commands are recorded in `../eval/qa-report.md`
- [ ] Any remaining risk is explicit
