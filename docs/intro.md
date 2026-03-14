---
title: "Introduction"
sidebar_label: "Introduction"
sidebar_position: 1
slug: /intro
---

# Coop

> No more chickens loose.

**A browser extension and companion PWA that captures scattered knowledge, refines it into clear opportunities, and gives groups a shared space to act on what matters.**

You have tabs open, voice memos unsaved, photos from a whiteboard session, links shared in a chat. Some of it is a funding lead. Some is a dead end. You won't remember which by Friday. Now multiply that across your whole team.

Coop captures knowledge from wherever it lives (browser tabs, audio recordings, photos, files, shared links), refines it into clear opportunities, and gives groups a shared space to act on what matters. It runs entirely in the browser. No cloud, no servers, no data leaving your device until you decide to share it.

## How it works

1. **Capture**: Round up browser tabs with a shortcut. Record audio, snap photos, attach files, or share links from your phone via the companion PWA.
2. **Refine**: An in-browser AI agent analyzes captures through a 12-skill pipeline, extracting opportunities, scoring grant fit, clustering themes, and drafting briefs. All inference runs locally via WebGPU/WASM. Nothing leaves the browser.
3. **Review**: Drafts land in the Roost. You decide what's signal and what's noise.
4. **Share**: Publish to a coop, a shared space backed by a Safe multisig on Arbitrum, syncing peer-to-peer over WebRTC. Shared artifacts are permanently archived to Filecoin via Storacha with full cryptographic provenance. Passkey identity, no wallet required.

Through its Green Goods integration, coops can also bootstrap on-chain gardens for governance, impact reporting, and capital formation, turning shared knowledge into coordinated action with verifiable outcomes.

## Key Principles

- **Browser-First**: The extension is the primary product surface; no cloud servers required
- **Local-First**: All data stays local until you explicitly share
- **Passkey-First**: No wallet extensions required; WebAuthn passkey identity bridged to on-chain accounts
- **Offline Capable**: Works without internet, syncs when connected
- **Privacy by Design**: Zero-knowledge membership proofs, stealth addresses, local-only captures

## Packages

| Package | Description |
|---------|-------------|
| `@coop/shared` | Schemas, flows, sync contracts, and 16 domain modules |
| `@coop/app` | Landing page + receiver PWA (audio, photo, file, link capture) |
| `@coop/extension` | MV3 browser extension (popup, sidepanel, background, offscreen) |
| `@coop/signaling` | y-webrtc signaling server (Fly.io deployed) |

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
bun dev:signaling      # Start signaling server
bun run test           # Run tests
bun build              # Build everything
bun run validate full  # Validate before merging
```

## Learn More

- [Install the Extension](/docs/getting-started/extension-install-and-distribution)
- [Architecture Overview](/docs/architecture/coop-os-architecture-vnext)
- [Knowledge Sharing & Scaling](/docs/architecture/knowledge-sharing-and-scaling)
- [Agent Harness](/docs/architecture/agent-harness)
- [Product Requirements](/docs/product/prd)
- [Scoped Roadmap](/docs/product/scoped-roadmap-2026-03-11)
- [EF Mandate Alignment](/docs/product/ethereum-foundation-mandate)
