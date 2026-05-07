# Next-Gen Model Readiness — Context

## Source Material

Analysis based on Nate B Jones transcript re: Claude Mythos and four parallel audit agents covering:
1. Prompt scaffolding classification (outcome/constraint/procedural/hardcoded)
2. Agent skill pipeline layer decomposition
3. Validation pipeline redundancy analysis
4. Multi-agent coordination overhead assessment

Additional source: "Dive into Claude Code: The Design Space of Today's and Future AI Agent
Systems" (arXiv:2604.14228v1). The relevant takeaway is not to copy Claude Code wholesale; it is
to preserve deterministic harness boundaries while simplifying model-facing scaffolding.

## Harness Guardrail Classification

Use this table during Phase 1 cleanup before removing or rewriting prompt/context material.

| Classification | Examples in this repo | Where it must live |
|---|---|---|
| `deterministic-gate` | permission checks, deny/allow rules, hook enforcement, schema validation, `bun run test` enforcement, release gates | Code, hook config, schemas, validators, tests, or `scripts/validate.ts` |
| `repo-constraint` | barrel imports, root `.env.local`, no Dexie access from views, MV3 service-worker constraints | One canonical repo instruction or rule file |
| `product-intent` | local-first, passkey-first, explicit publish, community/project framing, friendly non-console UX | `CLAUDE.md`, product context, or current plan spec |
| `soft-guidance` | library tutorials, static file maps, generic debugging recipes, boilerplate test snippets | Remove or replace with file pointers |

If a cleanup step touches a `deterministic-gate`, the implementation note must name the executable
surface that still enforces it after the prose is removed.

## Key Files by Phase

### Phase 1: Prompt Surface

| File | Lines | Action |
|------|-------|--------|
| `.claude/context/app.md` | 163 | Replace with ~15-line pointer file |
| `.claude/context/extension.md` | 466 | Replace with ~15-line pointer file |
| `.claude/context/shared.md` | 448 | Replace with ~15-line pointer file |
| `.claude/context/product.md` | 196 | **Keep as-is** (non-derivable intent) |
| `.claude/skills/security/SKILL.md` | 620 | Reduce to ~50-line constraint card |
| `.claude/skills/audit/SKILL.md` | 423 | Reduce to ~40-line constraint card |
| `.claude/skills/data-layer/SKILL.md` | 411 | Reduce to ~40-line constraint card |
| `.claude/skills/performance/SKILL.md` | 389 | Reduce to ~30-line constraint card |
| `.claude/skills/react/SKILL.md` | 381 | Reduce to ~30-line constraint card |
| `.claude/skills/testing/SKILL.md` | 346 | Reduce to ~40-line constraint card |
| `.claude/skills/debug/SKILL.md` | 339 | Reduce to ~40-line constraint card |
| `.claude/skills/plan/SKILL.md` | 340 | Reduce to ~40-line constraint card |
| `.claude/skills/ui-compliance/SKILL.md` | 328 | Reduce to ~30-line constraint card |
| `.claude/skills/web3/SKILL.md` | 266 | Reduce to ~30-line constraint card |
| `.claude/skills/error-handling-patterns/SKILL.md` | 218 | Reduce to ~30-line constraint card |
| `.claude/skills/commit/SKILL.md` | 104 | Reduce to ~20-line constraint card |
| `.claude/skills/monitor/SKILL.md` | 157 | Reduce to ~30-line constraint card |
| `.claude/skills/index.md` | 238 | **Delete** (meta-documentation) |
| `.claude/rules/tests.md` | 295 | Reduce to ~80 lines (constraints only) |
| `CLAUDE.md` | 308 | Remove ~120 lines (module listing, procedural sections) |

### Phase 2: Eval Pipeline

| File | Lines | Action |
|------|-------|--------|
| `scripts/validate.ts` | 568 | Add `release` composite suite (8 flat steps) |
| `package.json` (lines 48-68) | ~20 | Keep `unit:*` scripts for dev use; remove from release gate |
| `e2e/app.spec.cjs` | varies | Extract helpers to shared module |
| `e2e/extension.spec.cjs` | varies | Extract helpers to shared module |
| `e2e/popup-actions.spec.cjs` | varies | Extract helpers to shared module |
| `e2e/receiver-sync.spec.cjs` | varies | Extract helpers to shared module |
| `e2e/sync-resilience.spec.cjs` | varies | Extract helpers to shared module |
| `e2e/visual-popup.spec.cjs` | varies | Extract helpers to shared module |
| `e2e/visual-sidepanel.spec.cjs` | varies | Extract helpers to shared module |
| `e2e/member-account-live.spec.cjs` | varies | Extract helpers to shared module |

**Duplicated helpers to extract:**
- `withTimeout(promise, ms, label)` — 7 files
- `isBenignCloseError(error)` — 7 files
- `isTransientNavigationError(error)` — 3 files
- `gotoWithRetry(page, url, options)` — 3 files
- `closeContextSafely(context, timeout?)` — varies
- `escapeRegExp(string)` — 1 file

