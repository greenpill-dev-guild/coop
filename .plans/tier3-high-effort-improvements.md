# Tier 3: High-Effort Agentic Development Improvements

Status: PLANNED (2026-03-24)
Estimated total: 40-60 hours across 5 initiatives

---

## 1. Decompose NestTab.tsx (954 lines → 5-6 focused components)

**Problem**: NestTab has 95+ props, 3 sub-tabs (members/agent/settings), and mixed concerns (coop creation, member management, operator console, Green Goods, permits, sessions). Agents can't safely modify one concern without understanding all 954 lines.

**Approach**: Extract by sub-tab and concern, using a context provider to eliminate prop drilling.

### Steps

- [ ] **1a. Create NestContext provider** (~2h)
  - File: `packages/extension/src/views/Sidepanel/tabs/NestContext.tsx`
  - Move the 95+ props into a React context
  - NestTab becomes a thin shell: provider + sub-tab router
  - Sub-components consume via `useNestContext()` — no prop drilling

- [ ] **1b. Extract NestMembersSubTab** (~2h)
  - Lines ~160-350 (invite, member list, receiver pairings)
  - Props needed: `activeCoop`, `inviteResult`, `createInvite`, `revokeInvite`, receiver pairing props, `copyText`
  - Test: `NestMembersSubTab.test.tsx` — renders member list, creates invite

- [ ] **1c. Extract NestAgentSubTab** (~2h)
  - Lines ~350-520 (agent dashboard, skill runs, plans, policy)
  - Props needed: `agentDashboard`, `handleRunAgentCycle`, `handleApprove/RejectAgentPlan`, skill/policy handlers
  - Test: `NestAgentSubTab.test.tsx` — renders agent state, triggers cycle

- [ ] **1d. Extract NestSettingsSubTab** (~3h)
  - Lines ~520-880 (sound, inference, archive, export, Green Goods, permits, sessions, leave coop)
  - This is the largest section — consider further splitting into:
    - `NestArchiveSection` (archive snapshot, refresh, export)
    - `NestGreenGoodsSection` (work approval, assessment, GAP sync)
    - `NestPermitsSection` (issue, revoke, execute permits)
    - `NestSessionSection` (issue, rotate, revoke capabilities)
  - Test: `NestSettingsSubTab.test.tsx` — renders settings, toggles preferences

- [ ] **1e. Simplify NestCreationForm** (~1h)
  - Already extracted (line 549) but lives in same file
  - Move to `packages/extension/src/views/Sidepanel/tabs/NestCreationForm.tsx`

- [ ] **1f. Simplify NestEditCoopSection** (~1h)
  - Already extracted (line 879) but lives in same file
  - Move to `packages/extension/src/views/Sidepanel/tabs/NestEditCoopSection.tsx`

- [ ] **1g. Integration test** (~1h)
  - Verify NestTab still renders correctly with all sub-tabs
  - Run `bun run validate smoke`

**Target**: NestTab.tsx → ~100 lines (shell + router). Each sub-component < 300 lines.

**Verification**: `bun run validate smoke` + visual check in Chrome.

---

## 2. Split action-executors.ts (1,237 lines → domain-grouped files)

**Problem**: Single file maps all PolicyActionClass variants to executor functions. Adding a new action requires understanding the entire file. Agents modify unrelated executors by accident.

**Approach**: Group executors by domain, keep the registry as a thin composition layer.

### Steps

- [ ] **2a. Identify executor groups** (~1h)
  - Read `action-executors.ts` fully, categorize each executor by domain:
    - `coop-executors.ts` — coop lifecycle (create, join, leave, invite)
    - `archive-executors.ts` — archive snapshot, refresh, export
    - `agent-executors.ts` — agent cycle, plans, skill runs
    - `policy-executors.ts` — propose, approve, reject, execute actions
    - `greengoods-executors.ts` — work approval, assessment, sync
    - `session-executors.ts` — permits, capabilities
  - Each file exports a partial executor map

