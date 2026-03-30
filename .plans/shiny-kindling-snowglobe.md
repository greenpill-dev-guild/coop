# Landing Page UI Audit — Iteration 2

## Context

Follow-up audit after implementing Iteration 1 changes. User tested on-device and identified regressions, bugs, and new improvement requests. This plan covers regression fixes, UX improvements, and a significant redesign of the Why We Build section.

---

## Critical Files

| File | Role |
|------|------|
| `packages/app/src/styles.css` | All landing styles |
| `packages/app/src/views/Landing/index.tsx` | Main component, GSAP timelines, JSX |
| `packages/app/src/views/Landing/landing-data.ts` | Chicken data, flight paths, audience defaults |
| `packages/app/src/views/Landing/landing-animations.tsx` | ChickenSprite SVG component |
| `packages/app/src/views/Landing/landing-types.ts` | Type definitions |

---

## Batch A: Regressions & Bugs

### A1. Logo positioning — verify left alignment
**Problem**: User reports logo moved from left to right.
**File**: `styles.css:83-97`
**Investigation**: `.topbar` has `justify-content: flex-start`, which should be left. This is likely a visual perception issue from the hero grid changes. Verify on-device and fix if needed. Possible cause: the `.hero-shell` grid `3.8fr + 1.7fr` may visually push the topbar content since the topbar sits inside `.landing-topbar` which is `position: absolute` spanning full width. If the logo appears centered instead of left, check if the topbar container width or margin is misaligned.

### A2. Thought bubbles — restore partial default visibility
**Problem**: Previously, some thought bubbles were visible by default (not just hover). The opacity fix made them too transparent. User wants 3-4 visible always.
**File**: `styles.css:2101-2149`
**Changes**:
- Add CSS to show thought bubbles on selected chickens by default at ~50% opacity:
```css
.journey-scene-story .scene-chicken-tabs .thought-bubble,
.journey-scene-story .scene-chicken-ideas .thought-bubble,
.journey-scene-story .scene-chicken-links .thought-bubble {
  opacity: 0.5;
  transform: translateX(-50%) scale(0.9);
}
```
- These 3 represent varied content types (tabs, ideas, links) from different sides
- Full opacity on hover stays as-is

### A3. Hero subtitle wrapping
**Problem**: "Turning knowledge into opportunity" wraps to two lines.
**File**: `styles.css:308` — `max-width: 22rem` is too narrow
**Fix**: Remove `max-width` or increase to `32rem` so the text stays on one line

### A4. Flashcard hover effect — amplify
**Problem**: After setting rest angles to 0deg, the hover jiggle is imperceptible (only ±0.65deg).
**File**: `styles.css` — `@keyframes flashcard-hover-left` and `flashcard-hover-right`
**Changes**: Increase hover rotation to ±2deg and lift to -6px for a satisfying tactile feel:
```css
@keyframes flashcard-hover-left {
  0%   { transform: rotate(0deg) translateY(0); }
  40%  { transform: rotate(-2deg) translateY(-6px); }
  68%  { transform: rotate(0.5deg) translateY(-3px); }
  100% { transform: rotate(-0.8deg) translateY(-4px); }
}
```
- Also add `transition: transform 180ms ease, box-shadow 180ms ease` for snappier interactive feel
- Add a subtle scale bump: `scale(1.02)` at the 40% keyframe

### A6. Backdrop close for flashcard dialog
**Problem**: Clicking outside the dialog doesn't close it — only the X button works.
**File**: `styles.css:857-904`, `index.tsx:1207-1217`
**Root cause**: The `.flashcard-focus-shell` has `padding: 1rem 3.5rem` which creates a clickable backdrop area, but it may be too narrow or the background is too subtle for users to realize it's clickable.
**Fix**:
- Make the backdrop background more visible: increase opacity to `rgba(79, 46, 31, 0.18)` → `0.28`
- Ensure the shell covers the full card area by checking inset: 0 works correctly
- Add cursor: pointer on the backdrop for affordance

### A7. Card closing animation
**Problem**: Dialog just disappears — no exit animation.
**File**: `styles.css` — add a `flashcard-putdown` keyframe reverse of `flashcard-pickup`
**Changes**:
- When `openCardId` changes to null, apply a closing animation class briefly before unmounting
- Or use CSS `@starting-style` for exit transitions on the `[open]` dialog attribute
- Simpler approach: add transition on `.flashcard-focus-shell` opacity/transform that plays on removal of `.is-active`

### A8. Recording broken — stops immediately
**Problem**: Click record → starts → immediately stops.
**File**: `index.tsx:743-819`
**Root cause**: Browser speech recognition may auto-stop due to silence detection or lack of microphone permission. The `onend` handler clears state which makes it look broken.
**Fix**:
- Add an auto-restart mechanism in `onend`: if recording wasn't intentionally stopped, restart recognition
- Add a `stoppedIntentionally` ref to distinguish user-stop from browser-stop
- Better error UX: show "Microphone access required" or "No speech detected — try again" messages

---

## Batch B: Curate Section Polish

### B1. Scroll lock (GSAP ScrollTrigger pin)
**Problem**: User wants the Curate section to snap/lock into place during scroll with tactile feel.
**File**: `index.tsx` — add a new GSAP ScrollTrigger with `pin: true`
**Changes**:
- Add a ref for the ritual section
- Create a new ScrollTrigger with:
  ```js
  ScrollTrigger.create({
    trigger: ritualSectionRef.current,
    start: 'top top',
    end: '+=100vh',
    pin: true,
    pinSpacing: true,
  });
  ```
