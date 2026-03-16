# Parallel Fix & Test Session – 2026-03-16 15:01 UTC

**Status:** WebAuthn blocker implementation in progress  
**Your Task:** Alternative testing (landing page, receiver UX, PWA)  
**Agents Running:** 2 (webauthn-fixer, extension-builder)

---

## 🤖 What's Running in Background

### Agent 1: WebAuthn Fixer (big-pickle)
**Task:** Implement the pubKeyCredParams fix

**Will do:**
1. Open `packages/shared/src/modules/auth/auth.ts`
2. Find `createAuthSession` function
3. Add `pubKeyCredParams` with ES256 & RS256
4. Run unit tests
5. Report: Success/failure + test results

**Expected time:** 5–10 minutes

### Agent 2: Extension Builder (nemotron-3-super-free)
**Task:** Rebuild extension after fix

**Will do:**
1. Wait for fix to complete
2. Run: `bun run --filter @coop/extension build`
3. Verify build output
4. Report: Build health + warnings

**Expected time:** 5 minutes after fix completes

---

## 📋 Your Testing Tasks (While Fix is Being Applied)

Use **`ALTERNATIVE_TESTING_GUIDANCE.md`** as your roadmap.

### Priority 1: Landing Page (15 min)
**URL:** http://127.0.0.1:3002/

Test & document:
- [ ] Hero section (headline, CTA clarity)
- [ ] Problem statement (resonates?)
- [ ] How It Works (4-step flow)
- [ ] Setup Ritual (four lenses, prompt copy)
- [ ] Privacy model (local-first?)
- [ ] Extension states showcase
- [ ] Overall brand/polish (1–10)

**Output file:** `FEEDBACK_LANDING_PAGE.md`

### Priority 2: Receiver Flow UX (15 min)
**URLs:** `/pair` → `/receiver` → `/inbox`

Test & document:
- [ ] Pairing page loads and looks good
- [ ] Receiver capture UI (buttons, form fields)
- [ ] Mobile responsiveness (touch-friendly?)
- [ ] Inbox view (list rendering)
- [ ] Overall feel (1–10)

**Output file:** `FEEDBACK_RECEIVER_UX.md`

### Priority 3: Extension Polish (10 min)
**Component:** Sidepanel

Test & document:
- [ ] Settings tab opens (can you see Nest Runtime config?)
- [ ] Loose Chickens tab loads
- [ ] Console clean (F12 → Console tab)
- [ ] No obvious UI bugs
- [ ] Professional feel (1–10)

**Output file:** `FEEDBACK_EXTENSION_POLISH.md`

### Priority 4: Docs Site (10 min) [If Time]
**URL:** https://coop-docs-delta.vercel.app/

Quick review:
- [ ] Navigation works
- [ ] Getting Started clear
- [ ] Demo & Deploy guide visible
- [ ] Overall structure (1–10)

**Output file:** `FEEDBACK_DOCS_SITE.md`

---

## 📝 Template for Each Report

```markdown
# Testing Report – [Area]

**Date:** 2026-03-16  
**Tester:** Luiz  
**URL/Component:** [...]  
**Time Spent:** [X minutes]

## Overall Impression (1–10)
[Score and reason]

## What Works Well
- [Good thing 1]
- [Good thing 2]

## Issues Found
- [Issue 1]
- [Issue 2]

## Screenshots/Examples
[Describe or note location]

## Recommendations
- [Suggestion 1]
- [Suggestion 2]

## Production Readiness (1–10)
[Score and reasoning]
```

---

## 🔄 Coordination Timeline

```
15:01 UTC – NOW
├─ You start: Landing page testing
└─ Agents: WebAuthn fix + build

15:06–15:11 UTC (est.)
├─ WebAuthn fix completes
├─ Extension build starts
└─ You continue: Receiver UX testing

15:11–15:16 UTC (est.)
├─ Extension build completes ✅
├─ You: Extension polish testing
└─ Fix ready to deploy

15:16+ UTC
├─ You: Optional (Docs site, qualitative feedback)
└─ Fix ready for you to apply to your local extension
```

---

## 🚀 When Fix is Ready

Once the agents report success:

1. **Pull latest code**
   ```bash
   git pull origin luiz/release-0.0-sync
   ```

2. **Rebuild locally**
   ```bash
   bun install
   bun run --filter @coop/extension build
   ```

3. **Reload in Chrome**
   - Go to `chrome://extensions/`
   - Find Coop extension
   - Click [Reload]

4. **Resume Flow 2 Testing**
   - Go to Coops tab
   - Click [+ Create Coop]
   - Try coop creation
   - If successful → Continue with Flows 3–6

---

## 📊 Tracking

### Agents Status
- [ ] WebAuthn fixer: Running / Complete / Failed
- [ ] Extension builder: Running / Complete / Failed

### Your Testing Progress
- [ ] Landing page: Complete
- [ ] Receiver UX: Complete
- [ ] Extension polish: Complete
- [ ] Docs site: Complete (optional)

### Deliverables Ready
- [ ] FEEDBACK_LANDING_PAGE.md
- [ ] FEEDBACK_RECEIVER_UX.md
- [ ] FEEDBACK_EXTENSION_POLISH.md
- [ ] FEEDBACK_DOCS_SITE.md (optional)

---

## 💡 What You're Gathering

For Afo's iteration:

**Quantitative:**
- What works, what breaks
- Console errors
- UI consistency

**Qualitative:**
- Brand perception (cohesive? professional?)
- Clarity (for non-technical users?)
- Completeness (ready to ship?)
- Comparison (vs. other tools)

This feedback is **gold for prioritizing UX improvements** before public launch.

---

## ⚡ Quick Tips

1. **Keep notes as you test** – Don't rely on memory later
2. **Screenshot issues** – Visual proof is helpful
3. **Time yourself** – You have ~60 minutes total
4. **Be critical** – Afo wants honest feedback, not just praise
5. **Note the good stuff too** – What feels polished helps guide priorities

---

**Ready?** Open `ALTERNATIVE_TESTING_GUIDANCE.md` and start with the landing page!

Agents will auto-announce when done. You'll know when to apply the fix and resume core flow testing. 🚀

---

**Session Start:** 2026-03-16 15:01 UTC  
**Agents Running:** 2 (webauthn-fixer, extension-builder)  
**Your Role:** Tester & feedback gatherer  
**Duration:** ~60 minutes until fix is ready + deployed
