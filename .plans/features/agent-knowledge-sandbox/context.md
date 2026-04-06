# Context For Agent Knowledge Sandbox

## Existing Infrastructure

### Source Fetching (Phase 1-2 foundation)

**Already built:**
- `assertSafeSkillUrl(url)` — SSRF protection for knowledge skill imports (`knowledge.ts:55-86`)
- `knowledgeSkills` Dexie table — stores imported SKILL.md content (`db-schema.ts:102-103`)
- `importKnowledgeSkill(url)` — fetches, parses YAML frontmatter, stores (`knowledge.ts:123-151`)
- `coopKnowledgeSkillOverrides` — per-coop enable/disable (`db-schema.ts:283`)
- KnowledgeSkillsSection in OperatorConsole — import URL, enable/disable, trigger patterns

**Gap:**
- `assertSafeSkillUrl()` only validates URL safety, not source allowlisting
- No structured source types (YouTube, GitHub, RSS) — only SKILL.md URL imports
- No adapter pattern — content parsing is SKILL.md-specific (YAML frontmatter extraction)
- No source sync — knowledge skills are per-device, not per-coop via Yjs

**Integration seams:**
- Extend `assertSafeSkillUrl()` into `assertAllowedSource(url, sourceType)` — checks registry + denylist
- New `knowledgeSources` Dexie table alongside existing `knowledgeSkills`
- Add Y.Map('knowledge-sources-v1') to sync-core doc structure
- Source adapters use same fetch pipeline but with type-specific parsing

### Agent Memory (Phase 4-6 foundation)

**Already built:**
- `agentMemories` Dexie table with indexes: id, coopId, type, domain, createdAt, expiresAt, contentHash (`db-schema.ts:344`)
- `AgentMemory` schema: scope, type (6 types), domain, content, confidence, sourceObservationId, sourceSkillRunId (`schema-agent.ts`)
- `queryMemoriesForSkill()` — multi-query with type prioritization + staleness logic (`memory.ts:30-62`)
- `deduplicateMemories()` — removes duplicate contentHash, keeps newest
- `enforceMemoryLimit(coopId, maxEntries=500)` — oldest-first deletion
- `writeSkillMemories()` — called after each skill run, creates observation-outcome + skill-pattern memories

**Gap:**
- Flat records — no relationships between memories
- No temporal validity (only createdAt, no invalidation)
- No entity extraction from memory content
- No graph traversal for related context
- No reasoning traces (skill output provenance evaporates)
- No semantic/vector search (recency-biased flat query)

**Integration seams:**
- Kuzu-WASM runs alongside Dexie (both use IndexedDB, separate object stores)
- Phase 1-3 don't touch memories at all — they build the source → entity pipeline
- Phase 4 adds graph as parallel storage; existing memories continue in Dexie
- Phase 5 adds graph retrieval as additional context source for skill prompts
- Phase 6 adds reasoning traces as post-skill-run persistence
- Phase 7 wires graph retrieval into `buildSkillContext()` alongside existing memory queries

### Agent Pipeline (Phase 3, 7 foundation)

**Already built:**
- 16-skill DAG with topological sort (`harness.ts:selectSkillIdsForObservation()`)
- 3-tier inference cascade: WebLLM → Transformers.js → heuristic (`models.ts:542-646`)
- Skill output validation via Zod schemas (`schema-agent.ts`)
- Eval pipeline with structural + semantic assertions (`eval.ts`)
- Quality scoring per output type (`quality.ts:23-52`)
- Skill prompt assembly (`runner-skills-prompt.ts`)
- Cold-start optimization: warm models in background, return heuristic immediately

**Gap:**
- No entity extraction skill — closest are `ecosystem-entity-extractor` and `theme-clusterer`
- Skill context assembly (`buildSkillContext()`) only queries flat Dexie memories
- No graph-backed context injection
- No reasoning trace recording after skill completion

**Integration seams:**
- Entity extraction skill: new skill manifest + prompt + output schema, registered alongside existing 16
- Skill context: extend `buildSkillContext()` to query graph alongside Dexie memories
- Reasoning traces: extend `completeSkillRun()` to write trace to graph
- Quality scoring: add entity extraction confidence function to `computeOutputConfidence()`

### UI Surfaces (Phase 1, 7 foundation)

**Already built:**
- Nest tab with Members/Agent/Settings sections — expandable collapsible cards
- OperatorConsole with KnowledgeSkillsSection — import, enable/disable, trigger patterns
- Roost Agent section — heartbeat, pending approvals, observations, memories
- DraftCard with provenance badge, confidence %, "Why now" section
- ChickensCompactCard for list view
- Popup with PopupProfilePanel for settings
- Shared components: Tooltip, NotificationBanner, badges, pills

