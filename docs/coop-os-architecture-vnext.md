# Coop V1 Build Plan

**Status**: Canonical v1 plan  
**Updated**: 2026-03-11  
**Build Context**: PL Genesis hackathon prototype  
**Document Role**: Single source of truth for the first Coop implementation

---

## 1. Product Summary

Coop is a browser-first, local-first knowledge commons for communities that already generate valuable context but struggle to turn it into shared memory and coordinated action.

The core problem is not lack of information. It is fragmentation.

Communities already have:

- loose tabs
- scattered notes
- meeting transcripts
- research links
- half-formed ideas
- funding leads

What they usually do not have is a membrane that gathers those fragments, helps members review them in context, and turns them into shared knowledge and funding-ready next steps.

That fragmentation directly inhibits opportunity:

- useful research disappears before it becomes shared evidence
- communities repeat work because context stays trapped in private tabs or documents
- promising leads never become coordinated next steps
- collective memory weakens between calls and working sessions
- capital formation becomes harder because evidence is not assembled when needed

Coop v1 exists to close that gap with a tight first loop:

1. a community runs a setup ritual
2. a trusted member creates a coop
3. members join and seed initial context
4. the extension rounds up relevant tabs locally
5. members review drafts and explicitly push them into shared coop memory
6. the coop leaves with live shared context, a real Safe address, and clearer next actions

This is not yet the full Coop OS vision. It is the first working loop that proves:

- browser-native capture
- collaborative memory formation
- passkey-first group identity
- live local-first sync
- the beginning of capital formation

### 1.1 One-Line Product Framing

Coop turns loose tabs into shared intelligence and fundable next steps.

The supporting pitch line for v1 is:

Coop helps you get your chickens in order without defaulting to the major cloud AI platforms.

### 1.2 Working Brand Direction

The working brand is `Coop Town` until the final domain is locked.

The tone should be:

- playful on the surface
- serious in the core promise
- memorable without becoming gimmicky

Chicken metaphors should make the product easier to understand:

- tabs are `Loose Chickens`
- the review queue is the `Roost`
- the shared feed is the `Coop Feed`
- creating a coop is `Launching the Coop`
- a success sound is the `Rooster Call`

The metaphor must clarify the value, not obscure it.

---

## 2. V1 Goals And Demo Success Criteria

### 2.1 Primary Goals

V1 must prove that Coop can:

1. onboard a community through a clear setup ritual
2. create a coop with real shared identity and real synced state
3. let members join without a wallet-extension-first experience
4. passively observe relevant browsing context locally
5. turn that context into reviewable drafts
6. let members explicitly push selected knowledge into one or more coops
7. live-sync published artifacts across members
8. make the shared result legible enough to support a funding-ready next step

### 2.2 Demo-Critical Proof Points

The hackathon demo must show:

1. the landing page narrative and ritual guide
2. coop creation
3. trusted and regular member invite flows
4. passive tab capture creating review drafts
5. review and explicit push into selected coops
6. live sync of published artifacts between two members
7. a simple weekly review surface grouped by category and member
8. a real coop Safe address
9. playful but controlled sound and feedback moments

### 2.3 Product Success Criteria

The first implementation is successful if:

- the product story is clear within one landing-page scroll
- the first-run flow is understandable without a live walkthrough
- privacy boundaries are obvious
- the extension does meaningful local work before anything is shared
- the shared coop feed feels live and collaborative
- the architecture can absorb future mobile capture, archive publishing, and garden actions without a rewrite

---

## 3. Locked Scope And Non-Goals

The following decisions are locked for v1.

### 3.1 Locked Scope

- `packages/app` exists, but for v1 it only ships the landing page experience
- the extension is the primary runtime and primary product surface
- the public product story lives on one shared domain through `packages/app`
- the landing page is responsive and must work on mobile, but there is no separate mobile receiver app flow in v1
- sync is live in v1 through `Yjs`
- shared state is local-first and peer-oriented
- capture can be manual or scheduled
- capture cadence is global to the extension, not per coop
- automatic capture only creates drafts and never auto-publishes
- privacy is enforced through explicit push into coop shared state
- the primary inference story is browser-local, not cloud-first
- Coop does not provide built-in third-party LLM inference integrations in v1
- identity is passkey-first
- a wallet extension is not part of the intended user flow
- coop creation includes real Safe creation
- trusted-node capability is a role, not a separate account system
- the weekly review surface exists in v1 as a read-only grouped board
- published artifacts and coop snapshots can be archived explicitly through Storacha/Filecoin
- Coop OS modularity exists in code and docs, not as an end-user skill picker
- top-level builder docs ship in the first scaffold

### 3.2 Explicit V1 Non-Goals

These are not part of the locked prototype loop:

- mobile receiver shell
- mobile voice capture
- transcript capture on mobile
- local file or folder ingest
- PDF library ingest
- app-level capture outside the browser
- self-hosted signaling infrastructure
- full React Flow editing
- automatic archival of raw browsing exhaust
- full archive browsing and retrieval UI
- encrypted archive workflows for sensitive content
- full Green Goods garden binding
- built-in API-key-based LLM integrations
- autonomous agent execution
- session-key based transactions
- end-user skill management UI

The app package should keep future expansion in mind, but v1 only builds the landing page.

---

## 4. System Principles

### 4.1 Thin Runtimes, Strong Shared Package

Coop should follow the strongest Green Goods pattern:

- thin runtime packages
- one strong shared package
- explicit contracts for integrations
- small dependency surface where possible

### 4.2 Explicit Push Privacy Model

The privacy boundary is simple:

- passive observation can happen locally
- structuring and relevance scoring can happen locally
- higher-level local refinement can happen in the browser
- nothing enters shared coop state until the member explicitly pushes it

If members want to use external LLMs, Coop should help them export structured data cleanly rather than embedding cloud inference into the product.

### 4.3 Extension = Node

In v1, the extension is the primary node and the local home for:

- browsing context
- capture queue
- review queue
- routing suggestions
- coop membership state
- publish actions
- cadence settings

