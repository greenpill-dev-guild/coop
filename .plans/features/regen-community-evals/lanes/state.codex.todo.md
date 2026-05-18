---
feature: regen-community-evals
title: Regen Community Evals state lane
lane: state
agent: codex
status: done
source_branch: feature/hackathon-simplify
work_branch: codex/state/regen-community-evals
depends_on:
  - ../spec.md
owned_paths:
  - packages/shared/src/modules/coop/__tests__/seeded-eval-fixtures.ts
  - packages/shared/src/modules/coop/__tests__/seeded-eval.test.ts
  - scripts/verify-gemma4-regen-evals.cjs
  - scripts/validate.ts
  - package.json
done_when:
  - regen-community-evals
  - verify-gemma4-regen-evals.cjs
  - runSeededCoopRecommendationEval
  - actionBrief
skills:
  - state-logic
  - shared
  - testing
updated: 2026-05-18
---

# State Lane — Regen Community Evals

## Objective

Implement the deterministic and model-in-loop eval surface for Coop's regenerative-community
positioning.

## Tasks

- [x] Expand seeded fixtures to 32+ cases across four group types and four action types.
- [x] Assert action-brief shape for every case: target coop, action type, public summary, private
      notes, evidence references, coordinate/evidence/support/learning sections, tags, and
      disallowed unsupported claims.
- [x] Add a browser model-in-loop script that loads the built extension, initializes Gemma 4 in
      `agent-sandbox.html`, runs the eval prompts, and writes JSON evidence under `.plans/evidence/`.
- [x] Add `bun run validate regen-community-evals` as the required gate.
- [x] Keep deterministic seeded evals as supporting coverage, not the final proof.

## Verification

- [x] `bun run test:unit:coop-seeded-eval`
- [x] `bun run validate coop-seeded-eval`
- [x] `cd packages/extension && bun run build`
- [x] `COOP_VERIFY_BROWSER=brave node scripts/verify-gemma4-regen-evals.cjs`
- [x] `bun run validate regen-community-evals`

## Handoff Notes

The model-in-loop gate is intentionally hardware-sensitive. If Gemma 4 fails to load because WebGPU
or model assets are unavailable, the lane should stay blocked rather than silently falling back to
heuristics.
