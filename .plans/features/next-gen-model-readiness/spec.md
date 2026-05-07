# Next-Gen Model Readiness

**Status**: Active
**Created**: 2026-04-02
**Updated**: 2026-05-07
**Motivation**: Prepare Coop's agentic development flow and in-browser agent pipeline for next-generation models (larger context, stronger reasoning, autonomous planning). Based on a four-axis audit: prompt scaffolding, agent pipeline, eval pipeline, and multi-agent coordination.

## Problem Statement

The codebase has accumulated ~8,500 lines of prompt scaffolding (55% procedural/hardcoded domain knowledge), ~3,500 lines of agent pipeline orchestration compensating for a 0.5B model, 67 validation suites where 8 would suffice, and a development coordination system with static lane assignments designed around current model limitations. As models get dramatically smarter, this complexity becomes counterproductive — it over-constrains the model and wastes context window tokens on information the model already knows or can derive.

## Thesis (The Bitter Lesson)

As models improve, simpler works best. Specify **outcomes and constraints**, not step-by-step processes. Let the model decide how to achieve the goal. Our job is to:
1. Define clear outcomes
2. Provide well-described tools
3. Set constraints and guardrails (business rules that survive model upgrades)
4. Build comprehensive eval gates
5. Get out of the way

## Harness Guardrail

The prompt surface should shrink, but deterministic harness boundaries should not. The Claude Code
design-space paper sharpens the line: soft instructions can be simplified aggressively; permission,
sandbox, validation, eval, trace, and recovery gates must stay executable and inspectable outside the
model prompt.

For every Phase 1 deletion or rewrite, classify the removed material before landing the change:

| Classification | Meaning | Required action |
|---|---|---|
| `deterministic-gate` | Enforced by code, hook, schema, validator, permission rule, or test | Keep or move to the executable gate; do not leave it as prompt prose only |
| `repo-constraint` | Coop-specific behavior that agents must know but code cannot fully enforce | Keep once in the canonical repo instruction surface |
| `product-intent` | Non-derivable product direction, voice, trust posture, or user promise | Preserve in product context or a short pointer |
| `soft-guidance` | Generic method, library knowledge, static map, or procedural walkthrough | Remove or replace with a source pointer |

No simplification pass is complete until it proves that every removed `deterministic-gate`,
`repo-constraint`, and `product-intent` still has a durable home.

## Workflow Continuity Rule

Model routing is an internal runtime decision, not the user-facing product. The stable user promise
is the work loop: capture useful context, refine it locally, review what matters, and explicitly
share or publish approved outputs. Stronger, cheaper, local, or experimental providers may handle
different steps, but the workflow identity, memory contract, approval gates, and trace evidence must
survive provider churn.

Provider/model names belong in advanced diagnostics, benchmark evidence, and promotion gates. Simple
mode should show task state, source/provenance, confidence, and next action in plain language.

## Phases

### Phase 1: Simplify the Prompt Surface
**Goal**: Reduce ~8,500 lines to ~3,000 lines by removing library documentation, static code maps, procedural recipes, and duplicated constraints. Keep outcomes, constraints, anti-patterns, and product intent.

**Impact**: Every conversation starts with less noise. Models spend tokens on the task, not on reading Vitest API docs they already know.

**Gate**: Each removed instruction is classified using the Harness Guardrail table above. Deterministic
gates must remain executable, not merely rewritten as shorter prompt text.

### Phase 2: Consolidate the Eval Pipeline
**Goal**: Replace 67 validation suites with a clear hierarchy: fast iteration tiers for developers + one comprehensive release gate. Extract duplicated E2E helpers.

**Impact**: A model building autonomously runs ONE command and gets a binary pass/fail. No human needed to choose which of 67 suites to run.

### Phase 3: Prepare the Agent Pipeline for Model Upgrade
**Goal**: Introduce a "capable model" code path alongside the 0.5B path. Define tools from deterministic skills. Collapse output handlers into generic tools. Feature-flag via `VITE_COOP_AGENT_MODE`.

**Impact**: When a stronger model becomes available (WebGPU, cloud API, or larger local model), we
can route suitable steps through it without changing the user's mental model or weakening approval,
memory, trace, and fallback boundaries.

