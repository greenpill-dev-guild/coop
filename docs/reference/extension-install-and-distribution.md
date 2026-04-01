---
title: "Extension Install & Distribution"
slug: /reference/extension-install-and-distribution
---

# Coop Extension Install And Distribution

Date: March 30, 2026

This document covers extension-specific install and rollout. The full local demo, peer pairing, and
production deployment flow lives in [Demo & Deploy Runbook](/reference/demo-and-deploy-runbook).
The canonical stage-based release checklist lives in
[Production Release Checklist](/reference/production-release-checklist). The current
public-release boundary lives in [Current Release Status](/reference/current-release-status).

## GitHub Releases

### Rolling Builder Prerelease

The primary builder download path is the rolling GitHub prerelease:

- [builder-latest release page](https://github.com/greenpill-dev-guild/coop/releases/tag/builder-latest)
- [direct builder zip](https://github.com/greenpill-dev-guild/coop/releases/download/builder-latest/coop-extension-builder-latest.zip)

This prerelease is updated from successful merges to `main` and is the easiest way to grab a fresh
packaged build without cloning the repo first.

### Stable Tagged Releases

Versioned `v*` releases remain available on the main Releases page:

- [all GitHub releases](https://github.com/greenpill-dev-guild/coop/releases)

Use those when you want a more deliberate, versioned artifact instead of the rolling builder
channel.

## Fastest Path: Unpacked Install From Source

Clone, build, and load -- no environment file needed for mock mode:

```bash
git clone https://github.com/greenpill-dev-guild/coop.git
cd coop
bun install
cd packages/extension && bun run build
```

Load into Chrome:

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the folder `packages/extension/dist/chrome-mv3`
5. Pin the extension icon and open the sidepanel from the toolbar

After code changes, rebuild with `bun run build` in `packages/extension/` and click the
reload icon on the extension card in `chrome://extensions`.

> **No `.env.local` needed for first run.** The defaults (`sepolia`, `mock` onchain/archive,
> session `off`) work out of the box. Create `.env.local` at the repo root only when you need
> live rails or custom signaling URLs.

## Local Developer Install (Full)

For development with live-reload and all local services:

```bash
bun install
bun dev
```

This starts the extension, the receiver PWA, and the signaling server concurrently. The dev script
automatically sets `VITE_COOP_SIGNALING_URLS` and `VITE_COOP_RECEIVER_APP_URL` for the extension
build.

If you only need the extension:

```bash
bun run dev:extension
```

Optional `.env.local` at the repo root (do not create package-specific env files):

```bash
VITE_COOP_CHAIN=sepolia
VITE_COOP_ONCHAIN_MODE=mock
VITE_COOP_ARCHIVE_MODE=mock
VITE_COOP_SESSION_MODE=off
VITE_COOP_RECEIVER_APP_URL=http://127.0.0.1:3001
VITE_COOP_SIGNALING_URLS=ws://127.0.0.1:4444
```

For local live Sepolia rehearsals without editing `.env.local`:

```bash
bun run dev:app
bun run dev:api
bun run dev:extension:local-live-sepolia
```

That profile enables live onchain/archive/session rails while keeping the receiver and signaling
origins local to your machine.

## Local Extension + Production PWA

This is the preferred peer-demo mode when the extension is under active development.

Set:

```bash
VITE_COOP_RECEIVER_APP_URL=https://coop.town
VITE_COOP_SIGNALING_URLS=wss://api.coop.town
```

Then rebuild the extension and reload it in Chrome. The receiver bridge content script is patched at
build time so the extension can inject on the configured production PWA origin.

The canonical receiver protocol, route ownership, and member-private intake flow now live in
[Receiver Pairing & Intake](/reference/receiver-pairing-and-intake).

## Early Access Distribution (Zip)

For sharing a local unpublished build with trusted testers who will not clone the repo:

### Builder: Create The Zip

```bash
bun run package:extension:public-release
```

The package script writes archives into `packages/extension/dist/archives/`. Share the generated zip
directly or upload it to a file host. The archive contains `manifest.json` at the root, so testers
can unzip it and load that folder directly in Chrome.

### Tester: Install From Zip

1. Download and unzip the archive into a folder (e.g. `~/coop-extension/`)
2. Open Chrome and go to `chrome://extensions`
3. Turn on **Developer mode** (top-right toggle)
4. Click **Load unpacked**
5. Select the unzipped folder (the one containing `manifest.json`)
6. Pin the extension icon and open the sidepanel

The extension will work in mock mode immediately. No credentials or environment setup required.

## Chrome Web Store Rollout

Use this order:

1. `Unlisted`
2. `Public`

Release checklist:

1. Set `VITE_COOP_RECEIVER_APP_URL` to the exact production HTTPS receiver origin for the release candidate.
2. Preferred one-command public extension release: `bun run release:extension:public-release`
3. If you want the manual split instead, use `bun run validate:public-release`, `bun run validate:store-readiness`, and `bun run package:extension:public-release`.
4. If the build enables live Safe, session-key, or archive rails, use `bun run package:extension:operator-live` and `bun run validate:operator-live`.
5. Built archives land in `packages/extension/dist/archives/`.
6. Raw unpacked extension output lands in `packages/extension/dist/chrome-mv3`.
7. Record the first-run local-AI network trace for reviewer notes.
8. Keep the rolling builder prerelease (`builder-latest`) separate from versioned tagged releases intended for broader stability.
9. Upload the generated archive to the Chrome Web Store dashboard, or share it directly with trusted testers for manual unpacked install.
10. Add reviewer notes for sidepanel entry, passkey setup, receiver pairing and private intake,
   mock vs live modes, Smart Session limits for Green Goods actions, opt-in scheduled capture, and
   local-first data handling.

`VITE_COOP_RECEIVER_APP_URL` is not just a runtime convenience. `store-readiness` validates that it
produces the exact `host_permissions` and receiver-bridge content-script matches for the packaged
extension, so keep it on the final production HTTPS origin for release builds.

Profile overlays live at:

- `config/env/profiles/local-live-sepolia.env`
- `config/env/profiles/public-release.env`
- `config/env/profiles/operator-live.env`

Release note for manual verification:

- Automation now covers popup roundup, popup manual-gate errors, file review/save, audio retry,
  publish/archive handoff, receiver sync, and mock-path sidepanel member-account plus garden-pass
  flows.
- Successful popup `Capture Tab` and `Screenshot` saves still need a real-click manual check in
  Chrome because the popup `activeTab` grant is not reproducible under Playwright.
- Remote knowledge-skill import remains quarantined from the shipped build and should stay that way
  unless the dedicated re-enable checklist is completed.

Do not ship any embedded Filecoin or operator private key in a public Chrome Web Store build. The
current Filecoin registry path uses a member-local signer that is provisioned on-device for the
authenticated passkey member at runtime.

## Coop-Specific Review Notes

The extension requests broad capabilities and will likely receive extra review attention:

- `tabs`
- `activeTab`
- `scripting`
- `sidePanel`
- `offscreen`
- exact receiver-origin host permissions for the receiver bridge

Keep the listing, reviewer notes, and privacy answers unusually clear.

## Related Docs

- [Demo & Deploy Runbook](/reference/demo-and-deploy-runbook)
- [Current Release Status](/reference/current-release-status)
- [Receiver Pairing & Intake](/reference/receiver-pairing-and-intake)
- [Testing & Validation](/reference/testing-and-validation)
- [Chrome Web Store Checklist](/reference/chrome-web-store-checklist)
- [Chrome Web Store Reviewer Notes](/reference/chrome-web-store-reviewer-notes)
- [Coop Privacy Policy](/privacy-policy)
- [Remote Knowledge Skill Re-Enable Checklist](/reference/remote-knowledge-skill-reenable-checklist)
