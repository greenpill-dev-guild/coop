# Extension Package Context

The extension is the primary product surface for Coop. It is a Chrome MV3 browser extension with a background service worker, popup, sidepanel, catalog, and offscreen document.

## Architecture

### MV3 Manifest Surfaces

```
packages/extension/
  public/
    manifest.json             # MV3 manifest (permissions, service worker, sidepanel)
    popup.html                # Action popup entry
    sidepanel.html            # Side panel entry
    receiver-bridge.js        # Content script injected on localhost/127.0.0.1
    audio/                    # Sound effect .wav/.mp3 files
  src/
    background.ts             # Service worker (~740 lines, delegates to handler modules)
    background/
      context.ts              # Shared state: db, coop docs, settings, alarm management
      dashboard.ts            # DashboardResponse assembly + popup snapshot
      sidepanel.ts            # Sidepanel lifecycle management
      alarm-dispatch.ts       # Alarm handler dispatch
      operator.ts             # Trusted-node / operator runtime logic
      handlers/
        agent.ts              # Agent cycle, plan approval, skill runs
        archive.ts            # Storacha upload, archive receipts
        capture.ts            # Tab capture, passive pipeline, screenshot
        coop.ts               # Coop creation, join, profile, leave
        review.ts             # Draft review, publish, mark-ready
        receiver.ts           # Receiver pairing, sync, intake
        session.ts            # Session capability issue/rotate/revoke
        permits.ts            # Execution permit issue/revoke/execute
        actions.ts            # Policy action propose/approve/reject/execute
        action-executors.ts   # Green Goods and delegated action executors
        member-account.ts     # Member onchain account provisioning
        heartbeat.ts          # Heartbeat / keep-alive handling
    runtime/
      messages.ts             # RuntimeRequest union type, sendRuntimeMessage(), DashboardResponse
      config.ts               # Env var resolution (chain, mode, signaling URLs)
      tab-capture.ts          # DOM snapshot extraction (headings, paragraphs, og:image)
      audio.ts                # Sound playback from .wav files in public/audio/
      receiver.ts             # Receiver pairing/capture visibility filtering
      receiver-sync-offscreen.ts  # Offscreen document for WebRTC in SW context
      review.ts               # Review context resolution helpers
      inference-bridge.ts     # Bridge to inference worker for local AI
      inference-worker.ts     # WebWorker for local inference (WebGPU/WASM)
      agent-harness.ts        # Agent harness orchestration
      agent-registry.ts       # Registered skill discovery
      agent-runner.ts         # Agent execution loop
      agent-config.ts         # Agent configuration resolution
      agent-eval.ts           # Agent output evaluation
      agent-knowledge.ts      # Knowledge skill loading/management
      agent-logger.ts         # Agent run logging
      agent-models.ts         # Agent model type definitions
      agent-output-handlers.ts # Agent output processing
      agent-quality.ts        # Agent output quality scoring
      agent-webllm-bridge.ts  # WebLLM model bridge
      agent-webllm-worker.ts  # WebLLM worker thread
      skill-markdown.ts       # SKILL.md file loading and parsing
      onnx-assets.ts          # ONNX model asset resolution
      operator.ts             # Operator runtime helpers
      permit-runtime.ts       # Permit validation at runtime
      session-capability.ts   # Session capability runtime checks
      webauthn-bridge.ts      # WebAuthn credential bridge for passkeys
      # (config.ts is under runtime/ above)
    catalog/
      main.tsx                # Catalog entry point
      CatalogApp.tsx          # Design token catalog (colors, spacing, radii, typography)
      catalog.css             # Catalog-specific styles
    views/
      ErrorBoundary.tsx       # Shared error boundary component
      shared/
        dashboard-selectors.ts # Dashboard data selectors
        NotificationBanner.tsx  # Reusable notification banner
        useCaptureActions.ts    # Shared capture action hooks
        useCoopActions.ts       # Shared coop action hooks (create, join)
        useCoopTheme.ts         # Theme resolution (light/dark/system)
        useQuickDraftActions.ts # Quick note/draft actions
      Popup/
        main.tsx              # Popup React entry
        PopupApp.tsx           # Popup shell (~88 lines, thin orchestrator)
        PopupScreenRouter.tsx  # Screen routing (7 screens + no-coop)
        PopupShell.tsx         # Layout shell (header, content, footer, overlays)
        PopupHeader.tsx        # Header bar (back, brand, create/join, profile, theme, workspace)
        PopupFooterNav.tsx     # Bottom nav: Home, Chickens, Feed (with badges)
        PopupHomeScreen.tsx    # Home: capture actions, status, yard visualization
        PopupDraftListScreen.tsx  # Chickens list with filter tags
        PopupDraftDetailScreen.tsx # Draft edit/share detail view
        PopupFeedScreen.tsx    # Published artifact feed with filters
        PopupCreateCoopScreen.tsx # Inline coop creation form
        PopupJoinCoopScreen.tsx   # Inline coop join form
        PopupNoCoopScreen.tsx  # Empty state when no coop exists
        PopupProfilePanel.tsx  # Profile: auth, coops, sound, theme, agent cadence
        PopupOnboardingHero.tsx # Illustrated onboarding / empty-state heroes
        PopupArtifactDialog.tsx # Artifact detail overlay dialog
        PopupSubheader.tsx     # Filter tag bar for list screens
        PopupThemePicker.tsx   # Light/dark/system theme selector
        PopupBlockingNotice.tsx # Full-screen error/retry notice
        PopupChoiceGroup.tsx   # Reusable choice group component
        PopupTooltip.tsx       # Tooltip component
        ShareMenu.tsx          # Share/publish menu with coop target selection
        helpers.ts             # View helpers (formatting, filtering, mapping)
        popup-types.ts         # PopupScreen, PopupFooterTab, form state types
        popup.css              # Popup-specific styles
        hooks/
          usePopupOrchestration.ts   # Central popup state machine (~850 lines)
          usePopupDashboard.ts       # Dashboard polling and snapshot hydration
          usePopupNavigation.ts      # Screen navigation state machine
          usePersistedPopupState.ts  # Persisted popup preferences
          usePopupTheme.ts           # Theme preference management
          usePopupOverlayFocusTrap.ts # Focus trap for overlays
      Sidepanel/
        main.tsx              # Sidepanel React entry
        SidepanelApp.tsx       # Sidepanel shell (~174 lines, thin orchestrator)
        SidepanelTabRouter.tsx # Tab routing to Roost, Chickens, Coops, Nest
        TabStrip.tsx           # Bottom nav: Roost, Chickens, Coops, Nest (with badges)
        TabCoopSelector.tsx    # Coop switcher dropdown
        CoopSwitcher.tsx       # Coop switcher component
        OperatorConsole.tsx    # Operator/trusted-node console panel
        OnboardingOverlay.tsx  # First-run onboarding overlay
        ArchiveSetupWizard.tsx # Archive configuration wizard
        setup-insights.ts     # Four-lens form state for coop creation
        helpers.ts             # Sidepanel view helpers
        cards/
          CoopCard.tsx         # Coop summary card
          GreenGoodsActionCards.tsx # Green Goods action queue cards
        cards.tsx              # Shared card components
        hooks/
          useSidepanelOrchestration.ts # Central sidepanel state (~1160 lines)
          useDashboard.ts      # Dashboard polling and sync state
          useSyncBindings.ts   # Yjs sync binding lifecycle
          useCoopForm.ts       # Coop creation form state
          useDraftEditor.ts    # Draft editing state and actions
          useOnboarding.ts     # Onboarding flow state
          useTabCapture.ts     # Tab capture actions and state
        tabs/
          index.ts             # Barrel export for tab components
          RoostTab.tsx         # Review queue: action queue, member accounts, Green Goods
          ChickensTab.tsx      # Captured candidates with filtering and inference state
          CoopsTab.tsx         # Coop management, feed, archive, board link
          NestTab.tsx          # Admin tab: sub-tabs for members, agent, settings
          NestAgentSection.tsx # Agent cycle, plans, skill runs
          NestArchiveSection.tsx # Archive config, receipts, Storacha setup
          NestInviteSection.tsx # Invite code generation and management
          NestReceiverSection.tsx # Receiver pairing, QR, intake queue
          NestSettingsSection.tsx # Sound, theme, inference, data management
          FilterPopover.tsx    # Filter popover for list views
          chickens-filters.ts  # Filter logic for candidates
        operator-sections/
          index.ts             # Barrel export for operator sections
          helpers.ts           # Operator section helpers
          AgentMemorySection.tsx        # Agent cross-session memory viewer
          AgentObservationsSection.tsx   # Agent observation log
          GardenRequestsSection.tsx     # Green Goods garden requests
          KnowledgeSkillsSection.tsx    # Knowledge skill management
          PermitSection.tsx             # Execution permit management
          PolicyAndQueueSection.tsx     # Policy action queue
          SessionCapabilitySection.tsx  # Session capability management
          SkillManifestSection.tsx      # Skill manifest viewer
          TrustedNestControlsSection.tsx # Trusted-node controls
```

