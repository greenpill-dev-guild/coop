## Test Gap Closure Plan

**Created**: 2026-03-22
**Context**: Agentic hackathon in ~4 hours. Close confidence gaps in priority order. Agents should update status as items complete.

---

### Phase 1: Pre-Demo Confidence (do before demo)

#### 1.1 Manual live rehearsal of the demo flow
- **Status**: PENDING
- **Owner**: human
- **Steps**:
  - [ ] Create coop with Green Goods + passkey on Sepolia (live mode)
  - [ ] Capture tabs, verify agent pipeline produces drafts
  - [ ] Run agent cycle from operator console, verify skill runs
  - [ ] Provision member Kernel account
  - [ ] Submit Green Goods work submission on-chain
  - [ ] Archive an artifact to Storacha, verify CID
  - [ ] Anchor archive CID on-chain
  - [ ] Publish draft to feed, verify P2P sync
  - [ ] Copy invite code from popup profile (verify fix)
  - [ ] Join from second profile, verify sync
- **Why**: Live probes validated individual paths. Manual rehearsal validates the _connected flow_ judges will see.

#### 1.2 Verify Pimlico sponsorship policy is funded
- **Status**: PENDING
- **Owner**: human
- **Steps**:
  - [ ] Check `sp_bitter_may_parker` balance on Pimlico dashboard
  - [ ] Ensure sufficient gas credits for 10+ Sepolia transactions
- **Why**: Every on-chain action routes through Pimlico. If credits run out mid-demo, all on-chain actions fail silently.

---

### Phase 2: High-Value Test Gaps (do if time permits before demo)

#### 2.1 Add integration test for popup-to-background message contract
- **Status**: PENDING
- **Effort**: 30 min
- **Why**: Popup and sidepanel tests mock `sendRuntimeMessage`. Background handler tests mock the context. Nobody tests that the message _shape_ the view sends matches what the handler expects. A type mismatch would be invisible.
- **Approach**: Write a contract test that imports both the message type definitions and the handler dispatch, verifying that every `sendRuntimeMessage` type maps to a registered handler with compatible payload shape.

#### 2.2 Add error-path test for passkey session creation
- **Status**: PENDING
- **Effort**: 20 min
- **Why**: Auth has 15 tests but no error paths for `navigator.credentials.create` failure (user cancels, timeout, no authenticator). During demo, a passkey failure would be unrecoverable.
- **Approach**: Add 2-3 tests in `packages/shared/src/modules/auth/__tests__/` for credential creation timeout, user cancellation, and missing authenticator.

#### 2.3 Add Storacha upload error handling test
- **Status**: PENDING
- **Effort**: 20 min
- **Why**: 55 Storacha tests all mock the client. No test verifies what happens when `uploadFile` rejects, delegation expires, or the gateway is unreachable.
- **Approach**: Add tests in archive tests for upload rejection, expired delegation, and gateway timeout — verify the error surfaces to the user rather than being swallowed.

---

### Phase 3: Post-Hackathon Hardening

#### 3.1 Deploy Safes with ERC-7579 launchpad
- **Status**: PENDING
- **Effort**: 2-4 hours
- **Why**: Session key probe Phase 2 (on-chain module execution) is blocked because `deployCoopSafeAccount` creates standard Safe v1.4.1 without 7579 adapter. Rhinestone SmartSessions can't be installed.
- **Approach**: Update `deployCoopSafeAccount` to pass `erc7579LaunchpadAddress` to `toSafeSmartAccount` when session keys are needed. Update probe to exercise full on-chain session lifecycle.

#### 3.2 Real Semaphore ZK proof test
- **Status**: PENDING
- **Effort**: 1-2 hours
- **Why**: All 33 privacy tests use fake proofs with marker fields. Real SNARK generation (5MB WASM/zkey) never runs. Misconfigured group trees pass all tests.
- **Approach**: Add one integration test that generates and verifies a real Semaphore proof with real WASM artifacts. Can be slow and gated behind an env flag.

#### 3.3 WebGPU/WASM inference integration test
- **Status**: PENDING
- **Effort**: 2-3 hours
- **Why**: Agent inference pipeline is coverage-excluded. The heuristic fallback is solid but actual model loading, tokenization, and inference are a complete blind spot.
- **Approach**: Add a gated integration test that loads the ONNX model in a worker context and runs inference on a fixture input. Verify output shape matches skill output schemas.

#### 3.4 Multi-peer Yjs sync stress test
- **Status**: PENDING
- **Effort**: 2-3 hours
- **Why**: No test covers reconnection after network drop, conflict resolution when peers diverge while disconnected, or large document sync.
- **Approach**: E2E test with three browser profiles: create coop, disconnect one peer, make concurrent edits, reconnect, verify CRDT convergence.

#### 3.5 Register impact report EAS schema UID
- **Status**: PENDING
- **Effort**: 30 min
- **Why**: `IMPACT_REPORT_SCHEMA_UID` in `greengoods.ts:92` is `0x000...0`. Live impact report submissions would fail.
- **Approach**: Register the schema on Sepolia EAS, update the constant, verify with a test submission.

#### 3.6 Background handler coverage for archive + permits + session
- **Status**: PENDING
- **Effort**: 1-2 hours
- **Why**: 6/13 background handler files tested. Missing: `archive.ts`, `permits.ts`, `session.ts`. These are integration points where bugs surface during demo.
- **Approach**: Follow same patterns as existing handler tests and new agent handler tests.

#### 3.7 CI integration for live probes
- **Status**: PENDING
- **Effort**: 1 hour
- **Why**: Live probes are opt-in and never run in CI. On-chain regressions are invisible until someone manually runs probes.
- **Approach**: Add a scheduled CI job (weekly or pre-release) that runs all three probes with stored secrets. Gate merges on smoke, gate releases on probes.

---

### Validation Checklist (run before demo)

```bash
# Quick confidence (5 min)
bun run validate smoke

# Live infrastructure (10 min)
bun run validate probe:onchain-live
bun run validate probe:archive-live
bun run validate probe:session-key-live

# Full if time (20 min)
bun run validate core-loop
```

### How to update this plan

Agents: when you complete an item, change its status to DONE and add a one-line note. Example:
```
- **Status**: DONE — added 3 tests in auth-session.test.ts, all passing
```
