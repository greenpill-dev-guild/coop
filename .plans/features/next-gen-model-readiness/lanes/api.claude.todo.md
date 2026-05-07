---
feature: next-gen-model-readiness
title: Prepare agent pipeline for model upgrade
lane: api
agent: claude
status: ready
source_branch: main
work_branch: feature/agent-pipeline-model-upgrade
depends_on:
  - ../spec.md
  - docs.claude.todo.md
owned_paths:
  - packages/extension/src/runtime/
  - packages/extension/src/skills/
  - packages/extension/src/background/handlers/agent-output-handlers.ts
  - packages/shared/src/modules/agent/
done_when:
  - VITE_COOP_AGENT_MODE
  - AgentToolDefinition
  - runAutonomousAgentCycle
skills:
  - architecture
  - testing
updated: 2026-05-07
---

# Phase 3: Prepare the Agent Pipeline for Model Upgrade

Target: Introduce a "capable model" code path alongside the 0.5B legacy path. Define tools from deterministic skills. Collapse output handlers into generic tools. Feature-flagged via `VITE_COOP_AGENT_MODE`.

**Principle**: The legacy path (0.5B + heuristic fallbacks) continues working unchanged. The
autonomous path is additive — same observation lifecycle, same approval gates, same memory system,
same trace evidence, same fallback semantics, different execution strategy. Model routing remains
internal runtime evidence; simple mode should not become a provider-management surface.

## Step 1: Add `VITE_COOP_AGENT_MODE` environment variable

Add to config:
- `packages/extension/src/runtime/config.ts` — read `import.meta.env.VITE_COOP_AGENT_MODE`
- `.env.local` defaults — `VITE_COOP_AGENT_MODE=legacy` (no behavior change)
- `CLAUDE.md` environment section — document the flag
- `docs/builder/environment.md` — add to full reference

Values: `legacy` (default, current 0.5B pipeline) | `autonomous` (capable model path)

**Verify**: `bun run validate typecheck` passes. Default behavior unchanged.

## Step 2: Define the tool interface type

Create `packages/shared/src/modules/agent/tools.ts`:

```typescript
export interface AgentToolDefinition {
  id: string;
  name: string;
  description: string;
  inputSchema: ZodSchema;
  outputSchema: ZodSchema;
  execute: (input: unknown) => Promise<unknown>;
  /** Whether this tool can trigger onchain actions requiring approval */
  requiresApproval: boolean;
}
```

Export from `@coop/shared` barrel.

**Verify**: `bun run validate typecheck` passes.

## Step 3: Convert deterministic skills to tool definitions

For each of the 7 heuristic-only skills, extract the deterministic logic into a tool definition:

- [ ] `green-goods-garden-bootstrap` → `bootstrapGardenTool`
  - Input: profile data, domain config
  - Output: garden bootstrap action payload
  - Source: `agent-runner-skills.ts` heuristic path for `green-goods-garden-bootstrap-output`

- [ ] `green-goods-garden-sync` → `syncGardenTool`
  - Input: current greenGoods state, coop state
  - Output: sync action payload
  - Source: `agent-runner-skills.ts` heuristic path for `green-goods-garden-sync-output`

- [ ] `green-goods-work-approval` → `approveWorkTool`
  - Input: work submission, garden state
  - Output: approval action payload
  - Source: `agent-runner-skills.ts` heuristic path for `green-goods-work-approval-output`

- [ ] `green-goods-assessment` → `assessImpactTool`
  - Input: garden data, submissions
  - Output: assessment payload
  - Source: `agent-runner-skills.ts` heuristic path for `green-goods-assessment-output`

- [ ] `green-goods-gap-admin-sync` → `syncGapAdminTool`
  - Input: coop state, desired addresses
  - Output: admin sync payload
  - Source: `agent-runner-skills.ts` heuristic path for `green-goods-gap-admin-sync-output`

- [ ] `erc8004-register` → `registerAgentIdentityTool`
  - Input: Safe address, agent manifest
  - Output: registration action payload
  - Source: `agent-runner-skills.ts` heuristic path for `erc8004-register-output`

- [ ] `erc8004-feedback` → `submitAgentFeedbackTool`
  - Input: agent ID, feedback data
  - Output: feedback submission payload
  - Source: `agent-runner-skills.ts` heuristic path for `erc8004-feedback-output`

Place in `packages/shared/src/modules/agent/tools/` (one file per tool or grouped by domain).

**Verify**: Each tool passes a unit test that mirrors the existing heuristic output for the same input. `bun run validate typecheck` passes.

## Step 4: Define generic output tools

Create 4 generic tools that replace the 16 per-schema output handlers:

- [ ] `createDraftTool` — Creates or updates a review draft from analysis output
  - Replaces: capital-formation-brief, review-digest, publish-readiness-check output handlers
  - Input: analysis output, observation context
  - Output: draft object

- [ ] `proposeActionTool` — Creates an action proposal through the policy system
  - Replaces: all Green Goods and ERC-8004 output handlers that dispatch actions
  - Input: action class, action payload, observation context
  - Output: action proposal

- [ ] `saveRoutingTool` — Persists tab routing decisions
  - Replaces: tab-router output handler
  - Input: routing decisions, observation context
  - Output: saved routings

- [ ] `recordAnalysisTool` — Stores intermediate analysis (candidates, scores, entities, themes) for context
  - Replaces: opportunity-extractor, grant-fit-scorer, ecosystem-entity-extractor, theme-clusterer output handlers
  - Input: analysis type, analysis data
  - Output: stored analysis reference

