# Extension Flow Eval: Gemma Sandbox and Runtime Health

**Status**: ready
**Last run**: —
**Last score**: —

## Scenario

Validate the extension runtime path that previous static gates missed:

> Load the built extension in a real Chromium-family browser and prove the
> Gemma sandbox, popup, sidepanel, and extension-card error state are clean.

## Setup

From repo root:

```bash
cd packages/extension && bun run build
COOP_VERIFY_BROWSER=brave COOP_VERIFY_LABEL=extension-flow-gemma node scripts/verify-real-chrome.cjs
```

If Brave is unavailable, use `COOP_VERIFY_BROWSER=chrome` or
`COOP_VERIFY_BROWSER=chromium` and record the browser used.

## Steps

1. Run the command above in headed mode.
2. Confirm summary JSON reports:
   - `errorsCount: 0`
   - `evalProbe.ok: true`
   - a non-empty extension id
3. Open the popup screenshot and confirm it rendered.
4. Open the sidepanel screenshot and confirm it rendered.
5. Inspect `brave://extensions` or `chrome://extensions`.
6. Confirm the Coop extension card does not show an error button or error panel.
7. If testing multimodal hardware proof, trigger one text/image/audio demo run and record whether native audio was proven or only transcript-to-Gemma was proven.

## Expected Behavior

- Built extension loads as unpacked MV3.
- Sandbox CSP probe succeeds.
- Popup and sidepanel render without blank screens.
- No service-worker registration failure is visible in the browser extension UI.
- Gemma/audio claims stay truthful: native audio is claimed only when the real run proves it.

## Failure Conditions

- Build succeeds but real browser load fails.
- Popup or sidepanel screenshot is blank.
- Sandbox CSP probe fails.
- Extension-card errors are visible.
- Eval report claims native Gemma audio without runtime evidence.

## Scoring

| Score | Criteria |
|-------|----------|
| 3 | Real browser proof, rendered screenshots, clean errors, CSP probe green |
| 2 | Runtime is clean but one screenshot or evidence artifact is missing |
| 1 | Browser loads but sandbox, popup, or sidepanel has a blocking issue |
| 0 | Extension cannot be loaded or verified in a real browser |
