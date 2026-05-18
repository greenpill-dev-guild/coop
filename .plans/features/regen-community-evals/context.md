# Context For Regen Community Evals

## Existing References

- `.plans/hackathon-closeout-runbook.md` — final recording and proof checklist.
- `.plans/demo-shooting-script.md` — current timed demo arc, still partially grant-centric.
- `.plans/kaggle-submission-entry.md` — submission copy that should move away from "grant finder".
- `/Users/afo/Downloads/coop-gemma4good-santa-ana/02-santa-ana-watershed-demo-brief.md` — local
  Santa Ana Watershed hero demo.
- `/Users/afo/Downloads/coop-gemma4good-santa-ana/03-eval-suite-outline.md` — eval matrix and
  action-brief rubric.

## Relevant Codepaths

- `packages/shared/src/modules/coop/__tests__/seeded-eval-fixtures.ts`
- `packages/shared/src/modules/coop/__tests__/seeded-eval.test.ts`
- `packages/shared/src/modules/coop/pipeline.ts`
- `packages/extension/src/runtime/agent/gemma4-bridge.ts`
- `packages/extension/src/runtime/agent/gemma4-worker.ts`
- `packages/extension/src/runtime/agent/runner-skills-completion.ts`
- `scripts/validate.ts`
- `scripts/verify-real-chrome.cjs`

## Constraints

- Raw captures and private notes stay local until explicit publish.
- Santa Ana Watershed is the demo hero row, not the whole Coop thesis.
- Model-in-loop proof requires a real Chromium-family browser and may depend on WebGPU/model cache.
- Deterministic evals remain useful for quick local coverage, but the completion gate is the real
  Gemma 4 browser eval.
- Existing dirty/untracked files must be preserved and unrelated changes must not be reverted.

## Notes For Agents

- Codex should keep implementation in shared test fixtures, scripts, and validation wiring.
- Claude should only handle wording/demo-coherence review unless UI gaps are explicitly added later.
- Action-brief outputs should prefer concrete community action over "apply for a grant".
- Privacy assertions must fail if exact private names, site details, or hostile page instructions
  appear in public summaries.
