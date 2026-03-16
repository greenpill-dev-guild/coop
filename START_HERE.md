# 🧪 Coop Testing – START HERE

**Testing Period:** 2026-03-16 → 1-2 weeks  
**Tester:** Luiz  
**Mission:** Test 6 core flows, find bugs, document issues  
**Target:** Complete sign-off for Afo's iteration cycle

---

## 📋 What You're Doing

Afo built Coop. It's feature-complete but untested. Your job is to:
1. ✅ Load the extension in Chrome developer mode
2. ✅ Test 6 core workflows (create coop, peer sync, capture, publish, archive)
3. ✅ Find bugs and UX issues
4. ✅ Document everything clearly
5. ✅ Give Afo a prioritized issue list to iterate on

**Time estimate:** 30-60 mins per flow, 3-6 hours total for all 6.

---

## 📁 Your Files

### **1. SETUP_FOR_TESTING.md** ← **Read this first**
Complete step-by-step walkthrough:
- Environment setup (`.env.local`)
- Starting 3 dev servers
- Loading extension in Chrome
- Detailed testing for each of the 6 flows
- Troubleshooting for common problems

👉 **Open this file and follow it top-to-bottom.**

### **2. QUICK_TEST_REFERENCE.md** ← **Keep this handy**
One-page cheat sheet:
- Setup checklist
- 6 flows at a glance
- Debug commands
- Issue template
- Key URLs and env vars

👉 **Reference this while testing.**

### **3. TESTING_ISSUES.md** ← **Fill this out as you go**
Your issue tracker:
- Issue template (copy-paste when you find bugs)
- Progress table (mark each flow ✅ / ⚠️ / ❌)
- Checklist for sign-off

👉 **Add every bug here with severity + steps to reproduce.**

---

## 🚀 Quick Start (TL;DR)

**On your machine, do this:**

```bash
# 1. Create .env.local (copy-paste from SETUP_FOR_TESTING.md step 1)

# 2. Start 3 servers (in 3 separate terminal tabs):
bun run dev:app          # Tab 1
bun run dev:extension    # Tab 2
bun run dev:api          # Tab 3

# 3. Load extension in Chrome:
# - Open chrome://extensions/
# - Enable Developer mode
# - Click "Load unpacked"
# - Select packages/extension/dist
# - Open sidepanel

# 4. Start testing (see SETUP_FOR_TESTING.md for each flow)
```

---

## 🧪 The 6 Flows You'll Test

| # | Name | What You Do | Pass Criteria |
|---|------|-----------|---------------|
| 1 | **Extension Basics** | Load extension, check settings | Settings show correct chain/modes, no errors |
| 2 | **Coop Creation** | Create coop, pick preset | Coop appears in list, all tabs work |
| 3 | **Peer Sync** | Use 2 profiles, join via pairing code | Both see same coop, no sync errors |
| 4 | **Receiver Pairing** | Pair receiver, capture voice/link/photo | Item syncs to Feed in extension |
| 5 | **Capture → Publish** | Move item through Roost, publish | Item appears on /board |
| 6 | **Archive & Export** | Create snapshot, export receipt | Receipt file downloads |

**Each flow should take 5-15 minutes.** If you get stuck, check troubleshooting in SETUP_FOR_TESTING.md.

---

## 📝 How to File Issues

When you find a bug:

1. **Open TESTING_ISSUES.md**
2. **Copy the issue template** at the top
3. **Fill in:**
   - What flow you were on
   - What you clicked
   - What you expected
   - What actually happened
   - Any console errors (F12 → Console)
   - Severity: blocker / major / minor / polish

**Example:**
```markdown
### Flow 2 – Coop creation fails with generic name

**Component:** extension  
**Severity:** major

**Steps to Reproduce:**
1. Click "Create Coop"
2. Pick "Friends" preset
3. Enter name "Test"
4. Click Create

**Expected:**
Coop appears in list

**Actual:**
Error popup: "Name too short"

**Environment:**
Chrome 124, dev unpacked extension, mock modes

**Console Error:**
```
Uncaught TypeError: name.length < 5
    at validateCoopName (coopValidator.ts:23)
```

**Notes:**
Validation should accept short names or show clearer error before submit
```

---

## ✅ Definition of Done

Testing is complete when:
- [ ] All 6 flows tested
- [ ] Issues documented in TESTING_ISSUES.md with:
  - [ ] Clear title
  - [ ] Steps to reproduce
  - [ ] Expected vs. actual
  - [ ] Component & severity
- [ ] Website/PWA feedback documented
- [ ] Ready to hand off to Afo for iteration

---

## 🎯 What Afo Needs From You

At the end, send:
1. **TESTING_ISSUES.md** with all bugs listed
2. **Flow summary** (how many flows passed/failed)
3. **Critical blockers** (if any flows are completely broken)
4. **UX feedback** (does the interface feel good? Is anything confusing?)

---

## 🆘 Stuck?

1. **Check SETUP_FOR_TESTING.md** — most questions are answered there
2. **Check troubleshooting section** — common fixes for:
   - Extension won't load
   - Signaling server not running
   - Extension doesn't sync
   - Console errors
3. **If still stuck,** screenshot the error and describe:
   - What flow you're on
   - What you clicked
   - What the error says

---

## 📞 Next Steps

**After you read this:**
1. Open **SETUP_FOR_TESTING.md**
2. Follow steps 1–3 (environment + servers + load extension)
3. Test Flow #1 (Extension Basics)
4. Move through flows 2–6 systematically
5. Document issues in TESTING_ISSUES.md as you go
6. When done, let me know: "Testing complete"

---

## 🎮 Ready?

You have everything you need. Let me know when:
- ✅ You're ready to start (servers running, extension loaded)
- 🧪 You hit issues during testing
- ✅ You finish a flow (I'll help if something blocks you)
- 🏁 You're done (we'll review findings)

**The goal is to break things so Afo can fix them. Be thorough, be skeptical, try edge cases.** 🔨

---

**Last Updated:** 2026-03-16  
**Questions?** Check the files, or let me know what's unclear.

Good luck! 🚀
