---
feature: docs-drift
title: Docs drift maintenance Claude lane
lane: docs
agent: claude
status: done
source_branch: chore/docs-drift
work_branch: claude/docs/docs-drift
depends_on:
  - ../spec.md
skills:
  - docs
  - ui
updated: 2026-04-12
---

# Docs Lane

- Review user-facing docs for stale UI descriptions, drift, or hallucinated behavior.
- Correct only what the codebase or current plans justify.

## Run Notes

- 2026-03-27: Aligned `AGENTS.md` QA pass ownership with `.plans` templates and `scripts/plans.ts`.
- 2026-03-27: Updated `docs/reference/product-requirements.md` from legacy Home/Feed tab names to current Nest/Coops wording where directly verified in the sidepanel.
