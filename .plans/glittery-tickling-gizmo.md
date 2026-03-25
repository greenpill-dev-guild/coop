# Landing Page Animation Flow — Polish & Responsive Fixes

**Status**: ACTIVE
**Created**: 2026-03-24
**Last Updated**: 2026-03-24

## Context

The landing page narrative flow needs restructuring to match the intended story arc:
1. **Meadow** (sunny day) — chickens graze freely, no coop visible
2. **Scroll** — chickens drift rightward, clearing space for content; hoverable thought bubbles
3. **Ritual** — "Curate your coop" break
4. **Arrival** (dusk) — chickens converge into the coop as sun sets; coop ONLY appears here

Visual inspection at 2560px reveals backgrounds aren't full-bleed — hills and sky overlays are constrained by `.journey-scene-inner` (max 1280px), leaving visible edges on wide viewports.

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Introduce `.journey-scene-bg` wrapper for full-bleed elements | Separates decorative layer (hills, glows, sun, clouds, sky) from content layer (chickens, coop). Background layer needs full viewport width; chickens benefit from constrained content width for alignment with hero copy |
| 2 | Remove coop entirely from story scene | User's narrative: coop only appears at dusk (arrival scene). Currently it animates in during the meadow scroll |
| 3 | Redesign story flight paths — all rightward with 5 keyframes | Clears left side for hero copy and "How it works" cards. 5 keyframes (up from 3) matches arrival paths and enables grazing oscillation |
| 4 | CSS-only thought bubbles inside `.scene-chicken` wrapper | No React state needed — `:hover` on parent triggers child bubble. Bubble follows chicken since it's inside the same GSAP-animated container |
| 5 | Re-enable `pointer-events: auto` on story chickens only | Parent `.journey-scene` keeps `pointer-events: none` for scroll passthrough; individual chickens re-enable for hover. Arrival chickens stay non-interactive |
| 6 | Labels + thought bubble appear on hover only | Clean meadow with no text until hover — label and thought bubble appear together for a minimalist feel |
| 7 | Descriptive knowledge-type text for thought bubbles | Short descriptions of what each knowledge type captures (e.g. "Open browser tabs", "Meeting notes & memos") — informative over whimsical |
| 8 | Cloud-shaped thought bubble (comic style) | Classic thought bubble with rounded cloud shape + trailing small circles leading up from the chicken. More playful and on-brand with the chicken metaphor |
| 9 | Sunset fade-out transition from meadow to ritual | Sky warms to golden hour as story scene ends, chickens settle right, hills darken — natural visual bridge into ritual's warm cream. Already partially implemented via sky overlay + sun warm animations |
| 10 | Enhanced dramatic coop reveal in arrival | Add warm glow halo behind coop as it rises, door light flickers on slightly before chickens arrive — more cinematic "coming home" moment |

## Files to Modify

- `packages/app/src/views/Landing/index.tsx` — Remove story coop, restructure DOM (bg vs content layers), add thought bubbles, redesign flight paths
- `packages/app/src/styles.css` — `.journey-scene-bg` full-bleed wrapper, thought bubble styles, pointer-events override, remove `.story-scene-coop`, update static fallbacks

## Implementation Steps

### Step 1: Remove Story Coop

**Files**: `index.tsx`, `styles.css`

JSX changes:
- Delete the `.story-scene-coop` div + `<CoopIllustration />` from story scene (~line 1407-1409)
- Remove `storyCoopRef` declaration
- Remove `storyCoopParts` object construction and all `gsap.set` calls for it
- Remove the 3 `.fromTo()` calls animating `storyCoopParts.body`, `.roof`, `.frames` (~lines 894-911)

CSS changes:
- Delete `.story-scene-coop` rule (lines 1412-1416)
- Delete `.journey-scene-story.is-static .story-scene-coop` (lines 2365-2367)
- Update `@media (max-width: 1024px)` rule for `.story-scene-coop, .arrival-scene-coop` → just `.arrival-scene-coop`

