# Coop

![Coop No more Chickens running loose](https://media.discordapp.net/attachments/1334366927094677575/1483276398956118127/signal-2026-03-11-173838.png?ex=69ba004b&is=69b8aecb&hm=f30d70ad2b2baa3c187601210d55b7a80b89a1e5b4cd9406b45f2f6105535d73&=&format=webp&quality=lossless&width=2240&height=298)

**A browser-first, local-first extension and companion receiver PWA for turning scattered knowledge into reviewed, shared coop memory.**

Coop helps groups capture what would otherwise get lost -- open tabs, voice memos, photos, files,
and links -- then review, refine, and publish what matters. The extension is the main product
surface. The companion PWA handles mobile and secondary-device capture. Core capture, review, local
AI refinement, and private intake stay in the browser. The repo also includes a small signaling/API
layer for peer discovery and optional Yjs document sync.

A coop is Coop's shared group workspace and memory layer: the place where reviewed drafts, published
artifacts, board views, and proof material become visible to members.

Today, Coop is strongest as a mock-first staged-launch product: browser capture and review are
implemented, receiver pairing and private intake sync are implemented, local AI refinement is
implemented, and shared coop publishing is implemented. Live Safe, live archive delegation, and
live session-capability rails exist as separate second-gate or operator flows rather than the
default public posture.

## Current Status

As of March 28, 2026:

- the automated mock-first staged-launch bar is green
- Coop is documentable and demoable in its current mock-first posture
- the remaining public-release blocker is manual real-Chrome confirmation of popup `Capture Tab`
  and `Screenshot` success paths
- live Safe, archive, and session-capability rails remain a separate second gate

Current release references:

- [Current Release Status](docs/reference/current-release-status.md)
- [Testing & Validation](docs/reference/testing-and-validation.md)
- [Demo & Deploy Runbook](docs/reference/demo-and-deploy-runbook.md)
- [Live Rails Operator Runbook](docs/reference/live-rails-operator-runbook.md)

## How It Works

1. **Capture** -- Round up browser tabs with a shortcut in the extension. Record audio, snap
   photos, attach files, or share links from your phone through the companion receiver PWA.
2. **Refine** -- A local in-browser agent and inference cascade help turn captures into candidates,
   drafts, and next steps. Refinement runs locally in the browser through WebGPU/WASM/heuristic
   tiers rather than a hosted inference backend.
3. **Review** -- Members review candidates and drafts in the popup and `Chickens` before anything
   becomes shared coop state.
4. **Share** -- Publish reviewed drafts into a coop -- the group's shared workspace and memory
   layer -- sync them through Coop's local-first Yjs layer, open board and proof views, and export
   archive or proof material. Onchain, live archive, and operator execution flows remain mode-gated
   rather than default public behavior.

## Main Surfaces

In the current product:

- `Popup` handles quick capture, quick review, create/join flows, and feed access
- `Chickens` handles the working queue for candidates, drafts, and publish prep
- `Coops` handles shared coop state, board/proof access, and archive-related actions
- `Roost` is the Green Goods member workspace in the current UI
- `Nest` handles members, receiver pairing, operator controls, and settings
- `Receiver` is the mobile and secondary-device capture surface

The older product story still uses "Roost" as the metaphor for human judgment. In the live UI,
general review work now lives primarily in `Popup` and `Chickens`, while `Roost` is reserved for
Green Goods member actions.

## Use Cases

- **Community coordination groups** -- Bioregional networks, regen communities, and contributor
  circles can pool knowledge across members without centralizing raw context on a single platform.
- **Research and grant teams** -- Capture evidence across many sources, refine it locally, and turn
  the strongest leads into reviewed drafts and coop memory.
- **Capital formation and evidence packaging** -- Assemble attestations, work logs, and shared
  research into coherent proposals, with stronger onchain and archive rails available when those
  modes are intentionally enabled.
- **Families and friends** -- Use Coop as a shared memory capsule for trips, gardens, history, or
  any group project where everyone contributes fragments.
- **Personal knowledge management** -- Use Coop solo as a browser-first, local-first capture and
  review tool with optional sync, archive, and export paths.

## Key Features

### Implemented Today

- **Capture and intake** -- Browser tabs in the extension, plus audio, photos, files, and links in
  the receiver PWA. Cross-device receiver pairing lets mobile captures land in the extension's
  private intake before review.
- **Review and publish** -- Popup and `Chickens` workflows for candidate review, draft editing,
  categorization, and publish decisions.
- **Local AI refinement** -- A 16-skill agent pipeline with a three-tier local inference cascade
  (WebGPU, WASM, heuristics). The system is designed to work without hosted inference or API keys.
- **Local-first sync** -- Yjs CRDT sync with y-webrtc peers, y-websocket document sync support, and
  outbox tracking for publish-related events.
- **Board, proof, and export paths** -- Coop board views, archive receipts, and snapshot/artifact/
  receipt export flows are surfaced today.
- **Passkey-first identity** -- WebAuthn-based identity with no wallet-extension-first requirement.

### Available With Mode Or Gate Qualifiers

- **Onchain rails** -- Safe/ERC-4337 flows, anchor actions, and other live onchain behavior are
  mock-first by default and move behind a separate live gate when intentionally enabled.
- **Archive live rails** -- Storacha/Filecoin-backed archive delegation exists, but live archive
  credentials and trusted-node behavior are operator-only paths rather than the default public
  release posture.
- **Anonymity features** -- Coop's baseline privacy posture is local-first capture and explicit
  publish. Privacy mode surfaces anonymous-publish UI and stealth-address UI. The current anonymous
  publish path hides the author label in published artifacts; proof-backed ZK membership attachment
  remains an integration path rather than something this README should treat as fully shipped
  default behavior.
- **Green Goods workflows** -- Member work submission, operator approvals and assessments, GAP
  reconciliation, and Hypercert/Karma GAP packaging exist in the product model, with live behavior
  depending on mode, authority, and environment.
- **ERC-8004 / FVM registry** -- Agent identity and registry flows exist in the repo and runtime
  model, but should be read as gated infrastructure capabilities rather than baseline public-launch
  behavior.

### Anonymity, Archiving, and Portability Notes

- **Local-first by default** -- Raw captures stay local until a person explicitly shares or syncs
  them.
- **Anonymity is not the default** -- Anonymous publish is a user-enabled path, distinct from the
  baseline local-only capture model.
- **Export is the primary surfaced portability path today** -- Snapshot/artifact/receipt export is
  wired into the current UI. Restore/import primitives also exist in shared modules and tests, but
  they are not yet presented as the primary polished end-user recovery flow.

## Architecture

Bun monorepo with four runtime packages:

| Package | Description |
|---------|-------------|
| `@coop/shared` | Schemas, flows, sync contracts, and shared modules: agent, app, archive, auth, blob, coop, erc8004, fvm, greengoods, member-account, onchain, operator, permit, policy, privacy, receiver, session, stealth, storage, transcribe |
| `@coop/app` | Landing page + receiver PWA shell (audio, photo, file, link capture) |
| `@coop/extension` | MV3 browser extension -- popup (screen router, share menu), sidepanel (tab router, coop selector, filter popover), background handlers, offscreen workers |
| `@coop/api` | Hono + Bun TypeScript signaling relay with optional Yjs document sync persistence, deployed on Fly.io |

Build order: shared -> app -> extension (shared is the dependency root).

## Key Principles

- **Browser-First** -- The extension is the primary product surface; core capture and local analysis
  do not depend on hosted inference.
- **Local-First** -- All data stays on your device until you explicitly share. Dexie for structured
  data, Yjs for CRDT sync.
- **Passkey-First** -- No wallet extensions required. WebAuthn passkey identity bridged to onchain
  Safe accounts.
- **Offline Capable** -- Works without internet, syncs when connected.
- **Explicit Sharing** -- Review and publish remain human decisions. Anonymous publish is a
  separate user-enabled option, not the default path.

## Standards

ERC-4337 (account abstraction), ERC-1271 (signature validation), EIP-712 (typed structured data),
ERC-7579 (modular smart accounts), ERC-5564 (stealth addresses), ERC-8004 (onchain agent
registry), Semaphore (ZK group membership), Storacha/Filecoin (permanent archiving), Yjs CRDTs
(conflict-free sync).

## Local Development

Coop pins Node 22 in `.mise.toml`. Bun is the workspace package manager, but the docs site still
depends on a working Node toolchain.

Recommended shell bootstrap:

```bash
mise install
eval "$(mise activate zsh)"
node -v
```

`node -v` should report `v22.x` before you run the docs commands. If your shell still resolves an
older Node first, fix that before running `bun run docs:dev` or `bun run docs:build`.

```bash
bun install              # Install dependencies
bun dev                  # Start app + extension concurrently
bun dev:app              # Start app only
bun dev:extension        # Start extension only (WXT dev + Chromium)
bun dev:api              # Start API server
bun run test             # Run unit tests (vitest)
bun run test:e2e         # Run Playwright E2E tests
bun run test:visual      # Run visual regression tests
bun build                # Build everything (shared -> app -> extension)
bun format && bun lint   # Format (Biome) and lint workspace
bun run validate smoke   # Fast confidence pass
bun run validate:store-readiness
bun run validate:production-readiness
bun run validate:production-live-readiness
bun run validate list    # List all available validation suites
```

> **Note:** Always use `bun run test` (not `bun test`). The former runs vitest with proper environment configuration; the latter uses Bun's built-in runner and ignores vitest config.

## Environment

Single `.env.local` at the repository root (never create package-specific `.env` files).

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_COOP_CHAIN` | Target chain: `sepolia` or `arbitrum` | `sepolia` |
| `VITE_COOP_ONCHAIN_MODE` | On-chain mode: `mock` or `live` | `mock` |
| `VITE_COOP_ARCHIVE_MODE` | Archive mode: `mock` or `live` | `mock` |
| `VITE_COOP_SESSION_MODE` | Session mode: `off`, `mock`, or `live` | `off` |
| `VITE_COOP_PRIVACY_MODE` | Toggle privacy-mode surfaces such as anonymous publish UI and stealth-address UI (`on` or `off`) | `off` |
| `VITE_COOP_SIGNALING_URLS` | Comma-separated WebSocket signaling endpoints | `wss://api.coop.town` |
| `VITE_COOP_RECEIVER_APP_URL` | Receiver PWA base URL | `http://127.0.0.1:3001` |
| `VITE_PIMLICO_API_KEY` | For live Safe/ERC-4337 operations | -- |

For Playwright E2E runs, the repo starts its own local signaling server automatically.

## Release Posture

Coop's current release posture is mock-first.

- Automated mock-first release bar: `bun run test`, `bun run test:coverage`, `bun build`,
  `bun run validate:store-readiness`, and `bun run validate:production-readiness`
- Remaining public-release blocker: manual Chrome popup QA for real-click `Capture Tab` and
  `Screenshot`
- Live Safe, archive, and session-key rails remain a second gate behind
  `bun run validate:production-live-readiness`

For public Chrome Web Store candidates, keep `VITE_COOP_ONCHAIN_MODE`,
`VITE_COOP_ARCHIVE_MODE`, and `VITE_COOP_SESSION_MODE` on the mock-first path unless the
live-rails gate is intentionally being exercised.

Canonical references:

- [Current Release Status](docs/reference/current-release-status.md)
- [Testing & Validation](docs/reference/testing-and-validation.md)
- [Demo & Deploy Runbook](docs/reference/demo-and-deploy-runbook.md)
- [Live Rails Operator Runbook](docs/reference/live-rails-operator-runbook.md)

## Documentation

Current-state docs:

- [Action Domain Map](docs/reference/action-domain-map.md)
- [Current Release Status](docs/reference/current-release-status.md)
- [Demo & Deploy Runbook](docs/reference/demo-and-deploy-runbook.md)
- [Testing & Validation](docs/reference/testing-and-validation.md)
- [Receiver Pairing & Intake](docs/reference/receiver-pairing-and-intake.md)
- [Builder Getting Started](docs/builder/getting-started.md)
- [Architecture](docs/builder/architecture.md)
- [Extension](docs/builder/extension.md)
- [App](docs/builder/app.md)
- [Environment Reference](docs/builder/environment.md)
- [Live Rails Operator Runbook](docs/reference/live-rails-operator-runbook.md)
- [Extension Install & Distribution](docs/reference/extension-install-and-distribution.md)
- [Chrome Web Store Checklist](docs/reference/chrome-web-store-checklist.md)
- [Chrome Web Store Reviewer Notes](docs/reference/chrome-web-store-reviewer-notes.md)
- [Agent Harness](docs/reference/agent-harness.md)
- [Agent Registry & API Server](docs/reference/erc8004-and-api.md)

Deep reference and architecture:

- [Original Introduction](docs/reference/original-introduction.md)
- [Product Requirements](docs/reference/product-requirements.md)
- [Coop OS Architecture vNext](docs/reference/coop-os-architecture-vnext.md)
- [Knowledge Sharing & Scaling](docs/reference/knowledge-sharing-and-scaling.md)
- [Green Goods Integration](docs/reference/green-goods-integration-spec.md)
- [Privacy & Stealth Addresses](docs/reference/privacy-and-stealth.md)
- [Policy, Sessions & Permits](docs/reference/policy-session-permit.md)
- [Scoped Roadmap](docs/reference/scoped-roadmap-2026-03-11.md)
- [EF Mandate Alignment](docs/reference/ethereum-foundation-mandate.md)
- [Design Direction](docs/reference/coop-design-direction.md)
- [Audio & Asset Ops](docs/reference/coop-audio-and-asset-ops.md)

## Project Foundation

Coop is the browser-native coordination membrane built on ideas forming across the wider
community coordination work:

- Local-first collaboration over server-centric products
- Explicit shared memory instead of fragmented chat history
- Durable long-memory archives that communities can keep, fork, and migrate
- Impact, governance, and capital formation as connected workflows
- Green Goods as the onchain substrate for gardens, attestations, and collective capital flows

The goal is to make it easier for communities to move from context to coordination, from
coordination to evidence, and from evidence to capital. Each coop becomes a living knowledge garden
with a shared local-first memory membrane, stronger local analysis, long-memory publishing into
Filecoin, Green Goods garden bindings, and smart-account-mediated execution for proposals,
attestations, and treasury flows when those rails are intentionally enabled.

## Brand

Coop uses chicken metaphors throughout. Open browser tabs are **Loose Chickens**. The human review
step is still called the **Roost** in the product story, even though the current sidepanel `Roost`
tab is the Green Goods member workspace. The shared feed is the **Coop Feed**. Creating a new
shared space is **Launching the Coop**. The success chime is the **Rooster Call**.

![Coop Logo](https://media.discordapp.net/attachments/1334366927094677575/1483276397873987786/signal-2026-03-11-143552.png?ex=69ba004b&is=69b8aecb&hm=e2bcc8442bb7287a93a879c5e7e7336f028564053b6cfaa58ffc135383ae0d5e&=&format=webp&quality=lossless&width=1080&height=1080)
