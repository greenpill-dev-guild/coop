# App PWA UI Audit — Native-Like Feel, CSS Patterns, Design System

**Date**: 2026-03-14
**Scope**: `packages/app` — Receiver PWA views (Pair, Hatch, Roost), Landing, Board
**Focus**: Native-like mobile UX, CSS feature utilization, component/design system, responsive touch UI
**Mode**: Single-agent

---

## Executive Summary

The PWA receiver shell has solid structural bones for native-like behavior — fixed viewport frame, safe-area insets, overscroll containment, bottom tab bar with touch feedback, and a well-configured `manifest.webmanifest` with standalone display. However, it falls significantly short of "app store native" in several areas:

- **No component or design system** — zero UI library dependency, all styles hand-written in a single 1,341-line CSS file with frequent magic values
- **7+ CSS classes used in JSX have no corresponding styles** — elements render unstyled
- **No drawers, dialogs, or bottom sheets** — the only "drawer" is an HTML `<details>` toggle; the only "dialog" is a bare `<div role="dialog">` with no focus trap, backdrop, or animation
- **No loading states, skeletons, or transitions** between views
- **No view transitions or page animations** — route changes are instant jumps with no native-like slide/fade
- **Modern CSS features underutilized** — no container queries, no scroll-snap, no view transitions API, no `dvh` units, no `@starting-style`, no popover API
- **No dark mode support** — `color-scheme: light` hardcoded, zero `prefers-color-scheme` media queries

**Critical**: 7 | **High**: 6 | **Medium**: 8 | **Low**: 4

---

## Previous Findings Status

_First audit — no previous findings to verify._

---

## Critical Findings (Unstyled UI Elements)

### C1. Seven CSS classes used in JSX have no matching CSS rules [NEW]
- **Files**: `packages/app/src/app.tsx`, `packages/app/src/views/Board/index.tsx`
- **Issue**: The following classes are assigned to elements but have zero CSS definitions in `styles.css`:
  - `.helper-text` — used 4 times in pairing review (app.tsx:744, 748, 753, 759)
  - `.detail-grid` — used 1 time in pairing review (app.tsx:741)
  - `.stack` — used 2 times for QR scanner dialog and pairing review (app.tsx:720, 737)
  - `.source-link` — used 4 times in Board view (Board/index.tsx:319, 327, 358, 366)
  - `.badge-row` — used 1 time in Board view (Board/index.tsx:345)
  - `.badge` — used 2 times in Board view (Board/index.tsx:346, 347)
  - `.summary-card` — used 5 times in Board view (Board/index.tsx:240-256)
  - `.empty-state` — used 2 times in Board view (Board/index.tsx:333, 386)
- **Impact**: These elements render with browser defaults — no padding, spacing, font sizing, or layout. The pairing review detail grid (coop name, member, issued, expires) has no grid layout. Board summary cards have no styling. Archive "empty state" boxes have no visual treatment.
- **Recommendation**: Define these classes in `styles.css`. At minimum: `.detail-grid` needs a 2-column grid, `.helper-text` needs muted color/size, `.stack` needs vertical gap, `.summary-card` needs card treatment matching the design language, `.badge`/`.badge-row` need pill styling similar to existing `.sync-pill`, `.source-link` needs link color, `.empty-state` needs the dashed-border treatment already used by `.empty-nest`.

---

## High Findings

### H1. No native-like dialog/drawer/sheet primitives [NEW]
- **File**: `packages/app/src/app.tsx:720`, `packages/app/src/styles.css:553-606`
- **Issue**: The app has exactly two overlay-like patterns:
  1. **QR scanner**: A bare `<div role="dialog">` with no backdrop, no focus trap, no slide/fade animation, and no `inert` on background content. The `stack` class has no CSS. This is a div sitting inline in the page flow.
  2. **Settings drawer**: An HTML `<details>` element with a custom summary toggle. While functional, it pops open instantly with no animation, and is visually a simple expand — not a native-like bottom sheet or sliding drawer.