**Verify**: `bun run validate typecheck`

### Step 2: Full-Bleed Background Restructure

**Files**: `index.tsx`, `styles.css`

Move background elements OUT of `.journey-scene-inner` into a new `.journey-scene-bg` sibling:

**Story scene** — new structure:
```jsx
<div className="journey-scene journey-scene-story">
  <div className="journey-scene-bg">
    {/* sky overlay, glows, sun, clouds, hills, path */}
  </div>
  <div className="journey-scene-inner">
    {/* chickens only */}
  </div>
</div>
```

**Arrival scene** — same pattern:
```jsx
<div className="journey-scene journey-scene-arrival">
  <div className="journey-scene-bg">
    {/* stars, moon, glows, cloud, hills, path */}
  </div>
  <div className="journey-scene-inner">
    {/* coop + chickens */}
  </div>
</div>
```

CSS addition:
```css
.journey-scene-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
```

Move the `::before` pseudo (gradient overlay, lines 164-169) logic from `.journey-scene` to `.journey-scene-bg::before` OR verify it already works since it's on the parent which is full-width.

GSAP refs still work — they're attached to DOM nodes directly, not scoped by parent structure. The `gsap.context(() => {...}, scope)` scope is `landingRootRef` which wraps everything.

**Verify**: `bun build` + visually check at 1440px and 2560px — hills must be edge-to-edge

### Step 3: Rightward Grazing Flight Paths

**Files**: `index.tsx`, `styles.css`

Replace `storyFlightPaths` (lines 183-227) with 5-keyframe paths where ALL chickens drift rightward:

Design pattern per chicken:
- **KF0**: Small scatter (slight random direction)
- **KF1**: Begin rightward drift + gentle y oscillation
- **KF2**: Continue right + opposite y oscillation (grazing bob)
- **KF3**: Further right, slight scale decrease (depth)
- **KF4**: Final right-half position (all x values 18-28vw)

All `x` values monotonically increase. Alternating `y` and `rotate` create natural grazing motion.

Update CSS static fallbacks (lines 2369-2398) — all chickens should have positive x transforms clustering right.

**Verify**: `bun dev:app` + scroll through story scene in Chrome — chickens should drift right, left side clear

### Step 4: Thought Bubbles + Hover Interactivity

**Files**: `index.tsx`, `styles.css`

Add thought content map near `journeyChickens`:
```typescript
const chickenThoughts: Record<string, string> = {
  tabs: 'Open browser tabs',
  notes: 'Meeting notes & memos',
  ideas: 'Sparks worth exploring',
  signals: 'Trends & opportunities',
  links: 'Saved references',
  drafts: 'Work in progress',
  threads: 'Conversation fragments',
  clips: 'Audio & video moments',
};
```

Update story scene chicken JSX — add thought bubble div, keep labels hover-only (`showLabel={false}`, label revealed via CSS on hover):
```jsx
<div className={`scene-chicken scene-chicken-${chicken.id}`} ...>
  <div className="thought-bubble" aria-hidden="true">
    {chickenThoughts[chicken.id]}
  </div>
  <ChickenSprite label={chicken.label} showLabel={true} variant={chicken.variant} />
</div>
```

Hide the label by default, reveal on hover alongside the thought bubble:
```css
.journey-scene-story .scene-chicken-label {
  opacity: 0;
  transition: opacity 200ms ease;
}
.journey-scene-story .scene-chicken:hover .scene-chicken-label {
  opacity: 1;
}
```

