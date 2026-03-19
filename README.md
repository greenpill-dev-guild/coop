# Coop

![Coop No more Chickens running loose](https://media.discordapp.net/attachments/1334366927094677575/1483276398956118127/signal-2026-03-11-173838.png?ex=69ba004b&is=69b8aecb&hm=f30d70ad2b2baa3c187601210d55b7a80b89a1e5b4cd9406b45f2f6105535d73&=&format=webp&quality=lossless&width=2240&height=298)

**A browser extension and companion PWA that captures scattered knowledge, refines it into clear opportunities, and gives groups a shared space to act on what matters.**

You have tabs open, voice memos unsaved, photos from a whiteboard session, links shared in a chat. Some of it is a funding lead. Some is a dead end. You won't remember which by Friday. Now multiply that across your whole team.

Coop captures knowledge from wherever it lives -- browser tabs, audio recordings, photos, files, shared links -- refines it into clear opportunities, and gives groups a shared space to act on what matters. It runs entirely in the browser. No cloud, no servers, no data leaving your device until you decide to share it.

## How It Works

1. **Capture** -- Round up browser tabs with a shortcut. Record audio, snap photos, attach files, or share links from your phone via the companion PWA.
2. **Refine** -- An in-browser AI agent analyzes captures through a 14-skill pipeline, extracting opportunities, scoring grant fit, clustering themes, and drafting briefs. All inference runs locally via WebGPU/WASM. Nothing leaves the browser.
3. **Review** -- Drafts land in the Roost. You decide what's signal and what's noise.
4. **Share** -- Publish to a coop -- a shared space backed by a Safe multisig on Arbitrum, syncing peer-to-peer over WebRTC. Shared artifacts are permanently archived to Filecoin via Storacha with full cryptographic provenance. Passkey identity, no wallet required.

Through its Green Goods integration, coops can also bootstrap on-chain gardens for governance, impact reporting, and capital formation -- turning shared knowledge into coordinated action with verifiable outcomes.

## Use Cases

- **Community coordination groups** -- Bioregional networks, regen communities, and DAO contributor circles can pool knowledge across members and surface funding-ready opportunities without centralizing data on a single platform.
- **Research teams tracking funding leads** -- Grant writers and research coordinators can capture evidence across dozens of sources, let the agent cluster and score it, and produce structured dossiers ready for submission.
- **Capital formation groups** -- Assembling funding packages from scattered evidence, attestations, and contributor work logs into coherent on-chain proposals backed by verifiable provenance.
- **Families and friends** -- Create shared memory capsules: trip planning boards, genealogy collections, community garden documentation, or any group project where everyone contributes pieces.
- **Personal knowledge management** -- Use Coop solo as a local-first capture and archiving tool with durable Filecoin storage, zero-knowledge privacy, and no vendor lock-in.

## Key Features

### Capture
Browser tabs (extension), audio recordings, photos, files, and links (companion PWA). Cross-device receiver lets you capture on your phone and review on desktop.

### AI Agent
14-skill pipeline running a three-tier inference cascade (WebGPU, WASM, heuristics). Opportunity extraction, grant fit scoring, theme clustering, brief drafting, and cross-session memory persistence. No API keys, no cloud calls.

### Sharing
Peer-to-peer sync via Yjs CRDTs and y-webrtc. Multi-coop publishing with per-coop feeds and board visualization.

### Identity
Passkey-first authentication via WebAuthn, bridged to Safe smart accounts through ERC-4337 account abstraction. No wallet extension required.

### Privacy
Semaphore zero-knowledge membership proofs for anonymous publishing. ERC-5564 stealth addresses for private on-chain interactions. All captures stay local-only until explicit share.

### Archiving
Storacha/Filecoin permanent storage with verifiable receipt chains. Every archived artifact carries full CID provenance linking capture to human review to permanent storage.

### Governance
Operator console for anchor node management. Policy engine with typed action bundles and approval workflows. Session permits with scoped execution permissions, time-bounded capabilities, and replay protection.

### Green Goods
Garden bootstrap and sync. Work approvals, impact reporting, and capital formation workflows. On-chain gardens as the substrate for governance and collective treasury flows.

### On-chain Agent
ERC-8004 agent registry integration for on-chain agent identity, capability advertisement, and reputation feedback.

## Architecture

Bun monorepo with four runtime packages:

| Package | Description |
|---------|-------------|
| `@coop/shared` | Schemas, flows, sync contracts, and 16+ domain modules: agent, app, archive, auth, coop, erc8004, greengoods, onchain, operator, permit, policy, privacy, receiver, session, stealth, storage |
| `@coop/app` | Landing page + receiver PWA shell (audio, photo, file, link capture) |
| `@coop/extension` | MV3 browser extension (popup, sidepanel, background worker, offscreen) |
| `@coop/api` | Hono + Bun TypeScript API server, deployed on Fly.io |

Build order: shared -> app -> extension (shared is the dependency root).

## Key Principles

- **Browser-First** -- The extension is the primary product surface; no cloud servers required for core functionality.
- **Local-First** -- All data stays on your device until you explicitly share. Dexie for structured data, Yjs for CRDT sync.
- **Passkey-First** -- No wallet extensions required. WebAuthn passkey identity bridged to on-chain Safe accounts.
- **Offline Capable** -- Works without internet, syncs when connected.
- **Privacy by Design** -- Zero-knowledge membership proofs, stealth addresses, local-only captures by default.

## Standards

ERC-4337 (account abstraction), ERC-1271 (signature validation), EIP-712 (typed structured data), ERC-7579 (modular smart accounts), ERC-5564 (stealth addresses), ERC-8004 (on-chain agent registry), Semaphore (ZK group membership), Storacha/Filecoin (permanent archiving), Yjs CRDTs (conflict-free sync).

## Local Development

```bash
bun install              # Install dependencies
bun dev                  # Start app + extension concurrently
bun dev:app              # Start app only
bun dev:extension        # Start extension only (watch build)
bun dev:api              # Start API server
bun run test             # Run unit tests (vitest)
bun run test:e2e         # Run Playwright E2E tests
bun build                # Build everything (shared -> app -> extension)
bun format && bun lint   # Format (Biome) and lint workspace
bun run validate full    # Full validation before merging
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
| `VITE_COOP_SIGNALING_URLS` | Comma-separated WebSocket signaling endpoints | -- |
| `VITE_PIMLICO_API_KEY` | For live Safe/ERC-4337 operations | -- |
| `VITE_STORACHA_ISSUER_URL` | For live Storacha archive delegation | -- |

For Playwright E2E runs, the repo starts its own local signaling server automatically.

## Documentation

- [Introduction](docs/intro.md)
- [Architecture Overview](docs/architecture/coop-os-architecture-vnext.md)
- [Agent Harness](docs/architecture/agent-harness.md)
- [Knowledge Sharing & Scaling](docs/architecture/knowledge-sharing-and-scaling.md)
- [Green Goods Integration](docs/architecture/green-goods-integration-spec.md)
- [Privacy & Stealth Addresses](docs/architecture/privacy-and-stealth.md)
- [Policy, Sessions & Permits](docs/architecture/policy-session-permit.md)
- [Agent Registry & API Server](docs/architecture/erc8004-and-api.md)
- [Product Requirements](docs/product/prd.md)
- [Scoped Roadmap](docs/product/scoped-roadmap-2026-03-11.md)
- [EF Mandate Alignment](docs/product/ethereum-foundation-mandate.md)
- [Extension Install & Distribution](docs/getting-started/extension-install-and-distribution.md)
- [Design Direction](docs/guides/coop-design-direction.md)
- [Audio & Asset Ops](docs/guides/coop-audio-and-asset-ops.md)
- [Testing & Validation](docs/guides/testing-and-validation.md)
- [Demo & Deploy Runbook](docs/guides/demo-and-deploy-runbook.md)

## Regen Coordination Foundation

Coop is the browser-native coordination membrane built on ideas forming across the wider regen-coordination work:

- Local-first collaboration over server-centric products
- Explicit shared memory instead of fragmented chat history
- Durable long-memory archives that communities can keep, fork, and migrate
- Impact, governance, and capital formation as connected workflows
- Green Goods as the on-chain substrate for gardens, attestations, and collective capital flows

The goal is to make it easier for communities to move from context to coordination, from coordination to evidence, and from evidence to capital. Each coop becomes a living knowledge garden with a shared local-first memory membrane, anchor nodes running stronger inference, long-memory publishing into Filecoin, Green Goods garden bindings, and smart-account-mediated execution for proposals, attestations, and treasury flows.

## Brand

Coop uses chicken metaphors throughout. Open browser tabs are **Loose Chickens**. The review queue is the **Roost**. The shared feed is the **Coop Feed**. Creating a new shared space is **Launching the Coop**. The success chime is the **Rooster Call**.

![Coop Logo](https://media.discordapp.net/attachments/1334366927094677575/1483276397873987786/signal-2026-03-11-143552.png?ex=69ba004b&is=69b8aecb&hm=e2bcc8442bb7287a93a879c5e7e7336f028564053b6cfaa58ffc135383ae0d5e&=&format=webp&quality=lossless&width=1080&height=1080)
