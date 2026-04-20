---
feature: session-key-phase-2
title: Session key phase 2 QA pass 1
lane: qa
agent: codex
status: blocked
source_branch: feature/agent-autonomy-onchain
work_branch: qa/codex/session-key-phase-2
depends_on:
  - ../lanes/contracts.codex.todo.md
  - ../lanes/state.codex.todo.md
qa_order: 1
handoff_in: handoff/qa-codex/session-key-phase-2
handoff_out: handoff/qa-claude/session-key-phase-2
updated: 2026-04-09
---

# QA Pass 1 — Codex

## Automated Checks

- [ ] `bun run test -- packages/shared/src/modules/session` — all pass
- [ ] `bun run test -- packages/extension/src/background/handlers/__tests__/session` — all pass
- [ ] `bun lint` — clean
- [ ] `bun build` — clean
- [ ] No action class in both `safe-owner` AND `session-executor` (grep AUTHORITY_ACTION_MAPPINGS)
- [ ] All 16 original test cases untouched and passing
- [ ] 9 Phase 0 regression tests passing (hardening guards)
- [ ] 21 Phase 1-4 new test cases passing (per eval gate count)

## Regression Guards (Phase 0)

- [ ] Account type test: `buildSessionModuleAccount` returns `type: 'safe'`
- [ ] Nonce key test: `getSmartSessionsValidatorNonceKey()` returns non-zero BigInt
- [ ] Address normalization: mixed-case allowlist validates against lowercase target
- [ ] AA24 detection: executor catches 'AA24 signature error' with actionable detail
- [ ] PermissionId stability: same scope → same hash, valid hex64
- [ ] Unusable recovery: `refreshSessionCapabilityStatus(preserveUnusable: false)` resets active
- [ ] Executor nonce key: `createSessionExecutionContext` passes nonceKey
- [ ] Executor usedCount: failure does not increment, success does increment

## Structural Checks

- [ ] `SESSION_CAPABLE_ACTION_CLASSES` has 7 entries (up from 4)
- [ ] `GREEN_GOODS_ACTION_SELECTORS` has entries for all 7 action classes
- [ ] `SessionCapabilityErrorCode` enum exported from session module index
- [ ] `checkSoftExpiry()` exported from session module index
- [ ] `validateScopeAgainstHat()` exported from session module index
- [ ] `autoRotateEnabled` field has `.default(false)` in Zod schema
- [ ] Yield janitor `skill.json` has `approvalMode: "auto-run-eligible"` and `model: "heuristic"`
- [ ] Yield janitor `SKILL.md` has frontmatter with `audience: trusted-node`
- [ ] New executor `green-goods-yield.ts` follows existing guard → select → context → execute → log pattern

## Backwards Compatibility

- [ ] Existing capabilities without `autoRotateEnabled` parse without error
- [ ] Existing capabilities without `errorCode` in validation results still work
- [ ] Session issuance without hat data succeeds (optional validation)

## Security Spot Checks

- [ ] No action in `SESSION_CAPABLE_ACTION_CLASSES` that handles money transfers
- [ ] Yield harvest targetAllowlist enforced (unknown vault → rejected)
- [ ] Auto-rotation does not change scope (new capability inherits old scope)
- [ ] PermissionId changes when scope changes (hash is of the full scope object)
