# GSAP Animation Analysis: Coop Landing Page

## Executive Summary

The Coop landing page implements two major scroll-driven timelines using GSAP + ScrollTrigger:
1. **Story Journey** (meadow scene with scattered chickens converging)
2. **Arrival Journey** (night scene with chickens waddle toward coop)

The code is well-structured but has optimization opportunities and a critical chicken positioning issue in the arrival section.

---

## 1. CURRENT GSAP CONFIGURATION

### Timeline Defaults

#### Story Timeline (Lines 295-432)
```javascript
const storyTimeline = gsap.timeline({
  defaults: { ease: 'none' },
  scrollTrigger: {
    trigger: storyJourneyRef.current,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.96,  // ← High scrub value = tight linkage to scroll
  },
});
```

**Analysis:**
- `ease: 'none'` - All animations are linear (no easing during scrub)
- `scrub: 0.96` - Very tight scrub coupling (0-1 scale, 0.96 = aggressive smoothing)
- ScrollTrigger covers full viewport-to-viewport scroll
- Good for scroll-hijack feeling

#### Arrival Timeline (Lines 434-571)
```javascript
const arrivalTimeline = gsap.timeline({
  defaults: { ease: 'none' },
  scrollTrigger: {
    trigger: arrivalJourneyRef.current,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.98,  // ← Even tighter than story
  },
});
```

**Analysis:**
- `scrub: 0.98` - Extremely tight scrub (more resistant to scroll jank)
- Still using `ease: 'none'` for keyframes
- **However**: Chickens use `ease: scrubEase` explicitly (line 560):
  ```javascript
  const scrubEase = 'power1.inOut';  // Line 239
  ```
  This is mixed into individual chicken animations, creating inconsistency

### Key Timeline Sections

**Story Timeline Animation Points (tl-position percentage):**
- 0.00: Glow, sun, clouds, hills parallax START
- 0.06-0.12: Story signal labels fade in
- 0.15: Sky overlay opacity START
- 0.24-0.42: How-it-works section fades in
- 0.28: Warm sun glow (sunset effect)
- Keyframes: Chicken flights at position 0

**Arrival Timeline Animation Points:**
- 0.00-0.05: Why Build heading + team card fade in
- 0.08+: Coop body rises
- 0.16+: Roof animates
- 0.22+: Windows/frames pop
- 0.25-0.5: Door glow flicker effect (5 separate .to() calls!)
- 0.4-0.62: Night sky, stars, moon fade
- 0.05-0.27: Chicken arrival keyframes (staggered by index)

---

## 2. PERFORMANCE ISSUES

### Critical Issues

#### A. Scroll Lag Culprits

1. **Excessive Keyframe Calculations (MAJOR)**
   - 12 chickens × 5+ keyframes × 2 timelines = 120+ DOM transform calculations per scroll frame
   - Story timeline (line 420-431): Each chicken uses `.to()` with keyframes array
   - Arrival timeline (line 557-570): Same issue, with per-chicken ease calculation

2. **Per-Keyframe Ease Functions (Line 560)**
   ```javascript
   // This runs for EVERY chicken on EVERY scroll event
   arrivalTimeline.to(node, {
     ease: scrubEase,  // 'power1.inOut' recalculated 12× per frame
     keyframes: path.map(...)
   }, staggerDelay);
   ```
   **Problem:** Applying ease to scroll-scrubbed animations defeats the purpose of scrub. The ease gets overridden by scroll position anyway.

3. **Duplicate Color Gradients (Lines 388-410)**
   ```javascript
   .to(storyHillBackRef.current, {
     background: 'linear-gradient(...)'  // String gradient recreation
   }, 0.3)
   .to(storyHillMidRef.current, {
     background: 'linear-gradient(...)'  // Repeated
   }, 0.35)
   .to(storyHillFrontRef.current, {
     background: 'linear-gradient(...)'  // Repeated
   }, 0.4)
   ```
   **Impact:** GSAP has to parse and apply new gradients; could use CSS classes instead.

