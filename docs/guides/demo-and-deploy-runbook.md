---
title: "Demo & Deploy Runbook"
sidebar_label: "Demo & Deploy"
sidebar_position: 1
---

# Coop Demo And Deploy Runbook

Date: March 13, 2026

This is the canonical runbook for local demos, peer pairing, and production deployment. Keep the
other docs aligned to this one.

## Shared Rules

- Use the repo-root `.env.local` for local development. Do not create package-specific env files.
- Default local safety remains:
  - `VITE_COOP_CHAIN=sepolia`
  - `VITE_COOP_ONCHAIN_MODE=mock`
  - `VITE_COOP_ARCHIVE_MODE=mock`
  - `VITE_COOP_SESSION_MODE=off`
- Session keys are opt-in:
  - `off`: local issue and inspection only
  - `mock`: UI rehearsal without live user operations
  - `live`: bounded Smart Session execution for phase-1 Green Goods actions
- Production passkeys must be created on the final production PWA domain.

## Environment 1: Two-Dev Local/Local

Use this when two developers are both running source locally and want the full pair flow on their
own machines.

### Root `.env.local`

```bash
VITE_COOP_CHAIN=sepolia
VITE_COOP_ONCHAIN_MODE=mock
VITE_COOP_ARCHIVE_MODE=mock
VITE_COOP_SESSION_MODE=off
VITE_COOP_RECEIVER_APP_URL=http://127.0.0.1:3001
VITE_COOP_SIGNALING_URLS=ws://127.0.0.1:4444
```

### Processes

Run these from the repo root:

```bash
bun install
bun run dev:app
bun run dev:extension
bun run dev:api
```

Expected local surfaces:

- App and receiver PWA: `http://127.0.0.1:3001`
- Signaling server: `ws://127.0.0.1:4444`
- Extension bundle: `packages/extension/dist`

### Chrome Setup

Each developer should:

1. Open `chrome://extensions`.
2. Turn on `Developer mode`.
3. Click `Load unpacked`.
4. Select `packages/extension/dist`.
5. Reload the extension after each rebuild.
6. Pin the extension and open the sidepanel.

### Two-Person Local Demo

1. Dev A opens the extension sidepanel and creates a coop.
2. Dev A generates a receiver pairing from the `Coops` tab.
3. Dev B opens `http://127.0.0.1:3001/pair` and accepts the pairing payload or QR.
4. Dev B goes to `http://127.0.0.1:3001/receiver`, captures a voice note, photo, or link.
5. Dev A confirms the item lands in `Private Receiver Intake`.
6. Dev A converts it into the Roost, edits it, and publishes it.
7. Both devs verify the published artifact in `Feed` and on the board route.
8. Dev A archives the snapshot and exports the latest receipt.

## Environment 2: Two-Dev Local Extension + Production PWA

Use this as the default peer demo path before the owned production signaling host is ready.

### Root `.env.local`

```bash
VITE_COOP_CHAIN=sepolia
VITE_COOP_ONCHAIN_MODE=mock
VITE_COOP_ARCHIVE_MODE=mock
VITE_COOP_SESSION_MODE=off
VITE_COOP_RECEIVER_APP_URL=https://<vercel-prod-domain>
VITE_COOP_SIGNALING_URLS=wss://<temporary-public-yjs-signal>
```

Notes:

- Both developers still run `bun run dev:extension`.
- Running `bun run dev:app` is optional in this mode unless someone is testing the local landing
  page or board shell.
- The extension build must be reloaded in Chrome after changing `VITE_COOP_RECEIVER_APP_URL`.

### Demo Flow

1. Both developers run `bun run dev:extension`.
2. Both load the unpacked extension from `packages/extension/dist`.
3. Dev A creates or opens the coop locally in the extension.
4. Dev A generates a receiver pairing.
5. Dev B opens `https://<vercel-prod-domain>/pair`.
6. Dev B accepts the pairing and captures from `https://<vercel-prod-domain>/receiver`.
7. Dev A verifies sync into the local extension intake.
8. Dev A publishes to Feed and opens the board on the production PWA.

Use this mode when you want the extension under active development while validating the deployed
receiver origin and passkey scope.

## Environment 3: Production

This is the release target.

### PWA

- Host the app/PWA on Vercel.
- Set the Vercel project Root Directory to `packages/app`.
- Keep the SPA rewrites from `packages/app/vercel.json`.
- Ensure the final production domain is the same domain used for passkey enrollment.

### Extension

- Distribute through the Chrome Web Store.
- Launch order:
  1. `Unlisted`
  2. `Public`
- Build from `packages/extension/dist`.
- Zip the contents of `dist` at the archive root before upload.

### Signaling

- Public launch must not depend on a shared public relay.
- Self-host the open-source signaling server using the existing repo script as the baseline:

```bash
bun run dev:api
```

