---
title: "Demo & Deploy Runbook"
slug: /reference/demo-and-deploy-runbook
---

# Coop Demo And Deploy Runbook

Date: March 28, 2026

This is the canonical runbook for local demos, peer pairing, and production deployment. Keep the
stage-based checklist aligned to [Production Release Checklist](/reference/production-release-checklist).
For the current public-release boundary, read [Current Release Status](/reference/current-release-status).
For the receiver protocol, read [Receiver Pairing & Intake](/reference/receiver-pairing-and-intake).
For operator-only live rails, read [Live Rails Operator Runbook](/reference/live-rails-operator-runbook).

## Demo Storyboard

Use this narrative arc for live demos and recorded walkthroughs. Each beat is a self-contained
moment that can be paused for commentary.

### Beat 1 -- Landing (30s)

Open `https://coop.town`. Walk the audience through the hero: "No more chickens loose." Scroll
through the How Coop Works cards. Point out that this is a real product page, not a slide deck.
Click **Install Extension** in the top bar to show the install path is one click away.

### Beat 2 -- Create A Coop (60s)

Open the extension sidepanel. Create a new coop, choosing a preset (e.g. "friends" or
"community"). Walk through the create flow: name, ritual lens selection, and the coop preset
copy. Show the coop landing in the **Coops** tab with its state badge.

### Beat 3 -- Capture And Synthesize (90s)

Open several tabs in Chrome -- articles, notes, whatever fits the story. Trigger **Manual
round-up** from the popup or agent tab. Show the candidates appearing in **Chickens**.
Open one candidate, demonstrate the AI synthesis output (summary, tags, opportunity signal).
Emphasize: all processing happened in the browser with no cloud calls.

### Beat 4 -- Review And Publish (60s)

In **Chickens**, promote one candidate to a draft. Edit the draft title or body. Publish
it to the coop. Switch to the **Coops** tab and show the published artifact in the feed.
Open the board route to display the React Flow knowledge graph.

### Beat 5 -- Archive To Filecoin (45s)

From the **Coops** tab, trigger an archive snapshot. Export the receipt. Explain: the
published state is now anchored to Filecoin via Storacha, creating an immutable record of
what the group knows and decided.

### Beat 6 -- Green Goods Action (45s)

If the coop has Green Goods enabled, open the **Roost** tab (Green Goods member workspace).
Show the garden pass, member-account provisioning, and a bounded session-key action (e.g.
create garden). Emphasize: onchain execution is scoped by policy and human-confirmed for
high-stakes operations.

### Beat 7 -- The Larger Vision (60s)

Zoom out. Recap the loop: scattered knowledge enters as loose chickens, gets refined locally
by an in-browser agent, passes through human review, and becomes shared memory anchored
onchain. Every step respects local-first privacy, passkey-first identity, and explicit
publish. The product is already working -- what follows is deepening the knowledge graph,
expanding community coordination patterns, and opening the agent harness to more skill types.

---

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

## Environment 1: Local Development (with `bun dev`)

Use `bun dev` to start all services concurrently. The dev script automatically configures the
extension with the correct signaling and receiver URLs.

### Root `.env.local` (minimal)

```bash
# Tunnel (optional — enables dev-api.coop.town and local.coop.town)
COOP_TUNNEL_NAME=coop-api
COOP_TUNNEL_API_HOSTNAME=dev-api.coop.town
COOP_TUNNEL_APP_HOSTNAME=local.coop.town
```

Other defaults are safe: sepolia, mock onchain/archive, session off.

If you want live Sepolia rehearsals against local receiver + signaling while developing the
extension, use the profile commands instead of editing `.env.local`:

```bash
bun run dev:app
bun run dev:api
bun run dev:extension:local-live-sepolia
```

That profile lives at `config/env/profiles/local-live-sepolia.env` and only overrides the
mode/origin values baked into the extension bundle.

If you also need the docs site, make sure the shell is using Node 22 from `.mise.toml` before you
run `bun run docs:dev` or `bun run docs:build`.

### Processes

```bash
bun install
bun dev
```

To stop the full local dev environment and clean up orphan listeners:

```bash
bun run dev:stop
```

Expected surfaces:

- App / receiver PWA: `http://127.0.0.1:3001` or `https://local.coop.town`
- Signaling: `ws://127.0.0.1:4444` or `wss://dev-api.coop.town`
- Production fallback signaling: `wss://api.coop.town`
- Extension bundle: `packages/extension/dist/chrome-mv3`

To run services individually instead of `bun dev`:

```bash
bun run dev:app
bun run dev:extension
bun run dev:api
```

### Chrome Setup

1. Open `chrome://extensions`.
2. Turn on `Developer mode`.
3. Click `Load unpacked`.
4. Select `packages/extension/dist/chrome-mv3`.
5. Reload the extension after each rebuild.
6. Pin the extension and open the sidepanel.

### Two-Person Local Demo

