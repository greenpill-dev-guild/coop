---
title: "Product Requirements"
sidebar_label: "PRD"
sidebar_position: 1
---

# Coop - Product Requirements Document

**Version**: 0.0 (Pre-Release)
**Last Updated**: 2026-03-13
**Status**: Living document derived from codebase audit

---

## 1. Product Vision

Coop is a **browser-first, local-first knowledge commons** that helps communities turn scattered online knowledge into shared intelligence and coordinated action. Built on Ethereum principles (self-sovereignty, censorship resistance, privacy by default), Coop enables groups to capture, review, publish, and archive knowledge without central servers or custodial providers.

### Mission
Enable communities to coordinate around knowledge, including funding leads, evidence, governance insights, and ecosystem signals, without extraction, surveillance, or centralized gatekeeping.

### Alignment
Coop implements the Ethereum Foundation's March 2026 Mandate (CROPS: Censorship Resistance, Open Source, Privacy, Security) through passkey-first identity, P2P sync, local-first data, and durable Filecoin archiving.

---

## 2. Target Users

### Primary Personas

| Persona | Description | Primary Surface |
|---------|-------------|-----------------|
| **Coop Creator** | Community leader who establishes a coop, defines its purpose and lenses, manages members | Extension Sidepanel |
| **Trusted Member** | Elevated member with operator access (agent skills, grants, policies, archive) | Extension Sidepanel (Feed tab) |
| **Member** | Participant who captures tabs, reviews drafts, publishes artifacts | Extension Sidepanel |
| **Receiver User** | Mobile/secondary-device user who captures audio, photos, files, links | Receiver PWA (App) |
| **Board Viewer** | Anyone viewing a read-only coop snapshot (shared via deep link) | Board View (App) |
| **Landing Visitor** | Prospective user learning about Coop | Landing Page (App) |

---

## 3. Product Surfaces

### 3.1 Browser Extension (MV3)

**Primary product surface.** Three entry points:

| Surface | Purpose | Entry |
|---------|---------|-------|
| **Sidepanel** | Full coop workspace (4 tabs) | `Cmd+Shift+Y` or click extension icon |
| **Popup** | Quick status + actions | Click extension icon |
| **Offscreen** | Background sync (WebRTC) | Automatic, keeps sync alive when sidepanel closed |

**Keyboard Shortcuts**:
- `Cmd+Shift+Y`: Open sidepanel
- `Cmd+Shift+U`: Round up active tab
- `Cmd+Shift+S`: Capture visible tab screenshot

### 3.2 Web Application (PWA)

| Route | Purpose | Audience |
|-------|---------|----------|
| `/` | Marketing landing page | Visitors |
| `/pair` | Receiver pairing (enter/scan code) | Mobile users |
| `/receiver` | Capture interface (egg button) | Mobile users |
| `/inbox` | Capture inbox/management | Mobile users |
| `/board/:coopId` | Read-only coop graph visualization | Anyone with snapshot link |

### 3.3 Background Service Worker

Handles all business logic, storage, and message routing for the extension. Not a user-facing surface but critical to all flows.

---

## 4. User Stories & Flows

### Epic 1: Coop Lifecycle

#### US-1.1: Create a Coop
**As a** community leader,
**I want to** create a new coop with a name, purpose, and initial configuration,
**So that** my group has a shared space to coordinate around knowledge.

**Flow**:
1. Open extension sidepanel → Home tab
2. Fill "Create Coop" form:
   - Coop name (required)
   - Purpose statement (required)
   - Space type: community / worker / donor / regional
   - Creator display name (required)
   - Seed contribution (text, first artifact)
   - Capture mode: manual / 30-min / 60-min
   - Optional: Enable Green Goods garden
3. Fill 4 lens sections (each with current state, pain points, improvements):
   - Capital formation
   - Impact reporting
   - Governance coordination
   - Knowledge/garden/resources
4. Submit → Background worker:
   - Creates deterministic Safe address
   - Generates sync room config (WebRTC room ID + secrets)
   - Creates initial artifacts (setup insights, soul, rituals, seed contribution)
   - Persists to IndexedDB
5. Success: Sound event ("Rooster Call"), redirect to Roost tab

**Acceptance Criteria**:
- Coop appears in coop selector dropdown
- Initial artifacts visible in Feed
- Sync room created and connectable
- Safe address generated (mock or live depending on `VITE_COOP_ONCHAIN_MODE`)

---

#### US-1.2: Generate Invite Codes
**As a** coop creator or trusted member,
**I want to** generate time-limited invite codes,
**So that** I can share them with people I want to join my coop.

