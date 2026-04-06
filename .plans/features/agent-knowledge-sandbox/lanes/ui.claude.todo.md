---
feature: agent-knowledge-sandbox
title: Agent knowledge sandbox UI lane
lane: ui
agent: claude
status: todo
source_branch: feature/agent-knowledge-sandbox
work_branch: claude/ui/agent-knowledge-sandbox
depends_on:
  - ../spec.md
  - state.codex.todo.md
owned_paths:
  - packages/extension/src/views/Sidepanel/tabs/NestSourcesSection.tsx
  - packages/extension/src/views/Sidepanel/cards/DraftCard.tsx
  - packages/extension/src/views/Sidepanel/tabs/RoostAgentSection.tsx
  - packages/extension/src/views/shared/SourceBadge.tsx
  - packages/extension/src/views/shared/PrecedentIndicator.tsx
  - packages/extension/src/views/shared/TopicBar.tsx
  - packages/extension/src/views/shared/ConfidenceTooltip.tsx
done_when:
  - NestSourcesSection
  - SourceBadge
  - draft-card__provenance
skills:
  - design
  - react
  - ui-compliance
  - testing
updated: 2026-04-06
---

# UI Lane — Claude (TDD: Red → Green → Refactor)

Owner: Claude
Branch: `claude/ui/agent-knowledge-sandbox`
Depends on: State lane schemas (can start with mock data before state lane completes)

UI tests use @testing-library/react (render, screen, userEvent) with the existing
popup-harness test utilities. All UI work must pass the design skill 4-lens review.

---

## Phase 1: Shared Components (can start immediately — mock data)

### 1.1 RED — Write failing component tests

- [ ] Create `packages/extension/src/views/shared/__tests__/SourceBadge.test.tsx`
  - Renders YouTube icon for type='youtube'
  - Renders GitHub icon for type='github'
  - Renders RSS icon for type='rss'
  - Renders Reddit icon for type='reddit'
  - Renders NPM icon for type='npm'
  - Shows source name text
  - Applies correct CSS class per type

- [ ] Create `packages/extension/src/views/shared/__tests__/TopicBar.test.tsx`
  - Renders topic label
  - Fill width matches depth percentage (e.g., 80% → style.width = '80%')
  - Shows source count text "(4 sources)"
  - Handles 0% and 100% edge cases
  - Uses `--coop-green` for fill color

- [ ] Create `packages/extension/src/views/shared/__tests__/PrecedentIndicator.test.tsx`
  - Renders positive precedent: "Similar draft approved 2w ago → acted on"
  - Renders negative precedent: "Similar draft rejected 1w ago"
  - Renders null: "No precedent" or nothing
  - Uses `--coop-green` for positive, muted for negative

- [ ] Create `packages/extension/src/views/shared/__tests__/ConfidenceTooltip.test.tsx`
  - Renders confidence percentage as badge text
  - Shows tooltip on hover with breakdown: schema %, content %, precedent delta
  - Hides tooltip when not hovered
  - Uses existing Tooltip component internally

> All tests FAIL — components don't exist.

### 1.2 GREEN — Create components

- [ ] Create `packages/extension/src/views/shared/SourceBadge.tsx`
  - Props: `{ type: KnowledgeSourceType, name: string }`
  - Renders `.badge` with source icon + name

- [ ] Create `packages/extension/src/views/shared/TopicBar.tsx`
  - Props: `{ topic: string, depth: number, sourceCount: number }`
  - Renders `.topic-bar` with `.topic-bar__fill` at depth%

- [ ] Create `packages/extension/src/views/shared/PrecedentIndicator.tsx`
  - Props: `{ precedent: { decision: string, outcome: string, timeAgo: string } | null }`
  - Renders `.draft-card__track-record`

- [ ] Create `packages/extension/src/views/shared/ConfidenceTooltip.tsx`
  - Props: `{ confidence: number, breakdown: { schema, content, precedentDelta } }`
  - Wraps existing Tooltip component

- [ ] Add CSS to `packages/extension/src/global.css`:
  - `.topic-bar`, `.topic-bar__fill`
  - `.source-icon`, `.source-icon--youtube`, etc.
  - `.draft-card__provenance`, `.draft-card__source-ref`, `.draft-card__track-record`
  - `.source-card`, `.source-card__health`, `.source-card__health--stale`

> Run tests: all component tests PASS.

### 1.3 REFACTOR + Design Review

- [ ] 4-lens design review on all components:
  - Lens 1 (Regen): No gamification, ambient indicators, observant language
  - Lens 2 (Spatial): Materials match paradigm, hit targets >= 44px
  - Lens 3 (Ecosystem): Agent state components visible
  - Lens 4 (Compliance): Semantic HTML, focus states, color + text, token discipline

---

## Phase 2: Nest > Sources Section

### 2.1 RED — Write failing tests

- [ ] Create `packages/extension/src/views/Sidepanel/tabs/__tests__/NestSourcesSection.test.tsx`
  - Renders empty state when no sources configured
  - Renders source list grouped by type
  - Each source shows: name, type icon, freshness, entity count, active toggle
  - "Add source" button opens add form
  - Add form shows type selector tabs (YouTube/GitHub/RSS/Reddit/NPM)
  - Add form submits correct RuntimeRequest message
  - Remove button shows cascade warning ("47 entities from this source")
  - Active toggle sends update message
  - Footer shows total stats (sources, entities, relationships)
  - Source health dot: green (fresh), yellow (stale > 7d), red (error)

