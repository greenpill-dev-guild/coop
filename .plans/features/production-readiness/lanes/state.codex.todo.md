---
feature: production-readiness
title: Production readiness stabilization lane
lane: state
agent: codex
status: done
source_branch: main
work_branch: codex/state/production-readiness
depends_on:
  - ../spec.md
owned_paths:
  - vitest.config.ts
  - packages/app/src/hooks
  - packages/extension/src/views/Sidepanel
  - .plans/features/production-readiness/eval/implementation-notes.md
  - .plans/features/production-readiness/eval/qa-report.md
done_when:
  - Coverage gate: green
  - Store-readiness gate: green
  - Production-readiness gate: green
skills:
  - testing
  - debug
  - react
updated: 2026-04-19
---

# State Lane

- Clear release-gate blockers in this order:
  - fix lint violations and formatting drift
  - deflake the popup screenshot-review save test
  - broaden coverage to release-critical popup and sidepanel UI surfaces
  - rerun the staged-launch validation matrix until the result is binary
- Keep changes scoped to shipped release surfaces and validation integrity.
- Do not pull Claude into UI review until:
  - `bun format && bun lint` passes
  - targeted popup/app/sidepanel tests are green
  - `bun build` passes
  - `bun run validate:store-readiness` passes

## Current Result (2026-04-19)

- lint is green
- targeted test stability work is green
- release-critical coverage scope is green: `86.56 / 78.02 / 87.19 / 86.56`
  against the `85 / 70 / 85 / 85` gate
- `bun run build` is green; dist size 52.88 MB
- `bun run validate:store-readiness` is green
- `bun run validate:production-readiness` is green (second attempt; one
  `@flow-board` E2E flake on the first run, documented in the QA report)
- lane closed `done`; details in `../eval/qa-report.md` and
  `../eval/implementation-notes.md`

## Historical Result (2026-03-27)

- lint was green
- targeted test stability work was green
- release-critical coverage scope was more honest but under the gate at
  `77.29 / 76.41 / 77.57 / 77.29`