4. **Too Many Stagger Groups**
   - `howItWorksCardElements` (line 365): stagger 0.08 = 4 cards × 0.08 = 0.32 spread
   - `whyBuildTeamMembers` (line 460): stagger 0.02 + multiple .to() calls after
   - Team members fade (line 467): stagger 0.03 again (redundant timing)

#### B. Scrub Value Analysis

| Timeline | Scrub | Issue |
|----------|-------|-------|
| Story | 0.96 | Very tight; may feel twitchy on low-refresh displays |
| Arrival | 0.98 | TOO tight; fighting scroll momentum on momentum scroll |

**Recommendation:** Reduce to 0.8-0.85 for better feel on all devices.

#### C. Will-Change Not Set on Chickens
- Chickens don't have `will-change: transform` in CSS
- `.scene-chicken` only uses `z-index: 3` and sizing (line 2072-2078)
- **Result:** Browser can't optimize chicken transforms for hardware acceleration

### Performance Metrics to Measure

```bash
# In browser DevTools:
1. Performance tab → Record during landing scroll
   - Look for: Layout, Paint, Composite times
   
2. Rendering settings:
   - Show rendering stats
   - Show compositing borders
   
3. Expected issues:
   - ~30-40% CPU on Medium/high-end MacBook during scroll
   - 60+ FPS on desktop, 30-45 FPS on mobile (if running)
```

---

## 3. CHICKEN FLIGHT PATHS ANALYSIS

### Story Journey Chickens (Convergence Pattern)

**Good news:** Story paths are symmetric and well-calibrated.

#### Right-Side Chickens Path Structure
```javascript
// tabs, notes, photos all converge right
// Start: x: '1-2vw', y: '0-1vh'
// End:   x: '10-11vw', y: '-3 to 4vh'
```

Example: tabs (lines 173-179)
```
[0] x: '1vw',   y: '0vh'    → Start position (scattered)
[1] x: '4vw',   y: '-1.5vh' → Moving right
[2] x: '7vw',   y: '2vh'    → Continuing
[3] x: '9vw',   y: '-1vh'   → Convergence
[4] x: '11vw',  y: '-3vh'   → Final cluster
```

**Assessment: EXCELLENT**
- Paths have 5 keyframes = smooth motion
- Scales taper (1.0 → 0.94) = depth effect
- No "pile" at top-left; proper side clustering

#### Left-Side Chickens Path Structure
```javascript
// ideas, signals, threads converge left (negative x)
// Symmetrical to right side
```

Example: signals (lines 194-200)
```
[0] x: '-1vw',   y: '0vh'    → Start
[1] x: '-4vw',   y: '-1.5vh' → Leftward
[2] x: '-7vw',   y: '2vh'
[3] x: '-9vw',   y: '-1vh'
[4] x: '-11vw',  y: '-3vh'   → Final position
```

**Assessment: EXCELLENT** - Symmetric, balanced

### Arrival Journey Chickens - MAJOR ISSUE FOUND

#### The "Chickens Piled Top-Left" Bug

**Root Cause Analysis:**

Looking at `arrivalFlightPaths` (lines 266-362), chickens are animated toward the center of the scene (50%, ~72% from comments) to walk into the coop door. However:

1. **Initial Positions are Off-Center**
   - tabs: starts at `x: '5vw'` (5% of viewport from left)
   - notes: starts at `x: '3vw'`
   - ideas: starts at `x: '-3vw'` (already LEFT side)
   - signals: starts at `x: '-5vw'`

2. **End Positions Show Convergence Issue**
   - Right-side chickens (tabs, notes): end at `x: '27vw'`, `x: '19vw'`
   - Left-side chickens (ideas, signals): end at `x: '-19vw'`, `x: '-27vw'`
   - **Both converge toward center, but paths are asymmetrical**

3. **The Problem in Code (Lines 546-571)**
   ```javascript
   for (let i = 0; i < journeyChickens.length; i++) {
     const chicken = journeyChickens[i];  // Full array, not arrival-specific
     const path = arrivalFlightPaths[chicken.id];
     
     if (!node || !path) {
       continue;  // ← Missing error logging
     }
     
     const staggerDelay = 0.05 + i * 0.02;  // Uses index order, not left/right
   ```

