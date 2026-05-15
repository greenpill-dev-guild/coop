# Runtime evidence — Gemma 4 sandbox CSP fix

This directory should contain the runtime proof points the goal asked for.

## Why it's empty right now

I tried to verify the sandbox CSP at runtime via Playwright headless Chromium
(see `.plans/i-would-like-your-smooth-whistle.md` for the goal brief). Three
attempts hit the same wall: headless Chromium on this macOS environment does
not register the MV3 service worker. `context.waitForEvent('serviceworker')`
times out at 180 s with `workers=0`. The existing `e2e/extension.spec.cjs`
shows the same symptom on first launch. Headless MV3 SW registration is a
known Playwright/Chromium intermittent; it's an environment problem, not a
problem with the sandbox fix.

## What IS verified statically

- `dist/chrome-mv3/manifest.json` writes both
  `content_security_policy.sandbox` and `sandbox.pages` correctly
  (`grep -o '"sandbox":' dist/chrome-mv3/manifest.json | wc -l` → 2)
- `dist/chrome-mv3/agent-sandbox.html` exists and loads the sandbox host
  module
- `dist/chrome-mv3/chunks/agent-sandbox-*.js` is 3 kB and dynamic-imports
  the transformers chunk on first `init` message
- The old `agent-gemma4-worker.js` is gone (no Worker path remains)
- `bun run validate smoke` + `bun run validate:store-readiness` both green
- `bun run test` — 3817 passed, 11 skipped, 0 failed
- `packages/extension/src/__tests__/sw-safety.test.ts` — no top-level
  `new Worker()` in the background graph after the refactor

## What the user needs to verify on real Chrome (≤5 min)

1. `git switch feature/hackathon-simplify`
2. `cd packages/extension && bun run build`
3. Open Chrome (Canary or Beta — stable WebGPU). Visit `chrome://extensions`.
4. Toggle Developer mode → "Load unpacked" → choose
   `packages/extension/dist/chrome-mv3`.
5. Confirm the extension ID. Open the service worker DevTools (the "service
   worker" link on the extension card).
6. In the SW console, run:
   ```js
   chrome.runtime.getURL('agent-sandbox.html')
   ```
   Copy the resulting URL.
7. Open a new tab and navigate to that URL. Open DevTools on the sandbox
   page. In the Console, run:
   ```js
   try { new Function('return 1')(); console.log('eval OK') }
   catch (e) { console.log('eval BLOCKED:', e.message) }
   ```
8. **Expected:** `eval OK`. If you see `Code generation from strings
   disallowed`, the sandbox CSP isn't being applied and the fix is broken
   (escalate per the brief).
9. Save a screenshot of the DevTools console showing `eval OK` to this
   directory as `sandbox-eval-ok.png`.
10. Open the sidepanel, launch a coop, capture a tab. Force the agent to
    run Gemma 4 (paste a grant page URL into the chickens flow). Wait for
    the brief to render in the Chickens tab. Save a screenshot of the
    brief as `chickens-gemma4-brief.png`.

If step 10 also produces a brief without an `EvalError` in the offscreen
DevTools, the runtime fix is confirmed end-to-end.

## Stash recovery

The pre-cleanup main-branch stragglers (`.claude/`, `.codex/`, `AGENTS.md`,
`CLAUDE.md`, 4 extension test/UI files) are stashed:

```
stash@{0}: agent-infra + extension WIP carried over from main (2026-05-15 pre-hackathon cleanup)
```

Recover with `git stash apply stash@{0}` on a fresh `chore/agent-infra`
branch off `main` if/when they need to land.
