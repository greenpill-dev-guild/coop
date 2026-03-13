# App Package Context

The `@coop/app` package serves two purposes: (1) the public landing page for Coop and (2) the receiver PWA shell for mobile device pairing and the desktop review board.

## Architecture

### Structure

```
packages/app/src/
  main.tsx              # Vite entry point, mounts <App />
  app.tsx               # Root router (~800 lines): landing, pair, receiver, inbox, board
  pairing-handoff.ts    # URL payload extraction for /pair route
  board-handoff.ts      # URL payload extraction for /board/:coopId route
  views/
    Landing/index.tsx   # Static landing page with ritual guide
    Board/index.tsx     # React Flow board visualization
```

### Route Structure

Routes are path-based, resolved from `window.location`:

| Path | Component | Purpose |
|------|-----------|---------|
| `/` | Landing | Product story, setup ritual guide |
| `/pair` | Receiver pairing | Accept pairing via URL payload |
| `/pair` (after pairing) | Receiver capture | Audio/photo/file capture UI |
| `/inbox` | Receiver inbox | Local capture list |
| `/board/:coopId` | Board | React Flow visualization of coop state |

### Landing Page

`views/Landing/index.tsx` is a static, informational page. No API calls, no state management. It presents:

1. **Hero** with product headline and CTA
2. **Problem section** (fragmented knowledge)
3. **How it works** (4-step timeline)
4. **Setup ritual** (four-lens card grid with prompt copy)
5. **Privacy model** (local-only vs shared-after-approval)
6. **Extension states** (idle, watching, review-needed, error/offline)
7. **Weekly review** preview
8. **Footer CTA**

Key design elements:
- CSS classes follow the design direction: `nest-card`, `lens-card`, `state-pill`, `board-chip`
- Brand imagery: `coop-wordmark-flat.png`, `coop-mark-glow.png`
- Ritual prompt is copyable to clipboard for use with external AI (GPT/Gemini)
- Sound is OFF by default on the landing page

### Receiver PWA Shell

The `app.tsx` root component handles the receiver flow for mobile device pairing:

1. **Pairing**: User scans QR code / taps deep link containing encoded pairing payload
2. `bootstrapReceiverPairingHandoff()` extracts payload from URL hash/search params
3. Payload is decoded via `parseReceiverPairingInput()` (validates, checks expiry, verifies room ID)
4. Pairing record is saved to a dedicated Dexie instance (`coop-receiver`)
5. **Capture**: User can record audio, take photos, or upload files
6. Captures are saved locally with metadata (title, note, device identity)
7. **Sync**: Captures are synced to the extension via WebSocket relay or Yjs WebRTC
8. Sync uses HMAC-SHA256 signed envelopes for authentication

The receiver uses its own database (`coop-receiver`, separate from the extension's `coop-v1`) to avoid cross-context IndexedDB conflicts.

### Board View

`views/Board/index.tsx` renders a read-only React Flow graph:

- Receives a `CoopBoardSnapshot` via URL hash payload (base64url encoded)
- Uses `buildCoopBoardGraph()` from shared to generate nodes and edges
- Six node lanes: member -> capture -> draft -> coop -> artifact -> archive
- Edge types: captured-by, draft-seeded-from-capture, routed-to-coop, published-to-coop, archived-in
- Sidebar shows archive story (Storacha/Filecoin trail) and receipt details
- Summary row shows counts: members, captures, drafts, artifacts, archive-worthy

The board URL is sanitized after loading (snapshot removed from hash) so the URL is shareable without leaking state.

### Handoff Pattern

Both the pairing and board routes use a "handoff" pattern:

1. Extension generates a URL with an encoded payload in the hash
2. App extracts the payload on mount
3. App immediately strips the payload from the URL via `history.replaceState()`
4. The decoded data is used to initialize the view

```typescript
// pairing-handoff.ts
export function bootstrapReceiverPairingHandoff(targetWindow: Window) {
  // Extract payload from hash or search params
  // Strip payload from URL
  // Return raw payload string or null
}

// board-handoff.ts
export function bootstrapCoopBoardHandoff(targetWindow: Window): CoopBoardSnapshot | null {
  // Extract coopId from pathname
  // Extract snapshot from hash or search params
  // Strip snapshot from URL
  // Decode and validate snapshot
}
```

## Key Patterns

### All Logic in @coop/shared

The app imports all domain logic from shared:

```typescript
import {
  createCoopDb,
  parseReceiverPairingInput,
  buildCoopBoardGraph,
  connectReceiverSyncRelay,
  createReceiverSyncEnvelope,
} from '@coop/shared';
```

The app contains no business logic of its own. It only has view components, routing, and handoff utilities.

### Separate Dexie Instance

The receiver uses `createCoopDb('coop-receiver')` to get a separate IndexedDB from the extension's `coop-v1`. This avoids write conflicts when both contexts are active.

### Receiver Sync Transport

The app connects to the signaling server for capture sync:
- `connectReceiverSyncRelay()` establishes WebSocket connections
- `connectReceiverSyncProviders()` sets up Yjs IndexedDB + WebRTC providers
- Captures are sent as `ReceiverSyncEnvelope` frames via the relay
- The extension acknowledges with signed ack frames
- Failed syncs use exponential backoff retry (`shouldAutoRetryReceiverCapture`)

### CSS Architecture

The app uses plain CSS with class-based styling. Key class naming:
- `page-shell`, `board-shell` — Page-level containers
- `nest-card` — Rounded cards (brand motif)
- `lens-card` — Four-lens ritual cards
- `state-pill`, `board-chip` — Badge/tag elements
- `coop-board-node` — React Flow node styling
- Brand colors via CSS: cream, brown, green, orange, mist

## Anti-Patterns

- **Never store extension state in the app's Dexie**. The receiver has its own `coop-receiver` database.
- **Never leave payload data in URLs** after extraction. Always strip via `history.replaceState()`.
- **Never assume the extension is installed**. The landing page works standalone. The receiver needs a pairing payload.
- **Never add routing libraries**. Routes are path-based with manual resolution. Keep it simple.
- **Never add state management libraries**. The app uses React `useState`/`useEffect` directly.
- **Never define domain logic in the app**. Import from `@coop/shared`.
- **Never import from `@coop/shared` deep paths**. Use the barrel export.

## Key Files

- `app.tsx` — Root component with routing, receiver flows, sync management
- `views/Landing/index.tsx` — Static landing page
- `views/Board/index.tsx` — React Flow board visualization
- `pairing-handoff.ts` — URL payload extraction for /pair
- `board-handoff.ts` — URL payload extraction for /board/:coopId
- `main.tsx` — Vite entry point