- Move that service behind a durable `wss://` endpoint before public release.

### Live Modes

Enable only when the required credentials are present:

```bash
VITE_COOP_ONCHAIN_MODE=live
VITE_COOP_ARCHIVE_MODE=live
VITE_COOP_SESSION_MODE=live
VITE_PIMLICO_API_KEY=...
VITE_COOP_TRUSTED_NODE_ARCHIVE_SPACE_DID=...
VITE_COOP_TRUSTED_NODE_ARCHIVE_DELEGATION_ISSUER=...
VITE_COOP_TRUSTED_NODE_ARCHIVE_SPACE_DELEGATION=...
```

Session-key live execution is limited to:

- `green-goods-create-garden`
- `green-goods-sync-garden-profile`
- `green-goods-set-garden-domains`
- `green-goods-create-garden-pools`

Human-confirmed only:

- `safe-deployment`
- `green-goods-submit-work-approval`
- `green-goods-create-assessment`
- `green-goods-sync-gap-admins`
- treasury movement, approvals, and arbitrary calls

## Local Demo Script

Use this for a clean two-person rehearsal.

### Person A: Extension Operator

1. Open the extension sidepanel.
2. Check `Settings -> Nest Runtime` and confirm chain, modes, receiver origin, and signaling.
3. Create a coop with the right preset: `friends`, `family`, `personal`, `project`, or
   `community`.
4. If needed, enable `Green Goods garden` during setup.
5. Generate a receiver pairing in the `Coops` tab.
6. Watch the `Feed` tab after sync.
7. Run `Manual round-up`, review the Roost, and publish.
8. If live session mode is enabled, open `Feed -> Operator Console -> Session Keys` and issue or
   inspect the bounded session.

### Person B: Receiver

1. Open `/pair` on the local or production PWA.
2. Accept the pairing payload or QR.
3. Move to `/receiver`.
4. Capture one voice note, one link, or one photo.
5. Open `/inbox` and confirm the item is queued or synced.

### Demo Close

1. Person A confirms the private intake item arrived.
2. Person A converts it into the Roost and publishes it.
3. Open the board route.
4. Archive the coop snapshot.
5. Export the latest receipt.

## Adversarial Checklist

Use this before demos and before production launch.

### Create A Coop

- Preset-specific copy renders correctly.
- Friends, family, and personal never fall back to generic `community` language.
- State badges and extension icon states match the actual coop state.
- Onchain mode, archive mode, and session mode are visible in `Settings -> Nest Runtime`.

### Join And Sync With A Peer

- A second profile can join and see published state.
- Expired or inactive invites fail clearly.
- Missing signaling, duplicate sync, and sidepanel-closed cases fail safely.
- Local-only fallback still leaves the receiver usable.

### Pair A Receiver And Capture Privately

- `/pair`, `/receiver`, and `/inbox` work on local and production origins.
- QR, share, notifications, badges, and file export degrade gracefully when unsupported.
- Bridge injection works on `http://127.0.0.1:3001` and on the production Vercel domain.
- Wrong-member and expired-pairing envelopes are rejected.

### Run The Agent Loop

- Manual round-up, observation capture, plan generation, and Roost draft creation work without
  duplicate or conflicting states.
- Auto-run never bypasses action policy.
- Operator logs stay readable enough to narrate during a live demo.

### Execute Green Goods Actions

- An allowed session-key action succeeds in `VITE_COOP_SESSION_MODE=live`.
- A disallowed action is rejected before send.
- Replay protection still blocks re-use.
- Revoked, expired, or exhausted sessions are blocked.
- Missing Safe, missing Pimlico, wrong chain, or missing session material surface actionable
  errors.

### Publish, Archive, And Export

- Publish reaches Feed and the board route.
- Archive receipts remain legible.
- Export works with file picker or download fallback.
- The latest snapshot and receipt are easy to find during the demo.

## Deployment Checklist

### PWA On Vercel

1. Set the project Root Directory to `packages/app`.
2. Keep the SPA rewrites in `packages/app/vercel.json`.
3. Set production environment variables in the Vercel dashboard.
4. Deploy and verify:
   - `/`
   - `/pair`
   - `/receiver`
   - `/inbox`
   - `/board/<coop-id>`
   - `/manifest.webmanifest`
   - `/sw.js`

### Extension To Chrome Web Store

1. Run `bun run --filter @coop/extension build`.
2. Zip the contents of `packages/extension/dist`.
3. Upload to the Chrome Web Store dashboard.
4. Start as `Unlisted`.
5. Add clear reviewer notes for:
   - sidepanel entry
   - passkey flows
   - mock vs live modes
   - receiver pairing and private intake behavior

## Validation Commands

Use these before demo day:

```bash
bun run validate production-readiness
```

Use this only when the live Smart Session env vars are present:

```bash
bun run validate session-key-live
```
