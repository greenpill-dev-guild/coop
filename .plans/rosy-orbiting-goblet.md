# PWA Receiver App — Design Polish & Completion

## Context

The PWA receiver app (`packages/app/`) is **functionally complete** — all 4 hooks (useCapture, useReceiverSync, usePairingFlow, useReceiverSettings) are fully implemented with ~1567 lines of logic. The extension integration works: bridge protocol, relay protocol, Yjs sync, pairing flow. PWA infrastructure is in place: manifest, service worker, offline caching, share target, shortcuts.

**What's needed**: The UI is utilitarian — it works but doesn't feel like a polished native mobile app. The task is to elevate the visual design across all receiver screens to production-grade quality while preserving all existing functionality. Each view (CaptureView, InboxView, PairView) and the shell (ReceiverShell) need design attention. Dark mode, animations, empty states, and install experience need refinement.

## Research Summary

### Current State
- **5 routes**: `/landing`, `/pair`, `/receiver`, `/inbox`, `/board/:coopId`
- **Shell**: Fixed layout (topbar + scrollable main + bottom nav)
- **CSS**: 3916-line monolithic `styles.css`, imports shared tokens + a11y
- **Components**: Button, Card, BottomSheet, Skeleton, SyncPill, DevTunnelBadge
- **Dark mode**: Exists via `@media (prefers-color-scheme: dark)` but incomplete
- **Touch**: Pull-to-refresh, drag-to-close bottom sheet, tap feedback
- **Breakpoints**: 720px, 768px, 1024px
- **Safe areas**: env(safe-area-inset-*) for notch devices

### Design System Available
- **Tokens**: `packages/shared/src/styles/tokens.css` — full palette, spacing, radii, shadows
- **Global CSS**: `packages/extension/src/global.css` — 1269 lines of reusable classes
- **Extension patterns**: Panel cards, badges, filter popovers, skeleton loaders, footer nav, subheader pills

### Key Files
- `packages/app/src/app.tsx` — Router, hook orchestration (836 lines)
- `packages/app/src/views/Receiver/ReceiverShell.tsx` — Shell layout (206 lines)
- `packages/app/src/views/Receiver/CaptureView.tsx` — Capture screen (173 lines)
- `packages/app/src/views/Receiver/InboxView.tsx` — Inbox/Roost screen (137 lines)
- `packages/app/src/views/Receiver/PairView.tsx` — Pairing screen (155 lines)
- `packages/app/src/views/Receiver/icons.tsx` — Nav bar icons (103 lines)
- `packages/app/src/components/` — Button, Card, BottomSheet, Skeleton, SyncPill
- `packages/app/src/styles.css` — All CSS (3916 lines)
- `packages/app/src/hooks/` — 4 hooks, all functional

## Work Units

### Unit 1: ReceiverShell — Header, Navigation & Layout
**Files**: `views/Receiver/ReceiverShell.tsx`, `views/Receiver/icons.tsx`, `styles.css` (lines 2577-3024)
**Description**: Redesign the shell to feel native: frosted-glass header with blur, refined bottom tab bar with larger touch targets, better status indicator placement, smoother transitions between tab states. Add subtle gradient backdrop, improve the mark/title/status layout. Make the appbar icons more expressive with filled active states.

### Unit 2: CaptureView — Primary Capture Screen
**Files**: `views/Receiver/CaptureView.tsx`, `styles.css` (lines 2819-2882)
**Description**: Elevate the capture screen: refine the egg button with better gradient + shadows + recording state visuals, redesign the photo/file action buttons as icon-prominent touch targets, improve the hatch preview card with better type hierarchy and capture kind indicators. Add empty-state illustration for no captures.

### Unit 3: InboxView — Roost Capture List
**Files**: `views/Receiver/InboxView.tsx`, `styles.css` (lines 2883-2987, 3339-3345)
**Description**: Polish the inbox: better card layout with clear visual hierarchy, improved media previews (photo thumbnails, audio waveform placeholder), refined sync state indicators, better action button layout, improved empty state. Add grouping by sync state (synced vs pending).

