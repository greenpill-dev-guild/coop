---
title: Getting Started
slug: /builder/getting-started
---

# Getting Started

This page is the builder onramp for the whole monorepo, not only the extension.

## Prerequisites

- Node.js 20 or newer
- Bun for workspace installs and scripts
- Chrome or Chromium for extension development
- an optional phone or second device if you want to test the receiver flow

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
| `@coop/api` | Minimal signaling relay and API routes |
| `@coop/docs` | This Docusaurus site |

## Running The Docs Site

The docs live in `docs/` and now serve from `/`.

```bash
cd docs
bun run start
```

Build it with:

```bash
bun run build
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
bun build
bun run validate smoke
bun run validate core-loop
bun run validate full
bun run validate list          # discover all available suites
```

## Where To Read Next

- Read [How To Contribute](/builder/how-to-contribute) for repo rules and validation expectations.
- Read [Coop Architecture](/builder/architecture) for the package and data model split.
- Read [Coop Extension](/builder/extension) and [Coop App](/builder/app) for runtime-specific details.