### 4.4 App = Public Landing Surface

In v1, the app package serves one role:

- the public landing page that explains, persuades, and onboards

It should not silently grow into a second product surface during the hackathon.

### 4.5 Coop OS = Internal Modular Substrate

Coop is not shipping a visible skill system in v1, but it should establish the internal pattern for future modularity:

- typed identity actions
- typed capital actions
- typed archive actions
- typed garden actions
- runtime packages calling shared action modules

This keeps the long-term Coop OS direction intact without pulling that UX into the first build.

---

## 5. Repository Shape And Tooling Baseline

### 5.1 Target Monorepo Shape

```text
docs/
packages/
  app/
  extension/
  shared/
README.md
package.json
bun.lock
```

### 5.2 Package Responsibilities

```text
packages/
  app/         # responsive landing page only for v1
  extension/   # extension node: capture, review, publish, sync, settings
  shared/      # schemas, types, state contracts, sync contracts, adapters, UI primitives
docs/          # builder-facing Docusaurus documentation
```

### 5.3 Tooling Baseline

Coop should align with the Green Goods stack where it helps:

- `bun` workspaces
- `typescript`
- `react`
- `vite`
- `tailwindcss`
- `vitest`
- `@playwright/test`
- `zod`
- `dexie`
- `yjs`
- `y-webrtc`
- `y-indexeddb`
- `@mozilla/readability`
- `viem`
- `permissionless`
- Docusaurus

### 5.4 Dependency Rules

- prefer native browser APIs first
- reuse Green Goods patterns where they clearly fit
- add libraries only when they reduce complexity or risk
- keep most product logic in `packages/shared`
- avoid UI frameworks that would slow down iteration

---

## 6. Stage 0: Environment Setup And Scaffold

Stage 0 is a dedicated build phase. It is not optional.

### 6.1 Root Workspace Setup

Create root scripts for:

- `dev`
- `build`
- `test`
- `test:e2e`
- `lint`
- `format`

Recommended default ports:

- app: `3001`
- extension dev assets: `3002`
- docs: `3003`

### 6.2 Package Bootstrapping

Initialize:

- `packages/app`
- `packages/extension`
- `packages/shared`
- top-level `docs`

### 6.3 App Scaffold

Before product work, the app must:

- boot as a responsive landing page
- support desktop and mobile layouts of the same landing experience
- expose shared theme tokens and base layout primitives

There is no separate mobile receiver route in v1.

### 6.4 Extension Scaffold

Before feature work, the extension must have:

- MV3 manifest
- background service worker
- side panel
- popup
- message passing skeleton
- shared build configuration

### 6.5 Shared Package Scaffold

Before runtime features, `packages/shared` must contain:

- schema folder
- type contracts
- sync contracts
- adapter interfaces
- state helpers
- small shared UI primitives

### 6.6 Testing Scaffold

Stage 0 must also include:

- Vitest config
- shared test setup
- fake IndexedDB support
- MSW mocks for inference and onchain adapters
- Playwright config

### 6.7 Docs Scaffold

Set up the top-level Docusaurus site with starter pages for:

- getting started
- architecture
- packages
- flows
- integrations

### 6.8 Stage 0 Completion Criteria

Stage 0 is complete when:

- the workspace installs cleanly
- app, extension, and docs each boot in dev mode
- shared imports cleanly into app and extension
- at least one unit test and one Playwright smoke test run
- the repo has one canonical planning doc and working docs navigation

---

## 7. Technical Architecture Overview

### 7.1 Runtime Split

The runtime split for v1 is:

- landing page in `packages/app`
- browser runtime in `packages/extension`
- product logic and contracts in `packages/shared`
- builder docs in `docs`

### 7.2 Data Layers

Coop has four distinct data layers.

#### Local-Only Data

Lives in the extension and never syncs unless explicitly pushed:

- raw tab candidates
- readable page extracts
- local relevance scores
- draft queues
- local settings
- inference caches

Primary store:

- `Dexie`

#### Shared Synced Data

Lives in a coop Yjs document:

- coop profile
- coop soul
- rituals
- memberships
- invite metadata
- published artifacts
- weekly review projections
- capability status

Primary stack:

- `Yjs`
- `y-webrtc`
- `y-indexeddb`

#### Onchain Anchors

Lives onchain or is derived from onchain state:

- coop Safe address
- signer status
- future Garden or archive linkage

#### Long-Term Archive

Built in v1, but only for explicit archive actions:

- approved artifact payloads
- coop snapshot bundles
- Storacha upload receipts
- Filecoin status lookups for archived items

Raw tab exhaust and unpublished drafts must never be archived automatically.

### 7.3 Extension Runtime Constraints

The MV3 background runtime is event-driven and will not behave like a durable server process.

That means:

- scheduled work must use browser alarms, not in-memory timers
- queue state must be persisted
- capture state must survive worker restarts
- long-running flows must be resumable

The extension should treat the background service worker as orchestration, not as durable storage.

### 7.4 Side Panel Architecture

The side panel is the main Coop UI in v1 because it:

- stays close to the browsing context
- can remain open while the user navigates
- makes review and push feel contextual

The popup should remain small and act as a launcher, not a second app.

### 7.5 Local Model Execution Placement

If WebLLM is used in v1, it should run in a dedicated worker owned by a long-lived extension UI context such as the side panel.

It should not be treated as a natural fit for the MV3 background service worker because:

- the service worker is event-driven and can terminate when idle
- model loading is large relative to normal extension background work
- WebGPU and model initialization should be treated as optional progressive enhancement

The background service worker should orchestrate capture and queueing. The side panel or another long-lived extension page should own any optional local-model runtime.

For the hackathon build, the safest default is:

- heuristics-first pipeline always enabled
- WebLLM behind capability detection
- WebLLM model loaded only when the member enables or triggers local enhancement

This means the default Coop AI stack in v1 is:

- heuristics and deterministic normalization for passive mode
- light local classifiers and similarity models for passive enhancement
- WebLLM for browser-local higher-level synthesis and refinement

