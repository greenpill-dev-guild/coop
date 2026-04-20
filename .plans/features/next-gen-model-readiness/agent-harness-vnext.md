# Coop Agent Harness vNext

**Status**: Draft  
**Created**: 2026-04-18  
**Feature Pack**: `next-gen-model-readiness`

## Goal

Evolve Coop's browser-local agent harness from a fixed small-model skill pipeline into a
provider-portable, eval-driven, traceable, security-gated system. The target is not a
generic agent platform. The target is a stronger local harness for Coop's actual loop:
capture, refine, review, and propose.

## Operating Stance

- Keep the browser-first, local-first, human-approval model.
- Optimize small, measurable surfaces; do not introduce a swarm-first architecture.
- Prefer outcome and constraint prompts over procedural scaffolding.
- Keep the current legacy path working while adding the vNext path behind capability gates.

## Workstream 1: Provider Matrix

### Objective

Turn model choice into an explicit runtime policy instead of a hardcoded implementation detail.

### Target Matrix

| Tier | Provider | Runtime Context | Role | Ship Bar |
|------|----------|-----------------|------|----------|
| P0 | Heuristic fallback | Any browser | Safety net, deterministic fallback | Always available |
| P1 | Transformers.js WASM small model | Low-capability devices, CI-like environments | Baseline structured extraction | Current baseline |
| P2 | WebLLM WebGPU | Higher-capability desktops | Better local reasoning for high-value skills | Must beat P1 on eval score and valid-output rate |
| P3 | Chrome Prompt API | Extension/offscreen document only, supported Chrome builds | Browser-managed local model path | Must pass capability checks and fallback cleanly |

### Concrete Deliverables

1. Introduce a common provider contract with capability metadata:
   - `structuredJson`
   - `workerSafe`
   - `offscreenSafe`
   - `requiresWebGpu`
   - `supportsStreaming`
   - `supportsMultimodal`
2. Add a provider benchmark harness for three core skills:
   - tab/opportunity routing
   - opportunity extraction
   - capital formation brief
3. Record promotion metrics per provider/model:
   - schema pass rate
   - repair rate
   - median latency
   - cold start time
   - confidence score
   - unavailable/fallback behavior

### Notes

- Chrome Prompt API is promising, but it must be treated as an extension-page/offscreen path, not a service-worker path.
- Gemma-class WebGPU models are candidates for P2, not defaults, until they clear the benchmark bar.

## Workstream 2: Eval Strategy

### Objective

Make "better" concrete enough that Coop can tune skills, promote providers, and reject regressions.

### Eval Layers

| Layer | Editable Surface | Metric | Budget |
|-------|------------------|--------|--------|
| Skill quality | `SKILL.md` + fixture pack | Composite eval score + approval signal | 10-20 min per experiment cycle |
| Provider promotion | Provider adapter/config only | Valid structured output rate + latency + composite score | Fixed benchmark run |
| Security regression | Prompt builder, sanitization, policy gates | Safe-fail rate on malicious fixtures | Fixed benchmark run |

### Eval Pack Design

Each core skill pack should include:

- 3-5 golden fixtures from real Coop flows
- noisy fixtures
- low-signal fixtures
- malicious prompt-injection fixtures
- expected schema assertions
- semantic assertions
- confidence floor

### Promotion Rule

No prompt variant or provider gets promoted unless it:

1. passes schema validation,
2. improves or matches baseline composite score,
3. does not regress the malicious fixture pack,
4. preserves graceful fallback behavior.

## Workstream 3: Trace Schema

### Objective

Capture enough local telemetry to support debugging, review, and future auto-optimization without turning Coop into a surveillance product.

### Required Trace Record

```ts
AgentTraceRecord {
  traceId: string
  observationId: string
  skillId: string
  providerId: string
  modelId: string
  promptHash: string
  contextInventory: string[]
  contextBudgetTokens?: number
  sourceRisk: 'trusted' | 'mixed' | 'untrusted'
  startedAt: number
  durationMs: number
  rawOutputHash?: string
  repairSteps: string[]
  validationErrors: string[]
  confidenceScore?: number
  evalScore?: number
  outcome: 'completed' | 'fallback' | 'rejected' | 'failed'
  userOutcome?: 'approved' | 'rejected' | 'dismissed'
}
```

### Storage Rules

- Local-only by default
- Hash raw model output by default; do not persist full sensitive content unless explicitly enabled for operator debugging
- Keep short source excerpts only when needed for repro
- Make exports intentional and operator-visible

### Immediate Use

This trace schema is the bridge between:

- live debugging,
- provider benchmarking,
- skill autoresearch,
- post-hoc security review.

## Workstream 4: Security Gates

### Objective

Make provider upgrades and higher autonomy impossible without passing explicit trust boundaries.

### Required Gates

1. **Untrusted Content Gate**
   - Captured page content is evidence, not instruction.
   - Untrusted content cannot override tool policy, approval policy, or system intent.

2. **Structured Output Gate**
   - A provider cannot be promoted if it cannot reliably return schema-valid outputs or safe fallback behavior.

3. **Action Gate**
   - Auto-run remains allowlist-only by skill/action pair.
   - Any action with publish, sync, identity, or onchain side effects stays proposal-first unless explicitly elevated.

4. **Prompt Injection Gate**
   - Every release candidate must pass malicious fixture packs covering:
     - instruction override attempts
     - data exfiltration attempts
     - fake system prompts in captured content
     - noisy long-context poisoning

5. **Privacy Gate**
   - New traces, providers, or eval exports cannot widen data exposure silently.
   - Sensitive raw content stays local and opt-in.

### Release Rule

No new provider path ships as default unless all four are true:

- benchmarked,
- traced,
- malicious-pack clean,
- fallback-safe.

## Execution Order

1. Provider contract + benchmark harness
2. Trace schema + local storage rules
3. Core eval packs for three priority skills
4. Security fixture pack + release gate wiring
5. Promote one new provider path behind a feature flag

## Definition of Done

The vNext harness is ready when Coop can:

- compare provider tiers with a single benchmark run,
- explain why one output was accepted or rejected,
- tune a skill against fixed eval packs,
- reject prompt-injection regressions before release,
- and fall back safely when a higher-capability provider is unavailable.
