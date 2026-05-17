# Receiver PWA Browser + Computer Use QA

This runbook keeps receiver PWA QA Browser-first. OpenAI's current Codex guidance says to use the
in-app Browser for local development servers and file-backed previews, and to use Computer Use only
when a flow depends on a graphical desktop/browser state that Browser cannot represent.

Reference: [In-app browser](https://developers.openai.com/codex/app/browser) and
[Computer Use](https://developers.openai.com/codex/app/computer-use).

Use the local dev preview switch so an agent can inspect Mate, Hatch, and Roost without installing
the PWA. Escalate to Computer Use only for installed-PWA checks, real OS media prompts, browser
shell behavior, or cross-app flows.

## Start Local Preview

```bash
bun run dev:pwa
```

Open these routes in the browser:

```text
http://127.0.0.1:3001/app/pair?presentation=pwa
http://127.0.0.1:3001/app/receiver?presentation=pwa
http://127.0.0.1:3001/app/inbox?presentation=pwa
```

Normal browser visits to `/app/*` without `presentation=pwa` should redirect to `/`. That remains
the production boundary: browser website first, installed PWA under `/app`.

## Dev QA Params

These params only work on a local hostname and require `presentation=pwa`.

| Param | Effect |
| --- | --- |
| `qa=reset` | Clears local receiver pairing/capture QA state. |
| `qa=seed-empty` | Clears receiver state and leaves the app empty. |
| `qa=seed-captures` | Seeds audio, photo, and link captures. |
| `qa=seed-failed-sync` | Seeds captures plus one paired failed-sync file. |
| `qa=mock-media` | Makes audio recording save a mock voice note without OS mic prompts. |

Params can be combined:

```text
http://127.0.0.1:3001/app/receiver?presentation=pwa&qa=seed-failed-sync,mock-media
```

## Browser-First QA Prompt

```text
You are QA testing the Coop receiver PWA. Do not edit code.

Start the local app with:
bun run dev:pwa

Use Browser to open:
http://127.0.0.1:3001/app/receiver?presentation=pwa&qa=seed-empty,mock-media

Use viewport 390x844.

Evaluate:
1. Hatch renders, not the public landing.
2. No vertical scrolling is needed.
3. Record is the primary action.
4. Take photo and Attach file are visible beneath Record.
5. Bottom nav is visible and does not overlap controls.
6. Status summary is compact and tappable.
7. No install nudge appears inside receiver chrome.
8. Clicking Record shows Save voice note and Cancel.
9. Clicking Save voice note updates the last-saved strip.

Return PASS or FAIL with viewport, route, visible screen, failed checks, and screenshot evidence if
available.
```

## When To Use Computer Use

Use Computer Use instead of Browser only when the eval needs a GUI boundary Browser cannot cover:

- Installed PWA launch/chrome and Add to Home Screen behavior.
- Real microphone, camera, or file-picker prompts instead of `qa=mock-media`.
- A signed-in or profiled browser surface.
- Cross-app flows that require moving between browser, Finder, system prompts, or another desktop
  app.

When using Computer Use, keep the target app and flow narrow, record the browser/profile or app
used, and capture the same PASS/FAIL evidence as the Browser prompt.

## Eval JSON

```json
{
  "testId": "receiver-hatch-390",
  "status": "pass",
  "viewport": "390x844",
  "route": "/app/receiver?presentation=pwa&qa=seed-empty,mock-media",
  "checks": {
    "hatchVisible": true,
    "publicChromeAbsent": true,
    "noVerticalScroll": true,
    "recordPrimary": true,
    "mediaSecondaryVisible": true,
    "bottomNavReachable": true,
    "installNudgeAbsent": true,
    "mockAudioSaveWorks": true
  },
  "failures": [],
  "notes": ""
}
```

## Automated Mirror

Run the Playwright mirror of the Browser-first criteria:

```bash
bun run test:e2e:receiver-pwa-eval
```

The script starts the app web server only; it does not require the API server because these checks
exercise local receiver UI, routing, fixtures, and media capture behavior.

It checks:

- `/app/*` browser boundary redirects to `/`.
- Public install education opens from the public site.
- Hatch fits at `320x568`, `360x640`, `390x844`, and `430x932`.
- Mock audio capture saves without OS media prompts.
- Mate keeps QR primary and paste disclosure collapsed.
- Roost exposes failed-only Retry plus More actions for secondary utilities.