- This locks the section for ~100vh of extra scroll (medium pin)
- The section will feel like it "catches" during scroll, then releases

### B2. Card title font size — prevent wrapping on laptops
**Problem**: Flashcard titles wrap on laptop viewports.
**File**: `styles.css:1014-1016`
**Fix**: Reduce the clamp minimum:
```css
.flashcard-front h3 {
  font-size: clamp(1.15rem, 1.8vw, 1.65rem);
  line-height: 1.18;
}
```

### B3. Paste button for research notes
**Problem**: No paste button — users must Cmd+V.
**File**: `index.tsx` — add a paste button in the flashcard stage
**Changes**:
- Add a "Paste" button next to the Record button in `.flashcard-stage-actions`
- On click, read from `navigator.clipboard.readText()` and append to the textarea
- Style as a secondary button with a clipboard icon

### B4. "Everything stays local" — more prominent messaging
**Problem**: The privacy message is buried.
**File**: `index.tsx`, `styles.css`
**Changes**:
- Add a small persistent banner/badge in the ritual toolbar area: "All data stays on this device"
- Style with a lock icon and subtle green accent
- Replace the per-card "Everything stays saved on this device" tip with the toolbar-level message

### B5. Record button — red theming
**Problem**: Record button doesn't look like a record button.
**File**: `styles.css`
**Changes**:
- `.ritual-record-button.is-recording`: red background (`#d03030`), white text, pulse animation
- Add a small red dot indicator before the "Record" text
- Add a `recording-pulse` animation (may already exist — check `@keyframes recording-pulse`)

---

## Batch C: Chicken Diversity & Scene Animation

### C1. More chickens with color variants
**Problem**: Only 8 chickens, all similar green-toned. Need more diversity.
**Files**: `landing-data.ts`, `landing-animations.tsx`, `landing-types.ts`, `styles.css`
**Changes**:
- Add a `color` property to `JourneyChicken` type: `'classic' | 'russet' | 'slate' | 'golden' | 'plum'`
- Add CSS color variant classes:
  - `.chicken-russet`: warm brown body, darker brown wing, burnt orange comb
  - `.chicken-slate`: blue-gray body, cool gray wing, steel blue comb
  - `.chicken-golden`: golden-cream body, amber wing, rich gold comb
  - `.chicken-plum`: warm lavender body, dusty rose wing, deep plum comb
- Add 4 more chickens to `journeyChickens` (total 12):
  - `bookmarks` (russet, adult, right)
  - `photos` (golden, young, left)
  - `voice-memos` (plum, chick, right)
  - `receipts` (slate, young, left)
- Update `chickenThoughts` with labels for new chickens
- Update `storyFlightPaths` and `arrivalFlightPaths` for 12 chickens
- Update CSS positions for 12 chickens in both story and arrival scenes

### C2. More chickens on the right, interacting
**Problem**: Right side of hero scene is empty since How Coop Works moved left.
**File**: `styles.css` (chicken positions), `landing-data.ts` (flight paths)
**Changes**:
- Position more chickens on the right side (right: 10-30%)
- Make right-side chickens move toward each other (converging flight paths)
- Add overlapping motion paths so chickens appear to interact/peck together

### C3. Pass color variant to ChickenSprite
**File**: `landing-animations.tsx`
**Changes**:
- Accept a `color` prop
- Apply `chicken-{color}` class to the SVG element (like `chicken-young` pattern)

---

## Batch D: Why We Build Section Redesign

### D1. Decompose the big card
**Problem**: The single nest-card containing team + community info is visually poor.
**Changes**:
- Remove the `.why-build-copy.nest-card` wrapper
- Keep a small semi-transparent card for just the "Why we build" heading + subtitle
- Extract team members and community labels into scene elements

### D2. Community labels as chicken labels in arrival scene
**Problem**: Partner pills (Coop, Greenpill, etc.) are stuck in a card.
**Changes**:
- Use the community names as labels on specific arrival chickens
- Map: tabs→"Coop", notes→"Greenpill", ideas→"Greenpill Dev Guild", signals→"ReFi DAO", links→"Green Goods"
- These labels appear below the chickens as they waddle toward the coop
- Style as small pills with the partner-pill styling

### D3. Team members positioned in the scene
**Problem**: Team members are inside a card instead of being part of the visual narrative.
**Changes**:
- Position team member avatars around the scene using absolute positioning
- Afo: left side of the scene
- Luiz + Sofia: right side of the scene
- Use the existing `.team-avatar` circle style with initials
- Add subtle parallax motion tied to the arrival timeline
- Each avatar has a small name label below

### D4. "Why we build" heading — small semi-transparent card
**Changes**:
- A compact card (`max-width: 22rem`) with `background: rgba(255, 252, 246, 0.85)` and backdrop blur
- Contains only the h2 and subtitle lede paragraph
- Positioned on the left side of the scene, `z-index: 4` above scenery

---

## Verification

After each batch:
1. `bun run validate typecheck` — type safety
2. `bun dev:app` — visual at `http://127.0.0.1:3001/landing`
3. Manual scroll-through checking:
   - Logo on the left
   - 3-4 thought bubbles visible by default
   - Subtitle on one line
   - Cards flat at rest, satisfying hover jiggle
   - Backdrop click closes dialog
   - Record button works, red when recording
   - Curate section locks during scroll
   - 12 diverse chickens with color variants
   - Community labels on arrival chickens
   - Team members in scene
4. `bun run validate smoke` — full build
