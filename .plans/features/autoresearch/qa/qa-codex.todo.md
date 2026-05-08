---
feature: autoresearch
title: QA Pass 1 — State & Schema Validation
lane: qa
agent: codex
status: done
qa_order: 1
source_branch: feature/autoresearch
work_branch: qa/codex/autoresearch
handoff_in: handoff/qa-codex/autoresearch
handoff_out: handoff/qa-claude/autoresearch
depends_on:
  - ../lanes/eval.claude.todo.md
  - ../lanes/state.codex.todo.md
  - ../lanes/runtime.codex.todo.md
updated: 2026-05-08
---

# QA Pass 1 — State & Schema Validation

> Completed on 2026-05-08 against the backend/state/runtime surface. This pass does not close the
> feature: `ui` remains backlog, and QA pass 2 remains blocked until the UI lane is complete.

## Objective

Validate schema correctness, table operations, eval determinism, and experiment loop invariants.

## Checks

### Schema Validation
- [x] `ExperimentRecord` round-trips through Zod parse/serialize
- [x] `SkillVariant` rejects invalid promptHash format
- [x] `AutoresearchConfig` defaults are applied correctly
- [x] All new schemas are exported from `@coop/shared`

### Table Operations
- [ ] `skillVariants` compound index queries work correctly
  - Proof limit: the `[skillId+isActive]` index is declared, and runtime active lookup is covered
    through the scan-based fallback, but direct boolean compound-key query tests remain skipped under
    `fake-indexeddb`.
- [x] `experimentRecords` time-range queries return correct results
- [x] Pruning removes only reverted records beyond threshold
- [x] Schema version bump doesn't break existing agent tables

### Eval Harness
- [x] `runEvalSuite` is deterministic (run 10x, same scores)
- [x] Composite score weights sum to 1.0
- [x] All fixture files validate against fixture schema
- [x] Scoring completes within performance budget (< 50ms per fixture)

### Experiment Loop
- [x] Keep/revert decision is based strictly on composite score comparison
- [x] Quality floor prevents keeping variants below threshold
- [x] Budget timeout kills experiments cleanly (no dangling promises)
- [x] Variant activation is transactional (no partial state on failure)
- [x] Experiment records are written regardless of outcome

### Unit Test Coverage
- [x] Eval harness coverage passes through `agent-eval.test.ts` and runtime `autoresearch-qa.test.ts`
- [x] `variant-engine.test.ts` passes with all assertions
- [x] `experiment-loop.test.ts` passes with all assertions
- [ ] Coverage ≥ 80% for new modules
  - Not measured in this pass; requested validation did not include a coverage run.

### Run-Now Error Surfacing
- [x] `NestAutoresearchSection.test.tsx` proves load, toggle, and run-now failures render visible
      helper text and leave the Run now control usable after failure.

### Required Validation
- [x] Targeted autoresearch/shared/runtime tests passed.
- [x] `bun run plans validate` passed.
- [ ] `bun run validate:quick` passed.
  - Run result: typecheck passed, then lint failed on existing Receiver app issues outside this QA
    diff (`packages/app/src/views/Receiver/ReceiverShell.tsx` SVG title rules and
    `packages/app/src/styles.css` formatting).

## Verification

```bash
bun run test -- packages/shared/src/modules/storage/__tests__/autoresearch-state.test.ts packages/shared/src/modules/storage/__tests__/autoresearch-qa.test.ts packages/extension/src/runtime/__tests__/agent-eval.test.ts packages/extension/src/runtime/agent/__tests__/variant-engine.test.ts packages/extension/src/runtime/agent/__tests__/experiment-loop.test.ts packages/extension/src/runtime/agent/__tests__/autoresearch-qa.test.ts packages/extension/src/views/Sidepanel/tabs/__tests__/NestAutoresearchSection.test.tsx
bun run plans validate
bun run validate:quick
```
