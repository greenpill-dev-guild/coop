---
feature: agent-control-plane
title: Agent Control Plane QA pass 1
lane: qa
agent: codex
status: blocked
source_branch: feature/agent-control-plane
work_branch: qa/codex/agent-control-plane
skills:
  - qa
  - state-logic
  - api
  - contracts
qa_order: 1
handoff_in: handoff/qa-codex/agent-control-plane
handoff_out: handoff/qa-claude/agent-control-plane
updated: 2026-05-21
---

# QA Pass 1

Codex runs the first QA pass after implementation lanes finish and the `handoff/qa-codex/agent-control-plane` branch exists.

## Focus

- State persistence
- Runtime messaging
- Runtime durability and stop/revoke semantics
- Policy/session/permit boundaries
- Human judgment callouts from implementation handoff notes

## Tasks

- [ ] Verify state/runtime paths and any intentionally activated API/contracts paths.
- [ ] Run targeted validation suites
- [ ] Verify any human judgment callouts from implementation lanes
- [ ] Capture findings and residual risks
- [ ] Create `handoff/qa-claude/agent-control-plane` when pass 2 should start

## Verification

- [ ] Validation commands are recorded in `../eval/qa-report.md`
- [ ] Any remaining risk is explicit
