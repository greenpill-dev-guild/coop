---
title: "ERC-8004 & API Server"
sidebar_label: "Agent Registry & API"
sidebar_position: 7
---

# ERC-8004 Agent Registry & API Server

Coop uses two infrastructure components that sit outside the browser but serve the local-first architecture: an on-chain agent identity and reputation system (ERC-8004) and a minimal WebSocket signaling relay (the API server). Neither stores user data. The registry provides verifiable agent identity; the relay enables peer discovery so that Yjs CRDT sync can establish direct WebRTC connections.

---

## 1. ERC-8004 Agent Registry

### 1.1 Purpose

ERC-8004 defines a standard for on-chain agent identity and reputation. Each coop can register as an agent on an Ethereum-compatible chain, receive a persistent `agentId`, and accumulate reputation feedback from verifiable operations (archive anchoring, peer sync). The registry provides:

- **Discoverability**: Other agents and protocols can look up a coop's capabilities, operator Safe address, and active skills.
- **Reputation**: Feedback entries (positive or negative) build a public, on-chain reputation score tied to the agent's identity.
- **Interoperability**: The manifest format follows the ERC-8004 registration-v1 specification, making coops legible to any ERC-8004-aware system.

### 1.2 Contracts

ERC-8004 deploys two contracts per chain:

| Contract | Arbitrum | Sepolia |
|----------|----------|---------|
| Identity Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Reputation Registry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

Chain selection follows the global `VITE_COOP_CHAIN` env var (`arbitrum` for production, `sepolia` for test/dev). The `getErc8004Deployment(chainKey)` function resolves the correct addresses.

### 1.3 Identity Registration

A coop registers as an agent by calling `register(agentURI, metadata[])` on the Identity Registry. The function:

1. Accepts an `agentURI` (a `data:application/json;base64,...` URI encoding the agent manifest) and an array of `{key, value}` metadata pairs.
2. Emits a `Registered(agentId, owner, agentURI)` event.
3. Returns the assigned `agentId` (a positive integer, unique per registry).

The transaction is executed through the coop's Safe multisig via the `Erc8004LiveExecutor` callback, which encodes the call data and submits it as a Safe user operation (ERC-4337).

```
registerAgentIdentity({
  mode, onchainState, agentURI, metadata, coopId,
  pimlicoApiKey?, liveExecutor?
}) → { agentId, txHash, detail }
```

After registration, the `agentId` is stored in the coop's `agentIdentity` state (the `erc8004AgentStateSchema` field on `CoopSharedState`).

### 1.4 Agent Manifest

