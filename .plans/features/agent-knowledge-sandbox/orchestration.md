# Orchestration: Agent Execution Strategy

How Claude and Codex agents execute the knowledge sandbox plan.

## Overview

```
Claude (Orchestrator)
  │
  ├── Spawns cracked-coder subagents (worktree isolation) for UI lane
  ├── Prepares Codex task prompts for state lane phases
  ├── Runs validation gates between phases
  └── Performs post-agent regression review before merging
```

Claude acts as orchestrator. It can:
- Spawn its own **cracked-coder** subagents for UI work (parallel, worktree-isolated)
- Prepare structured prompts for **Codex** to execute state lane phases
- Run **code-reviewer** agents on completed work
- Execute **validation gates** between phases

## Execution Flow

### Phase 1 (Week 1): Foundation — Parallel Start

**Codex: State Lane Phase 1** (source registry)
```bash
# Activate the lane
bun run plans queue --agent codex

# Codex prompt (pass to Codex CLI or API):
```
```
Implement Phase 1 of agent-knowledge-sandbox state lane using TDD (red-green-refactor).

Read the full plan: .plans/features/agent-knowledge-sandbox/lanes/state.codex.todo.md (Phase 1)
Read the context: .plans/features/agent-knowledge-sandbox/context.md
Read the spec: .plans/features/agent-knowledge-sandbox/spec.md

TDD order — DO NOT skip steps:
1. RED: Create test files FIRST (source-registry.test.ts, allowlist.test.ts, source-sync.test.ts) with all test cases. Run tests — they should ALL FAIL.
2. RED: Create fixtures.ts with makeKnowledgeSource() factory.
3. GREEN: Create schema-knowledge.ts, knowledge-source.ts, allowlist.ts, sync-sources.ts — minimal implementation to make all tests pass.
4. REFACTOR: Extract shared URL normalization with assertSafeSkillUrl(). Register unit:knowledge-registry suite in scripts/validate.ts.

Key constraints:
- Dexie schema bump to v19 (current is v18) for knowledgeSources table
- Source types: youtube, github, rss, reddit, npm, wikipedia
- assertAllowedSource() must block 100% of denylist entries
- Y.Map key: 'knowledge-sources-v1'
- Barrel exports: shared/src/modules/knowledge-source/index.ts + modules/index.ts + contracts/index.ts

Branch: codex/state/agent-knowledge-sandbox
Validate: bun run test && bun run validate quick
```

**Claude: UI Lane Phase 1** (shared components — mock data, no state dependency)
```
Spawn cracked-coder agent with isolation: worktree

Prompt: Implement Phase 1 of the UI lane for agent-knowledge-sandbox.
Build shared components using mock data (no dependency on state lane).

Read: .plans/features/agent-knowledge-sandbox/lanes/ui.claude.todo.md (Phase 1)
Read: .claude/skills/design/SKILL.md (Quad Foundation, Vellum materials)
Read: .claude/skills/design/implementation.md (component vocabulary, token mapping)

TDD order:
1. RED: Write component tests (SourceBadge.test.tsx, TopicBar.test.tsx,
   PrecedentIndicator.test.tsx, ConfidenceTooltip.test.tsx)
2. GREEN: Create components using existing global.css patterns
3. REFACTOR: Design review — 4-lens checklist

Use: @testing-library/react, existing popup-harness utilities
Material: Vellum (cream bg), badges use .badge class, icons use .source-icon--{type}
```

### Phase 2 (Week 2): Adapters + Source UI

