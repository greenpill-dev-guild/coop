---
feature: agent-judgment-cues
title: Passive judgment cues UI lane
lane: ui
agent: claude
status: done
source_branch: main
work_branch: claude/ui/agent-judgment-cues
depends_on:
  - ../spec.md
  - ./state.codex.todo.md
owned_paths:
  - packages/extension/src/views/Sidepanel/operator-sections
  - packages/extension/src/views/Sidepanel/tabs
  - packages/extension/src/views/Sidepanel/review-risk.ts
updated: 2026-04-18
---

# UI Lane

- Reused existing badges, helper text, and action rows in Roost and Nest.
- Added passive risk badges plus deterministic “Needs judgment” helper copy.
- Added inline acknowledgement only for live, permission, and destructive actions.
- Kept low-risk approvals visually light and unchanged in flow.