The `agentURI` encodes a JSON manifest following the ERC-8004 registration-v1 format. `buildAgentManifest()` constructs it from coop state:

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "Coop: Watershed Coop",
  "description": "Coordinate watershed regeneration.",
  "services": [{ "name": "web", "endpoint": "https://coop.regen.earth" }],
  "active": true,
  "registrations": [{
    "agentId": 123,
    "agentRegistry": "eip155:42161:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
  }],
  "supportedTrust": ["reputation"],
  "capabilities": ["tab-capture", "content-extraction", "archive-anchor", "peer-sync"],
  "skills": ["opportunity-extractor", "grant-fit-scorer", "..."],
  "operator": { "safeAddress": "0x...", "chainId": 42161 },
  "guardrails": {
    "approvalRequired": true,
    "maxCycleActions": 8,
    "autoRunSkills": ["erc8004-register", "erc8004-feedback"]
  }
}
```

The manifest is encoded as a base64 `data:` URI via `encodeAgentManifestURI()`, avoiding any IPFS dependency for registration. The `registrations` array uses CAIP-10 format (`eip155:<chainId>:<contractAddress>`) to identify the registry contract.

### 1.5 URI Updates

When coop metadata changes (name, purpose, skills), the agent URI can be updated on-chain via `updateAgentURI()`, which calls `setAgentURI(agentId, newURI)` on the Identity Registry.

### 1.6 Reputation Feedback

The Reputation Registry tracks feedback entries per agent. Each entry contains:

| Field | Type | Description |
|-------|------|-------------|
| `fromAgentId` | `uint256` | The agent submitting feedback |
| `value` | `int8` | Score from -128 to 127 (typically +1 for success, -1 for failure) |
| `tag1` | `string` | Primary tag (e.g., `archive-anchor`, `peer-sync`) |
| `tag2` | `string` | Secondary tag (e.g., `content-quality`, `data-integrity`) |
| `comment` | `string` | Human-readable rationale |
| `timestamp` | `uint256` | Block timestamp |

Two feedback modes exist:

- **Self-attestation**: After a successful archive anchor, the agent submits positive feedback for its own `agentId` with tags `archive-anchor` + `content-quality`.
- **Peer-attestation**: After a successful peer sync, the agent submits positive feedback for the peer's `agentId` with tags `peer-sync` + `data-integrity`.

Read operations:
- `readAgentReputation(agentId)` returns `{ score, feedbackCount }` via `getSummary()`.
- `readAgentFeedbackHistory(agentId)` returns all individual feedback entries via `readAllFeedback()`.

### 1.7 Mock vs. Live Modes

All ERC-8004 functions accept a `mode` parameter (`'mock'` or `'live'`), controlled by the `VITE_COOP_ONCHAIN_MODE` env var:

| Mode | Behavior |
|------|----------|
| `mock` | Returns deterministic IDs and hashes derived from input data. No chain interaction. Feedback reads return zero/empty. |
| `live` | Encodes ABI call data, executes via the Safe executor, waits for transaction receipt, parses events. |

Mock mode uses `hashJson()` with a typed seed to produce stable, reproducible transaction hashes and agent IDs. This allows the full agent lifecycle to run without network access or gas.

### 1.8 Agent State Schema

The `erc8004AgentStateSchema` (Zod) tracks registration state per coop:

```typescript
{
  enabled: boolean,           // default false
  agentId?: number,           // assigned on registration
  agentURI?: string,          // current data: URI
  agentURICid?: string,       // optional IPFS CID if pinned
  registrationTxHash?: string,
  status: 'disabled' | 'pending' | 'registered' | 'error',
  statusNote?: string,
  feedbackCount: number,      // default 0
}
```

This is stored as the optional `agentIdentity` field on `CoopSharedState` and synced across peers via Yjs.

### 1.9 Agent Log Export

`buildAgentLogExport()` transforms the `AgentLog[]` stored in Dexie into a DevSpot-compatible `agent_log.json` format, tagged with the coop's `agentId` and name. This enables external tooling to audit agent behavior.

### 1.10 Integration with the Agent Skill System

Two skills in the agent harness drive ERC-8004 operations:

**`erc8004-register`** (auto-run-eligible, heuristic model):
- Trigger: `erc8004-registration-due` -- fires when no valid registration exists or coop metadata has changed.
- Reads coop context (name, purpose, skills, Safe address, chain ID).
- Builds the agent manifest, encodes it as a data URI, and returns `{ agentURI, metadata[], rationale }`.
- The action executor calls `registerAgentIdentity()` with the skill output.
- Provides: `agent-identity`.

**`erc8004-feedback`** (auto-run-eligible, heuristic model):
- Trigger: `erc8004-feedback-due` -- fires after a successful archive anchor or peer sync.
- Determines the target agent ID and selects tags based on the event type.
- Returns `{ targetAgentId, value, tag1, tag2, rationale }`.
- The action executor calls `giveAgentFeedback()` with the skill output.
- Provides: `agent-feedback`.

Both skills use `approvalMode: "auto-run-eligible"`, meaning they execute automatically when the user has opted in to auto-run for these skill IDs. Neither skill has dependencies on other skills in the DAG.

---

## 2. API Server (Signaling Relay)

### 2.1 Purpose

The API server is a WebSocket signaling relay that enables browser extension instances to discover each other and establish peer-to-peer WebRTC connections. It does not store, process, or inspect user data. Once two peers have exchanged signaling messages and established a direct WebRTC connection, the relay is no longer involved in their communication.

### 2.2 Technology

| Layer | Choice |
|-------|--------|
| Runtime | Bun |
| Framework | Hono |
| WebSocket | Bun native (`createBunWebSocket` via `hono/bun`) |
| Deployment | Fly.io (`iad` primary region) |
| Container | `oven/bun:1-alpine` |

The server is intentionally minimal. The `@coop/api` package has a single runtime dependency (`hono`). The `package.json` declares no other production dependencies.

### 2.3 Deployment

Production URL: `wss://signal.coop.town`

The Fly.io configuration (`fly.toml`):
- App name: `coop`
- Internal port: `8080`
- HTTPS enforced, TLS termination at the edge
- Auto-suspend on idle, auto-start on traffic, minimum 1 machine running
- Concurrency: soft limit 2,000 connections, hard limit 2,500
- Resources: shared CPU, 256MB RAM

### 2.4 Routes

| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| GET | `/` | WebSocket upgrade | Primary signaling endpoint |
| GET | `/` | `c.text('okay')` | Fallback when no `Upgrade` header (monitoring probes) |
| GET | `/health` | `c.json({ status: 'ok' })` | Health check |

