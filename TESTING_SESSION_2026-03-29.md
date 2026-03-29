# Testing Session Findings - March 29, 2026

**Branch:** `luiz/release-0.0-sync`
**Detailed Documentation:** https://github.com/regen-coordination/coop/blob/luiz/release-0.0-sync/TESTING_SESSION_2026-03-29_DETAILED.md

---

## Testing Progress & Plan

### ✅ Completed
- **Flow 1:** Extension Basics - Started, identified issues  
- **Flow 2:** Coop Creation - **SUCCESS** (coop created despite warnings)  
- **Setup:** Merged 4 UI polish branches, fixed 5 environment issues

### ⏸️ Blocked / Remaining
- **Flows 3-6:** Peer Sync, Receiver Pairing, Capture→Publish, Archive - **BLOCKED** by Issue #12  
- **PWA Testing:** Not started (planned after extension issues resolved)  
- **Documentation:** Not started

### Testing Approach
Systematic flow-based testing. When hit blockers, adapted with workarounds to continue testing what we could. Session halted when core functionality (tab capture) caused complete system freeze.

---

## 🚨 Critical Issues (STOP Everything Else)

### Issue #12: Extension completely freezes during tab capture
**Severity:** BLOCKER | **Status:** Testing Halted

**What Happened:**
While testing basic functionality, attempted to add/capture a tab using the extension. The extension immediately became completely unresponsive - cannot click on any buttons, tabs, or interactive elements. The popup appears visually but is frozen/locked.

**Steps to Reproduce:**
1. Extension was open and functional
2. Attempted to add a tab (basic capture functionality)
3. Extension immediately froze
4. Now cannot click anything in the popup
5. UI appears but is completely non-interactive

**Impact:**
- Core functionality broken
- Cannot test Flows 3-6 (all require tab capture)
- Extension is unusable in current state
- Testing cannot continue

**Related Issues:**
- Issue #7: WebAuthn warnings (occurred before freeze)
- Issue #11: Agent-runner stuck-state (occurred immediately before freeze)

