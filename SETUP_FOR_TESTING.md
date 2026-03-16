# Coop Testing Setup Instructions

**Last Updated:** 2026-03-16  
**For:** Luiz (testing phase)

---

## 🚀 Quick Start (5 mins)

### 1. Environment Setup

Create `.env.local` at the repo root:

```bash
# Two-dev local setup (both you and anyone else testing locally)
VITE_COOP_CHAIN=sepolia
VITE_COOP_ONCHAIN_MODE=mock
VITE_COOP_ARCHIVE_MODE=mock
VITE_COOP_SESSION_MODE=off
VITE_COOP_RECEIVER_APP_URL=http://127.0.0.1:3001
VITE_COOP_SIGNALING_URLS=ws://127.0.0.1:4444
```

**Save this file.** It controls which chains, modes, and endpoints Coop uses.

---

### 2. Start the Dev Servers

Open **3 terminal tabs** in the repo root and run:

**Tab 1 – App & Receiver PWA:**
```bash
bun run dev:app
```
Expected output:
```
  ➜  Local:   http://127.0.0.1:3001
```

**Tab 2 – Browser Extension:**
```bash
bun run dev:extension
```
Expected output:
```
  ➜  built /path/to/packages/extension/dist
```

**Tab 3 – Signaling Server:**
```bash
bun run dev:api
```
Expected output:
```
  [signaling] listening on ws://127.0.0.1:4444
```

✅ **All 3 should start cleanly.** If any fails, let me know the error.

---

### 3. Load Extension in Chrome

1. Open **Chrome** (not Edge, not Firefox—Chrome only for now).
2. Go to `chrome://extensions/`
3. **Enable Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Navigate to `/path/to/coop/packages/extension/dist` and select it
6. You should see the Coop extension appear with a "Reload" button
7. **Pin the extension** (click the pin icon next to the address bar)
8. Click the extension icon → **Open sidepanel**

✅ **The sidepanel should open on the right side of Chrome.**

---

### 4. Test Extension Basics (Flow #1)

Once the sidepanel is open:

**Check these settings:**
1. Click **Settings** (gear icon in sidepanel)
2. Go to **Nest Runtime**
3. Verify you see:
   - Chain: `sepolia` ✅
   - Onchain mode: `mock` ✅
   - Archive mode: `mock` ✅
   - Receiver URL: `http://127.0.0.1:3001` ✅
   - Signaling: `ws://127.0.0.1:4444` ✅

**If any are wrong,** update `.env.local` and rebuild the extension:
```bash
# Kill the dev:extension tab (Ctrl+C)
# Update .env.local
# Restart: bun run dev:extension
# In Chrome: chrome://extensions → reload Coop extension
```

---

## 🧪 Core Testing Flows (The Real Work)

### Flow #1: Extension Basics ✅

**Goal:** Verify extension loads, settings display correctly, state badges work.

**Steps:**
1. ✅ Extension loads in sidepanel
2. ✅ Settings show correct chain/modes
3. ✅ No console errors (press F12 → Console tab)
4. ✅ Extension icon changes state when you interact with it

**Pass Criteria:**  
Extension is stable, no crashes, settings visible.

**If you find issues:**  
Copy the issue template from `TESTING_ISSUES.md`, fill it in, and add it to that file.

---

### Flow #2: Coop Creation 🍗

**Goal:** Create a coop, pick a preset, complete the ritual.

**Steps:**
1. In sidepanel, click **Coops** tab
2. Click **+ Create Coop**
3. Choose a preset:
   - **Friends** – Social network for a friend group
   - **Family** – Private family knowledge commons
   - **Personal** – Solo journaling + voice notes
   - **Project** – Team deliverables
   - **Community** – Broader ecosystem
4. Fill in the name (e.g., "Test Coop 1")
5. Complete the "ritual" (scroll through the onboarding copy)
6. Click **Create**

**Expected:**  
- Coop appears in the list
- You see a Feed, Roost, Coops, Settings tabs
- State badge shows "active" or "ready"

**Pass Criteria:**  
Coop creates without errors, all preset copy renders.

**Troubleshoot:**
- If creation fails, check browser console (F12) for errors
- Verify `.env.local` settings again

---

### Flow #3: Peer Join & Sync (Two-Profile Test) 👥

**This requires 2 Chrome profiles or 2 people.**

**Profile Setup:**
- **Profile A:** Your main testing profile (already has extension loaded)
- **Profile B:** New Chrome profile for the peer

**Steps for Profile B:**
1. Open Chrome menu → Create new profile (or use existing second profile)
2. In Profile B, go to `chrome://extensions/`
3. Load the same unpacked extension: `/path/to/coop/packages/extension/dist`
4. Open the extension sidepanel

**Testing Sync:**
1. **Profile A:** Create a new coop named "Peer Test"
2. **Profile A:** Go to **Coops** tab → click the coop → click **Generate Pairing**
3. **Profile A:** A pairing code or QR should appear—**screenshot or copy it**
4. **Profile B:** In the sidepanel, look for a **Join Coop** or **Accept Pairing** button
5. **Profile B:** Paste or scan the pairing code
6. **Both:** You should both see the same coop appear in your lists
7. **Profile A:** In the Feed tab, you should see sync activity

**Expected:**
- Pairing succeeds
- Both profiles see the same coop
- Sync indicators show connected status

**Pass Criteria:**  
Peer-to-peer sync works without UI freezes or crashes.