- [ ] **2b. Create domain executor files** (~4h)
  - Each file: `export function buildXxxExecutors(ctx: ActionExecutorContext): Partial<Record<PolicyActionClass, Executor>>`
  - Move executor functions from monolith to domain files
  - No logic changes — pure extraction

- [ ] **2c. Compose in action-executors.ts** (~1h)
  - Reduce to ~50 lines: import all domain builders, spread into single map
  ```typescript
  export function buildActionExecutors(ctx: ActionExecutorContext) {
    return {
      ...buildCoopExecutors(ctx),
      ...buildArchiveExecutors(ctx),
      ...buildAgentExecutors(ctx),
      ...buildPolicyExecutors(ctx),
      ...buildGreenGoodsExecutors(ctx),
      ...buildSessionExecutors(ctx),
    };
  }
  ```

- [ ] **2d. Split tests to match** (~2h)
  - Create `__tests__/coop-executors.test.ts`, etc.
  - Move test cases from the monolith test file

- [ ] **2e. Verify** (~30m)
  - `bun run validate smoke`
  - Ensure no executor is lost (count before/after)

**Target**: action-executors.ts → ~50 lines. Each domain file < 250 lines.

---

## 3. Increase Extension View Test Coverage (0.3% → 15%+)

**Problem**: 9,591 lines of view code with only 29 test files. Agents can't safely refactor UI without test coverage.

**Approach**: Prioritize by change frequency and complexity. Write component tests for the views agents touch most.

### Priority Order (by agent interaction frequency)

- [ ] **3a. PopupHomeScreen** (~3h)
  - Most-visited popup screen. Test: renders feed, captures tab, navigates to drafts.
  - File: `Popup/__tests__/PopupHomeScreen.test.tsx`

- [ ] **3b. CoopsTab** (~3h)
  - Main sidepanel tab. Test: renders coop list, selects coop, shows empty state.
  - File: `Sidepanel/tabs/__tests__/CoopsTab.test.tsx`

- [ ] **3c. NestTab (after decomposition)** (~4h)
  - Test each sub-component independently
  - NestMembersSubTab: invite flow, member list rendering
  - NestAgentSubTab: agent dashboard, skill state rendering
  - NestSettingsSubTab: preference toggles, export actions

- [ ] **3d. RoostTab** (~2h)
  - Review queue. Test: renders drafts, publishes, discards.
  - File: `Sidepanel/tabs/__tests__/RoostTab.test.tsx`

- [ ] **3e. ChickensTab** (~2h)
  - Tab management. Test: renders captured tabs, filters, bulk actions.
  - File: `Sidepanel/tabs/__tests__/ChickensTab.test.tsx`

- [ ] **3f. PopupDraftListScreen** (~2h)
  - Draft management. Test: renders draft list, opens editor, deletes draft.

- [ ] **3g. SidepanelApp orchestration** (~3h)
  - Integration test for tab switching, coop selection, navigation state.

### Test Pattern

All view tests should follow this pattern:
```typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeCoopRecord, makeDashboard } from '../../__tests__/fixtures';

describe('ComponentName', () => {
  const defaultProps = { /* use fixture factories */ };

  it('renders the expected content', () => {
    render(<Component {...defaultProps} />);
    expect(screen.getByText('Expected')).toBeInTheDocument();
  });
});
```

**Target**: 15%+ line coverage across extension views. ~20 new test files.

---

## 4. Introduce Error Type Hierarchy

**Problem**: All errors are `throw new Error('...')` — no categorization, no context, no programmatic handling. Agents can't distinguish network failures from validation errors from storage errors.

**Approach**: Create a base CoopError class with domain subclasses.

### Steps

