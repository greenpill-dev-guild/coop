# Extension Package Context

The extension is the primary product surface for Coop. It is a Chrome MV3 browser extension with a background service worker, popup, sidepanel, and offscreen document.

## Architecture

### MV3 Manifest Surfaces

```
packages/extension/
  public/
    manifest.json           # MV3 manifest (permissions, service worker, sidepanel)
    popup.html              # Action popup entry
    sidepanel.html          # Side panel entry
    receiver-bridge.js      # Content script injected on localhost
  src/
    background.ts           # Service worker (~800 lines, the orchestrator)
    runtime/
      messages.ts           # RuntimeRequest union type + sendRuntimeMessage()
      config.ts             # Env var resolution (chain, mode, signaling URLs)
      tab-capture.ts        # DOM snapshot extraction (headings, paragraphs, og:image)
      audio.ts              # Web Audio API sound synthesis
      receiver.ts           # Receiver pairing/capture visibility filtering
      receiver-sync-offscreen.ts  # Offscreen document for WebRTC in SW context
      review.ts             # Review context resolution helpers
    views/
      Popup/
        main.tsx            # Popup React entry
        popup-app.tsx       # Compact launcher (open sidepanel, manual round-up)
      Sidepanel/
        main.tsx            # Sidepanel React entry
        sidepanel-app.tsx   # Full app (~1500 lines, all tabs and state)
        setup-insights.ts   # Four-lens form state for coop creation
```

### Permissions

```json
["storage", "alarms", "tabs", "scripting", "sidePanel", "activeTab", "offscreen"]
```

Host permissions: `http://*/*`, `https://*/*`, `ws://*/*`, `wss://*/*`

Content script: `receiver-bridge.js` injected on `127.0.0.1` and `localhost` for receiver app communication.

### Background Service Worker

`background.ts` is the central orchestrator. It:

1. **Initializes** a `CoopDexie` database, loads auth session and sound preferences
2. **Manages coop state** in memory via Yjs documents (one per coop)
3. **Handles all runtime messages** via `chrome.runtime.onMessage` (30+ message types)
4. **Runs passive capture** on alarm triggers and manual round-up
5. **Manages Yjs sync bindings** per coop (IndexedDB persistence + WebRTC providers)
6. **Manages receiver sync** for paired mobile devices (WebSocket relay connections)
7. **Controls extension icon state** (idle, watching, review-needed, error-offline)
8. **Handles archive operations** (Storacha upload with delegation flow)
9. **Plays sounds** for success events (coop-created, artifact-published)

Key state in the service worker:
- `coopDocs: Map<string, Y.Doc>` — Live Yjs documents per coop
- `syncBindings: Map<string, SyncBinding>` — WebRTC providers per coop
- `receiverRelayBindings` — WebSocket relay connections for receiver sync
- `db: CoopDexie` — Local database instance
- `authSession: AuthSession | null` — Current passkey session
- `activeCoopId: string | undefined` — Currently selected coop

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
  // ... 30+ message types

export interface RuntimeActionResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  soundEvent?: SoundEvent;
}
```

The response includes an optional `soundEvent` that the view plays via Web Audio API after receiving the response. Sounds are never played in the service worker.

### View Architecture

**Popup** (`popup-app.tsx`): Minimal launcher. Shows icon state, pending draft count, sync state. Two buttons: "Open sidepanel" and "Manual round-up". Fetches dashboard on mount via `get-dashboard` message.

**Sidepanel** (`sidepanel-app.tsx`): The full Coop UI. Uses a tab-based layout:

| Tab | Purpose |
|-----|---------|
| Loose Chickens | Tab candidates from passive capture |
| Roost | Review drafts with edit/publish/archive actions |
| Coops | Coop management, creation, invites |
| Feed | Published artifacts grouped by category/member |
| Meeting Mode | Private intake, candidate drafts, ready drafts for weekly review |
| Settings | Auth, sound preferences, sync health, receiver config |

The sidepanel maintains its own Yjs sync binding to observe live state changes from the background worker. It reads from the background via `get-dashboard` and writes via specific runtime messages.

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

### Config Resolution

Environment variables are read via `import.meta.env.VITE_*` and resolved through `runtime/config.ts`:

- `VITE_COOP_CHAIN` -> `resolveConfiguredChain()` -> `'sepolia' | 'arbitrum'`
- `VITE_COOP_ONCHAIN_MODE` -> `resolveConfiguredOnchainMode()` -> `'mock' | 'live'`
- `VITE_COOP_ARCHIVE_MODE` -> `resolveConfiguredArchiveMode()` -> `'mock' | 'live'`
- `VITE_SIGNALING_URLS` -> `parseConfiguredSignalingUrls()` -> `string[] | undefined`
- `VITE_RECEIVER_APP_URL` -> `resolveReceiverAppUrl()` -> URL string

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
  authSession?: AuthSession | null;
  identities: LocalPasskeyIdentity[];
  receiverPairings: ReceiverPairingRecord[];
  receiverIntake: ReceiverCapture[];
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

## Key Files

- `background.ts` — Service worker orchestrator (all message handlers, sync management)
- `runtime/messages.ts` — RuntimeRequest type union, sendRuntimeMessage helper, DashboardResponse
- `runtime/config.ts` — Environment variable resolution
- `runtime/tab-capture.ts` — DOM snapshot extraction (headings, paragraphs, meta)
- `runtime/audio.ts` — Web Audio API sound synthesis
- `runtime/receiver.ts` — Receiver visibility filtering, member context resolution
- `views/Popup/popup-app.tsx` — Compact launcher popup
- `views/Sidepanel/sidepanel-app.tsx` — Full sidepanel app (tabs, sync, all flows)
- `views/Sidepanel/setup-insights.ts` — Four-lens form state and SetupInsights conversion
- `public/manifest.json` — MV3 manifest with permissions
