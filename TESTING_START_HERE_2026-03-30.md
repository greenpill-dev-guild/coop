# 🧪 START TESTING HERE - March 30, 2026

## ✅ Prerequisites Complete

- ✅ All 3 servers running (app:3001, api:4444, extension dev)
- ✅ Extension type errors fixed and rebuilt (52.1s)
- ✅ Git credentials verified for greenpill-dev-guild org
- ✅ Comprehensive testing guide ready
- ✅ Testing session template ready

---

## 📋 Your Testing Plan

You'll test using **two environments in parallel**:

### 1. **Terminal/Command Line** (This Window)
- Monitor server health
- Watch for build errors
- Coordinate with Cursor testing
- Document findings

### 2. **Cursor Browser** (Open Separately)
- Open http://127.0.0.1:3001 for PWA tests
- Open Chrome for Extension tests (manual)
- Use DevTools (F12) for inspection
- Take screenshots and inspect elements

---

## 🚀 Start Testing NOW

### Step 1: Load the Full Testing Guide

Open this file in your editor:
```
TESTING_MASTER_GUIDE_2026-03-30.md
```

This has **all instructions** for:
- **Part 1**: PWA Testing (8 tests)
- **Part 2**: Extension Testing (10 tests)
- **Part 3**: Coordination Notes
- **Part 4**: Issue Documentation Format

### Step 2: Open Cursor Browser

In **Cursor**, open these URLs in separate tabs:

**Tab 1 - PWA App**:
```
http://127.0.0.1:3001
```

**Tab 2 - DevTools on PWA**:
```
F12 (press this in the PWA tab)
```

### Step 3: Start with PWA Testing

**Follow Test 1.1 through 1.8** from the master guide:

1. **Test 1.1**: Landing page loads
2. **Test 1.2**: Scroll animations (desktop)
3. **Test 1.3**: Ritual cards interactive
4. **Test 1.4**: Audio recording (optional)
5. **Test 1.5**: Complete all 4 cards
6. **Test 1.6**: Setup packet download
7. **Test 1.7**: Responsive tablet (768px)
8. **Test 1.8**: Responsive mobile (375px)

**Time estimate**: 20-30 minutes

### Step 4: Load Extension in Chrome

Once PWA testing done:

1. Open **Chrome** (separate from Cursor)
2. Go to `chrome://extensions/`
3. Click **"Load unpacked"**
4. Navigate to: `/Users/luizfernando/Desktop/Workspaces/Zettelkasten/03 Libraries/coop/packages/extension/dist/chrome-mv3/`
5. Select folder

### Step 5: Test Extension (Tests 2.1-2.10)

Follow tests from master guide:

1. **Test 2.1**: Popup loads (no white square)
2. **Test 2.2**: Popup sections visible
3. **Test 2.3**: Tab capture works
4. **Test 2.4**: Screenshot capture works
5. **Test 2.5**: Sidepanel opens
6. **Test 2.6**: Chickens tab navigation
7. **Test 2.7**: Coops tab navigation
8. **Test 2.8**: Roost tab visible
9. **Test 2.9**: Nest tab visible
10. **Test 2.10**: End-to-end publish

**Time estimate**: 25-35 minutes

---

## 📝 Document Findings

As you test, record results in:
```
TESTING_SESSION_2026-03-30.md
```

Use this format for any issues found:
```markdown
## Issue #X: [Brief Title]

**Severity**: Critical | High | Medium | Low
**Test**: [Test number]
**Steps to Reproduce**: [1. 2. 3.]
**Expected**: [What should happen]
**Actual**: [What did happen]
**Console Error**: [Copy error if applicable]
```

---

## 🔗 Key Files to Keep Open

| File | Purpose |
|------|---------|
| `TESTING_MASTER_GUIDE_2026-03-30.md` | **All test instructions** |
| `TESTING_SESSION_2026-03-30.md` | **Results & issues** (edit as you test) |
| `TESTING_GUIDE_2026-03-30.md` | Original quick guide |
| `EXTENSION_RELOAD_GUIDE.md` | How to reload extension |

---

## 💡 Tips for Successful Testing

### PWA Testing (Cursor Browser)

1. **Open DevTools**: F12 to watch for console errors
2. **Test slow scroll**: Scroll slowly through animations to see smooth transitions
3. **Use responsive tool**: Click Cmd+Shift+M to toggle device sizes
4. **Test all breakpoints**: Desktop (1024+), Tablet (768), Mobile (375)
5. **Check focus**: Use Tab key to navigate, verify focus visible

### Extension Testing (Chrome)

1. **Fresh load each time**: Remove and reload if issues
2. **Watch console**: Click the service worker link to see background logs
3. **Inspect popup**: Open DevTools while popup is open (F12)
4. **Test keyboard**: Try Cmd+Shift+U (tab capture), Cmd+Shift+Y (sidepanel)
5. **Document steps**: Record exactly what you did before error

### Coordination with Terminal

When testing finds issues:
1. **Note the test number** (e.g., Test 1.2)
2. **Describe the issue** in a few words
3. **Share screenshots** if visual
4. **Copy console errors** if applicable
5. **Tell me in terminal** - I'll help debug

---

## ⚡ Quick Server Health Check

Before starting, verify all 3 servers:

```bash
# Check in terminal:
curl http://127.0.0.1:3001 | head -1          # Should show <!doctype html>
curl http://127.0.0.1:4444/health              # Should show {"status":"ok"}
curl http://127.0.0.1:3020/@vite/client        # Should show import ... (dev server)
```

All three should respond without errors ✅

---

## 🎯 Testing Goals

- **Identify blockers** (critical issues preventing use)
- **Test core flows** (capture, review, publish)
- **Check responsive design** (mobile, tablet, desktop)
- **Verify no console errors** (clean execution)
- **Document user experience** (smooth or rough?)

---

## 📞 Need Help?

If you hit an issue during testing:

1. **Stop and note**: What test, what happened, expected what
2. **Take screenshot**: If visual issue
3. **Copy console error**: If JavaScript error
4. **Tell me in terminal**: Share the details
5. **I'll debug live** if needed

---

## ✨ Ready? Let's Go!

1. **Open TESTING_MASTER_GUIDE_2026-03-30.md** 👈 Start here
2. **Open Cursor browser to http://127.0.0.1:3001** 👈 Then here
3. **Follow Test 1.1 through 1.8** 👈 Then test
4. **Record results in TESTING_SESSION_2026-03-30.md** 👈 Document
5. **Load Chrome extension** 👈 When PWA done
6. **Follow Test 2.1 through 2.10** 👈 Then test
7. **Report findings to me** 👈 Finally here

**Estimated total time**: 45-65 minutes

Let me know when you start testing! 🐓
