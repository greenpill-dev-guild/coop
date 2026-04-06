# QA Pass 1 — Codex

Branch: `handoff/qa-codex/agent-knowledge-sandbox`
Triggered by: UI + State lanes complete

## Source Registry

- [ ] Source CRUD round-trips through Dexie without data loss
- [ ] Y.Map sync converges within 3 Yjs updates between two docs
- [ ] Concurrent source add from two peers merges correctly
- [ ] Offline source add syncs on reconnect
- [ ] `assertAllowedSource()` blocks 100% of denylist entries
- [ ] `assertAllowedSource()` passes for all registered sources
- [ ] Source removal cascades correctly to ingested content
- [ ] Duplicate source detection works by normalized identifier

## Source Adapters

- [ ] Each adapter passes with recorded API response fixtures
- [ ] Each adapter rejects non-allowlisted sources
- [ ] Content sanitizer catches all known prompt injection patterns
- [ ] Content truncation works at size limit boundary
- [ ] Adapter error handling (network failure, 404, rate limit) is graceful

## Graph Memory

- [ ] Entity CRUD survives write → close → reopen → read
- [ ] Temporal correctness: `currentFacts()` never returns invalidated edges
- [ ] `factsAt(timestamp)` returns edges valid at that point
- [ ] Conflicting facts detected and newer invalidates older
- [ ] 100-entity graph queries < 50ms
- [ ] 1000-entity graph with 5000 edges stays under 10MB IndexedDB
- [ ] Graph schema migration path works (v1 → v2)

## Graph Retrieval

- [ ] BM25 search returns expected entities for test queries
- [ ] Vector search returns expected entities for embedding queries
- [ ] Hybrid search deduplicates across methods
- [ ] Hybrid search respects temporal validity (current facts only)
- [ ] Retrieval MRR >= 0.6 on 20-query benchmark corpus
- [ ] Context assembly stays within 2000 token budget
- [ ] Zero LLM invocations during retrieval (verified via mock assertions)

## Reasoning Traces

- [ ] Trace creation links to skill run and source entities
- [ ] Precedent query finds similar past decisions
- [ ] Positive precedents boost confidence >= 0.05
- [ ] Negative precedents decrease confidence >= 0.05
- [ ] Trace quota enforcement (max 500) works with oldest-first pruning

## Integration

- [ ] All existing unit tests pass (zero regressions)
- [ ] All existing eval cases pass at current thresholds
- [ ] Agent cycle time within 120% of baseline
- [ ] Flat agentMemories table still works (backwards compat)
