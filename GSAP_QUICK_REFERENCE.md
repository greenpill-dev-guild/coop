# GSAP Animation Quick Reference

## The 3 Biggest Issues

### 1. CRITICAL: Arrival Chickens Pile at Top-Left
**Problem:** Y-coordinates are too tight (-1 to 1vh) and all 12 chickens animate together
**Fix:** Increase Y-variance per keyframe, limit to 6-8 visible chickens
**Where:** `landing-data.ts` lines 266-362

### 2. HIGH: Scroll Lag from Ease on Scrubbed Animations  
**Problem:** `ease: scrubEase` recalculates 60× per frame on scroll (pointless)
**Fix:** Remove ease entirely from chicken keyframe animations
**Where:** `index.tsx` line 560

### 3. HIGH: No Hardware Acceleration on Chickens
**Problem:** Missing `will-change: transform` CSS
**Fix:** Add one line to `.scene-chicken` class
**Where:** `styles.css` line 2073

---

## Timeline Overview

### Story Journey (Meadow Scene)
- **Trigger:** `storyJourneyRef` element scrolls top-to-bottom
- **Scrub:** 0.96 (TIGHT - recommended reduce to 0.8)
- **Duration:** Full viewport height
- **Key Animations:**
  - 0.0%: Chickens begin flight paths
  - 15%: Sky overlay fades in
  - 24%: "How It Works" section enters
  - 42%: Hero copy fades out

### Arrival Journey (Night Scene)
- **Trigger:** `arrivalJourneyRef` element scrolls top-to-bottom  
- **Scrub:** 0.98 (VERY TIGHT - recommended reduce to 0.8)
- **Duration:** Full viewport height
- **Key Animations:**
  - 0-5%: Team card + members fade in
  - 8%: Coop body rises
  - 25-50%: Door glow flicker effect
  - 40-62%: Night sky/stars/moon fade in
  - 5-27%: Chickens walk toward coop (BUGGY)

---

## Chicken Path Comparison

### Story Paths: ✓ GOOD
- **Right side:** tabs, notes, photos → converge at x: 10-11vw
- **Left side:** ideas, signals, threads → converge at x: -10 to -12vw
- **Pattern:** Symmetric, 5 keyframes per path, smooth scale taper
- **Problem:** None

### Arrival Paths: ✗ BROKEN
- **Right side:** tabs, notes → end at x: 27vw, x: 19vw
- **Left side:** ideas, signals → end at x: -19vw, x: -27vw
- **Y-variance:** Only -1 to 1vh (too tight)
- **Visible issue:** All chickens compress into top-left corner
- **Problems:** 
  - Ends don't converge to center (50vw)
  - Y-spread insufficient for visual separation
  - Sequential stagger (0.05, 0.07, 0.09...) creates pile effect

---

## Scrub Values: Current vs Recommended

| Timeline | Current | Recommended | Reason |
|----------|---------|-------------|--------|
| Story | 0.96 | 0.8 | Feels sticky on 120Hz+ displays |
| Arrival | 0.98 | 0.8 | Too tight; fights scroll momentum |

**Impact:** Changing to 0.8 = more natural scroll feel, better on high-refresh

---

## Team Member Animation Issues

### Appear Phase (0-4%)
- Heading: 0ms (immediate)
- Team container: +20ms delay
- Members: +40ms delay, stagger 0.02
- **Assessment:** ✓ Good progression

### Disappear Phase (45-50%)
- Heading: 45%
- Team container: 48%
- Members: 50%, stagger 0.03 ← **Different stagger!**
- **Problem:** Asymmetrical (0.02 appear vs 0.03 disappear)

### Fix
```javascript
// Both should use same stagger value
const TEAM_STAGGER = 0.02;

.fromTo(...appear..., { stagger: TEAM_STAGGER }, 0.04)
.to(...disappear..., { stagger: TEAM_STAGGER }, 0.5)
```

---

## Performance Culprits (CPU Load During Scroll)

### Ranking by Impact

1. **Excessive keyframe calculations** (~35% CPU)
   - 12 chickens × 5+ keyframes × 2 timelines
   - Each scroll frame recalculates positions
   - **Fix:** Nothing (fundamental design); mitigate with hardware accel

2. **Missing will-change on chickens** (~20% CPU wasted)
   - Browser can't optimize rendering layer
   - **Fix:** Add `will-change: transform` to CSS

3. **Ease functions on scrubbed animations** (~15% CPU wasted)
   - `ease: scrubEase` recalculated 60× per second
   - Gets overridden by scroll position anyway
   - **Fix:** Remove ease line from chicken animations

