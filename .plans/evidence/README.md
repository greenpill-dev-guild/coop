# Runtime evidence — Gemma 4 sandbox CSP fix

This directory contains runtime proof points for the hackathon submission.

## 2026-05-16 — Sat baseline real-Chrome verification (CLEAN)

Two complementary baseline runs converge on the same conclusion: extension
loads cleanly with sandbox CSP applied, zero errors anywhere, hook copy
renders. Extension ID `lffaelabglhoibcdlkoagalakpbcoakh` in both runs.

### Run A — Playwright + Chromium-family browser, sandbox eval probe

Captured via `node scripts/verify-real-chrome.cjs` — headed Playwright,
Brave-first on this machine with Chrome/Chromium fallback, real SW
registration.

| Artifact | Path |
|---|---|
| Popup (hook copy + Create a Coop CTA) | `2026-05-16-popup-baseline.png` |
| Sidepanel (welcome screen, hook copy) | `2026-05-16-sidepanel-baseline.png` |
| Sandbox iframe (host has no UI — blank screenshot is expected) | `2026-05-16-sandbox-baseline.png` |
| Run summary (eval probe, errors, ext ID) | `2026-05-16-runtime-summary-baseline.json` |

Summary results: `evalProbe: {ok: true, value: 1}` → **sandbox CSP fix works**
(`new Function()` is allowed inside `agent-sandbox.html`); `errorsCount: 0`
across SW + popup + sidepanel + sandbox.

### Run B — Real-browser verification with chrome://extensions errors panel

Captured by a parallel verification run using Brave Browser (Chromium-based).
Walks the full `chrome://extensions` flow and DOM-inspects the extension card
for any errors button.

| Artifact | Path |
|---|---|
| Popup rendering (hook copy) | `2026-05-15-baseline-popup-rendering.png` |
| Sidepanel rendering (hook copy) | `2026-05-15-baseline-sidepanel-rendering.png` |
| chrome://extensions Coop card (no errors button) | `2026-05-15-baseline-extensions-errors-panel.png` |
| Run report (errorsEmpty, extension card state) | `2026-05-15-baseline-chrome-baseline-report.json` |

Report results: `errorsEmpty: true`, `extensionCard.hasErrorButton: false`,
`serviceWorkerStillRegistered: true`. The chrome://extensions card screenshot
shows the Coop v1 extension card with no errors panel surfaced — the brief's
"errors panel is clean" check is satisfied.

## Sat 12:00 PDT escalation check — PASS

Per the brief:

- ✅ Unpacked Chromium-family browser load is clean (extension ID stable across runs)
- ✅ Popup renders with hook copy
- ✅ SW errors panel is clean (no errors button on the extension card)

## Still pending: final multimodal inference round-trip

The Sat baseline confirms the **rendering and CSP path are clean** but does
not confirm Gemma 4 actually completes a text+image+audio inference. The
multimodal pipeline is statically verified:

- `runner-skills-completion.ts` extracts `imageUrl`, `audioUrl`,
  `audioSamplingRate` from the observation payload and propagates them
  through `completeSkillOutput`.
- Receiver photo and audio captures are lazily loaded from IndexedDB and
  converted to sandbox-safe `data:` URLs before Gemma 4 completion.
- `gemma4-worker.ts:143-157` calls `load_image(imageUrl)` and
  `read_audio(audioUrl, samplingRate ?? 16000)` and passes both to
  `processor()` alongside the text prompt.
- `gemma4-bridge.ts:14-24` declares the request shape that includes all three
  modalities.
- `packages/extension/src/runtime/agent/__tests__/runner-skills-completion.test.ts`
  proves audio captures forward as `data:audio/...` with a 16 kHz sampling
  rate default.
- All 16 bridge/worker unit tests pass; `bun run validate smoke` and
  `bun run validate:store-readiness` are green.

The final runtime confirmation still requires:

1. Brave or another Chromium-family browser with stable WebGPU, OR
2. A focused Playwright script that drives the demo arc (seed coop, attach
   image + audio, trigger agent cycle), accepting that the first run
   triggers a large Gemma 4 E2B model download.

Sun May 17 dry run is when this is captured (see `.plans/demo-shooting-script.md`
for the staging plan).

## Stash recovery

The pre-cleanup main-branch stragglers (`.claude/`, `.codex/`, `AGENTS.md`,
`CLAUDE.md`, 4 extension test/UI files) are stashed:

```
stash@{0}: agent-infra + extension WIP carried over from main (2026-05-15 pre-hackathon cleanup)
```

Recover with `git stash apply stash@{0}` on a fresh `chore/agent-infra`
branch off `main` if/when they need to land.

## How to reproduce

```bash
cd packages/extension && bun run build      # ~107s
cd ../.. && COOP_VERIFY_BROWSER=brave node scripts/verify-real-chrome.cjs
```

The script writes evidence to this directory, captures console errors, and
exits non-zero if anything is broken. Run with `COOP_VERIFY_LABEL=foo` to
suffix the artifact filenames.