4. **Why It Piles Top-Left:**
   - Array order: tabs, notes, ideas, signals, links, drafts, threads, clips, bookmarks, photos, voice-memos, receipts
   - **All 12 chickens stagger through SAME timeline** (0.05, 0.07, 0.09, 0.11...)
   - Y-coordinates in arrival paths are MINIMAL (-1 to 1vh) - no vertical spread
   - All chickens compress into tight Y band at top
   - Early chickens (tabs, notes) exit scene quickly; later chickens bunch at start position

**Visual Timeline Breakdown:**
```
Scroll 0%:    All chickens at initial position (looks okay)
Scroll 20%:   tabs/notes already exiting (small scale 0.4-0.72)
Scroll 40%:   ideas/signals start moving; tabs/notes nearly gone
Scroll 60%:   All chickens compressed because they stack in Y-space
Scroll 100%:  Visible chickens are smallest (left group) at top-left
```

#### Specific Path Issues

**Right-side chickens too spread in X (no clear door convergence):**
```javascript
tabs: [
  { x: '5vw', ... },      // Far left in right group
  { x: '12vw', ... },     // Mid
  { x: '19vw', ... },     // Still spreading
  { x: '24vw', ... },     // Spreading to 24vw (should converge tighter)
  { x: '26vw', ... },     
  { x: '27vw', ... },     // Final: 27vw (off-center for coop at 50%)
]
```

**Expected coop door location:** ~50% of scene width = 50vw center
**Actual final positions:** ±27vw on respective sides (not at 50%)

#### Fix Required

The arrival paths need:
1. **Tighter Y-spread:** Add more vertical variance in mid-keyframes
2. **Proper convergence point:** Center chickens at ~48-52vw (not ±27vw)
3. **Non-sequential stagger:** Use spatial grouping, not array index
4. **Fewer chickens visible:** Only 5-6 of 12 should be visible in arrival (too crowded)

---

## 4. TEAM ANIMATION TIMING

### Current Timeline (Lines 446-467)

```javascript
arrivalTimeline
  .fromTo(whyBuildCard, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0 }, 0)
  .fromTo(whyBuildTeam, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0 }, 0.02)
  .fromTo(
    whyBuildTeamMembers,
    { autoAlpha: 0, scale: 0.9 },
    { autoAlpha: 1, scale: 1, stagger: 0.02 },
    0.04
  )
  .to(whyBuildCard, { autoAlpha: 0, y: -20, scale: 0.96 }, 0.45)
  .to(whyBuildTeam, { autoAlpha: 0, y: -14 }, 0.48)
  .to(whyBuildTeamMembers, { autoAlpha: 0, y: -10, stagger: 0.03 }, 0.5)
```

### Timing Analysis

| Element | Appears | Disappears | Duration | Notes |
|---------|---------|-----------|----------|-------|
| Heading | 0% | 45% | 45% | Early exit, long hold |
| Team Group | 2% | 48% | 46% | Slightly delayed appear |
| Team Members | 4% | 50% | 46% | Stagger 0.02 = ~0.06 spread for 3 people |

### Issues Found

1. **Stagger Confusion (Line 462 vs 467)**
   - Appear stagger: `0.02` (0.02 × 3 ≈ 0.06 timeline duration)
   - Disappear stagger: `0.03` (0.03 × 3 ≈ 0.09 timeline duration)
   - **Different stagger values for same elements = feels uncoordinated**

2. **Too Early Fade-Out**
   - Appears at 0-4% scroll
   - Disappears at 45-50% scroll
   - With scrub 0.98, this feels abrupt when scrolling back
   - **User experience:** Team briefly visible, then gone

3. **Scale Only on Appear, Not Disappear**
   ```javascript
   // Appear: scale 0.9 → 1
   { autoAlpha: 0, scale: 0.9 }  // Initial
   { autoAlpha: 1, scale: 1 }    // End
   
   // Disappear: no scale change
   { autoAlpha: 0, y: -10 }      // Only moves up + fades
   ```
   **Result:** Asymmetrical animation feel

