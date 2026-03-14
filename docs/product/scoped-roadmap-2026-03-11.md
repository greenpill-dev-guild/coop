---
title: "Scoped Roadmap"
sidebar_label: "Roadmap"
sidebar_position: 2
---

# Coop Scoped Roadmap

Date: March 11, 2026

This roadmap scopes the requested expansion on top of the current repo state. It is intentionally split into:

- `Hackathon-complete`: what can realistically raise the demo ceiling in the next few days
- `Near-term platform`: what should start immediately after the demo-critical slice is stable
- `Agentic platform`: what needs a second architecture pass and should not be mixed into the first delivery cut

## 1. Delivery Principle

The current implementation already has one strong center: the extension is the primary node and product surface.

The safest way to grow from here is:

1. keep the extension as the primary durable node
2. add the app as a real receiver PWA
3. keep raw captures local until explicit sync or publish
4. add stronger visual review and multi-coop UX before deep autonomy
5. move onchain and agentic capability behind explicit policies, logs, and feature flags

That lets Coop become much more complete without destabilizing the working core loop.

For v1 onchain scope, Coop should target one production chain and one test/dev chain:

- `Arbitrum One` for production
- `Ethereum Sepolia` for test and development
- no additional chain targets in scope

## 2. Current Standards Choices

For the agentic and onchain roadmap, these are the right standards to plan around today:

