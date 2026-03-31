# Coop Testing Master Guide - March 30, 2026

## Server Status ✅

All three dev servers are running:
- **App (PWA)**: http://127.0.0.1:3001 - Landing page + Receiver
- **API (Signaling)**: http://127.0.0.1:4444 - WebSocket signaling
- **Extension**: WXT dev mode (auto-reloads on changes)

**Current Build Status**: ✅ Just rebuilt (Type errors fixed)

---

## Part 1: PWA Testing (Browser)

### Test 1.1: PWA Landing Page Load & Hero Section

**URL**: http://127.0.0.1:3001

**What to Do**:
1. Open URL in Chrome/Firefox
2. Allow popups if prompted
3. Check if page loads cleanly

**Using Cursor**: Open DevTools (F12) in browser
- [ ] Console tab - Should be clean (no red errors)
- [ ] Network tab - Check all resources load (green checkmarks)
- [ ] Performance tab - Note initial load time

**What You're Looking For**:
- [ ] Page title shows "Coop | Turn knowledge into opportunity"
- [ ] Hero section visible with text "No more chickens loose."
- [ ] Scroll hint arrow visible at bottom of hero
- [ ] No console errors or warnings

**If Issues Found**:
Document in `/TESTING_SESSION_2026-03-30.md`:
```
## Issue #X: [Title]
**Severity**: Critical | High | Medium | Low
**Steps**: 1. Open http://127.0.0.1:3001
**Expected**: Clean page load
**Actual**: [What happened]
**Console Error**: [Copy error text]
```

---

### Test 1.2: Landing Page Scroll Animations (Desktop Only)

**Requirements**: Desktop browser (1024px+ width), NOT on tablet/mobile

**What to Do**:
1. Scroll down slowly through the page
2. Watch for animations at each section

**Using Cursor to Inspect Elements**:
- Right-click on animated elements
- Use DevTools Element Inspector to check:
  - Classes applied (should include animation classes)
  - Computed styles showing transforms/opacity changes
  - GSAP timeline in console

**Animation Checklist** (scroll down slowly):

#### Story Journey Section
- [ ] Sun moves from top-right towards bottom-left
- [ ] Glows (left/right) move and scale smoothly
- [ ] Clouds drift left/right across screen
- [ ] Hills parallax (back, mid, front layers move at different speeds)
- [ ] Hills change color from light (daytime) to darker (night time)
- [ ] 8 chickens animate along paths toward center
- [ ] Chicken thought bubbles fade in/out
- [ ] Path opacity increases as you scroll

#### How It Works Section
- [ ] "How Coop works" heading fades in
- [ ] 4 cards fade in with slight upward movement
- [ ] Cards appear with staggered timing (one after another)
- [ ] All cards visible before Arrival section starts

#### Arrival Journey Section
- [ ] Night sky fades in
- [ ] Stars appear
- [ ] Moon rises from below and scales up
- [ ] Coop house body rises from ground
- [ ] Coop roof lifts up after body
- [ ] Coop details (windows, door, slats) appear
- [ ] Door glow flickers with cinematic effect
- [ ] 8 chickens walk toward coop in procession
- [ ] Chickens enter coop area

**If Animation Issues**:
- Check if `prefers-reduced-motion` is disabled
- Check GSAP is loaded in Network tab
- Take screenshot and note exact position when animation breaks

---

### Test 1.3: Ritual Cards (Flashcards) - Interactive

**What to Do**:
1. Scroll back up to "Curate your coop" section
2. Find 4 lens cards: Capital, Impact, Governance, Knowledge

**Card Initial State**:
- [ ] Each card shows title (e.g., "Capital")
- [ ] Each card shows number: "Lens 1", "Lens 2", etc.
- [ ] Each card shows status pill: "Incomplete" (grey)
- [ ] Each card shows detail text
- [ ] Cursor changes to pointer on hover

**Using Cursor for Element Inspection**:
- Click on first card title
- Inspect the element in DevTools
- Check for data attributes and class names
- Verify aria attributes for accessibility

