---
title: "Browser-Native Agent Harness"
slug: /reference/agent-harness
---

# Browser-Native Agent Harness

Coop runs a browser-native agent loop inside the extension. Raw captures, observation building, and
model inference stay local to the device. The agent observes local knowledge, plans skill
execution, runs small language models in-browser, and proposes actions for human approval before
anything becomes shared.

This is the only known production implementation that combines in-browser LLM inference, a structured observe→plan→act loop, typed skill execution, and human-in-the-loop approval in a single browser extension.

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────┐
│  Extension Service Worker                               │
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐   │
│  │Observation│───▶│  Skill   │───▶│ Action Proposals │   │
│  │  Emitter  │    │ Executor │    │  + Human Review  │   │
│  └──────────┘    └──────────┘    └──────────────────┘   │
│       │               │                    │            │
│       ▼               ▼                    ▼            │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐   │
│  │  Dexie   │    │ WebLLM / │    │Operator Console  │   │
│  │(IndexedDB)│    │Transform │    │  (Sidepanel UI)  │   │
│  └──────────┘    │  / Rules │    └──────────────────┘   │
│                  └──────────┘                           │
└─────────────────────────────────────────────────────────┘
```

## Core Loop

The agent runs on a 1.5-second polling interval in the extension's offscreen document. Each cycle:

1. **Observe**: Scan local state for actionable triggers (high-confidence drafts, receiver backlog, ritual reviews due, Green Goods requests)
2. **Deduplicate**: Fingerprint-based dedup prevents re-processing the same state
3. **Plan**: Select skills via topological sort of the dependency graph, build execution plan
4. **Execute**: Run each skill through the inference cascade (WebLLM → transformers.js → heuristic)
5. **Propose**: Generate action proposals with per-skill approval modes
6. **Log**: Write structured trace spans to Dexie for observability

```text
Observation (pending)
  │
  ├─ dismissed (conditions no longer valid)
  ├─ stalled (≥3 consecutive failures)
  │
  └─ processing
       │
       ├─ Skill 1: opportunity-extractor → candidates
       ├─ Skill 2: grant-fit-scorer → scores (depends on #1)
       ├─ Skill 3: capital-formation-brief → draft (depends on #2)
       ├─ Skill 4: ecosystem-entity-extractor → entities
       ├─ Skill 5: theme-clusterer → themes
       └─ Skill 6: publish-readiness-check → action proposal
            │
            ├─ auto-run-eligible → execute immediately
            ├─ proposal → queue for human approval
            └─ advisory → informational only
```

## Inference Layer

Three-tier fallback ensures the agent always works, regardless of hardware:

| Tier | Engine | Model | Tokens | When Used |
|------|--------|-------|--------|-----------|
| 1 | WebLLM (WebGPU) | Qwen2-0.5B-Instruct-q4f16_1 | 700 | WebGPU available, synthesis skills |
| 2 | Transformers.js (WASM) | Qwen2.5-0.5B-Instruct (q4) | 512 | Extraction skills, WebGPU fallback |
| 3 | Heuristic rules | None | N/A | Both models fail, or deterministic skills |

### Output Reliability

Small models (0.5B parameters) produce unreliable JSON. The harness compensates with:

- **JSON repair**: Fixes trailing commas, missing brackets, truncated strings, raw newlines, control characters before parsing
- **Retry-with-error-context**: On validation failure, retries once with the Zod error message appended to the prompt
- **Grammar-constrained generation**: WebLLM's `response_format: { type: 'json_object' }` forces valid JSON at the token level via XGrammar
- **Zod schema validation**: Every skill output is validated against its declared schema before acceptance
- **Graceful fallback**: If a model fails, the next tier is tried automatically; heuristic rules always produce valid output

### Runtime Provider Contract

The runtime now treats provider choice as an explicit contract instead of a hardcoded detail. The
shared contract shape lives in `packages/shared/src/contracts/schema-agent.ts`, and the extension
registry lives in `packages/extension/src/runtime/agent/provider-contracts.ts`.

Each provider record declares:

- structured JSON mode
- worker safety
- offscreen safety
- WebGPU requirement
- streaming support
- multimodal support
- fallback order

Current contracts cover:

- heuristic fallback
- transformers.js / WASM
- WebLLM / WebGPU
- Chrome Prompt API as an experimental, flag-gated scaffold

The default user-facing path is unchanged. The legacy execution loop still prefers the same local
providers and falls back to heuristics when needed.

### Provider Benchmarks

The benchmark entrypoint is `packages/extension/src/runtime/agent/benchmarks.ts` via
`runAgentProviderBenchmarks()`.

It runs the high-value benchmark fixtures for:

- `tab-router`
- `opportunity-extractor`
- `capital-formation-brief`

For each skill/provider pair it records:

- schema pass rate
- JSON repair rate
- median latency
- cold start time
- confidence score
- fallback or unavailable reason

Results are persisted locally in the `agentBenchmarkRecords` Dexie table so later provider
promotion logic can reuse them without re-shaping raw benchmark output.

### Core Eval Packs

The runtime also keeps a narrow fixture-pack layer for the three priority skills:

- `tab-router`
- `opportunity-extractor`
- `capital-formation-brief`

These fixtures live beside each skill in `packages/extension/src/skills/*/eval/*.json` and are
loaded through `packages/extension/src/runtime/agent/eval.ts`.

Each core pack now labels fixtures as:

- `golden`
- `noisy`
- `low-signal`
- `malicious`

and can declare:

- assertion score threshold
- confidence floor
- pack tags for later release-gate wiring

This keeps skill tuning and future provider promotion grounded in fixed local examples without
changing the default runtime path.

The security-pack benchmark inputs live in
`packages/extension/src/runtime/agent/benchmark-fixtures.ts` and feed the release-gate entrypoint
`runAgentProviderReleaseGate()` from
`packages/extension/src/runtime/agent/release-gates.ts`.

That gate currently checks whether a provider is:

- benchmarked across the three priority skills
- traced locally during the gate run
- clean on the malicious fixture pack
- fallback-safe when unavailable

### Feature-Flagged Promotion

The first promotion slice stays narrow. Coop can now persist a local WebLLM promotion decision via
`activateWebLlmProviderPromotion()` in
`packages/extension/src/runtime/agent/provider-promotion.ts`.

That helper runs the WebLLM release gate, stores the resulting signoff in the existing settings
store, and only marks the path active when WebLLM is:

- benchmarked
- traced
- schema-stable
- malicious-pack clean
- fallback-safe

Runtime use of that promotion is still off by default. The promoted path is only honored when
`VITE_COOP_ENABLE_WEBLLM_PROMOTION=true`, and even then only for the benchmarked extraction skills
that still default to `transformers` today. If the gate state is missing or fails, the legacy
provider preference remains in place.

The runtime now also exposes that state through the existing agent dashboard/message layer:

- `get-agent-dashboard` includes the current `providerPromotion.webllm` state for operator-facing
  consumers
- `get-webllm-provider-promotion-state` returns the stored local activation record
- `activate-webllm-provider-promotion` runs the gated activation path from the background runtime

When `VITE_COOP_ENABLE_WEBLLM_PROMOTION=true`, the Nest agent console also shows the stored WebLLM
promotion state and lets trusted operators re-run the local gate without changing the default
provider path.

That operator view now includes the exact benchmark records and security traces captured by the
stored promotion run, keyed from the local promotion state rather than guessed from whatever
records happen to be newest.

## Skill System

### Executable Skills (16 registered)

Each skill is a directory containing a `skill.json` manifest and `SKILL.md` instruction file:

```
packages/extension/src/skills/
├── opportunity-extractor/      # Extract funding/opportunity signals
├── grant-fit-scorer/           # Score grant fit (depends: opportunity-extractor)
├── capital-formation-brief/    # Synthesize funding brief (depends: grant-fit-scorer)
├── review-digest/              # Weekly review synthesis
├── ecosystem-entity-extractor/ # Identify organizations, bioregions, networks
├── theme-clusterer/            # Group related signals into themes
├── publish-readiness-check/    # Validate draft quality before publish
├── green-goods-garden-bootstrap/
├── green-goods-garden-sync/
├── green-goods-work-approval/
├── green-goods-assessment/
├── green-goods-gap-admin-sync/
├── memory-insight-synthesizer/
├── tab-router/
├── erc8004-register/           # Register skills on-chain (ERC-8004)
└── erc8004-feedback/            # On-chain agent feedback (ERC-8004)
```

**Manifest fields:**

```json
{
  "id": "grant-fit-scorer",
  "version": "0.1.0",
  "description": "Score candidates against coop purpose and tags",
  "model": "transformers",
  "triggers": ["high-confidence-draft", "receiver-backlog"],
  "outputSchemaRef": "grant-fit-scorer-output",
  "approvalMode": "advisory",
  "timeoutMs": 30000,
  "depends": ["opportunity-extractor"],
  "skipWhen": "no-candidates",
  "provides": ["scores"]
}
```

### Skill DAG

Skills declare dependencies via the `depends` field. The harness topologically sorts them using Kahn's algorithm with alphabetical tie-breaking. Cycles are detected at build time.

```
opportunity-extractor ──▶ grant-fit-scorer ──▶ capital-formation-brief
         │
         └── provides: candidates    provides: scores    provides: drafts
```

Skills with `skipWhen` conditions are evaluated before execution. If `skipWhen: "no-candidates"` and the context has zero candidates, the skill is skipped with status `'skipped'`, incurring no inference cost.

### Knowledge Skills (SKILL.md Protocol)

The agent can import external knowledge from any URL following the SKILL.md convention (YAML frontmatter + markdown body). Knowledge skills inject domain expertise into the prompt context for all executable skills.

```
┌─────────────────────────────────────────┐
│  https://ethskills.com/gas/SKILL.md     │
│                                         │
│  ---                                    │
│  name: gas                              │
│  description: Current Ethereum gas...   │
│  ---                                    │
│                                         │
│  ## What You Probably Got Wrong          │
│  Ethereum L1 gas is 0.05-0.3 gwei...    │
└─────────────────────────────────────────┘
         │
         ▼  fetch + parse + cache in Dexie
         │
   ┌─────────────┐
   │ Knowledge    │  triggerPatterns: ["gas", "L2", "transaction cost"]
   │ Skill record │  domain: "ethereum"
   │ (IndexedDB)  │  enabled: true (global, per-coop overrides)
   └─────────────┘
         │
         ▼  selectKnowledgeSkills(observation, coopId)
         │
   Injected into every skill prompt as "Domain knowledge" section
```

**Discovery:** ETHSkills and similar projects use a root `SKILL.md` as a table of contents linking to sub-skills. The `discoverSkillIndex()` function parses this index and lets users selectively import sub-skills.

**Scope:** Knowledge skills are imported globally. Each coop can override the enable/disable state per-skill via `CoopKnowledgeSkillOverride`.

**Release note:** remote knowledge-skill import remains quarantined from the shipped Chrome Web
Store-compliant build. Treat this section as a description of the harness capability in the repo,
not a claim that arbitrary remote `SKILL.md` import is enabled in public distribution.

## Observability

### Structured Logging

Every agent cycle produces a trace with correlated spans:

```
Trace: agent-trace-abc123
├── Span: cycle (info): "Agent cycle started with 3 pending observations"
├── Span: observation (info): "Processing observation: high-confidence-draft"
│   ├── Span: skill (info): "Skill started: opportunity-extractor (transformers)"
│   ├── Span: skill (info): "Skill completed: opportunity-extractor in 1,230ms"
│   ├── Span: skill (info): "Skill skipped: grant-fit-scorer"
│   └── Span: action (info): "Action dispatched: publish-ready-draft (auto-executed)"
├── Span: observation (info): "Observation dismissed: Source draft no longer exists"
└── Span: cycle (info): "Agent cycle completed: 2 processed, 0 errors"
```

Logs are stored in the `agentLogs` Dexie table with span type, level, skill ID, observation ID, and arbitrary data payload (provider, model, duration, tokens).

### Skill Trace Records

In addition to span logs, each executed skill attempt now writes a local-only
`agentTraceRecords` row. These records are meant for debugging, provider comparison, and later
promotion logic without storing raw prompt or model output by default.

Each trace record captures:

- the cycle `traceId`, `observationId`, `skillId`, `providerId`, and resolved `modelId`
- a hashed `promptHash`
- a short `contextInventory` and estimated `contextBudgetTokens`
- `sourceRisk` classified as `trusted`, `mixed`, or `untrusted`
- `durationMs`, `repairSteps`, `validationErrors`, `confidenceScore`, and trace `outcome`
- a hashed `rawOutputHash` instead of persisted raw output content

The runtime persists trace rows from
`packages/extension/src/runtime/agent/runner-skills.ts` through
`packages/extension/src/runtime/agent/trace-records.ts`.

### Stall Detection

If an observation fails 3+ consecutive times (across separate cycles), it is marked `'stalled'` instead of retried. This prevents infinite retry loops and surfaces problematic observations in the operator console.

### Cycle Metrics

Each `AgentCycleResult` includes:
- `traceId`: correlates to structured log spans
- `totalDurationMs`: wall-clock time for the entire cycle
- `skillRunMetrics[]`: per-skill breakdown (provider, durationMs, retryCount, skipped)

## Human-in-the-Loop

The agent never acts without authorization. Three approval tiers:

| Mode | Behavior | Example Skills |
|------|----------|----------------|
| `advisory` | Output recorded, no action proposed | opportunity-extractor, tab-router, review-digest |
| `proposal` | Action queued for human approval in operator console | publish-readiness-check, green-goods-work-approval, green-goods-assessment |
| `auto-run-eligible` | Executes automatically if user enables auto-run for that skill | green-goods-garden-bootstrap, green-goods-garden-sync, erc8004-register |

Auto-run is opt-in per skill via the `autoRunSkillIds` setting. Users toggle individual skills in the operator console.

## Web Primitives Used

The harness is built entirely on browser-native APIs, with no server dependencies for core operation:

| Capability | Web Primitive | How Used |
|-----------|---------------|----------|
| Local persistence | IndexedDB (via Dexie) | Observations, plans, skill runs, knowledge skills, agent logs |
| LLM inference | WebGPU / WebAssembly | WebLLM (WebGPU), transformers.js (WASM) |
| Background execution | MV3 Service Worker | Agent cycle polling, observation emission |
| Worker threads | Web Workers | WebLLM engine runs in dedicated worker |
| Peer sync | WebRTC (via y-webrtc) | Coop state sync between browser instances |
| CRDT consistency | Yjs | Conflict-free shared state |
| Offline storage | Cache API / IndexedDB | Model weights cached in browser |
| Structured data | Blob / ArrayBuffer | ONNX model shards, embedding vectors |

## Optimization Opportunities

### Near-Term

**Progressive model loading**: Detect WebGPU availability and auto-select larger models (3B+) when GPU is present. The inference layer already cascades; adding a capability tier that maps to model IDs is straightforward.

**Per-skill token limits**: The `maxTokens` manifest field is defined but not yet wired. Extraction skills (opportunity-extractor) need fewer tokens than synthesis skills (capital-formation-brief). Tuning per-skill reduces inference time.

**Parallel skill execution**: Skills with no dependency relationship could run concurrently. The topological sort already identifies independent skills; the runner just needs to `Promise.all()` groups at the same DAG level instead of executing sequentially.

### Medium-Term

**Semantic memory**: In-browser embeddings via `all-MiniLM-L6-v2` (384-dim, ~23MB, runs on WASM). Store embeddings in Dexie alongside drafts and observations. Replace the naive `relatedDrafts.slice(0, 4)` with cosine similarity search for context-aware prompt building.

**Output handler extraction**: The 600+ line switch on `outputSchemaRef` in `agent-runner.ts` should be split into a handler registry (`agent-output-handlers.ts` types are defined). Each handler becomes a focused function, making it trivial to add new skill types.

**Reflection bank**: Store `(bad_output, error, corrected_output)` triples. Use the most relevant failure as a negative example in future prompts. Small models can't self-correct, but they can learn from external examples.

### Long-Term

**P2P agent coordination**: Each browser runs its own agent independently. Add CRDT-backed observation claims to the Yjs doc so peers don't duplicate work. The fingerprinting system already provides deterministic dedup; extend it across peers.

**Pluggable executable skills**: External skills with sandboxed execution (iframe/worker), open output schemas, and a trust model (untrusted → verified → trusted). The knowledge skill infrastructure provides the loading pattern; executable skills need schema registration and sandboxing.

**Larger models via WebGPU**: As WebGPU support matures and quantization improves, 3B-7B models become viable in-browser. The model tier system is designed for this upgrade path. Key models to watch: Qwen2.5-3B, Phi-3.5-mini, Gemma-2B.

**In-browser embedding search**: HNSW in WASM (`hnswlib-wasm`) for scaled vector search when document counts exceed brute-force cosine similarity thresholds (~5,000+ embeddings).

## Key Files

| File | Lines | Role |
|------|-------|------|
| `extension/src/runtime/agent-runner.ts` | ~1,500 | Main cycle loop, observation plans, action dispatch |
| `extension/src/runtime/agent-models.ts` | ~440 | Inference: WebLLM → transformers.js → heuristic |
| `extension/src/runtime/agent-harness.ts` | ~170 | Topological sort, skip conditions, visibility filtering |
| `extension/src/runtime/agent-knowledge.ts` | ~260 | External SKILL.md fetch, parse, route, cache |
| `extension/src/runtime/agent-logger.ts` | ~180 | Structured trace logging |
| `extension/src/runtime/agent-registry.ts` | ~70 | Build-time skill manifest loading |
| `extension/src/runtime/agent-config.ts` | ~30 | Thresholds, timeouts, cycle state |
| `extension/src/runtime/agent-webllm-bridge.ts` | ~120 | WebLLM worker bridge |
| `shared/src/modules/agent/agent.ts` | ~430 | Domain model: observations, plans, skills, drafts |
| `shared/src/contracts/schema.ts` | | Zod schemas for all agent types |
| `shared/src/modules/storage/db.ts` | | Dexie tables + CRUD for agent state |
| `extension/src/skills/*/skill.json` | | 16 skill manifests with dependency graph |

## Design Principles

1. **Zero cloud dependency**: Inference, storage, and sync all run in-browser. No API keys required for core operation.
2. **Graceful degradation**: Three inference tiers ensure the agent always works, even on low-end hardware without WebGPU.
3. **Human authority**: The agent proposes, humans decide. Auto-run is opt-in per skill, never default.
4. **Deterministic when possible**: Topological sort, fingerprint dedup, and heuristic fallbacks are all deterministic. Nondeterminism is isolated to LLM inference.
5. **Observable by default**: Every cycle, observation, skill run, and action dispatch produces structured log spans.
6. **Extensible via convention**: Skills are directories with `skill.json` + `SKILL.md`. Knowledge skills follow the same SKILL.md format used by ETHSkills, Anthropic, and OpenClaw.
