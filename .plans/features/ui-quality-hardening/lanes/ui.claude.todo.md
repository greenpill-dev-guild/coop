---
feature: ui-quality-hardening
title: UI quality hardening polish lane
lane: ui
agent: claude
status: done
source_branch: refactor/ui-quality-hardening
work_branch: claude/ui/ui-quality-hardening
depends_on:
  - ../spec.md
skills:
  - ui
  - react
  - accessibility
updated: 2026-03-30
---

# UI Lane

- Focus on the remaining UI quality gaps only:
  - stabilize or extend current popup and sidepanel visual snapshots where recent UI work has drifted
  - clean token drift in existing CSS and verify with `scripts/lint-tokens.ts`
  - make only small supporting component or layout edits needed to keep screenshots and tokens honest
- Do not reopen already-finished infra work such as:
  - the visual test harness
  - the token lint script
  - the extension catalog
  - the `SidepanelApp.tsx` split

## Implementation Notes

- Replaced extension-side hardcoded popup error and contrast colors with existing semantic tokens in `popup.css`.
- Fixed the extension token-lint violations by switching the compact card radius and invite composer overlay z-index to Coop tokens.
- Simplified the popup cancel-recording danger treatment so light and dark themes both derive from `--coop-error`.

## Validation

- `bun scripts/lint-tokens.ts` still fails, but only for pre-existing violations in `packages/app/src/styles.css`; the extension violations targeted by this lane were removed.
- `bun run validate quick` is blocked in this worktree because `node_modules` is missing and `tsc` is not installed.
- `cd packages/extension && bun run build` is blocked in this worktree because Bun cannot write to its temp directory (`PermissionDenied`).