**Codex: State Lane Phase 2** (adapters)
```
Implement Phase 2 of agent-knowledge-sandbox state lane using TDD.

Read: .plans/features/agent-knowledge-sandbox/lanes/state.codex.todo.md (Phase 2)

TDD order:
1. RED: Record API response fixtures for each adapter (YouTube, GitHub, RSS, Reddit, NPM, Wikipedia).
   Write adapter test files. Write sanitizer tests. All tests FAIL.
2. GREEN: Implement adapters as pure functions (source, registry) → StructuredContent.
   Add youtube-caption-extractor and rss-parser to extension/package.json.
3. REFACTOR: Extract common adapter interface. Register unit:knowledge-adapters suite.

Each adapter: fetchX(identifier, registry) → StructuredContent | throws if not allowlisted.
Wikipedia adapter has extra: enrichEntityFromWikipedia(entity, registry) for entity enrichment.
Sanitizer must catch: <system> tags, IGNORE PREVIOUS, base64 payloads. 100% branch coverage.

Branch: codex/state/agent-knowledge-sandbox
Gate: bun run validate unit:knowledge-adapters
```

**Claude: UI Lane Phase 2** (Nest Sources section — wire to handlers)
```
Spawn cracked-coder agent with isolation: worktree

Implement Nest Sources section + wire to background handlers.

Read: .plans/features/agent-knowledge-sandbox/lanes/ui.claude.todo.md (Phase 2)

TDD order:
1. RED: Write NestSourcesSection.test.tsx — empty state, source list, add/remove/toggle, cascade warning
2. GREEN: Create NestSourcesSection.tsx using .collapsible-card pattern from OperatorConsole
3. Add RuntimeRequest types: add-knowledge-source, remove-knowledge-source, toggle-knowledge-source, refresh-knowledge-source
4. Wire into NestTab.tsx
5. REFACTOR: Design review (Command Surface / Parchment material)

Cascade warning on remove: "47 entities from this source. 3 recent drafts reference it."
```

### Phase 3-4 (Weeks 3-4): Entity Extraction + Graph — Heavy Codex

**Codex: State Lane Phase 3** (entity extraction schemas + skill)
```
Implement Phase 3 of agent-knowledge-sandbox state lane using TDD.

Read: .plans/features/agent-knowledge-sandbox/lanes/state.codex.todo.md (Phase 3)

TDD:
1. RED: Write schema tests (schema-knowledge.test.ts) + eval cases (youtube-transcript.json,
   github-readme.json, rss-article.json) + quality scoring tests
2. GREEN: Add POLE+O schemas to schema-knowledge.ts, entity-extraction-output to schema-agent.ts,
   create skills/entity-extractor/skill.json + SKILL.md, add quality scoring
3. REFACTOR: Share patterns with ecosystem-entity-extractor where applicable

Gate: bun run validate unit:entity-extraction
```

**Codex: State Lane Phase 4** (Kuzu-WASM — highest risk phase)
```
Implement Phase 4 of agent-knowledge-sandbox state lane using TDD.

Read: .plans/features/agent-knowledge-sandbox/lanes/state.codex.todo.md (Phase 4)

CRITICAL: This is the riskiest phase. Kuzu-WASM is ~4MB, loads in offscreen document.

TDD:
1. RED: Write graph-store.test.ts, graph-temporal.test.ts, graph-persistence.test.ts
   with fixtures (makeEntity, makeRelationship, seedTestGraph)
2. GREEN: Add @kuzu/kuzu-wasm to extension/package.json. Create graph/store.ts (lazy-load,
   IDBFS), graph/schema.ts (Cypher DDL), graph/temporal.ts, graph/persistence.ts
3. REFACTOR: Optimize Cypher queries, register unit:graph-store suite

Performance requirements: 100-entity queries < 50ms, 1000 entities under 10MB IndexedDB.
Temporal correctness: currentFacts() must NEVER return invalidated edges (100% requirement).

Gate: bun run validate unit:graph-store
```

**Claude: UI Lane Phase 3-4** (DraftCard provenance + Roost sections — parallel)
```
Spawn TWO cracked-coder agents with isolation: worktree (parallel)

Agent 1: DraftCard provenance enhancement
  Read: .plans/features/agent-knowledge-sandbox/lanes/ui.claude.todo.md (Phase 3)
  TDD: Write DraftCard tests → add .draft-card__provenance section → ConfidenceTooltip wrapping

Agent 2: Roost Agent enhancements
  Read: .plans/features/agent-knowledge-sandbox/lanes/ui.claude.todo.md (Phase 4)
  TDD: Write RoostKnowledge tests → add Knowledge subsection with TopicBars
  TDD: Write RoostDecisionHistory tests → add Decision History with .operator-log-entry pattern
```

