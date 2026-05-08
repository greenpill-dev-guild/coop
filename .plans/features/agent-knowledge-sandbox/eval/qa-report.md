# QA Report

## Current State

- Status: QA pass 2 complete on 2026-05-08.
- Feature stage: active in `status.json` because the plan schema only allows active/backlog; all
  implementation and QA lanes are complete.
- Graph backend: snapshot-backed in-memory graph persisted through Dexie `graphSnapshots`.
- Deferred backend: Kuzu-WASM remains deferred and was not attempted.

## Fixes Closed During QA Pass 2

- Source removal now stales graph entities tied to the removed source and invalidates active
  relationships with matching endpoints or provenance.
- Source adapter dispatch checks `assertAllowedSource()` before fetch, then parses and sanitizes
  structured content for YouTube, GitHub, RSS, Reddit, NPM, and Wikipedia sources.
- Source refresh now runs the adapter dispatch path, records `lastFetchedAt` and entity counts, emits
  content observations per fetched item, and continues after per-source failures.
- Hybrid retrieval now includes vector search over entity embeddings, keeps stale entities ranked
  lower, and excludes stale entities from current temporal context.
- Persisted entity extraction output now receives deterministic local embeddings when an adapter or
  skill output does not provide one.
- `AgentMemory` now carries durable provenance label, confirmation status, source channel,
  provider/model metadata, trace/task IDs, and unresolved questions.
- Memory retrieval ranks confirmed/user-confirmed context above unconfirmed inferred context in the
  same freshness band.
- Prompt context labels inferred/unconfirmed memories as context-only and stale memories as stale
  context.
- Agent memory UI shows provenance, confirmation, source channel, and provider/model labels.

## Validation Run - 2026-05-08

- `bun run validate:typecheck` - passed.
- `bun run test -- packages/shared/src/contracts/__tests__/schema-knowledge.test.ts packages/shared/src/modules/knowledge-source/__tests__/source-registry.test.ts packages/shared/src/modules/knowledge-source/__tests__/allowlist.test.ts packages/shared/src/modules/knowledge-source/__tests__/source-sync.test.ts packages/shared/src/modules/knowledge-source/__tests__/activity-log.test.ts packages/shared/src/modules/graph/__tests__/graph-store.test.ts packages/shared/src/modules/graph/__tests__/graph-temporal.test.ts packages/shared/src/modules/graph/__tests__/graph-retrieval.test.ts packages/shared/src/modules/graph/__tests__/graph-context.test.ts packages/shared/src/modules/graph/__tests__/graph-retrieval-benchmark.test.ts packages/shared/src/modules/graph/__tests__/reasoning-trace.test.ts packages/shared/src/modules/graph/__tests__/reasoning-precedent.test.ts packages/shared/src/modules/graph/__tests__/knowledge-sandbox-integration.test.ts packages/shared/src/modules/graph/__tests__/knowledge-lint.test.ts packages/shared/src/modules/graph/__tests__/compound-loop.test.ts packages/shared/src/modules/agent/__tests__/memory.test.ts packages/shared/src/modules/storage/__tests__/db.test.ts` - passed, 17 files / 236 tests.
- `bun run test -- packages/extension/src/runtime/agent/adapters/__tests__/adapter-youtube.test.ts packages/extension/src/runtime/agent/adapters/__tests__/adapter-github.test.ts packages/extension/src/runtime/agent/adapters/__tests__/adapter-rss.test.ts packages/extension/src/runtime/agent/adapters/__tests__/adapter-reddit.test.ts packages/extension/src/runtime/agent/adapters/__tests__/adapter-npm.test.ts packages/extension/src/runtime/agent/adapters/__tests__/adapter-wikipedia.test.ts packages/extension/src/runtime/agent/adapters/__tests__/adapter-dispatch.test.ts packages/extension/src/runtime/agent/adapters/__tests__/sanitizer.test.ts packages/extension/src/runtime/agent/__tests__/graph-store-singleton.test.ts packages/extension/src/runtime/agent/__tests__/graph-persistence.test.ts packages/extension/src/runtime/agent/__tests__/runner-skills-prompt.test.ts packages/extension/src/runtime/__tests__/agent-knowledge.test.ts packages/extension/src/background/handlers/__tests__/knowledge-source-handlers.test.ts packages/extension/src/views/shared/__tests__/SourceBadge.test.tsx packages/extension/src/views/shared/__tests__/PrecedentIndicator.test.tsx packages/extension/src/views/shared/__tests__/ConfidenceTooltip.test.tsx packages/extension/src/views/Sidepanel/operator-sections/__tests__/AgentMemorySection.test.tsx packages/extension/src/views/Sidepanel/cards/__tests__/DraftCardProvenance.test.tsx packages/extension/src/views/Sidepanel/tabs/__tests__/NestSourcesSection.test.tsx packages/extension/src/views/Sidepanel/tabs/__tests__/RoostKnowledge.test.tsx packages/extension/src/views/Sidepanel/tabs/__tests__/RoostDecisionHistory.test.tsx packages/extension/src/views/Popup/__tests__/SourceHealthIndicator.test.tsx packages/extension/src/views/Popup/hooks/__tests__/usePopupOrchestration.test.ts` - passed, 23 files / 136 tests. Known expected stderr from the handler test logs the injected refresh failure while asserting the handler continues.
- `bun run plans validate` - passed for this closeout, 64 plan files across 15 feature packs. A
  later full-tree rerun in the dirty worktree failed on unrelated
  `.plans/features/next-step-review/qa/qa-claude.todo.md` frontmatter drift versus its
  `status.json` lane status.
- `bun run validate:quick` - passed.

## Confirmed Behavior

- Source registry CRUD, exact duplicate rejection, metadata updates, removal, stale graph cascade,
  Yjs convergence, concurrent add, and offline add/reconnect are covered and green.
- Source allowlisting blocks unregistered URLs, private/local addresses, credential paths, and path
  traversal before adapter fetch.
- Adapter parser, dispatch, sanitizer, refresh handler, and failure-continuation paths are covered
  and green.
- Graph entity CRUD, temporal facts, stale source labels, reasoning traces, compound confidence
  changes, snapshot serialization, coop switching, and deterministic entity embeddings are covered
  and green.
- Retrieval covers text, traversal, vector, hybrid dedupe, stale ranking, current-context stale
  exclusion, source refs, context assembly, MRR >= 0.6, and no LLM invocation in retrieval logic.
- UI provenance and source-health surfaces are covered for `SourceBadge`, `DraftCardProvenance`,
  `AgentMemorySection`, `RoostKnowledge`, `RoostDecisionHistory`, `NestSourcesSection`, and popup
  source health.
- Retrieval-before-work remains wired: `buildSkillContext()` retrieves flat memories and graph
  context before prompt assembly when a graph store is populated.

## Deferred Or Partial Scope

- Kuzu-WASM/IDBFS remains deferred by plan decision. This closeout did not attempt it.
- Snapshot graph traversal still scans in-memory relationships; there is no Kuzu query planner yet.
- Normalized duplicate source detection beyond exact identifier matching is not expanded in this
  pass.
- Browser/manual visual QA was not run separately; pass 2 confidence is from source review and
  targeted component/runtime tests.

## Lane Status Rationale

- `qa_pass_1` -> `done`: original blockers were recorded and then resolved.
- `qa_pass_2` -> `done`: state/runtime/UI blockers are fixed with targeted tests and green gates.
- Feature stage remains `active` for schema compatibility; shipped backend is snapshot persistence
  and Kuzu-WASM is documented as deferred.