> All tests FAIL — component doesn't exist.

### 2.2 GREEN — Create section

- [ ] Create `packages/extension/src/views/Sidepanel/tabs/NestSourcesSection.tsx`
  - Uses `.collapsible-card` pattern from OperatorConsole
  - Source list using `.operator-log-entry` pattern
  - SourceBadge for type display
  - Health dot component
  - Add source inline form with type tabs

- [ ] Add RuntimeRequest types to `packages/extension/src/runtime/messages.ts`
  - `'add-knowledge-source'` with payload
  - `'remove-knowledge-source'` with payload + cascade confirmation
  - `'toggle-knowledge-source'` with payload
  - `'refresh-knowledge-source'` with payload

- [ ] Wire into Nest tab: modify `packages/extension/src/views/Sidepanel/tabs/NestTab.tsx`
  - Add Sources section alongside Members/Agent/Settings

> Run tests: all NestSourcesSection tests PASS.

### 2.3 REFACTOR

- [ ] Extract common patterns shared with KnowledgeSkillsSection
- [ ] Verify popup-width rendering (400px)

---

## Phase 3: DraftCard Provenance Enhancement

### 3.1 RED — Write failing tests

- [ ] Modify `packages/extension/src/views/Sidepanel/cards/__tests__/DraftCard.test.tsx`
  - Agent-generated draft with provenance: shows "Sourced from" section
  - Agent-generated draft without provenance: hides section
  - Tab-captured draft: never shows "Sourced from"
  - "Sourced from" shows 1-3 source references with SourceBadge
  - "Track record" line shows PrecedentIndicator
  - Confidence badge wrapped in ConfidenceTooltip

- [ ] Add test for ChickensCompactCard:
  - Shows source type icon next to provenance badge (compact view)
  - No "Sourced from" section (too much for compact)

> Tests FAIL — provenance section not implemented.

### 3.2 GREEN — Modify DraftCard

- [ ] Modify `packages/extension/src/views/Sidepanel/cards/DraftCard.tsx`
  - Add `.draft-card__provenance` section after meta strip, before "Why now"
  - Condition: only show when `value.provenance === 'agent'` AND sourceRefs exist
  - Render SourceBadge for each source reference
  - Render PrecedentIndicator below sources
  - Wrap confidence badge with ConfidenceTooltip

- [ ] Modify `packages/extension/src/views/Sidepanel/cards/card-shared.ts`
  - Add `formatSourceRef()` helper for source reference display

> Run tests: DraftCard tests PASS.

---

## Phase 4: Roost > Agent Enhancements

### 4.1 RED — Write failing tests

- [ ] Create `packages/extension/src/views/Sidepanel/tabs/__tests__/RoostKnowledge.test.tsx`
  - Renders "Knowledge" section with topic bars
  - Topic bars sorted by depth descending
  - Shows summary stats (entities, relationships, sources)
  - Empty state when no graph data

- [ ] Create `packages/extension/src/views/Sidepanel/tabs/__tests__/RoostDecisionHistory.test.tsx`
  - Renders decision entries with badges (provenance, confidence, timestamp)
  - Each entry shows "Based on" source list
  - Each entry shows "Similar to" precedent line
  - Shows skipped decisions (agent restraint)
  - Max 12 items shown (consistent with existing observation list)

> Tests FAIL.

### 4.2 GREEN — Create subsections

- [ ] Modify `packages/extension/src/views/Sidepanel/tabs/RoostAgentSection.tsx`
  - Add Knowledge subsection after Heartbeat, using TopicBar components
  - Add Decision History subsection after Observations, using `.operator-log-entry` pattern
  - Wire to RuntimeRequest for graph data retrieval

> Run tests: PASS.

---

## Phase 5: Popup Source Health

### 5.1 RED — Write failing test

- [ ] Create `packages/extension/src/views/Popup/__tests__/SourceHealthIndicator.test.tsx`
  - "Sources: 12 active · all fresh" with green dot
  - "Sources: 11 active · 1 stale" with yellow dot
  - "Sources: 0 configured" with neutral state (no dot)
  - Click triggers sidepanel open to Nest > Sources

> Tests FAIL.

### 5.2 GREEN — Create indicator

- [ ] Create source health indicator in Popup area
  - One line in PopupProfilePanel or header area
  - Uses `.source-card__health` dot classes

> Run tests: PASS.

---

## Phase 6: E2E Tests + Visual Snapshots

### 6.1 RED — Write failing E2E tests

- [ ] Create `e2e/knowledge-sandbox.spec.cjs`
  - Member adds YouTube channel source in Nest → source appears in list
  - Agent creates draft → draft card shows "Sourced from" section
  - Member hovers confidence → tooltip appears with breakdown
  - Roost Agent shows Knowledge section with topic bars
  - Source removal → cascade warning displayed
  - Popup shows source health indicator

### 6.2 GREEN — Fix any integration issues discovered by E2E

### 6.3 Visual Snapshots

- [ ] Add to `e2e/visual-sidepanel.spec.cjs`:
  - DraftCard with provenance snapshot
  - DraftCard without provenance snapshot
  - Source card states: active, stale, disabled
  - Topic bars at various fill levels
  - Empty states: no sources, no knowledge, no decisions

**Gate**: All E2E pass, visual snapshots captured as baselines
