---
feature: agent-knowledge-sandbox
title: Agent knowledge sandbox state lane
lane: state
agent: codex
status: todo
source_branch: feature/agent-knowledge-sandbox
work_branch: codex/state/agent-knowledge-sandbox
depends_on:
  - ../spec.md
owned_paths:
  - packages/shared/src/contracts/schema-knowledge.ts
  - packages/shared/src/modules/knowledge-source
  - packages/shared/src/modules/graph
  - packages/extension/src/runtime/agent/adapters
  - packages/extension/src/skills/entity-extractor
done_when:
  - assertAllowedSource(
  - upsertEntity(
  - hybridSearch(
  - recordReasoningTrace(
skills:
  - state-logic
  - shared
  - testing
updated: 2026-04-06
---

# State Lane — Codex (TDD: Red → Green → Refactor)

Owner: Codex
Branch: `codex/state/agent-knowledge-sandbox`

Every phase follows strict red-green-refactor. Tests are written FIRST, then
minimal implementation to make them pass, then cleanup. No implementation
without a failing test. No phase ships without its gate passing.

---

## Phase 1: Source Registry

### 1.1 RED — Write failing tests + fixtures

- [ ] Create `packages/shared/src/modules/knowledge-source/__tests__/fixtures.ts`
  - `makeKnowledgeSource({type, identifier, coopId, ...})` factory
  - Fixtures for each source type: youtube, github, rss, reddit, npm
  - Denylist fixture URLs (private IPs, localhost, credential paths)

- [ ] Create `packages/shared/src/modules/knowledge-source/__tests__/source-registry.test.ts`
  - `createKnowledgeSource()` stores to Dexie with correct schema
  - `createKnowledgeSource()` rejects duplicate identifier for same coop
  - `removeKnowledgeSource()` deletes by id
  - `removeKnowledgeSource()` cascades: marks ingested entities as stale
  - `listKnowledgeSources()` filters by coopId
  - `listKnowledgeSources()` filters by type
  - `listKnowledgeSources()` filters by active status
  - `updateKnowledgeSourceMeta()` updates lastFetchedAt and entityCount

- [ ] Create `packages/shared/src/modules/knowledge-source/__tests__/allowlist.test.ts`
  - `assertAllowedSource()` passes for registered youtube channel
  - `assertAllowedSource()` passes for registered github repo
  - `assertAllowedSource()` passes for registered rss feed URL
  - `assertAllowedSource()` throws for unregistered URL
  - `assertAllowedSource()` throws for private IP (127.0.0.1, 10.x, 192.168.x)
  - `assertAllowedSource()` throws for localhost variants
  - `assertAllowedSource()` throws for credential file paths (.env, .ssh)
  - `assertAllowedSource()` handles subdomain normalization
  - `assertAllowedSource()` handles path traversal attempts (../)

- [ ] Create `packages/shared/src/modules/knowledge-source/__tests__/source-sync.test.ts`
  - Sources write to Y.Map('knowledge-sources-v1')
  - Source read from Y.Map returns correct data
  - Concurrent add from two Y.Docs merges without data loss
  - Remove propagates between two Y.Docs
  - Offline add syncs when Y.Docs reconnect

> All tests FAIL at this point — no implementation exists.

### 1.2 GREEN — Minimal implementation

- [ ] Create `packages/shared/src/contracts/schema-knowledge.ts`
  - `knowledgeSourceTypeSchema` — z.enum(['youtube', 'github', 'rss', 'reddit', 'npm'])
  - `knowledgeSourceSchema` — id, type, identifier, label, coopId, addedBy, addedAt, lastFetchedAt, entityCount, active
  - `KnowledgeSource` type export

- [ ] Modify `packages/shared/src/modules/storage/db-schema.ts`
  - Version 19: add `knowledgeSources` table with indexes (id, coopId, type, active, identifier)

- [ ] Create `packages/shared/src/modules/knowledge-source/knowledge-source.ts`
  - `createKnowledgeSource(db, source)` — insert with duplicate check
  - `removeKnowledgeSource(db, id)` — delete
  - `listKnowledgeSources(db, filters)` — query with optional coopId, type, active
  - `updateKnowledgeSourceMeta(db, id, {lastFetchedAt, entityCount})` — partial update

- [ ] Create `packages/shared/src/modules/knowledge-source/allowlist.ts`
  - `assertAllowedSource(db, url, sourceType)` — check registry + denylist
  - Extract denylist from existing `assertSafeSkillUrl()` patterns

- [ ] Create `packages/shared/src/modules/knowledge-source/sync-sources.ts`
  - `writeSourceToYDoc(doc, source)` — Y.Map set
  - `readSourcesFromYDoc(doc)` — Y.Map entries
  - `watchSourceChanges(doc, callback)` — Y.Map observe

- [ ] Create `packages/shared/src/modules/knowledge-source/index.ts` — barrel exports
- [ ] Modify `packages/shared/src/modules/index.ts` — add knowledge-source re-export
- [ ] Modify `packages/shared/src/contracts/index.ts` — add schema-knowledge re-export

> Run tests: all source-registry.test.ts + allowlist.test.ts + source-sync.test.ts PASS.

### 1.3 REFACTOR

- [ ] Extract shared URL normalization between `assertAllowedSource()` and `assertSafeSkillUrl()`
- [ ] Align denylist patterns — single source of truth for blocked URL patterns
- [ ] Add `unit:knowledge-registry` suite to `scripts/validate.ts`

**Gate**: `bun run validate unit:knowledge-registry` passes

---

## Phase 2: Source Adapters

### 2.1 RED — Write failing tests + fixtures

- [ ] Create `packages/extension/src/runtime/agent/adapters/__tests__/fixtures/`
  - `youtube-transcript-response.json` — recorded API response (happy path)
  - `youtube-no-captions.json` — video without captions
  - `github-repo-contents.json` — recorded Contents API response
  - `github-404.json` — non-existent repo
  - `rss-feed-atom.xml` — sample Atom feed
  - `rss-feed-rss2.xml` — sample RSS 2.0 feed
  - `reddit-subreddit-hot.json` — recorded JSON API response
  - `npm-package-meta.json` — recorded registry API response

- [ ] Create `packages/extension/src/runtime/agent/adapters/__tests__/adapter-youtube.test.ts`
  - `fetchYouTubeTranscript()` returns StructuredContent for fixture response
  - `fetchYouTubeTranscript()` throws for non-allowlisted channel
  - `fetchYouTubeTranscript()` returns empty content for no-captions fixture
  - `parseTranscriptSegments()` chunks into time-stamped paragraphs

- [ ] Create `packages/extension/src/runtime/agent/adapters/__tests__/adapter-github.test.ts`
  - `fetchGitHubRepoContext()` returns StructuredContent for fixture
  - `fetchGitHubRepoContext()` throws for non-allowlisted repo
  - `fetchGitHubRepoContext()` handles 404 fixture gracefully

- [ ] Create `packages/extension/src/runtime/agent/adapters/__tests__/adapter-rss.test.ts`
  - `fetchRSSFeed()` parses Atom fixture correctly
  - `fetchRSSFeed()` parses RSS 2.0 fixture correctly
  - `fetchRSSFeed()` throws for non-allowlisted feed
  - `fetchRSSFeed()` deduplicates by article GUID
  - `fetchRSSFeed()` returns only items after lastFetchedAt

- [ ] Create `packages/extension/src/runtime/agent/adapters/__tests__/adapter-reddit.test.ts`
  - `fetchRedditPosts()` returns posts with comments from fixture
  - `fetchRedditPosts()` throws for non-allowlisted subreddit

- [ ] Create `packages/extension/src/runtime/agent/adapters/__tests__/adapter-npm.test.ts`
  - `fetchNPMPackageInfo()` returns metadata from fixture
  - `fetchNPMPackageInfo()` throws for non-allowlisted package
  - `fetchNPMPackageInfo()` handles scoped packages (@org/pkg)

- [ ] Create `packages/extension/src/runtime/agent/adapters/__tests__/sanitizer.test.ts`
  - `sanitizeIngested()` strips `<system>` injection tags
  - `sanitizeIngested()` strips `IGNORE PREVIOUS INSTRUCTIONS` patterns
  - `sanitizeIngested()` strips embedded base64 payloads
  - `sanitizeIngested()` preserves legitimate markdown (headers, links, code blocks)
  - `sanitizeIngested()` truncates content above 50KB limit
  - `sanitizeIngested()` returns empty for entirely malicious input

> All tests FAIL — no adapters exist yet.

### 2.2 GREEN — Minimal implementation

- [ ] Create `packages/extension/src/runtime/agent/adapters/types.ts`
  - `StructuredContent` type: { title, body, metadata, sourceRef, fetchedAt }

- [ ] Create `packages/extension/src/runtime/agent/adapters/youtube.ts`
  - `fetchYouTubeTranscript(videoUrl, registry)` → StructuredContent
  - Uses `youtube-caption-extractor` (add to extension/package.json)

- [ ] Create `packages/extension/src/runtime/agent/adapters/github.ts`
  - `fetchGitHubRepoContext(identifier, registry)` → StructuredContent

- [ ] Create `packages/extension/src/runtime/agent/adapters/rss.ts`
  - `fetchRSSFeed(feedUrl, registry)` → StructuredContent[]
  - Uses `rss-parser` (add to extension/package.json)

- [ ] Create `packages/extension/src/runtime/agent/adapters/reddit.ts`
  - `fetchRedditPosts(subreddit, registry)` → StructuredContent[]

- [ ] Create `packages/extension/src/runtime/agent/adapters/npm.ts`
  - `fetchNPMPackageInfo(packageName, registry)` → StructuredContent

- [ ] Create `packages/extension/src/runtime/agent/adapters/sanitizer.ts`
  - `sanitizeIngested(rawContent)` → sanitized string

- [ ] Create `packages/extension/src/runtime/agent/adapters/index.ts` — barrel + adapter dispatcher

> Run tests: all adapter tests PASS with fixture data. Sanitizer at 100% coverage.

### 2.3 REFACTOR

- [ ] Extract common adapter interface (retry, timeout, rate limiting)
- [ ] Add `unit:knowledge-adapters` suite to `scripts/validate.ts`

**Gate**: `bun run validate unit:knowledge-adapters` passes, sanitizer 100% branch coverage

---

## Phase 3: Entity Extraction Skill

### 3.1 RED — Write failing tests + eval cases

- [ ] Create `packages/extension/src/skills/entity-extractor/eval/youtube-transcript.json`
  - Input: transcript excerpt from fixture
  - Assertions: array-min-length(entities, 1), field-present(entities[0].type), field-present(entities[0].name)
  - Threshold: 0.6

- [ ] Create `packages/extension/src/skills/entity-extractor/eval/github-readme.json`
  - Input: README excerpt from fixture
  - Assertions: entities include at least one organization or project

- [ ] Create `packages/extension/src/skills/entity-extractor/eval/rss-article.json`
  - Input: article body from fixture
  - Assertions: entities extracted with descriptions

- [ ] Create `packages/extension/src/runtime/__tests__/entity-extraction-quality.test.ts`
  - `computeOutputConfidence('entity-extraction-output', output, 'heuristic')` returns 0.25 base
  - Confidence increases with entity count (capped at 0.25 bonus)
  - Confidence increases with relationship count (capped at 0.15 bonus)
  - Confidence increases with type diversity (non-'object' types: +0.1)
  - Confidence clamped to [0.2, 0.95]

- [ ] Create `packages/shared/src/contracts/__tests__/schema-knowledge.test.ts`
  - `entityExtractionOutputSchema.parse()` accepts valid output
  - `entityExtractionOutputSchema.parse()` rejects missing entities array
  - `graphEntitySchema.parse()` accepts valid POLE+O types
  - `graphRelationshipSchema.parse()` accepts valid temporal edges

> All tests FAIL — schemas and skill don't exist yet.

### 3.2 GREEN — Minimal implementation

- [ ] Add to `packages/shared/src/contracts/schema-knowledge.ts`
  - `poleEntityTypeSchema` — z.enum(['person', 'organization', 'location', 'event', 'object'])
  - `graphEntitySchema` — id, name, type, description, sourceRef, embedding?
  - `graphRelationshipSchema` — from, to, type, confidence, t_valid, t_invalid, provenance
  - `entityExtractionOutputSchema` — { entities: graphEntitySchema[], relationships: graphRelationshipSchema[] }

- [ ] Modify `packages/shared/src/contracts/schema-agent.ts`
  - Add `'entity-extraction-output'` to `skillOutputSchemaRefSchema`
  - Add entry to `skillOutputSchemas` map
  - Add `'source-content-ready'` to `agentObservationTriggerSchema`

- [ ] Create `packages/extension/src/skills/entity-extractor/skill.json`
  - id: "entity-extractor", model: "transformers", triggers: ["source-content-ready", "roundup-batch-ready"]
  - outputSchemaRef: "entity-extraction-output", timeoutMs: 15000

- [ ] Create `packages/extension/src/skills/entity-extractor/SKILL.md`
  - Prompt: extract POLE+O entities and relationships from observation context

- [ ] Modify `packages/extension/src/runtime/agent/quality.ts`
  - Add `'entity-extraction-output'` confidence scoring function

> Run tests: schema tests PASS, eval cases PASS at threshold >= 0.6, quality tests PASS.

### 3.3 REFACTOR

- [ ] Share entity patterns with existing `ecosystem-entity-extractor` skill where applicable
- [ ] Add `unit:entity-extraction` suite to `scripts/validate.ts`

**Gate**: `bun run validate unit:entity-extraction` + eval cases pass

---

## Phase 4: Graph Memory Layer

### 4.1 RED — Write failing tests

- [ ] Create `packages/shared/src/modules/graph/__tests__/fixtures.ts`
  - `makeEntity({type: 'person', name: 'Vitalik', ...})` factory
  - `makeRelationship({from, to, type: 'founded', t_valid, ...})` factory
  - `seedTestGraph()` — small connected graph (10 entities, 20 edges)

- [ ] Create `packages/shared/src/modules/graph/__tests__/graph-store.test.ts`
  - `initGraphStore()` creates Kuzu-WASM instance
  - `initGraphStore()` creates POLE+O node tables
  - `upsertEntity()` inserts new entity
  - `upsertEntity()` merges existing entity (same name+type)
  - `upsertEntity()` preserves history on update
  - `createRelationship()` adds typed edge with t_valid
  - `invalidateRelationship()` sets t_invalid without deleting
  - `getEntity()` returns entity with edges
  - `getEntityNeighbors()` returns 1-hop connected entities
  - `destroyGraphStore()` cleans up WASM resources

- [ ] Create `packages/shared/src/modules/graph/__tests__/graph-temporal.test.ts`
  - `currentFacts()` returns only edges where t_invalid is null
  - `factsAt(pastTimestamp)` returns edges valid at that time
  - `factHistory(entityId)` returns full temporal timeline
  - Newer fact auto-invalidates older contradicting fact
  - Invalidated edges still queryable via `factsAt()`

- [ ] Create `packages/shared/src/modules/graph/__tests__/graph-persistence.test.ts`
  - Graph survives close → reopen (IDBFS round-trip)
  - 100 entities query completes in < 50ms
  - 1000 entities + 5000 edges stays under 10MB

> All tests FAIL — Kuzu-WASM not integrated yet.

### 4.2 GREEN — Minimal implementation

- [ ] Add `@kuzu/kuzu-wasm` to `packages/extension/package.json`
- [ ] Create `packages/shared/src/modules/graph/store.ts`
  - `initGraphStore()` — lazy-load Kuzu-WASM, IDBFS init
  - `upsertEntity()`, `createRelationship()`, `invalidateRelationship()`
  - `getEntity()`, `getEntityNeighbors()`
  - `destroyGraphStore()`

- [ ] Create `packages/shared/src/modules/graph/schema.ts`
  - Cypher DDL for POLE+O node tables (Person, Organization, Location, Event, Object)
  - Cypher DDL for edge tables with temporal fields

- [ ] Create `packages/shared/src/modules/graph/temporal.ts`
  - `currentFacts(entityId)` — WHERE t_invalid IS NULL
  - `factsAt(entityId, timestamp)` — WHERE t_valid <= ts AND (t_invalid IS NULL OR t_invalid > ts)
  - `factHistory(entityId)` — all edges ordered by t_valid

- [ ] Create `packages/shared/src/modules/graph/persistence.ts`
  - IDBFS filesystem init + teardown

- [ ] Create `packages/shared/src/modules/graph/index.ts` — barrel exports
- [ ] Modify `packages/shared/src/modules/index.ts` — add graph re-export

> Run tests: all graph-store, graph-temporal, graph-persistence tests PASS.

### 4.3 REFACTOR

- [ ] Optimize Cypher queries (parameterized, prepared statements where possible)
- [ ] Add `unit:graph-store` suite to `scripts/validate.ts`

**Gate**: `bun run validate unit:graph-store` passes, temporal correctness 100%

---

## Phase 5: Graph Retrieval

### 5.1 RED — Write failing tests + benchmark corpus

- [ ] Create `packages/shared/src/modules/graph/__tests__/benchmarks/retrieval-corpus.json`
  - 20 queries with expected top-3 entity results
  - Covers: exact match, semantic similarity, graph neighbors, temporal filtering

- [ ] Create `packages/shared/src/modules/graph/__tests__/graph-retrieval.test.ts`
  - `searchByText()` returns entities matching BM25 query
  - `searchByVector()` returns entities by embedding cosine similarity
  - `searchByTraversal()` returns 1-hop and 2-hop neighbors
  - `hybridSearch()` combines all three with configurable weights
  - `hybridSearch()` deduplicates across search methods
  - `hybridSearch()` respects temporal validity (current facts only)
  - `hybridSearch()` returns provenance (which source)
  - `hybridSearch()` completes without LLM call (mock assertion: zero LLM invocations)

- [ ] Create `packages/shared/src/modules/graph/__tests__/graph-context.test.ts`
  - `assembleGraphContext()` formats results for skill prompt
  - `assembleGraphContext()` respects 2000 token budget (truncates, not drops)
  - `assembleGraphContext()` includes provenance metadata
  - `assembleGraphContext()` prioritizes by relevance score

- [ ] Create `packages/shared/src/modules/graph/__tests__/graph-retrieval-benchmark.test.ts`
  - Seeds graph with test corpus entities
  - Runs 20 queries from retrieval-corpus.json
  - Asserts MRR >= 0.6 across the corpus

> All tests FAIL — no retrieval implementation.

### 5.2 GREEN — Minimal implementation

- [ ] Create `packages/shared/src/modules/graph/retrieval.ts`
  - `searchByText(query)` — BM25 over entity content fields
  - `searchByVector(embedding)` — cosine similarity over entity embeddings
  - `searchByTraversal(entityIds, hops)` — Cypher path query
  - `hybridSearch(query, {weights, maxResults, temporalFilter})` — orchestrates all three

- [ ] Create `packages/shared/src/modules/graph/embedding.ts`
  - `generateEntityEmbedding(text)` — Transformers.js all-MiniLM-L6-v2 (or similar small model)
  - Batch generation with caching (avoid redundant computation)

- [ ] Create `packages/shared/src/modules/graph/context.ts`
  - `assembleGraphContext(results, tokenBudget)` — format for skill prompt injection

> Run tests: retrieval tests PASS, benchmark MRR >= 0.6, zero LLM invocations during retrieval.

### 5.3 REFACTOR

- [ ] Tune hybrid search weights based on benchmark results
- [ ] Add `unit:graph-retrieval` suite to `scripts/validate.ts`

**Gate**: `bun run validate unit:graph-retrieval` passes, MRR >= 0.6

---

## Phase 6: Reasoning Traces

### 6.1 RED — Write failing tests

- [ ] Create `packages/shared/src/modules/graph/__tests__/reasoning-trace.test.ts`
  - `recordReasoningTrace()` creates trace node linked to skill run
  - `recordReasoningTrace()` captures: skillRunId, observationId, confidence, output summary
  - `recordReasoningTrace()` links to source entities used in context
  - `recordReasoningTrace()` links to precedent traces referenced
  - `queryPrecedents()` finds traces for similar observations
  - `queryPrecedents()` ranks by outcome (successful > failed)
  - `queryPrecedents()` respects temporal recency

- [ ] Create `packages/shared/src/modules/graph/__tests__/reasoning-precedent.test.ts`
  - Given: approved draft X recorded as positive precedent
    When: similar draft Y observation
    Then: precedent for X surfaces in results
  - Given: rejected draft X recorded as negative precedent
    When: similar draft Y observation
    Then: rejection precedent informs lower confidence
  - Given: conflicting precedents (approved + rejected similar)
    Then: both surface with outcome labels
  - Positive precedent boosts confidence by >= 0.05
  - Negative precedent decreases confidence by >= 0.05
  - Trace quota: max 500, oldest-first pruning works

> All tests FAIL — no reasoning trace implementation.

### 6.2 GREEN — Minimal implementation

- [ ] Add to `packages/shared/src/contracts/schema-knowledge.ts`
  - `reasoningTraceSchema` — traceId, skillRunId, observationId, contextEntityIds, confidence, outputSummary, outcome

- [ ] Create `packages/shared/src/modules/graph/reasoning.ts`
  - `recordReasoningTrace(graph, trace)` — creates node + edges to entities
  - `queryPrecedents(graph, observation, {limit})` — similarity search on observation text
  - `computePrecedentAdjustment(precedents)` — returns confidence delta

> Run tests: all reasoning trace + precedent tests PASS.

### 6.3 REFACTOR

- [ ] Optimize precedent query to use graph index, avoid full scan
- [ ] Add `unit:reasoning-traces` suite to `scripts/validate.ts`

**Gate**: `bun run validate unit:reasoning-traces` passes

---

## Phase 7: Integration

### 7.1 RED — Write regression + integration tests

- [ ] Create `packages/extension/src/runtime/__tests__/knowledge-sandbox-integration.test.ts`
  - Full cycle: source → adapter → entities extracted → graph populated → skill retrieves context → output includes graph entities
  - Source removal: remove source → entities marked stale → skill no longer retrieves them
  - Allowlist enforcement: non-registered URL blocked at adapter level
  - Backwards compat: flat agentMemories still queryable alongside graph

- [ ] Create `packages/extension/src/runtime/__tests__/knowledge-sandbox-regression.test.ts`
  - All 16 existing skills produce same or better output (run eval cases)
  - Agent cycle time measured: within 120% of baseline
  - Existing observation triggers still fire correctly
  - Existing memory queries still return results

> Integration tests FAIL (not wired yet). Regression tests should PASS (nothing changed yet).

### 7.2 GREEN — Wire the pipeline

- [ ] Modify `packages/extension/src/runtime/agent/runner-skills-context.ts`
  - In `buildSkillContext()` (~line 262): add graph retrieval alongside existing Dexie memory query
  - New field on `SkillExecutionContext`: `graphContext?: GraphContextResult`

- [ ] Modify `packages/extension/src/runtime/agent/runner-skills.ts`
  - After `completeSkillRun()` (~line 366) and before `writeSkillMemories()` (~line 376):
    Insert `recordReasoningTrace()` call

- [ ] Modify `packages/extension/src/runtime/agent/quality.ts`
  - In confidence computation: add precedent adjustment from `computePrecedentAdjustment()`

- [ ] Create observation emitter for source content:
  - Modify `packages/extension/src/background/handlers/agent-observation-emitters.ts`
  - Add `emitSourceContentObservation()` function

- [ ] Wire source adapters to observation system:
  - After successful adapter fetch → emit `source-content-ready` observation
  - Entity extraction skill triggers on this observation

> Run tests: integration tests PASS. Regression tests PASS. Zero regressions.

### 7.3 REFACTOR + EVALUATE

- [ ] Run A/B evaluation:
  1. Baseline: run all skill eval cases with flat memory → save scores
  2. Graph-enhanced: seed graph with test corpus → run same eval cases → save scores
  3. Compare: per-skill quality delta (target: >= 10% improvement)
  - Save results to `eval/graph-memory-ab-report.json`

- [ ] Run full validation: `bun run validate smoke`
- [ ] Add `unit:knowledge-sandbox-integration` composite suite to `scripts/validate.ts`
- [ ] Add `knowledge-sandbox` composite suite (lint + all unit suites + build + e2e)

**Gate**: `bun run validate smoke` passes, zero regressions, A/B shows >= 10% quality improvement
