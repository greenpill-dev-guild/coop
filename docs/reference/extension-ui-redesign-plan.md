# Extension UI Redesign Plan

> **Implementation Status (2026-03-22)**: Phase 1 implemented with significant naming changes. Planned tabs (Chickens | Feed | Contrib | Manage) shipped as **Roost | Chickens | Coops | Nest**. The Nest tab absorbs planned Contribute + Manage + Settings functionality.

> Date: 2026-03-21
> Status: Approved — ready to build

## Overview

Redesign the extension's popup and sidepanel to share a consistent layout pattern (fixed header, scrolling content, fixed bottom tab bar) with clear feature ownership across surfaces. Remove bloat from the sidepanel header, consolidate tabs from 6 to 4, and align naming/interaction patterns between popup and sidepanel.

---

## Design Principles

1. **Consistent chrome**: Both popup and sidepanel use fixed header + fixed footer nav + scrolling content between them
2. **Naming consistency**: "Chickens" everywhere (not "Roost" in sidepanel, "Drafts" in popup)
3. **Filter, don't switch**: No coop switcher UI — use filter-by-coop dropdowns on lists instead
4. **Automate the pipeline**: Routing/scoring happens silently — users see results as chickens, not relevance scores
5. **Quick from popup, deep from sidepanel**: Popup handles fast actions; sidepanel handles editorial and admin work
6. **Badge-driven attention**: Use badge counts on tabs to direct user attention, not OS notification spam

---

## Popup (360x520px)

### Layout

```
┌──────────────────────────────┐
│ [brand]  [+ Create/Join]  [profile] │  ← fixed header
├──────────────────────────────┤
│                              │
│      scrollable content      │
│                              │
├──────────────────────────────┤
│   Home   │  Chickens  │  Feed   │  ← fixed footer nav
└──────────────────────────────┘
```

### Header

- **Left**: Brand mark (tap → plays rooster sound)
- **Center/Right**: `+` button for Create Coop / Join Coop (on Home screen at minimum, potentially all screens)
- **Right**: Profile button (opens overlay), theme toggle, sidepanel toggle

### Footer Nav (3 tabs)

| Tab | Badge | Content |
|-----|-------|---------|
| **Home** | — | Status pills, capture buttons (round up, capture tab, screenshot), quick notes, audio record button, file upload button, social post button (stubbed) |
| **Chickens** | Draft count | Draft list filtered by coop, tap to review/edit (title + summary), mark ready, share |
| **Feed** | New artifact count | Published artifacts filtered by coop, artifact detail dialog |

### Profile Panel (overlay)

- Your coops list → each coop shows invite code (tap to copy), with badge for member vs trusted-member code type
- `+ Create coop` and `Join with code` buttons at bottom of coop list
- Sound toggle (on/off)
- Notifications toggle (on/off)
- Theme (system/dark/light)
- Agent cadence (10m/15m/30m/60m)
- Local inference toggle (on/off)

### Screens

| Screen | Access | Content |
|--------|--------|---------|
| **Home** | Footer tab | Status dashboard (sync, chicken count, receiver status). Capture actions: round up, capture tab, screenshot. Quick notes (collapsible textarea). Action buttons: audio record, file upload, social post (stub). |
| **Chickens** | Footer tab | Filter-by-coop dropdown. Draft list with title, summary, category pill, coop label. Each row: "Review" → detail, "Mark ready" / "Share" actions. |
| **Chicken Detail** | Tap from Chickens list | Title input, summary textarea, domain + date meta. Save, mark ready/send back, share buttons. |
| **Feed** | Footer tab | Filter-by-coop dropdown. Artifact list, each tappable for detail dialog (summary, why it matters, next step, sources). |
| **Create Coop** | Header `+` or profile panel | Name, your name, purpose. Simple form. |
| **Join Coop** | Header `+` or profile panel | Invite code, your name. Simple form. |
| **Welcome** | First-launch only | Create or join prompt with onboarding hero. |

---

## Sidepanel

### Layout

```
┌─────────────────────────────────┐
│ [brand mark]     [filter pill]  │  ← compact fixed header (one line)
├─────────────────────────────────┤
│                                 │
│       scrollable content        │
│                                 │
├─────────────────────────────────┤
│ Chickens │ Feed │ Contrib │ Manage │  ← fixed bottom bar
└─────────────────────────────────┘
```

### Header (compact — one line)

- **Left**: Brand mark
- **Right**: Active coop filter pill (tap to change filter across all tabs)
- **No**: summary strip, state text, coop switcher, action row — all removed

### Footer Nav (4 tabs)

