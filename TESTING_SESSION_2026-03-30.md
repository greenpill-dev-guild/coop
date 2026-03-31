# Testing session — Master guide run

**Plans followed**: `TESTING_START_HERE_2026-03-30.md` · `TESTING_MASTER_GUIDE_2026-03-30.md`

**Session date**: 2026-03-31

**Environment**

- **Git**: `3d90663 Merge remote-tracking branch 'origin/main' into luiz/release-0.0-sync`
- **Agent**: Cursor embedded browser (Chromium), not standalone Chrome
- **PWA URL**: `http://127.0.0.1:3001/landing` (root redirects here after receiver check)

---

## Prerequisites (`TESTING_START_HERE` quick health)

| Check | Result |
|--------|--------|
| `curl http://127.0.0.1:3001` | HTTP **200** |
| `curl http://127.0.0.1:4444/health` | `{"status":"ok"}` |
| `curl http://127.0.0.1:3020/@vite/client` | **Not running** (optional extension dev port; skip if you use `dist` + Chrome only) |

---

## Part 1: PWA — `TESTING_MASTER_GUIDE` tests

### Test 1.1: Landing load and hero

| Criterion | Result |
|-----------|--------|
| Title “Coop \| Turn knowledge into opportunity” | Pass |
| Hero “No more chickens loose.” | Pass |
| Console free of red app errors | Pass (Vite HMR, React DevTools hint, Cursor browser dialog warning only) |
| Scroll hint in hero | Not verified (not exposed in a11y snapshot) |

### Test 1.2: Scroll animations (desktop 1024px+)

- Viewport set to **1280×800**.
- Scrolled “How Coop works” into view; page uses scroll containers — **full motion checklist (sun, hills, chickens, GSAP) not visually verified** in this environment (no frame-by-frame / pixel inspection).

**Result**: **Partial** — manual Chrome + slow scroll still recommended for the full animation checklist.

**Manual follow-up (2026-03-31, Luiz)**: Logged **Issues #4, #8, #9** — sluggish scroll-linked motion, misplaced chickens in `#why-build`, team block timing/overlap/sizing.

### Test 1.3: Ritual cards (interactive)

| Criterion | Result |
|-----------|--------|
| Four lenses present | Pass — **copy differs from master guide**: **Collective Intelligence, Funding & Resources, Governance, Evidence & Outcomes** (guide says “Capital, Impact, …”) |
| Status labels | **Not started** / **In progress** / **Ready** with ✓ (guide says “Incomplete”) |
| Open card → Record, Paste, textarea, Close, Mark complete / ✓ Complete | Pass |
| **Escape** closes expanded card | Pass |
| **Close card** closes expanded card | Pass |

**Manual follow-up (2026-03-31, Luiz)**: Logged **Issues #5, #6, #7** — flashcard top lines / bottom marks, lens vs ritual copy, request for more rituals.

### Test 1.4: Audio recording (optional)

**Not run** (no automated mic / permission flow in this pass).

### Test 1.5: Card completion flow

- Reset ritual, then completed all **four** lenses with minimal text; all showed **Ready** + ✓; **“Your setup packet is ready”** appeared.

**Result**: Pass (with lens naming as in §1.3).

### Test 1.6: Setup packet

Filled per master guide:

- Coop name: `Test Coop 001`
- Opportunity: `Testing the Coop application`
- Shared notes: `This is a test run on March 30, 2026`

| Criterion | Result |
|-----------|--------|
| Fields accept input | Pass |
| Copy packet / Download present | Pass |
| Copy shows **“Copied”** then reverts | **Not verified** in a11y tree (button label stayed “Copy packet”) |
| Download file name `Test_Coop_001.json` | **Not verified** (download not asserted in automation) |
| JSON block live update | **Not extracted** from snapshot (confirm in browser) |

### Test 1.7: Tablet (768px)

- Resized to **768×900**; setup packet and lens controls remained in snapshot.

**Result**: **Partial** — layout/readability OK at tree level; **animation disabled &lt;1024px** not visually confirmed.

### Test 1.8: Mobile (375px)

- Resized to **375×812**; hero and ritual/setup regions still present in snapshot.

**Result**: **Partial** — same limits as 1.7; horizontal scroll not measured.

---

## Part 2: Extension (Tests 2.1–2.10)

**Not executed** here. Requires **Chrome** and unpacked build:

`packages/extension/dist/chrome-mv3/`

Follow `TESTING_START_HERE` steps 4–5 and master guide Part 2 when ready.

---

## Automated workspace check

`bun run validate quick` previously **failed** at `tsc` due to `packages/app/src/hooks/__tests__/` (machine-specific absolute import to `/Users/afo/Code/greenpill/coop/...` and related test typing issues). Re-run after those tests are fixed or excluded from the typecheck project.

---

## Master guide doc drift (low)

Update `TESTING_MASTER_GUIDE_2026-03-30.md` lens names and status pills to match the product, or testers will record false failures.

---

## Issues (template)

### Issue #1: `validate quick` / typecheck fails on app hook tests

**Severity**: High  
**Test**: N/A (workspace gate)  
**Steps**: Repo root → `bun run validate quick`  
**Expected**: Typecheck + lint pass  
**Actual**: `tsc` errors under `packages/app/src/hooks/__tests__/`  
**Console**: N/A

### Issue #2: Text fields — accessible name may concatenate label + value

**Severity**: Low  
**Test**: 1.6  
**Actual**: e.g. opportunity field exposed as name including typed value  
**Expected**: Stable label in accessibility tree  

### Issue #3: Copy packet “Copied” state not visible to automation

**Severity**: Low  
**Test**: 1.6  
**Note**: Confirm visually in Chrome; may be toast-only.

---

## Manual PWA findings (Luiz — 2026-03-31)

