---
feature: modern-css-web-ui-primitives
title: Modern CSS Web UI Primitives UI lane
lane: ui
agent: claude
status: backlog
source_branch: main
work_branch: claude/ui/modern-css-web-ui-primitives
depends_on:
  - ../spec.md
skills:
  - ui
  - react
  - accessibility
  - css
handoff_out: handoff/qa-codex/modern-css-web-ui-primitives
updated: 2026-05-24
---

# UI Lane

## Objective

Audit and later implement Coop's modern CSS/Web UI primitive adoption without redesigning the product. Keep the work scoped to app, extension, popup, sidepanel, and shared UI surfaces.

## Files

- `packages/shared/src/styles/tokens.css`
- `packages/shared/src/styles/a11y.css`
- `packages/app/src/styles.css`
- `packages/app/src/components/BottomSheet.tsx`
- `packages/app/src/views/Landing/index.tsx`
- `packages/extension/src/global.css`
- `packages/extension/src/views/Popup/popup.css`
- `packages/extension/src/views/shared/Tooltip.tsx`

## Tasks

- [ ] Create a CSS feature-readiness ladder for Coop.
- [ ] Inventory hardcoded CSS values and classify semantic token drift versus intentional local styling.
- [ ] Review global scrollbar hiding and propose explicit per-surface scroller behavior.
- [ ] Review native dialog, popover, bottom-sheet, and tooltip primitives for consolidation opportunities.
- [ ] Identify one low-risk scroll-state or scroll-triggered CSS pilot with static fallback.
- [ ] Define text-scale proof requirements before adding the meta tag.
- [ ] Keep overscroll gestures, HTML-in-Canvas, and advanced CSS function/style-query APIs out of production scope.

## Verification

- [ ] `bun run plans validate`
- [ ] Runtime validation only after a future implementation lane changes code.
- [ ] Browser/extension visual proof for popup, sidepanel, app sheet, landing, and large text before closing runtime work.

## Handoff Notes

QA should check that the work reduces CSS drift without turning into broad visual redesign, and that browser-native primitives preserve focus, escape, reduced-motion, and fallback behavior.
