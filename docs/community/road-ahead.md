---
title: The Road Ahead
slug: /road-ahead
---

# The Road Ahead

Coop is past early proof-of-concept. The foundation is working, and the direction ahead is about
making the product stronger, more trustworthy, and easier for communities to rely on.

## What Is Already Landed

As of March 2026, these pieces are already in place:

- the receiver PWA for mobile capture and pairing
- sync from the receiver into extension intake
- the Arbitrum and Sepolia chain posture
- the read-only board view
- the operator and anchor-mode runtime for trusted execution
- the core browser-native agent harness and approval model

That means Coop is already past the stage of being only a landing page plus a rough extension demo.

## What Is Next

The near-term direction is to make the working loop stronger and easier to trust:

- improve the review experience so multi-coop and ritual workflows feel clearer
- deepen local model execution without making it mandatory for every capture
- make Filecoin follow-up and archive lifecycle states more legible
- keep tightening the relationship between passkey identity, Safe accounts, and bounded actions

This is mostly product hardening, not a pivot.

## What Is Still Deliberately Deferred

Some ideas are active research, but they are not the current promise:

- autonomous execution without clear approval boundaries
- full session-key-driven governance and capital flows as the default path
- arbitrary onchain execution from open-ended model output
- broader mobile ingestion and heavy archive browsing UX

Those are important directions, but the docs should not present them as already delivered.

## The Current Product Reading

The intended trajectory is:

1. make capture and review reliable
2. make publish and shared memory legible
3. keep the privacy boundary obvious
4. expand the agent and onchain layers behind policies, logs, and bounded capabilities

## Four Strategic Bets

These are the near-term bets that shape where Coop is heading. They are not promises -- they are
the directions we are actively investing in.

### 1. React Flow Knowledge Exploration

The board route already renders published artifacts as a graph. The bet is that an interactive
React Flow canvas becomes the primary way groups explore what they know -- navigating connections
between captures, drafts, and published opportunities rather than scrolling a flat feed.

### 2. Coop OS

Coop OS is the idea that the agent harness, skill pipeline, policy engine, and session-key
boundaries form a reusable operating system for browser-native coordination. Instead of one
product, the same primitives could power different community shapes: DAOs, research groups,
neighborhood coops, mutual aid networks.

### 3. PWA Upgrades

The receiver PWA handles mobile capture and pairing today. The bet is that deeper PWA
capabilities -- offline-first sync, background fetch, push notifications, and richer media
handling -- make the mobile surface a genuine peer to the extension rather than a thin relay.

### 4. Community Coop Calls With Coop Knowledge Sharing

Live calls between coop members where the agent captures, synthesizes, and publishes shared
knowledge in real time. The call itself becomes a coordination primitive: knowledge enters as
conversation, passes through the agent harness, and exits as structured, reviewable artifacts.

## Core Tenets

These four principles are not aspirational -- they describe the current architecture and inform
every product decision.

1. **Browser-first.** The extension is the primary product surface. No server dependency for
   core capture, synthesis, or review.
2. **Local-first.** All data stays on the device until explicit publish or sync. The user is
   always in control of what becomes shared.
3. **Passkey-first.** Identity starts with passkeys, not wallet extensions. Onchain identity
   is derived from the passkey, keeping the onboarding path simple.
4. **Explicit publish.** Nothing becomes shared without human review and confirmation. The agent
   proposes, the human disposes.

## Coordination Integrity (Provisional)

> **Note:** The framing in this section draws on the
> [Durgadas Coordination Structural Integrity Suite](https://github.com/durgadasji/standards).
> This is provisional -- the framework is maintained externally and has not been formally adopted
> by the Coop project. We reference it because it articulates why coordination tools need
> structural integrity guarantees (transparency, auditability, bounded execution) that align
> closely with how Coop already works.

The core argument: coordination infrastructure should make it structurally difficult for any
single actor to silently capture or redirect group value. Coop's architecture -- local-first
storage, passkey identity, Safe multisig, session-key boundaries, and Filecoin archival --
was not designed to satisfy a framework, but the alignment is real and worth naming.

## Where To Look For More Detail

- Read [AI Features](/ai-features) for the current browser-side agent story.
- Read [Sharing Knowledge](/sharing-knowledge) for the feed, board, and archive path.
- Read [Builder R&D](/builder/rd) if you want the technical risks and research lanes.