> **As-shipped (2026-03-22):** Tabs are **Roost | Chickens | Coops | Nest** (see [Divergences from Plan](#divergences-from-plan)).

| Tab (planned) | Tab (shipped) | Badge | Who sees it |
|---------------|---------------|-------|-------------|
| **Chickens** (merged Roost) | **Roost** (kept separate) | Pending draft count | Everyone |
| *(merged into Chickens)* | **Chickens** | Loose chicken count | Everyone |
| **Feed** | **Coops** | New artifact count | Everyone |
| **Contribute** | **Nest** (combined) | Pending actions count | Any member |
| **Manage** | **Nest** (combined) | Pending approvals count | Trusted members (Nest tab conditionally shown via `showNestTab`) |

### Tab Content

#### Chickens Tab

Merges the old "Loose Chickens" and "Roost" tabs. Routing happens silently in the background — users see one unified list of chickens at various lifecycle stages.

- Filter-by-coop dropdown
- Chicken list (filterable by status: draft / ready / all)
- Full inline editor per chicken:
  - Title, summary, category, tags
  - "Why it matters", "Suggested next step"
  - Coop assignment
  - Inference bridge integration (AI-assisted refinement)
- Actions: mark ready, share to feed, refine with agent
- Capture actions (secondary/subtle): round up, capture tab, screenshot

#### Feed Tab

- Filter-by-coop dropdown
- Published artifact cards with detail expansion
- Archive receipts (Storacha proofs, Filecoin seals)
- Social posting (stubbed): "Share something" compose button at top → compose view → review → post (WIP — placeholder flow, definition of "post" deferred)
- Archive operations (save snapshot, view receipts)

#### Contribute Tab

Community-facing actions any member can take. Not admin-gated.

- **Impact reporting** (WIP — stubbed with placement)
  - Submit impact observations for coop activities
  - View past reports
- **Capital formation & payouts** (WIP — stubbed with placement)
  - View allocation proposals
  - Claim payouts
- **Receiver pairing** (quick pair)
  - "Pair a device" button → generate code
  - Link to Manage tab for full pairing management
- **Garden activities** (generic capability, not branded "Green Goods")
  - Contextual actions based on coop configuration

#### Manage Tab

Trusted-member / admin tools. Conditionally shown based on role, or collapsed with "request access" prompt for non-trusted members.

- **Member management**
  - Member list with roles and status
  - Onchain account provisioning
- **Invite generation**
  - Two invite types clearly separated:
    - **Member invite**: General access — capture, contribute, view feed
    - **Trusted member invite**: Multisig signer — admin access, approve actions, manage policies
  - Copy/share invite codes
  - View who joined via which code
- **Operator Console**
  - Agent skill manifest and cycle control
  - Plan approval/rejection
  - Policy action approval queue
  - Permit issuance/revocation
  - Session capability management
- **Receiver management** (full)
  - All pairings list
  - Receiver intake cards (review incoming captures)
  - Sync bridge status
- **Data operations**
  - Export snapshot / artifact / receipt
  - Clear sensitive data

---

## Features Removed / Automated / Deferred

| Feature | Action | Rationale |
|---------|--------|-----------|
| **Routing candidates UI** | Automate silently | Routing scores, rationale, chip buttons — users don't need to see this. Chickens just appear in their list after pipeline runs. |
| **Flock Meeting mode** | Remove | Not needed for current scope. Can be re-added later as a Contribute or dedicated tab. |
| **Stealth addresses** | Defer/hide | Too advanced for current user needs. |
| **Coop switcher** | Replace with filters | Filter-by-coop dropdowns on each list. No whole-UI context shift. |
| **Sidepanel summary strip** | Remove | Status info already in popup home. Sidepanel header should be minimal. |
| **Sidepanel state text** | Remove | "Local-first unless you share" can be a tooltip or onboarding hint. |
| **Sidepanel action row** | Remove | Coop board link can live in Feed tab or be contextual. |
| **Nest Tools tab** | Dissolve | Settings → popup profile panel. Exports → Manage tab. |
| **Nest tab** | Dissolve | Create/join → popup. Member management → Manage tab. Receiver → split between Contribute (quick pair) and Manage (full). |

---

## Notification Strategy

### Three layers

| Layer | Surface | Behavior | Examples |
|-------|---------|----------|---------|
| **Badge counts** | Footer tab icons (popup + sidepanel) | Numeric badges on tabs when items need attention | Chickens: "3" new drafts. Feed: "2" new artifacts. Manage: "1" pending approval. |
| **Extension icon** | Browser toolbar | Dot or count for total pending items | Red dot = action required. |
| **In-app banner** | Top of content area (below header) | Dismissible contextual banner for recent events | "3 new chickens from your last roundup" — tap to scroll. |

### De-emphasized

- **OS notifications**: Keep opt-in, only for critical events (action approvals, new member joined). Not the primary notification channel.
- **Sounds**: Independent toggle. Play on coop-created, artifact-published, action-awaiting-review.

### Notification events and their surface

| Event | Badge on | Banner in | OS notification |
|-------|----------|-----------|-----------------|
| New chickens from roundup | Chickens tab | Chickens tab | No |
| Draft marked ready | Chickens tab | Chickens tab | No |
| Artifact published to feed | Feed tab | Feed tab | No |
| Action awaiting approval | Manage tab | Manage tab | Yes (if enabled) |
| New member joined | Manage tab | Manage tab | Yes (if enabled) |
| Receiver paired | Contribute tab | Contribute tab | Yes (if enabled) |
| Archive completed | Feed tab | Feed tab | No |
| Agent plan needs approval | Manage tab | Manage tab | Yes (if enabled) |

---

## Invite Code System

Two distinct invite types, clearly separated in UI:

| Type | Access granted | Who can generate | Where shown |
|------|---------------|-----------------|-------------|
| **Member invite** | Capture, contribute, view feed, Contribute tab | Any trusted member | Popup profile panel (per coop) + Manage tab |
| **Trusted member invite** | All member access + Manage tab, multisig signer, approve actions | Existing trusted members (threshold governance) | Manage tab only |

Invite codes should be:
- Easily copyable (tap to copy with confirmation)
- Visible per-coop in the popup profile panel (member codes)
- Full management (generate, revoke, view usage) in Manage tab

---

## Lifecycle: Capture → Chicken → Feed

```
[Capture]           [Chicken]              [Feed]
 Tab/audio/file  →  AI routes silently  →  Published artifact
 Screenshot         User reviews draft     Visible to coop
 Quick note         Edits, marks ready     Archived (Storacha)
 Social post        Shares to feed
```

The user never sees "routing candidates" or "relevance scores." They capture things, chickens appear in their list, they review and share.

---

## Implementation Scope

### Phase 1: Sidepanel restructure
- Collapse 6-tab strip to 4-tab bottom bar
- Replace sticky header with compact one-line header
- Merge Loose Chickens + Roost into unified Chickens tab
- Dissolve Nest Tools into popup profile panel
- Dissolve Nest into Contribute + Manage tabs
- Remove Flock Meeting tab
- Remove coop switcher, add filter-by-coop dropdowns

### Phase 2: Popup enhancements
- Add screenshot capture button to Home
- Add Create/Join coop to header (+ button)
- Add invite code display to profile panel per coop
- Add audio record and file upload button actions
- Stub social post button
- Add badge counts to footer tabs

### Phase 3: Notification system
- Badge counts on all footer tabs (popup + sidepanel)
- Extension icon dot/count indicator
- In-app contextual banners
- Reduce OS notification reliance

### Phase 4: WIP feature stubs
- Impact reporting UI placeholder in Contribute
- Capital formation / payouts placeholder in Contribute
- Social posting compose flow placeholder in Feed
- Garden activity cards in Contribute

---

## Resolved Decisions

1. **Header `+` button**: Shows a small dropdown/popover with two choices ("Create coop" / "Join with code"), then navigates to the respective screen. Lightweight — doesn't take over content until they've chosen.
2. **Manage tab visibility**: Hidden entirely for non-trusted members — they see 3 tabs (Chickens, Feed, Contribute). No dead-end UI. Tab appears when they become trusted.
3. **Audio recording in popup**: Use persistent offscreen recording. User taps "Record" in popup, recording persists even if popup closes. Re-opening popup shows recording state with stop button. Background service worker manages the MediaRecorder via offscreen document.
4. **Chicken lifecycle in unified list**: Filter tabs at top of list (All | Drafts | Ready) — matches "filter, don't switch" principle.
5. **Build approach**: Commit current working tree state, then build redesign as commits on main.

## Open Questions (deferred)

1. **Social posting**: What constitutes a "post"? Text? Artifact summary? Link? Needs product definition.
2. **Filter pill in sidepanel header**: Should it be a dropdown, a pill with tap-to-cycle, or a sheet? Will determine during implementation.

---

## Divergences from Plan

Documented 2026-03-22 after Phase 1 implementation.

| Area | Planned | Shipped |
|------|---------|---------|
| **Sidepanel tab names** | Chickens \| Feed \| Contrib \| Manage | Roost \| Chickens \| Coops \| Nest |
| **Roost tab** | Merged into unified Chickens tab | Kept as a separate tab — review queue remains distinct from loose chickens |
| **Contribute tab** | Standalone tab (receiver pairing, impact reporting, garden) | Absorbed into NestTab as sections: `NestReceiverSection`, `NestInviteSection` |
| **Manage tab** | Standalone tab (members, invites, operator console, data ops) | Absorbed into NestTab as sections: `NestAgentSection`, `NestArchiveSection`, `NestSettingsSection` |
| **Feed tab** | Sidepanel tab showing published artifacts | Feed moved to popup footer nav; sidepanel equivalent is CoopsTab showing feed content |
| **Coop filter** | "Filter pill" in sidepanel header | Implemented as `TabCoopSelector` (pill strip) and `FilterPopover` components usable per-tab |
| **Popup** | Minor enhancements (Phase 2) | Fully redesigned with multi-screen router (`PopupScreenRouter`), share menu, subheader, and orchestration hook — exceeds original plan scope |
