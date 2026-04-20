---
feature: session-key-phase-2
title: Session key phase 2 state lane
lane: state
agent: codex
status: blocked
source_branch: feature/agent-autonomy-onchain
work_branch: codex/state/session-key-phase-2
depends_on:
  - ./contracts.codex.todo.md
owned_paths:
  - packages/extension/src/background/handlers/session.ts
  - packages/extension/src/background/handlers/executors
  - packages/extension/src/skills/green-goods-yield-janitor
done_when:
  - handleAutoRotateOnThreshold(
  - green-goods-yield.ts
  - green-goods-yield-janitor/skill.json
skills:
  - state-logic
  - runtime
  - storage
updated: 2026-04-06
---

# State Lane — Session Key Phase 2

Covers handler wiring for Phase 1 (executor paths), Phase 2 (auto-rotation handler),
and Phase 4 (yield janitor). Depends on contracts lane completing first.

## TDD Workflow

Write failing tests in `session-execution.test.ts` BEFORE implementing handlers.

---

## Execution Path Regression Guards

Before wiring new executor paths, verify the hardened execution pipeline is intact.
These concerns come from the 228ed37 hardening (Safe7579 account type, nonce key, AA24).

### Step S0.1 — Verify existing executor hardening

Add to `session-execution.test.ts` if not already present:

```
it('passes nonceKey to session execution context for nonce isolation')
  → mock: createSessionExecutionContext
  → expect toCoopSafeSmartAccount called with nonceKey !== undefined
  → FAILS if nonceKey param dropped during refactor

it('detects AA24 signature error in new action class execution')
  → mock: sendSmartAccountTransaction rejects with 'AA24 signature error'
  → expect session log entry detail includes 're-issued or re-enabled'
  → expect error is rethrown (not swallowed)

it('increments usedCount only on successful execution, not on failure')
  → mock: execution fails
  → expect capability.usedCount unchanged
  → mock: execution succeeds
  → expect capability.usedCount incremented
```

**Verify**: These should PASS against existing code (they pin current behavior).
If any fail, investigate before proceeding.

---

## Phase 1 Extension: Wire Executor Paths

### Step S1.1 — RED: Write failing executor tests

Add to `session-execution.test.ts`:

```
it('routes work-approval bundle through session executor')
  → mock: buildGreenGoodsSessionExecutor with work-approval bundle
  → expect executor returns { ok: true }
  → FAILS: action class not handled in executor routing

it('routes assessment bundle through session executor')
  → same pattern
  → FAILS: not handled

it('routes gap-admin-sync bundle through session executor')
  → same pattern
  → FAILS: not handled
```

**Verify**: 3 new tests FAIL.

### Step S1.2 — GREEN: Wire new actions in executor

In `green-goods-garden.ts`:
- Add handler branches for `green-goods-submit-work-approval`, `green-goods-create-assessment`,
  `green-goods-sync-gap-admins` that route through `buildGreenGoodsSessionExecutor()`
- Follow existing pattern: guard on `configuredSessionMode === 'live'`, select capability,
  create context, submit transaction

**Verify**: all executor tests PASS.

---

## Phase 2 Extension: Auto-Rotation Handler

### Step S2.1 — RED: Write failing auto-rotation handler test

Add to `session-execution.test.ts`:

```
it('triggers auto-rotation after execution when soft expiry threshold reached')
  → mock: capability with maxUses: 10, usedCount: 9, autoRotateEnabled: true
  → execute a session action
  → expect: old capability revoked, new capability issued
  → FAILS: no auto-rotation logic in handler
```

**Verify**: 1 new test FAILS.

### Step S2.2 — GREEN: Implement auto-rotation in handler

In `session.ts`:
- Add `handleAutoRotateOnThreshold(capability, coopId)`:
  - Called after `incrementSessionCapabilityUsage()` in the execution success path
  - Checks `checkSoftExpiry()` from contracts lane
  - If `shouldRotate && scope.autoRotateEnabled`:
    - Logs `"auto-rotation-triggered"` session capability log entry
    - Calls existing `handleRotateSessionCapability()` internally
    - Logs `"auto-rotated-on-threshold"` with old → new capability IDs
  - If `!autoRotateEnabled`: no-op (backwards compatible)

Wire into execution success path in `buildGreenGoodsSessionExecutor()`:
- After `incrementSessionCapabilityUsage()`, call `handleAutoRotateOnThreshold()`

**Verify**: all tests PASS.

---

## Phase 4: Yield Janitor

### Step S4.1 — RED: Write failing yield executor tests

Add new test file `session-yield.test.ts`:

```
it('validates harvest-yield bundle against session capability')
  → makeCapability({ allowedActions: ['green-goods-harvest-yield'], ... })
  → FAILS: action not in SESSION_CAPABLE_ACTION_CLASSES
  (Note: this should pass after contracts lane adds it — verify here)

it('executes harvest then split as ordered two-step bundle')
  → mock: yield executor with harvest + split actions
  → expect: harvest call timestamp < split call timestamp
  → FAILS: executor doesn't exist

it('rejects harvest when vault address not in targetAllowlist')
  → bundle targets unknown vault
  → expect allowlist-mismatch rejection
  → FAILS: executor doesn't exist
```

**Verify**: tests FAIL.

### Step S4.2 — GREEN: Create yield executor

Create `packages/extension/src/background/handlers/executors/green-goods-yield.ts`:
- `executeYieldHarvest(context)`: calls `harvest(vaultAddress)` via session executor
- `executeYieldSplit(context)`: calls `splitYield(gardenAddress)` via session executor
- `executeYieldCycle(context)`: orchestrates harvest → split in sequence
- Guards: check vault address in targetAllowlist, check minimum yield threshold

**Verify**: executor tests PASS.

### Step S4.3 — Create yield janitor skill

Create `packages/extension/src/skills/green-goods-yield-janitor/skill.json`:
```json
{
  "id": "green-goods-yield-janitor",
  "name": "Green Goods Yield Janitor",
  "description": "Monitors garden yield and triggers harvest when threshold is met",
  "trigger": "green-goods-yield-threshold-reached",
  "requiredCapabilities": ["green-goods-enabled", "session-capability-active"],
  "allowedActionClasses": ["green-goods-harvest-yield", "green-goods-split-yield"],
  "approvalMode": "auto-run-eligible",
  "model": "heuristic",
  "maxTokens": 0,
  "timeoutMs": 30000,
  "depends": [],
  "provides": ["yield-cycle-complete"]
}
```

Create `packages/extension/src/skills/green-goods-yield-janitor/SKILL.md`:
```markdown
---
name: green-goods-yield-janitor
type: executable
runtime: heuristic
audience: trusted-node
---

# Green Goods Yield Janitor

Monitor garden vault yield and trigger harvest + split when threshold is met.

## Trigger
Fires on `green-goods-yield-threshold-reached` observation, which is emitted when
the indexer detects yield above the garden's configured minimum threshold.

## Behavior
1. Read observation payload: gardenAddress, vaultAddress, currentYield, threshold
2. Validate: currentYield > threshold
3. Propose action bundle: harvest(vaultAddress) then splitYield(gardenAddress)
4. Action class: green-goods-harvest-yield (session-executor tier)
5. Approval mode: auto-run-eligible (bounded by PermissionId scope)

## Security
- Session key must have green-goods-harvest-yield in allowedActions
- Vault address must be in targetAllowlist
- Cannot redirect funds — only trigger splits on existing on-chain config
```

### Step S4.4 — Wire observation trigger

In the Green Goods indexer polling logic (or observation derivation):
- Add `green-goods-yield-threshold-reached` trigger
- Payload: `{ gardenAddress, vaultAddress, currentYield, threshold, chainKey }`
- Condition: `currentYield > garden.yieldThreshold`

**Verify**: `bun run test -- session-yield` → all pass. `bun lint` → clean. `bun build` → clean.

---

## Portability Checklist

- [ ] Yield janitor skill has valid `skill.json` + `SKILL.md`
- [ ] Auto-rotation handler is testable in isolation (no live mode dependency)
- [ ] New executor follows existing pattern (guard → select → context → execute → log)
- [ ] Observation trigger documented as Coop-only vocabulary
