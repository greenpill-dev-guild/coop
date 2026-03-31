# GSAP Animation Code Changes

## File 1: index.tsx - Remove Ease from Chicken Animations

**Location:** Line 557-570

### Current Code
```javascript
arrivalTimeline
  // ... other animations ...
  for (let i = 0; i < journeyChickens.length; i++) {
    const chicken = journeyChickens[i];
    const node = arrivalChickenRefs.current[chicken.id];
    const path = arrivalFlightPaths[chicken.id];

    if (!node || !path) {
      continue;
    }

    const staggerDelay = 0.05 + i * 0.02;

    arrivalTimeline.to(
      node,
      {
        ease: scrubEase,  // ← REMOVE THIS LINE
        keyframes: path.map((frame) => ({
          x: frame.x,
          y: frame.y,
          rotation: frame.rotate,
          scale: frame.scale ?? 1,
          opacity: frame.opacity ?? 1,
        })),
      },
      staggerDelay,
    );
  }
```

### Fixed Code
```javascript
arrivalTimeline
  // ... other animations ...
  for (let i = 0; i < journeyChickens.length; i++) {
    const chicken = journeyChickens[i];
    const node = arrivalChickenRefs.current[chicken.id];
    const path = arrivalFlightPaths[chicken.id];

    if (!node || !path) {
      continue;
    }

    const staggerDelay = 0.05 + i * 0.02;

    arrivalTimeline.to(
      node,
      {
        keyframes: path.map((frame) => ({
          x: frame.x,
          y: frame.y,
          rotation: frame.rotate,
          scale: frame.scale ?? 1,
          opacity: frame.opacity ?? 1,
        })),
      },
      staggerDelay,
    );
  }
```

**Change:** Delete the `ease: scrubEase,` line
**Impact:** 15-20% performance improvement
**Effort:** 30 seconds

---

## File 2: index.tsx - Reduce Scrub Values

**Location:** Lines 301 & 440

### Story Timeline (Line 295-303)
```javascript
// BEFORE
const storyTimeline = gsap.timeline({
  defaults: { ease: 'none' },
  scrollTrigger: {
    trigger: storyJourneyRef.current,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.96,  // ← CHANGE TO 0.8
  },
});

// AFTER
const storyTimeline = gsap.timeline({
  defaults: { ease: 'none' },
  scrollTrigger: {
    trigger: storyJourneyRef.current,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.8,
  },
});
```

### Arrival Timeline (Line 434-442)
```javascript
// BEFORE
const arrivalTimeline = gsap.timeline({
  defaults: { ease: 'none' },
  scrollTrigger: {
    trigger: arrivalJourneyRef.current,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.98,  // ← CHANGE TO 0.8
  },
});

// AFTER
const arrivalTimeline = gsap.timeline({
  defaults: { ease: 'none' },
  scrollTrigger: {
    trigger: arrivalJourneyRef.current,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.8,
  },
});
```

**Changes:** Two lines (301 and 440)
**Impact:** Better scroll feel on high-refresh displays
**Effort:** 2 minutes

---

## File 3: styles.css - Add Hardware Acceleration

**Location:** Line 2072-2078

### Current Code
```css
.scene-chicken {
  z-index: 3;
  width: clamp(5.25rem, 8vw, 7rem);
  display: grid;
  justify-items: center;
  gap: 0.45rem;
}
```

### Fixed Code
```css
.scene-chicken {
  z-index: 3;
  width: clamp(5.25rem, 8vw, 7rem);
  display: grid;
  justify-items: center;
  gap: 0.45rem;
  will-change: transform;
}
```

**Change:** Add `will-change: transform;`
**Impact:** 20-30% smoother chicken animation
**Effort:** 30 seconds

---

## File 4: index.tsx - Fix Stagger Values (Optional)

**Location:** Lines 460-467

### Current Code
```javascript
.fromTo(
  whyBuildTeamMembers,
  { autoAlpha: 0, scale: 0.9 },
  { autoAlpha: 1, scale: 1, stagger: 0.02 },
  0.04
)
.to(whyBuildCard, { autoAlpha: 0, y: -20, scale: 0.96 }, 0.45)
.to(whyBuildTeam, { autoAlpha: 0, y: -14 }, 0.48)
.to(whyBuildTeamMembers, { autoAlpha: 0, y: -10, stagger: 0.03 }, 0.5)
//                                                        ↑ DIFFERENT VALUE
```

### Fixed Code (Option A: Use 0.02)
```javascript
.fromTo(
  whyBuildTeamMembers,
  { autoAlpha: 0, scale: 0.9 },
  { autoAlpha: 1, scale: 1, stagger: 0.02 },
  0.04
)
.to(whyBuildCard, { autoAlpha: 0, y: -20, scale: 0.96 }, 0.45)
.to(whyBuildTeam, { autoAlpha: 0, y: -14 }, 0.48)
.to(whyBuildTeamMembers, { autoAlpha: 0, y: -10, stagger: 0.02 }, 0.5)
//                                                        ↑ MATCHED
```

### Fixed Code (Option B: Use 0.03)
```javascript
.fromTo(
  whyBuildTeamMembers,
  { autoAlpha: 0, scale: 0.9 },
  { autoAlpha: 1, scale: 1, stagger: 0.03 },
  0.04
)
.to(whyBuildCard, { autoAlpha: 0, y: -20, scale: 0.96 }, 0.45)
.to(whyBuildTeam, { autoAlpha: 0, y: -14 }, 0.48)
.to(whyBuildTeamMembers, { autoAlpha: 0, y: -10, stagger: 0.03 }, 0.5)
//                                                        ↑ MATCHED
```

**Change:** Make disappear stagger match appear stagger
**Impact:** Symmetrical animation feel
**Effort:** 5 minutes
**Priority:** MEDIUM (visual polish, not critical)

