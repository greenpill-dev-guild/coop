---
feature: agentic-flow-hardening
title: Agentic Flow Hardening UI lane
lane: ui
agent: claude
status: done
source_branch: feature/agentic-flow-hardening
work_branch: claude/ui/agentic-flow-hardening
depends_on:
  - ../spec.md
skills:
  - ui
  - react
  - accessibility
handoff_out: handoff/qa-codex/agentic-flow-hardening
updated: 2026-05-26
---

# UI Lane

## Objective

Clarify extension design guidance and app route context so UI agents do not rely on stale or missing surface rules.

## Files

- `packages/extension/...`
- `packages/app/...`

## Tasks

- [x] Add the `DESIGN.md` Extension Appendix for popup/sidepanel CSS ownership.
- [x] Point `AGENTS.md` and `CLAUDE.md` design guidance at the appendix.
- [x] Update `.claude/context/app.md` to reflect `/app/*` receiver routes and legacy aliases.
- [x] Add or update UI tests where appropriate.
- [x] Keep file ownership tight or document justified spillover.
- [x] Document any UX tradeoffs.

## Verification

- [x] `bun run check:design-md`
- [x] Browser proof not required; no rendered UI behavior changed.

## Handoff Notes

Human judgment callout: extension still does not get a separate DesignMD dialect. This pass documents current ownership rules in the root design file instead.
