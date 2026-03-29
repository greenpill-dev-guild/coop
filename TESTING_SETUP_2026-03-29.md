# Testing Environment Setup Guide

**Date:** March 29, 2026  
**Branch:** luiz/release-0.0-sync  
**Status:** ✅ All UI polish branches merged and ready for testing

---

## ✅ Merge Status (March 29, 2026)

All feature branches have been successfully merged:

| Branch | Status | Key Features |
|--------|--------|-------------|
| origin/main | ✅ Merged | 70+ commits, 6 UI polish branches |
| origin/feat/receiver-shell-polish | ✅ Merged | BottomSheet polish, frosted glass shell |
| origin/feat/capture-view-polish | ✅ Merged | Enhanced egg button, pulse rings, empty state |
| origin/feat/inbox-view-polish | ✅ Merged | Kind accents, branded audio player |
| origin/polish/pwa-animations-boot-screens | ✅ Merged | Animations, view transitions, boot screens |

**Note:** Minor CSS conflicts resolved in `packages/app/src/styles.css` (inbox-view-polish vs pwa-animations-boot-screens). Kept cleaner pwa-animations structure.

---

## 🚀 Quick Start (TL;DR)

```bash
# 1. Verify you're on the right branch
git branch  # should show: * luiz/release-0.0-sync

# 2. Install dependencies
bun install

# 3. Start everything (this runs all 3 services concurrently)
bun dev

# 4. Load extension in Chrome (see Step 4 below)
```

**Expected running services:**
- App + Receiver PWA: http://127.0.0.1:3001
- API Server: http://127.0.0.1:4444
- Extension: WXT dev server (ports vary)

---

## 📋 Step-by-Step Setup

### Step 1: Verify Environment

```bash
# Check your current branch
git status

# Should show:
# On branch luiz/release-0.0-sync
# nothing to commit, working tree clean

# If not on the right branch:
git checkout luiz/release-0.0-sync
```

**Verify merge is complete:**
```bash
# Check recent commits (should show 4 feature branch merges)
git log --oneline -6

# Expected output:
# 3efffbc Merge origin/polish/pwa-animations-boot-screens with conflict resolution
# 9ebcf63 Merge origin/feat/inbox-view-polish with conflict resolution
# c1938f9 Merge origin/feat/capture-view-polish
# 23f54fb Merge origin/feat/receiver-shell-polish
# e2aef60 Merge origin/main with Afo's latest developments (70+ commits, 6 UI polish branches)

# Check if the session report exists (confirms March 29 merge)
ls SESSION_REPORT_2026-03-29.md

# Verify Afo's UI polish branches are present
git log --oneline -5
# Should show: Merge origin/main with Afo's latest developments (70+ commits, 6 UI polish branches)
```

---

### Step 2: Verify .env.local Configuration

**File location:** `/Users/luizfernando/Desktop/Workspaces/Zettelkasten/03 Libraries/coop/.env.local`

**Current working configuration:**
```bash
# App & Receiver PWA URL
VITE_COOP_RECEIVER_APP_URL=http://127.0.0.1:3001

# API server WebSocket URL
VITE_COOP_SIGNALING_URLS=ws://127.0.0.1:4444

# Blockchain (Mock mode for safe testing)
VITE_COOP_CHAIN=sepolia
VITE_COOP_ONCHAIN_MODE=mock
VITE_COOP_ARCHIVE_MODE=mock
VITE_COOP_SESSION_MODE=off
```

**Verify it exists:**
```bash
cat .env.local | head -20
```

**⚠️ Important:** Do NOT create package-specific .env files. Only this root `.env.local` is used.

---

### Step 3: Install Dependencies

```bash
# From repo root (only needed if you've never installed, or if bun.lock changed)
bun install

# Expected output:
# + @coop/api@workspace (packages/api)
# + @coop/app@workspace (packages/app)
# + @coop/extension@workspace (packages/extension)
# + @coop/shared@workspace (packages/shared)
# ... (1288+ packages)
```

**If you get lockfile errors:**
```bash
rm bun.lock
bun install
```

---

### Step 4: Start Development Servers

**Option A: Start Everything (Recommended for testing)**
```bash
bun dev
```

This runs concurrently:
- `bun dev:app` → App + Receiver PWA on http://127.0.0.1:3001
- `bun dev:extension` → WXT dev server for extension
- `bun dev:api` → API server on http://127.0.0.1:4444

