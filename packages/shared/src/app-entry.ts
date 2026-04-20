/**
 * Curated public surface for `@coop/shared/app`.
 *
 * This entry point exposes the subset of `@coop/shared` that the companion
 * PWA (landing page + receiver) actually needs. It is deliberately narrow:
 *
 * **Included** — browser-compatible, app-relevant modules:
 *   - Schema contracts (types, Zod validators, enums)
 *   - App-shell helpers (theme, navigation, layout utilities)
 *   - Image compression and thumbnail generation (blob utilities)
 *   - Receiver pairing, sync, and capture relay
 *   - Local persistence layer (Dexie + Yjs storage)
 *   - Coop board state (read-only view for the receiver)
 *   - Coop setup insights and ritual-lens presets
 *   - Coop synthesis (transcript-to-purpose pipeline)
 *   - Archive story builders (receipt descriptions for the UI)
 *   - ICE server configuration for WebRTC sync
 *   - Blob persistence helpers
 *   - Audio transcription (Whisper capability detection + runner)
 *   - Shared ID and timestamp utilities
 *
 * **Excluded** — kept out to avoid pulling heavy or extension-only code:
 *   - Extension runtime (Chrome APIs, background handlers, service worker state)
 *   - Session signing and smart-module integration (@rhinestone/module-sdk)
 *   - Heavy onchain crypto (Safe creation, ERC-4337, provider factory)
 *   - Policy evaluation and action-bundle execution
 *   - Stealth addresses (ERC-5564 secp256k1 derivation)
 *   - Privacy / Semaphore ZK membership proofs
 *   - Agent harness and skill pipeline
 *   - Green Goods garden lifecycle and executor functions
 *   - ERC-8004 on-chain agent registry
 *   - Operator / trusted-node runtime behavior
 */

// Schema contracts — types, Zod validators, and enum definitions shared across the app
export * from './contracts';

// App-shell helpers — theme, navigation, and layout utilities for the PWA
export * from './modules/app';

// Blob utilities — image compression and thumbnail generation for capture payloads
export { compressImage, generateThumbnailDataUrl } from './modules/blob';

// Receiver — pairing, sync envelope handling, and cross-device capture relay
export * from './modules/receiver';

// Local persistence — Dexie database and Yjs CRDT document helpers
export * from './modules/storage';

// Coop board — read-only board state for the receiver and landing page
export * from './modules/coop/board';

// Setup insights — default summaries and insight derivation for new coops
export {
  createDefaultSetupSummary,
  emptySetupInsightsInput,
  toSetupInsights,
} from './modules/coop/setup-insights';
export type { SetupInsightsInput } from './modules/coop/setup-insights';

// Ritual-lens presets — predefined capture configurations
export { getRitualLenses } from './modules/coop/presets';
export type { RitualLensPreset } from './modules/coop/presets';

// Synthesis — transcript-to-purpose pipeline for coop creation flows
export { synthesizeTranscriptsToPurpose } from './modules/coop/synthesis';

// Archive story — human-readable archive receipt descriptions
export { buildCoopArchiveStory, describeArchiveReceipt } from './modules/archive/story';

// ICE servers — TURN/STUN configuration for WebRTC peer sync
export { buildIceServers } from './modules/coop/sync';

// Blob persistence — save captured blobs to local storage
export { saveCoopBlob } from './modules/blob';

// Transcription — Whisper capability detection and audio transcription runner
export { isWhisperSupported, transcribeAudio } from './modules/transcribe';
export type { TranscriptionResult } from './modules/transcribe';

// Shared utilities — deterministic ID generation and ISO timestamp helper
export { createId, nowIso } from './utils';
