# Popup Capture Features — Complete Wiring & Polish

**Status**: ACTIVE
**Created**: 2026-03-24
**Last Updated**: 2026-03-24

## Context

Testing revealed the popup's capture features are broken or silently no-ops. Of six action buttons (Roundup, Capture Tab, Screenshot, Audio, Files, Notes), only the first three have working backend wiring. Audio/Files just open the sidepanel with no explanation. Notes persist to popup-scoped storage but never enter the draft pipeline. The chickens tab in the popup shows empty while the sidepanel displays items. No capture button has loading states, double-click prevention, or sound feedback.

**Shipping**: All at once as one body of work.

---

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Audio recording lives in **popup** (30s max, auto-save on close) | User prefers quick voice notes over sidepanel handoff. Auto-save mitigates popup-close risk. |
| 2 | Popup close during recording → auto-save partial | `beforeunload`/`visibilitychange` triggers `recorder.stop()` → saves whatever chunks exist. Better than losing the recording. |
| 3 | File picker is immediate save (no confirmation) | Same pattern as screenshot — one action, done. Minimizes friction. |
| 4 | Notes become instant drafts on Enter/+ | Creates ReceiverCapture (kind: 'link') + ReviewDraft via existing pipeline. Note becomes a reviewable chicken. |
| 5 | Soft cluck sound on every successful capture | `capture-complete` event → `coop-soft-cluck.wav`. Respects `SoundPreferences.enabled`. |
| 6 | Chicken yard pop-in with bounce animation | Scale 0→1.08→1 over 400ms, staggered 60ms. `prefers-reduced-motion` disables. |
| 7 | Single `isCapturing` flag guards all capture buttons | Background dispatches sequentially; overlapping requests race on badge/outbox. |
| 8 | File blob sent as base64 via runtime message | `chrome.runtime.sendMessage` serializes JSON. Matches existing `ReceiverSyncAsset` pattern. |
| 9 | Chickens selector falls back to showing all drafts when no member contexts resolve | No privacy boundary to enforce when there's no authenticated member. |

---

## Phase 1: Foundation

### Step 1A — Fix `selectAggregateVisibleDrafts` empty-list bug

**File**: `packages/extension/src/views/shared/dashboard-selectors.ts`

Root cause: `selectAllMemberContexts` returns empty when `authSession.primaryAddress` is null (pre-passkey or mock mode). All receiver-type drafts get filtered out.

Fix: When `memberContexts` is empty, return all drafts unfiltered — no privacy boundary exists to enforce.

```typescript
if (memberContexts.length === 0) {
  return dashboard.drafts;
}
```

### Step 1B — Add `isCapturing` loading state + re-entrancy guard

**Files**:
- `packages/extension/src/views/shared/useCaptureActions.ts` — add `isCapturing` boolean, wrap all actions in try/finally, early-return guard, return `isCapturing`
- `packages/extension/src/views/Popup/hooks/usePopupOrchestration.ts` — expose `isCapturing` on state
- `packages/extension/src/views/Popup/PopupHomeScreen.tsx` — `disabled={isCapturing}` on all 5 capture buttons + note save
- `packages/extension/src/views/Popup/PopupDraftListScreen.tsx` — `disabled` on Roundup button

### Step 1C — Add `capture-complete` sound event

**Files**:
- `packages/shared/src/contracts/schema.ts` — add `'capture-complete'` to `soundEventSchema` enum
- `packages/shared/src/modules/app/sound.ts` — add `soundPattern` case (two-note ascending chirp: 523→659 Hz)
- `packages/shared/src/modules/app/playback.ts` — add `soundFileMap` entry → `coop-soft-cluck.mp3` at 0.55 volume
- `packages/extension/src/runtime/audio.ts` — add `soundFiles['capture-complete']` → `coop-soft-cluck.wav` at 0.55

### Step 1D — New runtime message types + background handlers

**File**: `packages/extension/src/runtime/messages.ts` — add to `RuntimeRequest` union:
- `capture-file` → `{ fileName, mimeType, dataBase64, byteSize }`
- `create-note-draft` → `{ text }`
- `capture-audio` → `{ dataBase64, mimeType, durationSeconds, fileName }`

**File**: `packages/extension/src/background.ts` — add 3 new case branches

**File**: `packages/extension/src/background/handlers/capture.ts` — add 3 new handlers:

**`captureFile(payload)`**: decode base64 → Blob → validate size (10MB max via `assertReceiverCaptureSize`) → get coop/member context (same as `captureVisibleScreenshot`) → `createReceiverCapture({ kind: 'file', ... })` → `saveReceiverCapture()` → `refreshBadge()` → return capture

**`createNoteDraft(payload)`**: validate non-empty → create text Blob → `createReceiverCapture({ kind: 'link', title: text, note: text })` → save capture → `createReceiverDraftSeed({ capture, workflowStage: 'candidate' })` → `saveReviewDraft()` → link capture to draft → `refreshBadge()` → return draft

