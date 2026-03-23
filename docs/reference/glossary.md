---
title: Glossary
slug: /glossary
---

# Glossary

This page is shared across the Community and Builder navigation. The first section keeps the product
language plain. The second groups the more technical terms that show up in architecture and runtime
docs.

## Community Terms

### Coop

A shared space where a group captures, reviews, publishes, and remembers knowledge together.

### Loose Chickens

The working metaphor for browser tabs and other scattered context that has not been organized yet.

### Roost

The review queue where drafts are edited, evaluated, and prepared before publish.

### Coop Feed

The shared feed of published artifacts inside a coop.

### Launching The Coop

The product phrase for creating a new coop and running its setup ritual.

### Trusted Member

A member with elevated responsibility for more sensitive or bounded operations.

### Receiver

The companion app surface used for mobile or secondary-device capture such as audio, photos, files,
and links.

### Rooster Call

The success sound and feedback moment played when a significant action completes in the extension.

### Archive Receipt

A receipt that records the outcome of a durable archive action so the provenance trail remains
visible.

### Chickens Tab

The tab in both popup footer nav and sidepanel showing captured tab candidates — browsed and
bookmarked tabs awaiting review.

### Coops Tab

The sidepanel tab for coop feed, archive stories/receipts, and coop management (create, join,
member views).

### Nest

The sidepanel administration tab containing agent controls, receiver management, invite generation,
archive settings, and general extension settings.

### Seed Contribution

The initial piece of context a creator or joining member adds so the coop starts with real material
rather than an empty shell.

### Share Menu

The popup UI for sharing drafts or artifacts to specific coops.

## Builder Terms {#builder-terms}

### Action Bundle

A typed, policy-governed envelope for privileged actions, including digest, replay protection, and
approval state.

### Anchor Mode

The trusted-node or operator posture that allows the runtime to handle privileged jobs when policies
and roles allow it.

### Blob Relay

Peer-to-peer binary data relay protocol (`blob/relay.ts`) for transporting media captures (photos,
audio, files) between peers via WebRTC data channels.

### Capture Exclusion

URL patterns (e.g., internal Chrome pages, extension URLs) excluded from passive tab capture by the
agent.

### Data Portability

Encrypted export/import system (`storage/portability.ts`) for moving coop data between devices using
PBKDF2 key derivation.

### Design Tokens

The CSS custom property system in `packages/shared/src/styles/tokens.css` defining palette, spacing,
radii, shadows, typography, z-index scale, and dark mode overrides.

### Dexie

The IndexedDB wrapper used for structured local persistence in the browser.

### Filecoin

The durable archive substrate used for long-memory, provenance, and verifiable receipt chains.

### Member Account

Kernel-based member accounts bridging passkey identity to Safe co-signer roles for on-chain
governance.

### Outbox

Offline-first sync queue (`coop/outbox.ts`) that buffers publish operations when offline and retries
with exponential backoff when connectivity returns.

### Permit

Scoped off-chain authorization used for bounded delegated actions such as archive-related work.

### Safe

The smart-account structure Coop uses for group identity and bounded onchain execution.

### Session

A time-bounded capability for constrained onchain execution, usually paired with allowlists and
limits.

### Signaling Relay

The lightweight server that helps peers discover each other so WebRTC connections for sync can be
formed.

### Storacha

The delegated upload layer Coop uses to push archive data toward Filecoin-backed durability.

### Token Linting

The `scripts/lint-tokens.ts` enforcement script that validates CSS files use design tokens instead of
raw color/spacing values.

### UI Catalog

Standalone Vite-served design token viewer (`packages/extension/src/catalog/`) for previewing
palette, spacing, radius, and shadow tokens in light and dark themes.

### WebLLM

The browser-side WebGPU inference layer used for higher-value local synthesis when the device can
support it.

### Yjs

The CRDT layer used for shared coop state and peer replication.