### Phase 3: Agent Pipeline

**Layer 1 — Collapse (orchestration scaffolding):**

| File | Lines | Action |
|------|-------|--------|
| `packages/extension/src/runtime/agent-runner-skills.ts` | 1,565 | Extract tool defs; simplify to model-agnostic dispatch |
| `packages/extension/src/runtime/agent-output-handlers.ts` | 905 | Collapse 16 handlers into ~4 generic tools |
| `packages/extension/src/runtime/agent-models.ts` | 735 | Keep as legacy path; new path uses capable model directly |
| `packages/extension/src/runtime/agent-quality.ts` | 223 | Keep for legacy; autonomous path self-evaluates |
| `packages/extension/src/runtime/agent-harness.ts` | 275 | Keep topological sort; autonomous path skips hardcoded chains |
| `packages/extension/src/runtime/agent-runner-inference.ts` | 143 | Legacy only; autonomous path doesn't need heuristic inference |
| `packages/extension/src/runtime/agent-eval.ts` | 296 | Keep evaluation framework; simplify for autonomous path |

**Layer 2 — Keep (model-agnostic infrastructure):**

| File | Lines | Action |
|------|-------|--------|
| `packages/extension/src/background/handlers/agent-observation-conditions.ts` | 404 | Keep — genuine business logic |
| `packages/extension/src/background/handlers/agent-reconciliation.ts` | 232 | Keep — garbage collection |
| `packages/extension/src/background/handlers/agent-cycle-helpers.ts` | 83 | Keep — cycle state management |
| `packages/extension/src/background/handlers/agent-observation-emitters.ts` | 105 | Keep — event-driven observation creation |
| `packages/extension/src/background/handlers/agent-plan-executor.ts` | 52 | Keep — approval gate |
| `packages/shared/src/modules/agent/agent.ts` | ~330 | Keep — factory functions, schemas |
| `packages/shared/src/modules/agent/memory.ts` | ~235 | Keep — memory system |
| `packages/extension/src/runtime/agent-runner.ts` | 349 | Modify — add autonomous path branch |

**Layer 3 — Convert to tools (deterministic skills):**

| Skill | Current Form | Tool Name |
|-------|-------------|-----------|
| green-goods-garden-bootstrap | Heuristic skill | `bootstrap_garden(profile, domain)` |
| green-goods-garden-sync | Heuristic skill | `sync_garden(greenGoods, coopState)` |
| green-goods-work-approval | Heuristic skill | `approve_work(submission, gardenState)` |
| green-goods-assessment | Heuristic skill | `assess_impact(gardenData, submissions)` |
| green-goods-gap-admin-sync | Heuristic skill | `sync_gap_admin(coop, desiredAddresses)` |
| erc8004-register | Heuristic skill | `register_agent_identity(safe, agentManifest)` |
| erc8004-feedback | Heuristic skill | `submit_agent_feedback(agentId, feedback)` |

### Phase 4: Dev Dispatch

| File | Lines | Action |
|------|-------|--------|
| `scripts/plans.ts` | 400+ | Add `--json` flag to queue/reconcile; build dispatch loop |

## Constraint Deduplication Map

Constraints that appear in multiple locations (target: 1 canonical location each):

| Constraint | Current Locations | Canonical Home |
|-----------|-------------------|----------------|
| Barrel imports only (`@coop/shared`) | CLAUDE.md, context/app.md, context/shared.md, agents/code-reviewer.md, agents/cracked-coder.md | CLAUDE.md "Key Patterns" |
| `bun run test` not `bun test` | CLAUDE.md, rules/tests.md, hooks (settings.json) | CLAUDE.md "Commands" + hook enforcement |
| Never create hooks in shared | rules/shared.md, context/shared.md | rules/shared.md |
| Local-first, passkey-first principles | CLAUDE.md, context/product.md | CLAUDE.md "Key Principles" |
| Single `.env.local` at root | CLAUDE.md, hook enforcement | CLAUDE.md "Environment" + hook enforcement |
| Never use `Date.now()` for timestamps | rules/shared.md, context/shared.md | rules/shared.md |
| Never play sounds in service worker | rules/extension.md, context/extension.md | rules/extension.md |

## Agent Pipeline Architecture Reference

**Current flow (0.5B model, hardcoded pipeline):**
```
Observation → Trigger matching → Skill selection (topological sort) →
Per-skill execution (model → JSON repair → heuristic fallback → quality score) →
Output handler (per-schema dispatch) → Action proposal / draft creation
```

**Target flow (capable model, autonomous):**
```
Observation → Context assembly (coop state + memory + tool descriptions) →
Model plans and executes (calls tools as needed) →
Output validation (Zod schemas) → Approval gate → Action dispatch
```

The state machine (observation lifecycle, plan approval, skill run tracking) wraps both flows identically.