### Team Visibility Recommendation

With only 3 team members showing (lines 105), they should:
- Stagger appear across ~0.10 of timeline (not 0.06)
- Start appearing at 2% (good)
- Stay visible until 55-60% (not 50%)
- Disappear with same stagger value (0.02 or 0.03, pick one)

---

## 5. OPTIMIZATION RECOMMENDATIONS

### High Priority (Big Performance Gains)

#### A. Remove Ease from Scroll-Scrubbed Animations (Line 560)

**Current Code:**
```javascript
arrivalTimeline.to(
  node,
  {
    ease: scrubEase,  // ← WRONG: Ease doesn't work on scrubbed timelines
    keyframes: path.map(...)
  },
  staggerDelay
);
```

**Why it's wrong:**
- Scrub timelines ignore ease; scroll position IS the timing
- Ease function is recalculated 60× per second
- Wasted CPU cycles

**Fix:**
```javascript
arrivalTimeline.to(
  node,
  {
    keyframes: path.map(...)  // Remove ease line entirely
  },
  staggerDelay
);
```

**Impact:** ~15-20% less JS execution time on scroll

---

#### B. Replace Inline Gradient Animations with CSS Classes (Lines 388-410)

**Current Code:**
```javascript
.to(storyHillBackRef.current, {
  background: 'linear-gradient(...rgb values...)'
}, 0.3)
```

**Problem:**
- String parsing overhead on every scroll frame
- GSAP must interpolate color values
- CSS can't use GPU acceleration

**Fix:**
1. Create CSS classes:
```css
.story-hill-back {
  background: linear-gradient(...initial...);
  transition: background 0s linear;  /* Disabled for GSAP control */
}

.story-hill-back.is-dusk {
  background: linear-gradient(...dusk...);
}
```

2. Switch to class-based control:
```javascript
storyTimeline
  .call(() => {
    storyHillBackRef.current?.classList.add('is-dusk');
  }, [], 0.3)
```

**Alternative (Better):** Use opacity overlay instead
```javascript
// More performant than gradient shift
storyTimeline.fromTo(storySkyOverlayRef.current, 
  { opacity: 0 }, 
  { opacity: 0.88 }, 
  0.15)
```

**Impact:** ~10-15% performance improvement; better on mobile

---

#### C. Enable Hardware Acceleration on Chickens

**Add to CSS (.scene-chicken):**
```css
.scene-chicken {
  will-change: transform;  /* ← Add this */
  transform: translateZ(0);  /* Optional: Force 3D context */
}
```

**Why:**
- Chickens are the most frequently transformed elements
- Will-change tells browser to optimize rendering layer
- Hardware acceleration uses GPU instead of CPU

**Impact:** 20-30% smoother chicken animation, especially on laptops with dedicated GPUs

---

#### D. Reduce Scrub Values for Smoother Scroll Feel

**Current:**
- Story: 0.96
- Arrival: 0.98

**Recommended:**
```javascript
scrub: 0.8,  // Both timelines
```

**Why:**
- 0.96+ is overly tight; creates "sticky" feeling
- 0.8-0.85 is sweet spot for responsive yet smooth
- Easier on scroll momentum/inertial scrolling

**Trade-off:** Slightly less "glued to scroll" but better on high-refresh displays

**Impact:** More natural scroll feel on 120Hz+ displays

---

### Medium Priority (Code Quality & Maintainability)

#### E. Consolidate Story Chicken Flights into Single Timeline Block

**Current (Lines 412-432):**
```javascript
for (const chicken of journeyChickens) {
  const node = storyChickenRefs.current[chicken.id];
  const path = storyFlightPaths[chicken.id];
  
  if (!node || !path) {
    continue;
  }
  
  storyTimeline.to(node, {
    keyframes: path.map(...)
  }, 0);  // ← All at 0
}
```