- **Impact**: Native apps use smooth bottom sheets (iOS) and drawers (Android) as primary interaction patterns. Neither pattern exists here. The QR scanner overlay fails WCAG 2.1 focus management requirements.
- **Recommendation**: Adopt a headless dialog/drawer library (Radix Dialog, Vaul for bottom sheets) or implement using the native `<dialog>` element with CSS animations. Add focus trapping. Add a translucent backdrop. Add a slide-up animation for the settings "drawer".

### H2. No loading states, skeletons, or transition feedback [NEW]
- **File**: `packages/app/src/app.tsx` (entire file), `packages/app/src/styles.css`
- **Issue**: Zero instances of loading indicators, skeleton screens, or Suspense boundaries. When `refreshLocalState()` runs on mount (fetching IndexedDB data), the UI shows either blank space or stale data. Route changes between Pair/Hatch/Roost are instant conditional renders with no transition. Audio recording state change from idle to recording has only a class toggle (`is-recording`) with no transition between states.
- **Impact**: On slower devices (which are exactly the mobile phones this PWA targets), the user sees jarring blank-then-populated jumps. Native apps never show blank screens — they show skeletons or placeholders.
- **Recommendation**: Add skeleton cards for the receiver grid, a loading spinner for initial mount, and CSS transitions on route panel visibility.

### H3. No view transitions or page-change animations [NEW]
- **File**: `packages/app/src/app.tsx:590-597` (route rendering), `packages/app/src/styles.css`
- **Issue**: Route changes are `if (route.kind === 'pair')` / `if (route.kind === 'receiver')` conditionals that hard-swap content. No CSS transitions, no View Transitions API, no animated panel sliding. The bottom tab bar highlights instantly with no state change animation.
- **Impact**: This is the single biggest gap vs. native feel. Native apps slide between views, cross-fade, or use shared element transitions. Hard-swapping content feels like a web page, not an app.
- **Recommendation**: Use the View Transitions API (`document.startViewTransition`) for supported browsers with a CSS cross-fade fallback. Alternatively, keep both panels mounted and use `translateX` to slide between them. Add a subtle scale/fade on tab bar icon active state change.

### H4. No apple-touch-icon in HTML head [NEW]
- **File**: `packages/app/index.html`
- **Issue**: The HTML `<head>` has no `<link rel="apple-touch-icon">` tags. While `manifest.webmanifest` has icons, iOS Safari uses `apple-touch-icon` link tags, not the manifest icons, when users add the PWA to their home screen. Without it, iOS generates a screenshot-based icon.
- **Recommendation**: Add `<link rel="apple-touch-icon" sizes="180x180" href="/branding/coop-mark-flat-192.png">` to `index.html`.

### H5. Uses `100vh` instead of `dvh` for full-height layouts [NEW]
- **File**: `packages/app/src/styles.css:49`, `packages/app/src/styles.css:979`
- **Issue**: `.page-shell` and `.board-shell` use `min-height: 100vh`. On mobile browsers, `100vh` includes the area behind the browser's URL bar, causing content to be hidden behind the bottom toolbar. The `dvh` (dynamic viewport height) unit correctly accounts for the mobile browser chrome.
- **Impact**: Board view and landing page may have content hidden behind Safari's bottom bar or Chrome's URL bar on mobile.
- **Recommendation**: Use `min-height: 100dvh` with a `100vh` fallback: `min-height: 100vh; min-height: 100dvh;`

### H6. Single monolithic CSS file with no design tokens in use [NEW]
- **File**: `packages/app/src/styles.css` (1,341 lines)
- **Issue**: While `tokens.css` defines design tokens (`--coop-radius-card: 24px`, `--coop-space-md: 1rem`, etc.), the main stylesheet overwhelmingly uses magic values instead:
  - `border-radius: 30px` (line 183) instead of `var(--coop-radius-card)` (24px)
  - `border-radius: 24px` in 8+ places as a literal instead of the token
  - `border-radius: 18px`, `20px`, `22px`, `26px`, `28px` — six different card-like radii with no token
  - `gap: 0.85rem`, `gap: 0.65rem`, `gap: 0.9rem` — spacing values that match no token
  - `padding: 1.4rem`, `1.2rem`, `0.95rem` — at least 12 unique padding values
  - `rgba(79, 46, 31, ...)` with at least 8 different alpha values (0.04, 0.05, 0.06, 0.08, 0.09, 0.12, 0.14, 0.16, 0.18) — the token `--coop-line` covers only one