**Flow**:
1. Home tab → Click "Generate invite"
2. Select invite type: `member` or `trusted`
3. Background worker:
   - Embeds full coop bootstrap snapshot in invite
   - Signs with HMAC-SHA256 using room's `inviteSigningSecret`
   - Sets expiry: 24h (member) / 48h (trusted)
   - Encodes as base64 URL string
4. Display invite code (copyable)
5. Optional: Generate receiver pairing link for mobile onboarding

**Acceptance Criteria**:
- Invite code is copyable to clipboard
- Code contains embedded coop state (offline-capable join)
- Code expires after configured duration
- HMAC proof verifiable by join flow

---

#### US-1.3: Join a Coop via Invite
**As a** prospective member,
**I want to** join a coop using an invite code,
**So that** I can participate in the community's knowledge work.

**Flow**:
1. Open extension sidepanel → Home tab
2. Paste invite code into "Join" form
3. Enter display name + seed contribution
4. Background worker:
   - Decodes invite, verifies HMAC proof
   - Checks expiry
   - Creates member with passkey identity
   - Applies join to Yjs doc
   - Creates seed artifact
   - Connects sync providers
5. Success: Sound event, redirect to Roost

**Acceptance Criteria**:
- Member appears in coop member list
- Seed contribution visible as artifact
- Sync connection established
- Expired/invalid invites rejected with clear error

---

### Epic 2: Knowledge Capture

#### US-2.1: Manual Tab Round-Up (Extension)
**As a** coop member browsing the web,
**I want to** capture relevant tabs into my local review queue,
**So that** I can review and share useful finds with my group.

**Flow**:
1. Browse normally with extension installed
2. Trigger round-up:
   - Click "Round up" button in Chickens tab
   - Or press `Cmd+Shift+U` for active tab
   - Or right-click → "Round up this tab"
3. Extension captures:
   - Page title, meta description
   - Headings (h1-h3, max 8)
   - Paragraphs (max 12)
   - Preview image (og:image)
   - Domain, canonical URL, favicon
4. Tab candidates appear in Chickens tab
5. Local inference (optional, if opted in):
   - Scores relevance to coop purpose
   - Generates interpretation + category suggestion
   - Creates draft with confidence score

