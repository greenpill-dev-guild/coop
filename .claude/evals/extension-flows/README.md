# Extension Flow Evals

GUI evals for Coop's extension-first product loop. These are durable
manual/agent-run scenarios, not unit tests. They are intended for Codex Computer
Use, Claude Computer Use, the Codex Chrome extension, or a human watching a real browser.

## Scope

In scope:

- Unpacked MV3 extension in Brave or another Chromium-family browser.
- Popup first-run state, sidepanel simple mode, Chickens review, and advanced gates.
- Real rendered proof: popup screenshot, sidepanel screenshot, extension-card errors, and notes.
- Gemma sandbox health and CSP/runtime regression checks.

Out of scope for this folder:

- Receiver PWA onboarding, mobile capture UX, and install prompts.
- Authenticated Kaggle, YouTube, Loom, or production deployment surfaces.
- Unit-test-only proof.

## Tool Routing

- Use Computer Use or a real headed Chromium-family browser for unpacked extension popup,
  sidepanel, extension-card errors, `activeTab`, screenshot capture, and OS/browser permission
  checks.
- Use the Codex Chrome extension when the eval depends on a signed-in Chrome profile.
- Use Codex Browser / Browser Use for local receiver PWA or docs routes that do not need extension
  state. Those flows belong in receiver/app runbooks, not this extension-flow folder.
- Use Playwright mirrors only as repeatable guardrails. A headless pass does not replace extension
  card, popup grant, or real GUI evidence.

## Shared Setup

From repo root:

```bash
cd packages/extension && bun run build
COOP_VERIFY_BROWSER=brave COOP_VERIFY_LABEL=<eval-slug> node scripts/verify-real-chrome.cjs
```

Then use the same headed browser session, or load
`packages/extension/dist/chrome-mv3` as an unpacked extension in a clean
Chromium-family profile.

## Evidence Contract

For every run, capture:

- Browser and profile used.
- Commit hash under test.
- Popup screenshot.
- Sidepanel screenshot.
- `chrome://extensions` or `brave://extensions` Coop card state, including whether an error button/panel is visible.
- Console/service-worker errors if any.
- Pass/fail score and proof limits.
- For multimodal Gemma runs: explicit text, image, and audio proof status.

Use `.plans/evidence/` for screenshots and JSON summaries when the user wants
the evidence committed. Otherwise keep generated artifacts out of git.
Record durable outcomes in `.claude/evals/results.md` using the Computer-Use
Run Template.

## GUI Runner Prompt

```text
Run the named Coop extension-flow eval from .claude/evals/extension-flows.
Use Computer Use, the Codex Chrome extension, or a real headed Brave/Chromium-family browser with
the unpacked extension. Do not claim success from unit tests, Browser-only localhost checks, or a
headless-only run. Capture popup, sidepanel, and extension-card error evidence. Keep receiver PWA
flows out of scope unless the eval explicitly asks for them. Report score, failures, and proof
limits.
```

## Local Fixture Pages

Some evals use deterministic local grant pages. Serve them over HTTP because
extension tab capture only supports `http://` and `https://` URLs:

```bash
python3 -m http.server 8765 --directory .claude/evals/extension-flows/fixtures
```

Fixture URLs:

- `http://127.0.0.1:8765/garden-grants.html`
- `http://127.0.0.1:8765/watershed-resilience.html`
- `http://127.0.0.1:8765/solar-coop.html`