**Open Card Test**:
1. Click on the "Capital" card (Lens 1)
2. Dialog modal opens with:
   - [ ] Card title at top
   - [ ] Lens number and status pill
   - [ ] Question prompt visible
   - [ ] Detail text below question
   - [ ] Textarea for notes (empty by default)
   - [ ] "Record" button
   - [ ] "Paste" button
   - [ ] Close button (×) in top right
   - [ ] "Mark complete" button at bottom

**Test Escape Key**:
- [ ] Press Escape key
- [ ] Dialog closes
- [ ] Focus returns to the card button

**Test Close Button**:
- [ ] Click × button
- [ ] Dialog closes
- [ ] Focus returns to the card button

---

### Test 1.4: Audio Recording (Optional - requires microphone)

**Only if you have microphone access**

**What to Do**:
1. Open any flashcard (e.g., Capital)
2. Click "Record" button

**Dialog Should Show**:
- [ ] Browser asks for microphone permission
- [ ] Status shows "Capital is listening on this device"
- [ ] "Record" button changes to "Stop recording"
- [ ] Textarea remains focused

**Test Recording**:
1. Speak clearly into microphone (e.g., "This is a test of audio recording")
2. Watch textarea - interim text should appear
3. Stop speaking
4. Click "Stop recording"

**After Recording**:
- [ ] Text appears in textarea (exact transcript or similar)
- [ ] Button changes back to "Record"
- [ ] Text persists in textarea
- [ ] Can click "Record" again to continue

**If Microphone Not Available**:
- [ ] Status shows browser message about microphone unavailable
- [ ] Can still type directly in textarea
- [ ] Paste button works (copy text first, then click Paste)

---

### Test 1.5: Card Completion Flow

**What to Do**:
1. Open Capital card (Lens 1)
2. Add some text (either record or type)
3. Click "Mark complete" button
4. Repeat for remaining 3 cards (Impact, Governance, Knowledge)

**Each Time You Complete a Card**:
- [ ] Textarea has content (at least 1 character)
- [ ] Click "Mark complete"
- [ ] Dialog closes
- [ ] Return to card grid view
- [ ] Card pill now shows "Ready" (green) with checkmark
- [ ] Card background changes slightly (highlight)

**After Completing All 4 Cards**:
- [ ] All 4 cards show green "Ready" pill with checkmark
- [ ] New section appears: "Your setup packet is ready"
- [ ] Shows message: "All four lenses are captured..."

---

### Test 1.6: Setup Packet Section

**What to Do**:
1. Complete all 4 ritual cards (see Test 1.5)
2. Scroll down to "Your setup packet is ready" section

**Fields to Fill**:
```
[ ] Coop name: Enter "Test Coop 001"
[ ] "What opportunity...": Enter "Testing the Coop application"
[ ] Shared notes: Enter "This is a test run on March 30, 2026"
```

**JSON Packet Display**:
- [ ] Click in any field, text updates
- [ ] JSON in code block updates in real-time
- [ ] JSON shows 4 lens transcripts (should match what you entered)
- [ ] JSON includes coopName, purpose, shared notes
- [ ] JSON is valid (no syntax errors)

**Using Cursor for JSON Inspection**:
- Copy the JSON from the page
- Use Cursor to validate it's valid JSON
- Check structure includes all expected fields

**Test Copy Button**:
1. Click "Copy packet" button
2. [ ] Button text changes to "Copied"
3. [ ] After ~2 seconds, reverts to "Copy packet"
4. Paste (Cmd+V) into a text editor
5. [ ] JSON appears (proves copy worked)

**Test Download Button**:
1. Click "Download" button
2. [ ] File downloads to Downloads folder
3. Filename should be: `Test_Coop_001.json`
4. Open file in text editor
5. [ ] Contains valid JSON
6. [ ] Matches what was shown on page

---

### Test 1.7: Responsive Design - Tablet View

**What to Do**:
1. Open DevTools (F12)
2. Click responsive design mode (Cmd+Shift+M)
3. Set width to 768px (iPad width)

