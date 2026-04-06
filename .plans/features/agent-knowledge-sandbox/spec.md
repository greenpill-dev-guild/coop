# Agent Knowledge Sandbox: Curated Sources + Graph Memory

**Feature**: `agent-knowledge-sandbox`
**Status**: Draft
**Source Branch**: `feature/agent-knowledge-sandbox`
**Created**: `2026-04-05`
**Last Updated**: `2026-04-05`

## Summary

Give the Coop agent a sandboxed knowledge environment — allowlisted sources (YouTube, GitHub, RSS, Reddit, NPM) with graph-based memory (Kuzu-WASM) replacing flat Dexie records. Members curate what the agent can learn from; the agent builds a temporal knowledge graph and uses it for richer, explainable recommendations.

The "YouTube Kids for agents" model: sandbox the knowledge, not just the execution.

## Why Now

- Agent recommendations are currently context-poor — flat memory with no relationships, no temporal validity, no source provenance
- Knowledge skills exist but are limited to SKILL.md imports — no structured external sources
- The agent has no way to learn from YouTube channels, GitHub repos, or RSS feeds that the coop follows
- Reasoning traces evaporate after skill execution — no institutional memory, no precedent system
- The Neo4j Context Graph talk validated that graph memory + reasoning traces + hybrid retrieval is production-ready and the patterns map directly to Coop's architecture

## Scope

### In Scope

**Phase 1 — Source Registry** (foundation)
- `KnowledgeSource` Dexie table with type, identifier, label, active, addedBy, addedAt
- `assertAllowedSource()` enforcement replacing/extending `assertSafeSkillUrl()`
- Yjs sync of source registry across coop members
- Nest > Sources UI for managing allowlisted sources

**Phase 2 — Source Adapters** (ingestion)
- YouTube adapter (transcript extraction via `youtube-caption-extractor`)
- GitHub adapter (Contents API / GitExtract for README, source, issues)
- RSS/Atom adapter (`rss-parser` for articles, metadata)
- Reddit adapter (JSON API for posts, top comments)
- NPM adapter (registry API for metadata, README)
- Shared content sanitizer (prompt injection protection)

**Phase 3 — Entity Extraction Skill** (intelligence)
- New agent skill using existing 3-tier cascade (heuristic → Transformers → WebLLM)
- POLE+O entity model (Person, Organization, Location, Event + Object)
- Eval cases with structural + semantic assertions
- Confidence scoring for entity extraction output

**Phase 4 — Graph Memory Layer** (storage)
- Kuzu-WASM integration with IndexedDB persistence (IDBFS)
- POLE+O node tables and typed edge tables
- Temporal edges with validity windows (t_valid, t_invalid)
- Entity CRUD, relationship management, temporal queries

**Phase 5 — Graph Retrieval** (search)
- Hybrid search: vector similarity + BM25 full-text + graph traversal
- Embedding generation via Transformers.js tier
- Context assembly for skill prompts (token-budgeted)
- No LLM calls during retrieval (hard requirement)

**Phase 6 — Reasoning Traces** (learning)
- Record decision traces as precedent nodes linked to skill runs
- Precedent query by observation similarity
- Confidence adjustment based on past decision outcomes
- Positive/negative precedent tracking

**Phase 7 — Integration** (wiring)
- Wire adapters into observation triggers
- Wire graph retrieval into skill context assembly
- Wire reasoning traces into skill completion flow
- A/B evaluation: graph memory vs flat memory quality comparison
- UI integration across all 4 surfaces (Nest, Roost, Chickens, Popup)

### Out of Scope

- Server-side graph database (Neo4j) — stays browser-only for now
- Cross-coop source sharing — future feature on top of this
- Generative UI / agent-created visualizations
- Voice/audio source adapters
- Real-time streaming ingestion (batch/poll only)

## User-Facing Outcome

**Members can:**
- Add YouTube channels, GitHub repos, RSS feeds, subreddits, NPM packages as knowledge sources
- See what the agent knows (topic bars) and why it recommended something (sourced from + track record)
- Review agent decisions with full provenance (which sources, which precedents)
- See source health at a glance (popup dot, Nest freshness indicators)

**Operators can:**
- Configure source allowlists per coop
- Monitor graph size and entity counts
- Review agent decision history with reasoning traces
- See cascade effects before removing sources

**What stays the same:**
- The 16 compiled skills continue working (gain richer context from graph)
- Local-first principle: graph stays in IndexedDB, synced implicitly through shared source registries
- Human-in-the-loop: agent proposes, members decide
- Passkey-first identity, Safe multisig for onchain actions

## Technical Notes

### Primary packages
- `@coop/shared` — schemas (KnowledgeSource, GraphEntity, ReasoningTrace), source registry module, graph memory module
- `packages/extension` — source adapters, entity extraction skill, graph retrieval integration, UI components
- No API changes — sources are fetched client-side from allowlisted URLs

### Key constraints
- Kuzu-WASM binary is ~4MB — must lazy-load, not bundle
- Graph + IndexedDB must coexist with Dexie (both use IndexedDB, different stores)
- Entity extraction must use existing inference cascade — no new model infrastructure
- No LLM calls during graph retrieval (performance requirement)
- Source adapters must go through `assertAllowedSource()` — no direct fetch from unapproved URLs

