---
feature: agentic-flow-hardening
title: Agentic Flow Hardening docs lane
lane: docs
agent: codex
status: done
source_branch: feature/agentic-flow-hardening
work_branch: codex/docs/agentic-flow-hardening
depends_on:
  - state.codex.todo.md
  - contracts.codex.todo.md
  - api.codex.todo.md
  - ui.claude.todo.md
skills:
  - docs
  - review
updated: 2026-05-26
---

# Docs Lane

## Objective

Consolidate durable guidance after the implementation lanes without duplicating the full feature spec.

## Files

- `AGENTS.md`
- `CLAUDE.md`
- `DESIGN.md`
- `.claude/context/app.md`
- `.plans/templates/feature/...`

## Tasks

- [x] Keep `.plans` and `status.json` as execution truth.
- [x] Point UI/CSS agents at the extension appendix.
- [x] Keep route context aligned with current app route constants.
- [x] Keep `check:agentic-flow` documented as advisory by default.

## Verification

- [x] `bun run plans:validate`
- [x] `bun run check:design-md`
- [x] `bun run check:agentic-flow`

## Handoff Notes

Guidance is intentionally advisory except for existing DesignMD/token checks. No new blocking CI gate was introduced.
