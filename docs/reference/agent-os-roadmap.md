---
title: "Agentic Browser OS — Architecture Roadmap"
slug: /reference/agent-os-roadmap
---

# Coop Agentic Browser OS — Architecture Roadmap

**Status**: Active roadmap
**Created**: 2026-03-16
**Document Role**: Evolution path from current agent architecture to capability-based browser OS

---

## 1. Current Architecture Assessment

Coop already has strong OS-like qualities: a 16-skill DAG with observation-driven triggers, a three-tier inference cascade, capability-based auth (policy/session/permit), CRDT sync via Yjs, and passkey identity. This section documents what exists, what works well, and where the architecture needs to evolve.

### 1.1 What Exists Today

#### Agent Harness

The agent runs a fully autonomous observe→plan→act loop in the extension's offscreen document, with zero cloud dependencies for core operation.

| Component | File | Lines | Role |
|-----------|------|-------|------|
| Runner | `extension/src/runtime/agent-runner.ts` | ~1,670 | Main cycle loop, observation plans, action dispatch |
| Models | `extension/src/runtime/agent-models.ts` | ~440 | Three-tier inference: WebLLM → Transformers.js → heuristic |
| Harness | `extension/src/runtime/agent-harness.ts` | ~170 | Topological sort (Kahn's algorithm), skip conditions, DAG planning |
| Knowledge | `extension/src/runtime/agent-knowledge.ts` | ~260 | External SKILL.md fetch, parse, route, cache |
| Logger | `extension/src/runtime/agent-logger.ts` | ~180 | Structured trace logging with span correlation |
| Registry | `extension/src/runtime/agent-registry.ts` | ~70 | Build-time skill manifest loading |
| Config | `extension/src/runtime/agent-config.ts` | ~30 | Thresholds, timeouts, cycle state |
| WebLLM Bridge | `extension/src/runtime/agent-webllm-bridge.ts` | ~120 | WebLLM worker communication |
| Domain Model | `shared/src/modules/agent/agent.ts` | ~430 | Observations, plans, skills, drafts, memory |

**14 registered skills** in `packages/extension/src/skills/`, each a directory with `skill.json` manifest and `SKILL.md` instruction file. Skills declare dependencies via `depends` field; the harness topologically sorts them with alphabetical tie-breaking.

**Three-tier inference cascade:**

| Tier | Engine | Model | When Used |
|------|--------|-------|-----------|
| 1 | WebLLM (WebGPU) | Qwen2-0.5B-Instruct-q4f16_1 | WebGPU available, synthesis skills |
| 2 | Transformers.js (WASM) | Qwen2.5-0.5B-Instruct (q4) | Extraction skills, WebGPU fallback |
| 3 | Heuristic rules | None | Both models fail, or deterministic skills |

**Output reliability stack:** JSON repair, retry-with-error-context, grammar-constrained generation (WebLLM XGrammar), Zod schema validation, graceful tier fallback.

**Human-in-the-loop:** Three approval tiers (`advisory`, `proposal`, `auto-run-eligible`). Auto-run is opt-in per skill. The agent never acts without authorization.

**Observability:** Every cycle produces structured trace spans stored in the `agentLogs` Dexie table. Stall detection marks observations with 3+ consecutive failures as `stalled`.

#### Shared Domain

18 modules in `packages/shared/src/modules/` with barrel exports through `@coop/shared`:

| Module | Domain |
|--------|--------|
| `agent` | Observations, plans, skills, drafts, cross-session memory |
| `app` | App shell logic |
| `archive` | Storacha/Filecoin upload and lifecycle |
| `auth` | Passkey-first identity + onchain auth |
| `coop` | Core flow board, review, sync, and publish logic |
| `erc8004` | ERC-8004 on-chain agent registry |
| `fvm` | Filecoin VM interactions |
| `greengoods` | Green Goods garden bootstrap and sync |
| `onchain` | Safe creation, ERC-4337, contract interactions, provider factory |
| `operator` | Anchor/trusted-node runtime behavior |
| `permit` | Execution permits with replay protection |
| `policy` | Action approval workflows, typed EIP-712 action bundles |
| `privacy` | Semaphore v4 ZK membership proofs + anonymous publishing |
| `receiver` | PWA receiver and cross-device sync |
| `session` | Scoped execution permissions, time-bounded capabilities |
| `stealth` | ERC-5564 stealth addresses (secp256k1) |
| `storage` | Dexie + Yjs local persistence |

All domain types are Zod schemas in `contracts/schema.ts`, inferred with `z.infer<>`.

#### Authorization Stack

Four-layer capability-based auth chain (documented in detail in `docs/architecture/policy-session-permit.md`):

1. **Policy** — Defines approval rules per action class (14 governed action types). EIP-712 typed action bundles with replay protection. Bounded executor with handler registry.
2. **Session** — Scoped on-chain execution via ERC-4337 smart session keys (Rhinestone). Time-bounded, usage-limited, action-allowlisted, target-allowlisted. Encrypted key material (AES-256-GCM, PBKDF2).
3. **Permit** — Scoped off-chain delegation for archive uploads and draft publishing. Same constraint model as sessions.
4. **Operator** — Anchor node runtime. Ties policy + session + permit together. Privileged action logging. Operator console in sidepanel.

#### Extension Runtime

- **MV3 service worker** at `packages/extension/src/background.ts`: 632 lines, 84 `case` statements across the `onMessage` switch, context menu handler, and keyboard command handler
- **Sidepanel**: Primary UX surface (React)
- **Popup**: Quick actions and status
- **Offscreen document**: WebRTC (y-webrtc) + agent inference (WebLLM/Transformers.js)

#### Data Layer

- **Dexie (IndexedDB)**: 27 tables across 11 schema versions (`packages/shared/src/modules/storage/db.ts`)
- **Yjs CRDT sync**: Coop shared state via `Y.Doc` with `Y.Map<string>` root (`packages/shared/src/modules/coop/sync.ts`)
- **y-webrtc transport**: Peer-to-peer sync via WebRTC with y-webrtc signaling relay on Fly.io
- **y-indexeddb**: Local Yjs persistence

#### Privacy & Identity

- **Semaphore v4**: ZK membership proofs for anonymous group actions (`packages/shared/src/modules/privacy/`)
- **ERC-5564**: Stealth addresses for private receiving (`packages/shared/src/modules/stealth/`)
- **Passkey-first identity**: WebAuthn authentication, no wallet-extension-first UX
- **Safe multisig**: On-chain group identity on Arbitrum (Sepolia for dev)

### 1.2 Known Issues

#### CRDT Correctness — JSON-Serialized Arrays in Y.Map

**Location:** `packages/shared/src/modules/coop/sync.ts:90-97`

```typescript
export function writeCoopState(doc: Y.Doc, state: CoopSharedState) {
  const root = doc.getMap<string>(ROOT_KEY);
  doc.transact(() => {
    for (const key of sharedKeys) {
      root.set(key, JSON.stringify(state[key])); // ← problem
    }
  });
}
```

The `sharedKeys` array includes collection fields (`members`, `invites`, `artifacts`, `archiveReceipts`, `memberCommitments`) that are arrays of objects. Serializing them as `JSON.stringify()` into `Y.Map<string>` means each write replaces the entire array atomically. When two peers concurrently modify different items in the same array, the last writer wins — silently discarding the other peer's changes.

**Impact:** Concurrent edits to membership, artifacts, or archive receipts can lose data. This is the highest-priority architectural fix because it undermines the local-first sync guarantee. See `docs/architecture/knowledge-sharing-and-scaling.md` for detailed analysis of the JSON-in-CRDT anti-pattern, including sync amplification and document bloat measurements.

#### Remotely-Hosted WASM

**Location:** `packages/extension/src/runtime/agent-models.ts:161` and `packages/extension/src/runtime/inference-worker.ts:63`

```typescript
env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
```

ONNX Runtime WASM binaries (~22 MB) are loaded from `cdn.jsdelivr.net` at runtime. This:
- **Blocks Chrome Web Store distribution** — Chrome Web Store policy requires all executable code to be bundled
- **Fails offline** — First load without cache fails without internet
- **Creates a supply chain risk** — CDN compromise could inject malicious WASM

#### Battery Drain from Fixed-Interval Polling

**Location:** `packages/extension/src/runtime/receiver-sync-offscreen.ts:355-360`

```typescript
window.setInterval(() => {
  void refreshBindings();
}, pollIntervalMs);
window.setInterval(() => {
  void runAgentCycle();
}, AGENT_LOOP_POLL_INTERVAL_MS);
```

Two `setInterval` timers run continuously at 1.5s intervals even when there are no pending observations, no active sync rooms, and no receiver pairings. On mobile devices (via PWA) and laptops on battery, this causes unnecessary CPU wake-ups and battery drain.

#### Monolithic Background Dispatcher

**Location:** `packages/extension/src/background.ts`

632 lines with 84 `case` statements across the `onMessage` dispatcher, context menu handler, and keyboard command handler. Adding a new message type requires modifying this file, increasing merge conflict risk and making the dispatcher harder to reason about. No handler isolation — a throw in one handler can affect the switch scope.

#### No Evaluation Harness

There is no systematic quality measurement for skill outputs. The agent produces outputs and validates them against Zod schemas, but there are no golden fixtures, no quality scoring, and no regression detection. When a model upgrade or prompt change degrades a skill, the degradation is invisible until a user notices bad outputs.

#### No Typed Event Bus

State changes propagate through three implicit mechanisms:
1. Dexie `liveQuery()` watches in React components
2. `chrome.runtime.sendMessage()` between extension contexts
3. Direct function calls within the same context

There is no central event bus, no lifecycle hooks, and no way to intercept or observe state transitions across contexts. The agent observation system polls for changes instead of reacting to events.

#### No Storage Quota Management

Receiver blobs (audio recordings, photos) are stored in IndexedDB without size tracking or eviction. On devices with limited storage, this can silently fail when quota is exceeded, with no user-facing warning.

#### Chrome API Coupling

Direct `chrome.*` calls are scattered throughout the extension runtime. This makes the code:
- **Untestable** without Chrome API mocks
- **Non-portable** to PWA, Tauri, or other browser engines
- **Tightly coupled** to Chrome's specific API surface

---

## 2. Target Architecture

The target is a capability-based microkernel model where the portable core is separated from host-specific shells and pluggable compute runtimes.

```
Shells (UI + Host Integration)
  ├── Chrome Extension Shell
  │     Sidepanel (primary UX), Popup, Background SW, Offscreen
  ├── PWA Receiver Shell
  │     Companion capture app (audio, photos, files, links)
  └── Native Shell (future: Tauri)
        Desktop app with native file access, notifications

Capability Kernel (portable core — @coop/core extraction target)
  ├── Typed Event Bus + Observation Ledger
  │     CoopEvent discriminated union, lifecycle hooks,
  │     BroadcastChannel cross-context, bus.on() replaces polling
  ├── Skill Graph
  │     Compositional prompts, lazy SKILL.md loading,
  │     DAG planner (Kahn's), skip conditions, MCP-shaped manifests
  ├── Policy / Session / Permit Enforcement
  │     Existing 4-layer auth stack (already well-architected)
  ├── State & Storage Interfaces
  │     Host-abstract HostCapabilities interface,
  │     DI for storage/alarms/notifications/tabs/permissions
  ├── Interop Layer
  │     MCP/WebMCP-shaped tool registry,
  │     skillManifestToMcpTool() bridge,
  │     Consume external WebMCP tools, expose Coop actions
  └── Eval Harness + Observability
        Golden fixtures, structural scoring, LLM-as-judge (gated),
        existing trace logging extended with eval metrics

Compute Runtimes (pluggable, four-tier cascade)
  ├── Tier 0: Built-in Browser Models
  │     Gemini Nano via ai.languageModel API — zero cost, instant
  ├── Tier 1: WebLLM (WebGPU)
  │     Highest quality, paged KV cache, grammar-constrained JSON
  ├── Tier 2: Transformers.js (WASM/WebGPU)
  │     Most portable, v4 WebGPU runtime, standalone tokenizer
  └── Tier 3: Heuristics
        Deterministic rules — always available, zero inference cost

Data Substrates (pluggable)
  ├── Local: Dexie/IndexedDB
  │     + quota monitoring, eviction policies, usage tracking
  ├── Shared: Yjs with Nested Y.Map per Collection
  │     CRDT-native arrays (no JSON.stringify), migration sentinel
  └── Archive: Storacha/Filecoin Pipeline
        Existing upload lifecycle (unchanged)
```

### Design Principles

1. **Portable core, thin shells.** Domain logic, skill graph, auth, and event bus live in the kernel. Shells adapt to host APIs (Chrome, PWA, native) via capability interfaces.
2. **Event-driven, not poll-driven.** The typed event bus replaces implicit polling. Observations are generated in response to events, not on fixed intervals.
3. **Evaluate before shipping.** Every skill has golden fixtures and quality scoring. Prompt changes require eval regression checks.
4. **Design for interop.** Skill manifests are MCP/WebMCP-shaped from the start, enabling future tool exchange with external agents and websites.
5. **Graceful degradation across four tiers.** Built-in browser models (Tier 0) provide instant, zero-cost inference; WebLLM (Tier 1) provides highest quality; Transformers.js (Tier 2) provides portability; heuristics (Tier 3) guarantee availability.

---

## 3. Evolution Phases

### Phase 1: Foundation Fixes

These are correctness and compliance fixes that should be addressed before adding new capabilities. Phases 1A and 1B are independent and can be done in parallel.

#### Phase 1A: CRDT Correctness — Nested Y.Map by ID

**Problem:** `writeCoopState()` serializes collection arrays as `JSON.stringify()` strings, causing last-writer-wins on concurrent edits.

**Solution:** Migrate collection fields to nested `Y.Map` structures keyed by item ID.

**Approach:**

```
Before (current):
  root.set('members', JSON.stringify([{id:'m1',...}, {id:'m2',...}]))

After (target):
  root.get('members')  →  Y.Map<string, string>
    .get('m1')  →  JSON.stringify({id:'m1',...})
    .get('m2')  →  JSON.stringify({id:'m2',...})
```

Each item is its own Y.Map entry. Concurrent edits to different items merge cleanly. Concurrent edits to the *same* item are still last-writer-wins at the item level (acceptable granularity for membership and artifact objects).

**Migration strategy:**
- Add `syncVersion` sentinel field to the root Y.Map (absent = v1, present = v2)
- V2 reader detects v1 format (string value for collection key) and falls back to parse + re-write
- V2 writer always writes nested format
- Scalar fields (`profile`, `setupInsights`, `soul`, `onchainState`, etc.) remain as `Y.Map<string>` entries — no change needed

**Collection fields to migrate:** `members`, `invites`, `artifacts`, `archiveReceipts`, `memberCommitments`, `rituals`, `reviewBoard`

> **Note:** `rituals` is typically written once at setup and rarely modified concurrently, so it is lower-risk. `reviewBoard` is a derived projection that could be updated by multiple members and is higher-risk. Both should be migrated for consistency, but `reviewBoard` should be validated with concurrent edit tests.

**Files:** `packages/shared/src/modules/coop/sync.ts`, `packages/shared/src/modules/storage/db.ts`, `packages/shared/src/contracts/schema.ts`

#### Phase 1B: Bundle ONNX Runtime WASM

**Problem:** WASM loaded from `cdn.jsdelivr.net` at runtime blocks Chrome Web Store distribution and offline operation.

**Solution:** Bundle ONNX Runtime WASM from `node_modules` into the extension's `dist/wasm/` directory at build time.

**Approach:**
1. Add Vite plugin or build script to copy `onnxruntime-web` WASM files from `node_modules/onnxruntime-web/dist/` to `dist/wasm/` during build
2. Change `wasmPaths` to `chrome.runtime.getURL('wasm/')` in the extension context
3. For the offscreen document worker context, pass the resolved URL from the offscreen document (which has `chrome.runtime` access) to the worker (which does not)
4. Add `wasm/` to `manifest.json` `web_accessible_resources`
5. Update `inference-worker.ts:63` with the same pattern

**Files:** `packages/extension/src/runtime/agent-models.ts:161`, `packages/extension/src/runtime/inference-worker.ts:63`, `packages/extension/wxt.config.ts`

#### Phase 1C: Event-Driven Scheduling

**Problem:** Two `setInterval` timers at 1.5s drain battery when idle.

**Solution:** Replace fixed-interval polling with event-driven triggers plus a safety-net keepalive.

**Approach:**
1. Background service worker sends `run-agent-cycle-if-pending` message to offscreen when observations are created or updated
2. Offscreen runs agent cycle on message receipt instead of on timer
3. Safety-net keepalive: 60s interval that checks for pending work and runs a cycle if found
4. Adaptive idle backoff: keepalive extends to 300s after 3 consecutive idle cycles (no pending observations)
5. Reset to 60s on next observation creation

**Files:** `packages/extension/src/runtime/receiver-sync-offscreen.ts:355-360`, agent message handlers, `packages/extension/src/runtime/agent-config.ts`

---

### Phase 2: Agent Harness Evolution

These phases build on the foundation to make the agent smarter, more observable, and more efficient. Execute sequentially: eval → scheduling → prompt → loading → compaction.

#### Phase 2A: Evaluation Harness (web.dev EDD Pattern)

**Motivation:** Without systematic quality measurement, prompt changes and model upgrades can silently degrade skill outputs. The web.dev evaluation-driven development (EDD) methodology provides a framework: define golden inputs/outputs, score structural completeness, and gate CI on quality thresholds.

**Approach:**

```typescript
// packages/extension/src/runtime/agent/eval.ts

interface SkillEvalCase {
  id: string;
  skillId: string;
  description: string;
  input: {
    observation: AgentObservation;
    context: Record<string, unknown>;
    knowledgeSnippets?: string[];
  };
  expectedOutput: Record<string, unknown>;
  assertions: EvalAssertion[];
}

interface EvalAssertion {
  type: 'schema-valid' | 'field-present' | 'field-matches' | 'array-min-length' | 'score-above';
  path?: string;          // JSONPath to field
  expected?: unknown;     // for field-matches
  threshold?: number;     // for score-above (0-1)
}
```

**Components:**
1. **Golden fixtures** per skill: `skills/*/eval/*.json` with representative inputs and expected outputs
2. **`scoreSkillOutput()`**: Structural completeness scoring (0-1) based on field presence, schema validity, and content assertions
3. **CI gate**: `bun run test:eval` runs all eval cases, fails if any skill drops below its quality threshold
4. **LLM-as-judge** (gated, optional): For synthesis skills where structural checks are insufficient, use a larger model to score output quality. Gated behind `EVAL_USE_LLM_JUDGE` flag because LLM judges can be unreliable and expensive.

**Key insight from web.dev EDD:** Start with deterministic structural assertions (field presence, schema validity, array lengths). Only add LLM-as-judge when structural checks are provably insufficient for a specific skill.

#### Phase 2B: Adaptive Observation Scheduling

**Motivation:** Not all observations are equally urgent. Approval requests should be processed immediately; stale review items can wait.

**Approach:**
1. **Priority ordering**: approval requests > high-confidence drafts > ritual reviews > stale items
2. **Exponential backoff on failure**: `nextRetryAt` field on observations, base 5 minutes, max 2 hours, doubles on each consecutive failure
3. **Idle cycle detection**: Track consecutive cycles with no pending work. After 3 idle cycles, extend keepalive to 300s (from Phase 1C)
4. **Keepalive extension**: When no pending observations exist and no events arrive, the agent effectively hibernates

**Depends on:** Phase 1C (event-driven scheduling)

#### Phase 2C: Compositional System Prompt (Pi-Mono Pattern)

**Motivation:** Currently, skill prompts are self-contained. The system prompt is assembled ad-hoc per skill. The pi-mono coding agent demonstrates a better pattern: skills contribute prompt snippets and behavioral guidelines that compose into a coherent system prompt.

**Approach:**

Each skill manifest gains two new fields:

```json
{
  "id": "opportunity-extractor",
  "promptSnippet": "Extract funding and collaboration opportunities from browsing context",
  "promptGuidelines": [
    "Prefer specific amounts and deadlines over vague references",
    "Flag opportunities that match the coop's stated purpose",
    "Output JSON with candidates[] array, each with title, source, confidence"
  ]
}
```

**System prompt assembly:**
1. Collect `promptSnippet` from all active skills → "Available capabilities" section
2. Collect `promptGuidelines` from the current skill being executed → "Current task guidelines" section
3. Inject knowledge skill content (existing mechanism)
4. Tier-aware sizing: full prompt for Tier 0/1, stripped guidelines for Tier 2, no prompt for Tier 3 (heuristics don't use prompts)

**Key insight from pi-mono:** The compositional prompt pattern means adding a new skill automatically enriches the system prompt without editing a central prompt template.

#### Phase 2D: Lazy Skill Loading (Pi-Mono SKILL.md Pattern)

**Motivation:** Currently, skill definitions are loaded at build time via `agent-registry.ts`. The existing SKILL.md protocol (for knowledge skills) already demonstrates lazy loading from URLs. Apply the same pattern to executable skill instructions.

**Approach:**
1. Skill manifests are always loaded at build time (small JSON, needed for DAG construction)
2. Each skill's `promptSnippet` (~50 tokens) is included in every system prompt for capability awareness
3. Full `SKILL.md` content is loaded on-demand when the skill is selected for execution
4. Loaded content is cached in Dexie (existing `knowledgeSkills` table pattern)
5. `SKILL.md` files can be overridden per-coop via `CoopKnowledgeSkillOverride` records (existing mechanism)

**Progressive disclosure:** The LLM knows *about* all skills from their one-line snippets, but only gets the full instructions for skills it's actually executing. This keeps the prompt within browser model context windows (4K-8K tokens for 0.5B models).

#### Phase 2E: Context Compaction (Pi-Mono Pattern)

**Motivation:** Browser models have small context windows. As observations accumulate and agent sessions span days, the context grows beyond what the model can process effectively.

**Approach:**

1. **Processing ledger**: Track which captures, tabs, and drafts were processed in each agent session. Store `{ observationId, processedAt, summary? }` records.
2. **Compaction trigger**: When context exceeds 70% of the current model's context window, compact old context.
3. **Tier-aware compaction**:
   - Tier 0/1 (LLM available): Use the model to summarize old context into a condensed digest
   - Tier 2 (smaller model): Use the model with a simpler summarization prompt
   - Tier 3 (heuristic): Keep last N observations + all pending plans, discard processed observation details
4. **Compaction boundaries**: Preserve `pendingObservations` and `activeProposals` across compaction. Only compact `completedObservations` and `processedCaptures`.

**Key insight from pi-mono:** Context compaction is not just about token count — it's about preserving the agent's "working memory" (what it's currently doing) while compressing its "long-term memory" (what it has already processed).

**Cross-session persistence**: The existing `agentMemories` Dexie table (schema v11) provides cross-session memory storage. Compaction summaries are persisted here so the agent can reference them in future sessions.

---

### Phase 3: Architectural Modularity

These phases restructure the codebase for testability, portability, and extensibility.

#### Phase 3A: Background Dispatcher Refactor

**Problem:** 84 case statements across multiple switches in `background.ts`.

**Solution:** Handler registry pattern.

**Approach:**

```typescript
// packages/extension/src/handlers/registry.ts
type MessageHandler<T = unknown> = (
  payload: T,
  sender: chrome.runtime.MessageSender,
) => Promise<unknown>;

const handlers = new Map<string, MessageHandler>();

export function registerHandler(type: string, handler: MessageHandler) {
  if (handlers.has(type)) throw new Error(`Duplicate handler: ${type}`);
  handlers.set(type, handler);
}

export async function dispatch(message: { type: string; [key: string]: unknown }, sender: chrome.runtime.MessageSender) {
  const handler = handlers.get(message.type);
  if (!handler) throw new Error(`Unknown message type: ${message.type}`);
  return handler(message, sender);
}
```

Each handler file self-registers:

```typescript
// packages/extension/src/handlers/capture.ts
registerHandler('start-capture', async (msg) => { /* ... */ });
registerHandler('stop-capture', async (msg) => { /* ... */ });
```

`background.ts` becomes dispatcher wiring — importing handler modules and setting up the `chrome.runtime.onMessage` listener with `dispatch()`.

**Type safety:** Add an exhaustive handler coverage test that asserts all known message types have registered handlers.

**Execution order:** Do this early (after Phase 1A/1B) because a cleaner dispatcher makes all subsequent phases easier to implement.

#### Phase 3B: Host Capability Interfaces

**Problem:** Direct `chrome.*` calls block testability and portability.

**Solution:** Abstract host capabilities behind interfaces. Inject implementations.

**Approach:**

```typescript
// packages/shared/src/modules/host/capabilities.ts
interface HostCapabilities {
  // Scheduling
  alarms: {
    create(name: string, options: { delayInMinutes?: number; periodInMinutes?: number }): Promise<void>;
    clear(name: string): Promise<void>;
    onAlarm(callback: (name: string) => void): void;
  };
  // Notifications
  notifications: {
    create(id: string, options: { title: string; message: string; iconUrl?: string }): Promise<void>;
    clear(id: string): Promise<void>;
  };
  // Storage (extension-level, not Dexie)
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    set<T>(key: string, value: T): Promise<void>;
    remove(key: string): Promise<void>;
  };
  // Tabs (read-only for capture)
  tabs: {
    query(options: { active?: boolean; currentWindow?: boolean }): Promise<TabInfo[]>;
    getActiveTab(): Promise<TabInfo | undefined>;
  };
  // Permissions
  permissions: {
    request(permissions: string[]): Promise<boolean>;
    contains(permissions: string[]): Promise<boolean>;
  };
}
```

**Implementations:**
- `ChromeExtensionAdapter`: Wraps `chrome.alarms`, `chrome.notifications`, `chrome.storage.local`, `chrome.tabs`, `chrome.permissions`
- `MockHostAdapter`: In-memory implementation for tests
- `WebAdapter` (future): PWA equivalents (Notification API, localStorage, no tabs)
- `TauriAdapter` (future): Native equivalents

**Incremental adoption:** Start with alarms + notifications (used by Phase 1C scheduling), expand to storage + tabs as handlers are refactored in Phase 3A.

#### Phase 3C: Typed Event Bus (Pi-Mono Pattern)

**Problem:** State changes propagate through three implicit mechanisms (Dexie watches, `chrome.runtime.sendMessage`, direct calls). No central observability, no lifecycle hooks.

**Solution:** Typed event bus with discriminated union events and lifecycle hooks.

**Approach:**

```typescript
// packages/shared/src/modules/events/bus.ts

type CoopEvent =
  | { type: 'observation:created'; observationId: string; trigger: string }
  | { type: 'observation:processed'; observationId: string; result: 'success' | 'failure' }
  | { type: 'skill:started'; skillId: string; observationId: string; tier: number }
  | { type: 'skill:completed'; skillId: string; durationMs: number; tier: number }
  | { type: 'draft:created'; draftId: string; source: string }
  | { type: 'draft:published'; draftId: string; coopId: string }
  | { type: 'sync:connected'; roomId: string; peerCount: number }
  | { type: 'sync:disconnected'; roomId: string }
  | { type: 'receiver:capture-arrived'; captureId: string; kind: string }
  | { type: 'bundle:proposed'; bundleId: string; actionClass: string }
  | { type: 'bundle:executed'; bundleId: string; actionClass: string }
  // ... extensible via discriminated union

interface EventBus {
  emit(event: CoopEvent): void;
  on<T extends CoopEvent['type']>(type: T, handler: (event: Extract<CoopEvent, { type: T }>) => void): () => void;
  once<T extends CoopEvent['type']>(type: T, handler: (event: Extract<CoopEvent, { type: T }>) => void): () => void;
}
```

**Lifecycle hooks** for the skill system:
- `before:skill-run` — inject additional context, check preconditions
- `after:skill-run` — log metrics, trigger dependent observations
- `context:inject` — external systems contribute context to skill prompts
- `compaction:intercept` — plugins can preserve data across compaction

**Cross-context communication:** Use `BroadcastChannel` API for background → sidepanel/popup communication. The event bus wraps `BroadcastChannel` when running in an extension context.

**Agent integration:** Observation generation listens via `bus.on('draft:created', ...)` instead of polling Dexie for new drafts. The event bus becomes the primary trigger for agent cycles, superseding Phase 1C's message-based trigger with a more general mechanism.

> **Phase 1C → 3C progression:** Phase 1C introduces message-based event-driven scheduling as a quick win (replacing `setInterval` with `chrome.runtime.sendMessage`). Phase 3C generalizes this with the typed event bus. Implementing them together (as shown in the execution order) avoids building Phase 1C only to immediately replace it. If the event bus is delayed, Phase 1C stands alone as a valid improvement.

---

### Phase 4: Platform Preparation

These phases prepare for scale, user experience, and ecosystem integration.

#### Phase 4A: Storage Quota Management

**Motivation:** Receiver blobs (audio recordings, photos, files) accumulate in IndexedDB without bounds. On devices with limited storage (mobile PWA), this causes silent failures.

**Approach:**
1. **`estimateStorageUsage()`**: Wraps `navigator.storage.estimate()` to report usage, quota, and percentage
2. **Eviction policy**: When usage exceeds 80% quota, evict:
   - Synced receiver blobs (already uploaded to coop) — oldest first
   - Processed agent observations with no pending plans — oldest first
   - Stale capture runs older than 30 days
3. **Heartbeat**: Triggered by event bus `receiver:capture-arrived` and periodic keepalive
4. **User notification**: At 80% quota, notify user with breakdown of storage usage and offer manual cleanup
5. **Auto-eviction**: At 90% quota, auto-evict synced blobs with user notification

#### Phase 4B: Model Download UX

**Motivation:** WebLLM and Transformers.js models require significant downloads (100MB-2GB). Currently, download happens silently in the background with no user feedback.

**Approach:**
1. Surface download progress from `agent-webllm-bridge.ts` to sidepanel via event bus
2. **Model management UI** in sidepanel operator section:
   - Available models with sizes
   - Download status (not downloaded / downloading / ready / error)
   - Delete cached models to free storage
3. Gated behind existing `localInferenceOptIn` setting — no downloads without explicit user consent
4. Progress events: `model:download-started`, `model:download-progress`, `model:download-complete`, `model:download-failed`

#### Phase 4C: Four-Tier Inference Cascade

**Motivation:** Chrome's built-in AI APIs (Gemini Nano) provide zero-cost, instant inference for simple tasks. Transformers.js v4 brings a ground-up WebGPU runtime. WebNN provides a future path to NPU/GPU/CPU routing. The current three-tier cascade should evolve to accommodate these.

**Target cascade:**

| Tier | Engine | Cost | Latency | Quality | Availability |
|------|--------|------|---------|---------|-------------|
| 0 | Built-in (Gemini Nano) | Zero | Instant | Good for simple tasks | Chrome 138+ with flag |
| 1 | WebLLM (WebGPU) | GPU memory | Seconds | Highest (grammar-constrained) | WebGPU required |
| 2 | Transformers.js v4 (WASM/WebGPU) | CPU/GPU | Seconds | Good (portable) | Universal |
| 3 | Heuristics | Zero | Instant | Task-dependent | Always |

**Tier 0 integration:**
```typescript
// Capability detection
const capabilities = await ai.languageModel.capabilities();
if (capabilities.available === 'readily') {
  // Gemini Nano ready — use for classification, extraction, short summaries
}
```

Tier 0 is best for skills that need quick classification or extraction (opportunity-extractor, theme-clusterer) where grammar-constrained JSON is not critical. Tier 1 remains preferred for synthesis skills (capital-formation-brief, review-digest) where output quality matters most.

**Transformers.js v4 migration path:**
- WebGPU runtime (replaces ONNX WASM for supported browsers): ~3x faster on GPU
- Standalone tokenizer (8.8kB): Usable in service worker for token counting without loading full model
- Offline caching: Built-in model caching with cache management API
- Performance benchmark: 60 tok/s on M4 Pro (Transformers.js v4), vs current WASM performance

**WebNN slot (future):**
- W3C draft with 95 operations, routes to DirectML (Windows), CoreML (macOS), NNAPI (Android)
- Near-zero adoption currently — keep a slot in the cascade but don't depend on it
- When available, can auto-route to NPU for efficient inference on supported hardware

**Capability detection order:**
1. `ai.languageModel` → Tier 0 (built-in)
2. `navigator.gpu` → Tier 1 (WebLLM WebGPU) or Tier 2 (Transformers.js v4 WebGPU)
3. WebAssembly support → Tier 2 (Transformers.js WASM fallback)
4. Always → Tier 3 (heuristics)

**Depends on:** Phase 2C (compositional prompt — tier-aware prompt sizing)

#### Phase 4D: Interop-Ready Tool Registry

**Motivation:** The emerging WebMCP standard (W3C draft, targeting Chrome 146) and the existing MCP protocol provide a path to standardized tool exchange between agents and websites. Coop's skill manifests should be shaped for this interoperability from the start.

**Approach:**

Extend `SkillManifest` with interop-ready fields:

```typescript
interface SkillManifest {
  // Existing fields
  id: string;
  version: string;
  description: string;
  model: 'webllm' | 'transformers' | 'heuristic';
  triggers: string[];
  outputSchemaRef: string;
  approvalMode: 'advisory' | 'proposal' | 'auto-run-eligible';
  timeoutMs: number;
  depends: string[];
  skipWhen: string;
  provides: string[];

  // New interop fields
  mcpToolId?: string;                                    // Stable tool identifier for MCP/WebMCP
  inputSchemaRef?: string;                               // Already exists on some skills
  sideEffects: 'local-only' | 'shared' | 'onchain';     // Explicit side-effect boundary
  requiredCapabilities?: string[];                       // Host capabilities needed (e.g., 'tabs', 'notifications')
}
```

**Bridge function:**

```typescript
function skillManifestToMcpTool(manifest: SkillManifest): McpToolDefinition {
  return {
    name: manifest.mcpToolId ?? manifest.id,
    description: manifest.description,
    inputSchema: resolveSchema(manifest.inputSchemaRef),
    outputSchema: resolveSchema(manifest.outputSchemaRef),
    annotations: {
      sideEffects: manifest.sideEffects,
      approvalMode: manifest.approvalMode,
    },
  };
}
```

**WebMCP integration paths (when spec stabilizes):**

1. **Expose Coop actions as WebMCP tools** on the PWA receiver: External agents can invoke Coop's publish/review/archive actions through the standard WebMCP tool registration API (`navigator.modelContext.registerTool()`)
2. **Consume WebMCP tools from websites**: Instead of DOM scraping for capture, use structured tool outputs from websites that expose WebMCP tools — richer data with explicit schemas
3. **MCP server bridge**: For existing MCP clients, expose Coop skills via a lightweight MCP server adapter

**Design principle:** Shape the registry now, defer the protocol implementation until WebMCP stabilizes. The cost of adding `mcpToolId` and `sideEffects` fields is near zero; the benefit is avoiding a later retrofit.

**Future exploration: `just-bash` as a scripted skill runtime.** [`just-bash`](https://github.com/vercel-labs/just-bash) is a browser-capable simulated Bash environment with a virtual filesystem and opt-in networking. It is a plausible fit for **deterministic, local-only executable skills** that transform structured observation/context files into validated JSON outputs, and for **fixture-driven eval cases** where shell-style assertions (`jq`, `rg`, `sed`, `diff`) are useful. It should be treated as a bounded scripting/tool layer, not as a replacement for the inference cascade or the typed TypeScript action/permit pipeline. If explored, the first use cases should be:

1. advisory or local-only scripted skills with no privileged side effects
2. eval harness cases that materialize fixture input as files and score structured output
3. read-only custom commands before any write or proposal-capable commands

**Constraints to preserve:** lazy-load in offscreen/worker contexts to avoid inflating the primary extension bundle; keep proposal creation, permit enforcement, session capability checks, and onchain/shared-state mutations in typed runtime code outside the shell; prefer one script per skill run with explicit file-based inputs/outputs over long-lived mutable shell sessions.

---

### Phase 5: Portability

These phases execute when native development begins or when the kernel abstraction is validated.

#### Phase 5A: Platform Adapters

**Motivation:** Validate the `HostCapabilities` abstraction from Phase 3B by implementing adapters for multiple platforms.

**Implementations:**
- `ChromeExtensionAdapter` — Already implemented in Phase 3B
- `WebAdapter` (PWA) — Maps to Web APIs: `Notification`, `localStorage`, no tabs API
- `TauriAdapter` (future) — Maps to Tauri commands: native notifications, file system, window management

**Validation criteria:** All unit tests pass with `MockHostAdapter`. Integration tests pass with `ChromeExtensionAdapter` and `WebAdapter`. The portable core (`@coop/core`) never imports `chrome.*` directly.

#### Phase 5B: Shared Core Extraction

**Motivation:** As native apps become viable, the portable core should be extractable as its own package.

**Split:**
- `@coop/core` — Pure domain logic: schemas, agent harness, skill graph, policy/session/permit, event bus, eval harness
- `@coop/shared` — Browser-specific: Dexie persistence, Yjs sync, y-webrtc transport, receiver sync

**Backward compatibility:** `@coop/shared` re-exports `@coop/core` so existing imports (`import { x } from '@coop/shared'`) continue to work.

**Native apps** depend on `@coop/core` + their own persistence layer (SQLite, native CRDT, etc.).

**Criteria for extraction:** Phase 3B (host capabilities) and Phase 3C (event bus) must be complete. The boundary is clear: if it references `Dexie`, `Y.Doc`, `chrome.*`, or `BroadcastChannel`, it stays in `@coop/shared`. The `HostCapabilities` interface (Phase 3B) is host-abstract and moves to `@coop/core`; adapter implementations stay in `@coop/shared` or platform-specific packages.

---

## 4. External Ecosystem Context

This section documents the current state of browser AI infrastructure and emerging standards. These findings inform the timing and prioritization of the evolution phases.

### 4.1 Browser AI Runtimes

#### Transformers.js v4

**Source:** [Transformers.js v4 preview](https://huggingface.co/blog/transformersjs-v4), [Web AI Summit 2025 talk](https://youtu.be/n18Lrbo8VU8)

| Finding | Detail |
|---------|--------|
| Ground-up WebGPU runtime | No longer wrapping ONNX; native WebGPU compute shaders |
| Architecture coverage | 200+ model architectures supported |
| Standalone tokenizer | 8.8kB, runs in service worker, no model download needed |
| Offline caching | Built-in model cache management (download, list, delete) |
| Performance | 60 tok/s on M4 Pro (text generation) |
| WASM fallback | Automatic WASM fallback when WebGPU unavailable |

**Coop impact:** Major upgrade path for Tier 2. The standalone tokenizer is immediately useful for token counting in the service worker (prompt sizing for compositional prompts, Phase 2C). The WebGPU runtime closes the performance gap with WebLLM for many tasks.

#### WebLLM

**Source:** [WebLLM](https://webllm.mlc.ai/), [arXiv:2412.15803](https://arxiv.org/abs/2412.15803), [Web AI Summit 2025 talk](https://youtu.be/MhTCzq7iTy0)

| Finding | Detail |
|---------|--------|
| OpenAI-compatible API | Drop-in replacement for OpenAI client libraries |
| Paged KV cache in WASM | Efficient memory management for long conversations |
| Grammar-constrained JSON | XGrammar forces valid JSON at token level — critical for structured output |
| Performance retention | 71-80% of native inference speed |
| ServiceWorkerMLCEngine | Can run inference directly in MV3 service worker |
| Model support | Llama, Qwen, Phi, Gemma, Mistral families |

**Coop impact:** Current integration validated. The `ServiceWorkerMLCEngine` could allow moving inference from the offscreen document to the service worker (eliminating the offscreen → worker bridge), but this requires careful evaluation of service worker lifecycle (5-minute timeout, cold starts). Grammar-constrained JSON remains a key differentiator over other runtimes.

#### Built-in Browser Models (Gemini Nano)

**Source:** [Client-side AI overview](https://web.dev/learn/ai/client-side), Chrome built-in AI documentation

| Finding | Detail |
|---------|--------|
| API | `ai.languageModel.capabilities()`, `ai.languageModel.create()` |
| Cost | Zero — no download, no GPU memory, no latency |
| Availability | Chrome 138+ with origin trial / flag; not yet generally available |
| Capabilities | Summarization, classification, extraction, rewriting |
| Limitations | No grammar-constrained output, limited model control, Chrome-only |

**Coop impact:** Tier 0 candidate for simple skills (classification, extraction). Not suitable for skills requiring structured JSON output (use Tier 1 WebLLM for grammar-constrained generation). Availability is Chrome-only, which aligns with the primary Chrome extension deployment target.

#### WebGPU Enhancements

**Source:** [New in WebGPU Chrome 146](https://developer.chrome.com/blog/new-in-webgpu-146), [WebAssembly and WebGPU enhancements](https://youtu.be/VYJZGa9m34w)

| Finding | Detail |
|---------|--------|
| FP16 shaders (Chrome 120) | 3x speedup for half-precision compute |
| DP4a dot products | 1.6-2.8x speedup for quantized inference |
| Subgroups (Chrome 125) | 2.5x speedup on Intel GPUs |
| Compatibility mode (Chrome 146) | Opt-in via `featureLevel: "compatibility"`; runs WebGPU on OpenGL ES 3.1 (older laptops, mobile) |
| Service worker support | Stable since Chrome 124 |
| WASM Memory64 | Breaks 4GB linear memory limit — path to 7B+ models |

**Coop impact:** Inference acceleration for Tier 1 and Tier 2. WebGPU in service workers validates the current architecture (offscreen document with WebGPU access). WASM Memory64 opens the door to larger models (3B-7B) in future.

### 4.2 Browser LLM State Management

**Source:** [State isn't all you need](https://youtu.be/87un2cGrn-0), [Mozilla AI 3W blog](https://blog.mozilla.ai/3w-for-in-browser-ai-webllm-wasm-webworkers/)

**Key insight:** GPU state is ephemeral. KV cache does not survive service worker restart. IndexedDB is the true source of truth. Treat GPU as a rebuildable compute cache, not a state store.

**Coop implications:**
- Reinforces Dexie-first persistence design — agent state, observations, plans, and memories are all in IndexedDB
- Model weights are cached in browser Cache API / IndexedDB, but must be re-loaded on cold start
- Context compaction (Phase 2E) should persist summaries to Dexie, not rely on in-memory state
- Concurrent model instances are limited by GPU memory — typically 1-2 models max per browser

### 4.3 Emerging Standards

#### WebMCP (Model Context Protocol for the Web)

**Source:** [WebMCP usage patterns](https://developer.chrome.com/blog/webmcp-mcp-usage), [WebMCP early preview](https://developer.chrome.com/blog/webmcp-epp)

| Finding | Detail |
|---------|--------|
| W3C draft | Targeting Chrome 146 for early preview |
| Tool registration | `navigator.modelContext.registerTool()` |
| Scope | Tab-bound, ephemeral, DOM-aware |
| Declarative API | CSS pseudo-classes for tool visibility |
| Imperative API | JavaScript tool registration with schemas |
| Use case distinction | WebMCP for tab-local tools; MCP for persistent server tools |

**Coop implications:**
- Coop's skill manifests should be shaped for MCP/WebMCP translation (Phase 4D)
- PWA receiver can expose publish/review actions as WebMCP tools for external agents
- Extension can consume WebMCP tools from visited websites for structured capture (vs DOM scraping)
- Design the tool registry now; implement WebMCP bridge when the spec stabilizes

#### WebNN

**Source:** [Wasm, WebGPU, & WebNN](https://youtu.be/5CvOjKIpnYk)

| Finding | Detail |
|---------|--------|
| W3C draft | 95 operations defined |
| Backend routing | DirectML (Windows), CoreML (macOS), NNAPI (Android) |
| Adoption | Near-zero currently |
| Promise | Auto-route to NPU/GPU/CPU based on hardware |

**Coop implications:** Keep a slot in the cascade architecture but don't depend on it. When WebNN matures, it could provide efficient inference on NPU-equipped devices without explicit GPU management.

### 4.4 Agent Architecture Patterns

#### Pi-Mono Coding Agent

**Source:** [pi-mono coding agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent), [shittycodingagent.ai](https://shittycodingagent.ai/)

| Pattern | Description | Coop Adoption |
|---------|-------------|---------------|
| Three-layer separation | Core logic / extension system / UI | Phase 5B (core extraction) |
| Compositional prompt | Skills contribute snippets + guidelines | Phase 2C |
| SKILL.md lazy loading | Metadata in prompt, full content on demand | Phase 2D |
| Typed event bus | Discriminated union events, lifecycle hooks | Phase 3C |
| Context compaction | Summarize old context, preserve working memory | Phase 2E |

**Key design philosophy:** "The system prompt is a living document assembled from the capabilities the agent currently has access to." This directly maps to Coop's skill system — each skill contributes its prompt snippet, and the system prompt reflects the current skill graph.

#### Evaluation-Driven Development

**Source:** [web.dev EDD](https://web.dev/learn/ai/evaluation-driven-development)

| Principle | Description | Coop Adoption |
|-----------|-------------|---------------|
| Golden fixtures | Known-good input/output pairs per capability | Phase 2A |
| Structural assertions | Zod schemas as API contracts, field presence checks | Phase 2A |
| LLM-as-judge | Use a larger model to score quality (with caveats) | Phase 2A (gated) |
| Regression gates | CI fails if quality drops below threshold | Phase 2A |
| Iterative refinement | Eval → improve prompt → re-eval cycle | Ongoing |

**Caveat from web.dev:** LLM-as-judge is useful but unreliable — models can be inconsistent, biased toward their own outputs, and expensive at scale. Start with deterministic structural assertions; add LLM scoring only when structural checks are provably insufficient.

---

## 5. Execution Order & Dependencies

```
Phase 1A (CRDT correctness)  ─┬─  Phase 1B (bundle WASM)     ← parallel, highest priority
                               │
Phase 3A (dispatcher refactor) ────────────────────────────── ← next (cleaner codebase)
                               │
Phase 1C + 3C (scheduling + event bus) ──────────────────── ← together (event bus enables
                               │                                 event-driven scheduling)
Phase 3B (host capabilities)  ─────────────────────────────── ← unlocks Phase 5 + testability
                               │
Phase 2A (eval harness)       ─────────────────────────────── ← eval before changing agent
Phase 2B (adaptive scheduling) ────────────────────────────── ← depends on 1C
Phase 2C (compositional prompt) ───────────────────────────── ← depends on 2A (eval gates)
Phase 2D (lazy skill loading)  ────────────────────────────── ← depends on 2C
Phase 2E (context compaction)  ────────────────────────────── ← depends on 2D
                               │
Phase 4A + 4B (quota + model UX) ─────────────────────────── ← parallel, independent
                               │
Phase 4C (four-tier cascade)   ────────────────────────────── ← depends on 2C (tier-aware prompts)
Phase 4D (interop tool registry) ─────────────────────────── ← depends on 2C/2D (skill system)
                               │
Phase 5A + 5B (portability)    ────────────────────────────── ← when native development begins
```

### Priority Tiers

**Tier 1 — Do Now (correctness + compliance):**
- Phase 1A: CRDT correctness (data loss risk)
- Phase 1B: Bundle WASM (Chrome Web Store blocker)

**Tier 2 — Do Next (architecture hygiene):**
- Phase 3A: Dispatcher refactor (reduces friction for all subsequent work)
- Phase 1C + 3C: Event-driven scheduling + event bus (foundational for agent evolution)

**Tier 3 — Agent Intelligence:**
- Phase 2A-2E: Sequential agent harness evolution
- Phase 3B: Host capabilities (enables testing)

**Tier 4 — Scale + Ecosystem:**
- Phase 4A-4D: Storage, model UX, cascade, interop

**Tier 5 — When Ready:**
- Phase 5A-5B: Portability (triggered by native development decision)

---

## Appendix A: Research Sources

### Web AI Summit 2025 Talks
- [Transformers.js: State-of-the-art ML for the web](https://youtu.be/n18Lrbo8VU8)
- [Wasm, WebGPU, & WebNN: Compute abstractions enabling client-side AI](https://youtu.be/5CvOjKIpnYk)
- [Accelerating Web AI on Arm](https://youtu.be/hkP5xI5gaLY)
- [WebAssembly and WebGPU enhancements for faster Web AI](https://youtu.be/VYJZGa9m34w)
- [State isn't all you need: building better LLM apps in the browser](https://youtu.be/87un2cGrn-0)
- [WebLLM: High-performance in-browser LLM inference engine](https://youtu.be/MhTCzq7iTy0)

### Agent Architecture
- [Pi-mono coding agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) — Extension system, SKILL.md, compositional prompts, context compaction, typed event bus
- [shittycodingagent.ai](https://shittycodingagent.ai/) — Agent architecture philosophy

### Libraries & Runtimes
- [WebLLM](https://webllm.mlc.ai/) — In-browser LLM inference via WebGPU
- [WebLLM paper (arXiv:2412.15803)](https://arxiv.org/abs/2412.15803) — Architecture, benchmarks, ServiceWorkerMLCEngine
- [Transformers.js](https://huggingface.co/docs/transformers.js/en/index) — Browser ML with ONNX Runtime
- [Transformers.js v4 preview](https://huggingface.co/blog/transformersjs-v4) — WebGPU runtime rewrite
- [Whisper Web](https://huggingface.co/spaces/Xenova/whisper-web) — Browser speech-to-text reference
- [just-bash](https://github.com/vercel-labs/just-bash) — Browser-capable simulated Bash runtime; candidate for deterministic scripted skills and eval tooling

### Chrome Platform & Standards
- [New in WebGPU (Chrome 146)](https://developer.chrome.com/blog/new-in-webgpu-146) — FP16, subgroups, compatibility mode
- [WebMCP usage patterns](https://developer.chrome.com/blog/webmcp-mcp-usage) — WebMCP vs MCP, tool registration
- [WebMCP early preview](https://developer.chrome.com/blog/webmcp-epp) — Declarative + imperative APIs
- [GoogleChromeLabs WebMCP tools](https://github.com/GoogleChromeLabs/webmcp-tools)
- [Client-side AI](https://web.dev/learn/ai/client-side) — Runtime hierarchy, model download strategies
- [Evaluation-driven development](https://web.dev/learn/ai/evaluation-driven-development) — EDD methodology
- [Prompt engineering for browser AI](https://web.dev/learn/ai/prompt-engineering) — Small model patterns
- [WebGPU/WASM enhancements (part 1)](https://developer.chrome.com/blog/io24-webassembly-webgpu-1)
- [WebGPU/WASM enhancements (part 2)](https://developer.chrome.com/blog/io24-webassembly-webgpu-2)

### Additional References
- [RunanywhereAI on-device browser agent](https://github.com/RunanywhereAI/on-device-browser-agent) — MV3 + WebLLM in service worker
- [Mozilla AI 3W blog](https://blog.mozilla.ai/3w-for-in-browser-ai-webllm-wasm-webworkers/) — Memory constraints, concurrent instances