The WebSocket upgrade handler is mounted before the HTTP fallback, so requests with an `Upgrade: websocket` header are handled by the WebSocket path, while plain HTTP GETs fall through to the text response.

### 2.5 WebSocket Protocol

The server implements a topic-based publish/subscribe protocol. All messages are JSON objects with a `type` field.

**Client-to-server messages:**

| Type | Fields | Behavior |
|------|--------|----------|
| `subscribe` | `topics: string[]` | Subscribe the connection to one or more named topics |
| `unsubscribe` | `topics: string[]` | Remove the connection from the specified topics |
| `publish` | `topic: string`, `...payload` | Broadcast the message to all subscribers of the topic |
| `ping` | (none) | Server responds with `{ type: 'pong' }` |

**Server-to-client messages:**

Published messages are forwarded to all subscribers of the topic with the original payload plus a `clients` field indicating the current subscriber count for that topic.

**Connection lifecycle:**

1. Client connects via WebSocket upgrade on `/`.
2. Client subscribes to one or more topic names (typically a sync room ID).
3. Other clients publish signaling data (SDP offers/answers, ICE candidates) to the same topic.
4. All subscribers receive the published messages.
5. On disconnect (close or error), the server removes the connection from all subscribed topics.

### 2.6 TopicRegistry

The `TopicRegistry` class manages the topic-to-subscriber mapping:

```
TopicRegistry
  topics: Map<string, Map<stableKey, WSContext>>

  subscribe(ws, topicName)
  unsubscribe(ws, topicName)
  getSubscribers(topicName) → Iterable<WSContext>
  getSubscriberCount(topicName) → number
  removeAll(ws, subscribedTopics)
```

A stable identity key is derived from `ws.raw` (the underlying Bun `ServerWebSocket`) because Hono's Bun adapter creates a fresh `WSContext` wrapper for each event callback. Empty topics are automatically garbage-collected when the last subscriber leaves.

### 2.7 Connection Handling

- **Idle timeout**: 30 seconds (Bun WebSocket-level pong). Connections that miss a pong are closed.
- **Max payload**: 64KB per message.
- **Malformed JSON**: Logged and dropped silently. The connection remains open.
- **Messages without `type`**: Silently ignored.
- **Non-string topic names**: Skipped during subscribe/unsubscribe (valid string topics in the same message are still processed).
- **Publish to empty topic**: No-op, no error.
- **Late messages on closing connections**: Rejected via a `closedConnections` set that tracks connections in the process of closing.

### 2.8 How It Supports y-webrtc Signaling