Third-party LLM usage, if any, should happen outside Coop through explicit export.

---

## 8. Landing Page Specification

### 8.1 Landing Page Goals

The landing page must do three jobs:

1. explain the problem and value clearly
2. guide communities through the setup ritual before coop creation
3. drive extension install and create/join flows

### 8.2 Section Order

The landing page should use this sequence:

1. `Hero`
2. `Problem`
3. `How Coop Works`
4. `Setup Ritual`
5. `Prompt Copy`
6. `Privacy And Push`
7. `Extension States`
8. `Weekly Review`
9. `Footer CTA`

### 8.3 Hero

The hero should:

- present Coop in one short sentence
- connect loose tabs to coordinated opportunity
- lead with `Start setup ritual`
- keep `Install extension` as the secondary CTA
- use one strong abstract illustration that combines browser fragments, coop structure, and flocking/chicken motifs

### 8.4 Problem

The problem section must explicitly connect fragmented knowledge to missed opportunity.

It should communicate:

- research disappears in private tabs
- notes are scattered across tools and people
- communities lose continuity between calls
- evidence is not assembled in time to support funding or coordination

### 8.5 How Coop Works

This section should explain the v1 loop in simple language:

1. your community runs a setup ritual
2. members browse and Coop rounds up relevant context
3. members review drafts and push useful knowledge into shared coop memory
4. the coop leaves with a clearer shared picture and next steps

### 8.6 Setup Ritual Illustration

This is the most important content block on the page.

It should visually show:

- a community call moment
- four planning lenses
- note capture becoming structured coop memory
- the bridge from discussion to extension setup

The visual does not need polished brand art yet, but it must feel intentional and non-generic.

### 8.7 Prompt Copy

The page should include a copyable prompt for the community call.

That output is required for coop creation.

The page should recommend tested tools for synthesis:

- GPT
- Gemini

These are optional external aids for the setup ritual only, not built-in Coop integrations.

Manual editing of the output is allowed before the create flow.

### 8.8 Privacy And Push

This section must clearly explain:

- Coop can notice relevant context locally
- Coop can help structure it before sharing
- nothing enters shared coop memory until a member explicitly pushes it

This section should be visually calm and plainspoken.

### 8.9 Extension States

This section should preview:

- what the icon means
- manual versus automatic capture cadence
- how review drafts appear
- how a user pushes knowledge into a coop

### 8.10 Weekly Review

This section should preview the outcome:

- a shared feed
- grouped artifacts
- visibility into who contributed what
- a lightweight weekly review board

### 8.11 Footer CTA

The footer should provide:

- start setup ritual
- install extension
- create coop
- join coop
- docs link

### 8.12 Frontend Standards

The landing page must:

- use semantic section structure
- support keyboard navigation
- keep motion lightweight and intentional
- degrade cleanly on mobile
- use accessible contrast
- avoid flat generic visuals
- keep tokens easy for a designer to replace later

---

## 9. Ritual, Soul, And Initial Coop Memory

The meeting notes made one thing clear: the coop should not start as an empty container.

It needs a small set of initial artifacts that give it character, context, and behavioral shape.

### 9.1 Cardinal Coop Elements

Every coop should be initialized around six cardinal elements:

- `Purpose`: what the coop is for
- `People`: who is part of it and what trust level exists
- `Soul`: how the community describes itself and what counts as signal
- `Rituals`: when the group reviews, syncs, and updates the coop
- `Memory`: the seed knowledge the coop starts with
- `Opportunity`: the kinds of action or capital formation the coop wants to support

### 9.2 Setup Ritual Lenses

The setup ritual is a structured community call across four lenses:

- `Capital Formation`
- `Impact Reporting`
- `Governance & Coordination`
- `Knowledge Garden & Resources`

Each lens answers three prompts:

- `How do we do this now?`
- `What is not working well?`
- `What should improve?`

### 9.3 Setup Input Contract

Creating a coop is hard-gated on setup insights.

The minimum acceptable setup payload should include:

- all four lenses
- at least one current-state note for each lens
- at least one pain point for each lens
- at least one improvement direction for each lens
- a short overall summary

This can be created by AI from call notes, but the result should be editable before submission.

### 9.4 Initial Shared Artifacts

Coop creation should generate four initial shared artifacts.

#### `Setup Insights`

The normalized result of the four-lens ritual.

Contains:

- per-lens responses
- top cross-cutting pain points
- top cross-cutting opportunities

#### `Coop Soul`

A short artifact that gives the coop character.

Contains:

- short purpose statement
- tone and working style
- what the coop treats as useful signal
- what kinds of artifacts matter most
- one short “why this coop exists” paragraph

#### `Rituals`

A structured artifact describing recurring human review moments.

Contains:

- weekly review cadence
- named meeting moments such as `Coop updates`
- who is expected to review or facilitate
- the default capture review posture

This is the v1 equivalent of the earlier `rituals.md` idea, but stored as typed shared data that can also render as markdown-like content.

#### `Seed Contributions`

The initial knowledge contributions from members.

Contains:

- the creator’s first seed entry
- each joining member’s short seed thought
- optional initial links

### 9.5 Why These Artifacts Matter

These artifacts give the coop enough context to:

- classify browsing context better
- explain itself on the landing and extension surfaces
- make weekly review feel grounded
- avoid the “empty workspace” problem

---

## 10. Extension Product Specification

### 10.1 Extension Role

The extension is the primary member node in v1.

It is responsible for:

- tab awareness
- local capture queue
- local synthesis
- review queue
- coop routing suggestions
- shared publishing
- sync participation
- settings and notifications

The extension is primarily a read-and-review surface in v1.

It should help members understand what has happened and what is worth pushing, not introduce heavy graph-editing or freeform workspace manipulation.

### 10.2 Primary UI Surfaces

The extension uses:

- `sidePanel` as the main interface
- `popup` as a compact status and launcher
- `background/service worker` for cadence and observation logic

### 10.3 Main Side Panel Areas

The side panel should include:

- `Loose Chickens`
- `Roost`
- `Coops`
- `Feed`
- `Review Board`
- `Settings`