**`captureAudio(payload)`**: decode base64 → Blob → validate size (25MB max) → `createReceiverCapture({ kind: 'audio', ... })` → save → async Whisper transcription (fire-and-forget: `isWhisperSupported()` → `transcribeAudio()` → `saveCoopBlob({ kind: 'audio-transcript' })`) → `refreshBadge()` → return capture

**Existing code to reuse**: `createReceiverCapture()`, `saveReceiverCapture()`, `createReceiverDraftSeed()`, `saveReviewDraft()`, `assertReceiverCaptureSize()`, `extensionCaptureDeviceId`, `getActiveReviewContextForSession()`, `resolveReceiverPairingMember()`, `isWhisperSupported()`, `transcribeAudio()`, `saveCoopBlob()` — all from `@coop/shared` or existing capture.ts helpers.

---

## Phase 2: Capture Features

### Step 2A — File capture (popup inline file picker)

**UX**: Click "Files" → OS file picker → file selected → validate size → immediate save → toast + sound

**Files**:
- `packages/extension/src/views/Popup/PopupHomeScreen.tsx` — add hidden `<input type="file" ref={fileInputRef}>`, wire "Files" button to `fileInputRef.current?.click()`, `onChange` reads file
- `packages/extension/src/views/shared/useCaptureActions.ts` — add `captureFile(file: File)`: read to base64, validate ≤10MB, send `capture-file` message, play sound
- `packages/extension/src/views/Popup/PopupScreenRouter.tsx` — change `onOpenFiles` from `openWorkspace()` to `captureActions.captureFile` trigger
- `packages/extension/src/views/Popup/hooks/usePopupOrchestration.ts` — wire file input onChange through to capture action

**Error states**:
| Condition | Toast |
|-----------|-------|
| File > 10MB | "This file is too large — 10 MB maximum." |
| User cancels picker | No toast |
| Background save fails | "Could not capture file — try again." |

### Step 2B — Notes → instant draft pipeline

**UX**: Type note → Enter or + → field clears → toast "Note hatched into your roost." → chicken in yard

**Files**:
- `packages/extension/src/views/shared/useCaptureActions.ts` — add `createNoteDraft(text: string)`: send `create-note-draft` message, play sound
- `packages/extension/src/views/Popup/hooks/usePopupOrchestration.ts` — rewrite `handleSaveNote()`: call `captureActions.createNoteDraft(noteDraftText)`, on success clear `noteDraftText` + `homeNote` state, on failure preserve text

Keep `usePersistedPopupState('coop:popup-home-note')` for auto-save while typing (survives popup close/reopen). The Enter/+ action now creates a real draft instead of just persisting the text.

### Step 2C — Audio recording in popup (30s max, auto-save on close)

**Architecture**: Record directly in popup using MediaRecorder. 30s max timer. Auto-save partial recording on popup close via `beforeunload`/`visibilitychange`.

**UX Flow**:
1. Click "Audio" → request mic permission
2. Permission granted → show inline recording UI (replaces action grid area):
   - Pulsing red dot + timer (mm:ss / 00:30)
   - [Save] + [Cancel] buttons
   - Brief warning: "Keep popup open while recording"
3. Recording auto-stops at 30s → auto-save
4. User clicks Save → save → toast + sound → recording UI dismissed
5. User clicks Cancel → discard → "Recording canceled."
6. Popup closes unexpectedly → `beforeunload` → `recorder.stop()` → save partial
7. Next popup open: toast "Partial voice note saved ({n}s)"

**Implementation**:

New hook: `packages/extension/src/views/Popup/hooks/usePopupRecording.ts`
- Port from `packages/app/src/hooks/useCapture.ts` lines 262-379 (MediaRecorder + WakeLock pattern)
- Add 30s max timer (`setTimeout` → auto-stop)
- Add `beforeunload` + `visibilitychange` listeners → `recorder.stop()` on unexpected close
- `onstop` → build Blob → send `capture-audio` message to background
- Expose: `{ isRecording, elapsedSeconds, startRecording, stopRecording, cancelRecording }`

New component section in `PopupHomeScreen.tsx`:
- When `isRecording`, replace the action grid with recording UI
- Pulsing dot via CSS animation (`@keyframes recording-pulse`)
- Timer display
- Save + Cancel buttons

**File**: `packages/extension/src/views/Popup/PopupScreenRouter.tsx` — change `onOpenAudio` from `openWorkspace()` to `startRecording` trigger