### Permissions

```json
["storage", "alarms", "tabs", "scripting", "sidePanel", "activeTab", "offscreen", "contextMenus", "notifications"]
```

Host permissions: `http://127.0.0.1/*`, `http://localhost/*`

Content script: `receiver-bridge.js` injected on `127.0.0.1` and `localhost` for receiver app communication.

Keyboard shortcuts: `Alt+Shift+Y` (open sidepanel), `Alt+Shift+U` (round up active tab), `Alt+Shift+S` (capture screenshot).

### Background Service Worker

`background.ts` (~740 lines) is the central orchestrator. It delegates to handler modules in `background/handlers/` for message processing and to `background/context.ts` for shared state management.

The background worker:

1. **Initializes** a `CoopDexie` database, loads auth session and sound preferences
2. **Manages coop state** in memory via Yjs documents (one per coop)
3. **Delegates runtime messages** to handler modules (`handlers/capture.ts`, `handlers/review.ts`, etc.)
4. **Runs passive capture** on alarm triggers and manual round-up
5. **Manages Yjs sync bindings** per coop (IndexedDB persistence + WebRTC providers)
6. **Manages receiver sync** for paired mobile devices (WebSocket relay connections)
7. **Controls extension icon state** (idle, watching, review-needed, error-offline)
8. **Handles archive operations** (Storacha upload with delegation flow)
9. **Plays sounds** via response metadata (views handle actual audio playback)

