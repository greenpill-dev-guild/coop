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
updated: 2026-05-08
---

# QA Pass 1 - Codex

Status: closed on 2026-05-08 after QA pass 2 follow-up.

This pass validates the landed state/UI work honestly. The snapshot-backed graph store is the
current shipped backend; Kuzu-WASM remains deferred. The pass 1 blockers were resolved in the owned
state/runtime/UI surfaces during QA pass 2.

## Validation Evidence

- [x] Source registry, Yjs sync, graph, graph retrieval, graph context, reasoning, agent-memory, and
  storage tests passed: 17 files / 236 tests.
- [x] Source adapter parser/dispatch, sanitizer, graph snapshot, graph persistence,
  knowledge-source handler, agent-knowledge, provenance, and source-health UI tests passed: 23 files
  / 136 tests.
- [x] `bun run plans validate` passed for this closeout, 64 plan files across 15 feature packs.
  Later rerun in the dirty worktree failed on unrelated `next-step-review` QA status drift.
- [x] `bun run validate:quick` passed.

## Result By Area

### Source Registry

- [x] Dexie CRUD, list filters, metadata updates, exact duplicate rejection, and delete-by-id are
  covered by `source-registry.test.ts`.
- [x] Y.Map write/read, concurrent add, remove propagation, and offline add/reconnect are covered by
  `source-sync.test.ts`.
- [x] `assertAllowedSource()` blocks unregistered URLs, private/local addresses, credential paths,
  and path traversal; registered YouTube/GitHub/RSS examples pass.
- [x] Source removal cascades to ingested graph content when graph context is available:
  `removeKnowledgeSource()` marks matching entities stale and invalidates active relationships.
- [ ] Partial: duplicate source detection is exact `[coopId+identifier]`; normalized equivalent
  identifiers are not proven.

### Source Adapters

- [x] Fixture parsers exist for YouTube, GitHub, RSS, Reddit, NPM, and Wikipedia.
- [x] Sanitizer strips the known prompt-injection patterns and enforces the content-size boundary.
- [x] Adapter dispatch rejects non-allowlisted sources before fetch.
- [x] `handleRefreshKnowledgeSource()` dispatches adapters, updates source metadata, emits one
  source-content observation per structured content item, and continues after per-source failures.

### Graph Memory And Retrieval

- [x] In-memory entity CRUD, temporal facts, reasoning traces, precedent adjustment, compound loop,
  snapshot serialization, and coop switching are covered by targeted tests.
- [x] BM25-style text search, traversal, hybrid dedupe, context assembly, MRR >= 0.6, and no-LLM
  retrieval are covered by targeted tests.
- [x] Retrieval-before-work is wired: `buildSkillContext()` queries flat memories and graph context
  before prompt assembly when a graph store is populated.
- [x] Vector retrieval is implemented over entity embeddings and participates in hybrid search.
- [x] Persisted entity extraction output receives deterministic local embeddings when no embedding is
  supplied.
- [ ] Deferred: Kuzu-WASM/IDBFS backend is not implemented and remains out of scope for this pass.
- [ ] Partial: current temporal filtering is result-level; traversal still scans all relationships
  before filtering returned entities.
- [ ] Not proven: 1000-entity / 5000-edge IndexedDB size, graph schema migration, and 100-entity
  query timing are not covered by the current suite.

### Provenance, Confirmation, And Stale Behavior

- [x] Graph context carries source refs, DraftCard provenance shows "Sourced from" badges for agent
  drafts, and source health surfaces show stale/fresh state in Nest and the popup.
- [x] Flat memory retrieval ranks fresh memories above old memories when the age gap is large.
- [x] `AgentMemory` records provenance label, confirmation status, source channel, provider/model
  metadata, task/trace ID, and unresolved questions.
- [x] Confirmed/user-confirmed memory ranks ahead of unconfirmed inferred memory in the same
  freshness band.
- [x] Inferred/unconfirmed memories are labeled as context-only in prompts; stale memories are labeled
  as stale context.
- [x] Agent memory UI surfaces provenance, confirmation, source channel, and provider/model labels.

## Handoff

- QA pass 1 blockers are resolved and revalidated.
- QA pass 2 is complete on `main`.
- Kuzu-WASM remains deferred; snapshot-backed graph persistence is the shipped backend for this
  plan closeout.