- **Impact**: Visual inconsistency is baked in. Changing the design language requires hunting through 1,341 lines. Different radii and spacings on similar elements create subtle visual discord that registers subconsciously as "not polished."
- **Recommendation**: Audit all literal values. Consolidate to 3-4 radius tokens, 5-6 spacing tokens, and 3-4 shadow levels. Replace literals throughout.

---

## Medium Findings

### M1. No dark mode support [NEW]
- **File**: `packages/shared/src/styles/tokens.css:11`, `packages/app/src/styles.css`
- **Issue**: `color-scheme: light` is hardcoded. Zero `prefers-color-scheme` media queries exist. The entire palette is light-only.
- **Impact**: Mobile users who use dark mode (roughly 80% on iOS, 60% on Android per industry data) get a bright white app that breaks their visual flow. Native apps respect the system theme.

### M2. No scroll-snap for horizontal or list-based navigation [NEW]
- **File**: `packages/app/src/styles.css`
- **Issue**: The inbox list (`.receiver-list`) scrolls freely with no scroll-snap alignment. The receiver grid on wider viewports has no snap behavior. The landing page timeline and ritual grid have no scroll-snap for mobile horizontal scrolling.
- **Impact**: Native apps use scroll-snap to give lists and carousels a "sticky" card feel. Without it, content settles at arbitrary scroll positions.

### M3. Settings "drawer" lacks native affordances [NEW]
- **File**: `packages/app/src/app.tsx:624-671`, `packages/app/src/styles.css:553-636`
- **Issue**: The `<details>` element is a disclosure widget, not a drawer. It has no slide animation (the toggle arrow rotates but the content appears instantly), no drag-to-dismiss gesture, no backdrop, and no haptic feedback on toggle. On mobile, the toggle area (41px tall based on padding) is at the minimum touch target size.
- **Impact**: Users expect a smooth-sliding panel or bottom sheet. The instant expand/collapse feels abrupt. The small toggle target is borderline for finger interaction.

### M4. Button touch targets at or below minimum recommended size [NEW]
- **File**: `packages/app/src/styles.css:151-176`
- **Issue**: `.button` has `padding: 0.9rem 1.2rem` which is fine, but `.button-small` reduces to `padding: 0.7rem 1rem`. With a typical font size, small buttons may be around 36px tall — below the 44px recommended minimum for mobile touch targets (Apple HIG) and 48px (Material Design). The appbar links have `padding: 0.55rem 0.45rem` with total height depending on icon + label.
- **Impact**: Small buttons are used for "Share", "Copy link", "Download local file", "Retry sync" — frequent interactive actions in the inbox. Users with larger fingers will have difficulty tapping accurately.

### M5. No pull-to-refresh pattern [NEW]
- **File**: `packages/app/src/app.tsx`, `packages/app/src/styles.css`
- **Issue**: The receiver main area scrolls via `overflow-y: auto` with `overscroll-behavior-y: contain` (which correctly disables browser pull-to-refresh). However, no custom pull-to-refresh is implemented. The only way to refresh data is to navigate away and back.
- **Impact**: Native apps universally support pull-to-refresh on list views. Users instinctively pull down expecting data to refresh. The `contain` overscroll-behavior prevents the browser default but offers no replacement.

### M6. Egg button is visually creative but has no accessible state feedback [NEW]
- **File**: `packages/app/src/app.tsx:805-836`, `packages/app/src/styles.css:700-757`
- **Issue**: The egg-shaped record button relies entirely on visual animation (`egg-pulse`) and label text change ("Record" / "Stop") to indicate recording state. There is no `aria-pressed`, no live region announcement when recording starts/stops, and no non-visual indicator of the pulsing state. The `aria-label` correctly toggles but screen readers will not announce the transition.
- **Impact**: Screen reader users get no feedback that recording started. Users with reduced motion see a static egg (the pulse animation is correctly disabled by `prefers-reduced-motion`), but no alternative feedback is provided.