- [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) for smart-account execution via `UserOperation`
- [ERC-1271](https://eips.ethereum.org/EIPS/eip-1271) for contract-based signature validation
- [EIP-712](https://eips.ethereum.org/EIPS/eip-712) for typed intent and action signing
- [ERC-7579](https://eips.ethereum.org/EIPS/eip-7579) as the modular smart-account direction to keep the account architecture extensible
- [ERC-7715](https://eips.ethereum.org/EIPS/eip-7715) as the emerging wallet permission request flow for scoped execution permissions
- [Safe ERC-4337 module docs](https://docs.safe.global/advanced/erc-4337/4337-safe) for the most practical Safe-based account-abstraction path
- [Storacha upload guide](https://docs.storacha.network/how-to/upload/) for delegated upload architecture
- [Storacha Filecoin info](https://docs.storacha.network/how-to/filecoin-info/) for piece-level deal and proof follow-up

Important caution:

- [Safe EIP-7702 guidance](https://docs.safe.global/advanced/eip-7702/7702-safe) is still experimental. It should stay out of the demo-critical path.

Planning implication:

- Use `ERC-4337 + ERC-1271 + EIP-712 + Safe modules` as the production direction.
- Treat `ERC-7715` as a compatibility target, not a guaranteed dependency.
- Treat `EIP-7702` as a research lane, not the core architecture.

## 3. Scope By Horizon

### 3.1 Hackathon-Complete

This is the highest-value scope for the next few days:

- receiver PWA with local capture and pairing: **DONE**
- playful mobile capture UX: **DONE**
- sync from receiver to extension: **DONE**
- Arbitrum switch in the onchain layer: **DONE** (Sepolia default, Arbitrum available)
- Filecoin/Storacha flow surfaced as a visible product story: **PARTIAL** (archive works, no piece-level follow-up)
- ritual scheduler and meeting-mode review surface: **NOT STARTED** (form fields stored but inert)
- stronger multi-coop UX: **PARTIAL** (works technically, UX is shallow)
- read-only React Flow knowledge view on desktop: **DONE**

### 3.2 Near-Term Platform

This should start immediately after the hackathon-critical slice is stable:

- real local model execution path: **STUBBED** (heuristic only)
- trusted-node or anchor runtime behavior: **CONCEPTUAL** (role flags exist, no operational anchor)
- trusted-node local delegation for live archive upload: **DONE** (runs in trusted extension nodes)
- Filecoin lifecycle follow-up using piece-level info: **NOT STARTED**
- richer identity envelopes and signed coop events: **PARTIAL** (passkey works, no DID/signed envelopes)

### 3.3 Agentic Platform

This should be scoped as a second architecture milestone:

- autonomous agent execution with scoped permissions: **NOT STARTED** (correctly deferred)
- session-key or delegated execution policy model: **NOT STARTED**
- coop-level Ethereum agent identity: **NOT STARTED**
- capital and governance execution flows driven by typed intents and review policies: **NOT STARTED**

## 4. Workstream Plan

## 4.1 Receiver PWA: DONE

### Goal

Turn `packages/app` from a landing-only surface into a real installable receiver that captures audio first, then optional media and files, stores them locally, and syncs them into the paired extension when online.

### Hackathon-Complete Scope

- add a web app manifest and service worker
- add routes:
  - `/` public landing
  - `/pair` pairing flow
  - `/receiver` capture shell
  - `/inbox` local capture inbox
  - `/board/:coopId` desktop board surface
- make audio the primary capture action
- add secondary actions:
  - photo capture from device camera
  - file attach from device storage
- store metadata in Dexie and raw blobs in IndexedDB or OPFS
- pair to extension via QR or deep-link payload generated by the extension
- sync captured items into a member-private outbox that the extension reads and ingests

### UX Direction

- primary action is a large egg button
- press or tap to record: egg pulses
- after capture completes: egg animates into a chick card in the inbox
- each capture becomes a “nest item” with type, timestamp, coop targets, and sync state

### Web APIs To Use

- `navigator.mediaDevices.getUserMedia`
- `MediaRecorder`
- `<input accept="image/*" capture="environment">`
- file input fallback for generic device files
- service worker and install prompt
- IndexedDB or OPFS for local blobs
- `navigator.onLine`
- `WakeLock` where available during recording
- vibration and notifications where supported
- Web Share and Share Target as a later enhancement, not day-one

### Pairing Model

- extension generates a pair payload containing:
  - coop ID
  - member ID
  - pair secret
  - receiver sync room info
  - signaling URLs
- PWA scans QR or opens deep link
- PWA creates a device-local receiver identity and stores the pair secret
- captures sync into a member-private queue, not directly into shared coop memory
- extension converts synced captures into candidates or drafts

### Validation

- unit tests for capture storage and pair parsing
- Playwright mobile tests for audio/photo/file creation
- Playwright cross-context tests for pair + sync + offline queue replay

## 4.2 Local Enhancement Path: STUBBED

### Goal

Move from pure heuristics to a real local inference path without making the extension fragile.

### Hackathon-Complete Scope

- refactor the current enhancement adapter behind a `LocalInferenceProvider` interface
- add explicit capability detection UI
- add an opt-in “Refine locally” action on a draft instead of running a model on every tab

### Near-Term Platform

- run the local model in a dedicated worker owned by the sidepanel or a long-lived UI context
- keep heuristics as fallback
- start with one narrow task:
  - title refinement
  - tag suggestion
  - summary compression

### Recommended Cut

Do not make full WebLLM a blocker for the hackathon demo. Land the interface, capability detection, and one explicit local-refine action first.

## 4.3 Trusted-Node Or Anchor Runtime: CONCEPTUAL

### Goal

Make “trusted member” and “anchor” mean something operationally, not just in shared data.

### Hackathon-Complete Scope

- add an `anchor mode` capability flag in the extension
- gate scheduled jobs, live archive upload, and live onchain actions behind anchor mode
- add an action log panel for outward or privileged actions

### Near-Term Platform

- secret handling for archive delegation and social/channel credentials
- job runner for:
  - recurring round-up
  - archive follow-up
  - review digest generation
- optional cloud-backed enhancement only for anchor nodes

## 4.4 Arbitrum Mainnet And Sepolia Test Path: DONE

### Goal

Move the onchain path from the current Celo-only implementation to an Arbitrum mainnet plus Ethereum Sepolia test path, while sequencing Green Goods binding separately.

### Hackathon-Complete Scope

- remove Celo and any extra chain support from shared config and runtime parsing
- support only `arbitrum` and `sepolia`
- update runtime env parsing, deployment helpers, and UI labeling
- validate Safe deployment on Ethereum Sepolia first
- keep mock mode fully available

### Near-Term Platform

- define the Coop smart-account adapter for Green Goods actions
- add typed action builders for:
  - attach coop as owner or operator
  - propose garden-related actions
  - record garden linkage in shared state

### Recommended Cut

For the demo, “Coop creates and controls a Safe on Arbitrum, with Sepolia as the test path” is enough. Full Green Goods garden binding should be its own workstream after that chain standardization is stable.

## 4.5 Archive Delegation And Filecoin Story: PARTIAL

### Goal

Make Filecoin long memory a visible Coop strength, not just a hidden receipt field.

### Hackathon-Complete Scope

- productize three archive modes:
  - artifact capsule
  - coop snapshot
  - memory seed bundle
- expose archive receipts clearly in the UI
- show gateway URL, root CID, and archive purpose
- let members mark “archive-worthy” captures or artifacts during review

### Near-Term Platform

- embed minimal trusted-node delegation in the extension for live upload
- persist piece CIDs during upload
- add follow-up job to call Storacha `filecoin/info`
- surface proof or deal data in the UI when available

### Powerful Hackathon Positioning

Use Filecoin differently across Coop types:

- community coop: weekly memory snapshot
- family or friends coop: durable shared memory capsule
- personal coop: research archive or life log checkpoint
- capital formation coop: proof-backed funding dossier bundle

## 4.6 Review Rituals, Meeting Mode, And Scheduler: NOT STARTED

### Goal

Turn review from a passive grouped list into an actual social ritual surface.

### Hackathon-Complete Scope

- add ritual config to the coop:
  - weekly day
  - review hour
  - facilitator note
- surface “next review” and “meeting mode” in the UI
- add a meeting-mode screen optimized for:
  - latest captures
  - candidate drafts
  - archive-worthy items
  - approval decisions

### Near-Term Platform

- extension alarm integration for reminders
- digest generation for the review session
- facilitator controls for agenda sections and approval batches

## 4.7 Multi-Coop UX: PARTIAL

### Goal

Make multi-coop membership feel native instead of technically possible.

### Hackathon-Complete Scope

- visible coop switcher in the extension and board UI
- draft target editing before publish
- quick route presets:
  - current coop
  - multiple coops
  - private only
- show “why this matched this coop”

### Near-Term Platform

- member-level routing preferences
- passive ranking based on recent archive and publish history
- inbox filters by coop, member, and ritual lens

## 4.8 Identity Model: PARTIAL

### Goal

Bridge the current passkey-first implementation toward the richer identity model without derailing delivery.

### Hackathon-Complete Scope

- keep passkey-first auth as the user-facing primitive
- add per-coop member identity records separate from device identity
- add signed envelopes for:
  - receiver capture sync
  - publish actions
  - archive requests

### Near-Term Platform

- introduce per-coop `did:key` member identifiers
- introduce a coop-level public identity record
- add node binding records for device-to-member attribution
- start signing meaningful coop events before applying them

### Onchain Identity Direction

The practical onchain identity should be:

- Safe smart account on Arbitrum
- `ERC-1271` signatures for contract-level verification
- `EIP-712` typed messages for intents and actions

Do not anchor the first version on niche AI-agent ERCs. Build on the smart-account stack that is already being adopted.

## 4.9 React Flow Desktop View: DONE

### Goal

Add a visual knowledge and contribution view without turning the product into a complex whiteboard.

### Hackathon-Complete Scope

- add a read-only React Flow board on desktop
- place it in the app route `/board/:coopId`
- render nodes for:
  - members
  - captures
  - drafts
  - artifacts
  - archive bundles
- render edges for:
  - captured by
  - routed to
  - published to
  - archived in

### UI Rule

This should be a read and presentation surface first, not a freeform editor.

## 4.10 Autonomous Agent Execution, Session Keys, And Agentic Identity: NOT STARTED

### Goal

Enable Coop to act onchain and offchain with bounded autonomy.

### Recommended Technical Direction

- smart-account base: `ERC-4337`
- contract signature validation: `ERC-1271`
- typed action and intent payloads: `EIP-712`
- modular account architecture: `ERC-7579`
- wallet permission request compatibility target: `ERC-7715`

### What Not To Do In The Hackathon Slice

- do not make `EIP-7702` a dependency
- do not allow unrestricted agent execution
- do not let the agent move funds without explicit policy and human approval

### Near-Term Platform

- introduce a policy engine for allowed actions
- support low-risk allowed actions first:
  - archive upload
  - social or comms draft publishing
  - garden proposal drafting
  - non-financial onchain proposals
- require human confirmation for treasury-moving actions

### Session-Key Plan

Phase 1:

- implement coop policy objects in shared state
- implement scoped action bundles signed by the coop account or approved signer set
- store action logs and replay IDs

Phase 2:

- attach a session-key or delegated executor path only to approved action classes
- use expiry, spend limits, method allowlists, and target allowlists
- expose revocation in the UI

### Agentic Identity Plan

Near-term:

- `member passkey identity`
- `coop Safe account`
- `EIP-712` action identity
- `ERC-1271` contract verification

Later:

- `did:key` member identity
- coop public DID or domain-anchored identity
- optional agent identity record linked to the coop account and policy set

## 5. Recommended Sequence For The Next Few Days

### Slice A: Receiver + Pairing + Inbox

- turn app into installable PWA
- build egg recorder
- add photo and file attach
- local outbox and sync states
- pair with extension

### Slice B: Extension Review Upgrade

- receiver captures land as private candidates
- better draft routing and multi-coop targeting
- ritual config and meeting mode

### Slice C: Desktop Board + Filecoin Story

- React Flow read-only board
- archive-worthy flagging
- clear archive receipts and snapshot story

### Slice D: Arbitrum Switch

- Arbitrum config and Safe deployment path
- keep live mode feature-flagged

If these four slices land well, Coop will feel materially larger without taking on the full risk of the agentic platform.

## 6. Validation Additions

Add these named suites after the relevant features land:

- `pwa-receiver`
- `pairing-sync`
- `multi-coop-routing`
- `review-meeting-mode`
- `flow-board`
- `archive-live`
- `arbitrum-safe-live`
- `agent-policy`

These should plug into `scripts/validate.mjs` so Codex can keep running the product as a set of named flows instead of one monolithic test command.

## 7. Bottom Line

This roadmap supports your requested direction, but it should not be treated as one undifferentiated sprint.

The right build order is:

1. receiver PWA and pairing
2. review ritual and multi-coop UX
3. desktop visual flow plus Filecoin storytelling
4. Arbitrum account switch
5. anchor runtime and live archive service
6. real local model execution
7. agentic execution and session-key policies

That ordering keeps the demo legible, expands the product meaningfully, and avoids collapsing the current working core under too many experimental layers at once.

---

## 8. Status Update - March 14, 2026

Since the roadmap was written, significant new capabilities have landed:

### New Modules (not in original roadmap)

| Module | Status | Description |
|--------|--------|-------------|
| `privacy` | **DONE** | Semaphore ZK membership proofs, anonymous publishing, group management, membership lifecycle |
| `stealth` | **DONE** | ERC-5564 secp256k1 stealth addresses - key generation, one-time address creation, view tag scanning |
| `policy` | **DONE** | Action approval workflows, typed EIP-712-compatible bundles, replay protection |
| `session` | **DONE** | Scoped execution permissions, time-bounded capability windows, member constraints |
| `grant` | **DONE** | Execution grants with expiry, privilege logs for audit trails |
| `operator` | **DONE** | Anchor/trusted-node runtime with OperatorConsole UI (1,072 lines) |
| `signaling` | **DONE** | Standalone y-webrtc signaling server (Fly.io deployed at `wss://coop.fly.dev`) |

### Updated Workstream Status

| Workstream | Was | Now | Notes |
|-----------|-----|-----|-------|
| 4.3 Trusted-Node Runtime | CONCEPTUAL | **DONE** | OperatorConsole built, anchor mode operational, action log panel shipped |
| 4.10 Session Keys | NOT STARTED | **PARTIAL** | Session capability schema, grant system, and policy engine implemented in shared; UI integration pending |
| 3.2 Near-term: Identity | PARTIAL | **PARTIAL** | Stealth addresses and ZK proofs added; DID/signed envelopes still pending |

### Additional Standards Adopted

- **ERC-5564**: Stealth addresses for private on-chain interactions
- **ERC-8004**: On-chain agent registry (skill registered: `erc8004-register`)
- **Semaphore**: Zero-knowledge group membership proofs for anonymous publishing

### New Validation Coverage

- 100+ new test files across privacy, stealth, onchain, archive, storage, policy modules
- Agent harness testing (registry, knowledge, models, inference)
- Runtime testing (operator, messages, session capability, anchor CID)
- UI testing (operator console, privacy UI, archive config)
