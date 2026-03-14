---
paths:
  - "packages/shared/src/modules/storage/**"
  - "packages/shared/src/modules/coop/sync.ts"
  - "packages/shared/src/modules/receiver/**"
---

# Sync & Storage Rules

- Dexie (`CoopDexie`) is the local database. Currently at schema version 4.
- Yjs CRDT doc shape: `CoopSharedState` stored in `Y.Map<string>` under key `"coop"`, each field JSON-serialized.
- Use `writeCoopState()` / `readCoopState()` / `updateCoopState(doc, updater)` for Yjs mutations. Never manipulate Y.Doc directly.
- Sync rooms are deterministic: `deriveSyncRoomId(coopId, roomSecret)`. Bootstrap rooms use `bootstrap:` prefix.
- Sync providers: `IndexeddbPersistence` for local + `WebrtcProvider` for live sync via `connectSyncProviders()`.
- Receiver sync uses WebSocket relay (not WebRTC) because service workers lack `RTCPeerConnection`.
- Relay frames MUST be HMAC-SHA256 signed with the pair secret.
- Failed receiver syncs use exponential backoff retry.