### Phase 4: Close the Development Agent Dispatch Loop
**Goal**: Add structured output to `plans.ts` queue/reconcile commands. Build a dispatch loop. Make lane assignment dynamic.

**Impact**: The development agent can self-organize work instead of following static Claude=UI/Codex=state assignments.

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Keep product.md context file intact | Non-derivable product intent — the model can't infer brand vision from code |
| 2 | Reduce skills to constraint cards (30-50 lines) | Library API docs (Vitest, React, Dexie) are model knowledge; only Coop-specific constraints add value |
| 3 | Replace context code maps with file pointers | The model can read source files; static maps go stale and waste tokens |
| 4 | Keep observation lifecycle (Layer 2) intact | Audit trails, approval gates, and deduplication are model-agnostic infrastructure |
| 5 | Feature-flag the autonomous agent path | Preserves the working 0.5B pipeline while enabling the new path for capable models |
| 6 | Keep fast iteration tiers (typecheck, quick, smoke) | These serve human developers, not model eval — different purpose than the release gate |
| 7 | Consolidate E2E helpers before changing test structure | Reduces duplication risk and simplifies future test changes |
| 8 | State each constraint once, in one canonical location | The barrel import rule appears in 5+ places — deduplication reduces drift |
| 9 | Convert deterministic skills to tool definitions | Green Goods/ERC-8004 skills never use the model — they're already tools wearing skill costumes |
| 10 | Make lane assignment dynamic in Phase 4 | Static Claude=UI/Codex=state split is compensatory — a capable planner handles both |
| 11 | Preserve deterministic harness gates while shrinking prompts | Stronger models benefit from less scaffolding, but authority, safety, eval, and recovery must stay outside probabilistic prompt compliance |
| 12 | Keep model routing internal and workflow continuity user-facing | Coop should survive provider churn by keeping memory, approval, trace, and fallback contracts stable while hiding routing details from simple mode |

## Execution Order

```
Phase 1 (prompt surface)     ─── no code dependencies, can start immediately
Phase 2 (eval pipeline)      ─── no code dependencies, can run parallel with Phase 1
Phase 3 (agent pipeline)     ─── depends on understanding from Phase 1 context cleanup
Phase 4 (dev dispatch)       ─── depends on Phase 2 eval consolidation + Phase 3 tool definitions
```

Phases 1 and 2 are fully independent and can execute in parallel.
Phase 3 can begin once Phase 1 context cleanup clarifies the constraint surface.
Phase 4 builds on Phases 2 and 3.

## Success Criteria

| Metric | Before | Target |
|--------|--------|--------|
| Prompt surface (lines) | ~8,500 | ~3,000 |
| Skill file avg size | ~315 lines | ~40 lines |
| Context file total | 1,077 lines | ~120 lines |
| Validation suite count in release gate | 19 steps | 8 steps |
| E2E helper duplication | 4 helpers x 7 files | 1 shared module |
| Agent pipeline orchestration (Layer 1) | ~3,500 lines | ~800 lines (tool defs + routing) |
| Constraint duplication | 5+ locations per rule | 1 canonical location |
| Dev agent dispatch | Manual queue → execute | Structured queue → auto-dispatch |
| Harness guardrail audit | Not explicit | Every Phase 1 deletion classified; no deterministic gate moved into prompt-only guidance |
| Model routing UX | Provider details leak into operator surfaces | Simple mode shows workflow state and provenance; provider details stay in advanced diagnostics |

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Removing a constraint that actually matters | Medium | Each removal verified against test suite; constraints backed by hooks survive regardless |
| Demoting executable safety/eval behavior into shorter prompt prose | High | Classify deleted guidance first; deterministic gates must remain in code, hooks, schemas, validators, or tests |
| Breaking agent pipeline during refactor | High | Feature flag (`VITE_COOP_AGENT_MODE=legacy\|autonomous`); legacy path unchanged |
| E2E test interference when consolidated | Medium | Run full E2E suite before and after consolidation; keep per-spec isolation via Playwright projects |
| Skill simplification loses Coop-specific nuance | Low | Each skill reviewed individually; anti-patterns extracted before deletion |
| Plans.ts dispatch loop complexity | Medium | Phase 4 is incremental — structured output first, dispatch loop second |