The protocol is compatible with [y-webrtc](https://github.com/yjs/y-webrtc)'s signaling requirements. When a coop sync room is created (`createSyncRoomConfig()`), it generates:

1. A deterministic `roomId` derived from the coop ID and a room secret.
2. Signaling URLs (defaults to `['wss://signal.coop.town']`).

The `WebrtcProvider` from y-webrtc connects to the signaling URL, subscribes to the room topic, and exchanges WebRTC signaling data (SDP offers, answers, ICE candidates) through the relay. Once the WebRTC data channel is established, all Yjs document updates flow directly between peers without touching the server.

### 2.9 ICE Server Configuration

The `@coop/api` package exports ICE configuration used by the WebRTC provider:

**Default STUN servers** (no authentication required):
- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`

**Optional TURN support**: `buildIceServers()` accepts optional TURN credentials (URLs, username, credential) and merges them with the STUN defaults. TURN is needed when peers are behind symmetric NATs that prevent direct STUN-based connections.

### 2.10 Configuration Exports

The `@coop/api` package exports its config module (not the server) to other packages via `"exports": { ".": "./config.ts" }`. This provides:

- `defaultSignalingUrls` -- `['wss://signal.coop.town']`
- `defaultIceServers` -- Google STUN servers
- `parseSignalingUrls(raw?)` -- Parse comma-separated URL strings
- `filterUsableSignalingUrls(urls)` -- Validate URL protocols (ws, wss, http, https)
- `buildIceServers(turn?)` -- Merge STUN defaults with optional TURN config

These are re-exported by the shared sync module (`@coop/shared`) for use by the extension and app.

### 2.11 Why It Is Minimal

The server is deliberately thin. Coop's local-first architecture means:

- **No user data passes through the server.** The relay sees topic names and opaque signaling payloads. Yjs document content is encrypted end-to-end via WebRTC.
- **No authentication.** Topic names are derived from secrets shared during coop creation/invitation. Only peers who know the room secret can subscribe to the correct topic.
- **No persistence.** The server holds no state beyond the in-memory `TopicRegistry`. If the server restarts, clients reconnect and re-subscribe.
- **No business logic.** All knowledge processing, agent execution, and data storage happen in the browser.

---

## 3. Integration

### 3.1 P2P Sync Between Extension Instances

The full path from coop creation to peer sync:

1. A coop is created with `createSyncRoomConfig()`, which generates a `roomId` and stores the signaling URLs (default: `wss://signal.coop.town`).
2. The extension's `WebrtcProvider` connects to the signaling server and subscribes to the `roomId` topic.
3. When a second peer joins (via invite code containing the room secret), it derives the same `roomId`, connects to the same signaling server, and subscribes to the same topic.
4. The signaling server relays WebRTC offers/answers/ICE candidates between the two peers.
5. A direct WebRTC data channel is established. Yjs document updates flow peer-to-peer.
6. The signaling server plays no further role until a new peer joins or an existing peer reconnects.

### 3.2 ERC-8004 in the Agent Lifecycle

```
Coop Created
  │
  ├─ Safe deployed (onchain module)
  │
  ├─ Agent harness starts (observation polling)
  │     │
  │     ├─ Trigger: erc8004-registration-due
  │     │     │
  │     │     └─ erc8004-register skill runs
  │     │           │
  │     │           ├─ buildAgentManifest() → manifest
  │     │           ├─ encodeAgentManifestURI() → data: URI
  │     │           └─ registerAgentIdentity() → agentId stored
  │     │
  │     ├─ Trigger: erc8004-feedback-due (after archive anchor)
  │     │     │
  │     │     └─ erc8004-feedback skill runs
  │     │           │
  │     │           └─ giveAgentFeedback() → tx submitted
  │     │
  │     └─ Ongoing: readAgentReputation() for display
  │
  └─ Agent identity synced to peers via Yjs (agentIdentity field)
```

### 3.3 Environment Configuration

All configuration is in the root `.env.local`:

| Variable | Relevance |
|----------|-----------|
| `VITE_COOP_CHAIN` | Selects contract addresses (`arbitrum` or `sepolia`) |
| `VITE_COOP_ONCHAIN_MODE` | Controls mock vs. live for ERC-8004 operations |
| `VITE_PIMLICO_API_KEY` | Required for live Safe/4337 transaction execution |

The signaling URL is not configured via env var. It defaults to `wss://signal.coop.town` and can be overridden per sync room at creation time or via a comma-separated string parsed by `parseSignalingUrls()`.

---

## 4. Key Files

| File | Role |
|------|------|
| `shared/src/modules/erc8004/erc8004.ts` | All ERC-8004 functions: register, update URI, feedback, reputation reads, manifest builder, log export |
| `shared/src/modules/erc8004/index.ts` | Barrel exports |
| `shared/src/modules/erc8004/__tests__/erc8004.test.ts` | Unit tests for mock mode, manifest building, schema validation |
| `shared/src/contracts/schema.ts` | Zod schemas: `erc8004AgentStateSchema`, `erc8004RegistrationOutputSchema`, `erc8004FeedbackOutputSchema` |
| `api/src/index.ts` | Server entry point (Bun.serve with WebSocket config) |
| `api/src/app.ts` | Hono app factory (middleware + routes + WebSocket) |
| `api/src/ws/topics.ts` | `TopicRegistry` class (topic-to-subscriber mapping) |
| `api/src/ws/handler.ts` | WebSocket message handler (subscribe, unsubscribe, publish, ping) |
| `api/src/ws/types.ts` | Message type definitions |
| `api/src/ws/index.ts` | WebSocket mount (upgrade handler on `/`) |
| `api/src/routes/health.ts` | Health check endpoint |
| `api/src/lib/env.ts` | PORT/HOST env loading |
| `api/config.ts` | Signaling URLs, ICE servers, URL parsing (exported to other packages) |
| `api/fly.toml` | Fly.io deployment config |
| `api/Dockerfile` | Container image (`oven/bun:1-alpine`) |
| `api/__tests__/server.test.ts` | Integration tests: HTTP endpoints, pub/sub, edge cases |
| `extension/src/skills/erc8004-register/skill.json` | Skill manifest for agent registration |
| `extension/src/skills/erc8004-register/SKILL.md` | Skill instructions for registration |
| `extension/src/skills/erc8004-feedback/skill.json` | Skill manifest for reputation feedback |
| `extension/src/skills/erc8004-feedback/SKILL.md` | Skill instructions for feedback |
| `shared/src/modules/coop/sync.ts` | Sync room creation, imports signaling defaults from `@coop/api` |
