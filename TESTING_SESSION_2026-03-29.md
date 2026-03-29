# Testing Session Report: March 29, 2026

**Date:** March 29, 2026 | **Tester:** Luiz | **Branch:** `luiz/release-0.0-sync`
**Status:** 🚨 **HALTED** - Critical stability issues | **Issues:** 14 documented

---

## 🎯 Executive Summary

**What Was Tested:**
- ✅ Merged 4 UI polish feature branches (receiver-shell, capture-view, inbox-view, pwa-animations)
- ✅ Fixed 5 setup issues (ports, esbuild, match patterns)
- ✅ Flow 2: Successfully created a coop (despite warnings)
- 🚨 **BLOCKED:** Extension freezes during tab capture (Issue #12)

**Critical Finding:**
Extension infrastructure is unstable. Basic functionality (tab capture) causes complete freeze. Agent system shows stuck-state recovery 3x per session. WebSocket connections fail. **Not testable in current state.**

**Immediate Action Required:**
STOP feature work. Fix Issues #11, #12, #13 (Agent Harness v2 stability) before anything else.

---

## 🚨 Critical Issues (STOP Everything Else)

| # | Issue | Severity | Impact | Status |
|---|-------|----------|--------|--------|
| **12** | **Extension freezes during tab capture** | **BLOCKER** | Can't use core feature, testing halted | 🚨 **P0** |
| **11** | **Agent-runner stuck-state (3x per session)** | Major | Background cycles interfering with UI | 🚨 **P0** |
| **13** | **WebSocket connection failures** | Major | Extension requires manual reloads | 🚨 **P0** |

**Pattern:** Extension loads → agent warning → freeze → reload → repeat  
**Root Cause:** Likely Agent Harness v2 (recent merge) - background cycles, WebSocket management, resource cleanup

---

## 🔧 Fix Applied by Tester

**Issue #5:** Chrome match pattern error  
**File:** `packages/extension/src/build/receiver-matches.ts`  
**Fix:** `${url.origin}/*` → `${url.protocol}//${url.hostname}/*` (removed port)  
**Result:** Extension now loads successfully

---

## ⚠️ Other Issues Found

### Functional (Should Fix)
| # | Issue | Impact |
|---|-------|--------|
| 7 | WebAuthn missing ES256/RS256 algorithms | Warning appears repeatedly, may fail on older authenticators |

### UI/UX (Fix Once Stable)
| # | Issue | User Impact |
|---|-------|-------------|
| 8 | Chicken Yard not interactive | Can't click chickens (drafts), no hover, pills overflowing |
| 9 | Buttons vs stats look identical | Can't tell what's clickable vs informational |
| 10 | Terminology not explained | "What ARE chickens? Signals? Stale?" No tooltips/glossary |
| 14 | Screenshot form overflow | Must scroll horizontally to see full fields |
| 6 | Focus ring clipped | Visual polish issue |

---

## 💬 Key User Feedback

**On Terminology:**
> "What ARE chickens? (tabs? drafts? knowledge pieces?) What are signals? What makes something stale? What's the difference between drafts and chickens?"  
**Problem:** No tooltips, no onboarding, no glossary. Metaphor without explanation.

**On UI:**
> "Can't click on chickens in the yard. Buttons overflowing. Can't tell what's clickable vs what's just stats."  
**Problem:** Chicken Yard visual but non-interactive. Filter pills (Signals, Stale, Drafts) unclear if buttons or stats.

**On Coop Creation:**
> "Make lenses customizable - select relevant ones, library of lenses, map inputs/outputs, maybe rename to 'workflows'"  
**Suggestion:** More flexibility in lens selection, visual workflow builder.

---

## 📊 Testing Status

| Flow | Status | Blocker |
|------|--------|---------|
| 1. Extension Basics | 🚨 **BLOCKED** | Issue #12 (freeze) |
| 2. Coop Creation | ✅ **DONE** | Created despite warnings |
| 3. Peer Sync | ⏸️ Blocked | Requires working extension |
| 4. Receiver Pairing | ⏸️ Blocked | Requires working extension |
| 5. Capture→Publish | ⏸️ Blocked | Requires working extension |
| 6. Archive & Export | ⏸️ Blocked | Requires working extension |

---

## 🎯 Recommendations

### Immediate (This Week)
1. **STOP all feature work**
2. **Fix Issue #12:** Debug tab capture freeze
3. **Fix Issue #11:** Stabilize agent-runner cycles
4. **Fix Issue #13:** WebSocket connection management

### Short-term (Next Sprint)
5. **Fix Issue #7:** Add ES256/RS256 to WebAuthn
6. **Address Issues #8-10, #14:** UI/UX polish once stable

### Notes
- Extension is **not testable** in current state
- Core functionality (tab capture) breaks entire extension
- Fix infrastructure before ANY feature work
- UI/UX feedback valuable once stable

---

## 📁 Files & Links

**Comprehensive Report (Detailed Issues):**  
https://github.com/regen-coordination/coop/blob/luiz/release-0.0-sync/TESTING_SESSION_2026-03-29.md

**Branch:** `luiz/release-0.0-sync`  
**Message to Afo:** `MESSAGE_TO_AFO.txt` (copy/paste ready)

---

**Bottom Line:** Fix Agent Harness v2 stability (Issues #11-13) before any feature work. Extension is fundamentally broken at infrastructure level.

*Testing by Luiz | March 29, 2026 | Ready to resume once stability fixed*