#### Handler Decomposition

Message handling is split across handler modules in `background/handlers/`:

| Module | Responsibilities |
|--------|-----------------|
| `capture.ts` | Tab capture, passive pipeline, screenshot, round-up |
| `review.ts` | Draft review, publish, mark-ready |
| `coop.ts` | Coop creation, join, profile updates, leave |
| `receiver.ts` | Receiver pairing, sync, intake ingestion |
| `agent.ts` | Agent cycle, plan approval/rejection, skill runs |
| `archive.ts` | Storacha upload, archive receipts |
| `session.ts` | Session capability issue/rotate/revoke |
| `permits.ts` | Execution permit issue/revoke/execute |
| `actions.ts` | Policy action propose/approve/reject/execute |
| `action-executors.ts` | Green Goods and delegated action execution |
| `member-account.ts` | Member onchain account provisioning |
| `heartbeat.ts` | Heartbeat / keep-alive |

#### Supporting Background Modules

| Module | Purpose |
|--------|---------|
| `context.ts` | Shared state (db, coop docs, settings, alarms, tab cache) |
| `dashboard.ts` | DashboardResponse assembly, popup snapshot, badge counts |
| `sidepanel.ts` | Sidepanel lifecycle management |
| `alarm-dispatch.ts` | Alarm event dispatch to appropriate handlers |
| `operator.ts` | Trusted-node / operator runtime logic |

