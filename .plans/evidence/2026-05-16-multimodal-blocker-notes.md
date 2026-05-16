# Sat May 16 — Multimodal inference status & blocker notes

Per the brief: "Confirm text+image+audio reach Gemma 4, **or write exact
blocker notes.**" This is the blocker note. **Updated late Sat after the
initial baseline pass uncovered a deeper upstream gap.**

## Verdict (updated)

**Multimodal pipeline is HALF wired.** The read-side wiring is complete
(extract `imageUrl`/`audioUrl` from observation.payload → bridge → worker
→ `load_image`/`read_audio`). The **write-side wiring is missing — no
capture surface or observation-construction code today populates
`observation.payload.imageUrl` or `observation.payload.audioUrl`**.

The commit message of `d89f589` ("feat(agent): pipe multimodal attachments
from observation to gemma4 path") flagged this exactly:

> "Capture surfaces that want multimodal context for the demo can now
> **stamp those fields when enqueuing an observation**, without touching
> the schema for non-multimodal callers."

That stamping was never done. In production today, photo and audio
captures land in Dexie with `kind: 'photo' | 'audio'` and either binary
blobs or `transcriptText`, and `runner-skills-completion.ts:86-103`
reads `undefined` for both `imageUrl` and `audioUrl` on every observation.

## What this means for the demo

- **Text reaches Gemma 4**: yes ✓
- **Image reaches Gemma 4 as image tensor**: NO — only as stringified URL
  in the JSON-flattened prompt text
- **Audio reaches Gemma 4 as audio tensor**: NO — same; for receiver-side
  audio the prompt sees `transcriptText` (a string)

The README §"Submission" and ARCHITECTURE.md §3 both currently claim image
and audio reach Gemma 4 as native modalities via `load_image` and
`read_audio`. **That claim is aspirational, not factual,** as of the
2026-05-16 baseline build (commit `4c4849e`).

## Hidden second problem (not yet verified)

`cb34004` dropped `allow-same-origin` from the sandbox CSP because MV3
disallows the combination with `'unsafe-eval'`. Sandbox iframes without
`allow-same-origin` run as a unique opaque origin. **`blob:` URLs created
in the parent context are origin-scoped — the sandbox very likely cannot
`fetch()` them.** If a fix stamps `imageUrl = URL.createObjectURL(blob)`,
the worker's `load_image(url)` will silently fail.

Verification probe (TODO): inside `agent-sandbox.html` via Playwright,
test whether `fetch(chrome.runtime.getURL('icons/icon-128.png'))` and
`fetch(<parent-created-blob-url>)` succeed. If only chrome-extension URLs
work, the fix must use data URLs (larger postMessage payloads) or
transfer the binary across postMessage and reconstruct inside the worker.

## Sat 17:00 escalation gate — TRIGGERED

The brief's escalation: "Sat 17:00 if text+image+audio cannot reach
Gemma 4." Image and audio cannot reach Gemma 4 as native modalities.
**Escalated to the user.**

Awaiting decision among three paths:

- **A. Cut both modalities** — text-only Gemma 4 demo, walk README +
  ARCHITECTURE.md back to honest, document image+audio as roadmap.
  Cuts a never-cut item; needs user explicit OK.
- **B. Image only, audio force-cut** — per the scope-cut ladder, "audio
  polish" is on the force-cut tier; image stays never-cut. Wire image
  stamping in capture handler + verify blob transport in sandbox. ~1–2
  hours of focused work. README/ARCHITECTURE.md walk-back for audio
  only.
- **C. Both modalities** — full wire-up of image AND audio stamping plus
  transport fix for both. ~2–3 hours.

**Default if no user input**: Path B (matches the scope-cut ladder).
The user has been pinged via the chat transcript and may redirect.

## What the Sat baseline DID verify (still true)

- ✅ Service worker registers cleanly in real Chrome (extension ID
  `lffaelabglhoibcdlkoagalakpbcoakh`)
- ✅ Popup + sidepanel render with the chicken-or-egg hook copy
- ✅ Sandbox CSP fix works at runtime (`new Function('return 1')()`
  returns `1` inside `agent-sandbox.html`)
- ✅ Zero console errors across SW, popup, sidepanel, sandbox
- ✅ chrome://extensions Coop card has no errors button (Brave parallel
  run, `hasErrorButton: false`)
- ✅ `bun run validate smoke` and `bun run validate:store-readiness`
  both green
- ✅ `gemma4-bridge.test.ts` (13) + `gemma4-worker.test.ts` (3) — all 16
  bridge/worker unit tests green
- ✅ Multimodal read-side wiring is intact (the half that exists works
  correctly)

## Honest documentation impact

Regardless of A/B/C chosen, the following are out of date:

- `README.md` line 22–73 — the §"The Gemma 4 Good Hackathon — Submission"
  section claims image + audio reach Gemma 4. Must walk back to text +
  whichever modalities actually land.
- `ARCHITECTURE.md` §3 — "load_image" / "read_audio" / "round-trip text +
  image + audio in a single call" must be qualified: the call shape
  supports it, the upstream stamping does not happen yet.