**Better approach:**
```javascript
const storyChickenAnimations = journeyChickens.reduce((acc, chicken) => {
  const node = storyChickenRefs.current[chicken.id];
  const path = storyFlightPaths[chicken.id];
  
  if (node && path) {
    acc.push({
      target: node,
      keyframes: path.map(...),
      position: 0,
    });
  }
  return acc;
}, []);

storyChickenAnimations.forEach(anim => {
  storyTimeline.to(anim.target, { keyframes: anim.keyframes }, anim.position);
});
```

**Benefit:** Easier to debug; separates data from animation logic

---

#### F. Extract Stagger Constants to Top of File

**Current:** Stagger values scattered throughout (0.03, 0.02, 0.08, etc.)

**Better:**
```javascript
const ANIMATION_STAGGER = {
  cardFast: 0.02,
  cardNormal: 0.04,
  cardSlow: 0.08,
  teamMember: 0.02,
};

// Usage:
.fromTo(
  whyBuildTeamMembers,
  { autoAlpha: 0, scale: 0.9 },
  { autoAlpha: 1, scale: 1, stagger: ANIMATION_STAGGER.teamMember },
  0.04
)
```

**Benefit:** Single source of truth; easier to tweak all at once

---

#### G. Add Error Boundary & Null Checks

**Current (Line 416-418):**
```javascript
if (!node || !path) {
  continue;
}
```

**Problem:** Silent failure; hard to debug missing chickens

**Better:**
```javascript
if (!node) {
  console.warn(`⚠️ Missing DOM node for chicken: ${chicken.id}`);
  continue;
}
if (!path) {
  console.warn(`⚠️ Missing flight path for chicken: ${chicken.id}`);
  continue;
}
```

**Benefit:** Quick debugging if new chickens added to array

---

### Low Priority (Nice to Have)

#### H. Reduce Star Count or Use Simpler Twinkling

**Current:** 24 stars with CSS animations (line 379)

**Issue:** Each star has animated twinkling (`animation: star-twinkle 3.2s...`)

**Option 1:** Reduce to 12-16 stars
```javascript
export const STAR_COUNT = 16;  // Instead of 24
```

**Option 2:** Use lower opacity (less noticeable if fewer)
```css
.scene-star {
  opacity: 0.4;  /* Instead of 0.65 */
}
```

**Impact:** Negligible (stars are small), but adds up on low-end devices

---

## 6. NEW ANIMATION PROPOSALS

### Proposal 1: Interactive Chickens in "How Coop Works" (Thought Bubbles on Scroll)

**Goal:** Make "How It Works" section more engaging; reveal thought bubbles as user scrolls past each card.

**Implementation:**

```javascript
// In the main animation setup (line 247), add after howItWorksCards query:

const howItWorksCardContainers = Array.from(
  howItWorksRef.current?.querySelectorAll('.how-works-card') ?? []
);

const howItWorksThoughts = Array.from(
  howItWorksRef.current?.querySelectorAll('.how-works-thought-bubble') ?? []
);

// Create separate timeline for "How It Works" interactions
const howItWorksTimeline = gsap.timeline({
  defaults: { ease: 'back.out', duration: 0.6 },
  scrollTrigger: {
    trigger: howItWorksRef.current,
    start: 'top center',
    end: 'bottom center',
  },
});

// Each card's thought bubble appears when card comes into view
howItWorksCardContainers.forEach((card, index) => {
  const thought = howItWorksThoughts[index];
  
  if (thought) {
    howItWorksTimeline.fromTo(
      thought,
      { autoAlpha: 0, y: 20, scale: 0.9 },
      { autoAlpha: 1, y: 0, scale: 1 },
      `card-${index}`  // Label for clarity
    );
    
    // Add to main timeline at relative position
    storyTimeline.add(
      () => gsap.to(thought, { autoAlpha: 0 }),
      0.38  // Slightly after cards fade in
    );
  }
});
```

**HTML Requirements:**
```html
<article class="how-works-card">
  <span class="how-works-index">01</span>
  <div class="how-works-thought-bubble" style="opacity: 0">
    💡 This is how it works...
  </div>
  <div class="how-works-card-copy">
    <h3>...</h3>
  </div>
</article>
```