Key state in the service worker:
- `coopDocs: Map<string, Y.Doc>` -- Live Yjs documents per coop
- `syncBindings: Map<string, SyncBinding>` -- WebRTC providers per coop
- `receiverRelayBindings` -- WebSocket relay connections for receiver sync
- `db: CoopDexie` -- Local database instance
- `authSession: AuthSession | null` -- Current passkey session
- `activeCoopId: string | undefined` -- Currently selected coop

### Runtime Message Bridge

All communication between views and background uses `chrome.runtime.sendMessage()`. The type system is a discriminated union:

```typescript
// In messages.ts
export type RuntimeRequest =
  | { type: 'get-dashboard' }
  | { type: 'create-coop'; payload: { ... } }
  | { type: 'manual-capture' }
  | { type: 'publish-draft'; payload: { draft, targetCoopIds } }
  | { type: 'join-coop'; payload: { inviteCode, displayName, ... } }
  // ... 40+ message types

export interface RuntimeActionResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  soundEvent?: SoundEvent;
}
```

The response includes an optional `soundEvent` that the view plays via audio file playback after receiving the response. Sounds are never played in the service worker.

### View Architecture

**Popup** (`PopupApp.tsx`, ~88 lines): A full multi-screen app with bottom navigation. The popup is a thin shell that delegates all state to `usePopupOrchestration`. Screens are routed via `PopupScreenRouter`.

| Screen | Purpose |
|--------|---------|
| `home` | Quick-capture actions (round-up, screenshot, paste, note), status items, yard visualization |
| `drafts` | Draft/chicken list with filter tags, round-up trigger, share actions |
| `draft-detail` | Edit draft title/summary, toggle ready, share to coops |
| `feed` | Published artifact feed with filter tags, artifact dialog |
| `create` | Inline coop creation form (name, creator, purpose, starter note) |
| `join` | Inline coop join form (invite code, display name, starter note) |
| `profile` | Auth identity, coop list, sound/theme/agent preferences |
| `no-coop` | Empty state with create/join prompts (shown when no coops exist) |

Footer nav tabs: **Home**, **Chickens** (drafts), **Feed** -- with badge counts.

**Sidepanel** (`SidepanelApp.tsx`, ~174 lines): The full Coop workspace. A thin shell that delegates state to `useSidepanelOrchestration`. Tabs are routed via `SidepanelTabRouter`.

| Tab | Icon | Purpose |
|-----|------|---------|
| Roost | Rooster head | Review queue: Green Goods action cards, member account provisioning |
| Chickens | Two eggs | Captured candidates with filter popover, inference state, draft editing |
| Coops | Barn | Coop management, published artifact feed, archive, board link, coop switching |
| Nest | Bird nest | Admin/settings: sub-tabs for members/invites, agent, receiver, archive, settings |

The Nest tab is conditionally visible (only shown to users with trusted-node access). It contains five sections: `NestAgentSection`, `NestArchiveSection`, `NestInviteSection`, `NestReceiverSection`, `NestSettingsSection`.

The sidepanel header includes actions for: pair device, toggle theme, open profile (via popup), close panel.

**Catalog** (`catalog/CatalogApp.tsx`): A standalone design token catalog surface showing colors, spacing, radii, and typography tokens. Built via `vite.catalog.config.ts` as a separate entry point.

### Operator Console

`OperatorConsole.tsx` provides a trusted-node operator panel with sections defined in `operator-sections/`:
- Agent memory and observations
- Knowledge skill management and skill manifest viewer
- Garden requests (Green Goods)
- Policy action queue
- Execution permits
- Session capabilities
- Trusted nest controls

### Service Worker Lifecycle

MV3 service workers are ephemeral. The background handles this by:
- Re-initializing state from Dexie on activation
- Using `chrome.alarms` for scheduled capture (not `setInterval`)
- Persisting coop state back to Dexie after mutations
- Reconnecting Yjs sync providers when the worker wakes

### Capture Flow

1. `chrome.alarms` or manual trigger fires
2. Background queries `chrome.tabs.query()` for all http/https tabs
3. For each tab, it calls `chrome.scripting.executeScript()` with `extractPageSnapshot()`
4. Results become `TabCandidate` records saved to Dexie
5. `runPassivePipeline()` processes candidates against all coops
6. Resulting `ReviewDraft` records are saved to Dexie
7. Extension icon updates to `review-needed` if drafts exist