Place in `packages/shared/src/modules/agent/tools/output-tools.ts`.

**Verify**: Each generic tool produces equivalent side effects to the per-schema handlers it replaces (unit test with same input/output assertions).

## Step 5: Build the autonomous agent runner

Create `packages/extension/src/runtime/agent-runner-autonomous.ts`:

```typescript
export async function runAutonomousAgentCycle(options: {
  observation: AgentObservation;
  coopState: CoopSharedState;
  memories: AgentMemory[];
  tools: AgentToolDefinition[];
  model: AutonomousModelBridge;
}): Promise<AgentPlan> {
  // 1. Assemble context: observation + coop state + relevant memories
  // 2. Build tool descriptions from tool definitions
  // 3. Send to model: "Here is an observation. Here are tools. Decide what to do."
  // 4. Model returns a plan with tool calls
  // 5. Execute tool calls, collect results
  // 6. Validate outputs against Zod schemas
  // 7. Return completed plan for approval gate
}
```

**Key design decisions**:
- The model decides which tools to call and in what order (no hardcoded skill chain)
- Tool results are validated against Zod schemas (same schemas as current system)
- The plan goes through the same approval gate as the legacy path
- Memory is queried the same way (via `queryMemoriesForSkill`)
- Observations are created/updated the same way
- Provider/model details are persisted for traces, benchmarks, and advanced diagnostics, but user
  workflow state stays provider-independent

**Model bridge interface** (abstract — concrete implementation depends on model provider):
```typescript
export interface AutonomousModelBridge {
  complete(request: {
    system: string;
    prompt: string;
    tools: ToolDescription[];
    maxTokens?: number;
  }): Promise<{
    plan: string;
    toolCalls: ToolCall[];
  }>;
}
```

**Verify**: Unit test with a mock model bridge that returns predefined tool calls. The autonomous runner correctly executes tools, validates outputs, and produces a plan.

## Step 6: Wire the mode switch in agent-runner.ts

Modify `packages/extension/src/runtime/agent-runner.ts` to branch on `VITE_COOP_AGENT_MODE`:

```typescript
import { getAgentMode } from './config';

export async function runAgentCycle(options) {
  const mode = getAgentMode(); // 'legacy' | 'autonomous'

  if (mode === 'autonomous') {
    return runAutonomousAgentCycle({
      observation: options.observation,
      coopState: options.coopState,
      memories: await queryMemoriesForSkill(db, scope),
      tools: getAllAgentTools(),  // deterministic + generic output tools
      model: getAutonomousModelBridge(),
    });
  }

  // Legacy path — completely unchanged
  return runLegacyAgentCycle(options);
}
```

The legacy path is the current `runAgentCycle` renamed to `runLegacyAgentCycle`. Zero changes to existing behavior.

**Verify**: With `VITE_COOP_AGENT_MODE=legacy`, all existing agent tests pass unchanged. With `VITE_COOP_AGENT_MODE=autonomous`, the mock-bridge unit test passes.

## Step 7: Create the tool registry

Create `packages/extension/src/runtime/agent-tool-registry.ts`:

```typescript
export function getAllAgentTools(): AgentToolDefinition[] {
  return [
    // Deterministic domain tools (from Step 3)
    bootstrapGardenTool,
    syncGardenTool,
    approveWorkTool,
    assessImpactTool,
    syncGapAdminTool,
    registerAgentIdentityTool,
    submitAgentFeedbackTool,
    // Generic output tools (from Step 4)
    createDraftTool,
    proposeActionTool,
    saveRoutingTool,
    recordAnalysisTool,
  ];
}
```

This is the "tool suite" the model receives. Clear descriptions, typed schemas.

**Verify**: `getAllAgentTools()` returns 11 tools. Each has valid `id`, `name`, `description`, `inputSchema`, `outputSchema`.

## Step 8: Write integration test for autonomous path

Create a comprehensive integration test that:
1. Creates a mock observation (e.g., `high-confidence-draft`)
2. Provides mock coop state and memories
3. Uses a mock model bridge that returns realistic tool calls
4. Verifies the autonomous runner produces a valid plan
5. Verifies the plan would pass through the approval gate
6. Verifies side effects (draft creation, analysis storage) match legacy path output

This test ensures the autonomous path produces equivalent results to the legacy path for the same inputs.

**Verify**: Integration test passes. `bun run test` shows no regressions.

## Files NOT modified (Layer 2 — kept intact)

- `agent-observation-conditions.ts` — business logic
- `agent-reconciliation.ts` — garbage collection
- `agent-cycle-helpers.ts` — cycle state
- `agent-observation-emitters.ts` — event-driven observations
- `agent-plan-executor.ts` — approval gate
- `agent/agent.ts` — factory functions (may add tool-related factories)
- `agent/memory.ts` — memory system

## Final Verification

- [ ] `VITE_COOP_AGENT_MODE=legacy bun run test` — all existing tests pass (zero regression)
- [ ] `VITE_COOP_AGENT_MODE=autonomous bun run test` — new autonomous tests pass
- [ ] `bun run validate smoke` passes
- [ ] 11 tool definitions with clear descriptions, typed schemas
- [ ] Legacy agent-runner-skills.ts unchanged
- [ ] Legacy agent-output-handlers.ts unchanged
- [ ] Legacy agent-models.ts unchanged
