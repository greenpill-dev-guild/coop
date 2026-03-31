# Phase 3: Receiver Design Polish - Preparation & Overview

**Status**: Ready to Start
**Branch**: `luiz/phase-3-receiver-polish`
**Target Feature**: `receiver-design-polish`
**Lane Owner**: Claude (UI)
**Work Branch Naming**: `claude/ui/receiver-design-polish`

## Overview

Phase 3 focuses on elevating the PWA Receiver app from **functionally complete** to **production-grade visual design**. All core logic (capture, sync, pairing, settings) is already implemented. This phase is purely UI/UX polish without breaking any existing functionality.

## Key Files to Polish

### Views (Receiver App)
- `packages/app/src/views/Receiver/ReceiverShell.tsx` (206 lines)
- `packages/app/src/views/Receiver/CaptureView.tsx` (173 lines)
- `packages/app/src/views/Receiver/InboxView.tsx` (137 lines)
- `packages/app/src/views/Receiver/PairView.tsx` (155 lines)
- `packages/app/src/views/Receiver/icons.tsx` (103 lines)

### Components
- `packages/app/src/components/Button.tsx`
- `packages/app/src/components/Card.tsx`
- `packages/app/src/components/BottomSheet.tsx`
- `packages/app/src/components/SyncPill.tsx`
- `packages/app/src/components/Skeleton.tsx`

### Styling
- `packages/app/src/styles.css` (3916 lines - mainly receiver + dark mode)

## Work Units (8 Total)

### Unit 1: ReceiverShell — Header, Navigation & Layout
- **Scope**: Shell chrome, bottom tab bar, header status
- **Details**: Frosted glass header, refined tab bar, better status indicators
- **Files**: ReceiverShell.tsx, icons.tsx, styles.css (lines 2577-3024)

### Unit 2: CaptureView — Primary Capture Screen
- **Scope**: Egg button, photo/file actions, hatch preview
- **Details**: Better gradient + shadows, recording state visuals, empty state illustration
- **Files**: CaptureView.tsx, styles.css (lines 2819-2882)

### Unit 3: InboxView — Roost Capture List
- **Scope**: Card layout, media previews, sync indicators
- **Details**: Better hierarchy, thumbnails, waveform placeholders, grouping by sync state
- **Files**: InboxView.tsx, styles.css (lines 2883-2987, 3339-3345)

### Unit 4: PairView — Pairing Experience
- **Scope**: QR scanner, nest code input, confirmation states
- **Details**: Better textarea styling, scanner overlay with viewfinder, error states
- **Files**: PairView.tsx, styles.css (lines 2779-2806, 3117-3155)

### Unit 5: BottomSheet & Settings
- **Scope**: Settings modal, status chips, paired nest display
- **Details**: Better handle + animation, improved chips, notification toggle CTA
- **Files**: BottomSheet.tsx, ReceiverShell.tsx (settings), styles.css (lines 3157-3231, 3235-3280)

### Unit 6: Dark Mode Completion
- **Scope**: Dark variants for all receiver + board views
- **Details**: Dark backgrounds, egg button, boot screens, QR dialog, forms, contrast compliance
- **Files**: styles.css (lines 3830-3916)

### Unit 7: Components — SyncPill, Card, Button, EmptyState
- **Scope**: Shared component polish
- **Details**: Button gradients, card shadows, SyncPill animations, skeleton shimmer, empty states
- **Files**: Button.tsx, Card.tsx, SyncPill.tsx, Skeleton.tsx, styles.css

### Unit 8: Animations, Transitions & Boot Screens
- **Scope**: View transitions, entrance animations, boot splash
- **Details**: View-transition between routes, staggered list entrance, egg-pulse, hatch-in, boot splash
- **Files**: styles.css (keyframes), app.tsx (boot screens)

## Design System Foundation

### Available Tokens
From `packages/shared/src/styles/tokens.css`:
- Color palette: cream, brown, green, orange, ink
- Spacing scale: 0.5rem to 4rem
- Border radii: --coop-radius-pill through --coop-radius-card-xl
- Shadows: layered elevation shadows
- Typography: Avenir Next with weight scale

### Design Patterns to Reuse
- Frosted glass: `backdrop-filter: blur(12px)` + rgba(255, ...) backgrounds
- Gradients: subtle radial gradients for depth
- Safe areas: `env(safe-area-inset-*)` for notch devices
- Touch targets: minimum 44px height (WCAG 2.5.8)
- Reduced motion: respect `prefers-reduced-motion: reduce`
- Animations: 180-320ms easing for interactions

