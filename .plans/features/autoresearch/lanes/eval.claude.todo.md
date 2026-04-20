---
feature: autoresearch
title: Eval Harness — Frozen Fixtures & Composite Scoring
lane: api
agent: claude
status: done
source_branch: feature/autoresearch
work_branch: claude/eval/autoresearch
depends_on:
  - ../spec.md
owned_paths:
  - packages/extension/src/runtime/agent/eval.ts
  - packages/extension/src/runtime/agent/__tests__/eval-harness.test.ts
  - packages/extension/src/skills/*/eval/*.json
done_when:
  - runEvalSuite(
  - compositeScore
  - FixtureResult
skills:
  - testing
  - architecture
updated: 2026-04-06
---

# Eval Harness — Frozen Fixtures & Composite Scoring

The eval harness is the `prepare.py` equivalent — the immutable yardstick against which all
experiments are measured. It must be deterministic, fast, and pure (no inference calls).

## Objective

Extend the existing `eval.ts` fixture + assertion system into a full eval suite runner that returns
a composite score. Create golden fixtures for each WebLLM skill derived from real member-approved
outputs.

## Files

- `packages/extension/src/runtime/agent/eval.ts` — extend with `runEvalSuite()` and composite scoring
- `packages/extension/src/runtime/agent/__tests__/eval-harness.test.ts` — new test file
- `packages/extension/src/skills/capital-formation-brief/eval/*.json` — golden fixtures
- `packages/extension/src/skills/review-digest/eval/*.json` — golden fixtures
- `packages/extension/src/skills/memory-insight-synthesizer/eval/*.json` — golden fixtures

## Tasks

### 1.1 RED — Failing tests for composite scoring

- [ ] Create `eval-harness.test.ts` with test structure
- [ ] Test: `runEvalSuite` returns `EvalSuiteResult` with `compositeScore`, `fixtureResults[]`
- [ ] Test: composite score is weighted average (0.2 schema + 0.3 structural + 0.3 semantic + 0.2 confidence delta)
- [ ] Test: identical inputs produce identical scores (determinism)
- [ ] Test: degraded output scores lower than golden output (sensitivity)
- [ ] Test: missing fields score 0.0 for schema compliance term
- [ ] Test: empty output scores 0.0 overall
- [ ] Test: scoring completes in < 50ms per fixture (performance)

### 1.2 RED — Failing tests for fixture validation

- [ ] Test: `validateFixture` rejects fixtures missing required fields
- [ ] Test: `validateFixture` rejects fixtures with assertion type not in allowed set
- [ ] Test: `freezeFixture` produces content-addressable hash for dedup
- [ ] Test: `loadSkillFixtures(skillId)` returns only fixtures for that skill

### 1.3 GREEN — Implement composite scoring

- [ ] Add `EvalSuiteResult` type to eval.ts
- [ ] Add `FixtureResult` type (fixtureId, scores per dimension, compositeScore, assertions passed/failed)
- [ ] Implement `runEvalSuite(skillId, output, fixtures?)` — loads fixtures, runs assertions, computes composite
- [ ] Implement weighted scoring: schema compliance from Zod validation, structural from existing assertions, semantic from existing word-count/regex assertions, confidence delta from `computeOutputConfidence()`
- [ ] Ensure pure computation — no inference provider calls

### 1.4 GREEN — Author golden fixtures

- [ ] Create 3+ golden fixtures for `capital-formation-brief` from real approved output shapes
- [ ] Create 3+ golden fixtures for `review-digest` from real approved output shapes
- [ ] Create 3+ golden fixtures for `memory-insight-synthesizer` from real approved output shapes
- [ ] Each fixture includes: input observation, expected output shape, assertion set, golden composite score
- [ ] Create 1 regression fixture per skill (intentionally degraded output with known-low score)

### 1.5 REFACTOR — Clean up and harden

- [ ] Extract scoring weight constants to config (not hardcoded in function body)
- [ ] Ensure all fixture files pass `validateFixture`
- [ ] Add JSDoc to public API (`runEvalSuite`, `EvalSuiteResult`, `FixtureResult`)
- [ ] Verify no circular imports introduced

## Verification

```bash
bun run test -- eval-harness
bun run validate typecheck
```

## Handoff Notes

The runtime lane depends on `runEvalSuite()` being stable and deterministic. The composite score
contract (type signature + weight constants) must be frozen before the experiment loop can use it.
