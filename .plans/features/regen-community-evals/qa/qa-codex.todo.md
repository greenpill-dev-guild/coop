---
feature: regen-community-evals
title: Regen Community Evals QA pass 1
lane: qa
agent: codex
status: blocked
source_branch: feature/hackathon-simplify
work_branch: qa/codex/regen-community-evals
skills:
  - qa
  - state-logic
  - testing
qa_order: 1
handoff_in: handoff/qa-codex/regen-community-evals
handoff_out: handoff/qa-claude/regen-community-evals
updated: 2026-05-17
---

# QA Pass 1

## Focus

- Deterministic 32+ case matrix
- Real Gemma 4 browser/model proof
- Public/private action-brief separation
- Evidence and hallucination boundaries

## Tasks

- [ ] Run deterministic seeded eval validation.
- [ ] Build the extension and run the Gemma 4 browser eval.
- [ ] Verify `.plans/evidence/*regen-evals*.json` records pass/fail, model, browser, and cases.
- [ ] Record commands, findings, and residual risks in `../eval/qa-report.md`.
- [ ] Create `handoff/qa-claude/regen-community-evals` only after the model-in-loop result is honest.

## Verification

- [ ] `bun run validate regen-community-evals`