**Build**: `3d90663`  
**Browser**: Manual pass (desktop; viewport ~1244px wide per inspector notes)

---

### Issue #4: Scroll-driven animations feel sluggish

**Severity**: Medium

**Test**: 1.2 (Landing page scroll animations — desktop)

**Steps to Reproduce**:
1. Open `http://127.0.0.1:3001` (landing) at desktop width (1024px+).
2. Scroll through story / journey sections at a normal pace.

**Expected Behavior**: Motion feels smooth and responsive to scroll.

**Actual Behavior**: Scroll-linked animation feels a bit sluggish (subjective performance / timing).

**Console Error** (if applicable): N/A

**Screenshots/Details**:
- Qualitative UX note; profile with Performance panel / FPS if fixing.

**Browser/Environment**:
- Build: `3d90663`
- OS: macOS (reported)

---

### Issue #5: Ritual flashcards — top rule lines misaligned; remove decorative dots on card bottoms

**Severity**: Low  
**Component**: PWA / ui (`section#ritual`, flashcard deck)

**Test**: 1.3 (Ritual cards — interactive)

**Steps to Reproduce**:
1. Scroll to **Curate your coop** / ritual section (`#ritual`).
2. Inspect the four lens cards (`article.flashcard`, e.g. `.flashcard-governance`).

**Expected Behavior**:
- Lines above the lens body copy align with the card layout.
- Bottom decoration is intentional and visually balanced (or omitted if noise).

**Actual Behavior**:
- Lines on top of the lens copy appear **off** (see `div.flashcard-front-top > p` for governance copy).
- `span.flashcard-action-mark` (decorative marks in `div.flashcard-front-bottom` on each card) reads as unnecessary dots; **remove** per tester feedback.

**DOM / selectors (for devs)**:
- Grid: `section#ritual … div.flashcard-grid`
- Example copy node: `article.flashcard-governance button.flashcard-front div.flashcard-front-top p` (text e.g. “Map how proposals…”).
- Marks to remove: `div.flashcard-front-bottom span.flashcard-action-mark` on each of the four cards (capital, impact, governance, knowledge class variants).

**Console Error**: N/A

**Browser/Environment**: Build `3d90663`

---

### Issue #6: “Lens” vs “ritual” naming is inconsistent

**Severity**: Low  
**Component**: PWA / copy

**Test**: 1.3 (and surrounding landing copy)

**Steps to Reproduce**:
1. Read hero / section headings and ritual section labels.

**Expected Behavior**: Single terminology (or a clear hierarchy) for “lens” vs “ritual”.

**Actual Behavior**: Copy mixes **lens** framing with **ritual** framing; feels inconsistent.

**Notes**: Align with product copy deck; update `TESTING_MASTER_GUIDE` ritual labels when finalized.

---

### Issue #7: Request — support additional rituals beyond the fixed four

**Severity**: Low (enhancement)  
**Test**: N/A (feature request)

**Expected**: Product may only ship four lenses initially.

**Actual / ask**: It would be nice to **add new rituals** (expandable set).

**Notes**: Track as roadmap / design; not a regression.

---

### Issue #8: Arrival / “Why we build” section — chickens render incorrectly (piled in top-left)

**Severity**: Medium  
**Component**: PWA / ui (`section#why-build`, `arrival-journey`)

**Test**: 1.2 (scroll journey — arrival sequence)

**Steps to Reproduce**:
1. Scroll to `section#why-build` (`journey-section arrival-journey`).
2. Observe chicken sprites during the arrival animation.

**Expected Behavior**: Chickens follow the intended motion path within the scene (not stacked in one corner).

**Actual Behavior**: Some **chickens appear wrongly piled in the top-left** of the section.

**DOM**: `section#why-build` → inner `div.journey-scene.journey-scene-arrival` (full section height ~1537px at reported width).

**Console Error**: N/A

**Browser/Environment**: Build `3d90663`

---

### Issue #9: “Why we build” team block — timing, layout, and readability

**Severity**: Medium  
**Component**: PWA / ui (`section#why-build`, team scene)

**Test**: 1.2 (related scroll-reveal animation)

**Steps to Reproduce**:
1. Scroll until `div.why-build-heading-card` and `div.why-build-scene-team` appear.
2. Observe animation timing and layout of avatars and names.

**Expected Behavior**:
- Content appears at a readable moment (not too late).
- Team has a clear **container**; avatars and names are readable without overlap.

**Actual Behavior**:
- **Animation shows up too late** (content appears late in scroll).
- Team **profiles feel too small**; **names overlap** (e.g. `.scene-team-name` for “Afolabi Aiyeloja”, “Luiz Fernando” next to `.team-avatar` spans “AA”, “LF”, “SV”).
- **Request**: dedicated container for team members with larger touch targets / typography.

**DOM hints**:
- `div.why-build-heading-card` (heading + subcopy)
- `div.why-build-scene-team` → `div.scene-team-member.scene-team-left` / `.scene-team-right-top` / `.scene-team-right-bottom` with `span.team-avatar`, `span.scene-team-name`

**Console Error**: N/A

**Browser/Environment**: Build `3d90663`

---

## Quick checklist (master guide)

### PWA

- [x] 1.1 Load / hero (mostly)
- [ ] 1.2 Full scroll animations (manual: issues #4, #8, #9 filed 2026-03-31)
- [x] 1.3 Ritual interaction (Escape + Close; doc names differ)
- [ ] 1.4 Audio (optional)
- [x] 1.5 Complete four cards
- [x] 1.6 Setup packet fields (copy/download filename = manual)
- [ ] 1.7 Tablet polish (automation partial)
- [ ] 1.8 Mobile polish (automation partial)

### Extension

- [ ] 2.1–2.10 — **Pending Chrome**
