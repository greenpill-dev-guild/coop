# Fix: Popup Home Status Bar Overflow

## Context

The status bar on the popup home screen has 4 tags (Sync, Signals, Stale, Drafts) but the grid is hardcoded to 3 columns (`repeat(3, 1fr)`). The 4th tag (Drafts) overflows.

## Fix

**File:** `packages/extension/src/views/Popup/hooks/usePopupOrchestration.ts` lines 768-779

Remove the `drafts` entry from the `homeStatusItems` array. The draft count is already visible in the Chickens footer tab badge, so it's redundant here. This brings the status bar back to 3 items (Sync, Signals, Stale) which fits the 3-column grid.

## Verification
- `bun run build`
- Visual: popup home screen shows 3 status tags on one row, no overflow
- `npx vitest run packages/extension/src/views/Popup/__tests__/PopupApp.test.tsx`
