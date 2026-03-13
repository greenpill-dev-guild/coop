# Coop

Coop is a browser-first knowledge commons for local and bioregional coordination.

We are building the first hackathon iteration of Coop for the [PL_Genesis: Frontiers of Collaboration Hackathon](https://pl-genesis-frontiers-of-collaboration-hackathon.devspot.app/) on DevSpot. As of March 10, 2026, submissions for that event close on March 16, 2026.

## Why We Are Building Coop

Communities already generate the raw material for coordination:

- tabs
- articles
- voice notes
- field observations
- funding leads
- partial plans

What is usually missing is the membrane that turns scattered knowledge into shared memory, funding readiness, and durable capital formation.

Coop exists to close that gap.

The first version of Coop is a paired landing page and browser extension that helps members:

- passively notice relevant context while browsing
- round up relevant tabs into a review queue
- route knowledge into one or more coops
- structure shared evidence into a shared coop memory
- archive approved artifacts or snapshots into Storacha/Filecoin
- export structured coop data for use in outside tools

## Hackathon Context

We are participating in:

- [PL_Genesis: Frontiers of Collaboration Hackathon](https://pl-genesis-frontiers-of-collaboration-hackathon.devspot.app/)
- [Coop project page on DevSpot](https://devspot.app/projects/1275)

This is a strong fit for Coop because the event is centered on coordination, governance, and shared intelligence infrastructure. The current hackathon framing also aligns with where Coop is strongest:

- browser-native collaboration
- local-first and P2P coordination
- AI-assisted synthesis
- Filecoin and Storacha long-memory storage
- offchain knowledge flowing into onchain capital formation

## Long-Term Vision

Coop is not just a capture tool.

Long term, each coop becomes a living knowledge garden with:

- a shared local-first memory membrane
- anchor nodes that run stronger inference and recurring workflows
- long-memory publishing into Storacha and Filecoin
- Green Goods garden bindings for capital formation
- smart-account mediated execution for proposals, attestations, treasury flows, and other collective actions

The larger goal is to make it easier for communities to move from context to coordination, from coordination to evidence, and from evidence to capital.

## Regen Coordination Foundation

Coop is being built on top of ideas that have been forming across the wider regen-coordination work:

- local-first collaboration over server-centric products
- explicit shared memory instead of fragmented chat history
- durable long-memory archives that communities can keep, fork, and migrate
- impact, governance, and capital formation as connected workflows
- Green Goods as the onchain substrate for gardens, attestations, and collective capital flows

In that sense, Coop is the browser-native coordination membrane around Green Goods. It is designed to help a community gather knowledge offchain, structure it collaboratively, and then push the right artifacts into Green Goods capital surfaces such as gardens, smart accounts, conviction voting, cookie-jar style flows, and related treasury mechanisms.

## Planned Repo Structure

```text
docs/
packages/
  app/
  extension/
  shared/
package.json
README.md
```

`packages/shared` is intended to hold most of the product logic and contracts, with thin runtime packages on top.

At the `src` level, the repo now follows a more modular layout:

- `packages/shared/src/contracts`, `packages/shared/src/modules`, `packages/shared/src/utils`
- `packages/extension/src/runtime`, `packages/extension/src/views`
- `packages/app/src` for the landing page plus the paired receiver PWA shell

## Core Documents

- [docs/coop-os-architecture-vnext.md](docs/coop-os-architecture-vnext.md) — canonical Coop v1 build plan
- [docs/coop-design-direction.md](docs/coop-design-direction.md) — initial visual direction, palette, and asset usage guide
- [docs/coop-audio-and-asset-ops.md](docs/coop-audio-and-asset-ops.md) — audio sourcing, licensing, naming, and asset handoff guide
- [docs/extension-install-and-distribution.md](docs/extension-install-and-distribution.md) — local testing install flow, early-access website distribution, and Chrome Web Store rollout
- [docs/meeting-followups-2026-03-10.md](docs/meeting-followups-2026-03-10.md) — relevant Build 1 follow-ups distilled from the March 10, 2026 meeting notes
- [docs/current-state-2026-03-11.md](docs/current-state-2026-03-11.md) — implementation review against the March architecture drafts and meeting notes
- [docs/scoped-roadmap-2026-03-11.md](docs/scoped-roadmap-2026-03-11.md) — phased plan for receiver PWA, Arbitrum, Filecoin, visual flow, and agentic extensions
- [docs/testing-and-validation.md](docs/testing-and-validation.md) — named validation suites plus manual QA guidance
- [docs/reference/org-os-and-reactflow-context.md](docs/reference/org-os-and-reactflow-context.md) — archived context for Org-OS and React Flow scope decisions

## Current State

Coop v1 is now implemented as a Bun workspace with:

- `packages/app` for the landing page
- `packages/extension` for the MV3 runtime and sidepanel-first UX
- `packages/shared` for schemas, flows, sync contracts, archive contracts, and reusable business logic

The repo currently validates with:

- `bun run lint`
- `bun run test`
- `bun run test:coverage`
- `bun run build`
- `bun run test:e2e`
- `bun run validate list`
- `bun run validate smoke`
- `bun run validate core-loop`
- `bun run validate receiver-slice`
- `bun run validate receiver-hardening`
- `bun run validate flow-board`
- `bun run validate arbitrum-safe-live`
- `bun run validate full`

For targeted E2E runs:

- `bun run test:e2e:app`
- `bun run test:e2e:app:mobile`
- `bun run test:e2e:extension`
- `bun run test:e2e:receiver-sync`

## Local Development

Install dependencies with Bun, then run the pieces you need:

```bash
bun install
bun run dev:app
bun run dev:extension
bun run dev:signaling
```

The extension uses explicit signaling URLs instead of assuming a public signaling service is healthy. For local multi-profile sync and end-to-end tests, run the local signaling server on `ws://127.0.0.1:4444` or point `VITE_COOP_SIGNALING_URLS` at your own hosted `ws://` or `wss://` endpoints.

## Extension Env

Create `packages/extension/.env.local` from the example file and fill in the values you actually want to use:

- `VITE_COOP_CHAIN` controls the Safe deployment chain and only accepts `sepolia` or `arbitrum`
- `VITE_COOP_ONCHAIN_MODE` selects `mock` or `live`
- `VITE_COOP_SIGNALING_URLS` is a comma-separated list of WebSocket signaling endpoints
- `VITE_COOP_ARCHIVE_MODE` selects `mock` or `live`
- `VITE_COOP_TRUSTED_NODE_ARCHIVE_*` bootstraps local trusted-node archive delegation config into the extension
- leave `VITE_COOP_CHAIN` unset or set it to `sepolia` for the default test and development path
- set `VITE_COOP_CHAIN=arbitrum` only when you explicitly want the production chain target
- `bun run validate arbitrum-safe-live` runs non-live checks by default and only attempts a real Sepolia Safe deployment when `VITE_PIMLICO_API_KEY` and `COOP_ONCHAIN_PROBE_PRIVATE_KEY` are exported

For Playwright E2E runs, the repo starts its own local signaling server automatically.
