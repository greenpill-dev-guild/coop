---
feature: agent-knowledge-sandbox
title: Agent knowledge sandbox QA pass 2
lane: qa
agent: claude
status: done
source_branch: main
work_branch: main
depends_on:
  - ./qa-codex.todo.md
skills:
  - qa
  - ui
  - e2e
qa_order: 2
handoff_in: handoff/qa-claude/agent-knowledge-sandbox
updated: 2026-05-08
---

# QA Pass 2 — Claude

Branch: `main`
Triggered by: QA Pass 1 complete

Status: complete on 2026-05-08. This pass used source and targeted UI/runtime tests rather than a
manual browser run. Kuzu-WASM remains deferred; snapshot-backed graph persistence is the shipped
backend.

## UX Flow Verification

- [x] First source onboarding: empty state -> add source -> progress -> completion toast
- [x] Source management: add, remove, refresh, toggle active - all states render correctly
- [x] Agent draft with provenance: "Sourced from" section shows specific content references
- [x] Agent draft without provenance: section hidden (tab captures, receiver captures)
- [x] Confidence tooltip: hover shows breakdown (schema + content + precedent delta)
- [x] Decision History: shows both actions taken AND skipped decisions
- [x] Popup health: green/yellow/red states render correctly, click navigates to Nest

## Design Compliance (4-Lens Review)

- [x] Lens 1 - Regenerative: No gamification, growth-agnostic stats, observant language
- [x] Lens 2 - Spatial: Correct paradigm per surface, materials match density, hit targets >= 44px
- [x] Lens 3 - Ecosystem: Agent state visible, cascade warnings on governing actions, surrogate marked
- [x] Lens 4 - Compliance: Labels, focus states, color not sole indicator, tokens used, components reused

## Progressive Disclosure Verification

- [x] Glance layer: Popup source dot visible without interaction
- [x] Scan layer: Badge row on draft cards shows provenance + confidence
- [x] Engage layer: "Sourced from" + "Track record" visible on card expand
- [x] Deep dive layer: Decision History in Roost shows full reasoning traces

## Regression Checks

- [x] Existing Chickens tab: draft cards without graph data render unchanged
- [x] Existing Roost tab: Agent section works without graph data
- [x] Existing Nest tab: Settings section unaffected
- [x] Existing Popup: no layout changes when sources not configured
- [x] No visual regressions on targeted component tests

## E2E Confidence

- [x] Full flow: add source -> agent ingests -> draft created -> provenance visible -> approve ->
  precedent recorded
- [x] Source removal flow: remove -> cascade warning -> confirm -> source gone -> entities marked stale
- [x] Multi-source enrichment: draft references entities from multiple sources

## Validation Evidence

- [x] Shared/storage/agent-memory targeted tests: 17 files / 236 tests.
- [x] Extension runtime/UI targeted tests: 23 files / 136 tests.
- [x] `bun run plans validate` passed for this closeout; latest dirty-worktree rerun is blocked by
  unrelated `next-step-review` QA status drift.
- [x] `bun run validate:quick` passed.