**Option B: Start Services Individually**
```bash
# Terminal 1: App + Receiver PWA
bun dev:app

# Terminal 2: API server
bun dev:api

# Terminal 3: Extension
bun dev:extension
```

**Verify all services are running:**
```bash
# Check ports
lsof -i :3001  # App should be listening
lsof -i :4444  # API should be listening
```

**Expected console output:**
```
# App server
VITE v6.x  ready in xxx ms
➜  Local:   http://127.0.0.1:3001/
➜  Network: use --host to expose

# API server
Server running at http://127.0.0.1:4444

# Extension (WXT)
WXT 0.x.x
ℹ Building chrome-mv3 for development...
✔ Build completed in xxms
```

---

### Step 5: Load Extension in Chrome

**Prerequisites:**
- Google Chrome installed
- Developer mode enabled

**Step-by-step:**

1. **Open Chrome Extensions page:**
   ```
   chrome://extensions/
   ```

2. **Enable Developer Mode:**
   - Toggle switch in top-right corner: ON

3. **Click "Load unpacked":**
   - Button appears after enabling developer mode

4. **Select extension build directory:**
   ```
   /Users/luizfernando/Desktop/Workspaces/Zettelkasten/03 Libraries/coop/packages/extension/.output/chrome-mv3/
   ```

5. **Verify extension loaded:**
   - You should see "Coop" extension with version 0.0.x
   - Extension icon should appear in Chrome toolbar

**⚠️ Common Issue:** Extension shows errors
- **Fix:** Check that build completed successfully
```bash
cd packages/extension && bun run build
```

---

### Step 6: Verify Services Are Working

**Test 1: App Landing Page**
```bash
# Open in browser
curl http://127.0.0.1:3001
# Or visit: http://127.0.0.1:3001/
```

**Expected:** Landing page loads with animated chickens

**Test 2: Receiver PWA**
```bash
# Visit receiver app
curl http://127.0.0.1:3001/receiver
# Or: http://127.0.0.1:3001/receiver
```

**Expected:** Receiver shell with frosted-glass UI loads

**Test 3: API Health**
```bash
curl http://127.0.0.1:4444/health
```

**Expected:** JSON response with server status

**Test 4: Extension Popup**
- Click Coop extension icon in Chrome toolbar
- Popup should open with 4-tab bottom navigation:
  - Roost | Chickens | Coops | Nest

---

## 🧪 Testing Workflows

### Quick Validation (Before Testing)

```bash
# 1. Typecheck + Lint
bun run validate:quick

# 2. Smoke test (build + typecheck + core tests)
bun run validate:smoke

# 3. Full validation (takes longer)
bun run validate:full
```

### Run Tests

```bash
# All unit tests
bun run test

# With coverage (currently at 77%, target 85%)
bun run test:coverage

# Specific test files
bun run test -- packages/app/src/hooks/__tests__/useCapture.test.ts
bun run test -- packages/extension/src/views/Popup/__tests__/PopupApp.test.tsx

# Watch mode (during development)
bun run test --watch
```

### E2E Tests

```bash
# Popup actions E2E
bun run test:e2e:popup

# Receiver sync E2E
bun run test:e2e:receiver-sync

# Full extension E2E
bun run test:e2e:extension
```

---

## 🐛 Common Issues & Fixes

### Issue 1: Extension build fails with ONNX wasm error

**Error:**
```
Missing ONNX runtime wasm asset at .../node_modules/dist/ort-wasm-simd-threaded.jsep.wasm
```

**Fix:**
```bash
# Install missing dependency
bun install onnxruntime-web

# Copy wasm files
mkdir -p packages/extension/node_modules/@huggingface/transformers/dist
cp node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.* \
   packages/extension/node_modules/@huggingface/transformers/dist/
```

### Issue 2: Port conflicts

**Error:** Port 3001 or 4444 already in use

**Fix:**
```bash
# Find and kill process using port
lsof -i :3001
kill -9 <PID>

# Or use different port (requires updating .env.local)
```

### Issue 3: Extension doesn't load in Chrome

**Symptoms:** Extension icon grayed out, or shows errors

**Fix:**
```bash
# Rebuild extension
cd packages/extension && bun run build

# Reload extension in chrome://extensions/
# Click refresh icon on Coop extension card
```