### 10.4 Popup Behavior

The popup should show:

- current icon state text
- pending draft count
- sync state summary
- quick open into the side panel

It must not become a second full app.

### 10.5 Capture Cadence

Capture mode is global for the browser profile in v1.

Modes:

- `Manual`
- `Every 30 min`
- `Every 60 min`

The extension should use browser alarms for scheduled scans.

The manual round-up path is the demo-critical happy path.

Scheduled cadence should exist in v1, but it can remain lighter-weight than the manual click-to-synthesize flow if implementation time gets tight.

### 10.6 Passive Capture Posture

The extension should run in the user’s existing browser profile.

It must not require:

- a separate research browser profile
- manual tab grouping before capture works
- manually telling the extension which tab group to inspect

It may use window or tab-group context when available, but it cannot depend on that context being curated by the user.

### 10.7 Side Panel State Model

The side panel needs to clearly show:

- active coop context
- total local drafts waiting for review
- last capture cycle
- whether local enhancement is available
- whether the extension is offline or missing permission

---

## 11. Extension Icon States And Notifications

### 11.1 Icon States

The icon state model is intentionally small.

- `Idle`
- `Watching`
- `Review Needed`
- `Error/Offline`

### 11.2 State Meanings

- `Idle`: extension is available and there is nothing urgent
- `Watching`: passive capture or scheduled review cycle is active
- `Review Needed`: one or more drafts are waiting for user review
- `Error/Offline`: sync, permission, or inference issue needs attention

Every icon state must also appear as visible text inside the extension.

### 11.3 Sound Design Rules

Sound is part of the product identity, but it must be controlled.

- keep most automatic background events silent by default
- use sound mainly for user-triggered or high-clarity moments
- let users mute easily
- respect reduced-motion and reduced-sound preferences

### 11.4 Required V1 Sound Events

- coop created successfully -> rooster call
- successful publish -> soft cluck
- settings sound test -> squeaky-chicken style novelty sound

### 11.5 Audio Asset Operations

V1 audio sourcing, licensing, naming, and repo layout should follow:

`docs/coop-audio-and-asset-ops.md`

### 11.6 Not In Default Audio Path

Do not auto-play sound for:

- passive tab detection
- scheduled scans
- small sync events
- low-importance status changes

The playful moments should feel like reward states, not ambient interruption.

---

## 12. Identity, Trust, And Onchain Model

### 12.1 Identity Direction

Identity is passkey-first for everyone in the intended v1 UX.

The product should assume:

- users do not install a wallet extension to use Coop
- passkeys are the primary authentication path
- trusted capability is a role on top of the same identity layer

### 12.2 Account Abstraction Pattern

Use the Green Goods-style sender abstraction as the implementation pattern:

- one shared auth union, even if v1 only exposes passkey in the UX
- auth mode determines the active transaction sender
- passkey mode resolves to a smart-account-backed sender
- runtime code should call shared sender interfaces, not special-case passkey logic everywhere

The minimal auth shape should account for:

- `passkey`
- `wallet`
- optional embedded or future modes

The minimal implementation pattern should include:

- one shared auth context carrying credential and account state
- one shared primary-address selector
- one transaction-sender factory

Even if v1 only exposes passkey in the product flow, the implementation should still keep the sender abstraction boundary and shared address-selection logic.

### 12.3 Passkey Persistence Reality

The spec must account for device and browser persistence limitations.

For v1:

- passkey session data may be stored locally
- only the minimal credential material required to reconstruct the account should be stored locally
- the extension must warn when identity is device-bound
- clearing browser data or removing local credential state may remove access to that account
- this warning should appear in docs and in identity settings
- normal sign-out should preserve the local passkey credential by default so the same device can restore the same account later
- destructive account deletion must be a separate explicit action

Do not pretend passkeys fully solve recovery in v1.

### 12.4 Coop Safe Creation

Creating a coop should create a real Safe on `Optimism Sepolia`.

The intended flow is:

1. creator authenticates with passkey
2. Coop derives the creator’s account-abstraction identity
3. create flow deploys a Safe with that identity as the initial owner
4. resulting Safe address is written into shared coop state

This gives the demo a real group account without forcing wallet-extension UX.

### 12.5 Trusted Members

Trusted members are a permission level, not a different account system.

Trusted members can eventually support:

- invite management
- onchain preparation
- future signer promotion
- archive delegation and archive status upkeep

For v1:

- trusted members join through the same passkey-first flow
- trusted status is recorded immediately in shared state
- actual Safe signer promotion is optional and not required for demo success
- if signer promotion is not implemented, trusted members remain `trustedCandidates`

This avoids forcing a second signer flow into the critical path.

### 12.6 RP ID And Domain Constraint

Passkey setup depends on a stable relying-party identity.

For v1:

- production passkeys should be tied to the final production domain
- local development should use an explicit dev RP ID strategy
- the chosen RP ID must be documented early because changing it later can break passkey recovery on some platforms

### 12.7 Onchain Capability Boundaries

Human approval remains the default boundary for:

- signer changes
- fund movement
- garden ownership changes
- archive publishing receipts with financial implications

Session keys and autonomous actions are future work.

---

## 13. Sync, Privacy, And Access Model

### 13.1 Shared Sync Stack

Use:

- `Yjs`
- `y-webrtc`
- `y-indexeddb`

### 13.2 Local Persistence

Use `Dexie` for:

- tab candidates
- draft queues
- settings
- cached artifact views
- local membership indexes
- capture and review metadata that should survive service-worker restarts

### 13.3 What Syncs Versus What Stays Local

The coop document should only contain shared memory, not raw browsing exhaust.

#### Shared

- coop profile
- soul
- rituals
- membership list
- invite metadata
- published artifacts
- review-board groupings
- capability status

#### Local Only

- raw open-tab snapshots
- readable content extracts
- draft-generation intermediates
- per-user heuristics and caches
- unpublished thoughts

### 13.4 Room Bootstrap And Access Control

Because v1 uses public signaling and peer sync, access control must be explicit.