**Error states**:
| Condition | Toast |
|-----------|-------|
| Mic denied | "Microphone access denied — check browser permissions." |
| MediaRecorder unsupported | "This browser cannot record audio." |
| Popup closes mid-recording | Auto-save, next open: "Partial voice note saved ({n}s)" |
| Blob > 25MB | "Recording too long — try a shorter note." (shouldn't happen with 30s limit) |
| Whisper unavailable | Silent — capture still saved, no transcript. Non-blocking. |

---

## Phase 3: Visual Polish

### Step 3A — Chicken yard pop-in animation

**File**: `packages/extension/src/views/Popup/popup.css`
```css
@keyframes chicken-enter {
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
  60%  { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
  100% { transform: translate(-50%, -50%) scale(1); }
}
.popup-yard__chicken { animation: chicken-enter 400ms ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .popup-yard__chicken { animation: none; }
}
```

**File**: `PopupHomeScreen.tsx` — add `style={{ animationDelay: \`${i * 60}ms\` }}` per chicken

### Step 3B — Draft/feed list entry animations

**File**: `popup.css`
```css
@keyframes list-item-enter {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.popup-draft-row, .popup-activity-row {
  animation: list-item-enter 250ms ease-out both;
}
```

Stagger via `animationDelay` based on index in `PopupDraftListScreen` and `PopupFeedScreen`.

### Step 3C — Sound integration on all capture actions

**File**: `packages/extension/src/views/shared/useCaptureActions.ts`

Add `soundPreferences: SoundPreferences` to deps. After each successful action:
```typescript
void playCoopSound('capture-complete', soundPreferences).catch(() => {});
```

Thread `dashboard?.soundPreferences` from `usePopupOrchestration`.

### Step 3D — Toast messaging cleanup

| Action | Success | Error |
|--------|---------|-------|
| Roundup | "Rounded up {n} tabs." | "Roundup failed — try again." |
| Capture Tab | "Tab captured." | "Could not capture this tab." |
| Screenshot | "Screenshot snapped." | "Could not take screenshot — open a regular web page first." |
| File | "File captured." | "Could not capture file — [reason]." |
| Note | "Note hatched into your roost." | "Could not save note — try again." |
| Audio (save) | "Voice note saved." | "Could not save recording." |
| Audio (partial) | "Partial voice note saved ({n}s)." | — |
| Audio (cancel) | "Recording canceled." | — |

### Step 3E — Recording pulse animation

**File**: `popup.css`
```css
@keyframes recording-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.popup-recording__dot {
  animation: recording-pulse 1.2s ease-in-out infinite;
}
```

---

## Phase 4: Testing & Verification

### Unit tests
- `captureFile()` handler: valid file, oversized file (>10MB), missing coop context
- `createNoteDraft()` handler: valid text, empty text rejection
- `captureAudio()` handler: valid audio, Whisper integration (mock)
- `selectAggregateVisibleDrafts`: regression test — returns receiver drafts when memberContexts empty
- `useCaptureActions` re-entrancy: verify `isCapturing` prevents concurrent calls

### Visual verification in Chrome
1. All 6 buttons functional
2. Loading state disables buttons during capture
3. Chicken yard shows new chickens with bounce animation
4. Toast messages display correct brand language
5. Soft cluck plays on every capture completion
6. File picker → immediate save
7. Note Enter → field clears → chicken appears
8. Audio → recording UI → save → chicken appears
9. Audio → close popup mid-recording → partial save → next open shows toast
10. Rapid double-click → only one action fires
11. Chickens tab populated (including receiver-type drafts)

---

## Implementation Sequence

| Order | Step | Files | Notes |
|-------|------|-------|-------|
| 1 | 1A — Fix selector | 1 | Smallest fix, immediate impact |
| 2 | 1B — Loading states | 4 | Foundation for all features |
| 3 | 1C — Sound event | 4 | Small shared change |
| 4 | 1D — Message types + handlers | 3 | Backbone for 2A-2C |
| 5 | 2B — Notes pipeline | 2 | Leverages existing infra |
| 6 | 2A — File capture | 4 | Straightforward once 1D exists |
| 7 | 2C — Audio recording | 4 | Largest scope (new hook + UI) |
| 8 | 3A-3E — Polish | 3 | Animations, sound, toasts |
| 9 | 4 — Tests | 3+ | Verify everything |

---

## Files to Modify

| File | Changes |
|------|---------|
| `shared/src/contracts/schema.ts` | Add `capture-complete` to soundEventSchema |
| `shared/src/modules/app/sound.ts` | Sound pattern for capture-complete |
| `shared/src/modules/app/playback.ts` | soundFileMap entry |
| `extension/src/runtime/audio.ts` | soundFiles entry |
| `extension/src/runtime/messages.ts` | 3 new RuntimeRequest variants |
| `extension/src/background.ts` | 3 new case branches |
| `extension/src/background/handlers/capture.ts` | `captureFile()`, `createNoteDraft()`, `captureAudio()` |
| `extension/src/views/shared/useCaptureActions.ts` | Loading state, 4 new methods, sound integration |
| `extension/src/views/shared/dashboard-selectors.ts` | Fix aggregate selector fallback |
| `extension/src/views/Popup/PopupHomeScreen.tsx` | File input, recording UI, disabled states, animations |
| `extension/src/views/Popup/PopupScreenRouter.tsx` | Update onOpenAudio/onOpenFiles wiring |
| `extension/src/views/Popup/hooks/usePopupOrchestration.ts` | Thread isCapturing, rewrite handleSaveNote |
| `extension/src/views/Popup/PopupDraftListScreen.tsx` | Disabled state on roundup button |
| `extension/src/views/Popup/popup.css` | Entry animations, recording pulse |

## Files to Create

| File | Purpose |
|------|---------|
| `extension/src/views/Popup/hooks/usePopupRecording.ts` | MediaRecorder hook (port from PWA useCapture) |
