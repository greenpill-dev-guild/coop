---
feature: agentic-flow-hardening
title: Agentic Flow Hardening QA pass 2
lane: qa
agent: claude
status: blocked
source_branch: feature/agentic-flow-hardening
work_branch: qa/claude/agentic-flow-hardening
depends_on:
  - qa-codex.todo.md
skills:
  - qa
  - ui
  - e2e
qa_order: 2
handoff_in: handoff/qa-claude/agentic-flow-hardening
updated: 2026-05-26
---

# QA Pass 2

Claude runs the second QA pass only after Codex QA is done and `handoff/qa-claude/agentic-flow-hardening` exists.

## Focus

- UX regressions
- Interaction gaps
- End-to-end behavior
- Accessibility and visual issues
- Human judgment callouts that remain unresolved after QA pass 1

## Tasks

- [ ] Validate the primary flow from the user perspective
- [ ] Verify that judgment-heavy decisions still read clearly in the UI and operator workflow
- [ ] Note findings with file references
- [ ] Call out any unresolved human judgment decisions explicitly
- [ ] Fix or hand off issues as appropriate

## Verification

- [ ] Appropriate E2E or manual validation was run
- [ ] Findings are captured in `../eval/qa-report.md`
- [ ] Remaining judgment callouts are explicit in `../eval/qa-report.md`
