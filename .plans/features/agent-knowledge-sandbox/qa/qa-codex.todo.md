---
feature: agent-knowledge-sandbox
title: Agent knowledge sandbox QA pass 1
lane: qa
agent: codex
status: done
source_branch: main
work_branch: main
depends_on:
  - ../lanes/state.codex.todo.md
  - ../lanes/ui.claude.todo.md
skills:
  - qa
  - state-logic
  - api
  - contracts
qa_order: 1
handoff_in: handoff/qa-codex/agent-knowledge-sandbox
handoff_out: handoff/qa-claude/agent-knowledge-sandbox
updated: 2026-05-07
---

# QA Pass 1 - Codex

Status: closed with blockers on 2026-05-07.

This pass validates the landed state/UI work honestly. The snapshot-backed graph store is the
current shipped backend; Kuzu-WASM remains deferred. QA pass 2 should stay blocked until the
unimplemented product-contract gaps below are resolved or explicitly descoped.

## Validation Evidence

- [x] Source registry, Yjs sync, graph, graph retrieval, graph context, reasoning, agent-memory, and
  storage tests passed: 16 files / 215 tests.
- [x] Source adapter parser, sanitizer, graph snapshot, graph persistence, knowledge-source handler,
  and agent-knowledge tests passed: 12 files / 66 tests.
- [x] Relevant provenance/source-health UI tests passed: 9 files / 65 tests.
- [x] Final plan/quick gates recorded in `../eval/qa-report.md` (`plans validate` passed;
  `validate:quick` failed on unrelated Receiver/app lint outside this lane).

## Result By Area

### Source Registry

- [x] Dexie CRUD, list filters, metadata updates, exact duplicate rejection, and delete-by-id are
  covered by `source-registry.test.ts`.
- [x] Y.Map write/read, concurrent add, remove propagation, and offline add/reconnect are covered by
  `source-sync.test.ts`.
- [x] `assertAllowedSource()` blocks unregistered URLs, private/local addresses, credential paths,
  and path traversal; registered YouTube/GitHub/RSS examples pass.
- [ ] Blocker: source removal does not cascade to ingested graph content. `removeKnowledgeSource()`
  deletes the registry row only, and graph entities have no stale marker.
- [ ] Partial: duplicate source detection is exact `[coopId+identifier]`; normalized equivalent
  identifiers are not proven.

### Source Adapters

- [x] Fixture parsers exist for YouTube, GitHub, RSS, Reddit, NPM, and Wikipedia.
- [x] Sanitizer strips the known prompt-injection patterns and enforces the content-size boundary.
- [ ] Blocker: adapter modules are parse helpers, not allowlist-checked fetch wrappers. The QA plan's
  "reject non-allowlisted source before fetch" contract is not yet implemented at the adapter layer.
- [ ] Partial: `handleRefreshKnowledgeSource()` updates `lastFetchedAt` and emits observations but
  does not dispatch the adapters or exercise network/404/rate-limit behavior.

### Graph Memory And Retrieval

- [x] In-memory entity CRUD, temporal facts, reasoning traces, precedent adjustment, compound loop,
  snapshot serialization, and coop switching are covered by targeted tests.
- [x] BM25-style text search, traversal, hybrid dedupe, context assembly, MRR >= 0.6, and no-LLM
  retrieval are covered by targeted tests.
- [x] Retrieval-before-work is wired: `buildSkillContext()` queries flat memories and graph context
  before prompt assembly when a graph store is populated.
- [ ] Deferred: Kuzu-WASM/IDBFS backend is not implemented and remains out of scope for this pass.
- [ ] Deferred: vector retrieval / embedding generation is not implemented.
- [ ] Partial: current temporal filtering is result-level; traversal still scans all relationships
  before filtering returned entities.
- [ ] Not proven: 1000-entity / 5000-edge IndexedDB size, graph schema migration, and 100-entity
  query timing are not covered by the current suite.

### Provenance, Confirmation, And Stale Behavior

- [x] Graph context carries source refs, DraftCard provenance shows "Sourced from" badges for agent
  drafts, and source health surfaces show stale/fresh state in Nest and the popup.
- [x] Flat memory retrieval ranks fresh memories above old memories when the age gap is large.
- [ ] Blocker: `AgentMemory` has no durable provenance label, confirmation status, source channel,
  provider/model metadata, task/trace ID, or unresolved-question fields.
- [ ] Blocker: inferred/unconfirmed memories are included in prompts as ordinary ordered memories;
  they are not distinguished from user-confirmed guidance.
- [ ] Partial: stale memory is ranked lower by age, but not visibly labeled in memory prompt context
  or UI.

## Handoff

- QA pass 1 is complete as an evidence-gathering pass.
- QA pass 2 remains blocked.
- Required follow-up is state/runtime work, not Kuzu-WASM: close the adapter allowlist/fetch wrapper
  gap, source-removal cascade/stale marking, vector retrieval descoping or implementation, and
  durable memory provenance/confirmation semantics.
