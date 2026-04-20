# Implement Architecture Recommendations

## Context

Architecture audit identified 9 recommendations (P1-P3). After investigation, **5 require implementation** and **4 require no action** (stealth/privacy merger — orthogonal; operator/session/auth merger — orthogonal; contracts/schema barrel — already optimal; permit tests — already 100%).

## Execution Strategy

Three independent batches, run in parallel worktrees:

```
Batch A (shared, tests only)  ─── P1: Security test coverage gaps
Batch B (api only)            ─── P1: WebSocket rate limiting + topic auth
Batch C (shared + extension)  ─── P2: Session split + Green Goods split + app-entry docs
```

---

## Batch A: Security Test Coverage

### A1: Action Builder Tests
**Create** `packages/shared/src/modules/policy/__tests__/action-builders.test.ts`

Test all 21 builder functions across 3 files:
- `action-builders-archive.ts` (4 fns): shape + field passthrough
- `action-builders-safe.ts` (5 fns): shape validation
- `action-builders-greengoods.ts` (12 fns): optional field defaulting, `normalizeOptionalText`

~25 tests, ~200 LOC.

### A2: Action Payload Parser Tests
**Create** `packages/shared/src/modules/policy/__tests__/action-payload-parsers.test.ts`

Test `resolveScopedActionPayload()` for each of the 24+ `ScopedActionClass` variants:
- Happy path: valid payload → `{ ok: true, normalizedPayload, targetIds, coopId }`
- Missing required fields → `{ ok: false, reason }`
- Coop scope mismatch
- Custom handlers: `publish-ready-draft`, `green-goods-mint-hypercert`, `erc8004-*`

~50 tests, ~500 LOC.

### A3: Membership Proof Tests
**Create** `packages/shared/src/modules/privacy/__tests__/membership-proof.test.ts`

Test `generateMembershipProof()` and `verifyMembershipProof()` in isolation.
Copy the `@semaphore-protocol/core` mock from `anonymous-publish.test.ts` (lines 11-54).
- Proof round-trip (generate → verify succeeds)
- Tampered proof → verify fails
- Different messages → different proofs
- Different scopes → different nullifiers

~8 tests, ~100 LOC.

**Verify:** `bun run test packages/shared/src/modules/policy/ packages/shared/src/modules/privacy/`

---

## Batch B: API WebSocket Hardening

### B1: Publish Rate Limiting
**Modify** `packages/api/src/ws/handler.ts`

Add sliding-window rate limiter to `publish` case:
- Constants: `MAX_PUBLISH_PER_WINDOW = 60`, `PUBLISH_WINDOW_MS = 10_000`
- Per-connection `publishTimestamps: Map<object, number[]>`
- Before broadcasting: filter stale timestamps, check count, drop if exceeded
- Clean up in `cleanup()`

### B2: Topic Authorization
**Modify** `packages/api/src/ws/handler.ts`

In `publish` case, require publisher to be subscribed to topic before broadcasting:
```typescript
if (!subscribedTopics.has(topicName)) break;
```

### B3: Handler Unit Tests
**Create** `packages/api/src/ws/__tests__/handler.test.ts`

Follow `yjs-sync.test.ts` mock pattern (`createMockWS` with `sent: string[]`):
- subscribe/unsubscribe lifecycle
- publish broadcasts to subscribers only
- publish from non-subscriber dropped (topic auth)
- 61st publish in 10s window dropped (rate limit)
- publish succeeds after window expires
- ping → pong
- onClose/onError cleanup
- malformed JSON handling

~15 tests, ~250 LOC.

**Verify:** `bun run test packages/api/`

---

## Batch C: Structural Refactors (sequential)

### C1: Split session.ts (881 LOC → 5 files)
**Location:** `packages/shared/src/modules/session/`

