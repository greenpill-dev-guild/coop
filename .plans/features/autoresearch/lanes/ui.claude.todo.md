---
feature: autoresearch
title: UI — Settings Panel & Experiment Journal
lane: ui
agent: claude
status: done
source_branch: feature/autoresearch
work_branch: main
depends_on:
  - ./runtime.codex.todo.md
owned_paths:
  - packages/extension/src/views/Sidepanel/
done_when:
  - NestAutoresearchSection exposes autoresearch settings controls
  - NestAutoresearchSection renders an experiment journal
skills:
  - design
  - react
  - ui-compliance
updated: 2026-05-08
---

# UI — Settings Panel & Experiment Journal

Operator-facing controls for autoresearch: per-skill toggles, budget configuration, and a browsable
experiment journal.

## Objective

Add autoresearch controls to the Nest tab (settings area) and an experiment journal viewer. Follows
existing Sidepanel patterns — compact cards, progressive disclosure, Coop design language.

## Files

- `packages/extension/src/views/Sidepanel/tabs/NestAutoresearchSection.tsx` — settings and journal section
- `packages/extension/src/views/Sidepanel/tabs/__tests__/NestAutoresearchSection.test.tsx` — UI/runtime message coverage
- `packages/extension/src/global.css` — autoresearch controls, journal, score, focus, and pagination styles

Implementation note: the UI was completed inside the existing `NestAutoresearchSection` instead of
splitting into new component files. This keeps the change aligned with the current Nest tab structure
and avoids introducing parallel component paths.

## Tasks

### 1.1 RED — Failing tests for settings component

- [x] Test: renders toggle for each WebLLM skill
- [x] Test: toggle calls `updateConfig(skillId, { enabled })` on change
- [x] Test: budget slider updates `maxExperimentsPerCycle`
- [x] Test: quality floor input validates range 0.0-1.0
- [x] Test: "Run Now" button calls `runCycle()` for selected skill
- [x] Test: disabled state shown when no WebLLM skills available

### 1.2 RED — Failing tests for journal component

- [x] Test: renders experiment cards sorted by createdAt descending
- [x] Test: kept experiments show green indicator, reverted show neutral
- [x] Test: card shows skill name, composite score, delta, and duration
- [x] Test: expanding card reveals prompt diff and fixture results
- [x] Test: empty state shows "No experiments yet" message
- [x] Test: pagination loads more records on scroll

### 1.3 GREEN — Implement settings component

- [x] Per-skill config controls in `NestAutoresearchSection`
- [x] Toggle switch for enable/disable (reuse existing toggle pattern)
- [x] Budget controls: experiments per cycle (1-20 range), time budget (10s-5min)
- [x] Quality floor: numeric input with 0.0-1.0 validation
- [x] "Run Now" button with loading state during cycle execution
- [x] Current quality trend indicator per skill (from recent journal deltas)

### 1.4 GREEN — Implement journal component

- [x] Experiment journal card list in `NestAutoresearchSection`
- [x] Card layout: skill badge, score bar, delta chip, timestamp
- [x] Expandable detail: unified diff view, per-fixture scores, duration
- [x] Filter by skill and outcome (kept/reverted/all)
- [x] Scroll-based pagination with explicit "Show more" fallback (load 20 at a time)
- [x] Empty state with explanation of what autoresearch does

### 1.5 GREEN — Wire into Nest tab

- [x] Add "Autoresearch" section to NestTab
- [x] Settings and journal as sub-sections within
- [x] Respect existing Nest tab layout patterns

### 1.6 REFACTOR

- [x] Extract shared card/control styles to global.css where reusable
- [x] Ensure WCAG 2.1 AA compliance (contrast, focus indicators, screen reader labels)
- [x] Verify responsive layout at sidepanel widths

## Verification

```bash
bun run test -- packages/extension/src/views/Sidepanel/tabs/__tests__/NestAutoresearchSection.test.tsx
bun run validate:sidepanel-settings
bun run validate:quick
```

## Handoff Notes

Completed on main on 2026-05-08. QA pass 2 verified settings persistence across remount,
journal refresh after run-now completion, and visible run-now loading/error feedback.
