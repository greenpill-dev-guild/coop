# QA Report

## Current State

- Status: QA pass 1 closed with blockers on 2026-05-07.
- Implementation lanes: state and UI are materially landed, but the feature is not ready for QA pass
  2 handoff.
- Graph backend: snapshot-backed in-memory graph persisted through Dexie `graphSnapshots`.
- Deferred backend: Kuzu-WASM remains deferred; this pass did not attempt it.

## Validation Run - 2026-05-07

Focused tests run on `main`:

- `bun run test -- packages/shared/src/modules/knowledge-source/__tests__/source-registry.test.ts packages/shared/src/modules/knowledge-source/__tests__/allowlist.test.ts packages/shared/src/modules/knowledge-source/__tests__/source-sync.test.ts packages/shared/src/modules/knowledge-source/__tests__/activity-log.test.ts packages/shared/src/modules/graph/__tests__/graph-store.test.ts packages/shared/src/modules/graph/__tests__/graph-temporal.test.ts packages/shared/src/modules/graph/__tests__/graph-retrieval.test.ts packages/shared/src/modules/graph/__tests__/graph-context.test.ts packages/shared/src/modules/graph/__tests__/graph-retrieval-benchmark.test.ts packages/shared/src/modules/graph/__tests__/reasoning-trace.test.ts packages/shared/src/modules/graph/__tests__/reasoning-precedent.test.ts packages/shared/src/modules/graph/__tests__/knowledge-sandbox-integration.test.ts packages/shared/src/modules/graph/__tests__/knowledge-lint.test.ts packages/shared/src/modules/graph/__tests__/compound-loop.test.ts packages/shared/src/modules/agent/__tests__/memory.test.ts packages/shared/src/modules/storage/__tests__/db.test.ts` - passed, 16 files / 215 tests.
- `bun run test -- packages/extension/src/runtime/agent/adapters/__tests__/adapter-youtube.test.ts packages/extension/src/runtime/agent/adapters/__tests__/adapter-github.test.ts packages/extension/src/runtime/agent/adapters/__tests__/adapter-rss.test.ts packages/extension/src/runtime/agent/adapters/__tests__/adapter-reddit.test.ts packages/extension/src/runtime/agent/adapters/__tests__/adapter-npm.test.ts packages/extension/src/runtime/agent/adapters/__tests__/adapter-wikipedia.test.ts packages/extension/src/runtime/agent/adapters/__tests__/sanitizer.test.ts packages/extension/src/runtime/agent/__tests__/graph-store-singleton.test.ts packages/extension/src/runtime/agent/__tests__/graph-persistence.test.ts packages/extension/src/runtime/agent/__tests__/runner-skills-prompt.test.ts packages/extension/src/runtime/__tests__/agent-knowledge.test.ts packages/extension/src/background/handlers/__tests__/knowledge-source-handlers.test.ts` - passed, 12 files / 66 tests. Known expected stderr from the handler test logs the injected refresh failure while asserting the handler continues.
- `bun run test -- packages/extension/src/views/shared/__tests__/SourceBadge.test.tsx packages/extension/src/views/shared/__tests__/PrecedentIndicator.test.tsx packages/extension/src/views/shared/__tests__/ConfidenceTooltip.test.tsx packages/extension/src/views/Sidepanel/cards/__tests__/DraftCardProvenance.test.tsx packages/extension/src/views/Sidepanel/tabs/__tests__/NestSourcesSection.test.tsx packages/extension/src/views/Sidepanel/tabs/__tests__/RoostKnowledge.test.tsx packages/extension/src/views/Sidepanel/tabs/__tests__/RoostDecisionHistory.test.tsx packages/extension/src/views/Popup/__tests__/SourceHealthIndicator.test.tsx packages/extension/src/views/Popup/hooks/__tests__/usePopupOrchestration.test.ts` - passed, 9 files / 65 tests.
- `bun run plans validate` - passed, 64 plan files across 15 feature packs.
- `bun run validate:quick` - failed in the existing lint step after typecheck passed. The errors are
  outside this lane's owned surface: `packages/app/src/views/Receiver/ReceiverShell.tsx` has four
  SVG `lint/a11y/noSvgWithoutTitle` findings, and `packages/app/src/styles.css` needs formatter
  output. No feature-owned files were implicated.

## Confirmed Behavior

- Source registry CRUD, exact duplicate rejection, metadata updates, Yjs convergence, concurrent add,
  and offline add/reconnect are covered and green.
- `assertAllowedSource()` blocks private/local addresses, path traversal, credential paths, and
  unregistered URLs while allowing registered sample sources.
- Adapter fixture parsers and sanitizer behavior are covered and green.
- Graph entity CRUD, temporal facts, reasoning traces, compound confidence changes, snapshot
  serialization, and coop switching are covered and green.
- Retrieval covers text/traversal hybrid search, dedupe, source refs, context assembly, MRR >= 0.6,
  and no LLM invocation in retrieval logic.
- UI provenance and source-health surfaces are covered for `SourceBadge`, `DraftCardProvenance`,
  `RoostKnowledge`, `RoostDecisionHistory`, `NestSourcesSection`, and popup source health.
- Retrieval-before-work exists in source: `buildSkillContext()` retrieves flat memories and graph
  context before prompt assembly when the graph store has entities.

## Blockers

1. Source removal does not cascade to ingested graph content. `removeKnowledgeSource()` deletes the
   registry row only, and `GraphEntity` has no stale marker.
2. Source adapters are parse helpers, not allowlist-checked fetch wrappers. The plan contract that
   every adapter rejects non-allowlisted sources before fetch is not implemented at the adapter
   layer.
3. `handleRefreshKnowledgeSource()` does not run adapters. It marks active sources as freshly
   fetched and emits source-content observations, so recorded network/404/rate-limit adapter
   behavior is not exercised.
4. Durable memory provenance/confirmation semantics are not modeled. `AgentMemory` has no
   provenance label, confirmation status, source channel, provider/model metadata, task/trace ID, or
   unresolved-question fields.
5. Inferred and unconfirmed memories are not isolated from instruction-like prompt context. They are
   rendered as ordinary ordered memories.
6. Stale memory is ranked lower by age in `queryMemoriesForSkill()`, but it is not visibly labeled
   in prompt context or UI.

## Deferred Or Partial Scope

- Kuzu-WASM/IDBFS is deferred by current plan truth and was not attempted.
- Vector retrieval / embedding generation is not implemented.
- Hybrid retrieval temporal filtering is result-level; traversal still walks all relationships
  before filtering returned entities.
- Normalized duplicate detection is not proven beyond exact identifier matching.
- 100-entity timing, 1000-entity / 5000-edge IndexedDB size, and graph schema migration are not
  covered by the current tests.

## Lane Status Rationale

- `qa_pass_1` -> `done`: the Codex QA pass has been run and the evidence is recorded.
- `qa_pass_2` remains `blocked`: the feature should not move to Claude UX review until the state and
  runtime blockers above are fixed or explicitly descoped.
- Feature stage remains `active`: the shipped surface is partially validated, but the full product
  contract is not complete.

## Validation Caveat

The required quick gate is not green on current `main`, but the red output is unrelated to this QA
pass and outside the owned state/UI surfaces for `agent-knowledge-sandbox`. It should be handled by
the Receiver/app owner before treating `validate:quick` as release-green.