### Agent Runtime

The extension hosts a local AI agent pipeline:
- `agent-harness.ts` orchestrates the agent execution loop
- `agent-runner.ts` runs skill pipelines with quality scoring
- `agent-registry.ts` discovers and loads registered skills
- `skill-markdown.ts` parses SKILL.md files for skill definitions
- `inference-worker.ts` runs inference via WebGPU/WASM in a WebWorker
- `agent-webllm-bridge.ts` bridges to WebLLM models
- Agent runs are triggered by alarm cadence or manual request

### Receiver Sync in Extension

The extension acts as the receiver sync consumer:
- `create-receiver-pairing` generates pairing payload + deep link
- `ingest-receiver-capture` validates HMAC-signed envelopes and saves captures
- Receiver sync uses WebSocket relay (not WebRTC) because the service worker lacks `RTCPeerConnection`
- An offscreen document (`receiver-sync-offscreen.ts`) handles WebRTC when needed

## Key Patterns

### All Logic in @coop/shared

The extension runtime is thin. All domain logic (coop creation, join, publish, archive, pipeline, review) lives in `@coop/shared`. The background worker orchestrates calls to shared functions and manages Chrome APIs.

```typescript
// Correct: import from shared, call in background
import { createCoop, saveCoopState, runPassivePipeline } from '@coop/shared';
```

### Message-First Architecture

Views never directly access Dexie or Yjs. Everything goes through runtime messages:

```typescript
// View sends message
const response = await sendRuntimeMessage({ type: 'create-coop', payload: { ... } });

// Background handles message, returns response
return { ok: true, data: state, soundEvent: 'coop-created' };
```

### Orchestration Hook Pattern

Both popup and sidepanel use a central orchestration hook that owns all state and actions:

```typescript
// Popup: usePopupOrchestration() -> PopupOrchestrationState
// Sidepanel: useSidepanelOrchestration() -> SidepanelOrchestration

// The app shell is a thin renderer:
function PopupApp() {
  const state = usePopupOrchestration();
  return <PopupShell><PopupScreenRouter state={state} /></PopupShell>;
}
```

Shared hooks (`useCaptureActions`, `useCoopActions`, `useQuickDraftActions`) are in `views/shared/` and used by both surfaces.

### Sound Events as Response Metadata

Sound events are returned as part of the runtime response, not triggered in background:

```typescript
// Background returns sound event
return { ok: true, soundEvent: 'coop-created' };

// View plays sound after receiving response
if (response.soundEvent) {
  await playCoopSound(response.soundEvent, soundPreferences);
}
```

Sounds are `.wav` files loaded from `public/audio/` (e.g., `coop-rooster-call.wav`, `coop-soft-cluck.wav`, `coop-squeaky-test.wav`). The `audio.ts` module maps `SoundEvent` types to file paths and volumes.

### Config Resolution

Environment variables are read via `import.meta.env.VITE_*` and resolved through `runtime/config.ts`:

- `VITE_COOP_CHAIN` -> `resolveConfiguredChain()` -> `'sepolia' | 'arbitrum'`
- `VITE_COOP_ONCHAIN_MODE` -> `resolveConfiguredOnchainMode()` -> `'mock' | 'live'`
- `VITE_COOP_ARCHIVE_MODE` -> `resolveConfiguredArchiveMode()` -> `'mock' | 'live'`
- `VITE_COOP_SIGNALING_URLS` -> `parseConfiguredSignalingUrls()` -> `string[] | undefined`
- `VITE_COOP_RECEIVER_APP_URL` -> `resolveReceiverAppUrl()` -> URL string
- `VITE_COOP_SESSION_MODE` -> `resolveConfiguredSessionMode()` -> `'mock' | 'live' | 'off'`
- `VITE_COOP_PROVIDER_MODE` -> `resolveConfiguredProviderMode()` -> `'standard' | 'kohaku'`
- `VITE_COOP_PRIVACY_MODE` -> `resolveConfiguredPrivacyMode()` -> `'off' | 'on'`
- `VITE_COOP_LOCAL_ENHANCEMENT` -> `isLocalEnhancementEnabled()` -> boolean
- `VITE_COOP_FVM_CHAIN` -> `resolveConfiguredFvmChain()` -> `'filecoin' | 'filecoin-calibration'`
- `VITE_COOP_ARCHIVE_GATEWAY_URL` -> `resolveArchiveGatewayUrl()` -> URL string
- Trusted-node archive config: `VITE_COOP_TRUSTED_NODE_ARCHIVE_*` (8 env vars)

