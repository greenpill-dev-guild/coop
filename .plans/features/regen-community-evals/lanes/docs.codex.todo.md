---
feature: regen-community-evals
title: Regen Community Evals docs lane
lane: docs
agent: codex
status: ready
source_branch: feature/hackathon-simplify
work_branch: codex/docs/regen-community-evals
depends_on:
  - ../spec.md
skills:
  - docs
  - plan
updated: 2026-05-17
---

# Docs Lane — Regen Community Evals

## Objective

Keep the plan hub, demo notes, and eval evidence aligned around the stronger regenerative-community
framing.

## Tasks

- [ ] Preserve the four group types and four action types in the feature spec.
- [ ] Keep Santa Ana Watershed as the hero demo row rather than the full product scope.
- [ ] Record validation commands and model-in-loop proof in `../eval/qa-report.md`.
- [ ] Update flat hackathon docs only when they conflict with the final demo/eval truth.

## Verification

- [ ] `bun run plans validate`
- [ ] Any docs drift from the old grant-centric story is called out in `../eval/implementation-notes.md`.
