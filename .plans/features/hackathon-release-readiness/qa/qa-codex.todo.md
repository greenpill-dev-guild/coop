---
feature: hackathon-release-readiness
title: Hackathon Release Readiness QA pass 1
lane: qa
agent: codex
status: backlog
source_branch: main
work_branch: qa/codex/hackathon-release-readiness
skills:
  - qa
  - state-logic
  - api
  - contracts
qa_order: 1
handoff_in: handoff/qa-codex/hackathon-release-readiness
handoff_out: handoff/qa-claude/hackathon-release-readiness
updated: 2026-03-30
---

# QA Pass 1

Codex runs the first QA pass after implementation lanes finish and the `handoff/qa-codex/hackathon-release-readiness` branch exists.

## Focus

- State persistence
- Runtime messaging
- API boundaries
- Contracts, permissions, and schema behavior

## Tasks

- [ ] Verify state/API/contracts paths
- [ ] Run targeted validation suites
- [ ] Capture findings and residual risks
- [ ] Create `handoff/qa-claude/hackathon-release-readiness` when pass 2 should start

## Verification

- [ ] Validation commands are recorded in `../eval/qa-report.md`
- [ ] Any remaining risk is explicit