| New File | Functions | ~LOC |
|----------|-----------|------|
| `session-constants.ts` | `SESSION_CAPABLE_ACTION_CLASSES`, `GREEN_GOODS_ACTION_SELECTORS`, `SESSION_WRAPPING_CONTEXT`, `isSessionCapableActionClass`, `parseSessionCapableActionClass` | 50 |
| `session-capability.ts` | `createSessionSignerMaterial`, `createSessionCapability`, `computeSessionCapabilityStatus`, `refreshSessionCapabilityStatus`, `revokeSessionCapability`, `rotateSessionCapability`, `incrementSessionCapabilityUsage`, `createSessionCapabilityLogEntry`, `formatSessionCapabilityStatusLabel`, `formatSessionCapabilityFailureReason`, `buildActiveSessionCapabilityStatusDetail` (private), `isAddress`, `toUnixSeconds` | 280 |
| `session-smart-modules.ts` | `buildSmartSession`, `buildSessionModuleAccount`, `getSmartSessionsValidatorNonceKey`, `buildEnableSessionExecution`, `buildRemoveSessionExecution`, `wrapUseSessionSignature`, `getSessionCapabilityUseStubSignature`, `signSessionCapabilityUserOperation`, `checkSessionCapabilityEnabled`, `getBundleTypedAuthorization` | 200 |
| `session-validation.ts` | `validateSessionCapabilityForBundle`, `resolveSessionExecutionTargetsForBundle` (private) | 200 |
| `session-encryption.ts` | `createSessionWrappingSecret`, `encryptSessionPrivateKey`, `decryptSessionPrivateKey`, `deriveWrappingKey` (private), `encodeBase64`, `decodeBase64` (private) | 100 |

**Modify** `session.ts` → becomes a 5-line barrel re-exporting all sub-files.

**No change** to `index.ts` (already `export * from './session'`).

**No consumer changes** — barrel chain preserved: `@coop/shared` → `modules/index.ts` → `session/index.ts` → `session.ts` → sub-files.

**Dependency direction:**
```
session-constants.ts      ← no internal deps
session-encryption.ts     ← no internal session deps
session-capability.ts     ← imports session-constants
session-smart-modules.ts  ← imports session-constants
session-validation.ts     ← imports session-constants, session-capability, session-smart-modules
```

**Verify:** `bun run validate smoke`

### C2: Split green-goods.ts executor (970 LOC → 4 files + orchestrator)
**Location:** `packages/extension/src/background/handlers/executors/`

| New File | Executors | ~LOC |
|----------|-----------|------|
| `green-goods-garden.ts` | create-garden, sync-garden-profile, set-garden-domains, create-garden-pools | ~400 |
| `green-goods-membership.ts` | add-gardener, remove-gardener | ~180 |
| `green-goods-governance.ts` | submit-work-approval, create-assessment, sync-gap-admins | ~220 |
| `green-goods-hypercert.ts` | mint-hypercert + `createGreenGoodsHypercertUploader` | ~130 |

**Modify** `green-goods.ts` → orchestrator (~30 LOC) that merges sub-executor maps:
```typescript
export function buildGreenGoodsExecutors(ctx) {
  return {
    ...buildGardenExecutors(ctx),
    ...buildMembershipExecutors(ctx),
    ...buildGovernanceExecutors(ctx),
    ...buildHypercertExecutors(ctx),
  };
}
```

**No change** to `executors/index.ts` — still exports from `./green-goods`.

**Verify:** `bun run validate smoke`

### C3: Document app-entry.ts
**Modify** `packages/shared/src/app-entry.ts`

Add file-level JSDoc explaining purpose, inclusion criteria, and what's excluded (and why). Add inline comments for each export group.

**Verify:** `bun run validate typecheck`

---

## P3 Decisions: No Action

| Recommendation | Decision | Rationale |
|----------------|----------|-----------|
| Stealth → privacy merger | **Skip** | Orthogonal: stealth = ERC-5564 crypto primitives, privacy = Semaphore application logic |
| Operator → session/auth merger | **Skip** | Orthogonal: operator = anchor mode + audit (103 LOC), session = smart contract keys (881 LOC) |
| Contracts/schema barrel grouping | **Skip** | Already well-organized in 15 domain files; fan-in is inherent to type systems |
| Permit test coverage | **Skip** | Already 100% (65 tests) |

---

## Verification

After all batches merge:
```bash
bun run validate smoke    # Cross-package typecheck + build + unit tests
```

## Summary

| Batch | New Files | Modified Files | New Tests |
|-------|-----------|----------------|-----------|
| A | 3 test files | 0 | ~83 tests |
| B | 1 test file | 1 source file | ~15 tests |
| C | 9 source files | 3 source files | 0 (existing tests preserved) |
| **Total** | **13 files** | **4 files** | **~98 tests** |