### New dependencies
- `@kuzu/kuzu-wasm` — embedded graph DB (or Vela-Engineering fork for concurrent writes)
- `youtube-caption-extractor` — YouTube transcript extraction
- `rss-parser` — RSS/Atom feed parsing

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Kuzu-WASM over LevelGraph | Cypher queries, vector indexes, full-text search, demonstrated Graph RAG with WebLLM |
| 2 | POLE+O entity model | Matches Neo4j agent-memory pattern, domain-configurable, proven in production |
| 3 | Temporal edges (Graphiti pattern) | Facts have validity windows — handles contradictions, preserves history |
| 4 | No LLM during retrieval | Critical for in-browser performance — inference only during skill execution |
| 5 | Source registry in Dexie + Yjs | Same pattern as knowledgeSkills table. Yjs sync gives all members shared sources |
| 6 | Vellum material language for UI | Brand-aligned. Source management = Command Surface/Parchment. Agent knowledge = Ambient/Gauze |
| 7 | Phased delivery (7 phases) | Each phase has a gate. Later phases depend on earlier ones. Graph memory ships incrementally |
| 8 | Entity extraction as new skill | Uses existing cascade + eval framework. No new infrastructure |
| 9 | Adapters are pure functions | (source, registry) → StructuredContent. Easy to test, no side effects |

## Lane Split

| Lane | Agent | Expected Scope |
|------|-------|----------------|
| UI | Claude | Nest Sources section, Roost Knowledge/Decision History, DraftCard provenance, Popup pulse, shared components |
| State | Codex | KnowledgeSource schema, source registry module, graph memory module, entity extraction schemas, reasoning trace schemas |
| API | — | No API changes needed (client-side source fetching) |
| Contracts | — | No contract changes needed |
| QA 1 | Codex | Source registry CRUD, adapter parsing, graph CRUD, retrieval correctness, temporal queries |
| QA 2 | Claude | UX flows, progressive disclosure behavior, provenance display, E2E confidence |

## Acceptance Criteria

### Phase 1 — Source Registry
- [ ] Member can add a YouTube channel/GitHub repo/RSS feed/subreddit/NPM package
- [ ] Sources sync via Yjs across coop members
- [ ] `assertAllowedSource()` blocks non-registered URLs
- [ ] `assertAllowedSource()` blocks denylist entries (private IPs, credentials)
- [ ] Nest > Sources UI shows sources with type, freshness, entity count, active toggle

### Phase 2 — Source Adapters
- [ ] YouTube adapter extracts transcript from allowlisted channel video
- [ ] GitHub adapter extracts README + tree from allowlisted repo
- [ ] RSS adapter parses feed and returns new articles since last fetch
- [ ] Reddit adapter returns posts + top comments from allowlisted subreddit
- [ ] NPM adapter returns package metadata + README
- [ ] Content sanitizer blocks known prompt injection patterns
- [ ] Non-allowlisted sources are rejected before any fetch

### Phase 3 — Entity Extraction Skill
- [ ] Skill extracts POLE+O entities from adapter output
- [ ] Skill uses existing inference cascade (heuristic → Transformers → WebLLM)
- [ ] Eval cases pass at threshold >= 0.6
- [ ] Confidence scoring implemented for entity extraction output
- [ ] >= 60% of extractions complete at Tier 2 (Transformers)

### Phase 4 — Graph Memory Layer
- [ ] Kuzu-WASM initializes with IDBFS persistence
- [ ] POLE+O node tables and edge tables created
- [ ] Entity CRUD round-trips through close/reopen
- [ ] Temporal edges: currentFacts() never returns invalidated edges
- [ ] 100-entity graph queries complete in < 50ms

### Phase 5 — Graph Retrieval
- [ ] Hybrid search returns relevant entities for known queries (MRR >= 0.6)
- [ ] Zero LLM invocations during retrieval (enforced by test)
- [ ] Context assembly stays within 2000 token budget
- [ ] Embedding generation uses Transformers.js tier

### Phase 6 — Reasoning Traces
- [ ] Skill runs record reasoning traces linked to source entities
- [ ] Precedent query finds similar past decisions
- [ ] Positive precedents boost confidence >= 0.05
- [ ] Negative precedents decrease confidence >= 0.05

### Phase 7 — Integration
- [ ] All existing eval cases pass at or above current thresholds (zero regression)
- [ ] Agent cycle time stays within 120% of baseline
- [ ] Graph-enhanced skills show >= 10% quality improvement (A/B evaluation)
- [ ] UI surfaces work: Nest Sources, Roost Knowledge, DraftCard provenance, Popup pulse

## Validation Plan

- **Unit**: Source registry CRUD, adapter parsing, entity extraction, graph CRUD, retrieval relevance, temporal correctness, reasoning traces
- **Integration**: Full pipeline: source → adapter → extraction → graph → retrieval → skill context → output
- **E2E**: Member adds source → agent ingests → agent uses in recommendation → member sees provenance
- **A/B**: Baseline (flat memory) vs graph-enhanced (graph retrieval) quality comparison on eval corpus
- **Regression**: All existing skill eval cases + unit tests must pass at pre-implementation thresholds

## References

- **Exploration doc**: `.plans/features/agent-knowledge-sandbox/exploration.md` (1600+ lines, full research)
- **Design skill**: `.claude/skills/design/` (4-lens framework, Vellum material, UX wireframes in exploration §10)
- **Neo4j talk**: https://youtu.be/qMV64p-4Deo (Will, Neo4j AI Innovation — context graphs, POLE+O, reasoning memory)
- **Zep paper**: https://arxiv.org/abs/2501.13956 (temporal knowledge graph for agent memory)
- **Kuzu-WASM**: https://blog.kuzudb.com/post/kuzu-wasm-rag/ (in-browser Graph RAG)
- **Related plans**: `.plans/features/agent-evolution/` (Workstream 1 shares runtime skill infrastructure)
