---
feature: docs-drift
title: Docs drift maintenance Codex lane
lane: docs
agent: codex
status: done
source_branch: chore/docs-drift
work_branch: codex/docs/docs-drift
depends_on:
  - ../spec.md
skills:
  - docs
  - architecture
updated: 2026-04-12
---

# Docs Lane

- Review code-facing docs for command drift, architecture mismatches, and stale plan references.
- Prefer small factual corrections over broad rewrites.

## Run Notes

- 2026-04-12: Corrected root build command references from `bun build` to `bun run build` where the docs were describing the package.json script.
- 2026-04-12: Updated release/reference docs so `validate:production-live-readiness` matches the current `scripts/validate.ts` suite graph, including Green Goods and Filecoin registry live checks.
