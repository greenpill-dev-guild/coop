# Coop Testing Guide - March 30, 2026

## Server Status

All three dev servers are running:
- ✅ **App (PWA)**: http://127.0.0.1:3001 - Landing page + Receiver
- ✅ **API (Signaling)**: http://127.0.0.1:4444 - Hono WebSocket server
- ✅ **Extension**: Building in background (WXT dev mode)

## Testing Flows

### Flow 1: PWA Landing Page & Ritual

**URL**: http://127.0.0.1:3001

**What to Test**:
1. **Initial Load**
   - [ ] Page loads without errors (check console)
   - [ ] Hero section visible with "No more chickens loose" title
   - [ ] Scroll hint arrow visible and fades as you scroll

2. **Animations (Desktop only, 1024px+)**
   - [ ] Story journey section: Chickens move as you scroll down
   - [ ] Sun moves from top-right to bottom-left
   - [ ] Hills parallax and change color from sunset to night
   - [ ] "How it works" cards fade in during scroll
   - [ ] Arrival journey section: Coop house rises from ground
   - [ ] Chickens walk toward coop door
   - [ ] Night sky transitions with stars and moon
   - [ ] Door glow flickers when chickens arrive

3. **Ritual Cards (Flashcards)**
   - [ ] Four lens cards visible: Capital, Impact, Governance, Knowledge
   - [ ] Cards show "Incomplete" pill by default
   - [ ] Click card to open dialog
   - [ ] Dialog shows title, question, and detail text
   - [ ] Close button (×) works and returns focus to card
   - [ ] Escape key closes dialog

4. **Audio Recording**
   - [ ] Click "Record" button in open card
   - [ ] Microphone permission prompt appears (allow it)
   - [ ] Status shows "listening on this device"
   - [ ] Speak into mic - transcript appears in textarea
   - [ ] Click "Stop recording" when done
   - [ ] Text stays in textarea after stopping

5. **Card Completion**
   - [ ] Type or record content in all 4 cards
   - [ ] Click "Mark complete" to set card as ready
   - [ ] Card pill changes to "Ready" with checkmark
   - [ ] After all 4 cards complete: "Setup packet" section appears

6. **Setup Packet**
   - [ ] Fill in "Coop name" field
   - [ ] Fill in "What opportunity..." field
   - [ ] Add optional "Shared notes"
   - [ ] JSON packet displays in code block
   - [ ] Click "Copy packet" - should show "Copied" confirmation
   - [ ] Click "Download" - should download JSON file to Downloads

7. **Responsive Design**
   - [ ] On desktop (1024px+): Animations play smoothly
   - [ ] On tablet (768px): Animations disabled, layout responsive
   - [ ] On mobile (375px): All cards stack, readable text

### Flow 2: Receiver Pairing (PWA)

**URL**: http://127.0.0.1:3001/receiver or /pair endpoint

**What to Test**:
1. **QR Code Generation**
   - [ ] QR code appears for pairing
   - [ ] QR code is scannable
   - [ ] Copy button works for pairing code

2. **Pairing Flow** (if you have a second device/simulator)
   - [ ] Scan QR code with another device
   - [ ] Pairing confirmation on both devices
   - [ ] Pair button changes to "Paired"

### Flow 3: Extension Fresh Load

**Before Testing**:
1. Open Chrome
2. Go to `chrome://extensions/`
3. Remove any old "Coop" extension
4. Enable "Developer mode" (top right)

**Steps**:
1. Click "Load unpacked"
2. Navigate to `/Users/luizfernando/Desktop/Workspaces/Zettelkasten/03 Libraries/coop/packages/extension/dist/chrome-mv3/`
3. Select the folder and click "Select"

**What to Verify**:
- [ ] Extension loads without errors
- [ ] Extension icon appears in toolbar (not white square)
- [ ] Popup opens when clicking extension icon
- [ ] No console errors in extension popup

### Flow 4: Extension Popup - Tab Capture

**What to Test**:
1. **Open Multiple Tabs** in Chrome
   - Keep some tabs open in the current window
   - Have at least 3 different sites open

2. **Click Extension Icon** → Opens popup