### Dashboard Response

The `get-dashboard` message returns a comprehensive snapshot:

```typescript
interface DashboardResponse {
  coops: CoopSharedState[];
  activeCoopId?: string;
  drafts: ReviewDraft[];
  candidates: TabCandidate[];
  summary: RuntimeSummary;
  soundPreferences: SoundPreferences;
  uiPreferences: UiPreferences;
  authSession?: AuthSession | null;
  identities: LocalPasskeyIdentity[];
  receiverPairings: ReceiverPairingRecord[];
  receiverIntake: ReceiverCapture[];
  operator: OperatorDashboard;
  // ... additional fields for archive, permits, sessions, etc.
}
```

## Anti-Patterns

- **Never access Dexie directly from views**. Always go through runtime messages to the background.
- **Never play sounds in the service worker**. Return `soundEvent` and let the view handle audio.
- **Never use `setInterval` in the background**. Use `chrome.alarms` for scheduled work.
- **Never define domain logic in the extension**. Put it in `@coop/shared`.
- **Never assume the service worker is alive**. It may restart at any time; re-initialize from Dexie.
- **Never use `window` in the background**. It does not exist in a service worker context.
- **Never skip HMAC validation** on receiver sync envelopes.
- **Never put state management in the app shell**. Use orchestration hooks (`usePopupOrchestration`, `useSidepanelOrchestration`).

## Key Files

- `background.ts` -- Service worker orchestrator (delegates to handler modules)
- `background/context.ts` -- Shared state (db, coop docs, settings, alarms)
- `background/dashboard.ts` -- DashboardResponse assembly and popup snapshot
- `background/handlers/*.ts` -- Message handler modules (12 handler files)
- `runtime/messages.ts` -- RuntimeRequest type union, sendRuntimeMessage helper, DashboardResponse
- `runtime/config.ts` -- Environment variable resolution
- `runtime/tab-capture.ts` -- DOM snapshot extraction (headings, paragraphs, meta)
- `runtime/audio.ts` -- Sound file playback (.wav from public/audio/)
- `runtime/agent-harness.ts` -- Agent execution orchestration
- `runtime/agent-registry.ts` -- Skill discovery and registration
- `runtime/inference-worker.ts` -- Local inference WebWorker
- `runtime/skill-markdown.ts` -- SKILL.md file parsing
- `runtime/receiver.ts` -- Receiver visibility filtering, member context resolution
- `views/Popup/PopupApp.tsx` -- Popup shell (thin, ~88 lines)
- `views/Popup/PopupScreenRouter.tsx` -- Popup screen routing (8 screens)
- `views/Popup/hooks/usePopupOrchestration.ts` -- Central popup state machine
- `views/Sidepanel/SidepanelApp.tsx` -- Sidepanel shell (thin, ~174 lines)
- `views/Sidepanel/SidepanelTabRouter.tsx` -- Sidepanel tab routing (4 tabs)
- `views/Sidepanel/hooks/useSidepanelOrchestration.ts` -- Central sidepanel state
- `views/Sidepanel/tabs/NestTab.tsx` -- Nest admin tab (agent, archive, invite, receiver, settings)
- `views/Sidepanel/operator-sections/` -- Operator console section components (10 sections)
- `views/shared/useCoopTheme.ts` -- Theme resolution shared across surfaces
- `catalog/CatalogApp.tsx` -- Design token catalog surface
- `public/manifest.json` -- MV3 manifest with permissions
