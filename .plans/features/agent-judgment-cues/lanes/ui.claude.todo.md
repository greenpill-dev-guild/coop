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
  - packages/extension/src/views/Sidepanel/review-risk.tsx
updated: 2026-04-20
---

# UI Lane

- Reused existing badges, helper text, and action rows in Roost and Nest.
- Added passive risk badges plus deterministic review helper copy.
- Added inline acknowledgement only for live, permission, destructive, and permanent-record actions.
- Kept low-risk approvals visually light and unchanged in flow.
- Post-release simplification pass (2026-04-20): publish, archive, and sync-only plans stay in
  approval framing; “Needs judgment” helper copy remains reserved for live, permission,
  destructive, and permanent-record work.