3. **"Capture Tab" Button**
   - [ ] Tab list shows all open tabs with titles and favicons
   - [ ] Click on a tab to select it for capture
   - [ ] Click "Capture Tab" button
   - [ ] Notification appears: "Tab captured"
   - [ ] Tab appears in inbox/candidates in Chickens view

4. **"Screenshot" Button**
   - [ ] Click "Screenshot"
   - [ ] Browser shows screenshot tool overlay
   - [ ] Select area of screen
   - [ ] Screenshot saved to captures

5. **Quick Review**
   - [ ] Recent captures visible in popup with previews
   - [ ] Can categorize captures (e.g., "meeting notes", "research")
   - [ ] Can mark as draft or publish

### Flow 5: Extension Sidepanel - Navigation

**What to Test**:
1. **Open Sidepanel** (usually auto-opens or click panel icon)

2. **Chickens Tab** (Working queue)
   - [ ] Shows candidates (uncategorized captures)
   - [ ] Shows drafts (reviewed, ready to publish)
   - [ ] Can move between tabs via tabs menu

3. **Coops Tab**
   - [ ] Shows list of available coops
   - [ ] Can select/create a coop
   - [ ] Shows shared state and published artifacts

4. **Roost Tab** (Green Goods member workspace)
   - [ ] If member: shows member submissions
   - [ ] Can track work submissions and approvals

5. **Nest Tab** (Settings)
   - [ ] Receiver pairing section visible
   - [ ] Can unpair receiver
   - [ ] Member settings accessible

### Flow 6: Publish to Coop

**What to Test**:
1. Open extension popup
2. Ensure at least one capture exists
3. Click "Open Chickens" to go to full sidepanel
4. **In Chickens tab:**
   - [ ] Click candidate to open review modal
   - [ ] View full content, images, metadata
   - [ ] Optionally edit title, description, tags
   - [ ] Click "Move to draft" → moves to Drafts
5. **In Drafts tab:**
   - [ ] Review your draft
   - [ ] Select a coop from dropdown
   - [ ] Click "Publish to coop"
   - [ ] Confirmation appears: "Published"
   - [ ] Move to Coops tab and verify artifact is listed

## Critical Issues to Watch For

From previous testing (March 29):
1. **Extension freeze during tab capture** - BLOCKER
   - If it freezes: check console for Agent Harness errors
   - Restart extension if needed

2. **WebSocket connection failures**
   - Check Network tab for failed WS connections
   - Verify API server is running on port 4444

3. **White square popup** = extension not loading properly
   - Check chrome://extensions/ for errors
   - Rebuild extension: `bun run build:extension`

4. **Match pattern error** (may appear in console)
   - This is a known issue, sometimes gets overwritten on merge
   - Should still work despite the warning

## Testing Checklist

- [ ] PWA loads without console errors
- [ ] Landing page animations work (desktop only)
- [ ] All 4 ritual cards can be completed
- [ ] Setup packet can be downloaded
- [ ] Extension loads without white square
- [ ] Tab capture works (no freeze)
- [ ] Screenshot capture works
- [ ] Can move captures to drafts
- [ ] Can publish to coop
- [ ] WebSocket connections stable

## How to Report Findings

Create an entry in `/TESTING_SESSION_2026-03-30.md` with:

```markdown
## Issue #X: [Brief title]

**Severity**: Critical | High | Medium | Low

**Steps to Reproduce**:
1. Step 1
2. Step 2
3. Step 3

**Expected Behavior**:
What should happen

**Actual Behavior**:
What actually happened

**Console Errors**:
Any errors from F12 console

**Screenshots/Video**:
(if applicable)

**Environment**:
- Browser: Chrome/Firefox/Safari
- OS: macOS/Windows/Linux
- Build: `git log -1 --oneline`
```

## Notes

- All environment variables are in `.env.local` (single file, root level)
- Tests use mock-first mode by default (onchain/archive in mock mode)
- Local storage is in Dexie (IndexedDB) - check via DevTools > Application > IndexedDB
- Receiver PWA can be tested at http://127.0.0.1:3001 (same server as landing)

Good luck! 🐓
