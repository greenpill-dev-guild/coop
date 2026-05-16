# Hackathon Demo — Shooting Script (60-90s)

Target: 75 seconds, hard ceiling 90. The loose-chickens hook lands in the
first 7 seconds; the `draft_application_outline` function call fires on
camera. Pre-stage everything before you hit record.

## Pre-flight (15 min before recording)

1. `git switch feature/hackathon-simplify && bun install && cd packages/extension && bun run build`.
2. Run
   `COOP_VERIFY_BROWSER=brave COOP_VERIFY_LABEL=pre-record node scripts/verify-real-chrome.cjs`
   from the repo root. Confirm the popup/sidepanel screenshots render and
   the JSON summary reports `errorsCount: 0` plus `evalProbe.ok: true`.
3. Open Brave (or another Chromium-family browser with WebGPU). Load
   `packages/extension/dist/chrome-mv3` unpacked.
4. Open the popup. Confirm copy: *"Ready to round up your loose chickens?"*
   and the **Create a Coop** button.
5. Pre-stage materials (do NOT pre-load these into the extension yet):
   - Three browser tabs of real grant pages (USDA Urban Agriculture,
     EPA Environmental Justice, NRCS Conservation Stewardship).
   - One screenshot PNG of an awkward grant-site PDF (taken with macOS
     `Cmd-Shift-4`, saved to Desktop).
   - One 12-second `.wav` voice memo recorded on phone — script:
     *"We need irrigation funding for the south plot before July. Two
     gardeners can co-write the application."*
6. Open QuickTime → New Screen Recording. Pick the Brave/browser window only.
7. Resize the browser to a clean 1280x720 frame.
8. Pre-warm Gemma 4 once in the same browser session before recording. Do
   not turn WiFi off or claim persistent offline model-cache behavior unless
   that specific dry run has been re-proven; the sandbox runs as an opaque
   origin, so persistent cache behavior is not the submission proof point.

## The 75-second take

| t (s) | Action | Voice-over |
|---|---|---|
| 0-3 | Open popup on fresh install. Hover over the loose-chickens copy. | *"Ready to round up your loose chickens?"* |
| 3-7 | Click **Create a Coop**. Type "Community Garden Grants" + brief purpose. Confirm. | *"Coop is for groups working together on opportunities they'd otherwise miss."* |
| 7-22 | Switch to first grant tab. Click extension icon → **Capture Tab**. Repeat for tabs 2 and 3. | *"I'm capturing three grant pages. Tab metadata stays local; nothing crosses the wire."* |
| 22-32 | Drag screenshot PNG into the popup (or use the **Screenshot** button on the visible tab if simpler). | *"This grant site is a PDF screenshot — Gemma 4 reads the visual directly."* |
| 32-44 | Click **Audio**, drop in or record the 12-second voice memo. If native audio proof is not captured, let the local transcript appear and keep the take moving. | *"And a meeting clip — the garden told us they need irrigation by July."* |
| 44-55 | Open the **Chickens** tab in the sidepanel. Watch the brief appear: title, deadline, eligibility, fit score, why-it-matters. | *"On-device Gemma 4 produced this brief. No cloud round-trip. Local model, local data."* |
| 55-65 | Click the **Plan next action** affordance. The `draft_application_outline` function call fires; outline sections appear. | *"And one function call — the model picks `draft_application_outline` and proposes sections to write."* |
| 65-72 | Click **Push to Coop**. Switch to the Coops tab. Show the new artifact in the feed. | *"Push to the coop, members see it in the shared feed."* |
| 72-78 | Hold on the closing frame: popup visible, Coops feed visible, chickens animation in the corner. | *"Opportunities found, captured, shared by the flock — local-first, multimodal, low-bandwidth."* |

## If something breaks mid-take

- **Gemma 4 doesn't load (`EvalError: Code generation from strings disallowed`)**:
  Stop. The sandbox CSP path regressed. Capture the extension-card errors
  panel and rerun `scripts/verify-real-chrome.cjs` before recording.
- **Native audio doesn't reach Gemma 4**:
  Keep the take. The stable submission path is local Whisper transcription
  feeding transcript text into Gemma 4. Do not claim raw audio modality in
  the video unless the hardware dry run proves it.
- **Brief doesn't appear in Chickens within 30s**: Check the agent
  diagnostics in the Roost tab (advanced mode toggle). Likely the worker
  is still warming. Re-shoot once warm.
- **Function call doesn't fire on camera**: The model picked a different
  tool. Re-prompt by editing the captured material (the action depends
  on grant-fit-scorer output). Worst case: cut to advanced-mode showing
  the tool-call payload in the Roost diagnostics — still demonstrates
  function calling, just less cinematic.

## After the take

1. Export at 1080p. Trim hard to ≤ 90 seconds.
2. Upload to Loom or YouTube (unlisted is fine).
3. Paste the URL into:
   - The Kaggle submission form.
   - `README.md` §"The Gemma 4 Good Hackathon — Submission" (replace
     the "video URL will be added here" sentence with the actual link).
4. Final smoke + store-readiness check from the repo root:
   `bun run validate smoke && bun run validate:store-readiness`.

## Submission day (Mon May 18)

- Confirm Kaggle submission form open.
- Paste repo URL: `https://github.com/greenpill-dev-guild/coop/tree/feature/hackathon-simplify`.
- Paste video URL.
- Paste 200-word entry description (cribbed from the README §"Submission").
- Attach the README write-up.
- Submit. Stop.
