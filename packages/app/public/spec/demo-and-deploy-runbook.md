# Coop Demo And Deploy Runbook

Date: March 13, 2026

This is the public-facing copy of the demo runbook for local pairing and production rollout.

## Local/Local Peer Demo

Root env:

```bash
VITE_COOP_CHAIN=sepolia
VITE_COOP_ONCHAIN_MODE=mock
VITE_COOP_ARCHIVE_MODE=mock
VITE_COOP_SESSION_MODE=off
VITE_COOP_RECEIVER_APP_URL=http://127.0.0.1:3001
VITE_COOP_SIGNALING_URLS=ws://127.0.0.1:4444
```

Processes:

```bash
bun install
bun run dev:app
bun run dev:extension
bun run dev:api
```

Chrome:

1. Open `chrome://extensions`.
2. Turn on `Developer mode`.
3. Click `Load unpacked`.
4. Select `packages/extension/dist`.

Two-person flow:

1. Person A creates a coop in the extension.
2. Person A generates a receiver pairing.
3. Person B opens `/pair` on the PWA and accepts the payload or QR.
4. Person B captures a voice note, photo, or link on `/receiver`.
5. Person A confirms the item appears in private intake, then publishes it.
6. Open the board route and export the latest archive receipt.

## Local Extension + Production PWA

Use this for the most realistic pre-launch peer demo:

```bash
VITE_COOP_RECEIVER_APP_URL=https://<vercel-prod-domain>
VITE_COOP_SIGNALING_URLS=wss://<temporary-public-yjs-signal>
```

Both people still run the local unpacked extension. Person B uses the deployed PWA origin for
`/pair`, `/receiver`, and `/inbox`.

## Production

### PWA

- Host on Vercel.
- Set the Vercel Root Directory to `packages/app`.
- Keep the SPA rewrites from `packages/app/vercel.json`.

### Extension

- Ship through the Chrome Web Store.
- Start `Unlisted`, then move `Public`.

### Signaling

- Use a self-hosted `wss://` signaling endpoint before public launch.

## Validation

Before demos:

```bash
bun run validate production-readiness
```

For opt-in live Smart Session checks:

```bash
bun run validate session-key-live
```