### Phase 5-6 (Weeks 5-6): Retrieval + Reasoning — Codex-Heavy

**Codex: State Lane Phase 5** (graph retrieval + benchmark)
```
Implement Phase 5 using TDD.

Read: .plans/features/agent-knowledge-sandbox/lanes/state.codex.todo.md (Phase 5)

TDD:
1. RED: Create retrieval-corpus.json (20 queries + expected top-3). Write graph-retrieval.test.ts,
   graph-context.test.ts, graph-retrieval-benchmark.test.ts
2. GREEN: Create retrieval.ts (hybridSearch), embedding.ts (Transformers.js), context.ts
3. REFACTOR: Tune hybrid search weights

HARD REQUIREMENT: Zero LLM invocations during retrieval. Verify via mock assertions.
MRR >= 0.6 on benchmark corpus.

Gate: bun run validate unit:graph-retrieval
```

**Codex: State Lane Phase 6** (reasoning traces + compound loop)
```
Implement Phase 6 using TDD.

Read: .plans/features/agent-knowledge-sandbox/lanes/state.codex.todo.md (Phase 6)

TDD:
1. RED: Write reasoning-trace.test.ts, reasoning-precedent.test.ts, compound-loop.test.ts,
   activity-log.test.ts
2. GREEN: Create reasoning.ts, compound.ts, activity-log.ts. Add Y.Array knowledge-log-v1.
3. REFACTOR: Optimize precedent query

Compound loop: approval → strengthenSourceEdges + createValidatedInsight + appendLogEntry
Activity log: Y.Array append-only, syncs between Y.Docs

Gate: bun run validate unit:reasoning-traces
```

**Claude: UI Lane Phase 5-6** (Popup + E2E)
```
Spawn cracked-coder agent:
  Phase 5: Popup source health indicator (1 line, 1 dot)
  Phase 6: E2E test scaffolding for all flows
```

### Phase 7 (Week 7): Integration — Sequential, Both Agents

**Codex first**: Wire pipeline + lint + schema
```
Implement Phase 7 state items using TDD.

Read: .plans/features/agent-knowledge-sandbox/lanes/state.codex.todo.md (Phase 7)

CRITICAL: This phase modifies existing agent pipeline files. Write regression tests BEFORE touching anything.

TDD:
1. RED: Write knowledge-sandbox-integration.test.ts + regression.test.ts + lint.test.ts
   Regression tests should PASS immediately (no changes yet)
   Integration + lint tests should FAIL
2. GREEN: Modify runner-skills-context.ts (buildSkillContext), runner-skills.ts (reasoning trace hook),
   quality.ts (precedent adjustment). Create knowledge-lint skill. Wire compound loop into approval handlers.
3. EVALUATE: Run A/B evaluation (flat memory vs graph memory)

Gate: bun run validate smoke + zero regressions + A/B >= 10% improvement
```

**Claude after Codex**: Wire UI to live data + design review
```
Spawn cracked-coder agent:
  Wire all UI components to live graph data (replace mock data)
  Run E2E tests against full pipeline
  Final 4-lens design compliance review on all surfaces
```

### QA Passes (Week 7+)

**QA Pass 1** (Codex): Create `handoff/qa-codex/agent-knowledge-sandbox` branch
```
Run QA Pass 1 checklist from .plans/features/agent-knowledge-sandbox/qa/qa-codex.todo.md
Focus: correctness, performance, regression (35 checks)
```

**QA Pass 2** (Claude): Create `handoff/qa-claude/agent-knowledge-sandbox` branch
```
Run QA Pass 2 checklist from .plans/features/agent-knowledge-sandbox/qa/qa-claude.todo.md
Focus: UX flows, design compliance, progressive disclosure (20 checks)
```

---

## Orchestration Commands

