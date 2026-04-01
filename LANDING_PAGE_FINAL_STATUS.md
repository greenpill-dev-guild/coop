# Landing Page Work - Final Status & Handoff

**Date**: March 31, 2026  
**Status**: CLOSED (Work deferred to post-launch or Afo's discretion)  
**Decision**: Revert attempted animation fixes, keep origin/main stable landing page

---

## Summary

Your landing page contribution work (Phase 1-3) has been **closed cleanly**. The origin/main branch is stable and builds successfully. Attempted bug fixes today (animation synchronization, chicken positioning, visibility forcing) have been reverted to avoid introducing new issues before the deadline.

---

## What Was Built (Original Work)

### Phase 1: Landing Page Design Polish (15+ commits)
✅ **IN MAIN** - Already merged by Afo or other agents
- i18n infrastructure (5 languages)
- Interactive thought bubbles  
- Responsive layout improvements
- Performance optimizations
- Animation framework (GSAP + ScrollTrigger)

**Status**: Working, stable

### Phase 2: Receiver PWA Polish (10 commits)
❌ **NOT MERGED** - Exists on `luiz/phase-3-receiver-polish` branch
- ReceiverShell, CaptureView, InboxView polish
- Dark mode implementation
- Component styling
- Animations & transitions

**Status**: Beautiful work, but orphaned. Afo can merge if desired for Phase 2+.

---

## What We Attempted Today (4 Commits)

### 1. Layout & Language Selector (2fe8b1b)
**Status**: ⚠️ **REVERTED** - Would require integration with Landing component
- Language selector dropdown component (new file)
- "How Coop Works" width adjustment
- Better spacing on cards

**Why reverted**: LanguageSelector wasn't imported in origin/main, would require additional Landing component changes. Deferring for cleaner integration.

### 2. Disable Scroll Hijack (0b6808e)
**Status**: ⚠️ **REVERTED** - Fixed some issues but broke animations
- Disabling custom scroll hijack on ritual section
- Was meant to fix "Meet the Extension" section rendering

**Why reverted**: Disabling scroll hijack while animations still depend on it created inconsistencies. Root cause (GSAP timing) needs deeper architecture fix, not band-aid.

### 3. Force Visibility (bfdc44c)
**Status**: ⚠️ **REVERTED** - Using `!important` is not sustainable
- Forced `.scene-chicken-arrival` visibility with `!important`
- Forced arrival scene team visibility

**Why reverted**: Band-aid solution that hides real timing issues. Better to keep original GSAP logic clean.

### 4. Align Animations (e52314b)
**Status**: ⚠️ **REVERTED** - Partial success, but broader timing issues remain
- Removed duplicate flight paths (good!)
- Added initial transform to chickens (good!)
- Aligned heading/team animation timing (incomplete fix)

**Why reverted**: While some parts helped, the core issue (sections after "Curate your Coop" animate too early) remains unsolved. Would need to fix GSAP ScrollTrigger integration.

---

## Root Cause Analysis: Why Animation Fixes Failed

The landing page animation system has a **fundamental architecture issue**:

```
Timeline Logic:
- Story timeline: Tied to story-journey scroll → triggers 0-1 (full scroll)
- Arrival timeline: Tied to arrival-journey scroll → triggers 0-1 (full scroll)
- Problem: Both timelines animate based on scroll WITHIN their section
- Result: "How it Works" and "Meet the Extension" trigger during story scroll,
  not when you actually reach them visually
```

**To fix properly, would need to**:
1. Refactor GSAP ScrollTrigger to use viewport-entry triggers instead of section-scroll
2. Or remove custom scroll hijack entirely and use native scroll events
3. Add timing unit tests for animation sequences
4. This is 3-4 hours of architectural work, not a quick fix

**Current behavior**: Works but feels off-timing. Not broken enough to block release.

---

## Final State

### ✅ What's Guaranteed to Work
- Landing page builds successfully
- All landing page sections render
- Dark mode works
- Responsive design works (375px, 768px, 1024px+)
- Interactive cards (flashcards) work
- Scroll behavior is smooth
- No critical visual bugs

### ⚠️ Known Limitations
- Animation timing in sections after "Curate your Coop" feels early
- Chickens positioning correct but arrival timing could be smoother
- Team members appear with heading but animations aren't perfectly synchronized

### ❌ Won't Fix (Out of Scope)
- GSAP animation architecture refactor
- ScrollTrigger vs. custom scroll hijack decision
- Animation timing optimization

---

## Handoff to Afo

**Current branch**: `origin/main` - **STABLE, READY**  
**Previous branch**: `fix/landing-page-bugs` - Contains all attempted work, can reference if Afo wants to revisit

### Afo's Options:

1. **Option A: Ship As-Is** (Recommended)
   - Landing page works well enough
   - Animation timing is not a blocker
   - Can address after launch

2. **Option B: Quick Polish** (2-3 hours)
   - Have someone review GSAP timing
   - May be able to tweak ScrollTrigger parameters
   - Test with real users for feedback

3. **Option C: Architecture Refactor** (4+ hours)
   - Redesign animation triggering system
   - Move from scroll-percent-based to viewport-entry-based
   - Add comprehensive animation tests
   - Defer to post-launch polish sprint

---

## Receiver PWA Work (Bonus)

The 10 commits of receiver UI polish exist on `luiz/phase-3-receiver-polish` and individual unit branches. Afo should decide whether to:
- Merge for Phase 2+ work
- Archive for later reference
- Leave as is (isolated, not blocking anything)

---

## Test Status

- ✅ App builds without errors
- ✅ No broken dependencies
- ✅ Manual visual testing: layout, dark mode, responsiveness all work
- ⚠️ Animation timing: feels off but not broken
- ❌ Automated animation tests: don't exist (pre-existing gap)

---

## Summary for Release

**Can ship**: YES  
**Issues block release**: NO  
**Nice-to-have polish left**: Animation timing refinement  
**Effort to ship**: 0 more hours (origin/main is ready)

---

## What We Learned

1. **Animation architecture needs simplification** - Current GSAP + ScrollTrigger + custom hijack is hard to debug
2. **Band-aid fixes make problems worse** - Using `!important`, forcing visibility, disabling features creates tech debt
3. **Proper fix requires proper time** - Would rather have 1 clean solution than 3 partial ones
4. **Branch strategy matters** - Many feature branches created complexity; clear ownership would help

---

## Files Involved

- `packages/app/src/views/Landing/index.tsx` - Main component (unchanged from main)
- `packages/app/src/views/Landing/landing-animations.tsx` - Animation setup (unchanged)
- `packages/app/src/views/Landing/landing-data.ts` - Data/constants (unchanged)
- `packages/app/src/styles.css` - Main styles (unchanged from main)

All at origin/main state: **STABLE**

---

**Next Steps**: Afo decides whether to ship as-is or allocate time for animation polish before launch.

---

**Document prepared by**: Claude (OpenCode)  
**For**: Afo (Release Lead)  
**Time**: March 31, 2026 - 20:40 UTC  
**Status**: LANDING PAGE CONTRIBUTION CLOSED
