# Coop

![Coop No more Chickens running loose](https://media.discordapp.net/attachments/1334366927094677575/1483276398956118127/signal-2026-03-11-173838.png?ex=69ba004b&is=69b8aecb&hm=f30d70ad2b2baa3c187601210d55b7a80b89a1e5b4cd9406b45f2f6105535d73&=&format=webp&quality=lossless&width=2240&height=298)

**A browser-first, local-first extension and companion receiver PWA for capture, review, local AI refinement, and shared coop memory.**

Coop helps groups capture what would otherwise get lost -- open tabs, voice memos, photos, files,
and links -- then review, refine, and publish what matters. The extension is the main product
surface. The companion PWA handles mobile and secondary-device capture. Core capture, review, local
AI refinement, and private intake stay in the browser, with a small signaling/API layer for peer
discovery and optional Yjs document sync.

A coop is the shared group workspace and memory layer: reviewed drafts, published artifacts, board
views, and proof material become visible to members only after human review.

## Current Status

Coop is currently strongest as a browser-first staged-launch product.

- Implemented today: browser capture and review, receiver pairing and private intake sync, local AI
  refinement, and shared coop publishing.
- Gated or advanced: Safe/onchain behavior, live archive delegation, privacy modes, Green Goods
  workflows, and session-capability rails.
- Validation: release readiness is tracked in the reference docs and validation commands below.

## How It Works

1. **Capture** -- Round up browser tabs with the extension. Record audio, take photos, attach
   files, or share links through the receiver PWA.
2. **Refine** -- A local in-browser agent and inference cascade turn captured context into
   candidates, drafts, and next steps without a hosted inference backend.
3. **Review** -- Members review candidates and drafts in the popup and `Chickens` before anything
   becomes shared coop state.
4. **Share** -- Publish reviewed drafts into the coop feed, sync through the local-first Yjs layer,
   and export board, proof, archive, or receipt material when needed.

## Main Surfaces

- `Popup` -- quick capture, quick review, create/join flows, and feed access.
- `Chickens` -- candidates, drafts, review queue, and publish prep.
- `Coops` -- shared coop state, board/proof access, and archive-related actions.
- `Roost` -- Green Goods member workspace in the current UI.
- `Nest` -- members, receiver pairing, operator controls, and settings.
- `Receiver` -- mobile and secondary-device capture surface.

## Key Features

Implemented today:

- **Capture and intake** -- Browser tabs in the extension; audio, photos, files, and links in the
  receiver PWA; paired mobile captures land in private intake before review.
- **Review and publish** -- Popup and `Chickens` workflows for candidate review, draft editing,
  categorization, and publish decisions.
- **Local AI refinement** -- A 16-skill agent pipeline with WebGPU, WASM, and heuristic tiers.
- **Local-first sync** -- Yjs CRDT sync with y-webrtc peers, y-websocket document sync support, and
  outbox tracking for publish-related events.
- **Board, proof, and export paths** -- Board views, archive receipts, snapshot/artifact export,
  and receipt export are surfaced today.
- **Passkey-first identity** -- WebAuthn identity with no wallet-extension-first requirement.

Gated or advanced:

- **Onchain rails** -- Safe/ERC-4337 flows, anchor actions, and account-abstraction behavior are
  mock-first by default and move behind a live gate when intentionally enabled.
- **Archive live rails** -- Storacha/Filecoin-backed archive delegation exists, but live
  credentials and trusted-node behavior are operator paths.
- **Privacy modes** -- Baseline privacy is local-first capture and explicit publish. Anonymous
  publish and stealth-address UI are opt-in surfaces.
- **Green Goods workflows** -- Member work intake, operator approvals, assessments, GAP
  reconciliation, and Hypercert/Karma GAP packaging depend on mode, authority, and environment.
- **ERC-8004 / FVM registry** -- Agent identity and registry flows exist as gated infrastructure,
  not baseline first-run behavior.

## Architecture

Bun monorepo with four runtime packages, plus docs and contracts sidecars:

| Package | Description |
|---------|-------------|
| `@coop/shared` | Schemas, flows, sync contracts, and domain modules |
| `@coop/app` | Landing page and receiver PWA shell |
| `@coop/extension` | MV3 browser extension: popup, sidepanel, background handlers, offscreen workers |
| `@coop/api` | Hono + Bun signaling relay with optional Yjs document sync persistence |

Supporting directories:

- `docs/` -- Docusaurus workspace for `docs.coop.town`.
- `packages/contracts/` -- Foundry sidecar for Solidity contracts and deployment artifacts.

Build order: shared -> app -> extension.

## Key Principles

- **Browser-first** -- The extension is the primary product surface.
- **Local-first** -- Raw captures stay on your device until explicit publish or sync.
- **Passkey-first** -- No wallet extension is required for first-run identity.
- **Offline capable** -- Core capture and review work without internet; sync resumes when connected.
- **Explicit sharing** -- Review and publish remain human decisions.

## Local Development

Coop pins Node 22 in `.mise.toml`. Bun is the workspace package manager, while the docs site still
depends on a working Node toolchain.

Recommended shell bootstrap:

```bash
mise install
eval "$(mise activate zsh)"
node -v
```

`node -v` should report `v22.x` before you run docs commands.

Essential commands:

```bash
bun install                    # Install dependencies
bun dev                        # Start app + extension concurrently
bun dev:app                    # Start app only
bun dev:extension              # Start extension only
bun dev:api                    # Start API server
bun run test                   # Run unit tests with Vitest
bun run build                  # Build shared -> app -> extension
bun run validate smoke         # Fast confidence pass
bun run validate:store-readiness
```

Always use `bun run test`, not `bun test`. Bun's built-in runner ignores the repo's Vitest config.

## Environment

Use a single `.env.local` at the repository root. Do not create package-specific `.env` files.

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_COOP_CHAIN` | Target chain: `sepolia` or `arbitrum` | `sepolia` |
| `VITE_COOP_ONCHAIN_MODE` | Onchain mode: `mock` or `live` | `mock` |
| `VITE_COOP_ARCHIVE_MODE` | Archive mode: `mock` or `live` | `mock` |
| `VITE_COOP_SESSION_MODE` | Session mode: `off`, `mock`, or `live` | `off` |
| `VITE_COOP_PRIVACY_MODE` | Privacy-mode surfaces such as anonymous publish UI | `off` |
| `VITE_COOP_SIGNALING_URLS` | Comma-separated WebSocket signaling endpoints | `wss://api.coop.town` |
| `VITE_COOP_RECEIVER_APP_URL` | Receiver PWA base URL | `http://127.0.0.1:3001` |
| `VITE_PIMLICO_API_KEY` | Live Safe/ERC-4337 operations | -- |

For Playwright E2E runs, the repo starts its own local signaling server automatically.

## Release / Validation

Default release work stays on the deterministic mock-first path unless live rails are intentionally
being exercised.

- Common bar: `bun run test`, `bun run build`, `bun run validate smoke`, and
  `bun run validate:store-readiness`.
- Broader release bar: `bun run validate:production-readiness`.
- Live rails gate: `bun run validate:production-live-readiness`.
- Public extension candidates should keep onchain, archive, and session modes on default mock/off
  settings unless the live gate is the explicit task.

## Documentation

- [Current Release Status](docs/reference/current-release-status.md)
- [Testing & Validation](docs/reference/testing-and-validation.md)
- [Demo & Deploy Runbook](docs/reference/demo-and-deploy-runbook.md)
- [Architecture](docs/builder/architecture.md)
- [Environment Reference](docs/builder/environment.md)
- [Receiver Pairing & Intake](docs/reference/receiver-pairing-and-intake.md)
- [Extension Install & Distribution](docs/reference/extension-install-and-distribution.md)
- [Live Rails Operator Runbook](docs/reference/live-rails-operator-runbook.md)

## Project Foundation & Brand

Coop is built for community coordination work where context, evidence, governance, and capital
formation need to stay connected without centralizing raw context on a server-first platform.

The product uses chicken metaphors throughout. Open browser tabs are **Loose Chickens**. The review
queue is **Chickens**. The shared feed is the **Coop Feed**. Creating a new shared space is
**Launching the Coop**. The success chime is the **Rooster Call**.