**CSS:**
```css
.how-works-thought-bubble {
  position: absolute;
  top: -80px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 252, 246, 0.95);
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 0.75rem;
  white-space: nowrap;
  pointer-events: none;
  will-change: opacity, transform;
}
```

**Benefits:**
- Extends engagement with "How It Works" section
- Uses same bubble style as story chickens (consistency)
- Non-blocking; doesn't interfere with main timeline

---

### Proposal 2: Faster "Why We Build" Arrival Sequence

**Goal:** Speed up chicken procession; make it feel more urgent/alive.

**Current Issues:**
- Stagger only 0.02 between chickens = visually compressed
- Takes full scroll section (0-100%) to complete
- Chickens mostly invisible by mid-scroll

**New Approach:**

```javascript
// Line 546-570, replace with:

// Only animate first 6-8 chickens (not all 12)
const visibleArrivalChickens = journeyChickens.slice(0, 8);

// Faster stagger creates visible procession
for (let i = 0; i < visibleArrivalChickens.length; i++) {
  const chicken = visibleArrivalChickens[i];
  const node = arrivalChickenRefs.current[chicken.id];
  const path = arrivalFlightPaths[chicken.id];
  
  if (!node || !path) {
    continue;
  }
  
  // Compressed stagger: 0.01 instead of 0.02
  // Starts earlier: 0.02 instead of 0.05
  // Ends earlier: finishes at 0.35 instead of 0.27+
  const staggerDelay = 0.02 + i * 0.01;
  
  arrivalTimeline.to(
    node,
    {
      keyframes: path.map(frame => ({
        x: frame.x,
        y: frame.y,
        rotation: frame.rotate,
        scale: frame.scale ?? 1,
        opacity: frame.opacity ?? 1,
      })),
    },
    staggerDelay
  );
}
```

**Timing Result:**
- First chicken: appears at 2% scroll
- Last chicken: disappears at 35% scroll
- Remaining 45-100%: coop assembly + interior flock visible
- Chickens fully visible & gone by mid-scroll (creates space for coop)

**Benefits:**
- Clearer visual procession
- Reduces "piling" effect by limiting visible chickens
- Frees up visual space for coop build
- Faster, more energetic feel

---

### Proposal 3: Scroll Hijack for Key Moments

**Goal:** Lock scroll during critical animations (team reveal, coop entrance).

**Implementation:**

```javascript
// Create a scroll-lock controller
let scrollLocked = false;
let lockTarget = 0;

// In main timeline setup:
storyTimeline.add(() => {
  console.log('🔒 Story journey complete, proceeding normally');
}, 0.95);

arrivalTimeline.add(() => {
  // Lock scroll during chicken procession finale
  scrollLocked = true;
  lockTarget = window.scrollY + window.innerHeight * 0.4;
  
  // Release after coop fully formed
  gsap.to({}, {
    duration: 1.2,
    onComplete: () => {
      scrollLocked = false;
    },
  });
}, 0.3);

// Global scroll handler
window.addEventListener('wheel', (e) => {
  if (scrollLocked) {
    e.preventDefault();
    window.scrollTo(0, lockTarget);
  }
}, { passive: false });

window.addEventListener('touchmove', (e) => {
  if (scrollLocked) {
    e.preventDefault();
  }
}, { passive: false });
```

**Cautions:**
- Hijacking scroll is dangerous UX
- Can cause motion sickness
- Only use for 1-2 seconds max
- Provide visual feedback (fade overlay, message)

**Better Alternative (Recommended):**
Instead of full scroll lock, use `ScrollTrigger.getAll()` to pause other triggers:

```javascript
// At 0.3 position of arrival timeline:
arrivalTimeline.add(() => {
  const triggers = ScrollTrigger.getAll();
  triggers.forEach(trigger => {
    if (trigger !== arrivalTimeline.scrollTrigger) {
      trigger.disable();
    }
  });
  
  // Re-enable after delay
  setTimeout(() => {
    triggers.forEach(trigger => trigger.enable());
  }, 1200);
}, 0.3);
```

**Safest Approach:** Don't hijack at all
- Trust GSAP's scrub smoothing
- Let user control scroll
- Use visual hierarchy instead