**Gap:**
- No source management UI (only SKILL.md URL imports in OperatorConsole)
- No agent knowledge display (topic bars, entity counts)
- No decision history with reasoning traces
- No source provenance on draft cards
- No source health indicator in popup

**Integration seams:**
- Nest > Sources: new section using `.collapsible-card` pattern from OperatorConsole
- Roost > Agent > Knowledge: new subsection using `.roost-hero-card` + topic bar component
- Roost > Agent > Decision History: new subsection using `.operator-log-entry` pattern
- DraftCard: add `.draft-card__provenance` section between meta strip and "Why now"
- Popup: add source health line in PopupProfilePanel area

## Relevant Codepaths (verified 2026-04-05)

| Component | Path | Key Lines |
|-----------|------|-----------|
| URL safety validation | `extension/src/runtime/agent/knowledge.ts` | 55-86 |
| Knowledge skill import | `extension/src/runtime/agent/knowledge.ts` | 123-151 |
| Knowledge skill selection | `extension/src/runtime/agent/knowledge.ts` | 216-255 |
| Agent memory schema | `shared/src/contracts/schema-agent.ts` | AgentMemory type |
| Memory CRUD | `shared/src/modules/agent/memory.ts` | 14-236 (full file) |
| Memory write after skill | `extension/src/runtime/agent/runner-skills.ts` | ~376-382 (writeSkillMemories call) |
| DB schema (v18, 31 tables) | `shared/src/modules/storage/db-schema.ts` | knowledgeSkills v9 (283), agentMemories v11 (344) |
| Skill registry (glob) | `extension/src/runtime/agent/registry.ts` | 14-91 (import.meta.glob eager) |
| Skill manifest schema | `shared/src/contracts/schema-agent.ts` | 311-332 (skillManifestSchema) |
| Skill output schemas map | `shared/src/contracts/schema-agent.ts` | skillOutputSchemas (48-68) |
| Skill harness | `extension/src/runtime/agent/harness.ts` | 162-209 (selectSkillIdsForObservation) |
| Skill context builder | `extension/src/runtime/agent/runner-skills-context.ts` | 262 (buildSkillContext → SkillExecutionContext) |
| Skill execution context type | `extension/src/runtime/agent/runner-state.ts` | 42-57 (SkillExecutionContext) |
| Skill completion + run save | `extension/src/runtime/agent/runner-skills.ts` | 366-382 (completeSkillRun → save → writeMemories) |
| Inference cascade | `extension/src/runtime/agent/models.ts` | 542-646 |
| Eval pipeline | `extension/src/runtime/agent/eval.ts` | 165-292 |
| Quality scoring | `extension/src/runtime/agent/quality.ts` | 23-52 |
| Observation triggers (18) | `shared/src/contracts/schema-agent.ts` | 5-22 (agentObservationTriggerSchema) |
| Observation emitters | `extension/src/background/handlers/agent-observation-emitters.ts` | 13-106 |
| Yjs doc structure | `shared/src/modules/sync-core/doc.ts` | 68-72, 87-104 (sharedKeys) |
| RuntimeRequest (50 types) | `extension/src/runtime/messages.ts` | 269-684 |
| Handler registry | `extension/src/background/handler-registry.ts` | 196-532 (type-safe dispatch) |
| Handler receiver | `extension/src/background/handlers/receiver.ts` | 1-654 |
| Offscreen document | `extension/src/runtime/receiver-sync-offscreen.ts` | 1-383 (WebRTC + agent runner) |
| Offscreen management | `extension/src/background/context-receiver.ts` | 64-95 |
| DraftCard component | `extension/src/views/Sidepanel/cards/DraftCard.tsx` | 46-327 |
| Provenance formatting | `extension/src/views/Sidepanel/cards/card-shared.ts` | 39-48 |
| Roost Agent section | `extension/src/views/Sidepanel/tabs/RoostAgentSection.tsx` | — |
| Nest settings | `extension/src/views/Sidepanel/tabs/NestSettingsSection.tsx` | — |
| Operator console | `extension/src/views/Sidepanel/operator-sections/` | — |
| Knowledge skills UI | `extension/src/views/Sidepanel/operator-sections/KnowledgeSkillsSection.tsx` | — |
| Popup profile | `extension/src/views/Popup/PopupProfilePanel.tsx` | — |
| Global CSS | `extension/src/global.css` | Component classes |
| Design tokens | `shared/src/styles/tokens.css` | Palette, spacing, radii |
| Barrel exports | `shared/src/modules/index.ts` | Wildcard re-exports from module dirs |

