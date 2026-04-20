---
feature: scoring-diagnostics
title: Scoring Diagnostics and Test Expansion QA pass 1
lane: qa
agent: codex
status: backlog
source_branch: feature/scoring-diagnostics
work_branch: qa/codex/scoring-diagnostics
skills:
  - qa
  - state-logic
  - api
  - contracts
qa_order: 1
handoff_in: handoff/qa-codex/scoring-diagnostics
handoff_out: handoff/qa-claude/scoring-diagnostics
updated: 2026-04-01
---

# QA Pass 1

Codex runs the first QA pass after implementation lanes finish and the `handoff/qa-codex/scoring-diagnostics` branch exists.

## Focus

- State persistence
- Runtime messaging
- API boundaries
- Contracts, permissions, and schema behavior

## Tasks

- [ ] Verify state/API/contracts paths
- [ ] Run targeted validation suites
- [ ] Capture findings and residual risks
- [ ] Create `handoff/qa-claude/scoring-diagnostics` when pass 2 should start

## Verification

- [ ] Validation commands are recorded in `../eval/qa-report.md`
- [ ] Any remaining risk is explicit