**Check**:
- [ ] Page layout adapts to tablet width
- [ ] Text is readable (no truncation)
- [ ] Buttons are tap-able (large enough)
- [ ] Animations are DISABLED (should be static since < 1024px)
- [ ] All cards visible but may be stacked differently
- [ ] Scroll works smoothly

**Test Ritual Cards on Tablet**:
- [ ] Cards display in single column or 2-column grid
- [ ] Opening card shows same dialog
- [ ] All buttons work
- [ ] Recording still works if available

---

### Test 1.8: Responsive Design - Mobile View

**What to Do**:
1. Keep DevTools responsive mode open
2. Set width to 375px (iPhone width)

**Check**:
- [ ] Page stacks vertically
- [ ] Hero text is centered and readable
- [ ] Cards stack in single column
- [ ] Animations disabled
- [ ] Scroll is smooth
- [ ] No horizontal scrolling needed
- [ ] Buttons are full-width or properly sized

**Test Ritual Cards on Mobile**:
- [ ] Tap card to open
- [ ] Dialog opens fullscreen or modal
- [ ] Close works with × button or Escape
- [ ] Textarea is accessible for typing

---

## Part 2: Extension Testing (Chrome)

### Prerequisite: Load Extension Fresh

**Before starting Extension tests**:

1. **Open Chrome**
2. **Go to chrome://extensions/**
3. **Remove any old "Coop v1" extension** (click trash icon if present)
4. **Enable Developer mode** (toggle in top right)
5. **Click "Load unpacked"**
6. **Navigate to**: `/Users/luizfernando/Desktop/Workspaces/Zettelkasten/03 Libraries/coop/packages/extension/dist/chrome-mv3/`
7. **Select folder**
8. **Verify**:
   - [ ] Extension appears in list as "Coop v1"
   - [ ] Extension icon appears in toolbar (chicken head icon, NOT white square)
   - [ ] Icon shows in top right of Chrome

---

### Test 2.1: Extension Popup Loads

**What to Do**:
1. Click Coop extension icon in toolbar
2. Popup should open (small window)

**Check**:
- [ ] Popup appears without white square
- [ ] Popup shows loading state or content
- [ ] No console errors (open F12 in popup)
- [ ] Can see at least one button or section

**Using Cursor in Extension Popup**:
- Open DevTools while popup is open (F12)
- Inspect elements in popup
- Check Console for errors
- Check all scripts loaded

**If White Square Appears**:
- [ ] Remove extension
- [ ] Verify `packages/extension/dist/chrome-mv3/manifest.json` exists
- [ ] Check manifest.json is valid (no syntax errors)
- [ ] Reload unpacked again
- [ ] Open popup and check console for specific error

---

### Test 2.2: Extension Popup Sections

**What to Do**:
1. Click extension icon to open popup
2. Look for these sections:

**Top Section** (probably Quick Capture):
- [ ] Title shows
- [ ] At least one button visible (Capture Tab, Screenshot, etc.)

**Buttons to Look For**:
- [ ] "Capture Tab" button (or similar)
- [ ] "Screenshot" button (or similar)
- [ ] Navigation or menu options

**Lower Section** (probably Recent Captures):
- [ ] Shows list of recent captures (if any exist)
- [ ] Each item shows thumbnail/preview
- [ ] Shows title and timestamp

**Using Cursor for Layout Inspection**:
- Right-click on popup sections
- Inspect to see component hierarchy
- Check CSS classes and structure
- Look for loading states vs. loaded states

---

### Test 2.3: Tab Capture

**Setup**:
1. Open 3-5 different websites in Chrome tabs
2. Open Coop extension popup

**Test Tab Capture**:
1. Look for "Capture Tab" or "Round up tabs" button
2. Click it
3. [ ] Popup should show list of open tabs
4. [ ] Each tab shows:
   - Favicon
   - Tab title
   - URL (optional)
5. [ ] Click one tab from list to select
6. [ ] Click "Capture" or confirm button
7. [ ] Notification appears: "Tab captured" or similar
8. [ ] Popup updates or closes

