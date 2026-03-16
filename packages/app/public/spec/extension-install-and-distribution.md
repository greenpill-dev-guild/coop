# Coop Extension Install And Distribution

Date: March 13, 2026

This public spec covers the extension install path. The fuller two-person demo and deployment guide
is in `/spec/demo-and-deploy-runbook.md`.

## Local Source Install

Recommended local defaults:

```bash
VITE_COOP_CHAIN=sepolia
VITE_COOP_ONCHAIN_MODE=mock
VITE_COOP_ARCHIVE_MODE=mock
VITE_COOP_SESSION_MODE=off
VITE_COOP_RECEIVER_APP_URL=http://127.0.0.1:3001
VITE_COOP_SIGNALING_URLS=ws://127.0.0.1:4444
```

Build and load:

```bash
bun install
bun run dev:extension
```

Optional:

```bash
bun run dev:app
bun run dev:api
```

Then in Chrome:

1. Open `chrome://extensions`.
2. Turn on `Developer mode`.
3. Click `Load unpacked`.
4. Select `packages/extension/dist`.
5. Reload after each rebuild.

## Local Extension + Production Receiver PWA

To test a local extension against the deployed receiver:

```bash
VITE_COOP_RECEIVER_APP_URL=https://<vercel-prod-domain>
VITE_COOP_SIGNALING_URLS=wss://<temporary-public-yjs-signal>
```

Rebuild the extension after changing those values so the receiver bridge can inject on the
production origin.

## Early Access Distribution

The website can distribute a zip and instructions, but it cannot silently install a Chrome
extension. Early users must still unzip it and load it through `chrome://extensions`.

Build:

```bash
bun run --filter @coop/extension build
cd packages/extension/dist
zip -r ../coop-extension.zip .
```

## Chrome Web Store Rollout

Rollout order:

1. `Unlisted`
2. `Public`

Reviewer notes should explain:

- the sidepanel entry
- passkey setup
- receiver pairing and private intake
- mock vs live modes
- bounded Smart Session limits for Green Goods actions

## Related Spec

- `/spec/demo-and-deploy-runbook.md`