## Testing Requirements

### Before Committing
1. Run `bun run validate typecheck` - verify types
2. Run `bun run test -- --run packages/app` - unit tests
3. Run `bun build` - full build success
4. Manual browser testing at key breakpoints: 375px, 768px, 1024px

### No E2E Browser Testing Required
- CSS/UI changes don't require Playwright E2E
- Visual verification will be done by coordinator post-merge

## Important Constraints

### Must Preserve
✅ All existing hook behavior (useCapture, useReceiverSync, usePairingFlow, useReceiverSettings)
✅ All routing logic (no changes to app.tsx router)
✅ All sync/pairing logic (no protocol changes)
✅ Component prop interfaces (unless adding new optional props)

### Can Change
✅ CSS/styling (everything in styles.css)
✅ Component visual implementation (internals, not props)
✅ Animation/transition timings
✅ Dark mode variants (not in current code)
✅ Empty state content and styling
✅ Icon styling (in icons.tsx)

## Suggested Implementation Order

1. **Start with Unit 1 (Shell)** - foundation for all other views
2. **Proceed to Unit 2 & 3** (Capture and Inbox) - primary user surfaces
3. **Handle Unit 4 & 5** (Pairing and Settings) - secondary flows
4. **Complete Unit 6** (Dark Mode) - ensure full coverage
5. **Polish Unit 7 & 8** (Components and Animations) - final refinement

## Branch Workflow

```bash
# Current branch
git branch -v
# luiz/phase-3-receiver-polish (your current location)

# When starting work on a unit:
git checkout -b claude/ui/receiver-design-polish-unit-1
# Make changes
# git add, commit, push

# Create PR from unit branch back to luiz/phase-3-receiver-polish
# Review, merge into main phase branch
# Repeat for each unit

# Final: PR from luiz/phase-3-receiver-polish to main
```

## Progress Tracking

Use this checklist to track units as you complete them:

- [ ] Unit 1: ReceiverShell (Header, Navigation & Layout)
- [ ] Unit 2: CaptureView (Primary Capture Screen)
- [ ] Unit 3: InboxView (Roost Capture List)
- [ ] Unit 4: PairView (Pairing Experience)
- [ ] Unit 5: BottomSheet & Settings
- [ ] Unit 6: Dark Mode Completion
- [ ] Unit 7: Components Polish (Button, Card, SyncPill, Skeleton)
- [ ] Unit 8: Animations & Boot Screens

## Key Design Principles

### Hierarchy
- Use font-weight, size, and color to establish visual hierarchy
- Primary actions prominent, secondary actions subtle
- Status information clearly visible but not intrusive

### Touch UX
- All interactive elements minimum 44px
- Clear feedback on tap (highlight, color change)
- Sufficient whitespace around touch targets
- Smooth, predictable animations

### Color & Contrast
- Warm palette: cream/brown/green/orange
- Sufficient contrast for WCAG AA (4.5:1 for text)
- Dark mode: invert carefully, maintain readability
- Use color meaningfully (green for success, orange for warning)

### Responsive
- Mobile-first design (375px base)
- Tablet optimizations (768px)
- Desktop support (1024px+)
- Safe areas for notch devices

## Handoff Notes for Code Review

When the phase is complete:
1. All 8 units implemented and tested
2. Build passing, types clean, tests passing
3. Visual polish across all receiver views
4. Dark mode complete and tested
5. No breaking changes to component APIs
6. Git history clean with descriptive commits

## Current Status

✅ Phase 2 (Landing Page) - COMPLETE
✅ Branch renamed to `luiz/phase-2-landing-complete`
✅ New branch `luiz/phase-3-receiver-polish` created
🔄 Ready to begin Phase 3 receiver design work

## Next Action

When ready to begin Phase 3:
1. Review the detailed unit descriptions in `.plans/features/receiver-design-polish/`
2. Check existing Receiver views in `packages/app/src/views/Receiver/`
3. Familiarize yourself with current styling in `packages/app/src/styles.css`
4. Start with Unit 1 (ReceiverShell) as foundation
5. Follow the implementation order suggested above

Recommended tool: Use the skills system with `react` and `ui-compliance` for UI/UX guidance.