The coop should generate:

- `coopId`
- `roomSecret`
- `inviteSigningSecret`

The sync room identifier should be derived locally from `coopId + roomSecret`, not stored as a guessable literal string.

Invite payloads should include:

- coop id
- coop display name
- invite id
- invite type
- expiry timestamp
- room bootstrap material
- signature or MAC derived from the invite signing secret

This gives v1 a clear bootstrap model even without a traditional backend.

### 13.5 Revocation Model

V1 revocation is prospective, not perfect.

That means:

- expired invites fail local validation
- revoked unused invites fail local validation
- rotating the room secret invalidates unused invites that depend on old bootstrap data
- already-joined members remain members until explicitly removed and the room secret is rotated

This limitation should be documented. It is acceptable for the hackathon prototype.

### 13.6 Network Philosophy

Coop remains:

- local-first
- peer-oriented
- collaborative without a central data backend

The prototype does not need permanent high-availability relay infrastructure.

It needs reliable two-peer happy-path sync in the demo.

### 13.7 Archive Privacy Boundary

The shared Yjs membrane and the long-term archive are not the same trust boundary.

For v1:

- Yjs shared state is coop-scoped collaborative memory
- Storacha/Filecoin archive is explicit long-term publication or backup
- only approved artifacts or coop snapshots may cross into the archive layer
- drafts, raw readable extracts, and passive browsing exhaust must never be archived automatically

This distinction should be visible in both docs and product language.

---

## 14. Inference, Review, And Publish Model

### 14.1 Capture Sources In V1

V1 focuses on browser tabs and web pages only.

Do not expand scope to:

- local file ingest
- folder ingest
- app-level capture
- transcript processing

### 14.2 Capture Pipeline

The extension should:

1. observe open tabs locally in the user’s normal browser profile, including the currently open set on startup
2. capture raw metadata such as title, URL, domain, favicon, timestamps, window context, and tab-group context when available
3. exclude unsupported browser-internal pages
4. attempt readable extraction where possible
5. build bounded normalized extracts for downstream scoring
6. queue candidates locally

### 14.3 Normalization Stages

The tab-to-memory path should be modeled as explicit staged objects.

#### `TabCandidate`

Raw capture object.

Contains:

- tab and window identifiers
- URL and canonical URL candidate
- title
- domain
- favicon
- timestamps
- browser context such as tab-group or window hints
- lightweight excerpt when available

#### `ReadablePageExtract`

Normalized readable representation used for scoring and summarization.

Contains:

- canonical URL
- cleaned title
- domain
- meta description when available
- top headings
- lead paragraphs
- selected salient text blocks
- text hash
- optional extracted preview image URL

If a page is too large, the extract should be bounded by deterministic selection rules rather than trying to pass the entire page forward.

#### `CoopInterpretation`

The per-coop interpretation object derived from the readable extract.

Contains:

- target coop id
- relevance score
- matched ritual lenses
- category candidates
- tag candidates
- rationale for why this matters
- suggested next step
- archive-worthiness hint

One readable extract may generate multiple coop interpretations.

#### `ReviewDraft`

The editable member-facing draft that can be pushed into shared memory.

It is derived from one interpretation and one source extract, then exposed in the `Roost`.

### 14.4 Heuristics-First Local Pass

The baseline structuring path must work without WebLLM.

Required baseline steps:

- canonicalize the URL and domain
- run readability extraction where possible
- bound the text using deterministic rules
- weight title, description, headings, and repeated terms
- match against coop setup insights, soul, rituals, and prior artifact vocabulary
- score source-domain affinity
- generate extractive tags and category candidates
- build a template-based `whyItMatters`
- build a template-based `suggestedNextStep`
- rank likely target coops

This heuristics-first pass is the guaranteed fallback and should be treated as a complete product path, not as a degraded error state.

### 14.5 Passive Lightweight Model Layer

The passive path can use a lighter browser-local model layer without depending on a generative LLM.

Recommended v1 use cases for this layer:

- zero-shot or multi-label coop routing
- ritual-lens classification
- artifact category suggestion
- tag suggestion
- entity extraction
- similarity against exemplar accepted artifacts

The recommended implementation direction is a small browser-local pipeline using Transformers.js and ONNX Runtime Web.

This layer is a better fit for passive mode than WebLLM because it is narrower, cheaper, and easier to keep bounded.

### 14.6 WebLLM-First Local Synthesis Pass

WebLLM is a progressive enhancement.

Use it only when:

- WebGPU or supported browser capabilities are available
- model download and initialization are acceptable
- the side panel or another long-lived extension page can host the runtime

WebLLM should receive:

- `ReadablePageExtract`
- coop context from setup insights, soul, rituals, and memory profile
- any candidate target coop shortlist from heuristics

WebLLM should return structured JSON that maps to `CoopInterpretation` or `ReviewDraft`.

All WebLLM outputs must be validated with Zod before they are accepted into local queues.

WebLLM is best used for:

- better summaries
- better tag suggestions
- better category cleanup
- stronger rationale text
- better target-coop ranking

#### Recommended V1 Model Ladder

Given the currently documented WebLLM model families, the most practical path for a Chromium extension on typical desktop hardware is:

1. `Qwen2 0.5B` as the widest-compatibility starter model
2. `Qwen2 1.5B` as the better-quality tier for stronger desktops
3. `Gemma-2B` as an optional alternative if evaluation shows better category or tag quality for Coop’s prompts

The currently documented larger families such as 7B-class models and Llama 3 are better treated as out of scope for the extension-local path in v1 because of model size, initialization cost, and GPU pressure.

This recommendation is an implementation inference from the current WebLLM-supported model families and sizes, not a claim from the docs that one model is universally best.

#### Recommended V1 WebLLM Usage Pattern

If WebLLM is enabled:

- use one short system prompt focused on classification and structuring, not open-ended chat
- prefer JSON-mode output mapped to the `CoopInterpretation` or `ReviewDraft` schema
- keep context bounded to the normalized extract plus compact coop context
- avoid running WebLLM on every tab automatically
- use it on the highest-scoring candidates or as a user-triggered refinement step