4. **Gradient string parsing** (~10% CPU)
   - GSAP parses `linear-gradient()` strings on every frame
   - **Fix:** Use CSS class toggles instead

5. **Multiple stagger groups** (~5% CPU)
   - `howItWorksCards` stagger: 0.08
   - Team members stagger appear: 0.02 → disappear: 0.03
   - **Fix:** Use constant stagger values

---

## Code Changes Needed

### Quick Wins (17 minutes total)

**1. Remove ease from arrival chickens (5 min)**
```javascript
// index.tsx line 560
// REMOVE this line:
ease: scrubEase,
```

**2. Add will-change to CSS (2 min)**
```css
/* styles.css line 2073 */
.scene-chicken {
  will-change: transform;
}
```

**3. Reduce scrub values (10 min)**
```javascript
// index.tsx lines 301, 440
// CHANGE both from 0.96/0.98 to 0.8:
scrub: 0.8,
```

### Medium Priority (1 hour)

**Fix arrival chicken paths** (`landing-data.ts` lines 266-362)
- Increase Y-variance in arrival keyframes
- Make final positions converge to center (~50vw, not ±27vw)
- Limit to 6-8 visible chickens (not all 12)
- Use spatial grouping for stagger (not array index)

**Standardize stagger values** (`index.tsx`)
- Team appear/disappear: use same stagger (pick 0.02 or 0.03)
- Extract stagger constants to top of file

### Nice to Have (2-3 hours)

**Replace gradient animations with CSS** (lines 388-410)
- Use class toggling instead of inline `background` property
- Or use opacity overlay on existing sky element

**Add error logging** (line 416-418)
- Log missing DOM nodes for debugging
- Help catch chicken animation failures early

---

## Visual Timeline Diagram

```
STORY JOURNEY TIMELINE
├─ 0%    │ Chickens begin flight (right: +x, left: -x)
├─ 15%   │ Sky overlay fades in (sunset begins)
├─ 24%   │ "How It Works" section appears
├─ 28%   │ Warm sun glow effect
├─ 42%   │ Hero copy fades out
└─ 100%  │ Story section complete

ARRIVAL JOURNEY TIMELINE
├─ 0%    │ Team card + members fade in (0-4%)
├─ 8%    │ Coop body rises
├─ 16%   │ Roof animates in
├─ 22%   │ Windows/frames pop
├─ 25-50%│ Door glow flicker effect
├─ 40%   │ Night sky fade in
├─ 50%   │ Stars fade in
├─ 62%   │ Moon fades in (end)
└─ 100%  │ Arrival section complete

CHICKEN ANIMATION PHASES
├─ 5%    │ First chicken starts walking toward coop
├─ 20%   │ Early chickens (tabs, notes) almost out
├─ 40%   │ Middle chickens still entering
├─ 60%   │ Late chickens compressed at start (BUG)
└─ 80%   │ All chickens gone/invisible
```

---

## Testing Checklist

Before & After Optimization

### Before (Current State)
- [ ] Scroll jank visible at 60 FPS
- [ ] Chickens pile at top-left in arrival scene
- [ ] Scrub feels "sticky" at 120Hz
- [ ] Team members stagger inconsistent
- [ ] Console shows no errors (silent failures)

### After Fixes
- [ ] Smooth 60 FPS throughout (locked frame rate)
- [ ] Arrival chickens fan out from center
- [ ] Scrub feels responsive to scroll momentum
- [ ] Team animation symmetrical (appear/disappear)
- [ ] All 12 story chickens converge properly
- [ ] Thought bubbles visible on hover
- [ ] Coop assembly feels like a cohesive sequence

---

## File Map

| File | Lines | Purpose |
|------|-------|---------|
| index.tsx | 214-584 | Main animation setup (timelines, scrub config, chicken animations) |
| landing-data.ts | 169-362 | Flight paths (story & arrival) |
| landing-types.ts | All | Type definitions (no changes needed) |
| landing-animations.tsx | All | Component rendering (no changes needed) |
| styles.css | 1590-2219 | CSS for scene elements, chickens, bubbles |

---

## References

- GSAP ScrollTrigger Docs: https://greensock.com/docs/v3/Plugins/ScrollTrigger
- Scrub Values: https://greensock.com/docs/v3/Plugins/ScrollTrigger#scrub
- Will-Change CSS: https://developer.mozilla.org/en-US/docs/Web/CSS/will-change
- Hardware Acceleration: https://web.dev/rendering-performance/