### Unit 4: PairView — Pairing Experience
**Files**: `views/Receiver/PairView.tsx`, `styles.css` (lines 2779-2806, 3117-3155)
**Description**: Refine pairing flow: better textarea styling for nest code input, polished QR scanner overlay with viewfinder corners, improved pending pairing confirmation card with visual hierarchy, better error states. Make the "what this adds" info card more visually distinct.

### Unit 5: BottomSheet & Settings
**Files**: `components/BottomSheet.tsx`, `views/Receiver/ReceiverShell.tsx` (settings portion), `styles.css` (lines 3157-3231, 3235-3280)
**Description**: Polish the settings bottom sheet: better handle + animation, improved status chips with icons, clearer paired nest display, notification toggle with visual state, install CTA. Add a quick-status bar showing sync health.

### Unit 6: Dark Mode Completion
**Files**: `styles.css` (lines 3830-3916)
**Description**: Complete dark mode: ensure all receiver elements have proper dark variants (egg button, boot screens, install banner, QR dialog, form elements, empty states). Add dark variants for board view. Ensure all `rgba(255,...)` backgrounds have dark counterparts. Test contrast ratios for text on dark surfaces.

### Unit 7: Components — SyncPill, Card, Button, EmptyState
**Files**: `components/Button.tsx`, `components/Card.tsx`, `components/SyncPill.tsx`, `components/Skeleton.tsx`, `styles.css` (component rules scattered throughout)
**Description**: Elevate shared components: better button variants with gradient fills and transitions, refined card wrapper with consistent shadow/border treatment, improved SyncPill with animation for queued state, better skeleton shimmer, new empty state component with illustration.

### Unit 8: Animations, Transitions & Boot Screens
**Files**: `styles.css` (keyframes, view transitions, boot/install rules), `app.tsx` (boot screens only)
**Description**: Polish transitions: improve view-transition animations between routes, add staggered entrance animations for list items, refine the egg-pulse and hatch-in animations, polish boot splash screen with brand animation, improve install banner with slide-in entrance.

## E2E Test Recipe

Each worker should:
1. Run `bun run validate typecheck` to verify types
2. Run `bun run test -- --run packages/app` to verify app tests pass
3. Run `bun build` to verify the full build succeeds
4. Skip browser e2e — unit tests + build are sufficient for CSS/UI changes. The coordinator will verify visually in Chrome after merging.

## Worker Instructions Template

```
You are polishing the PWA receiver app in packages/app/.

OVERALL GOAL: Make the Coop receiver PWA feel like a polished, native mobile app.

DESIGN PRINCIPLES:
- Use existing design tokens from shared/src/styles/tokens.css
- Warm, organic palette: cream/brown/green/orange (Coop brand)
- Touch targets: minimum 44px height (WCAG 2.5.8)
- Frosted glass: backdrop-filter: blur() for overlays and surfaces
- Gradients: subtle radial gradients for depth, not flat backgrounds
- Shadows: layered shadows for elevation hierarchy
- Safe areas: always use env(safe-area-inset-*) for fixed elements
- Reduced motion: respect prefers-reduced-motion
- Typography: Avenir Next display, clear hierarchy with font-weight
- Border radius: use --coop-radius-* tokens
- Animations: 180-320ms easing for micro-interactions

EXISTING PATTERNS TO REUSE:
- CSS custom properties: --coop-cream, --coop-brown, --coop-green, --coop-orange, --coop-ink, etc.
- Spacing: --coop-space-3xs through --coop-space-xl
- Radii: --coop-radius-card (24px), --coop-radius-pill (999px), --coop-radius-input (16px)
- Shadows: --coop-shadow-sm, --coop-shadow-md, --coop-shadow-lg
- Transition: --coop-ease (180ms ease)

DO NOT:
- Change hook logic or add/remove functionality
- Change the routing system or navigation structure
- Add new dependencies
- Create new files unless absolutely necessary
- Remove existing CSS classes that other views depend on
- Break the existing responsive breakpoints
```
