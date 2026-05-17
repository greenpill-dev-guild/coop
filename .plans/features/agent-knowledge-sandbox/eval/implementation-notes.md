# Implementation Notes

## 2026-05-16 Context Graph Memory Upgrade

- Kept v1 on the existing browser-native Dexie/snapshot graph backend. Kuzu-WASM and Neo4j remain future-compatible experiments, not dependencies for this wave.
- Added the coop memory charter as part of the shared coop soul projection: goals, opportunity thesis, desired signals, anti-signals, evidence standards, vocabulary, prohibited topics, and confidence threshold are derived at bootstrap from purpose/setup insights and can be revised through existing coop-detail update flows.
- Made source ingest body-aware without changing the trust model: fetched `StructuredContent` bodies are persisted locally as encrypted `knowledge-source-content` payloads, while shared Yjs source registry sync only carries source metadata.
- Wired the agent context path so source-content observations reference persisted content IDs, prompts include persisted source body snippets as observed/unconfirmed context, graph retrieval is passed into skill prompts and trace inventory, and precedent traces can apply a bounded confidence adjustment.
- Reasoning traces now preserve summary-level provenance fields (provider/model, prompt hash, source refs, context labels, precedent IDs, base confidence, adjustment, outcome) without storing hidden chain-of-thought or raw prompts in the graph trace.
- The UI pass remains provenance-first: draft cards expose source labels, observed/unconfirmed memory state, precedent signal, and confidence without adding a graph explorer or raw source-body display.

## 2026-04-09

- Normalized this pack back to the canonical planning model. The old `polish` lane was retired as a
  lane file and folded into these notes because the remaining work is no longer a separate active
  execution stream.
- State and UI implementation are materially landed:
  - knowledge-source schemas, handlers, and allowlisting exist
  - graph context is injected into agent prompting
  - sidepanel and popup surfaces expose source and knowledge health state
- The graph backend is still an interface-compatible in-memory store persisted through serialized
  snapshots, not the Kuzu-WASM backend described in earlier design notes.
- QA remains blocked until the pack has an honest first pass against source CRUD, retrieval, graph
  persistence, and provenance surfaces.

## 2026-04-19 Post-hardening reconciliation

- Hardening commit 484078d did not edit the snapshot-backed graph store or source-registry modules
  that underpin this pack; it broadened agent-runtime coverage around the consumer side (graph
  persistence tests, entity-extraction quality fixtures, provider contracts). UI and state
  surfaces named in `done_when` still exist in the repo:
  `NestSourcesSection.tsx`, `SourceBadge.tsx`, `PrecedentIndicator.tsx`, `assertAllowedSource()`,
  `upsertEntity()`, `hybridSearch()`, `recordReasoningTrace()`.
- `status.json` `qa_pass_1` flipped `blocked` → `ready`. `qa_pass_2` remains blocked on pass 1.
- No fresh risk surfaced during reconciliation. Graph persistence is still snapshot-based
  (Kuzu-WASM deferred) — QA pass 1 should validate reopen/reload flow as listed in
  `qa/qa-codex.todo.md`.
