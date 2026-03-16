# Coop Testing Quick Reference

**Print this or keep it open while testing.**

---

## Setup Checklist (Do Once)

- [ ] Create `.env.local` at repo root (copy-paste from SETUP_FOR_TESTING.md)
- [ ] `bun run dev:app` (Tab 1) → http://127.0.0.1:3001 ✅
- [ ] `bun run dev:extension` (Tab 2) → packages/extension/dist built ✅
- [ ] `bun run dev:api` (Tab 3) → ws://127.0.0.1:4444 listening ✅
- [ ] Load unpacked extension: `chrome://extensions` → Load unpacked → `packages/extension/dist`
- [ ] Open sidepanel (click extension icon)

---

## 6 Testing Flows

| Flow | What | Where | Expected |
|------|------|-------|----------|
| 1 | Extension loads, settings correct | Sidepanel Settings | No errors, chain/modes visible |
| 2 | Create a coop, pick preset | Coops tab → + Create | Coop appears in list |
| 3 | Peer joins & syncs | New profile joins via pairing code | Both see same coop |
| 4 | Receiver pairs, captures | Accept pairing at /pair, capture at /receiver | Item in Profile A's Feed |
| 5 | Publish flow | Move to Roost → Publish | Item on /board |
| 6 | Archive & export | Coops tab → Archive → Export | Receipt file downloads |

---

## Status Tracking

```
Flow 1: Extension Basics
  [ ] Extension loads
  [ ] Settings show correct values
  [ ] No console errors
  Status: ___________

Flow 2: Coop Creation
  [ ] Coop creates
  [ ] Preset copy renders
  [ ] All tabs appear
  Status: ___________

Flow 3: Peer Sync (2-profile)
  [ ] Pairing code generated
  [ ] Profile B joins
  [ ] Both see coop
  Status: ___________

Flow 4: Receiver Pairing
  [ ] QR/pairing works
  [ ] At least one capture type works
  [ ] Item syncs to Feed
  Status: ___________

Flow 5: Capture → Publish
  [ ] Move to Roost works
  [ ] Publish works
  [ ] Item on /board
  Status: ___________

Flow 6: Archive & Export
  [ ] Snapshot created
  [ ] Receipt exported
  [ ] File downloaded
  Status: ___________
```

---

## Debug Commands

**Check extension is loaded:**
```
chrome://extensions/
```

**Restart everything cleanly:**
```bash
# Kill all 3 tabs (Ctrl+C in each)
# Restart in order:
bun run dev:app
bun run dev:extension
bun run dev:api
# Reload extension in chrome://extensions
```

**Check console for errors:**
```
F12 → Console tab → Look for red errors
```

**Update config & rebuild:**
```bash
# Edit .env.local
# Kill dev:extension (Ctrl+C)
# bun run dev:extension
# chrome://extensions → reload
```

---

## Issue Template (Copy & Paste)

```markdown
### [Flow #] – [Short Title]

**Component:** [extension | pwa | sync | other]  
**Severity:** [blocker | major | minor | polish]

**Steps to Reproduce:**
1. 
2. 

**Expected:**


**Actual:**


**Console Error (if any):**
```
[paste error here]
```

**Notes:**

```

---

## URLs to Know

- **App/Receiver:** http://127.0.0.1:3001
- **Pairing page:** http://127.0.0.1:3001/pair
- **Receiver:** http://127.0.0.1:3001/receiver
- **Inbox:** http://127.0.0.1:3001/inbox
- **Board:** http://127.0.0.1:3001/board/
- **Extension settings:** chrome://extensions/
- **Extension devtools:** Chrome sidepanel → F12

---

## Files You'll Edit

**TESTING_ISSUES.md** – Add all issues here (use template)  
**SETUP_FOR_TESTING.md** – Full detailed walkthrough (if you get stuck)  
**QUICK_TEST_REFERENCE.md** – This file (keep it handy)

---

## Key Environment Variables (.env.local)

```
VITE_COOP_CHAIN=sepolia                    # Blockchain
VITE_COOP_ONCHAIN_MODE=mock                # On-chain: mock or live
VITE_COOP_ARCHIVE_MODE=mock                # Archive: mock or live
VITE_COOP_SESSION_MODE=off                 # Sessions: off, mock, or live
VITE_COOP_RECEIVER_APP_URL=http://127.0.0.1:3001
VITE_COOP_SIGNALING_URLS=ws://127.0.0.1:4444
```

---

## Signal: When You're Done

After testing all 6 flows:
1. Add all issues to `TESTING_ISSUES.md`
2. Mark each flow as ✅ Pass / ⚠️ Partial / ❌ Fail
3. Let me know: "Testing complete, X issues found"

---

**Last Updated:** 2026-03-16  
**Questions?** Check SETUP_FOR_TESTING.md for more detail.