This keeps the local-model path useful without letting it dominate the runtime budget.

#### Product Positioning Decision

Coop can credibly position itself in v1 as:

- peer-to-peer
- browser-native
- local-first
- AI-assisted without requiring cloud inference by default

For the hackathon, the stronger selling point is the browser-local stack:

- passive normalization and classification in-browser
- WebLLM-powered local synthesis and refinement
- Yjs peer sync
- explicit archive to Storacha/Filecoin

Coop should explicitly position itself as avoiding dependency on the major cloud AI platforms for its core loop.

### 14.7 External Analysis Export And Portability

Coop should make it easy for members to take structured data out of the product when they want to analyze it elsewhere.

This is a portability feature, not a built-in inference integration.

V1 should support:

- copy structured artifact data as JSON
- copy compact text bundles for pasting into external tools
- download single artifacts as JSON
- download coop snapshots as JSON
- download archive receipts and metadata

Recommended export scopes:

- one `ReviewDraft`
- one published `Artifact`
- one weekly review bundle
- one coop snapshot

Rules:

- exports should contain structured fields, not raw hidden app state
- raw passive browsing exhaust should not be exported by default
- exports should favor open formats that work with copy/paste and local files
- Coop does not manage external provider credentials or prompts in v1

### 14.8 Review Draft Shape

Every review draft should include:

- title
- summary
- sources
- tags
- category
- why it matters
- suggested next step
- suggested target coops
- confidence or rationale
- optional preview image

The review draft is the key boundary object between noisy local capture and shared coop memory.

### 14.9 Publish Boundary

No draft enters shared coop memory until the user explicitly pushes it.

Users should be able to:

- edit draft metadata
- choose one or more target coops
- approve the push

### 14.10 Multi-Coop Publish Semantics

This must be locked for v1.

If a user pushes one reviewed draft into multiple coops, Coop creates one published artifact per target coop.

Those sibling artifacts share:

- a common `originId`
- shared source metadata
- shared creation timestamp lineage

They do not share one global mutable artifact object across coops.

This is simpler because each coop owns its own Yjs document and its own feed.

### 14.11 Shared Review Model

The meeting notes pointed toward a Git-like review flow, but v1 should keep this light.

Use this state model:

- `draft` -> local only
- `published` -> pushed into shared feed
- `reviewed` -> discussed in a coop review moment
- `actioned` -> linked to a next step, opportunity, or capital draft

V1 does not require quorum approval before publish. The social review happens through the shared board and weekly ritual.

### 14.12 Shared Memory Loop And Calibration

The coop should get better at matching and structuring over time.

That reinforcement loop should combine:

- setup insights
- coop soul
- ritual definitions
- accepted published artifacts
- review outcomes
- archive events
- weekly review curation

V1 should introduce a shared derived object called `CoopMemoryProfile`.

It should contain:

- recurring high-signal domains
- recurring high-signal tags
- category frequency and recency
- matched ritual-lens weights
- exemplar accepted artifacts
- archive-worthy patterns

This shared profile belongs in the coop membrane and should update when:

- new artifacts are published
- artifacts are marked reviewed or actioned
- weekly review surfaces promote or prune tags and patterns

Each member node should combine:

- shared `CoopMemoryProfile`
- current coop setup context
- local recent browsing history
- local acceptance and rejection history

Only the shared calibration data should sync. Private negative signals and browsing traces should remain local.

### 14.13 Archive Flow

Archive is an explicit post-publish step in v1.

Only two archive scopes are supported:

- `artifact`: archive one published artifact payload
- `snapshot`: archive a coop bundle such as feed items plus soul, rituals, and weekly review projection

The preferred v1 archive flow is:

1. member publishes an artifact or opens the weekly review archive action
2. client builds a JSON or CAR-ready payload locally
3. client uploads directly to Storacha using delegated capability
4. client stores an `ArchiveReceipt` in shared coop state
5. a trusted node or later manual action queries Filecoin status and updates the receipt

Archive upload should happen from the client when possible.

The trusted-node role is best used for:

- issuing limited upload delegation
- sponsoring or owning the coop archive space
- later querying Filecoin inclusion status

Archive is not a synonym for sync. It is a deliberate long-term storage action.

#### Trusted-Node Delegation Baseline

The cleanest v1 Storacha setup is a delegated architecture:

- the coop archive space is owned by a trusted-node-controlled identity
- trusted nodes have their own agent DIDs
- a delegation issuer re-delegates limited capabilities to trusted-node clients
- uploads go directly from the client to Storacha

The minimal delegated capability set should cover:

- `space/blob/add`
- `space/index/add`
- `upload/add`
- `filecoin/offer`

Recommended delegation rules for v1:

- only trusted nodes receive archive delegation
- delegations should be short-lived
- the extension should request or refresh delegation only when an archive action is attempted
- archive receipts must record which delegation issuer granted the upload capability

This gives the hackathon build direct browser upload without forcing every member to own a Storacha space.

---

## 15. Weekly Review Surface

### 15.1 Purpose

The weekly review surface is how the coop makes its shared knowledge legible during calls or syncs.

### 15.2 V1 Scope

V1 includes a read-only mini board.

It is not a full graph editor.

### 15.3 Grouping Model

The board groups items by:

- category
- member

### 15.4 Why This Matters

This creates enough visual structure for:

- weekly syntheses
- `Coop updates` during calls
- clear visibility into who shared what
- visible movement from raw capture to shared insight

---

## 16. Core User Flows

### 16.1 Community Setup Ritual

1. A community opens the landing page on desktop.
2. They run a call using the four ritual lenses.
3. They synthesize the discussion into a setup payload.
4. A trusted member installs the extension.
5. That member starts `Create Coop`.

Creating a coop without setup insights is not allowed.

### 16.2 Create Coop

Required inputs:

- coop name
- short purpose
- creator display name
- normalized setup insights
- initial capture mode

Create flow behavior:

1. validate setup insights
2. initialize local coop state
3. generate room bootstrap secrets
4. initialize shared Yjs state
5. establish creator membership
6. create the coop Safe on Optimism Sepolia
7. generate initial artifacts:
   - Setup Insights
   - Coop Soul
   - Rituals
   - creator Seed Contribution
8. play launch animation and rooster sound
9. land the creator in the coop feed

First-run outcome should immediately show:

- coop name
- creator role
- Safe address
- sync state
- initial artifacts
- where capture drafts will appear

### 16.3 Invite And Join

V1 uses two invite types:

- `trusted`
- `member`

Recommended defaults:

- trusted: `48 hours`
- member: `7 days`

Joining requires:

- invite code
- display name
- short seed contribution

Join outcome:

- member is added to shared state
- invite usage is recorded
- seed contribution becomes a shared seed artifact
- trusted joiners are marked trusted immediately
- trusted joiners may remain pending signer promotion

### 16.4 Capture, Review, And Push

1. extension observes relevant tabs locally
2. local pipeline extracts and scores content
3. user sees drafts in `Roost`
4. user edits metadata if needed
5. user selects one or more target coops
6. user pushes the draft
7. one published artifact is created per target coop
8. connected members see the artifact appear live

---

## 17. Shared Contracts And Data Model

`packages/shared` should be the source of truth for the following contracts.

### 17.1 Core Runtime Types

- `AuthMode`
- `CoopProfile`
- `CoopSoul`
- `RitualDefinition`
- `SetupInsights`
- `CoopMemoryProfile`
- `SeedContribution`
- `Member`
- `MemberRole`
- `CoopMembership`
- `InviteCode`
- `InviteBootstrap`
- `CaptureMode`
- `ExtensionIconState`
- `TabCandidate`
- `ReadablePageExtract`
- `CoopInterpretation`
- `ReviewDraft`
- `Artifact`
- `ArtifactOrigin`
- `ArchiveReceipt`
- `ArchiveBundle`
- `ArchiveScope`
- `ArchiveStatus`
- `ReviewBoardGroup`
- `SyncRoomConfig`
- `OnchainState`

### 17.2 Action And Adapter Types

- `IdentityAction`
- `CapitalAction`
- `ArchiveAction`
- `GardenAction`
- `SyncTransport`
- `InferenceAdapter`
- `WalletAdapter`

The `InferenceAdapter` contract should target local inference paths in v1.

Do not implement cloud-provider adapters as part of the initial product loop.

### 17.3 Capability State Model

Every action capability should support:

- `unavailable`
- `stubbed`
- `ready`
- `executed`
- `failed`

### 17.4 Artifact Categories

V1 should support at minimum:

- `setup-insight`
- `coop-soul`
- `ritual`
- `seed-contribution`
- `resource`
- `thought`
- `insight`
- `evidence`
- `opportunity`
- `funding-lead`
- `next-step`

### 17.5 Artifact Fields

Published artifacts should include:

- `id`
- `originId`
- `targetCoopId`
- `title`
- `summary`
- `sources`
- `tags`
- `category`
- `whyItMatters`
- `suggestedNextStep`
- `previewImageUrl`
- `createdBy`
- `createdAt`
- `reviewStatus`
- `archiveStatus`
- `archiveReceiptIds`

### 17.6 Archive Receipt Fields

Archive receipts should include:

- `id`
- `scope`
- `targetCoopId`
- `artifactIds` or bundle references
- `rootCid`
- `shardCids`
- `pieceCids` when available
- `gatewayUrl`
- `uploadedAt`
- `filecoinStatus`
- `delegationIssuer`

### 17.7 Minimal Coop Memory Profile

The first implementation of `CoopMemoryProfile` should stay deliberately small.

It should include:

- `version`
- `updatedAt`
- `topDomains`
- `topTags`
- `categoryStats`
- `ritualLensWeights`
- `exemplarArtifactIds`
- `archiveSignals`

Recommended minimal shapes:

- `topDomains`: domain, acceptCount, reviewedCount, lastAcceptedAt
- `topTags`: tag, acceptCount, lastAcceptedAt
- `categoryStats`: category, publishCount, actionedCount
- `ritualLensWeights`: lens, weight
- `exemplarArtifactIds`: small capped list of artifact ids by category or lens
- `archiveSignals`: archivedTagCounts, archivedDomainCounts

The v1 memory profile should not include:

- raw browsing history
- rejected private drafts from individual members
- embeddings
- vector search infrastructure
- freeform long text blobs

The memory profile is meant to tune matching and review quality, not become a second knowledge store.

---

## 18. Coop OS Modules And Future Action Stubs

V1 should establish modular typed future capability areas in code.

These are not end-user “skills” in the UI.

### 18.1 Required Action Families

- `IdentityAction`
- `CapitalAction`
- `ArchiveAction`
- `GardenAction`

### 18.2 Why This Exists In V1

This keeps the architecture extensible for:

- Green Goods garden binding
- Filecoin or Storacha publishing
- capital actions and treasury flows
- future autonomous or semi-autonomous workflows

### 18.3 V1 UI Rule

These modules should appear in code, docs, and internal architecture, but not as a visible skill launcher for end users.

---

## 19. Builder Docs Plan

The top-level Docusaurus site should ship with lightweight builder documentation.

### 19.1 Initial Docs Pages

- `Getting Started`
- `Architecture`
- `Packages`
- `Create / Join / Push Flows`
- `Identity And Passkeys`
- `Sync And Privacy Model`
- `Inference And Memory Loop`
- `Export And Portability`
- `Archive And Long-Term Storage`
- `Notifications And Sound`
- `Coop OS Action Stubs`
- `Hackathon Demo Flow`

### 19.2 Documentation Rule

The repo should move toward:

- one canonical build plan
- docs pages for implementation details
- fewer orphan planning notes

---

## 20. Testing Strategy

### 20.1 Unit Tests

Cover:

- auth-mode selection and primary-address resolution
- setup insight validation
- invite generation and expiry
- invite bootstrap validation
- room secret derivation
- capture mode logic
- icon-state transitions
- local coop matching
- bounded readable extract selection
- heuristics-only review draft shaping
- WebLLM unavailable fallback behavior
- draft shaping
- shared memory-profile updates
- multi-coop sibling artifact creation
- archive receipt generation and shaping
- Yjs document hydration
- capability status transitions

### 20.2 Component Tests

Cover:

- landing page section rendering
- prompt copy behavior
- create-coop gating on setup insights
- join-coop flow
- review queue interaction
- explicit push into selected coops
- export structured draft and artifact data
- explicit archive action on published artifacts
- sound toggle behavior
- identity warning behavior for passkey-backed accounts
- sign-out behavior that preserves local credential state unless the user explicitly deletes the account

### 20.3 End-To-End Tests

Playwright should cover:

1. landing page renders on desktop and mobile layouts
2. create coop flow
3. second member joins via invite
4. passive capture produces drafts
5. review and push into selected coops
6. live sync between two extension contexts
7. Safe address creation and display
8. weekly review grouping renders correctly
9. archive one artifact or coop snapshot and record the receipt
10. export one artifact or snapshot as structured data

Real passkey network flows should not be the only coverage surface. Follow the Green Goods testing posture:

- use unit tests and mocked integration tests for Pimlico and passkey setup
- use virtual-authenticator coverage where it helps local browser behavior
- do not block v1 on proving live third-party passkey infrastructure in every E2E run

### 20.4 Test Philosophy

Prioritize coverage on:

- workflow logic
- privacy and publish boundaries
- sync behavior
- critical onboarding paths

Do not spend early testing budget on decorative UI details.

---

## 21. Delivery Phases

### 21.1 Stage 0: Scaffold

Deliver:

- Bun workspace
- package bootstraps
- extension shell
- landing page shell
- shared contracts skeleton
- docs scaffold
- test harness

### 21.2 Stage 1: Public Surface

Deliver:

- desktop-first landing page
- responsive mobile landing layout
- visual identity baseline
- setup ritual section
- prompt copy section

### 21.3 Stage 2: Coop Core

Deliver:

- create coop
- join coop
- passkey-first identity path
- Safe creation
- synced shared state
- initial soul and ritual artifacts

### 21.4 Stage 3: Capture And Publish

Deliver:

- local passive capture
- local synthesis
- review queue
- explicit push into selected coops
- shared feed

### 21.5 Stage 4: Review And Polish

Deliver:

- mini weekly review board
- export actions for draft, artifact, and coop snapshot data
- manual archive of approved artifacts and coop snapshots
- archive receipts persisted in shared state
- icon states
- sound moments
- docs expansion
- end-to-end validation
- demo polish

---

## 22. Explicit Future Direction After V1

After the core loop is solid, the most aligned next areas are:

- mobile receiver shell
- mobile voice capture
- local file and folder ingest
- richer board and review flows
- richer archive browsing and retrieval UX
- encrypted archive workflows
- automated archive cadence and snapshot policies
- optional external-tool automations built on exported data
- Green Goods garden binding
- session-key and agent-assisted actions
- broader Coop OS runtime reuse across more surfaces

These should not be allowed to creep into the hackathon critical path.

---

## 23. Risks And Mitigations

### 23.1 Passkey + Safe Integration Risk

Risk:

- account abstraction or signer management details may be more complex than expected

Mitigation:

- isolate the sender path behind shared interfaces
- keep signer promotion outside the demo-critical path
- keep the product UX wallet-extension-free even if a developer fallback is used during implementation

### 23.2 Sync Access-Control Risk

Risk:

- peer sync works, but membership control is ambiguous

Mitigation:

- lock room bootstrap secrets and invite validation early
- document that v1 uses secrecy-based room access, not full server-enforced ACLs
- keep the room-rotation path explicit

### 23.3 WebLLM Performance Risk

Risk:

- local model loading may be slow or inconsistent across devices

Mitigation:

- make heuristics the required default
- treat WebLLM as optional enhancement
- keep the product coherent even when only lightweight local models are available

### 23.4 Archive Privacy And Persistence Risk

Risk:

- archived data is much more durable and potentially public than coop-scoped sync state

Mitigation:

- archive only explicit published artifacts or snapshots
- never archive raw browsing exhaust
- document the archive boundary clearly
- keep encrypted archive flows out of the critical path unless they are actually implemented

### 23.5 Extension Runtime Risk

Risk:

- MV3 worker lifecycle causes dropped in-memory state

Mitigation:

- persist queue and cadence state in Dexie or extension storage
- use alarms instead of assuming a long-lived process
- keep background orchestration resumable

### 23.6 Scope Creep Risk

Risk:

- the team drifts into building mobile, file ingest, or agent systems before the core loop works

Mitigation:

- treat this document as the locked scope
- keep the app package landing-only for v1
- protect the demo-critical path first

---

## 24. Canonical Implementation Summary

If an implementer only remembers a few things from this document, they should remember these:

1. Coop v1 is a browser-first knowledge membrane for fragmented community context.
2. The app package is only the landing page in v1.
3. The extension is the primary node and primary product surface.
4. The coop must not begin empty; it starts with setup insights, soul, rituals, and seed contributions.
5. Capture can be passive, but sharing is always explicit.
6. Identity is passkey-first, with real Safe creation on Optimism Sepolia.
7. Tab capture must move through explicit staged objects: `TabCandidate` -> `ReadablePageExtract` -> `CoopInterpretation` -> `ReviewDraft` -> `Artifact`.
8. The coop should calibrate over time through a shared memory profile, while private browsing traces remain local.
9. Sync is live, local-first, and peer-oriented, with clear invite bootstrap material.
10. Multi-coop publish creates sibling artifacts, not one shared mutable artifact across coops.
11. Storacha/Filecoin archive is explicit and limited to approved artifacts or snapshots.
12. Coop should export structured data cleanly instead of embedding third-party cloud inference into the product.
13. Sounds are playful but controlled.
14. Builder docs and test coverage are part of the v1 build, not cleanup work for later.