### M7. Repetitive inline styles in ErrorBoundary [NEW]
- **File**: `packages/app/src/app.tsx:37-52`
- **Issue**: The error boundary fallback uses inline `style={{}}` objects instead of CSS classes, with hardcoded values (`#666`, `#ccc`, `#fff`, `0.375rem`, `0.5rem 1rem`). These values don't match the design token palette.
- **Impact**: Error states look visually disconnected from the app's design language. Users see generic browser-default styling when something goes wrong, which breaks the native app illusion.

### M8. No container queries for responsive component adaptation [NEW]
- **File**: `packages/app/src/styles.css`
- **Issue**: All responsive breakpoints are viewport-based (`@media (max-width: 720px)`, `@media (min-width: 768px)`). No container queries exist. The receiver cards, inbox items, and board cards always respond to the viewport width, not their container width.
- **Impact**: On tablet-sized viewports (768px-1024px), the two-column receiver grid can produce uncomfortably narrow cards. Container queries would let each card adapt to its actual available space.

---

## Low Findings

### L1. No splash screen or app-loading animation [NEW]
- **File**: `packages/app/index.html`, `packages/app/public/manifest.webmanifest`
- No `apple-touch-startup-image` link tags. The manifest has no `splash_pages` or custom splash screen. When launched from the home screen, users see a white screen while JS loads.

### L2. Hover effects are properly gated but :active states lack visual depth [NEW]
- **File**: `packages/app/src/styles.css:912-933`
- Touch feedback uses `transform: scale(0.97)` which is subtle but exists. However, there is no color change, shadow change, or haptic-visual correlation on press. Native buttons typically darken or elevate on press.

### L3. Theme-color mismatch between HTML and manifest [NEW]
- **File**: `packages/app/index.html:22` vs `packages/app/public/manifest.webmanifest:10`
- HTML `<meta name="theme-color">` is `#f4efe4`, manifest `theme_color` is `#4f2e1f`. These should match for consistent browser chrome coloring. The manifest color (dark brown) will override on Android when installed, but the meta tag (warm cream) shows during normal browsing.

### L4. No font loading strategy [NEW]
- **File**: `packages/app/src/styles.css:5`, `packages/shared/src/styles/tokens.css:45-47`
- Font stacks are system-font based ("Avenir Next", "Gill Sans", etc.) which is correct for a PWA (no web font downloads = faster load). However, there is no `font-display` directive, no `@font-face` preload, and no fallback metric overrides. If "Avenir Next" is not available (most Android devices), the cascade falls to "Trebuchet MS" then "Segoe UI" — a very different visual feel.

---

## Design System Assessment

### Current State: No Design System

**Dependencies**: React 19, ReactFlow (for Board view only). Zero UI component library.

**Component approach**: Every UI element is a raw HTML element (`<button>`, `<details>`, `<article>`, `<div>`) with BEM-ish class names. No component abstraction layer exists — the `app.tsx` file directly renders all markup inline in a single 1,069-line component.

**Token usage rate**: ~15% of values reference CSS custom properties. ~85% are magic literals.

**Repeated patterns found**:
| Pattern | Instances | Variations |
|---------|-----------|------------|
| Card with rounded corners + border + shadow | 12+ | 6 different border-radii (18px-30px) |
| Pill/chip/badge | 8+ | 3 class names, subtly different padding |
| CTA button row | 7 | Same class, consistent |
| Status dot | 4 | Same class, consistent |
| Eyebrow text | 6+ | Same class, consistent |
| Empty state placeholder | 2 | 2 different class names (`.empty-nest`, `.empty-state`) |

### What Native-Like Requires

| Capability | Current | Needed |
|------------|---------|--------|
| Bottom sheet / drawer | `<details>` toggle | Sliding panel with gesture dismiss |
| Dialog / modal | `<div role="dialog">` | `<dialog>` with focus trap + backdrop |
| Toast / snackbar | Status text in settings toggle | Floating toast with auto-dismiss + animation |
| Tab bar transitions | Instant class swap | Icon morph / bounce + view slide |
| Pull-to-refresh | Disabled (overscroll-behavior) | Custom implementation |
| Haptic feedback | `triggerHaptic()` exists in JS | Connected to UI state changes |
| Skeleton loading | None | Pulsing placeholder cards |
| Swipe-to-dismiss | None | For inbox items |
| View transitions | None | Cross-fade or slide between routes |

