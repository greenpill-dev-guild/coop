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
updated: 2026-04-05
---

# UI Lane — Claude

Owner: Claude
Branch: `claude/ui/agent-knowledge-sandbox`
Depends on: State lane (schemas, source registry, graph retrieval APIs)

## Phase 1: Nest > Sources Section

- [ ] Create `NestSourcesSection.tsx` — collapsible card with source list
- [ ] Source type tabs: YouTube, GitHub, RSS, Reddit, NPM
- [ ] Source card component using `.operator-log-entry` pattern (icon, name, freshness, entity count, active toggle)
- [ ] Add Source modal/inline form with type selector + URL/identifier input
- [ ] Source health indicator (green/yellow/red dot) based on lastFetchedAt
- [ ] Footer stats: total sources, entities, relationships, graph size
- [ ] Cascade warning on source removal ("47 entities from this source. 3 recent drafts reference it.")
- [ ] Wire to background handlers via RuntimeRequest messages
- [ ] Unit tests: render states, add/remove/toggle, cascade display
- [ ] Design review: 4-lens checklist (Command Surface / Parchment material)

## Phase 2: Shared Components

- [ ] `SourceBadge.tsx` — pill with type icon + name (YouTube/GitHub/RSS/Reddit/NPM icons)
- [ ] `PrecedentIndicator.tsx` — one-line: "Similar draft approved 2w ago → acted on" or "No precedent"
- [ ] `TopicBar.tsx` — horizontal fill bar with topic, depth %, source count
- [ ] `ConfidenceTooltip.tsx` — wraps existing confidence badge with hover breakdown (schema + content + precedent delta)
- [ ] CSS additions to global.css: `.draft-card__provenance`, `.source-card`, `.topic-bar`, source type icons
- [ ] Unit tests: each component renders all states
- [ ] Snapshot tests for visual regression

## Phase 3: DraftCard Provenance Enhancement

- [ ] Add "Sourced from" section to DraftCard (between meta strip and "Why now")
- [ ] Only show for agent-generated drafts (provenance === 'agent')
- [ ] Show 1-3 source references with specific content (video title, file name, article title)
- [ ] Add "Track record" line showing most relevant precedent
- [ ] Wrap confidence badge with ConfidenceTooltip
- [ ] Collapsible on ChickensCompactCard (source icon only, no full section)
- [ ] Unit tests: DraftCard with/without provenance data
- [ ] Design review: progressive disclosure (Scan → Engage layers)

## Phase 4: Roost > Agent Enhancements

- [ ] Add "Knowledge" subsection below Heartbeat card
- [ ] TopicBar list showing agent's top topics with depth + source count
- [ ] Summary stats: entity count, relationship count, source count
- [ ] Add "Decision History" subsection below Observations
- [ ] Decision entries using `.operator-log-entry` pattern
- [ ] Each entry: draft title, badges (provenance, confidence, timestamp), "Based on" source list, "Similar to" precedent line
- [ ] Show skipped decisions too (builds trust through restraint)
- [ ] Unit tests: Knowledge section renders topic data, Decision History renders traces

## Phase 5: Popup Source Health

- [ ] Add source health indicator line to PopupProfilePanel area
- [ ] "Sources: 12 active · all fresh" with green dot
- [ ] "Sources: 11 active · 1 stale" with yellow dot
- [ ] "Sources: 0 configured" with neutral state
- [ ] Click opens Nest > Sources in sidepanel
- [ ] Unit tests: each health state renders correctly

## Phase 6: E2E Tests

- [ ] Playwright: Member adds source in Nest → source appears in list
- [ ] Playwright: Agent creates draft → draft card shows source references
- [ ] Playwright: Member hovers confidence → tooltip with breakdown
- [ ] Playwright: Roost Agent shows knowledge topics
- [ ] Playwright: Source removal → cascade warning displayed
- [ ] Visual snapshots: DraftCard provenance, source cards, topic bars, empty states

## Design Compliance

All UI work must pass the 4-lens review checklist (`.claude/skills/design/review-checklist.md`):
- Lens 1 (Regenerative): Growth-agnostic stats, observant language, regen aesthetic
- Lens 2 (Spatial): Correct paradigm + material per surface, hit targets, progressive disclosure
- Lens 3 (Ecosystem): Agent as autonomic actor surfaced, cascade visibility on governing actions
- Lens 4 (Compliance): Labels, focus, color+text, token discipline, existing components reused
