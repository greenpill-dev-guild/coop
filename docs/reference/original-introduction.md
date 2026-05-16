---
title: "Original Introduction"
slug: /reference/original-introduction
---

# Coop

:::note

Historical note: this introduction is preserved for origin-story context. It predates the current
release posture and runtime split. For current behavior, use
[Action Domain Map](/reference/action-domain-map), [Builder Architecture](/builder/architecture),
and [Demo & Deploy Runbook](/reference/demo-and-deploy-runbook).

:::

> No more chickens loose.

**A browser extension and companion PWA that captures scattered knowledge, refines it into clear opportunities, and gives groups a shared space to act on what matters.**

You have tabs open, voice memos unsaved, photos from a whiteboard session, links shared in a chat. Some of it is a funding lead. Some is a dead end. You won't remember which by Friday. Now multiply that across your whole team.

Coop captures knowledge from wherever it lives (browser tabs, audio recordings, photos, files,
shared links), refines it into clear opportunities, and gives groups a shared space to act on what
matters. Core capture and local analysis run in the browser. Shared state still uses a small sync
layer and only leaves your device when you publish or sync it.

## How it works

1. **Capture**: Round up browser tabs with a shortcut. Record audio, snap photos, attach files, or share links from your phone via the companion PWA.
2. **Refine**: An in-browser AI agent analyzes captures through a 16-skill pipeline, extracting opportunities, scoring grant fit, clustering themes, and drafting briefs. All inference runs locally via WebGPU/WASM. Nothing leaves the browser.
3. **Review**: Members review candidates and drafts in the popup and Chickens before anything becomes shared.
4. **Share**: Publish to a coop, a shared space backed by a Safe multisig on Arbitrum, syncing
   through Coop's local-first Yjs layer and archived to Filecoin via Storacha when a group requests
   durable proof. Passkey identity, no wallet required.

Through its Green Goods integration, coops can also bootstrap on-chain gardens, submit member work, run operator-side approvals and assessments, and package approved work into Hypercert and Karma GAP workflows.

## Key Principles

- **Browser-First**: The extension is the primary product surface; core capture and refine flows do not require hosted inference
- **Local-First**: All data stays local until you explicitly share
- **Passkey-First**: No wallet extensions required; WebAuthn passkey identity bridged to on-chain accounts
- **Offline Capable**: Works without internet, syncs when connected
- **Privacy by Design**: Zero-knowledge membership proofs, stealth addresses, local-only captures

## Packages

| Package | Description |
|---------|-------------|
| `@coop/shared` | Schemas, flows, sync contracts, and 20 exported domain modules |
| `@coop/app` | Landing page + receiver PWA (audio, photo, file, link capture) |
| `@coop/extension` | MV3 browser extension (popup, sidepanel, background, offscreen) |
| `@coop/api` | Hono + Bun API server (Fly.io deployed) |

## What's novel

- **The agent runs in your browser.** Three-tier inference cascade (WebGPU, WASM, heuristics) with a skill DAG that chains analysis steps. No API keys, no cloud calls, no data exfiltration.
- **Capture from anywhere.** Desktop tabs and mobile sensors (mic, camera, file picker) feed the same pipeline. Pair your phone once, capture on the go, review on desktop.
- **Zero-knowledge participation.** Publish anonymously via Semaphore proofs. Prove you're a member without revealing who you are. ERC-5564 stealth addresses for private on-chain interactions.
- **Filecoin as knowledge provenance.** Not backup, proof. Every archived artifact carries a verifiable receipt chain linking capture to human review to permanent storage.
- **Passkey-first identity** bridged to Safe smart accounts (ERC-4337). The UX is WebAuthn, the backend is a real multisig.

## Standards

ERC-4337, ERC-1271, EIP-712, ERC-7579, ERC-5564, ERC-8004, Semaphore, Storacha/Filecoin, Yjs CRDTs

## Local Development

```bash
bun install            # Install dependencies
bun dev                # Start app + extension concurrently
bun dev:api            # Start API server
bun run test           # Run tests
bun run build          # Build everything
bun run validate:production-readiness  # Staged-launch validation
```

## Learn More

- [Builder Getting Started](/builder/getting-started)
- [Architecture Overview](/builder/architecture)
- [P2P Functionality](/builder/p2p-functionality)
- [Browser-Native Agent Harness](/reference/agent-harness)
- [Privacy & Security](/privacy-security)
- [Reference: Policy, Sessions & Permits](/reference/policy-session-permit)
- [Reference: ERC-8004 & API Server](/reference/erc8004-and-api)
- [Product Requirements](/reference/product-requirements)
- [The Road Ahead](/road-ahead)
- [EF Mandate Alignment](/reference/ethereum-foundation-mandate)
