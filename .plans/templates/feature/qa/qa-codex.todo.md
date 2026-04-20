---
feature: <feature-slug>
title: <Feature Title> QA pass 1
lane: qa
agent: codex
status: backlog
source_branch: <source-branch>
work_branch: qa/codex/<feature-slug>
skills:
  - qa
  - state-logic
  - api
  - contracts
qa_order: 1
handoff_in: handoff/qa-codex/<feature-slug>
handoff_out: handoff/qa-claude/<feature-slug>
updated: <YYYY-MM-DD>
---

# QA Pass 1

Codex runs the first QA pass after implementation lanes finish and the `handoff/qa-codex/<feature-slug>` branch exists.

## Focus

- State persistence
- Runtime messaging
- API boundaries
- Contracts, permissions, and schema behavior
- Human judgment callouts from implementation handoff notes

## Tasks

- [ ] Verify state/API/contracts paths
- [ ] Run targeted validation suites
- [ ] Verify any human judgment callouts from implementation lanes
- [ ] Capture findings and residual risks
- [ ] Create `handoff/qa-claude/<feature-slug>` when pass 2 should start

## Verification

- [ ] Validation commands are recorded in `../eval/qa-report.md`
- [ ] Any remaining risk is explicit
