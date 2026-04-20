---
feature: autoresearch
title: QA Pass 1 — State & Schema Validation
lane: qa
agent: codex
status: blocked
qa_order: 1
source_branch: feature/autoresearch
work_branch: qa/codex/autoresearch
handoff_in: handoff/qa-codex/autoresearch
handoff_out: handoff/qa-claude/autoresearch
depends_on:
  - ../lanes/eval.claude.todo.md
  - ../lanes/state.codex.todo.md
  - ../lanes/runtime.codex.todo.md
updated: 2026-04-19
---

# QA Pass 1 — State & Schema Validation

## Objective

Validate schema correctness, table operations, eval determinism, and experiment loop invariants.

## Checks

### Schema Validation
- [ ] `ExperimentRecord` round-trips through Zod parse/serialize
- [ ] `SkillVariant` rejects invalid promptHash format
- [ ] `AutoresearchConfig` defaults are applied correctly
- [ ] All new schemas are exported from `@coop/shared`

### Table Operations
- [ ] `skillVariants` compound index queries work correctly
- [ ] `experimentRecords` time-range queries return correct results
- [ ] Pruning removes only reverted records beyond threshold
- [ ] Schema version bump doesn't break existing agent tables

### Eval Harness
- [ ] `runEvalSuite` is deterministic (run 10x, same scores)
- [ ] Composite score weights sum to 1.0
- [ ] All fixture files validate against fixture schema
- [ ] Scoring completes within performance budget (< 50ms per fixture)

### Experiment Loop
- [ ] Keep/revert decision is based strictly on composite score comparison
- [ ] Quality floor prevents keeping variants below threshold
- [ ] Budget timeout kills experiments cleanly (no dangling promises)
- [ ] Variant activation is transactional (no partial state on failure)
- [ ] Experiment records are written regardless of outcome

### Unit Test Coverage
- [ ] `eval-harness.test.ts` passes with all assertions
- [ ] `variant-engine.test.ts` passes with all assertions
- [ ] `experiment-loop.test.ts` passes with all assertions
- [ ] Coverage ≥ 80% for new modules

## Verification

```bash
bun run test -- eval-harness variant-engine experiment-loop autoresearch-state
bun run validate smoke
```