**If Tab Capture Works**:
- [ ] Tab appears in inbox/captures
- [ ] In sidepanel, go to "Chickens" tab
- [ ] Captured tab should appear as a candidate
- [ ] Should show title, URL, and preview

**If Tab Capture Fails**:
- [ ] Note exact error message
- [ ] Check console in popup for errors
- [ ] Check background worker (in extensions page, click "service worker" for Coop)
- [ ] Document issue

---

### Test 2.4: Screenshot Capture

**What to Do**:
1. Click "Screenshot" button in popup
2. Browser should show screenshot selection UI

**Check**:
- [ ] Screenshot tool appears (overlay on page)
- [ ] Can drag to select area of screen
- [ ] Can click "Capture" or similar button
- [ ] Screenshot preview shows
- [ ] Can save or cancel

**After Capture**:
- [ ] Screenshot saved to inbox
- [ ] Appears in Chickens view
- [ ] Shows image thumbnail

---

### Test 2.5: Open Sidepanel

**What to Do**:
1. Click extension icon
2. Look for button like "Open Sidepanel" or "View Chickens"
3. Click it

**Alternative**:
- Use keyboard shortcut: `Cmd+Shift+Y` (or `Alt+Shift+Y` on Windows)

**Sidepanel Should Open**:
- [ ] Opens on right side of Chrome
- [ ] Shows "Chickens" tab or similar
- [ ] Tab bar at bottom with options: Roost, Chickens, Coops, Nest

---

### Test 2.6: Sidepanel Navigation - Chickens Tab

**What to Do**:
1. Sidepanel open (from Test 2.5)
2. Click "Chickens" tab if not already selected

**What You Should See**:
- [ ] Candidates section (uncategorized captures)
- [ ] Drafts section (reviewed, ready to publish)
- [ ] Any tabs you captured should appear here

**For Each Capture**:
- [ ] Shows title
- [ ] Shows thumbnail/preview (if image)
- [ ] Shows timestamp
- [ ] Can click to open details

**Test Opening a Candidate**:
1. Click on a candidate capture
2. Details modal opens
3. [ ] Shows full title
4. [ ] Shows content preview
5. [ ] Shows buttons to edit, categorize, move to draft

**Test Move to Draft**:
1. Click "Move to draft" or similar button
2. Capture moves from Candidates to Drafts section
3. [ ] Now appears under "Drafts"

---

### Test 2.7: Sidepanel Navigation - Coops Tab

**What to Do**:
1. Click "Coops" tab in sidepanel

**What You Should See**:
- [ ] List of available coops (or "Create coop" button)
- [ ] If no coops exist: button to create/join coop
- [ ] If coops exist: each shows name, members count, last activity

**Create or Select Coop**:
1. Click on existing coop or "Create coop" button
2. Coop details view opens
3. [ ] Shows coop name
4. [ ] Shows members list
5. [ ] Shows published artifacts/feed
6. [ ] Shows archive section (if available)

---

### Test 2.8: Sidepanel Navigation - Roost Tab

**What to Do**:
1. Click "Roost" tab in sidepanel

**What You Should See**:
- [ ] Roost workspace (Green Goods member area)
- [ ] May show member submissions, approvals, status
- [ ] Or empty state with info message

---

### Test 2.9: Sidepanel Navigation - Nest Tab

**What to Do**:
1. Click "Nest" tab in sidepanel

**What You Should See**:
- [ ] Settings and configuration options
- [ ] Receiver pairing section
- [ ] Member settings
- [ ] Possibly operator controls (if trusted node access)

**Test Receiver Pairing Section**:
- [ ] Shows pairing status
- [ ] Shows QR code (if not paired)
- [ ] Shows "Pair receiver" button
- [ ] Shows paired devices if already paired

---

### Test 2.10: Publish to Coop (End-to-End)

**Prerequisites**:
- [ ] At least one capture in Drafts (from Test 2.6)
- [ ] At least one coop created or available

**What to Do**:
1. Go to Chickens tab
2. Open a draft capture
3. Look for "Publish to coop" or similar button
4. Click it
5. [ ] Dialog appears asking which coop to publish to
6. [ ] Select a coop from dropdown
7. [ ] Confirm publish
8. [ ] Notification: "Published to [Coop Name]"

