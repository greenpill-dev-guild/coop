---
feature: next-step-review
title: Next-Step Review QA pass 1
lane: qa
agent: codex
status: done
source_branch: feature/next-step-review
work_branch: main
skills:
  - qa
  - state-logic
  - api
  - contracts
qa_order: 1
handoff_in: handoff/qa-codex/next-step-review
handoff_out: handoff/qa-claude/next-step-review
completed_on: main
updated: 2026-05-07
---

# QA Pass 1

Codex runs the first QA pass after implementation lanes finish and the
`handoff/qa-codex/next-step-review` branch exists.

## Implementation Handoff

- State/API/UI lanes are implemented in this pass.
- Persisted-state callout: new local Dexie table `reviewItemFeedbacks`.
- Runtime callout: new extension-local runtime message `record-review-feedback`.
- Behavior boundary: no API server, onchain, policy, permit, session, archive, or sync behavior was
  changed.
- Residual QA need: browser/visual sweep of Roost and Chickens remains for QA pass 2.

## Focus

- Feedback schema and persistence.
- Dashboard summary, badge, proactive-signal, and review filtering.
- `not-useful` dismissal side effects for routings and observations.
- `remind-later` suppression without source mutation.
- Roost and Chickens copy/action regressions.
- Review-card legibility: what Coop noticed, why it matters, where it came from, and the next move.
- Simple-mode provenance boundary: source/reason visible, raw agent telemetry hidden.

## Tasks

- [x] Verify state/API/contracts paths.
- [x] Run targeted validation suites.
- [x] Verify human judgment callouts from implementation lanes.
- [x] Confirm review cards preserve source/provenance cues while keeping provider/model and trace internals out of simple mode.
- [x] Capture findings and residual risks.
- [x] Record QA pass 2 readiness; no handoff branch was created because this pass was explicitly run and committed on `main`.

## Verification

- [x] Validation commands are recorded in `../eval/qa-report.md`.
- [x] Any remaining risk is explicit.

## Result

- Status: done on `main`.
- Narrow fix applied: draft review feedback now suppresses related routed signals by `draftId`, `extractId`, or `sourceCandidateId`, which keeps snoozed merged review items out of dashboard counts and proactive signals.
- QA pass 2 is ready for browser/visual validation once the normal `handoff/qa-claude/next-step-review` branch is created outside this direct-main pass.