**Acceptance Criteria**:
- Captured tabs visible in Chickens tab
- Only http/https URLs captured (chrome://, about: excluded)
- Capture is entirely local, nothing sent to any server
- Multiple tabs can be captured in one round-up

---

#### US-2.2: Scheduled Capture
**As a** coop member,
**I want** the extension to periodically capture relevant tabs,
**So that** I don't miss useful context while browsing.

**Flow**:
1. Set capture mode during coop creation or in settings:
   - Manual (default, no auto-capture)
   - 30-minute intervals
   - 60-minute intervals
2. Chrome alarm triggers capture at interval
3. Extension icon state changes: `idle` → `watching` during capture
4. Candidates appear in Chickens tab
5. Icon changes to `review-needed` if new drafts were created

**Acceptance Criteria**:
- Alarm respects configured interval
- Captures only when extension is active
- Icon state reflects capture activity
- No captures in manual mode unless user triggers

---

#### US-2.3: Audio Capture (Receiver PWA)
**As a** mobile user paired to a coop,
**I want to** record voice notes and have them sync to my coop,
**So that** I can capture thoughts on the go.

**Flow**:
1. Open Receiver PWA → Capture route
2. Press egg button → "Start recording"
3. MediaRecorder captures audio (webm format, 250ms chunks)
4. Screen wake lock prevents display sleep
5. Press egg button again → "Stop recording"
6. Confirmation: "Save" or "Cancel"
7. On save:
   - Blob stored in IndexedDB (`receiverBlobs`)
   - Capture metadata stored (`receiverCaptures`)
   - Sound event ("artifact-published") + haptic ("capture-saved")
   - Hatch-in animation on preview card
8. If paired: capture queued for CRDT sync → private intake in extension

**Acceptance Criteria**:
- Recording works offline
- Audio blob persists in IndexedDB
- Sync state shown: local-only → queued → synced
- Wake lock active during recording
- Respects reduced-motion preferences

---

#### US-2.4: Photo/File Capture (Receiver PWA)
**As a** mobile user,
**I want to** capture photos and attach files,
**So that** visual evidence and documents enter my coop workflow.

**Flow**:
1. Capture route → Click "Take photo" or "Attach file"
2. Photo: Native camera UI (`capture="environment"`)
3. File: Native file picker (any type)
4. On selection: same stash flow as audio (US-2.3 step 7)

**Acceptance Criteria**:
- Camera launches on mobile devices
- Any file type accepted
- File size captured in metadata (`byteSize`)
- MIME type correctly detected

---

#### US-2.5: Link Capture via Web Share (Receiver PWA)
**As a** mobile user,
**I want to** share links from other apps directly to my coop,
**So that** interesting URLs enter my review workflow without manual copy-paste.

**Flow**:
1. In any app: Share → Select "Coop" / "Pocket Coop"
2. PWA receives share target: `?title=...&text=...&url=...`
3. `bootstrapReceiverShareHandoff()` extracts params
4. URL validated via `isSafeExternalUrl()` (http/https only)
5. `stashSharedLink()` creates link capture
6. Queued for sync if paired

**Acceptance Criteria**:
- Only http/https URLs accepted
- javascript:, data:, blob: URLs rejected
- Share intent handled even when app was closed
- Title and text preserved from share payload

---

### Epic 3: Review & Drafting

#### US-3.1: Review Tab Candidates
**As a** coop member,
**I want to** review captured tab candidates and promote them to drafts,
**So that** only relevant content enters my review queue.

**Flow**:
1. Chickens tab → List of tab candidates
2. Each candidate shows:
   - Title, domain, excerpt
   - Favicon, preview image
   - Confidence score (if local inference ran)
   - Suggested category
3. Actions per candidate:
   - Promote to draft (moves to Roost)
   - Dismiss (remove from queue)
4. If local inference is enabled:
   - Auto-promoted candidates appear directly in Roost as "candidate" stage drafts

**Acceptance Criteria**:
- Candidates sorted by capture time (newest first)
- Promotion creates ReviewDraft with `workflowStage: 'candidate'`
- Dismissed candidates removed from view
- Candidate count reflected in extension icon badge

---

#### US-3.2: Edit and Shape Drafts
**As a** coop member,
**I want to** edit draft content before publishing,
**So that** shared artifacts are accurate and well-structured.

**Flow**:
1. Roost tab → List of review drafts
2. Each draft shows:
   - Title (editable)
   - Summary (editable textarea)
   - Category (select: 11 options)
   - Tags (editable)
   - "Why it matters" (editable textarea)
   - Suggested next step (editable textarea)
   - Workflow stage: `candidate` → `ready`
   - Archive worthiness toggle
3. Edit any field → buffered locally in `draftEdits` map
4. Save → persisted to IndexedDB, synced via CRDT

**Draft Categories**:
| Category | Description |
|----------|-------------|
| `setup-insight` | Configuration/onboarding insight |
| `coop-soul` | Identity/purpose statement |
| `ritual` | Meeting/review cadence |
| `seed-contribution` | Member's initial input |
| `resource` | Useful link or document |
| `thought` | Personal reflection |
| `insight` | Analysis or observation |
| `evidence` | Supporting data/proof |
| `opportunity` | Actionable opportunity |
| `funding-lead` | Specific funding source |
| `next-step` | Concrete action item |

**Acceptance Criteria**:
- All fields editable inline
- Changes persisted to IndexedDB
- Draft synced to peers via CRDT
- Workflow stage must be `ready` before publishing

---

#### US-3.3: AI-Assisted Draft Refinement
**As a** coop member,
**I want** local AI to suggest improvements to my drafts,
**So that** content is higher quality before publishing.

**Flow**:
1. Opt in to local inference (settings toggle)
2. WebGPU check → load Qwen2.5-0.5B-Instruct model in worker
3. Click "Refine" on a draft
4. Worker generates: improved title, summary, category, tags
5. Results shown as suggestions (not auto-applied)
6. User accepts/rejects suggestions per field

**Fallback**: If WebGPU unavailable or model fails, heuristic rules engine provides basic suggestions.

**Acceptance Criteria**:
- Refinement runs entirely locally (no network calls)
- 60-second timeout with fallback to heuristics
- Progress indicator during model loading
- User has final say on all suggestions

---

#### US-3.4: Convert Receiver Intake to Drafts
**As a** coop member with paired receiver,
**I want to** convert synced receiver captures into review drafts,
**So that** mobile captures enter the same workflow as tab captures.

**Flow**:
1. Receiver captures sync into extension as "private intake"
2. Roost tab shows private intake section (receiver captures)
3. Click "Convert to draft" on an intake item
4. Creates ReviewDraft linked to original capture
5. Draft enters normal review workflow (edit → ready → publish)

**Visibility Rule**: Receiver captures are private to the paired member who captured them. Other coop members cannot see them until published.

**Acceptance Criteria**:
- Only the capturing member sees their intake items
- Conversion preserves source URL, title, metadata
- Audio/photo/file content accessible from draft
- Original capture's `intakeStatus` updates to `draft`

---

### Epic 4: Publishing & Sharing

#### US-4.1: Publish Draft to Coop
**As a** coop member,
**I want to** publish a ready draft into shared coop memory,
**So that** my group can see and act on the content.

**Flow**:
1. Roost tab → Draft with `workflowStage: 'ready'`
2. Click "Publish"
3. Validation:
   - Draft must be in `ready` stage
   - Target coop(s) must be valid
   - Member must have publish permission
   - Privacy check (receiver drafts only visible to captor)
4. Background worker:
   - Creates Artifact from draft data
   - Writes to Yjs doc (syncs to peers)
   - Removes draft from review board
   - Sound event + haptic feedback
5. Artifact appears in Feed tab for all coop members

**Acceptance Criteria**:
- Only `ready` drafts can be published
- Published artifact visible to all coop members via CRDT sync
- Draft removed from Roost after publishing
- Receiver-origin drafts respect privacy constraints

---

#### US-4.2: Publish to Multiple Coops
**As a** member of multiple coops,
**I want to** publish a draft to multiple coops simultaneously,
**So that** relevant content reaches all applicable communities.

**Flow**:
1. Draft editor → Select target coop(s) from dropdown
2. Each target validated independently
3. Publish creates artifact in each selected coop's Yjs doc

**Acceptance Criteria**:
- Target selector shows all coops the member belongs to
- Invalid/unavailable coops filtered out
- Artifact created independently in each target coop

---

### Epic 5: Feed & Coop Memory

#### US-5.1: View Coop Feed
**As a** coop member,
**I want to** see all published artifacts organized by category,
**So that** I can browse the group's shared knowledge.

**Flow**:
1. Feed tab → Artifacts grouped by category sections:
   - Setup insights
   - Rituals
   - Resources
   - Insights/Thoughts
   - Evidence
   - Opportunities (highlighted with orange glow)
   - Next steps
2. Each artifact card shows:
   - Title, summary, tags
   - Category badge
   - Author, creation date
   - Archive status (not-archived / pending / archived)
   - Preview image (if available)
3. Opportunity artifacts get special treatment:
   - Orange border + gradient background
   - Visual celebration of knowledge→opportunity transformation

**Acceptance Criteria**:
- Artifacts grouped by category with section headers
- Real-time updates via CRDT sync
- Opportunity category visually distinct
- Empty category sections hidden

---

#### US-5.2: View Archive Receipts
**As a** coop member,
**I want to** see proof that artifacts have been archived,
**So that** I can trust the group's knowledge is durably stored.

**Flow**:
1. Feed tab → Archive receipts section
2. Each receipt shows:
   - Scope: "Shared find" (artifact) or "Coop snapshot"
   - Status: Waiting → Saved → Tracked → Deep saved
   - Gateway link (if available, e.g., `storacha.link/ipfs/{cid}`)
   - Bundle CID, piece CIDs
   - Filecoin deal status

**Acceptance Criteria**:
- Receipts shown in reverse chronological order
- Gateway links validated via `isSafeExternalUrl()`
- Status labels clearly indicate archival progress
- Mock mode generates pseudo-CIDs (dev/test)

---

### Epic 6: Archiving

#### US-6.1: Archive Artifact
**As a** trusted member,
**I want to** archive an artifact to Storacha/Filecoin,
**So that** important knowledge is durably preserved.

**Flow**:
1. Feed tab → Click "Archive" on an artifact
2. Background worker:
   - Creates archive bundle (JSON with coop context)
   - Uploads to Storacha (or generates mock receipt)
   - Creates ArchiveReceipt with CIDs
   - Updates artifact's `archiveStatus` to `archived`
3. Receipt appears in archive trail
4. Sound event on success

**Archive Modes**:
- `mock`: Generates pseudo-CIDs, no network call
- `live`: Uploads to Storacha, tracks Filecoin deals

**Acceptance Criteria**:
- Archive creates verifiable receipt with CID
- Receipt includes gateway URL for retrieval
- Filecoin status trackable (offered → indexed → sealed)
- Failed archives show clear error with retry option

---

#### US-6.2: Archive Coop Snapshot
**As a** trusted member,
**I want to** archive a full coop state snapshot,
**So that** the entire group's progress is preserved at a point in time.

**Flow**:
1. Feed tab → "Archive snapshot" action
2. Background worker:
   - Serializes full `CoopSharedState`
   - Creates archive bundle with scope: 'snapshot'
   - Uploads and creates receipt
3. Snapshot receipt linked to all artifacts at that point in time

**Acceptance Criteria**:
- Snapshot contains complete coop state
- Board view can render snapshots via deep link
- Snapshot CID is content-addressable (same state = same CID)

---

#### US-6.3: Export Artifact/Snapshot
**As a** coop member,
**I want to** export artifacts or snapshots as downloadable files,
**So that** I have offline copies of important knowledge.

**Flow**:
1. Feed tab → "Export" action on artifact or snapshot
2. Background worker generates export bundle (JSON)
3. Browser download triggered

**Acceptance Criteria**:
- Export creates valid JSON file
- File contains all artifact metadata + coop context
- Works offline (no network required)

---

### Epic 7: Board Visualization

#### US-7.1: View Coop Board
**As a** anyone with a board link,
**I want to** see a visual graph of a coop's knowledge structure,
**So that** I can understand the relationships between members, captures, drafts, and artifacts.

**Flow**:
1. Receive deep link: `/board/:coopId#snapshot=...`
2. App extracts snapshot from URL hash
3. `buildCoopBoardGraph()` generates node/edge layout
4. ReactFlow renders interactive (pan/zoom) read-only graph
5. Sidebar shows archive story + receipt trail

**Node Types**:
| Type | Visual | Description |
|------|--------|-------------|
| Coop | Brown card | The coop itself |
| Member | Teal card | Participating member |
| Capture | Light card | Tab candidate or receiver capture |
| Draft | Blue-tint card | Review draft |
| Artifact | Green-tint card | Published artifact |
| Archive | Orange-tint card | Archived artifact |

**Edge Types**:
| Type | Style | Description |
|------|-------|-------------|
| captured-by | Brown solid | Member → Capture |
| draft-seeded-from-capture | Teal solid | Capture → Draft |
| routed-to-coop | Green dashed, animated | Draft → Coop |
| published-to-coop | Dark green solid | Artifact → Coop |
| archived-in | Orange solid | Artifact → Archive |

**Acceptance Criteria**:
- Graph renders with correct node/edge layout
- Pan and zoom work (no drag/select, read-only)
- MiniMap provides overview navigation
- Archive story sidebar shows narrative + receipts
- Missing/invalid snapshot shows clear error with guidance

---

### Epic 8: Receiver Pairing & Sync

#### US-8.1: Pair Receiver Device
**As a** coop member,
**I want to** pair my mobile device to my coop,
**So that** I can capture content on the go and sync it to my desktop.

**Flow**:
1. Extension: Generate pairing link (Home tab or Settings)
2. Mobile: Open Receiver PWA → Pair route
3. Enter pairing code via:
   - Paste nest code (`coop-receiver:...`)
   - Paste protocol link (`web+coop-receiver://pair?payload=...`)
   - Paste URL (`https://coop.town/pair#payload=...`)
   - Scan QR code (if BarcodeDetector available)
4. Review pairing details:
   - Coop name, member name
   - Issued date, expiry date
5. Confirm → "Join this coop"
6. Pairing saved to IndexedDB, CRDT sync binding established

**Pairing Payload** (Version 1):
- pairingId, coopId, coopDisplayName
- memberId, memberDisplayName
- pairSecret, roomId, signalingUrls
- issuedAt, expiresAt (7-day default)

**Acceptance Criteria**:
- All 4 input methods work (paste code, paste link, paste URL, scan QR)
- Pairing shows confirmation before committing
- Expired pairings rejected with clear error
- Sound + haptic feedback on successful pairing

---

#### US-8.2: Sync Captures to Extension
**As a** paired receiver user,
**I want** my captures to sync automatically to my extension,
**So that** mobile content appears in my review queue without manual transfer.

**Flow**:
1. Capture created on receiver → `syncState: 'local-only'`
2. If paired: state changes to `queued`
3. CRDT sync via Yjs + y-webrtc:
   - Envelope created with capture + base64 asset + HMAC-SHA256 auth
   - Written to receiver sync doc
   - WebRTC transport delivers to extension
4. Extension receives → validates → stores in private intake
5. Receiver capture state: `queued` → `synced`
6. Browser notification on first sync

**Sync States**:
| State | Visual | Description |
|-------|--------|-------------|
| `local-only` | Gray pill | Not yet queued (no pairing) |
| `queued` | Orange pill | Waiting for sync transport |
| `synced` | Green pill | Successfully delivered to extension |
| `failed` | Red pill | Sync error (with retry option) |

**Acceptance Criteria**:
- Sync works via WebRTC (P2P, no central server)
- Offscreen document keeps sync alive when sidepanel closed
- Failed syncs show error message + retry button
- Notification sent on first successful sync
- Works across different networks (via signaling server)

---

### Epic 9: Identity & Access

#### US-9.1: Passkey Identity Creation
**As a** new user,
**I want to** create a passkey identity,
**So that** I can participate in coops without managing wallet keys.

**Flow**:
1. First coop creation or join → passkey prompt
2. WebAuthn API: `navigator.credentials.create()`
3. Passkey stored on device (platform authenticator)
4. Identity record created in IndexedDB:
   - id, displayName, ownerAddress (deterministic)
   - createdAt, lastUsedAt
   - passkey credential data

**Acceptance Criteria**:
- Works with platform authenticators (Touch ID, Face ID, Windows Hello)
- No wallet extension required
- Identity persists across browser sessions
- Mock mode available for testing (no WebAuthn required)

---

#### US-9.2: Trusted Member Operations
**As a** trusted member or creator,
**I want** elevated access to operator features,
**So that** I can manage the coop's automated systems and policies.

**Operator Console Features**:
1. **Trusted Helpers**: Agent skill auto-run toggles
2. **Approval Rules**: Action policy toggles (12 action classes)
3. **Waiting Chores**: Action queue (propose → approve → reject → execute)
4. **Grants**: Issue/revoke execution grants (time-bound, usage-limited)
5. **Session Capabilities**: Smart session management (ERC-4337)
6. **Garden Requests**: Green Goods work approvals, assessments, admin sync
7. **Agent Dashboard**: Observations, plans, skill runs

**Access Control**: Only `creator` and `trusted` roles see the Operator Console (in Feed tab).

---

### Epic 10: Agent Automation

#### US-10.1: Agent Observation & Cycle
**As a** trusted member,
**I want** automated agents to observe relevant signals and generate drafts,
**So that** the coop captures opportunities I might miss.

**Observation Triggers**:
| Trigger | When |
|---------|------|
| `high-confidence-draft` | Tab candidate scores above threshold (0.24) |
| `receiver-backlog` | Unprocessed receiver captures exist |
| `stale-archive-receipt` | Archive receipt needs refresh |
| `ritual-review-due` | Weekly review cadence triggered |
| `green-goods-*` | Garden operations needed |

**Agent Skills** (execution order):
1. `opportunity-extractor`: Identifies funding/opportunity signals
2. `grant-fit-scorer`: Scores grant fit
3. `capital-formation-brief`: Generates capital formation summaries
4. `review-digest`: Creates review digests
5. `ecosystem-entity-extractor`: Extracts entity references
6. `theme-clusterer`: Groups related content
7. `publish-readiness-check`: Validates draft quality
8. `green-goods-*`: Garden automation (5 skills)

**Flow**:
1. Observation created → Agent cycle triggered
2. Skills selected based on observation trigger
3. Each skill runs → generates output
4. Output creates plan → approval required (unless auto-run enabled)
5. Approved plans create/update drafts
6. Drafts enter normal review workflow

**Acceptance Criteria**:
- Agent cycle runs only when triggered (not continuously)
- Skills execute in defined order
- Plans require human approval by default
- Auto-run configurable per skill
- Failed skills don't block other skills

---

### Epic 11: Onchain Integration

#### US-11.1: Safe Account Creation
**As a** coop creator,
**I want** a Safe smart account created for my coop,
**So that** the group has onchain governance capability.

**Modes**:
- `mock`: Deterministic address from coop name (no network call)
- `live`: Deploy via Pimlico ERC-4337 bundler

**Chains**:
- `sepolia`: Ethereum Sepolia testnet (development)
- `arbitrum`: Arbitrum One mainnet (production)

**Acceptance Criteria**:
- Mock mode works offline with deterministic addresses
- Live mode deploys real Safe via ERC-4337
- Safe address stored in coop's onchain state
- Deployment hash tracked for verification

---

#### US-11.2: Green Goods Garden Integration
**As a** coop creator,
**I want** to create a Green Goods garden linked to my coop's Safe,
**So that** agricultural/regenerative coordination happens onchain.

**Garden Operations**:
1. Bootstrap garden (mint token via gardenToken contract)
2. Sync profile (update name, description, location, domains)
3. Set domains (agriculture, education, solar, waste)
4. Create pools (via GardensModule contract)
5. Submit work approvals (via EAS attestation)
6. Submit assessments (via EAS attestation)
7. Sync GAP admin addresses (via KarmaGapModule)

**Acceptance Criteria**:
- Garden creation mints token to Safe address
- Profile sync updates onchain data
- Work approvals create verifiable attestations
- All operations go through Smart Session (bounded, time-limited)

---

### Epic 12: Settings & Preferences

#### US-12.1: Sound & Haptic Preferences
**As a** user,
**I want to** control sound and vibration feedback,
**So that** the app doesn't disrupt me in quiet environments.

**Sound Events**:
| Event | Trigger | Sound |
|-------|---------|-------|
| `coop-created` | New coop or pairing confirmed | Rooster Call |
| `artifact-published` | Capture saved or first sync | Soft Cluck |
| `sound-test` | Settings test button | Squeaky Test |

**Haptic Events**:
| Event | Trigger |
|-------|---------|
| `capture-saved` | Any capture stored |
| `pairing-confirmed` | Receiver pairing accepted |
| `sync-completed` | First CRDT sync success |
| `button-press` | Haptics toggle enabled |
| `error` | Sync failure |

**Acceptance Criteria**:
- Toggles persist in IndexedDB
- Respects `prefers-reduced-motion: reduce` media query
- Sound plays via Web Audio API
- Haptics via Vibration API (mobile only)

---

#### US-12.2: Notification Preferences
**As a** receiver user,
**I want to** control browser notifications,
**So that** I'm alerted to important events without spam.

**Notification Events**:
- Receiver paired
- First sync completed
- Sync failure (individual capture)

**Acceptance Criteria**:
- Permission requested on first toggle
- Tags prevent duplicate notifications
- Disabled gracefully if permission denied
- Works on both desktop and mobile browsers

---

## 5. Extension Icon State Machine

```
         ┌─────────┐
    ┌────│  idle    │────┐
    │    └─────────┘    │
    │         │         │
    │    capture        │
    │    triggered      │  error/
    │         │         │  offline
    │    ┌─────────┐    │
    │    │watching  │    │
    │    └─────────┘    │
    │         │         │
    │    drafts         │
    │    created        │
    │         │         │
    │    ┌─────────────┐│
    └────│review-needed ││
         └─────────────┘│
              │         │
         all drafts     │
         resolved       │
              │    ┌────────────┐
              └────│error-offline│
                   └────────────┘
```

| State | Icon | Description |
|-------|------|-------------|
| `idle` | Default | Extension ready, no pending work |
| `watching` | Active | Capture in progress (manual or scheduled) |
| `review-needed` | Badge | Drafts waiting in Roost for review |
| `error-offline` | Warning | Permissions, sync, or model issue |

---

## 6. Data Model Summary

### Storage Layers

| Layer | Technology | Scope | Purpose |
|-------|-----------|-------|---------|
| IndexedDB | Dexie | Per-device | Structured data (drafts, captures, receipts) |
| Yjs | CRDT | Per-coop | Real-time collaborative state |
| y-webrtc | WebRTC | Per-room | Peer-to-peer transport |
| chrome.storage.sync | Chrome | Cross-device | UI preferences |
| chrome.storage.local | Chrome | Per-device | Extension settings |
| localStorage | Browser | Per-origin | Onboarding state |

### Key Entities

| Entity | Created By | Stored In | Synced Via |
|--------|-----------|-----------|------------|
| CoopSharedState | Create flow | IndexedDB + Yjs | y-webrtc |
| TabCandidate | Tab capture | IndexedDB | Local only |
| ReviewDraft | Promotion/AI | IndexedDB + Yjs | y-webrtc |
| Artifact | Publish flow | Yjs | y-webrtc |
| ArchiveReceipt | Archive flow | Yjs | y-webrtc |
| ReceiverCapture | Receiver PWA | IndexedDB | Receiver CRDT |
| ReceiverPairing | Pairing flow | IndexedDB | Local only |
| ExecutionGrant | Operator | IndexedDB | Local only |
| SessionCapability | Operator | IndexedDB | Local only |
| AgentObservation | Agent cycle | IndexedDB | Local only |

---

## 7. Security Model

### Trust Boundaries

```
┌─────────────────────────────────────┐
│         Local Device (Trusted)       │
│  IndexedDB, Passkey, Private Keys   │
│                                     │
│  ┌───────────────────────────────┐  │
│  │   Sync Room (Room-Secret)     │  │
│  │   Only invited peers can join │  │
│  │   CRDT updates not signed     │  │
│  │   (known limitation)          │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │   Receiver Room (Pair-Secret) │  │
│  │   HMAC-SHA256 auth per sync   │  │
│  │   envelope                    │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
         │
         │ Explicit publish only
         ▼
┌─────────────────────────────────────┐
│      Shared Coop State (CRDT)       │
│  Schema-validated, not author-signed│
│  Room secret = trust boundary       │
└─────────────────────────────────────┘
         │
         │ Explicit archive only
         ▼
┌─────────────────────────────────────┐
│      Storacha / Filecoin            │
│  Content-addressed, immutable       │
│  Verifiable via CID                 │
└─────────────────────────────────────┘
```

### Key Security Properties

| Property | Implementation |
|----------|---------------|
| Identity | Passkey (WebAuthn), no custodial keys |
| Data at rest | IndexedDB (browser sandbox) |
| Data in transit | WebRTC (DTLS encryption) |
| Invite integrity | HMAC-SHA256 proof |
| Session encryption | AES-GCM with PBKDF2 (120K iterations) |
| Archive integrity | Content-addressing (IPFS CIDs) |
| Smart sessions | ERC-4337 with time + usage limits |
| Grant delegation | Time-bound, usage-limited, revocable |

### Known Limitations

1. CRDT updates are schema-validated but not author-authenticated. A compromised peer can inject valid-looking data.
2. Room secret is the sole trust boundary for sync. If leaked, unauthorized peers can read/write.
3. Local inference model quality depends on device capability (WebGPU)

---

## 8. Non-Functional Requirements

### Performance
- Extension sidepanel loads < 500ms
- Tab capture completes < 2s per tab
- CRDT sync latency < 1s (same network)
- Local inference < 60s timeout (with fallback)
- Board graph renders < 3s for 50-node graphs

### Reliability
- All captures survive browser crashes (IndexedDB persistence)
- Sync automatically retries on failure (exponential backoff)
- Offscreen document keeps sync alive when sidepanel closed
- Service worker restarts on crash

### Compatibility
- Chrome 120+ (MV3 requirement)
- Mobile browsers: Safari 16+, Chrome 120+ (PWA)
- Chains: Arbitrum One, Ethereum Sepolia

### Accessibility
- WCAG 2.1 AA compliance target
- Keyboard navigable
- Screen reader compatible (ARIA labels, landmarks)
- Reduced motion support
- Color contrast meets AA ratios
- Touch targets >= 44x44px

---

## 9. Brand Vocabulary

| Concept | Metaphor | Used In |
|---------|----------|---------|
| Browser tabs / scattered context | "Loose Chickens" | Extension tab, landing page |
| Local review queue | "The Roost" | Extension tab, landing page |
| Shared feed / coop memory | "Coop Feed" / "The Feed" | Extension tab, landing page |
| Creating a coop | "Launching the Coop" | Landing page |
| Capturing content | "Rounding up" (extension) / "Hatching" (receiver) | Both surfaces |
| Individual captures | "Chicks" | Receiver inbox |
| Private device storage | "Nest" | Receiver |
| Success celebration | Rooster Call + orange glow | Both surfaces |
| Knowledge → Opportunity | Orange glow on opportunity artifacts | Extension feed |
| Receiver device | "Pocket Coop" | Receiver PWA |

---

## 10. Configuration & Environment

### Environment Variables (Single `.env` at root)

| Variable | Values | Default | Purpose |
|----------|--------|---------|---------|
| `VITE_COOP_CHAIN` | `sepolia`, `arbitrum` | `sepolia` | Target blockchain |
| `VITE_COOP_ONCHAIN_MODE` | `mock`, `live` | `mock` | Safe deployment mode |
| `VITE_COOP_ARCHIVE_MODE` | `mock`, `live` | `mock` | Storacha upload mode |
| `VITE_COOP_SESSION_MODE` | `mock`, `live`, `off` | `off` | Smart session mode |
| `VITE_PIMLICO_API_KEY` | API key | | ERC-4337 bundler |
| `VITE_STORACHA_ISSUER_URL` | URL | | Archive delegation |
| `VITE_COOP_SIGNALING_URLS` | CSV of URLs | | WebRTC signaling servers |
| `VITE_COOP_RECEIVER_APP_URL` | URL | `https://coop.town` | Receiver PWA URL |
| `VITE_COOP_LOCAL_ENHANCEMENT` | `on`, `off` | `on` | Local inference toggle |

---

## 11. Release Criteria (v0.0)

### Must Pass
- [ ] `bun format && bun lint`: Zero warnings
- [ ] `bun run test`: All unit tests pass
- [ ] `bun build`: Clean build (shared → app → extension)
- [ ] `bun run validate core-loop`: Two-profile coop lifecycle
- [ ] `bun run validate flow-board`: Board visualization + archive
- [ ] `bun run validate receiver-slice`: Receiver pairing + sync

### Should Pass
- [ ] `bun run validate full`: All suites including receiver-hardening
- [ ] Manual test: Create coop → invite → join → capture → review → publish → archive → board
- [ ] Manual test: Receiver pairing → audio capture → sync → convert to draft → publish
- [ ] Accessibility audit: keyboard navigation through all flows
- [ ] Mobile responsive check: Landing page + Receiver PWA on mobile viewport
