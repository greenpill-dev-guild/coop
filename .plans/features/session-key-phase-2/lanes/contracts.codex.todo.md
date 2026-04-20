---
feature: session-key-phase-2
title: Session key phase 2 contracts lane
lane: contracts
agent: codex
status: backlog
source_branch: feature/agent-autonomy-onchain
work_branch: codex/contracts/session-key-phase-2
depends_on:
  - ../spec.md
owned_paths:
  - packages/shared/src/modules/session
  - packages/shared/src/modules/onchain
  - packages/shared/src/modules/policy
  - packages/shared/src/contracts/schema-session.ts
done_when:
  - green-goods-submit-work-approval
  - green-goods-create-assessment
  - green-goods-sync-gap-admins
  - checkSoftExpiry(
  - SessionCapabilityErrorCode
  - validateScopeAgainstHat(
skills:
  - contracts
  - onchain
  - permissions
updated: 2026-04-06
---

# Contracts Lane — Session Key Phase 2

Covers Phase 1 (expand actions), Phase 2 (lifecycle), and Phase 3 (Hats binding) at the
shared module layer. All changes are in `packages/shared/`.

## TDD Workflow

Every step follows RED → GREEN → REFACTOR. Write the failing test FIRST in
`packages/shared/src/modules/session/__tests__/session.test.ts`, then make it pass.

---

## Phase 0: Regression Guards (228ed37 / 3bab69c hardening)

Before expanding scope, add regression tests that pin the fixes from the two hardening commits.
These tests MUST pass before AND after every subsequent phase.

### Step 0.1 — RED: Write regression tests for prior hardening

Add a new `describe('session hardening regression guards')` block in `session.test.ts`:

```
it('uses Safe account type for 7579-enabled accounts, never erc7579-implementation')
  → buildSessionModuleAccount({ ... })
  → expect(account.type).toBe('safe')
  → NOTE: This test already exists ("keeps 7579-enabled Safes on the Safe module account path")
  → VERIFY it still passes — do NOT remove or weaken it

it('derives nonce key from validator address for session signing isolation')
  → getSmartSessionsValidatorNonceKey()
  → expect result to be a BigInt derived from pad(validatorAddress, { dir: 'right', size: 24 })
  → expect result !== 0n (non-default nonce space)
  → FAILS if function signature changes or padding logic drifts

it('normalizes target allowlist addresses to lowercase before comparison')
  → makeCapability({ targetAllowlist: { 'green-goods-create-garden': ['0xABCD...'] } })
  → validate bundle with target '0xabcd...' (lowercase)
  → expect(result.ok).toBe(true)
  → FAILS if case-sensitive comparison regresses (fixed in 3bab69c)

it('detects AA24 signature errors distinctly from other execution failures')
  → mock execution failure with error containing 'AA24 signature error'
  → expect statusDetail to include 'session key must be re-issued'
  → expect statusDetail to NOT be the raw error string
  → This is an executor-level test (session-execution.test.ts)

it('computes and stores permissionId before first use')
  → buildSmartSession(capability) with 7-action scope
  → expect permissionId to be a valid 0x-prefixed 64-char hex string
  → expect permissionId to be deterministic (same scope → same hash)
  → call again with same scope → expect identical permissionId

it('recovers from unusable status when underlying condition is fixed')
  → makeCapability with status 'unusable', lastValidationFailure: 'missing-pimlico'
  → call refreshSessionCapabilityStatus with preserveUnusable: false AND pimlico now available
  → expect status resets to 'active'
  → expect lastValidationFailure cleared
  → FAILS if revalidation path doesn't clear unusable for new action classes
```

**Verify**: `bun run test -- session.test.ts` → regression tests PASS (they pin existing behavior).
The nonce key, permissionId, and unusable-recovery tests may need new exports — if so, mark them
as RED and implement the minimal export in GREEN.

### Step 0.2 — Verify existing hardening tests still pass

Run the full session test suite before making any changes:

```bash
bun run test -- packages/shared/src/modules/session
bun run test -- packages/extension/src/background/handlers/__tests__/session
```

Confirm:
- [ ] "keeps 7579-enabled Safes on the Safe module account path" — PASS
- [ ] "keeps legacy Safes on the Safe module account path" — PASS
- [ ] "preserves unusable status on refresh and clears it after successful revalidation" — PASS
- [ ] All 16 existing tests — PASS

If any fail, STOP. Fix the regression before proceeding to Phase 1.

---

## Phase 1: Expand Session-Capable Action Classes

### Step 1.1 — RED: Write failing tests for new action classes

Add to `session.test.ts`:

```
it('validates work-approval bundle against session capability with approval targets')
  → makeCapability({ allowedActions: ['green-goods-submit-work-approval'], targetAllowlist: {...} })
  → validateSessionCapabilityForBundle(capability, makeWorkApprovalBundle())
  → expect(result.ok).toBe(true)
  → FAILS: 'unsupported-action'

it('validates assessment bundle against session capability with assessment targets')
  → same pattern with 'green-goods-create-assessment'
  → FAILS: 'unsupported-action'

it('validates gap-admin-sync bundle against session capability')
  → same pattern with 'green-goods-sync-gap-admins'
  → FAILS: 'unsupported-action'

it('builds Smart Session selector permissions for work-approval + assessment + gap-sync')
  → buildSmartSession(capability) with new actions
  → expect actionPolicies to include approveWork, createAssessment, syncAdmins selectors
  → FAILS: selectors not in GREEN_GOODS_ACTION_SELECTORS

it('rejects work-approval when target escapes allowlist')
  → bundle targets OTHER_TARGET
  → expect(result.rejectType).toBe('allowlist-mismatch')
  → FAILS: never reaches allowlist check
```

Add bundle factories:
- `makeWorkApprovalBundle()` — uses `buildGreenGoodsSubmitWorkApprovalPayload`
- `makeCreateAssessmentBundle()` — uses `buildGreenGoodsCreateAssessmentPayload`
- `makeSyncGapAdminsBundle()` — uses `buildGreenGoodsSyncGapAdminsPayload`

**Verify**: `bun run test -- session.test.ts` → 5 new tests FAIL, 16 existing tests PASS.

### Step 1.2 — GREEN: Add action classes and selectors

In `session-constants.ts`:
- Add `'green-goods-submit-work-approval'`, `'green-goods-create-assessment'`,
  `'green-goods-sync-gap-admins'` to `SESSION_CAPABLE_ACTION_CLASSES`
- Add to `GREEN_GOODS_ACTION_SELECTORS`:
  - `'green-goods-submit-work-approval': [toFunctionSelector('approveWork(uint256)')]`
  - `'green-goods-create-assessment': [toFunctionSelector('createAssessment(address,bytes)')]`
  - `'green-goods-sync-gap-admins': [toFunctionSelector('syncAdmins(address[])')]`

In `authority.ts`:
- Move 3 actions from `safe-owner.actionClasses` to `session-executor.actionClasses`

**Verify**: `bun run test -- session.test.ts` → all 21 tests PASS.

### Step 1.3 — REFACTOR: Verify selector correctness

- Compare selector bytes4 against Green Goods contract ABIs
- Ensure `resolveAuthorityClass()` returns correct tier for each moved action
- Ensure no action appears in both `safe-owner` AND `session-executor`

**Verify**: `bun run test -- session` → all pass. `bun lint` → clean.

---

## Phase 2: Lifecycle Improvements

### Step 2.1 — RED: Write failing lifecycle tests

Add to `session.test.ts`:

```
it('detects soft expiry at 80% usage threshold')
  → makeCapability({ maxUses: 10, usedCount: 8 })
  → checkSoftExpiry(capability)
  → expect(result.shouldRotate).toBe(true)
  → FAILS: checkSoftExpiry doesn't exist

it('does not trigger soft expiry below threshold')
  → makeCapability({ maxUses: 10, usedCount: 7 })
  → expect(result.shouldRotate).toBe(false)
  → FAILS: same

it('auto-rotates when threshold reached and autoRotateEnabled is true')
  → makeCapability({ maxUses: 10, usedCount: 9, scope: { autoRotateEnabled: true } })
  → incrementSessionCapabilityUsage(capability)
  → expect new capability status 'active', old capability status 'exhausted'
  → FAILS: autoRotateEnabled not in schema

it('returns structured error code alongside statusDetail')
  → validate expired capability
  → expect(result.errorCode).toBe('SESSION_EXPIRED')
  → FAILS: errorCode doesn't exist
```

**Verify**: 4 new tests FAIL, all existing PASS.

### Step 2.2 — GREEN: Implement lifecycle changes

In `schema-session.ts`:
- Add `autoRotateEnabled: z.boolean().default(false)` to `sessionCapabilityScopeSchema`

In `session-capability.ts`:
- Add `checkSoftExpiry(capability: SessionCapability): { shouldRotate: boolean }`
  - Returns true when `usedCount >= maxUses * 0.8`

In `session-validation.ts`:
- Add `SessionCapabilityErrorCode` enum:
  ```
  SESSION_EXPIRED | SESSION_REVOKED | SESSION_EXHAUSTED | ACTION_UNSUPPORTED |
  ACTION_DENIED | ALLOWLIST_MISMATCH | CHAIN_MISMATCH | SAFE_MISMATCH |
  MATERIAL_MISSING | PIMLICO_MISSING | MODULE_UNAVAILABLE
  ```
- Add `errorCode` field to validation result alongside existing `rejectType`

**Verify**: all 25 tests PASS.

### Step 2.3 — REFACTOR: Backwards compatibility

- Verify: `makeCapability()` without `autoRotateEnabled` defaults to `false`
- Verify: existing capabilities parsed by Zod still validate (`.default(false)`)
- Verify: `errorCode` is always present on failure results (migration: map from existing `rejectType`)

**Verify**: `bun run test -- session` → all pass. `bun build` → clean.

---

## Phase 3: Hats-Bound Session Capabilities

### Step 3.1 — RED: Write failing Hats tests

Add to `session.test.ts`:

```
it('rejects session issuance when scope exceeds hat permissions')
  → hatPermissions = ['green-goods-create-garden', 'green-goods-sync-garden-profile']
  → requestedScope = { allowedActions: ['green-goods-create-garden', 'green-goods-submit-work-approval'] }
  → validateScopeAgainstHat(requestedScope, hatPermissions)
  → expect(result.ok).toBe(false)
  → expect(result.exceededActions).toEqual(['green-goods-submit-work-approval'])
  → FAILS: validateScopeAgainstHat doesn't exist

it('allows session issuance when scope is subset of hat permissions')
  → requestedScope ⊆ hatPermissions
  → expect(result.ok).toBe(true)
  → FAILS: same

it('maps operator hat to full session-executor action set')
  → getSessionActionsForHatRole('operator')
  → expect all 7 session-executor actions present
  → FAILS: getSessionActionsForHatRole doesn't exist
```

**Verify**: 3 new tests FAIL, all existing PASS.

### Step 3.2 — GREEN: Implement Hats binding

In `session-capability.ts`:
- Add `validateScopeAgainstHat(scope, hatPermissions)`:
  - Returns `{ ok: true }` or `{ ok: false, exceededActions: string[] }`
  - Pure function — no contract reads (permissions passed in)

- Add `getSessionActionsForHatRole(role: HatRole)`:
  - Maps hat role → allowed session action classes
  - Operator: all 7 session-executor actions
  - Gardener: garden sync + domain actions only

In `greengoods.ts`:
- Add `resolveHatRole(address, gardenAddress, chainKey)`:
  - Reads hat from Green Goods HatsModule contract
  - Returns role enum

In handler `session.ts` → `handleIssueSessionCapability()`:
- After existing validation, call `resolveHatRole()` → `getSessionActionsForHatRole()` → `validateScopeAgainstHat()`
- Reject with new `SessionCapabilityErrorCode.SCOPE_EXCEEDS_HAT` if validation fails

**Verify**: all 28 tests PASS.

### Step 3.3 — REFACTOR: Cache hat data

- Cache hat role per (address, garden) with TTL to avoid contract reads on every issuance
- Ensure hat validation is skippable in mock/test mode

**Verify**: `bun run test -- session` → all pass.

---

## Portability Checklist

- [ ] New action classes are narrow enough for adapter mapping
- [ ] Reminder semantics and execution semantics are in separate action classes
- [ ] Coop-only authority assumptions documented for each new action
- [ ] SessionCapabilityErrorCode enum is re-exportable
- [ ] Hats binding is optional (works without hat data — just skips validation)
