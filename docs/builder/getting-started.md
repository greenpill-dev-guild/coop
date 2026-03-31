---
title: Getting Started
slug: /builder/getting-started
---

# Getting Started

This page is the builder onramp for the whole monorepo, not only the extension.

## Quick Install (Extension Only)

If you just want to run the Coop extension locally and skip the rest of the monorepo setup for now:

```bash
git clone https://github.com/greenpill-dev-guild/coop.git
cd coop
bun install
cd packages/extension && bun run build
```

Then load the extension in Chrome:

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the folder `packages/extension/.output/chrome-mv3`
5. Pin the extension and open the sidepanel

That is enough to explore the popup, sidepanel, and local mock workflows. Rebuild with `bun run build` after code changes and reload the extension in Chrome.

For the full install path, zip distribution, and Chrome Web Store details, see
[Extension Install & Distribution](/reference/extension-install-and-distribution).

---

## Prerequisites

- Node.js 22 from the repo's `.mise.toml`
- Bun for workspace installs and scripts
- Chrome or Chromium for extension development
- an optional phone or second device if you want to test the receiver flow

Recommended toolchain bootstrap:

```bash
mise install
eval "$(mise activate zsh)"
node -v
```

`node -v` should report `v22.x` before you run the docs commands. If your shell still resolves an
older Node first, `bun run docs:build` can fail even though the repo has a Bun workspace.

## Bootstrap The Repo

Run these commands from the repository root:

```bash
bun install
bun dev
```

Useful split commands:

```bash
bun dev:app
bun dev:extension
bun dev:api
```

## Keep One Root Environment File

The repo uses one root `.env.local`. Do not create package-local env files.

Typical local defaults:

```bash
VITE_COOP_CHAIN=sepolia
VITE_COOP_ONCHAIN_MODE=mock
VITE_COOP_ARCHIVE_MODE=mock
VITE_COOP_SESSION_MODE=off
VITE_COOP_RECEIVER_APP_URL=http://127.0.0.1:3001
VITE_COOP_SIGNALING_URLS=ws://127.0.0.1:4444
```

For the full variable reference, see [Environment Reference](/builder/environment).

## Core Packages

| Package | Role |
| --- | --- |
| `@coop/shared` | Shared contracts, modules, storage, policy, sync, archive, identity |
| `@coop/app` | Landing plus receiver PWA shell |
| `@coop/extension` | MV3 extension runtime and primary product surface |
| `@coop/api` | Signaling relay plus Yjs WebSocket sync routes |
| `@coop/docs` | This Docusaurus site |

## Running The Docs Site

Use the root workspace scripts so the docs app picks up the repo's shared toolchain:

```bash
bun run docs:dev
bun run docs:build
bun run docs:serve
```

`bun run docs:build` writes generated output to `docs/build`. Treat that directory as generated
output, not canonical source content.

If docs builds fail with an older Node version, activate `mise` in the current shell and retry:

```bash
eval "$(mise activate zsh)"
node -v
bun run docs:build
```

## Development Tools

**UI Catalog** -- Preview design tokens (palette, spacing, radii, shadows) in light and dark themes.
Run with `bunx vite --config packages/extension/vite.catalog.config.ts` from the repo root.

**Token Linter** -- `scripts/lint-tokens.ts` enforces CSS token usage across stylesheets, catching raw color and spacing values that should use design tokens instead.

## Validation Entry Points

Use the workspace scripts rather than package-local ad hoc commands:

```bash
bun format && bun lint
bun run test
bun run test:coverage
bun build
bun run validate list
bun run validate smoke
bun run validate core-loop
bun run validate:store-readiness
bun run validate:production-readiness
bun run validate:production-live-readiness
```

## Where To Read Next

- Read [How To Contribute](/builder/how-to-contribute) for repo rules and validation expectations.
- Read [Coop Architecture](/builder/architecture) for the package and data model split.
- Read [Coop Extension](/builder/extension) and [Coop App](/builder/app) for runtime-specific details.
- Read [Current Release Status](/reference/current-release-status) for the current release boundary.
