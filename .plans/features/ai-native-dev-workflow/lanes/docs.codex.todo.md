---
feature: ai-native-dev-workflow
title: AI-Native Developer Workflow docs lane
lane: docs
agent: codex
status: backlog
source_branch: feature/ai-native-dev-workflow
work_branch: codex/docs/ai-native-dev-workflow
depends_on:
  - state.codex.todo.md
  - ui.claude.todo.md
owned_paths:
  - AGENTS.md
  - CLAUDE.md
  - .claude/standards/output-contracts.md
  - .claude/skills
done_when:
  - smallest-guidance-update
  - rule-feedback-loop-recorded
skills:
  - docs
  - review
updated: 2026-05-24
---

# Docs Lane

## Objective

After the workflow proves useful, update only the smallest durable guidance surface needed.

## Tasks

- [ ] Wait until week-five evidence exists.
- [ ] Add or adjust one targeted rule for repeated agent failures.
- [ ] Do not duplicate the full spec in guidance.

## Verification

- [ ] `bun run plans:validate`
- [ ] `bun run validate quick` if guidance changes affect checks.