CSS additions:
```css
/* Re-enable pointer events on story chickens */
.journey-scene-story .scene-chicken {
  pointer-events: auto;
  cursor: pointer;
}

/* Cloud thought bubble — comic-style with trailing circles */
.thought-bubble {
  position: absolute;
  bottom: calc(100% + 1.2rem);
  left: 50%;
  transform: translateX(-50%) scale(0.8);
  padding: 0.45rem 0.7rem;
  border-radius: 1rem 1rem 1rem 0.25rem;
  background: rgba(255, 255, 255, 0.95);
  box-shadow:
    0 2px 8px rgba(79, 46, 31, 0.1),
    inset 0 -1px 2px rgba(79, 46, 31, 0.04);
  font-size: 0.75rem;
  color: var(--coop-brown);
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 250ms ease, transform 250ms ease;
  z-index: 10;
}

/* Trailing thought circles (two dots descending from bubble) */
.thought-bubble::before {
  content: '';
  position: absolute;
  bottom: -8px;
  left: 18%;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 1px 4px rgba(79, 46, 31, 0.08);
}

.thought-bubble::after {
  content: '';
  position: absolute;
  bottom: -14px;
  left: 12%;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 1px 3px rgba(79, 46, 31, 0.06);
}

/* Hover reveal */
.scene-chicken:hover .thought-bubble {
  opacity: 1;
  transform: translateX(-50%) scale(1);
}
```

**Verify**: Hover chickens in Chrome — bubble appears above with gentle scale-in

### Step 5: Enhanced Coop Reveal + Arrival Scene Polish

**Files**: `index.tsx`, `styles.css`

- Verify arrival scene background is now full-bleed after Step 2 restructure
- Verify dusk gradient transition from ritual section flows seamlessly into arrival background

**Enhanced coop reveal** — add warm glow halo behind the coop as it rises:

JSX: Add a `.scene-coop-halo` div inside `.arrival-scene-coop`, before `<CoopIllustration />`:
```jsx
<div className="scene-coop arrival-scene-coop" ref={arrivalCoopRef}>
  <div className="scene-coop-halo" />
  <CoopIllustration />
  ...
</div>
```

CSS for the halo:
```css
.scene-coop-halo {
  position: absolute;
  inset: -30%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 200, 80, 0.25), rgba(255, 180, 60, 0) 70%);
  opacity: 0;
  pointer-events: none;
  z-index: -1;
}
```

GSAP addition to `arrivalTimeline` — animate halo and add door-light flicker before chickens arrive:
```typescript
// Warm halo fades in as coop rises
arrivalTimeline
  .fromTo('.scene-coop-halo', { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1.1 }, 0.18)
  // Door glow flickers on slightly before chickens start arriving
  .fromTo(arrivalCoopGlowRef.current, { opacity: 0 }, { opacity: 0.3 }, 0.25)
  .to(arrivalCoopGlowRef.current, { opacity: 0.15 }, 0.3)     // flicker dim
  .to(arrivalCoopGlowRef.current, { opacity: 0.5 }, 0.35)     // flicker bright
  .to(arrivalCoopGlowRef.current, { opacity: 1 }, 0.55);      // full glow as chickens enter
```
Note: This replaces the existing single `.fromTo` on `arrivalCoopGlowRef` (currently at timeline position 0.35).

Pre-existing test fix: The test at line 72 expects a `"Why we build"` heading that doesn't exist in the component. Add a heading to the arrival scene journey-panels:
```jsx
<div className="journey-panels">
  <article className="journey-panel why-build-panel">
    <div className="why-build-copy nest-card">
      <h2>Why we build</h2>
      <p className="lede">Scattered knowledge becomes shared action when the right group has a clear place to work from.</p>
    </div>
  </article>
  <div className="arrival-scroll-spacer" aria-hidden="true" />
</div>
```

**Verify**: `bun run test -- Landing` + `bun run validate smoke`

## Verification

1. `bun run validate typecheck` after Step 1
2. `bun build` + Chrome visual check at 1440px, 2560px after Step 2
3. Chrome scroll-through at 1920px after Step 3
4. Chrome hover test after Step 4
5. `bun run validate smoke` (full unit tests + build) after Step 5
6. Final visual walkthrough at 1024px, 1440px, 1920px across the complete narrative flow
