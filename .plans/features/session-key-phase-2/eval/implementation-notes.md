# Implementation Notes — Session Key Phase 2

Note: Phase 5 cockpit visibility lives in the Green Goods repo, not this Coop repo. The Coop pack
keeps that design dependency documented here, but the local `status.json` now marks the UI lane
`n/a` so the active-pack metadata only tracks work owned in this repository.

## Phased Delivery Order

0. **Phase 0: Regression Guards** (prerequisite — pins 228ed37/3bab69c hardening fixes)
1. **Phase 1: Expand Actions** (lowest risk — no schema changes, no new patterns)
2. **Phase 2: Lifecycle** (medium risk — schema additions, backwards compat required)
3. **Phase 3: Hats Binding** (medium risk — cross-repo type dependency)
4. **Phase 4: Yield Janitor** (higher risk — new skill, new executor, new observation trigger)
5. **Phase 5: Cockpit Visibility** (low risk — GG-side UI only, no Coop changes)

Phase 0 runs first and gates all subsequent phases. It adds regression tests that pin
the 6 root causes from the Safe7579 hardening work (account type, nonce isolation, address
normalization, AA24 detection, permissionId stability, unusable recovery). If any Phase 0
test fails, STOP — the hardening has regressed and must be fixed before expanding scope.

Each phase can ship independently. Phase 4 depends on Phase 1 for action classes.
Phase 3 depends on GG exporting hat permission types. Phase 5 can start after Phase 1.

## TDD Protocol

### Before Each Phase

1. Write all RED tests for the phase
2. Run `bun run test -- session` — confirm new tests FAIL, existing tests PASS
3. Commit failing tests with message: `test(session): RED — phase N failing tests`

### During Each Phase

4. Implement minimum code to make tests pass
5. Run `bun run test -- session` — confirm ALL tests PASS
6. Commit with message: `feat(session): GREEN — phase N implementation`

### After Each Phase

7. Refactor for clarity, remove duplication
8. Run full validation: `bun run test && bun lint && bun build`
9. Commit with message: `refactor(session): REFACTOR — phase N cleanup`

### Test Count Tracking

| Phase | New Tests | Cumulative | Existing |
|-------|-----------|------------|----------|
| Start | 0 | 0 | 16 |
| Phase 0 (regression) | 6 shared + 3 executor | 9 | 16 |
| Phase 1 | 5 + 3 executor | 17 | 16 |
| Phase 2 | 4 + 1 handler | 22 | 16 |
| Phase 3 | 3 | 25 | 16 |
| Phase 4 | 3 | 28 | 16 |
| Phase 5 | 2 (GG) | 28 + 2 | 16 |
| **Total** | **30** | — | **16 untouched** |

## Key Design Decisions

### Selector verification is a gate, not a test

ABI selectors (`toFunctionSelector('approveWork(uint256)')`) must match the actual Green Goods
contract function signatures. This is verified by comparing bytes4 against the contract ABI,
not by unit testing the selector generation. Add a shell script or manual checklist entry.

### Auto-rotation is fire-and-forget

`handleAutoRotateOnThreshold()` runs after execution succeeds. If rotation fails (e.g., Safe
interaction error), the old capability continues working until it actually exhausts. The failure
is logged but does not block the execution result.

### Hats binding is optional at issuance

If hat data is unavailable (mock mode, Safe not deployed, hat contract unreachable), issuance
proceeds without hat validation. The validation is advisory in Phase 3, enforced in a future
hardening pass. This avoids blocking session issuance on external contract availability.

### Yield janitor is heuristic-only

No LLM inference needed. The skill reads observation payload, validates threshold, and proposes
a deterministic action bundle. Model: "heuristic". This means the yield janitor works without
WebLLM/Transformers and is fully deterministic.

### splitYield is permissionless — session key adds audit trail

`splitYield()` in the Green Goods YieldResolver can be called by anyone. Including it in the
session-key scope is for audit trail value (session logs record when the agent triggered splits),
not for access control.

## Open Questions

- [ ] Should auto-rotation create a new capability with the same scope, or allow scope changes?
- [ ] Should Hats validation cache invalidate on garden role changes (event-driven or TTL)?
- [ ] What is the minimum yield threshold for the janitor? (Garden config or global default?)
- [ ] Should the cockpit show historical session executions or only pending/recent?

## Follow-Ups

- Spending limit policies (Rhinestone `getSpendingLimitPolicy()`) for economic bounds
- Cross-coop session delegation (meta-capabilities)
- Conviction-weighted scope adjustment (dynamic scope based on reputation)
- Onchain Hats enforcement (contract-level hat check, not just issuance-time)