---

## CSS Feature Utilization

### Used Well
- `env(safe-area-inset-top/bottom)` — proper notch/home-bar handling
- `overscroll-behavior: none/contain` — prevents rubber-banding correctly
- `-webkit-overflow-scrolling: touch` — momentum scrolling
- `touch-action: manipulation` — eliminates 300ms tap delay
- `-webkit-tap-highlight-color: transparent` — removes tap flash
- `backdrop-filter: blur()` — frosted glass on app bar and settings
- `@media (hover: hover) and (pointer: fine)` — correctly gates hover effects to non-touch
- `@media (prefers-reduced-motion)` — both in CSS and JS (MediaQueryList listener)
- `aspect-ratio` — on egg button
- `clamp()` — for responsive typography
- Grid + flexbox — consistently used throughout

### Not Used (Should Be)
| Feature | Use Case | Browser Support |
|---------|----------|-----------------|
| `dvh` / `svh` units | Replace `100vh` for mobile-correct heights | 94%+ (all modern) |
| View Transitions API | Route change animations | 78% (Chrome/Edge, Safari 18+) |
| `@container` queries | Card-level responsive layout | 91%+ |
| `scroll-snap-type` | Inbox list, landing carousels | 95%+ |
| `<dialog>` element | QR scanner overlay, confirmations | 96%+ |
| `@starting-style` | Entry animations on elements | 83% (Chrome/Edge/Safari 17.5+) |
| `prefers-color-scheme` | Dark mode | 97%+ |
| Popover API | Tooltips, status bubbles | 87%+ |
| `color-mix()` | Generate alpha variants from tokens | 91%+ |
| `text-wrap: balance` | Heading text wrapping | 90%+ |

---

## Recommendations (Priority Order)

1. **Define missing CSS classes** — 7 classes render with browser defaults right now (C1). This is the cheapest, highest-impact fix.

2. **Implement native `<dialog>` for overlays** — Replace `<div role="dialog">` with `<dialog>` elements using `::backdrop`, focus trapping, and Escape-to-close. Start with the QR scanner overlay. (H1)

3. **Add view transitions between routes** — Use `document.startViewTransition()` with CSS `view-transition-*` properties for a cross-fade/slide when switching between Pair/Hatch/Roost tabs. Fallback to instant swap for unsupported browsers. (H3)

4. **Add loading skeletons** — Create pulsing placeholder cards for the receiver grid and inbox list. Show them during initial `refreshLocalState()`. (H2)

5. **Replace `100vh` with `100dvh`** — One-line fix with fallback. Fixes mobile viewport height immediately. (H5)

6. **Add `apple-touch-icon`** — One-line HTML fix. Ensures proper iOS home screen icon. (H4)

7. **Consolidate design tokens** — Audit all radius, spacing, and color values. Create a proper token scale and replace magic values. This unlocks future theming (dark mode, high contrast). (H6)

8. **Adopt a bottom sheet component** — For settings panel and future confirmations. Vaul (React) or a custom implementation using CSS transforms and touch gesture handlers. (M3)

9. **Increase touch targets** — Set minimum `min-height: 44px` on all interactive elements. Increase `.button-small` padding. (M4)

10. **Add dark mode** — Define a `@media (prefers-color-scheme: dark)` token override block in `tokens.css`. Most of the palette can be inverted systematically. (M1)

---

## Trend

| Metric | 2026-03-14 |
|--------|-----------|
| Critical | **7** |
| High | **6** |
| Medium | **8** |
| Low | **4** |
| Total findings | **25** |
| Unstyled classes | **8** |
| CSS token adoption | **~15%** |
| Modern CSS features used | **6/16** |
| Native-like score (subjective) | **4/10** |

**Observation**: The PWA has good *structural* foundations for native-like behavior (fixed frame, safe-area insets, touch-action, overscroll containment, momentum scrolling, haptic feedback in JS). What it lacks is the *polish layer*: animations, transitions, loading states, proper overlay primitives, and design token consistency. The gap between "functional PWA" and "feels like an app store app" is primarily an animation/transition/component quality gap, not an architectural one.
