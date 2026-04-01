# Plan: `sidepanel-agent-actions-wiring`

## Context

The sidepanel "Run now" / "Check the helpers" / "Run Agent" buttons appear inert. User clicks them and nothing visible happens. The walkthrough flagged agent-cycle notifications as noisy, and the agent root view as feeling unwired or misleading.

**Root cause**: The wiring is actually complete end-to-end — the buttons send `run-agent-cycle` to the background, which runs real agent inference. But three UX failures make it feel fake:

1. **No loading state**: `agentRunning` is already computed in `useDashboard` from background `AGENT_CYCLE_STARTED/FINISHED` events, but it is **never threaded into any component**. Buttons show no visual change while the cycle runs.
2. **Vague/absent success feedback**: On success, the only toast is `"Agent cycle requested."` — it doesn't say what happened. The `AGENT_CYCLE_FINISHED` event already carries `processedCount`, `draftCount`, `errorCount`, `durationMs` but these are discarded.
3. **Silent pre-flight failures**: `getTrustedNodeContext()` can fail (no passkey, no coop, wrong role). The error routes to a toast, but the messages are operator jargon (`"Trusted-node controls are limited to creator or trusted members."`).

**Not a problem**: The Nest tab is already gated to trusted-node roles via `hasTrustedNodeAccess` in `SidepanelApp.tsx`. Regular members never see the Agent sub-tab. The RoostTab agent section is visible to trusted members who can actually run cycles.

## Changes

### Step 1: Thread `agentRunning` through to buttons

**`useSidepanelOrchestration.ts`** — Add `agentRunning` to the `SidepanelOrchestration` interface and return object (it's already returned from `useDashboard`, just not forwarded).

**`SidepanelTabRouter.tsx`** — Pass `orchestration.agentRunning` (or access via existing orchestration destructure) to `RoostTab`.

**`RoostTab.tsx`** — Add `agentRunning?: boolean` to `RoostTabProps`. Disable and relabel all three agent-cycle buttons:
- "Run Now" → `disabled={agentRunning}`, label becomes `"Running..."` when active
- "Run Agent" (stale observations) → same treatment
- Pass through to `AgentSection` and `FocusSection` sub-components

**`NestAgentSection.tsx`** → **`OperatorConsole.tsx`** → **`SkillManifestSection.tsx`** — Thread `agentRunning` prop down and disable "Check the helpers" button with `"Checking..."` label while running.

### Step 2: Outcome-specific toast from background events

**`useDashboard.ts`** — In the `AGENT_CYCLE_FINISHED` listener (currently only sets `agentRunning = false`), compose a descriptive toast:
- `processedCount > 0`: `"Helpers processed N observation(s), created N draft(s)."`
- `processedCount === 0`: `"Helpers checked in. Nothing new right now."`

In the `AGENT_CYCLE_ERROR` listener, set: `setMessage(msg.error ?? 'Helper cycle encountered an error.')`

**`useSidepanelAgent.ts`** — Remove `setMessage('Agent cycle requested.')` from the success path. The background event now handles the toast. Keep the error path for pre-flight failures (which don't emit background events).

### Step 3: Friendlier pre-flight error messages

**`useSidepanelAgent.ts`** — Map `getTrustedNodeContext` error strings to user-friendly copy:
- `"A passkey session is required..."` → `"Sign in with your passkey first."`
- `"Select a coop before..."` → `"Select a coop first."`
- `"Trusted-node controls are limited..."` → `"Only trusted members can run helpers."`

### Step 4: Update tests

**`useSidepanelAgent.test.ts`** — Remove assertion for `"Agent cycle requested."` success toast (now comes from background event). Add test for error message mapping.

**`useDashboard` tests** (if they exist; create targeted test if needed) — Verify `AGENT_CYCLE_FINISHED` produces outcome toast. Verify `AGENT_CYCLE_ERROR` produces error toast.

**`RoostTab-interactions.test.tsx`** — Verify "Run Now" button is disabled when `agentRunning` is true.

## Files to modify

| File | Change |
|------|--------|
| `packages/extension/src/views/Sidepanel/hooks/useSidepanelOrchestration.ts` | Add `agentRunning` to interface + return |
| `packages/extension/src/views/Sidepanel/hooks/useSidepanelAgent.ts` | Remove vague success toast, add error mapping |
| `packages/extension/src/views/Sidepanel/hooks/useDashboard.ts` | Compose outcome toast from `AGENT_CYCLE_FINISHED/ERROR` |
| `packages/extension/src/views/Sidepanel/SidepanelTabRouter.tsx` | Pass `agentRunning` to `RoostTab` |
| `packages/extension/src/views/Sidepanel/tabs/RoostTab.tsx` | Add `agentRunning` prop, disable/relabel buttons |
| `packages/extension/src/views/Sidepanel/tabs/NestAgentSection.tsx` | Pass `agentRunning` to `OperatorConsole` |
| `packages/extension/src/views/Sidepanel/OperatorConsole.tsx` | Thread `agentRunning` to `SkillManifestSection` |
| `packages/extension/src/views/Sidepanel/operator-sections/SkillManifestSection.tsx` | Disable/relabel button |
| `packages/extension/src/views/Sidepanel/hooks/__tests__/useSidepanelAgent.test.ts` | Update success toast assertion, add error mapping test |
| `packages/extension/src/views/Sidepanel/tabs/__tests__/RoostTab-interactions.test.tsx` | Add disabled-button test |

## What this does NOT change

- No new components, CSS classes, or notification patterns
- No changes to `background/handlers/agent.ts` or `background/operator.ts`
- No changes to `runtime/messages.ts` (types already exist)
- No regressions to notifications-normalization, roundup-permission, chickens-feed, or signal-draft work
- Toast path stays non-blocking/non-layout-shifting per session state guardrails

## Overlap with in-flight work

- `useSidepanelOrchestration.ts` has in-flight changes (coop/draft management) — adding one line to interface + one to return, no conflict
- `SidepanelTabRouter.tsx` has in-flight changes — adding one prop passthrough, no conflict
- `NestTab.tsx` has in-flight changes — minimal prop passthrough addition, no conflict
- `runtime/messages.ts` is NOT modified (types are already correct)

## Verification

1. `bun run test -- packages/extension/src/views/Sidepanel/hooks/__tests__/useSidepanelAgent.test.ts packages/extension/src/views/Sidepanel/tabs/__tests__/RoostTab-interactions.test.tsx` → pass
2. `cd packages/extension && bun run build` → pass
3. `bunx @biomejs/biome check <all changed files>` → pass
4. `bun run validate smoke` → pass (pre-existing `agent-observation-conditions.test.ts` failure expected)
