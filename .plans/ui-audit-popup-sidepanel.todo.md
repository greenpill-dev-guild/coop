# UI Audit: Popup & Sidepanel Consistency

**Branch**: `refactor/ui-audit-popup-sidepanel`
**Status**: COMPLETE
**Created**: 2026-03-23
**Completed**: 2026-03-23

## Context
User-driven UI audit identified 12 issues across popup and sidepanel: inconsistent headers, theme icon mismatch, border regressions, awkward share button placement, overscroll bounce, missing sticky subheaders, poor CoopCard layout, inline badge sizing, and theming legibility problems. This plan addresses all issues in a coordinated pass.

## Decisions (from user alignment)
1. **Theme icon** → show current state (moon=dark, sun=light) on both surfaces
2. **ShareMenu** → remove from feed card rows; simplify dialog share to `navigator.share()` with copy-link fallback
3. **Nest sub-tabs** → keep as separate pill row below the subheader (not merged)
4. **Chickens bar** → icon-only actions + text-labeled filters, all on one line
5. **CoopCard** → compact inline layout (name header, stats as text lines, no separate stat blocks)
6. **Dialog share button** → both `[↑ Share]` and `[Full view]` as equally sized outline buttons
7. **Subheader style** → frosted glass (backdrop-filter blur, semi-transparent bg, bottom border) matching existing sidepanel header
8. **Roundup button** → filled primary (coop-brown bg, white text, 28px); Capture Tab + Screenshot are ghost/outline 28px
9. **Coops tab** → apply SidepanelSubheader for consistency across all 4 tabs (keep card list + add subheader filter)
10. **TabCoopSelector** → replace entirely with SidepanelSubheader, delete old component
11. **Tooltips** → shared Tooltip component in `views/shared/`, applied to all icon-only buttons (~25-30), skip labeled buttons
12. **Tooltip location** → move PopupTooltip to `views/shared/Tooltip.tsx`, delete PopupTooltip.tsx

---

## Step 1: Popup header icon reorder ✅
Reordered `.popup-header__meta` children: Plus → Profile → Theme → Sidepanel toggle.

## Step 2: Theme icon consistency ✅
Both surfaces show icon representing current state (moon=dark, sun=light).

## Step 3: Fieldset border regression ✅
Added fieldset border reset for `.popup-choice-group` and `.popup-subheader`.

## Step 4: ShareMenu → native share in dialog only ✅
Removed ShareMenu from feed rows. Dialog now uses `navigator.share()` with clipboard fallback. ShareMenu kept for DraftListScreen.

## Step 5: Tighten artifact detail dialog padding ✅
Reduced padding on dialog header, body, footer, and section. Recovers ~15-20px vertical space.

## Step 6: Sidepanel overscroll fix ✅
Added `overscroll-behavior: none` to `.sidepanel-shell` and sidepanel HTML entry.

## Step 7: Create SidepanelSubheader component ✅
Created `SidepanelSubheader.tsx` with frosted glass styling, coop filter pills, icon-only action buttons, and filter passthrough slot. 11 tests.

## Step 8: Apply SidepanelSubheader to Roost tab ✅
Replaced TabCoopSelector with SidepanelSubheader in RoostTab.

## Step 9: Chickens tab — consolidate actions + fix theming ✅
Replaced 3-row layout with single SidepanelSubheader row: icon-only actions (primary roundup + ghost capture/screenshot) + text-labeled filter popovers.

## Step 10: Fix CoopCard content cutoff ✅
Removed `max-height: 160px`. Redesigned as compact inline layout with text stat lines and `·` separators.

## Step 11: Badge positioning (absolute, not inline) ✅
Changed `.nest-badge` to absolute positioning matching `.sidepanel-footer-nav__badge` pattern.

## Step 12: Apply SidepanelSubheader to Nest tab ✅
Two-row layout: SidepanelSubheader (coop pills + contextual actions) + nest sub-tabs (members/agent/settings).

## Step 13: Apply SidepanelSubheader to Coops tab ✅
List view: SidepanelSubheader with coop filter pills. Detail view: back arrow + coop name + action icons.

## Step 14: Delete TabCoopSelector ✅
Deleted `TabCoopSelector.tsx` and removed `.tab-coop-selector*` styles from global.css.

## Step 15: Move PopupTooltip to shared views directory ✅
Created `views/shared/Tooltip.tsx`, deleted `PopupTooltip.tsx`. CSS renamed to `.coop-tooltip*` in global.css. Portal root updated in both HTML entries.

## Step 16: Add tooltips to all icon-only buttons ✅
Wrapped all icon-only buttons (~25-30) with `<Tooltip>`. Replaced `title=` attributes in SidepanelApp. Applied to PopupHeader back button, feed dismiss, dialog close, sidepanel header buttons, SidepanelSubheader actions, NestTab copy buttons.

---

## Verification
- [x] `bun build` succeeds
- [x] `bun run test` — 2259/2260 pass (1 pre-existing app SVG test)
- [x] `bun format && bun lint` clean (0 errors)
- [x] All 16 steps implemented
