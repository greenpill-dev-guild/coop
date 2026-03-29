# Status Bar Overflow Analysis - Popup Home Screen

## Issue Summary
The status bar in the popup home page is overflowing and doesn't fit on one row. This was likely caused by recent CSS changes that increased icon/button sizes from 28px to 32px.

## Files Involved

### 1. Component Files
- **PopupHomeScreen.tsx** (`/Users/afo/Code/greenpill/coop/packages/extension/src/views/Popup/PopupHomeScreen.tsx`)
  - Renders the home screen with `<PopupSubheader ariaLabel="Home status" equalWidth tags={statusItems} />`
  - Uses `equalWidth` prop to distribute tags equally across 3 columns (grid: `repeat(3, 1fr)`)

- **PopupSubheader.tsx** (`/Users/afo/Code/greenpill/coop/packages/extension/src/views/Popup/PopupSubheader.tsx`)
  - Component definition for the status bar
  - Supports `equalWidth` prop for equal distribution
  - Tags are rendered as spans/buttons with class `popup-subheader__tag`

- **usePopupOrchestration.ts** (`/Users/afo/Code/greenpill/coop/packages/extension/src/views/Popup/hooks/usePopupOrchestration.ts`)
  - Creates `homeStatusItems` array with 3+ tags:
    - Sync (with label and value)
    - Signals (with label, value, and tone)
    - Stale (with label, value, and tone)

### 2. CSS File
- **popup.css** (`/Users/afo/Code/greenpill/coop/packages/extension/src/views/Popup/popup.css`)

## Root Cause Analysis

### Container Width
```css
html, body {
  width: 360px;
  min-width: 360px;
  /* ... */
}
```
- Popup width: **360px**
- After 16px padding on each side: **360px - 32px = 328px available**

### Status Bar (Subheader) Layout
```css
.popup-subheader {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  /* overflow-x: auto; — allows horizontal scrolling */
  flex-shrink: 0;
}

.popup-subheader--equal {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  align-items: center;
  overflow-x: visible;  /* Changed from flex to grid */
}
```

### Individual Tag Dimensions
```css
.popup-subheader__tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px solid var(--coop-border);
  border-radius: var(--coop-radius-pill);
  background: var(--coop-field);
  color: var(--coop-text-soft);
  padding: 5px 10px;
  font-size: 0.76rem;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
}
```

### Recent CSS Changes (from git diff)
The recent change (commit `ce5512e`) modified `.popup-header__meta .popup-icon-button` from:
```css
width: 28px;
height: 28px;
border-radius: var(--coop-radius-sm);
```

To:
```css
/* Now inherits from general .popup-icon-button rule */
.popup-mark,
.popup-icon-button {
  width: 32px;
  height: 32px;
  border-radius: var(--coop-radius-icon);
}
```

## Space Calculation

### Expected Content per Tag (approximate)
- Sync tag: "Sync" + value (e.g., "Synced") = ~40-50px
- Signals tag: "Signals" + "3" = ~60-70px
- Stale tag: "Stale" + "0" = ~50-60px
- Plus borders, padding, gap between tags

### Grid Distribution with 3 Equal Columns
```
Available width: 328px
Columns: 3 × (328/3) = 3 × ~109px per column
Each column needs to fit one tag comfortably
```

At **109px per column**, tags may overflow if:
1. Content is wide (long labels or large numbers)
2. Icons are added to tags
3. Font sizes increase
4. Padding increases

## Why the 28px → 32px Change Affects This
While the icon button change is primarily in the header (not the subheader tags), the overall design system shift toward larger components suggests this is part of a size adjustment. However, the **direct cause** is likely:
- Increased padding/spacing throughout the popup
- Larger overall component footprint affecting layout math
- The subheader may have been designed with the 28px sizing assumption in mind

## Current CSS Issues

1. **Grid constraint on `popup-subheader--equal`**
   - Uses `grid-template-columns: repeat(3, 1fr)` which forces 3 equal columns
   - Each column only gets ~109px of space (328px / 3)
   - Tags with long content overflow within their grid cells

2. **No overflow handling in grid mode**
   - Changed from `flex` (overflow-x: auto) to `grid` (overflow-x: visible)
   - Grid can't scroll horizontally if content overflows
   - Tags are stuck at their grid column width

3. **Tag sizing**
   - `flex-shrink: 0` prevents tags from shrinking
   - `white-space: nowrap` prevents wrapping
   - Combined with narrow columns = overflow

## Recommended Fixes (to evaluate)

1. **Reduce padding on tags**
   - Current: `padding: 5px 10px`
   - Could reduce to: `padding: 4px 8px` or similar

2. **Reduce gap between items**
   - Current grid gap: 6px
   - Could reduce to: 4px

3. **Reduce font size on tags**
   - Current: `0.76rem`
   - Could reduce to: `0.72rem` or smaller

4. **Increase grid columns (if content allows)**
   - Currently 3 columns (Sync, Signals, Stale)
   - Could use fewer columns or variable layout
   - Would need design review

5. **Handle overflow gracefully**
   - Return to flex layout with `overflow-x: auto` for `--equal` variant
   - Or implement text truncation/abbreviation

6. **Reduce icon size if tags contain icons**
   - Check if status tags include icons that grew from 28px→32px

## Files to Check for Specific Changes
- Recent commits affecting tag dimensions or padding
- Check if icon sizes in tags were updated
- Look for any font-size changes in popup.css