- [ ] **4a. Define error hierarchy** (~2h)
  - File: `packages/shared/src/errors.ts`
  ```typescript
  export class CoopError extends Error {
    constructor(message: string, public code: string, public context?: Record<string, unknown>) {
      super(message);
      this.name = 'CoopError';
    }
  }

  export class ValidationError extends CoopError { ... }   // Zod parse failures, invalid input
  export class StorageError extends CoopError { ... }       // Dexie failures, quota exceeded
  export class SyncError extends CoopError { ... }          // Yjs/WebRTC/relay failures
  export class AuthError extends CoopError { ... }          // Passkey, session, identity failures
  export class OnchainError extends CoopError { ... }       // Safe, ERC-4337, provider failures
  export class ArchiveError extends CoopError { ... }       // Storacha upload/retrieval failures
  export class AgentError extends CoopError { ... }         // Harness, skill, inference failures
  ```

- [ ] **4b. Export from barrel** (~15m)
  - Add to `packages/shared/src/index.ts`

- [ ] **4c. Migrate shared modules incrementally** (~6h)
  - Start with highest-value modules:
    1. `coop/flows.ts` — replace generic throws with `CoopError`, `ValidationError`
    2. `coop/sync.ts` — replace with `SyncError`
    3. `storage/db.ts` — replace with `StorageError`
    4. `auth/` — replace with `AuthError`
  - Each migration: find `throw new Error`, replace with typed error, add context

- [ ] **4d. Update error handling in background handlers** (~3h)
  - `action-executors.ts` and `receiver.ts` can catch typed errors and return specific error codes
  - Views can display domain-specific error messages

- [ ] **4e. Add error tests** (~2h)
  - Test that each module throws the correct error type
  - Test that error context includes useful debugging information

**Target**: All shared module throws use typed errors. Background handlers catch and classify.

---

## 5. Agent-to-Agent Feedback Loop

**Problem**: When code-reviewer finds issues after cracked-coder implements, a human must manually re-invoke each agent. No automated handoff.

**Approach**: Use Claude Code's task system and agent teams to create a review→fix loop.

### Steps

- [ ] **5a. Define review-fix skill** (~3h)
  - File: `.claude/skills/review-fix/SKILL.md`
  - Orchestration skill that:
    1. Invokes code-reviewer agent on the current diff
    2. If APPROVE → done
    3. If REQUEST_CHANGES → creates tasks for each finding
    4. Invokes cracked-coder agent with findings as context
    5. Re-invokes code-reviewer on the updated diff
    6. Max 2 iterations (prevent infinite loops)
  - Uses `context: fork` for each agent invocation

- [ ] **5b. Create review-fix-loop hook** (~2h)
  - Optional `Stop` hook variant that auto-triggers review when cracked-coder finishes
  - Configurable via env var `COOP_AUTO_REVIEW=1` (off by default)

- [ ] **5c. Task-based handoff** (~2h)
  - When code-reviewer creates REQUEST_CHANGES, it creates tasks in the task list
  - Tasks include: finding severity, file:line, description, suggested fix
  - Cracked-coder picks up tasks and resolves them
  - Task completion triggers re-review

- [ ] **5d. Document the workflow** (~1h)
  - Add to CLAUDE.md or a dedicated `.claude/rules/agent-workflow.md`
  - Explain when to use `/review-fix` vs manual agent invocations

**Target**: Single command (`/review-fix`) that handles implement → review → fix → re-review cycle.

---

## Execution Order

Recommended sequence (dependencies noted):

1. **Error types (#4a-4b)** — foundational, no dependencies
2. **NestTab decomposition (#1)** — independent, unblocks view testing
3. **Action-executors split (#2)** — independent, reduces handler complexity
4. **View test coverage (#3)** — depends on #1 (NestTab decomposition)
5. **Error migration (#4c-4e)** — depends on #4a-4b
6. **Review-fix loop (#5)** — depends on existing agent infrastructure

Items 1, 2, and 4a-4b can run in parallel.

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| NestTab.tsx lines | 954 | < 100 (shell) |
| action-executors.ts lines | 1,237 | < 50 (registry) |
| Extension view test coverage | ~0.3% | 15%+ |
| Typed error throws | 0% | 80%+ in shared |
| Manual agent re-invocations per review cycle | 2-3 | 0-1 |
