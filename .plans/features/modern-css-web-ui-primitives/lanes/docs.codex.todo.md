---
feature: modern-css-web-ui-primitives
title: Modern CSS Web UI Primitives docs lane
lane: docs
agent: codex
status: backlog
source_branch: main
work_branch: codex/docs/modern-css-web-ui-primitives
depends_on:
  - ../spec.md
skills:
  - docs
  - design
  - css
updated: 2026-05-24
---

# Docs Lane

## Objective

Record durable guidance after the UI/state lanes decide which modern CSS primitives Coop should adopt, pilot, or keep as research.

## Files

- `DESIGN.md`
- `docs/reference/coop-design-direction.md`
- `.plans/features/modern-css-web-ui-primitives/`

## Tasks

- [ ] Add a feature-readiness ladder to the appropriate durable guidance surface.
- [ ] Document token, scrollbar, dialog, popover, tooltip, and scroll-behavior standards after implementation scope is locked.
- [ ] Keep docs grounded in actual repo CSS and component surfaces.

## Verification

- [ ] `bun run plans validate`
- [ ] Repo docs/design validation only if future docs changes touch those surfaces.

## Handoff Notes

Do not publish guidance that claims a runtime primitive is adopted before UI/QA proof exists.