### Kick off Codex lanes
```bash
# List what's queued for Codex
bun run plans queue --agent codex

# When ready to start Phase 1:
# 1. Update status in state.codex.todo.md frontmatter: status: ready → in-progress
# 2. Pass the phase prompt to Codex CLI
# 3. After completion: update status, run gate, merge
```

### Kick off Claude lanes
```bash
# Claude spawns subagents directly:
# Use Agent tool with subagent_type: cracked-coder, isolation: worktree
# Pass phase-specific prompt from this file
# Multiple UI phases can run in parallel (worktree isolation prevents conflicts)
```

### Validation gates between phases
```bash
# After each phase completes:
bun run validate unit:knowledge-registry     # Phase 1 gate
bun run validate unit:knowledge-adapters     # Phase 2 gate
bun run validate unit:entity-extraction      # Phase 3 gate
bun run validate unit:graph-store            # Phase 4 gate
bun run validate unit:graph-retrieval        # Phase 5 gate
bun run validate unit:reasoning-traces       # Phase 6 gate
bun run validate smoke                       # Phase 7 gate (full)
```

### Post-agent regression review (MANDATORY before merge)
```bash
# After parallel subagent runs:
# 1. Scope check: each file changed was in the agent's assigned scope
# 2. Conflict check: flag files modified by 2+ agents
# 3. Build gate: bun run validate quick (minimum)
# 4. Test gate: bun run test — confirm no regressions
# 5. Summary: list all changes with before/after test count
```

---

## Parallelization Opportunities

```
WEEK 1  ┌─ Codex: P1 State (schemas, registry, sync)
        └─ Claude: P1 UI (shared components with mock data)        ← PARALLEL

WEEK 2  ┌─ Codex: P2 State (adapters + sanitizer)
        └─ Claude: P2 UI (Nest Sources section + handlers)         ← PARALLEL

WEEK 3  ┌─ Codex: P3 State (entity extraction schemas + skill)
        └─ Claude: P3 UI (DraftCard provenance)                    ← PARALLEL

WEEK 4  ┌─ Codex: P4 State (Kuzu-WASM integration)
        ├─ Claude: P4a UI (Roost Knowledge section)                ← PARALLEL
        └─ Claude: P4b UI (Roost Decision History)                 ← PARALLEL (2 subagents)

WEEK 5  ┌─ Codex: P5 State (graph retrieval + benchmark)
        └─ Claude: P5 UI (Popup source health)                    ← PARALLEL

WEEK 6  ┌─ Codex: P6 State (reasoning traces + compound loop)
        └─ Claude: P6 UI (E2E tests + visual snapshots)           ← PARALLEL

WEEK 7  ┌─ Codex: P7 State (pipeline wiring) ──────────────┐
        └─ Claude: P7 UI (wire to live data)                │      ← SEQUENTIAL
            └── after Codex P7 completes ───────────────────┘
        ┌─ Codex: QA Pass 1 ───────────────────────────────┐
        └─ Claude: QA Pass 2                                │      ← SEQUENTIAL
            └── after QA Pass 1 ────────────────────────────┘
```

Key: Phases 1-6 run fully parallel (Claude uses mock data, doesn't depend on state).
Phase 7 is the only sequential bottleneck — Codex wires the pipeline first, then Claude
wires UI to the live data.

---

## Agent Selection Guide

| Task Type | Agent | Isolation | Why |
|-----------|-------|-----------|-----|
| State logic, schemas, CRUD | Codex | Own branch | Codex excels at domain logic, TDD, typed systems |
| UI components, views, CSS | Claude cracked-coder | Worktree | Claude excels at React, visual design, accessibility |
| Design review | Claude code-reviewer | None (read-only) | 4-lens review checklist |
| Integration wiring | Codex | Own branch | Pipeline code is domain logic, not UI |
| E2E tests | Claude cracked-coder | Worktree | Playwright tests require UI understanding |
| Validation gates | Claude (orchestrator) | Main | Run between phases, block on failure |
| Regression review | Claude (orchestrator) | Main | Post-agent mandatory review |
| A/B evaluation | Codex | Own branch | Eval infrastructure is state logic |