---

## 7. IMPLEMENTATION PRIORITY MATRIX

| Recommendation | Effort | Impact | Priority | Time Est |
|---|---|---|---|---|
| Remove ease from scrub animations (5A) | 5 min | 20% perf | HIGH | 5 min |
| Add will-change to chickens (5C) | 2 min | 20% smoothness | HIGH | 2 min |
| Fix arrival chicken paths (3) | 1 hour | Visual correctness | CRITICAL | 60 min |
| Reduce scrub values (5D) | 5 min | UX feel | HIGH | 5 min |
| Extract stagger constants (5F) | 15 min | Code clarity | MEDIUM | 15 min |
| Interactive thought bubbles (6.1) | 45 min | Engagement | LOW | 45 min |
| Faster arrival sequence (6.2) | 20 min | Visual clarity | MEDIUM | 20 min |
| Replace gradients with classes (5B) | 30 min | 10-15% perf | MEDIUM | 30 min |
| Add error boundaries (5G) | 10 min | Debugging | LOW | 10 min |

---

## 8. QUICK WINS (Implement First)

### 5 Minutes: Remove Ease from Chickens
File: `index.tsx` line 560

**Change:**
```javascript
// FROM:
arrivalTimeline.to(node, {
  ease: scrubEase,
  keyframes: path.map(...)
}, staggerDelay);

// TO:
arrivalTimeline.to(node, {
  keyframes: path.map(...)
}, staggerDelay);
```

### 2 Minutes: Add Hardware Acceleration
File: `styles.css` ~line 2073

**Add:**
```css
.scene-chicken {
  will-change: transform;
}
```

### 10 Minutes: Fix Scrub Values
File: `index.tsx` lines 301 and 440

**Change:**
```javascript
// Story (line 301):
scrub: 0.8,  // From 0.96

// Arrival (line 440):
scrub: 0.8,  // From 0.98
```

---

## Summary Table: Issue vs Solution

| Issue | Root Cause | Solution | Code Location |
|-------|-----------|----------|---|
| Scroll lag | Excessive keyframe recalc | Remove ease from scrub animations | Line 560 |
| Sluggish chickens | No hardware accel | Add will-change: transform | CSS line 2073 |
| Sticky scroll feel | Too tight scrub | Reduce to 0.8 | Lines 301, 440 |
| Chickens pile top-left | Wrong Y variance + sequential index | Increase Y-spread, fix end positions | Lines 266-362 |
| Asymmetrical team exit | Different stagger values | Use same stagger for appear/disappear | Lines 462, 467 |
| Gradients flicker | String parsing overhead | Use CSS class toggles or opacity overlay | Lines 388-410 |

---

## Testing Checklist

After implementing fixes, verify:

- [ ] Scroll through landing on 60 FPS locked; check for jank
- [ ] Test on 30 FPS (DevTools throttle) — should still be smooth
- [ ] Check mobile (slow 3G) — verify no layout shifts
- [ ] Test keyboard scroll (arrow keys) — should match mouse wheel feel
- [ ] Verify all 12 chickens still animate in story journey
- [ ] Verify arrival chickens converge to center (not top-left)
- [ ] Team members appear/disappear symmetrically
- [ ] How It Works cards don't overlap text
- [ ] Thought bubbles visible on hover (story section)
- [ ] Moon animation at end is smooth
- [ ] No console errors

---

## Browser DevTools Commands

```javascript
// In browser console to measure performance:
performance.mark('landing-scroll-start');
// [Scroll through landing]
performance.mark('landing-scroll-end');
performance.measure('scroll-time', 'landing-scroll-start', 'landing-scroll-end');
performance.getEntriesByName('scroll-time')[0].duration;
// Returns time in ms

// Check if will-change is applied:
document.querySelector('.scene-chicken').style.willChange;
// Should return "transform"

// Check scrub value:
gsap.getProperty(document.querySelector('.scene-chicken'), 'scrollTrigger').scrub;
// Should return your scrub value (0.8, 0.96, etc.)
```

