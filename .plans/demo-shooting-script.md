# Hackathon Demo — Shooting Script (60-90s)

Target: 75 seconds, hard ceiling 90. The chicken-or-egg hook lands in the
first 7 seconds; the `draft_application_outline` function call fires on
camera. Pre-stage everything before you hit record.

## Pre-flight (15 min before recording)

1. `git switch feature/hackathon-simplify && bun install && cd packages/extension && bun run build`.
2. **CSP mitigation choice (REQUIRED before Gemma 4 will load):**
   - Open `packages/extension/wxt.config.ts` and try setting:
     `extension_pages: "script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval'; object-src 'self'"`.
     Rebuild. If Chrome rejects manifest at install with "unsafe-eval is not
     permitted", fall back to running the agent worker inside a sandboxed
     iframe (in which case the demo is blocked and the brief's Day-1 EOD
     escalation has hit).
   - If the relaxed CSP installs cleanly (developer mode is more lenient),
     proceed. The worker will load Gemma 4 the first time the agent runs.
3. Open Chrome Canary on a fresh profile. Load `dist/chrome-mv3` unpacked.
4. Open the popup. Confirm copy: *"Chicken or egg? Neither — you need a
   coop first."* and the **Launch the Coop** button.
5. Pre-stage materials (do NOT pre-load these into the extension yet):
   - Three browser tabs of real grant pages (USDA Urban Agriculture,
     EPA Environmental Justice, NRCS Conservation Stewardship).
   - One screenshot PNG of an awkward grant-site PDF (taken with macOS
     `Cmd-Shift-4`, saved to Desktop).
   - One 12-second `.wav` voice memo recorded on phone — script:
     *"We need irrigation funding for the south plot before July. Two
     gardeners can co-write the application."*
6. Open QuickTime → New Screen Recording. Pick the Chrome window only.
7. Resize Chrome to a clean 1280x720 frame.
8. Verify offline-capable claim: pre-warm Gemma 4 once (open the agent
   diagnostics, force a refine to download the model). Then disable WiFi
   for the actual recording so the model loads from local cache.

## The 75-second take

| t (s) | Action | Voice-over |
|---|---|---|
| 0-3 | Open popup on fresh install. Hover over the chicken-or-egg copy. | *"Chicken or egg? Neither — you need a coop first."* |
| 3-7 | Click **Launch the Coop**. Type "Community Garden Grants" + brief purpose. Confirm. | *"Coop is for groups working together on opportunities they'd otherwise miss."* |
| 7-22 | Switch to first grant tab. Click extension icon → **Capture Tab**. Repeat for tabs 2 and 3. | *"I'm capturing three grant pages. Tab metadata stays local; nothing crosses the wire."* |
| 22-32 | Drag screenshot PNG into the popup (or use the **Screenshot** button on the visible tab if simpler). | *"This grant site is a PDF screenshot — Gemma 4 reads the visual directly."* |
| 32-44 | Click **Audio**, drop in or record the 12-second voice memo. | *"And a meeting clip — the garden told us they need irrigation by July."* |
| 44-55 | Open the **Chickens** tab in the sidepanel. Watch the brief appear: title, deadline, eligibility, fit score, why-it-matters. | *"On-device Gemma 4 produced this brief. No cloud round-trip. Local model, local data."* |
| 55-65 | Click the **Plan next action** affordance. The `draft_application_outline` function call fires; outline sections appear. | *"And one function call — the model picks `draft_application_outline` and proposes sections to write."* |
| 65-72 | Click **Push to Coop**. Switch to the Coops tab. Show the new artifact in the feed. | *"Push to the coop, members see it in the shared feed."* |
| 72-78 | Hold on the closing frame: popup visible, Coops feed visible, chickens animation in the corner. | *"Opportunities found, captured, shared by the flock — local-first, offline, multimodal, low-bandwidth."* |

## If something breaks mid-take

- **Gemma 4 doesn't load (`EvalError: Code generation from strings disallowed`)**:
  Stop. The CSP mitigation chosen in pre-flight didn't take. This is the
  brief's Fri-EOD escalation moment. Decide between (a) sandboxed-iframe
  refactor or (b) cutting back to text-only Gemma 4 path with a written
  caveat in the README.
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
   - `README.md` §"The Gemma 4 Good Hackathon — Submission" (search
     for `referenced from the Kaggle submission entry` and replace with
     the actual URL).
4. Final smoke + store-readiness check from the repo root:
   `bun run validate smoke && bun run validate:store-readiness`.

## Submission day (Mon May 18)

- Confirm Kaggle submission form open.
- Paste repo URL: `https://github.com/greenpill-dev-guild/coop/tree/feature/hackathon-simplify`.
- Paste video URL.
- Paste 200-word entry description (cribbed from the README §"Submission").
- Attach the README write-up.
- Submit. Stop.
