---
title: "Extension Install & Distribution"
sidebar_label: "Install Extension"
sidebar_position: 1
---

# Coop Extension Install And Distribution

Date: March 13, 2026

This document covers extension-specific install and rollout. The full local demo, peer pairing, and
production deployment flow lives in [demo-and-deploy-runbook.md](../guides/demo-and-deploy-runbook).

## Local Developer Install

Use the repo-root `.env.local`. Do not create package-specific env files.

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

Optional supporting processes:

```bash
bun run dev:app
bun run dev:api
```

Then in Chrome:

1. Open `chrome://extensions`.
2. Turn on `Developer mode`.
3. Click `Load unpacked`.
4. Select `packages/extension/dist`.
5. Reload the extension after each rebuild.

## Local Extension + Production PWA

This is the preferred peer-demo mode when the extension is still under active development.

Set:

```bash
VITE_COOP_RECEIVER_APP_URL=https://<vercel-prod-domain>
VITE_COOP_SIGNALING_URLS=wss://<temporary-public-yjs-signal>
```

Then rebuild the extension and reload it in Chrome. The receiver bridge content script is patched at
build time so the extension can inject on the configured production PWA origin.

## Early Access Distribution

For trusted testers outside the Chrome Web Store:

1. Build the extension.
2. Zip the contents of `packages/extension/dist`.
3. Share the archive plus manual install instructions.

Commands:

```bash
bun run --filter @coop/extension build
cd packages/extension/dist
zip -r ../coop-extension.zip .
```

Early-access users still need to:

1. download the archive
2. unzip it locally
3. open `chrome://extensions`
4. turn on `Developer mode`
5. click `Load unpacked`
6. choose the extracted folder

## Chrome Web Store Rollout

Use this order:

1. `Unlisted`
2. `Public`

Release checklist:

1. Build `packages/extension/dist`.
2. Zip the extension with files at the archive root.
3. Upload to the Chrome Web Store dashboard.
4. Add reviewer notes for:
   - sidepanel entry
   - passkey setup
   - receiver pairing and private intake
   - mock vs live modes
   - Smart Session limits for Green Goods actions

## Coop-Specific Review Notes

The extension requests broad capabilities and will likely receive extra review attention:

- `tabs`
- `activeTab`
- `scripting`
- `sidePanel`
- `offscreen`
- broad `http`, `https`, `ws`, and `wss` host permissions

Keep the listing, reviewer notes, and privacy answers unusually clear.

## Related Docs

- [demo-and-deploy-runbook.md](../guides/demo-and-deploy-runbook)
- [testing-and-validation.md](../guides/testing-and-validation)