1. Dev A opens the extension sidepanel and creates a coop.
2. Dev A opens **Nest** and generates a receiver pairing.
3. Dev B opens `http://127.0.0.1:3001/pair` and accepts the pairing payload or QR.
4. Dev B goes to `http://127.0.0.1:3001/receiver` and captures a voice note, photo, or link.
5. Dev A confirms the item lands in **Nest** under Pocket Coop Finds.
6. Dev A converts it into a draft, edits it in **Chickens**, and publishes it.
7. Both devs verify the published artifact in the **Coops** feed and on the board route.
8. Dev A archives the snapshot and exports the latest receipt.

## Environment 2: Local Extension + Production PWA

Use this to test the extension against the production receiver and signaling.

### Root `.env.local`

```bash
VITE_COOP_RECEIVER_APP_URL=https://coop.town
VITE_COOP_SIGNALING_URLS=wss://api.coop.town
```

Notes:

- Both developers still run `bun run dev:extension`.
- Running `bun run dev:app` is optional unless testing the local landing page or board shell.
- Reload the extension after env changes because Vite bakes them into the bundle.

### Demo Flow

1. Both developers run `bun run dev:extension`.
2. Both load the unpacked extension from `packages/extension/dist/chrome-mv3`.
3. Dev A creates or opens the coop locally in the extension.
4. Dev A generates a receiver pairing.
5. Dev B opens `https://coop.town/pair`.
6. Dev B accepts the pairing and captures from `https://coop.town/receiver`.
7. Dev A verifies sync into the local extension intake.
8. Dev A publishes from **Chickens** and opens the board from **Coops**.

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
- Build from `packages/extension/dist/chrome-mv3`.
- Package the release zip from the canonical build output with `bun run package:extension:public-release`.

### Signaling

- Production signaling server: `wss://api.coop.town`
- Yjs document sync: `wss://api.coop.town/yws`
- Primary path: GitHub Actions deploys `packages/api` to Fly.io on `main`
- Manual fallback: `flyctl deploy -a coop` from `packages/api/`
- Health check: `https://api.coop.town/health`

### Staged Launch Gate

This is the default production release bar and does not require live Safe, archive, or session
rails.

Preferred profile command:

```bash
bun run validate:public-release
```

```bash
bun format && bun lint
bun run test
bun run test:coverage
bun run build
bun run validate:store-readiness
bun run validate:production-readiness
```

Manual staged-launch checks still include:

- popup `Capture Tab` and `Screenshot` saves in real Chrome
- popup screenshot review edit/save and cancel paths
- sidepanel create, Chickens review, publish, board/archive, and receiver pairing flows
- confirmation that public builds do not embed operator-only signing material
- confirmation that remote knowledge-skill import remains quarantined in the shipped build

As of March 28, 2026, those popup success-path checks are the remaining public-release blocker after
the automated staged-launch bar.

### Live Modes

Treat live rails as a second gate after the staged launch bar is green. Enable only when the
required credentials are present:

```bash
VITE_COOP_ONCHAIN_MODE=live
VITE_COOP_ARCHIVE_MODE=live
VITE_COOP_SESSION_MODE=live
VITE_PIMLICO_API_KEY=...
VITE_COOP_TRUSTED_NODE_ARCHIVE_AGENT_PRIVATE_KEY=...
VITE_COOP_TRUSTED_NODE_ARCHIVE_SPACE_DID=...
VITE_COOP_TRUSTED_NODE_ARCHIVE_DELEGATION_ISSUER=...
VITE_COOP_TRUSTED_NODE_ARCHIVE_SPACE_DELEGATION=...
```

Preferred profile commands:

```bash
bun run build:operator-live
bun run validate:operator-live
```

After the staged launch bar is green and the live env is complete:

```bash
bun run validate:production-live-readiness
```

Profile files live at:

- `config/env/profiles/local-live-sepolia.env`
- `config/env/profiles/public-release.env`
- `config/env/profiles/operator-live.env`

These profile overlays contain only non-secret mode/origin switches. Keep live credentials in the
repo-root `.env.local`.

Use [Live Rails Operator Runbook](/reference/live-rails-operator-runbook) for the exact probe env,
skip behavior, and public-build separation rules.

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

### Filecoin / FVM Registry

The Filecoin registry contract currently lives in `packages/contracts/src/CoopRegistry.sol`. Use
the repo deploy helper so the contract build/test pass and the broadcast path stay consistent.

Preferred deployment path using a Foundry keystore account:

```bash
bun run deploy:registry --broadcast
bun run deploy:registry --network mainnet --broadcast
```

Alternative deployment path using a raw private key:

```bash
DEPLOYER_PRIVATE_KEY=0x... \
bun run deploy:registry --broadcast
```

The default keystore account on this machine is `green-goods-deployer`. Pass `--account <name>` if
you need a different Foundry keystore alias.

After deployment:

1. Record the deployed registry address.
2. Set `VITE_COOP_FVM_CHAIN` to `filecoin-calibration` or `filecoin`.
3. Set `VITE_COOP_FVM_REGISTRY_ADDRESS` to the deployed contract address.
4. Update the deployment map in `packages/shared/src/modules/fvm/fvm.ts`.

Current implementation note:

- Deployment can use a Foundry keystore account.
- Runtime archive registration in the extension now uses a member-local Filecoin signer that is
  created on first use for the authenticated passkey member.