## Missing Infrastructure (must be created)

| What | Where | Notes |
|------|-------|-------|
| Dexie v19 schema bump | `db-schema.ts` | Add `knowledgeSources` table (current version: 18) |
| `KnowledgeSource` Zod schema | `shared/src/contracts/schema-knowledge.ts` | New file, re-export from contracts/index.ts |
| `knowledge-source` module | `shared/src/modules/knowledge-source/` | New module, re-export from modules/index.ts |
| `graph` module | `shared/src/modules/graph/` | New module for Kuzu-WASM integration |
| `entity-extractor` skill | `extension/src/skills/entity-extractor/` | skill.json + SKILL.md + eval/ |
| `entity-extraction-output` schema | `shared/src/contracts/schema-agent.ts` | Add to skillOutputSchemaRefSchema + skillOutputSchemas map |
| `source-content-ready` trigger | `shared/src/contracts/schema-agent.ts` | Add to agentObservationTriggerSchema |
| Source CRUD RuntimeRequest types | `extension/src/runtime/messages.ts` | ~4 new request types |
| Source CRUD handlers | `extension/src/background/handlers/` | New handler file or extend existing |
| Source adapter functions | `extension/src/runtime/agent/adapters/` | New directory with 5 adapter files |
| Graph retrieval integration | `extension/src/runtime/agent/runner-skills-context.ts` | Modify buildSkillContext |
| Reasoning trace recording | `extension/src/runtime/agent/runner-skills.ts` | Hook at line ~370 between completeSkillRun and writeSkillMemories |
| New validation suites | `scripts/validate.ts` | unit:knowledge-sandbox, unit:graph-memory, e2e:knowledge-sandbox |
| NPM dependencies | `packages/extension/package.json` | @kuzu/kuzu-wasm, youtube-caption-extractor, rss-parser |
| Nest Sources UI | `extension/src/views/Sidepanel/tabs/NestSourcesSection.tsx` | New file |
| Shared UI components | `extension/src/views/shared/` | SourceBadge, PrecedentIndicator, TopicBar, ConfidenceTooltip |

## Constraints

**Architectural:**
- All domain logic in `@coop/shared`, runtime in extension
- Kuzu-WASM is ~4MB — must lazy-load in offscreen document, not bundle in popup/sidepanel
- Graph + Dexie coexist in IndexedDB (separate object stores)
- Source adapters fetch client-side — no API server involvement
- Entity extraction uses existing cascade — no new model infrastructure

**UX / Product:**
- Source management should feel like a reading list, not a database admin panel (Design skill: Command Surface / Parchment material)
- Agent knowledge display should be ambient, not overwhelming (Ambient Display / Gauze material)
- Draft provenance should be inline, not modal (progressive disclosure: glance → scan → engage)
- Popup source health is one line, one dot — zero cognitive load

**Testing:**
- Graph tests need fake-indexeddb (existing pattern for Dexie tests)
- Adapter tests use recorded API response fixtures, not live APIs
- Entity extraction tests need mock inference cascade
- Retrieval relevance tests need golden fixture corpus (20 queries + expected results)
- Zero regression on existing 16 skill eval cases is mandatory

**Performance:**
- Graph queries must complete in <50ms for graphs up to 1000 entities
- Hybrid retrieval in <200ms
- No LLM calls during retrieval (hard requirement)
- Agent cycle time must stay within 120% of pre-graph baseline

## Notes For Agents

**Claude should focus on:**
- Nest > Sources UI (source management, add/remove/configure)
- Roost > Agent Knowledge + Decision History subsections
- DraftCard provenance section + ConfidenceTooltip
- Popup source health indicator
- Shared components: SourceBadge, PrecedentIndicator, TopicBar
- E2E tests for UX flows
- Design skill compliance (4-lens review on all UI work)

**Codex should focus on:**
- KnowledgeSource schema + Dexie table + Yjs sync
- Source adapter implementations (YouTube, GitHub, RSS, Reddit, NPM)
- Content sanitizer
- assertAllowedSource() enforcement
- Entity extraction skill manifest + output schema
- Kuzu-WASM integration (graph store, temporal edges, IDBFS)
- Graph retrieval (hybrid search, embedding generation)
- Reasoning trace schemas + persistence
- Unit tests for all state/data modules

**Shared assumptions:**
- Phases 1-3 ship before graph integration (source pipeline works independently)
- Phase 4 can begin in parallel once entity extraction output schema is defined
- Phase 7 is the only phase that touches existing agent pipeline code
- All phases use existing mode flags — no new env vars
- Design skill 4-lens review on all UI PRs
