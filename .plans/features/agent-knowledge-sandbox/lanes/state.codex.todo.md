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
updated: 2026-04-05
---

# State Lane — Codex

Owner: Codex
Branch: `codex/state/agent-knowledge-sandbox`

## Phase 1: Source Registry

- [ ] Define `KnowledgeSource` Zod schema in `schema-agent.ts` (type, identifier, label, active, addedBy, addedAt, lastFetchedAt, entityCount)
- [ ] Add `knowledgeSources` table to Dexie db-schema (indexes: id, coopId, type, active)
- [ ] Add CRUD functions: `createKnowledgeSource()`, `removeKnowledgeSource()`, `listKnowledgeSources()`, `updateKnowledgeSourceMeta()`
- [ ] Implement `assertAllowedSource(url, sourceType)` extending `assertSafeSkillUrl()` — checks registry + denylist
- [ ] Add `knowledge-sources-v1` Y.Map to sync-core doc structure
- [ ] Sync module: write/read/watch source registry via Yjs
- [ ] Unit tests: CRUD, sync convergence, denylist enforcement, edge cases (subdomains, path traversal)

**Gate**: `unit:knowledge-registry` passes

## Phase 2: Source Adapters

- [ ] Define `StructuredContent` output type (title, body, metadata, sourceRef, fetchedAt)
- [ ] Implement YouTube adapter: `fetchYouTubeTranscript(videoUrl, registry)` → StructuredContent
- [ ] Implement GitHub adapter: `fetchGitHubRepoContext(repoIdentifier, registry)` → StructuredContent
- [ ] Implement RSS adapter: `fetchRSSFeed(feedUrl, registry)` → StructuredContent[]
- [ ] Implement Reddit adapter: `fetchRedditPosts(subreddit, registry)` → StructuredContent[]
- [ ] Implement NPM adapter: `fetchNPMPackageInfo(packageName, registry)` → StructuredContent
- [ ] Implement `sanitizeIngested()` — strips prompt injection patterns, preserves markdown, truncates above limit
- [ ] Record API response fixtures for each adapter (happy path, error, edge cases)
- [ ] Unit tests: each adapter passes with fixtures, rejects non-allowlisted, sanitizer catches injection

**Gate**: `unit:knowledge-adapters` + sanitizer 100% coverage

## Phase 3: Entity Extraction Schemas

- [ ] Define `EntityExtractionOutput` Zod schema (entities[], relationships[])
- [ ] Define `GraphEntity` schema (id, name, type: POLE+O, description, sourceRef, embedding?)
- [ ] Define `GraphRelationship` schema (from, to, type, confidence, t_valid, t_invalid, provenance)
- [ ] Define skill manifest for `entity-extractor` (model, outputSchemaRef, triggers, timeoutMs)
- [ ] Add `entity-extraction-output` to `skillOutputSchemas` map
- [ ] Add confidence scoring function for entity extraction to `quality.ts`

**Gate**: Schema tests pass, type-checks clean

## Phase 4: Graph Memory Layer

- [ ] Integrate Kuzu-WASM: lazy-load, IDBFS initialization, lifecycle management
- [ ] Define Cypher DDL for POLE+O node tables (Person, Organization, Location, Event, Object)
- [ ] Define Cypher DDL for edge tables with temporal fields (t_valid, t_invalid)
- [ ] Implement graph CRUD: `upsertEntity()`, `createRelationship()`, `invalidateRelationship()`
- [ ] Implement temporal queries: `currentFacts()`, `factsAt(timestamp)`, `factHistory(entityId)`
- [ ] Implement `getEntityNeighbors()` for 1-hop traversal
- [ ] Implement IDBFS persistence: write → close → reopen → read round-trip
- [ ] Implement storage quota management (graph size limit, oldest-first pruning)
- [ ] Unit tests: CRUD, temporal correctness, persistence round-trip, query performance

**Gate**: `unit:graph-store` passes, temporal correctness 100%, persistence round-trip clean

## Phase 5: Graph Retrieval

- [ ] Implement BM25 full-text search over entity content
- [ ] Implement vector embedding generation via Transformers.js (batched, cached)
- [ ] Implement vector similarity search over entity embeddings
- [ ] Implement `hybridSearch()` combining text + vector + 1-hop traversal
- [ ] Implement `assembleGraphContext()` — formats results for skill prompt, respects token budget
- [ ] Create retrieval relevance benchmark corpus (20 queries + expected top-3)
- [ ] Unit tests: each search mode, hybrid combination, deduplication, token budget, no-LLM enforcement

**Gate**: `unit:graph-retrieval` + MRR >= 0.6 on benchmark corpus

## Phase 6: Reasoning Traces

- [ ] Define `ReasoningTrace` schema (traceId, skillRunId, observationId, toolCalls, contextRetrieved, confidence, output, outcome)
- [ ] Implement `recordReasoningTrace()` — creates trace node linked to entities used
- [ ] Implement `queryPrecedents(observation)` — finds traces for similar observations, ranked by outcome
- [ ] Implement confidence adjustment logic (positive precedent +0.05, negative -0.05)
- [ ] Implement trace quota management (max 500 traces, oldest-first pruning)
- [ ] Unit tests: trace recording, precedent matching, confidence adjustment, quota enforcement

**Gate**: `unit:reasoning-traces` passes

## Phase 7: Integration (State)

- [ ] Wire entity extraction output into graph store (extract → upsert entities/relationships)
- [ ] Wire graph retrieval into `buildSkillContext()` as additional context source
- [ ] Wire reasoning trace recording into `completeSkillRun()` flow
- [ ] Ensure flat `agentMemories` table continues working (backwards compat)
- [ ] Run all existing unit tests — zero regressions
- [ ] Run all existing eval cases — at or above current thresholds

**Gate**: `bun run test` zero regressions, `bun run validate smoke` passes