- No runtime FVM private-key env var is required in the extension bundle. Members must fund their
  local Filecoin signer address before they can submit registry writes on the selected FVM network.

## Local Demo Script

Use this for a clean two-person rehearsal.

### Person A: Extension Operator

1. Open the extension sidepanel.
2. Open **Nest** and confirm chain, modes, receiver origin, and signaling in the Runtime section.
3. Create a coop with the intended preset.
4. If needed, enable `Green Goods garden` during setup.
5. Generate a receiver pairing in **Nest**.
6. Watch **Nest** for Pocket Coop Finds and **Chickens** for working drafts.
7. Run `Manual round-up`, review in **Chickens**, and publish.
8. If session mode is on, open **Nest** -> `Agent` and inspect the bounded garden-pass controls.

### Person B: Receiver

1. Open `/pair` on the local or production PWA.
2. Accept the pairing payload or QR.
3. Move to `/receiver`.
4. Capture one voice note, one link, or one photo.
5. Open `/inbox` and confirm the item is queued or synced.

### Demo Close

1. Person A confirms the private intake item arrived in **Nest**.
2. Person A converts it into a draft, finishes the review flow in **Chickens**, and publishes it.
3. Open the board route.
4. Archive the coop snapshot.
5. Export the latest receipt.

## Adversarial Checklist

Use this before demos and before production launch.

### Create A Coop

- Preset-specific copy renders correctly.
- Friends, family, and personal never fall back to generic `community` language.
- State badges and extension icon states match the actual coop state.
- Onchain mode, archive mode, and session mode are visible in the **Nest** Runtime section.

### Join And Sync With A Peer

- A second profile can join and see published state.
- Expired or inactive invites fail clearly.
- Missing signaling, duplicate sync, and sidepanel-closed cases fail safely.
- Local-only fallback still leaves the receiver usable.

### Pair A Receiver And Capture Privately

- `/pair`, `/receiver`, and `/inbox` work on local and production origins.
- QR, share, notifications, badges, and file export degrade gracefully when unsupported.
- Bridge injection works on `http://127.0.0.1:3001` and `https://coop.town`.
- Wrong-member and expired-pairing envelopes are rejected.

### Popup Capture

- Automation already proves real popup roundup, manual-gate errors, file review/save, audio retry,
  and post-failure recovery.
- Manually verify successful popup `Capture Tab` and `Screenshot` saves with a real click in
  Chrome because popup `activeTab` grants are not reproducible under automation.

### Run The Agent Loop

- Manual round-up, observation capture, plan generation, and Chickens draft creation work without
  duplicate or conflicting states.
- Auto-run never bypasses action policy.
- Operator logs stay readable enough to narrate during a live demo.

### Execute Green Goods Actions

- `production-readiness` now covers mock-path member-account provisioning and garden-pass issuance
  in the real sidepanel.
- An allowed session-key action succeeds in `VITE_COOP_SESSION_MODE=live` when the live probes are
  enabled.
- A disallowed action is rejected before send.
- Replay protection still blocks re-use.
- Revoked, expired, or exhausted sessions are blocked.
- Missing Safe, missing Pimlico, wrong chain, or missing session material surface actionable
  errors.

### Publish, Archive, And Export

- Publish reaches the **Coops** feed and the board route.
- Archive receipts remain legible.
- Export works with file picker or download fallback.
- The latest snapshot and receipt are easy to find during the demo.

## Deployment Checklist

### PWA On Vercel

1. Set the project Root Directory to `packages/app`.
2. Keep the SPA rewrites in `packages/app/vercel.json`.
3. Set production environment variables in the Vercel dashboard.
4. Deploy and verify `/`, `/pair`, `/receiver`, `/inbox`, `/board/<coop-id>`,
   `/manifest.webmanifest`, and `/sw.js`.

### Extension To Chrome Web Store

1. Set `VITE_COOP_RECEIVER_APP_URL` to the exact production HTTPS receiver origin.
2. Clear the staged launch bar:
   `bun format && bun lint`, `bun run test`, `bun run test:coverage`, `bun run build`,
   `bun run validate:store-readiness`, and `bun run validate:production-readiness`.
3. If live Safe, session-key, or archive rails are enabled, wait until the staged launch bar is
   green and the live env contract is complete, then run
   `bun run validate:production-live-readiness`.
5. Build the extension.
6. Package the extension from `packages/extension/dist/chrome-mv3` with files at the archive root.
7. Upload to the Chrome Web Store dashboard.
8. Start as `Unlisted`.
9. Add clear reviewer notes for sidepanel entry, passkey flows, mock vs live modes, receiver
   pairing, private intake behavior, and the local-first data model.

## Validation Commands

Use this before demo day and before packaging a staged release candidate:

```bash
bun format && bun lint
bun run test
bun run test:coverage
bun run build
bun run validate:store-readiness
bun run validate:production-readiness
```

Use this only after the staged launch bar is green and the release candidate enables live Safe,
session-key, or archive behavior:

```bash
bun run validate:production-live-readiness
```