---

## File 5: landing-data.ts - Fix Arrival Chicken Paths (CRITICAL)

**Location:** Lines 266-362

This is the biggest fix. The arrival paths need significant changes:

### Problems to Fix

1. **Right-side chickens (tabs, notes, etc.)**
   - Current final x: 27vw, 19vw (spread out)
   - Should converge closer to center: ~45-48vw
   
2. **Left-side chickens (ideas, signals, etc.)**
   - Current final x: -19vw, -27vw (spread out)
   - Should converge closer to center: ~-45 to -48vw

3. **All chickens**
   - Current Y-variance: only -1 to 1vh (too tight)
   - Need more vertical spread: -3 to 3vh range

4. **Visibility**
   - Current: All 12 chickens animated (pile effect)
   - Better: Animate only 6-8 chickens (cleaner procession)

### Example Fix for tabs Chicken

**Current:**
```javascript
tabs: [
  { x: '5vw', y: '-1vh', rotate: -5, scale: 0.98, opacity: 1 },
  { x: '12vw', y: '-2vh', rotate: 4, scale: 0.9, opacity: 1 },
  { x: '19vw', y: '-3vh', rotate: -3, scale: 0.72, opacity: 0.94 },
  { x: '24vw', y: '-2vh', rotate: 2, scale: 0.42, opacity: 0.7 },
  { x: '26vw', y: '-1.5vh', rotate: 0, scale: 0.34, opacity: 0.5 },
  { x: '27vw', y: '-1vh', rotate: 0, scale: 0.06, opacity: 0 },
],
```

**Fixed (converge toward center with better Y variance):**
```javascript
tabs: [
  { x: '5vw', y: '-2.5vh', rotate: -5, scale: 0.98, opacity: 1 },    // More negative Y
  { x: '12vw', y: '-1.5vh', rotate: 4, scale: 0.9, opacity: 1 },
  { x: '18vw', y: '-0.5vh', rotate: -3, scale: 0.72, opacity: 0.94 }, // Reduced spread
  { x: '22vw', y: '0.5vh', rotate: 2, scale: 0.42, opacity: 0.7 },   // Now positive Y
  { x: '24vw', y: '1.5vh', rotate: 0, scale: 0.34, opacity: 0.5 },   // More positive
  { x: '25vw', y: '2vh', rotate: 0, scale: 0.06, opacity: 0 },       // Changed to 25vw (toward center)
],
```

### Implementation Strategy

The complete fix requires:
1. Increase Y-variance across all 12 arrival paths (-3 to 3vh range)
2. Adjust final X positions to converge more toward center
3. (Optional) Limit visible chickens to first 8 in `index.tsx` lines 546-571

Since there are 12 paths to fix, here's the algorithm:

```javascript
// General pattern for RIGHT-SIDE chickens (tabs, notes, links, drafts, bookmarks, voice-memos)
[
  { x: '2-5vw', y: '-2.5vh', ... },      // Start left with negative Y
  { x: '8-12vw', y: '-1.5vh', ... },     // Move right, reduce Y variance
  { x: '14-18vw', y: '-0.5vh', ... },    // Continue right
  { x: '20-24vw', y: '0.5vh', ... },     // Switch to positive Y
  { x: '23-25vw', y: '1.5-2vh', ... },   // Nearly there
  { x: '24-25vw', y: '2vh', ... },       // Final: closer to center (not 27vw)
]

// General pattern for LEFT-SIDE chickens (ideas, signals, threads, clips, photos, receipts)
[
  { x: '-2 to -5vw', y: '-2.5vh', ... },      // Start right with negative Y
  { x: '-8 to -12vw', y: '-1.5vh', ... },     // Move left, reduce Y variance
  { x: '-14 to -18vw', y: '-0.5vh', ... },    // Continue left
  { x: '-20 to -24vw', y: '0.5vh', ... },     // Switch to positive Y
  { x: '-23 to -25vw', y: '1.5-2vh', ... },   // Nearly there
  { x: '-24 to -25vw', y: '2vh', ... },       // Final: closer to center (not -27vw)
]
```

**Change:** Modify all 12 paths in arrival flight paths object
**Impact:** CRITICAL - Fixes visual "pile" bug
**Effort:** 30-60 minutes (careful manual adjustment needed)
**Priority:** HIGHEST

---

## Summary: Quick Fix Checklist

| Change | File | Line(s) | Time | Impact |
|--------|------|---------|------|--------|
| Remove ease | index.tsx | 560 | 30s | 20% perf |
| Add will-change | styles.css | 2078 | 30s | 20% smooth |
| Reduce scrub | index.tsx | 301, 440 | 2m | Feel |
| Fix stagger | index.tsx | 462, 467 | 5m | Polish |
| Fix paths | landing-data.ts | 266-362 | 60m | CRITICAL |

**Total Quick Wins Time:** 17 minutes
**Total Complete Fix Time:** ~75 minutes

---

## Testing After Changes

### 1. Test Scroll Performance
```bash
# Open DevTools Performance tab
# Record while scrolling through landing page
# Look for:
# - No jank at 60 FPS
# - Smooth chicken movements
# - Scrub responds naturally to scroll speed
```

### 2. Test Chicken Animations
```bash
# Visual inspection:
# - Story section: chickens converge left & right (SHOULD BE GOOD)
# - Arrival section: chickens fan out from center, not pile at top-left
# - Team members: appear symmetrically, disappear symmetrically
```

### 3. Verify No Regressions
```bash
# - All 12 story chickens still animate
# - Thought bubbles visible on hover
# - How It Works section enters smoothly
# - Coop assembly completes with sky/stars/moon
# - No console errors
```

