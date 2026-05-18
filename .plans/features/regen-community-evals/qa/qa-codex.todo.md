---
feature: regen-community-evals
title: Regen Community Evals QA pass 1
lane: qa
agent: codex
status: done
source_branch: feature/hackathon-simplify
work_branch: qa/codex/regen-community-evals
skills:
  - qa
  - state-logic
  - testing
qa_order: 1
handoff_in: handoff/qa-codex/regen-community-evals
handoff_out: handoff/qa-claude/regen-community-evals
updated: 2026-05-18
---

# QA Pass 1

## Focus

- Deterministic 32+ case matrix
- Real Gemma 4 browser/model proof
- Public/private action-brief separation
- Evidence and hallucination boundaries

## Tasks

- [x] Run deterministic seeded eval validation.
- [x] Build the extension and run the Gemma 4 browser eval.
- [x] Verify `.plans/evidence/*regen-evals*.json` records pass/fail, model, browser, and cases.
- [x] Record commands, findings, and residual risks in `../eval/qa-report.md`.
- [x] Mark QA pass 2 ready only after the model-in-loop result is honest.

## Verification

- [x] `bun run validate regen-community-evals`