**Next Steps:**
Developer must investigate tab capture handler for infinite loops or blocking operations. Review background page/service worker for errors. Check correlation with agent stuck-state (Issue #11).

---

### Issue #11: Agent-runner stuck-state recovery (RECURRING)
**Severity:** Major | **Status:** Happened 3 times in one session

**Errors Observed:**
```
[agent-runner] Stuck-state recovery: cycle has been running since 
2026-03-29T11:58:29.633Z, resetting.

[agent-runner] Stuck-state recovery: cycle has been running since 
2026-03-29T12:08:37.097Z, resetting.
```

**What Happened:**
Agent-runner system triggered "stuck-state recovery" mechanism multiple times during the testing session, resetting cycles that had been running. This suggests the agent system is running background processes that can enter stuck states during normal UI interaction.

**Pattern:**
1. Extension loads initially
2. Works briefly
3. Agent-runner shows stuck-state warning
4. Extension UI becomes sluggish or freezes
5. Eventually requires manual reload

**Correlation with Issue #12:**
The agent-runner stuck-state and WebSocket errors appeared immediately before/during the extension freeze. This suggests:
- Agent background cycles may be interfering with UI responsiveness
- WebSocket connection issues could be blocking main thread
- Resource leaks or deadlocks between agent and UI

**Impact:**
- Background processes unstable
- Likely causes or contributes to Issue #12 freeze
- Extension unreliable, requires manual intervention

**Next Steps:**
URGENT: Review agent harness v2 implementation for:
1. Memory leaks in background cycles
2. WebSocket connection management
3. Proper cleanup on extension reload
4. Prevention of stuck-state conditions
5. Resource cleanup on extension operations

---

### Issue #13: WebSocket connection failures and extension requires repeated reloads
**Severity:** Major | **Status:** Recurring

**Errors Observed:**
```
WebSocket is already in CLOSING or CLOSED state.
```

**What Happened:**
After the extension froze (Issue #12) and was manually reloaded in Chrome extensions manager, WebSocket connection errors appeared. Additionally, the extension has required multiple manual reloads during this testing session - this is not normal behavior for a stable extension.

**Timeline:**
1. Extension froze during tab capture (Issue #12)
2. User reloaded extension via chrome://extensions/
3. Extension opened but showed new errors
4. Extension previously required reload earlier in testing session too

**Recurring Pattern:**
- Extension has required **manual reload multiple times** during single testing session
- This is **not normal behavior** - extensions should not need frequent reloads
- Suggests serious stability/resource management issues

**Impact:**
- Extension unreliable - requires manual intervention to recover
- WebSocket connection issues prevent real-time features from working
- Poor user experience (having to reload extension repeatedly)
- May indicate memory leaks or resource exhaustion

**Next Steps:**
1. Add proper cleanup on extension unload/reload
2. Fix WebSocket connection management (proper close handling)
3. Review agent-runner lifecycle (stop on unload, start on load)
4. Add logging to track reload frequency and causes
5. Test extension stability over extended use (not just initial load)

---

## ⚠️ Other Issues Found

### Issue #7: WebAuthn missing ES256 and RS256 algorithms
**Severity:** Major | **Status:** Functional but shows warning

**Error:**
```
publicKey.pubKeyCredParams is missing at least one of the default algorithm 
identifiers: ES256 and RS256. This can result in registration failures on 
incompatible authenticators.
```

**What Happened:**
Coop creation works but Chrome shows warning about missing algorithm identifiers in WebAuthn credential creation. The warning indicates potential incompatibility with some authenticators.

**Recurrence:**
Happened multiple times during testing:
- During coop creation (initial authentication)
- During random button clicking (extension popup)

**Impact:**
- Coop IS created successfully
- Chrome shows warning about missing algorithms
- May fail on older/incompatible authenticators

**Next Steps:**
Add ES256 and RS256 to `pubKeyCredParams` in WebAuthn credential creation in `packages/shared/src/modules/auth/auth.ts`:
```typescript
pubKeyCredParams: [
  { alg: -7, type: 'public-key' },   // ES256
  { alg: -257, type: 'public-key' }, // RS256
],
```

---

### Issue #8: Chicken Yard not interactive + filter pills overflowing
**Severity:** Major | **Status:** Open

**Description:**
The "Chicken Yard" visualization in the Roost/Home view has two problems: (1) chickens are not clickable/hoverable even though they represent draft items, and (2) the filter pills (Signals, Stale, Drafts 2) are visually overflowing into the chicken yard area, causing layout overlap.

**What is the Chicken Yard:**
The Chicken Yard (`.popup-yard`) is a visual representation of draft items waiting for review. Each chicken icon represents a draft/candidate. It's located in the Roost/Home tab of the extension popup.

**Problems:**
1. **Not Interactive:** Cannot click on individual chickens. No hover effects. Chickens appear to be decorative only, not functional. Expected: Should be able to click a chicken to open/review that draft.

2. **Layout Overflow:** Filter pills ("Signals", "Stale", "Drafts 2") at top visually overflow/bleed into the chicken yard area below. Creates cluttered/confusing visual hierarchy.

**Next Steps:**
1. Make chickens **clickable** - open draft detail view on click
2. Add **hover tooltip** showing draft title/category
3. Add **8-16px margin** between filter pills and chicken yard
4. Consider **scrollable chicken yard** if many drafts exist

---

### Issue #9: Buttons vs stats not visually differentiated
**Severity:** Major | **Status:** Open

**Description:**
In the Chicken Yard area, the filter pills/buttons at the top ("Signals", "Stale", "Drafts 2", "Play coop sound") have no visual differentiation to indicate which are clickable buttons vs which are just informational stats. All elements look identical - same background, same border, same styling - making it impossible to know what will happen when clicked (if anything).

**Confusion:**
| Element | Expected | Actual | User Guess |
|---------|----------|--------|------------|
| "Play coop sound" | Button (click to play) | Looks like button | ✅ Probably button |
| "Signals" | Filter button (click to filter) | Same styling as others | ❓ Is this clickable? |
| "Stale" | Filter button (click to filter) | Same styling as others | ❓ Is this clickable? |
| "Drafts 2" | Stats label (shows count) | Same styling as others | ❓ Is this a button or just info? |

**Next Steps:**
Add visual affordance:
- **Buttons** should look clickable: different background, border style, or hover state
- **Stats/Labels** should look informational: muted styling, no border
- **Active state** should be clearly indicated for selected filter

---

### Issue #10: Terminology not explained
**Severity:** Major | **Status:** Open

**Description:**
The extension uses many domain-specific terms without explanation, tooltips, or context. New users encounter terms like "chickens," "signals," "stale," "drafts," "Roost," "Nest" without understanding what they represent or how they relate to the product's functionality.

**Undefined Terms:**
| Term | User Question |
|------|---------------|
| **Chickens** | "What do the chickens represent?" |
| **Signals** | "What are signals? What makes something a signal?" |
| **Stale** | "What does 'stale' mean? Old? Expired?" |
| **Drafts** | "Are drafts different from chickens? What's the relationship?" |
| **Roost** | "Why is it called Roost? What's here vs other tabs?" |
| **Loose Chickens** | "What makes them 'loose'?" |

**Current User Guessing:**
- Chickens = tabs/knowledge pieces? drafts? items to review?
- Signals = important items? flagged items? notifications?
- Stale = old/deprecated items? items needing attention?
- Drafts = work in progress? vs chickens which are... captured?

**Next Steps:**
1. Add **tooltip explanations** on hover
2. Create **first-time onboarding** walkthrough
3. Include **inline context** with subtle hints
4. Consider **glossary/help** section

---

### Issue #14: Screenshot form fields overflow extension popup
**Severity:** Minor | **Status:** Open

**Description:**
When attempting to take a screenshot using the extension, the form fields for the screenshot capture do not fit within the extension popup window. The text fields extend beyond the visible popup boundaries, requiring the user to scroll horizontally to see the entire field content.

**Expected:**
- All form fields should fit within the extension popup width
- No horizontal scrolling required
- Responsive design adapts to popup container

**Actual:**
- Form fields extend beyond popup boundaries
- Must scroll horizontally to see full field content
- Poor user experience for data entry

**Next Steps:**
1. Make form fields responsive with `width: 100%` and `box-sizing: border-box`
2. Ensure popup has sufficient width for form content (min 400px recommended)
3. Test all forms in extension for responsive behavior

---

### Issue #6: Focus ring clipped by popup boundaries
**Severity:** Minor | **Status:** Open

**Description:**
When clicking on text input fields in the coop creation form, the orange focus highlight/border ring is partially cut off by the invisible boundaries of the extension popup window. The left and right edges of the focus ring appear clipped.

**Next Steps:**
Add 2-4px padding to popup container or switch from `outline` to `box-shadow` for focus rings to prevent clipping.

---

## 🔧 Fix Applied by Tester

**Issue #5: Chrome match pattern error** - FIXED

**Problem:** Extension wouldn't load with error: `Invalid match pattern "http://127.0.0.1:3001/*": Hostname cannot include a port`

**Fix:** Modified `packages/extension/src/build/receiver-matches.ts`
- Changed: `${url.origin}/*` (includes port)
- To: `${url.protocol}//${url.hostname}/*` (removes port)

**Result:** Extension now loads successfully

---

## 💬 Key User Feedback (Quotes)

**On Terminology:**
> "There are a lot of terms that are not properly introduced, explained - ie what the chickens are representing (tabs/knowledge pieces?), signals (still dont understand what should be), stale, draft 2"

**On UI:**
> "Can't click on anything inside of it (the chickens) and also no hover. The buttons/pills instead of it are overflowing into the chickens element."

**On Coop Creation:**
> "Make more customizable - select which ones are actually relevant for the group, have a library of lenses, be able to map out and connect inputs and outputs of lenses, maybe could name this into workflows?"

---

## 📋 Single Link to Share

**This Report (with all issue details):**
https://github.com/regen-coordination/coop/blob/luiz/release-0.0-sync/TESTING_SESSION_2026-03-29.md

**Branch:** `luiz/release-0.0-sync`

**Also Available:**
- Detailed issue documentation: `TESTING_SESSION_2026-03-29_DETAILED.md`
- Setup guide: `TESTING_SETUP_2026-03-29.md`

---

## 🎯 Summary & Next Steps

**What Works:**
- Extension loads (after match pattern fix)
- Coop creation functional (despite WebAuthn warning)
- 4-tab navigation visible
- UI polish features merged

**What's Broken:**
- **Issue #12:** Extension freezes during tab capture (BLOCKER)
- **Issue #11:** Agent stuck-state recurring (systemic)
- **Issue #13:** WebSocket failures (stability)
- **Issue #7:** WebAuthn warnings (should fix)

**What to Fix First:**
1. **STOP feature work**
2. **Fix Issues #11-13** (Agent Harness v2 stability)
3. **Then:** WebAuthn (#7), UI/UX (#6, #8, #9, #10, #14)

**Testing Plan (Once Fixed):**
- Resume Flows 3-6 (Peer Sync, Receiver Pairing, Capture→Publish, Archive)
- Test PWA at `http://127.0.0.1:3001`
- Test documentation site

**Bottom Line:** Extension infrastructure broken at core level. Fix stability before ANY feature work. UI/UX feedback valuable once stable.

---

*Testing by Luiz | March 29, 2026 | Ready to resume once Issues #11-13 resolved*