**Troubleshoot:**
- If pairing fails, check signaling server is running (`bun run dev:api`)
- Verify both profiles are using the same `.env.local` signaling URL
- Check browser console for `WebSocket` errors

---

### Flow #4: Receiver PWA Pairing 📱

**Goal:** Pair a receiver device (person or second browser tab) and test capture.

**Steps:**
1. **Profile A (Extension):** In the coop's **Coops** tab, click **Generate Receiver Pairing**
2. A QR code or pairing payload should appear
3. **Open a new tab** and go to `http://127.0.0.1:3001/pair`
4. **Scan the QR or paste the payload**
5. Click **Accept Pairing**
6. You should be redirected to `/receiver`

**Capture Something:**
1. On the receiver page, try:
   - **Voice note:** Click mic icon and record a 3-second note (if your browser allows microphone)
   - **Link:** Paste any URL (e.g., `https://example.com`)
   - **Photo:** Upload a photo from your machine (or try file picker)
2. Click **Send** or **Submit**

**Expected:**
- Receiver accepts the pairing
- Capture form works (at least one of voice/link/photo)
- Item is submitted without error

**Back in Profile A:**
1. Go to the **Feed** tab in the extension
2. You should see the captured item appear as "Private Intake"
3. The item should show metadata (timestamp, capture type)

**Pass Criteria:**  
Pairing succeeds, at least one capture type works, item syncs to extension Feed.

**Troubleshoot:**
- If pairing fails: check receiver URL in settings (`http://127.0.0.1:3001`)
- If capture fails: check browser console for upload errors
- If sync fails: check signaling server logs

---

### Flow #5: Capture → Review → Publish 📝

**Goal:** Move a captured item through draft → publication.

**Prerequisites:**  
You have at least one captured item in Private Intake (from Flow #4).

**Steps:**
1. **In the extension Feed tab**, you should see your Private Intake item
2. Click on it → **Move to Roost** (or similar button)
3. The item should appear in the **Roost** tab
4. Click on it and you should see an **Edit** form
5. Make a small edit (e.g., add a comment or tag)
6. Click **Publish** or **Save & Publish**

**Expected:**
- Item moves from Private Intake → Roost
- You can edit the item
- Publish succeeds
- Item disappears from Roost (now published)

**Verify Publication:**
1. Go to the **Feed** tab — you should see your published item
2. Go to `http://127.0.0.1:3001/board/` (the board route)
3. You should see your item rendered on the board as a node or artifact

**Pass Criteria:**  
Full flow works without errors, item is visible on feed and board.

**Troubleshoot:**
- If move fails: check console for state errors
- If publish fails: check you have edit permissions on the coop
- If board doesn't render: refresh the page, check network tab

---

### Flow #6: Archive & Export 📦

**Goal:** Create a snapshot and export a receipt.

**Steps:**
1. In the extension **Coops** tab, find your coop
2. Click the coop → look for **Archive** button (or similar)
3. Click **Create Snapshot**
4. A snapshot should be created (you may see a progress indicator)
5. Once complete, look for an **Export Receipt** button
6. Click it — a JSON file or receipt should download to your machine

**Expected:**
- Snapshot creates without error
- Receipt is generated
- File downloads successfully

**Verify:**
- Open the downloaded receipt in a text editor
- You should see structured data about your coop state

**Pass Criteria:**  
Archive and export complete without errors, receipt is valid JSON/format.

**Troubleshoot:**
- If archive fails: check browser console for errors
- If export fails: check your browser's download settings

---

## 📝 After Each Flow

**Copy this and add to `TESTING_ISSUES.md`:**

```markdown
### [Flow Name] – [Date]

**Result:** ✅ Pass / ⚠️ Partial / ❌ Fail

**Issues Found:**
- Issue 1 (severity: minor)
- Issue 2 (severity: major)

**Notes:**
[Anything else worth documenting]
```

---

## 🔧 Common Troubleshooting

**Extension won't load:**
- Delete `/packages/extension/dist`, rebuild: `bun run dev:extension`
- Verify `.env.local` exists at repo root

**Signaling server not running:**
```bash
cd /root/Zettelkasten/03\ Libraries/coop
bun run dev:api
```

**Extension doesn't sync:**
- Kill all 3 dev servers (Ctrl+C)
- Restart in order: dev:app, dev:extension, dev:api
- Reload extension in Chrome (`chrome://extensions`)

**Console errors:**
- Press F12 in Chrome, go to Console tab
- Look for red errors and screenshot them
- Include the error in your issue report

**Config changed but not applied:**
- Update `.env.local`
- Kill `dev:extension` (Ctrl+C)
- Rebuild: `bun run dev:extension`
- Reload extension in Chrome

---

## 🎯 Your Mission

1. **Set up `.env.local`** ✅
2. **Start all 3 dev servers** ✅
3. **Load extension in Chrome** ✅
4. **Test Flows 1–6** 🔄 **← You are here**
5. **Document all issues** in `TESTING_ISSUES.md`
6. **Send me the findings** so we can iterate

---

## 📞 If You Get Stuck

When something breaks:
1. Check the relevant troubleshooting section above
2. If still stuck, screenshot the error
3. Tell me:
   - Which flow you were on
   - What you clicked
   - What happened
   - What the console says (F12 → Console)

---

**Good luck! 🚀 Let me know when you're ready to start.**