### Issue 4: Test failures with connection refused

**Error:**
```
connect ECONNREFUSED 127.0.0.1:3000
```

**Fix:** Tests are trying to connect to wrong port. This is expected for some integration tests - they need the API running.

```bash
# Start API server first
bun dev:api

# Then run tests in another terminal
bun run test
```

---

## 📊 Test Flows to Execute

### Flow 1: Extension Basics ✅

**Goal:** Verify extension loads and basic UI works

**Steps:**
1. Load extension in Chrome (Step 5 above)
2. Click extension icon → popup opens
3. Check 4-tab navigation visible
4. Click through tabs: Roost → Chickens → Coops → Nest
5. Open browser console (F12) → check for errors

**Expected:** No crashes, all tabs accessible

### Flow 2: Coop Creation (Previously Blocked) 🔄

**Goal:** Create a new coop (was blocked by WebAuthn on March 16)

**Steps:**
1. Open extension popup
2. Navigate to appropriate tab for coop creation
3. Click "Create Coop" or equivalent button
4. Follow authentication flow (passkey)

**Expected:** Coop created without WebAuthn errors

### Flow 3: Receiver Pairing 🔄

**Goal:** Test receiver PWA pairing flow

**Steps:**
1. Visit http://127.0.0.1:3001/pair
2. Scan QR code or enter pairing code
3. Verify pairing successful
4. Test capture buttons (voice, photo, file)

### Flow 4: Landing Page Review 🔄

**Goal:** Review new landing page animations

**Steps:**
1. Visit http://127.0.0.1:3001/
2. Watch animation sequence: meadow → grazing chickens → ritual → dusk coop
3. Hover over elements to check thought bubbles
4. Test reduced-motion support (if applicable)

**Document findings in:** [TESTING_SESSION_2026-03-29.md](./TESTING_SESSION_2026-03-29.md)

---

## 📝 Documentation Templates

Use these templates to document findings:

- [TESTING_SESSION_2026-03-29.md](./TESTING_SESSION_2026-03-29.md) - Today's session log
- [FEEDBACK_LANDING_PAGE.md](./FEEDBACK_LANDING_PAGE.md) - Landing page feedback
- [FEEDBACK_RECEIVER_UX.md](./FEEDBACK_RECEIVER_UX.md) - Receiver PWA feedback
- [FEEDBACK_EXTENSION_POLISH.md](./FEEDBACK_EXTENSION_POLISH.md) - Extension UI feedback
- [FEEDBACK_QUALITATIVE.md](./FEEDBACK_QUALITATIVE.md) - Overall qualitative assessment

---

## 🆘 Emergency Commands

**Stop all services:**
```bash
# Kill all bun processes
pkill -f bun

# Or more specifically
pkill -f "bun dev"
```

**Reset to clean state:**
```bash
# Clean build artifacts
rm -rf packages/extension/.output
rm -rf packages/app/dist
rm -rf packages/shared/dist

# Rebuild everything
bun build
```

**Verify git status:**
```bash
git status
git log --oneline -3
```

---

## ✅ Pre-Testing Checklist

Before starting your testing session:

- [ ] On branch `luiz/release-0.0-sync`
- [ ] `.env.local` exists with correct ports (3001 for app, 4444 for API)
- [ ] Dependencies installed (`bun install` completed)
- [ ] `bun dev` running (all 3 services started)
- [ ] Extension loaded in Chrome (`chrome://extensions/`)
- [ ] Landing page loads at http://127.0.0.1:3001
- [ ] API responds at http://127.0.0.1:4444/health
- [ ] No console errors in extension popup
- [ ] [TESTING_SESSION_2026-03-29.md](./TESTING_SESSION_2026-03-29.md) open for logging

---

## 📚 Reference

- [AGENTS.md](./AGENTS.md) - Repo commands and architecture
- [TESTING_ISSUES.md](./TESTING_ISSUES.md) - Centralized issue tracker (14 issues from March 16)
- [docs/testing/ui-action-coverage.md](./docs/testing/ui-action-coverage.md) - Test coverage map
- [SESSION_REPORT_2026-03-29.md](./SESSION_REPORT_2026-03-29.md) - Today's merge report

---

**Ready to start testing?** Begin with Flow 1 (Extension Basics) and document in [TESTING_SESSION_2026-03-29.md](./TESTING_SESSION_2026-03-29.md).
