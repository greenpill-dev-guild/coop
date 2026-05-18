---
feature: regen-community-evals
title: Regen Community Evals docs lane
lane: docs
agent: codex
status: done
source_branch: feature/hackathon-simplify
work_branch: codex/docs/regen-community-evals
depends_on:
  - ../spec.md
skills:
  - docs
  - plan
updated: 2026-05-18
---

# Docs Lane — Regen Community Evals

## Objective

Keep the plan hub, demo notes, and eval evidence aligned around the stronger regenerative-community
framing.

## Tasks

- [x] Preserve the four group types and four action types in the feature spec.
- [x] Keep Santa Ana Watershed as the hero demo row rather than the full product scope.
- [x] Record validation commands and model-in-loop proof in `../eval/qa-report.md`.
- [x] Update flat hackathon docs only when they conflict with the final demo/eval truth.

## Verification

- [x] `bun run plans validate`
- [x] Any docs drift from the old grant-centric story is called out in `../eval/implementation-notes.md`.
