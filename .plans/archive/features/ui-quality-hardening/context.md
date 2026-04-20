# Context

- Migrated from `.plans/ui-quality-hardening.todo.md`
- Archived source snapshot: `.plans/archive/migrated/ui-quality-hardening.todo.md`
- Key codepaths:
  - `packages/extension/src/views/Popup/`
  - `packages/extension/src/views/Sidepanel/`
  - `packages/extension/src/global.css`
  - `packages/extension/src/views/Popup/popup.css`
  - `packages/shared/src/styles/tokens.css`
  - `scripts/lint-tokens.ts`
  - `e2e/visual-*.spec.cjs`

## Notes

- This is mostly a Claude UI lane.
- Much of the original source plan is already done:
  - visual snapshot suites exist
  - token lint exists
  - the extension catalog exists
  - `SidepanelApp.tsx` and `SidepanelTabRouter.tsx` are already split
- Remaining hotspots are narrower:
  - snapshot drift around popup and sidepanel states
  - token cleanup in `global.css` and `popup.css`
  - optional follow-on cleanup in `NestTab.tsx` or `usePopupOrchestration.ts` only if directly justified by the UI work
- Keep changes aligned with the shipped extension structure, not the older monolith assumptions.
