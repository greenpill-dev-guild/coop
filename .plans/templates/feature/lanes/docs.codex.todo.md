---
feature: <feature-slug>
title: <Feature Title> docs lane
lane: docs
agent: codex
status: n/a
source_branch: <source-branch>
work_branch: codex/docs/<feature-slug>
depends_on:
  - ../spec.md
skills:
  - docs
  - review
updated: <YYYY-MM-DD>
---

# Docs Lane

## Objective

Describe the durable documentation or guidance update Codex should own.
Keep guidance small and point to the plan, code, or tests instead of duplicating implementation detail.

## Files

- `AGENTS.md`
- `CLAUDE.md`
- `docs/...`
- `.claude/...`

## Tasks

- [ ] Update only the smallest durable guidance surface needed.
- [ ] Keep `.plans` and `status.json` as execution truth.
- [ ] Link to concrete commands or files when guidance depends on validation.
- [ ] Avoid duplicating the full feature spec in long-lived docs.

## Verification

- [ ] `bun run plans:validate`
- [ ] `bun run validate:quick` if guidance changes affect checked files or scripts.

## Handoff Notes

Call out any guidance that is intentionally advisory rather than blocking.
