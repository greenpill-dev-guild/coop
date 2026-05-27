---
feature: agentic-flow-hardening
title: Agentic Flow Hardening QA pass 1
lane: qa
agent: codex
status: blocked
source_branch: feature/agentic-flow-hardening
work_branch: qa/codex/agentic-flow-hardening
depends_on:
  - ../lanes/state.codex.todo.md
  - ../lanes/contracts.codex.todo.md
  - ../lanes/api.codex.todo.md
  - ../lanes/ui.claude.todo.md
  - ../lanes/docs.codex.todo.md
skills:
  - qa
  - state-logic
  - api
  - contracts
qa_order: 1
handoff_in: handoff/qa-codex/agentic-flow-hardening
handoff_out: handoff/qa-claude/agentic-flow-hardening
updated: 2026-05-26
---

# QA Pass 1

Codex runs the first QA pass after implementation lanes finish and the `handoff/qa-codex/agentic-flow-hardening` branch exists.

## Focus

- Plan/template integrity
- Advisory import-boundary behavior
- API and shared sync/message schema coverage
- Human judgment callouts from implementation handoff notes

## Tasks

- [ ] Verify state/API/contracts paths
- [ ] Run targeted validation suites
- [ ] Verify any human judgment callouts from implementation lanes
- [ ] Capture findings and residual risks
- [ ] Create `handoff/qa-claude/agentic-flow-hardening` when pass 2 should start

## Verification

- [ ] Validation commands are recorded in `../eval/qa-report.md`
- [ ] Any remaining risk is explicit