**After Publishing**:
1. Go to Coops tab
2. Open the coop you published to
3. [ ] Your capture appears in the feed
4. [ ] Shows title, content, timestamp
5. [ ] Shows your member name as publisher

---

## Part 3: Coordination Notes for Cursor Testing

### What Cursor Can Help With

When using Cursor's browser capability alongside terminal testing:

**Element Inspection**:
- Right-click elements → Inspect
- Check CSS classes and structure
- Verify aria attributes for accessibility
- Look at computed styles for animations

**Console Testing**:
- Open DevTools (F12)
- Check for JavaScript errors
- Test element selectors
- Inspect state in React DevTools

**Screenshot Testing**:
- Take screenshots of each section
- Compare responsive layouts
- Document visual issues
- Capture error states

**Interaction Testing**:
- Can test complex multi-step flows
- Can verify focus management
- Can test keyboard navigation
- Can test form input and validation

### Signal to Me in Terminal

When testing in Cursor and finding issues:
1. Note the test number (e.g., Test 1.2, Test 2.3)
2. Describe what happened vs. expected
3. Take screenshot if visual issue
4. Copy console error if JavaScript issue
5. Share findings here in terminal

---

## Part 4: Issue Documentation Format

**When You Find an Issue**:

Create entry in `/TESTING_SESSION_2026-03-30.md`:

```markdown
## Issue #15: [Descriptive Title]

**Severity**: Critical | High | Medium | Low

**Test**: [Test number, e.g., Test 1.2]

**Steps to Reproduce**:
1. Open http://127.0.0.1:3001
2. Scroll down to Ritual section
3. Click Capital card
4. [etc...]

**Expected Behavior**:
Dialog should open with form visible

**Actual Behavior**:
Dialog appears but textarea is empty/frozen

**Console Error** (if applicable):
```
Uncaught TypeError: Cannot read property 'focus' of undefined
```

**Screenshots/Details**:
- [Describe what you see]
- [What looks wrong]
- [Where on page]

**Browser/Environment**:
- Browser: Chrome 146
- OS: macOS
- Build: [git log -1 --oneline]
```

---

## Quick Testing Checklist

### PWA Testing
- [ ] Test 1.1: Landing page loads cleanly
- [ ] Test 1.2: Scroll animations work (desktop)
- [ ] Test 1.3: Ritual cards interactive
- [ ] Test 1.4: Audio recording works
- [ ] Test 1.5: Complete all 4 cards
- [ ] Test 1.6: Setup packet generates and downloads
- [ ] Test 1.7: Tablet responsive (768px)
- [ ] Test 1.8: Mobile responsive (375px)

### Extension Testing
- [ ] Load extension fresh (no white square)
- [ ] Test 2.1: Popup loads
- [ ] Test 2.2: Popup sections visible
- [ ] Test 2.3: Tab capture works
- [ ] Test 2.4: Screenshot capture works
- [ ] Test 2.5: Sidepanel opens
- [ ] Test 2.6: Chickens tab navigation
- [ ] Test 2.7: Coops tab navigation
- [ ] Test 2.8: Roost tab visible
- [ ] Test 2.9: Nest tab visible
- [ ] Test 2.10: End-to-end publish flow

---

## Server Commands (If Needed)

If servers crash or you need to restart:

```bash
# Restart all servers
pkill -f "bun.*dev" || true
sleep 2

# Start in 3 terminals:
Terminal 1: bun dev:app
Terminal 2: bun dev:api
Terminal 3: cd packages/extension && bun run dev

# Verify servers running:
curl http://127.0.0.1:3001 | head -5  # Should show HTML
curl http://127.0.0.1:4444/health     # Should return {"status":"ok"}
```

---

## Notes

- All 3 servers are running now ✅
- Extension just rebuilt and type errors fixed ✅
- Ready to test immediately
- Coordinate Cursor testing with me in terminal - I'll watch for issues
- Document findings in `/TESTING_SESSION_2026-03-30.md`

Good luck! 🐓
