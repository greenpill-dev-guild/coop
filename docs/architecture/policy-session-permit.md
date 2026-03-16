---
title: "Policy, Sessions & Permits"
sidebar_label: "Policy & Permits"
sidebar_position: 6
---

# Policy, Sessions & Permits

Coop groups need governance over what actions can be taken, who can take them, and under what constraints. The policy, session, permit, and operator modules compose into a layered authorization system that governs every privileged action -- from archiving an artifact to deploying a Safe to minting a Green Goods garden.

All four modules live in `packages/shared/src/modules/` and export through `@coop/shared`. Every domain type is a Zod schema in `contracts/schema.ts`.

## Architecture Overview

```
                           Policy Layer
                    (defines approval rules)
                              |
                  +-----------+-----------+
                  |                       |
           Session Layer            Permit Layer
     (scoped on-chain keys)    (delegated off-chain auth)
                  |                       |
                  +-----------+-----------+
                              |
                       Operator Layer
                (anchor node runtime + UI)
                              |
                        Executor
                   (bounded dispatch)
```

The four layers compose in a clear hierarchy:

1. **Policy** defines the rules: which action classes require approval, replay protection, expiry, and scope constraints.
2. **Session** provides scoped on-chain execution through ERC-4337 smart session keys, bounded by time, usage count, action allowlists, and target address allowlists.
3. **Permit** provides scoped off-chain delegation for actions like archive uploads and draft publishing, bounded by the same constraints.
4. **Operator** ties them together: the anchor node runtime manages the approval queue, dispatches execution, and logs every privileged action.

---

## Policy Module

**Source:** `packages/shared/src/modules/policy/`

The policy module defines action approval workflows for coop governance. Every privileged action in the system is classified by an action class and governed by a corresponding policy.

### Action Classes

The `PolicyActionClass` enum defines the complete set of governed actions:

| Action Class | Domain | Description |
|---|---|---|
| `archive-artifact` | Archive | Upload a single artifact to Storacha/Filecoin |
| `archive-snapshot` | Archive | Archive the full coop state snapshot |
| `refresh-archive-status` | Archive | Check Filecoin deal status for pending receipts |
| `publish-ready-draft` | Content | Publish a reviewed draft to one or more coops |
| `safe-deployment` | Onchain | Deploy a new Safe multisig for a coop |
| `green-goods-create-garden` | Green Goods | Mint a new garden NFT |
| `green-goods-sync-garden-profile` | Green Goods | Update garden metadata on-chain |
| `green-goods-set-garden-domains` | Green Goods | Set garden domain categories |
| `green-goods-create-garden-pools` | Green Goods | Create assessment pools for a garden |
| `green-goods-submit-work-approval` | Green Goods | Approve or reject submitted work |
| `green-goods-create-assessment` | Green Goods | Create a new assessment round |
| `green-goods-sync-gap-admins` | Green Goods | Add/remove GAP administrators |
| `erc8004-register-agent` | ERC-8004 | Register an agent on-chain |
| `erc8004-give-feedback` | ERC-8004 | Submit feedback for an on-chain agent |

### ActionPolicy Schema

```typescript
// contracts/schema.ts
const actionPolicySchema = z.object({
  id: z.string().min(1),              // e.g. "policy-abc123"
  actionClass: policyActionClassSchema,
  approvalRequired: z.boolean().default(true),
  expiresAt: z.string().datetime().optional(),
  replayProtection: z.boolean().default(true),
  coopId: z.string().min(1).optional(),    // scope to specific coop
  memberId: z.string().min(1).optional(),  // scope to specific member
  targetConstraints: z.record(z.string()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

Key fields:

- **`approvalRequired`**: When `true`, action bundles start as `proposed` and must be explicitly approved before execution. When `false`, bundles are created in the `approved` state and can execute immediately.
- **`replayProtection`**: When `true`, each bundle's `replayId` is tracked in a `ReplayGuard` to prevent double-execution.
- **`coopId` / `memberId`**: Optional scope constraints. A policy with `coopId: "coop-abc"` only matches bundles targeting that coop.
- **`expiresAt`**: Optional time-bound on the policy itself (distinct from bundle expiry).

### Policy Lifecycle Functions

```typescript
// Create default policies (one per action class, all requiring approval)
createDefaultPolicies(input?: { coopId?; memberId?; createdAt? }): ActionPolicy[]

// Create a single policy with explicit settings
createPolicy(input: {
  actionClass: PolicyActionClass;
  approvalRequired?: boolean;    // default: true
  expiresAt?: string;
  replayProtection?: boolean;    // default: true
  coopId?: string;
  memberId?: string;
  targetConstraints?: Record<string, string>;
}): ActionPolicy

// Find the first policy matching an action class + scope
findMatchingPolicy(policies, { actionClass, coopId?, memberId? }): ActionPolicy | undefined

// Patch fields on an existing policy
updatePolicy(policies, policyId, patch): ActionPolicy[]

// Upsert: update existing or create new for a given action class
upsertPolicyForActionClass(policies, actionClass, patch, defaults?): ActionPolicy[]

// Check time-based expiration
isPolicyExpired(policy, now?): boolean
```

### Typed Action Bundles (EIP-712)

Every action is wrapped in an `ActionBundle` -- a typed, digestible envelope containing the action payload, metadata, and an EIP-712 typed hash for on-chain verification.

```typescript
// contracts/schema.ts
const actionBundleSchema = z.object({
  id: z.string().min(1),              // e.g. "bundle-xyz789"
  replayId: z.string().min(1),        // unique nonce for replay protection
  actionClass: policyActionClassSchema,
  coopId: z.string().min(1),
  memberId: z.string().min(1),
  payload: z.record(z.any()),          // action-specific data
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),    // default: 24 hours from creation
  policyId: z.string().min(1),
  status: actionBundleStatusSchema,    // proposed | approved | rejected | executed | failed | expired
  digest: z.string().min(1),           // EIP-712 typed data hash
  typedAuthorization: typedActionBundleSchema.optional(),
  approvedAt: z.string().datetime().optional(),
  rejectedAt: z.string().datetime().optional(),
  executedAt: z.string().datetime().optional(),
  failedAt: z.string().datetime().optional(),
  failureReason: z.string().optional(),
});
```

The `typedAuthorization` field contains the full EIP-712 structured data used to compute the digest:

```typescript
const typedActionBundleSchema = z.object({
  domain: z.object({
    name: z.literal("Coop Action Bundle"),  // domain separator
    version: z.literal("1"),
    chainId: z.number(),                     // from getCoopChainConfig()
    verifyingContract: z.string(),           // Safe address or zero address
  }),
  types: {
    CoopActionBundle: [
      { name: "actionClass", type: "string" },
      { name: "coopId", type: "string" },
      { name: "memberId", type: "string" },
      { name: "replayId", type: "string" },
      { name: "payloadHash", type: "bytes32" },  // JSON hash of payload
      { name: "createdAt", type: "string" },
      { name: "expiresAt", type: "string" },
      { name: "chainKey", type: "string" },
      { name: "safeAddress", type: "address" },
    ],
  },
  primaryType: "CoopActionBundle",
  message: { /* field values */ },
  digest: z.string(),  // hashTypedData(domain + types + message)
});
```

The `payloadHash` is computed via `hashJson(payload)`, binding the typed digest to the exact action payload without embedding the full payload in the typed data.

### Bundle Creation

```typescript
createActionBundle(input: {
  actionClass: PolicyActionClass;
  coopId: string;
  memberId: string;
  payload: Record<string, unknown>;
  policy: ActionPolicy;
  expiresAt?: string;     // default: 24h from creation
  chainId?: number;
  chainKey?: "arbitrum" | "sepolia";
  safeAddress?: `0x${string}`;
}): ActionBundle
```

The initial status depends on the policy: if `approvalRequired` is `true`, the bundle starts as `proposed`; otherwise it starts as `approved`.

### Scoped Payload Resolution

Each action class has a dedicated resolver in `resolveScopedActionPayload()` that validates and normalizes the payload. This ensures:

- Required fields are present and correctly typed
- Coop ID scope constraints are enforced (`expectedCoopId` check)
- Target IDs are extracted for allowlist checks in session and permit validation
- Address fields match `0x[a-fA-F0-9]{40}` format
- Domain-specific validation (e.g., Green Goods weight schemes, domain enums)

### Approval State Machine

Bundle status follows a strict state machine with these valid transitions:

```
proposed ──> approved ──> executed
    │            │
    │            ├──> failed
    │            │
    │            └──> expired
    │
    ├──> rejected
    │
    └──> expired
```

Terminal states (`rejected`, `executed`, `failed`, `expired`) have no outgoing transitions. The `canTransition(from, to)` function enforces this.

Convenience functions:

```typescript
approveBundle(bundle, timestamp?): ActionBundle | { error: string }
rejectBundle(bundle, timestamp?): ActionBundle | { error: string }
markBundleExecuted(bundle, timestamp?): ActionBundle | { error: string }
markBundleFailed(bundle, failureReason, timestamp?): ActionBundle | { error: string }
expireBundle(bundle, timestamp?): ActionBundle | { error: string }

// Batch: expire all proposed/approved bundles past their expiresAt
expireStaleBundles(bundles, now?): ActionBundle[]

// Filters
pendingBundles(bundles): ActionBundle[]     // proposed + approved
completedBundles(bundles): ActionBundle[]   // executed + failed + rejected + expired
```

### Replay Protection

The `ReplayGuard` is an immutable set of consumed replay IDs. Every action bundle receives a unique `replayId` at creation. Before execution, the guard checks whether that ID has already been consumed.

```typescript
interface ReplayGuard {
  consumedIds: Set<string>;
}

createReplayGuard(existingIds?: string[]): ReplayGuard
checkReplayId(guard, replayId): { ok: true } | { ok: false; reason: string }
recordExecutedReplayId(guard, replayId): ReplayGuard  // returns new guard (immutable)
exportConsumedReplayIds(guard): string[]               // for persistence
```

The guard is immutable -- `recordExecutedReplayId` returns a new `ReplayGuard` with the ID added, leaving the original unchanged. This makes it safe to use in functional pipelines and ensures the guard can only grow.

### Bounded Executor

The executor validates all preconditions before dispatching to an action handler:

```typescript
interface ExecutionResult {
  ok: boolean;
  bundle: ActionBundle;        // updated with terminal status
  replayGuard: ReplayGuard;   // updated if execution succeeded
  detail: string;
}

type ActionHandler = (payload: Record<string, unknown>) =>
  Promise<{ ok: boolean; error?: string; data?: unknown }>;

type ActionHandlerRegistry = Partial<Record<PolicyActionClass, ActionHandler>>;
```

The `executeBundle()` function performs these checks in order:

1. **Status gate**: Only `approved` bundles can execute
2. **Expiry check**: Rejects bundles past their `expiresAt`
3. **Replay check**: Rejects bundles with consumed replay IDs (when policy has `replayProtection`)
4. **Bundle validation**: Re-verifies digest, typed authorization, policy match, and payload resolution
5. **Handler dispatch**: Routes to the registered handler for the action class
6. **Result recording**: On success, marks `executed` and records the replay ID. On failure, marks `failed` with the error reason.

If no handler is registered for the action class, execution fails with a descriptive error rather than silently succeeding.

### Audit Logging

Every bundle lifecycle event is logged via `ActionLogEntry`:

```typescript
const actionLogEventTypeSchema = z.enum([
  "proposal-created",
  "proposal-approved",
  "proposal-rejected",
  "execution-started",
  "execution-succeeded",
  "execution-failed",
  "replay-rejected",
  "expiry-rejected",
]);
```

The log is a bounded, reverse-chronological array (default limit: 100 entries). `appendActionLog()` inserts entries in sorted position and trims the oldest when the limit is reached.

---

## Session Module

**Source:** `packages/shared/src/modules/session/`

The session module provides scoped on-chain execution through ERC-4337 smart session keys. Sessions are the bridge between the browser extension and Safe smart accounts -- they allow bounded, delegated execution of on-chain transactions without requiring the full Safe owner key for every action.

### Session-Capable Action Classes

Not all action classes support session-key execution. Phase 1 is scoped to Green Goods on-chain operations:

```typescript
const SESSION_CAPABLE_ACTION_CLASSES = [
  "green-goods-create-garden",
  "green-goods-sync-garden-profile",
  "green-goods-set-garden-domains",
  "green-goods-create-garden-pools",
] as const;
```

Each session-capable action maps to specific Solidity function selectors that the session key is authorized to call:

| Action Class | Solidity Functions |
|---|---|
| `green-goods-create-garden` | `mintGarden(...)` |
| `green-goods-sync-garden-profile` | `updateName`, `updateDescription`, `updateLocation`, `updateBannerImage`, `updateMetadata`, `setOpenJoining`, `setMaxGardeners` |
| `green-goods-set-garden-domains` | `setGardenDomains(address,uint8)` |
| `green-goods-create-garden-pools` | `createGardenPools(address)` |

### SessionCapability Schema

```typescript
const sessionCapabilitySchema = z.object({
  id: z.string().min(1),               // e.g. "session-abc123"
  coopId: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  revokedAt: z.string().datetime().optional(),
  lastUsedAt: z.string().datetime().optional(),

  // On-chain session key identity
  permissionId: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  sessionAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  validatorAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  validatorInitData: z.string().regex(/^0x[a-fA-F0-9]*$/),

  // Status
  status: sessionCapabilityStatusSchema,  // active | expired | revoked | exhausted | unusable
  statusDetail: z.string().min(1),
  lastValidationFailure: sessionCapabilityFailureReasonSchema.optional(),
  moduleInstalledAt: z.string().datetime().optional(),
  enableSignature: z.string().regex(/^0x[a-fA-F0-9]*$/).optional(),

  // Scope constraints
  scope: sessionCapabilityScopeSchema,

  // Identity
  issuedBy: z.object({
    memberId: z.string().min(1),
    displayName: z.string().min(1),
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  }),
  executor: z.object({
    label: z.string().min(1),
    localIdentityId: z.string().min(1).optional(),
  }),

  usedCount: z.number().int().nonnegative().default(0),
});
```

### Scope Constraints

Every session is bounded by a `SessionCapabilityScope`:

```typescript
const sessionCapabilityScopeSchema = z.object({
  allowedActions: z.array(sessionCapableActionClassSchema).min(1),
  targetAllowlist: z.record(z.array(z.string())).default({}),
  maxUses: z.number().int().positive(),
  expiresAt: z.string().datetime(),
  chainKey: coopChainKeySchema,         // "arbitrum" | "sepolia"
  safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});
```

- **`allowedActions`**: Whitelist of action classes this session can execute
- **`targetAllowlist`**: Per-action-class mapping of allowed contract addresses. The session cannot call contracts outside this list.
- **`maxUses`**: Hard cap on total executions before the session becomes `exhausted`
- **`expiresAt`**: Absolute expiration timestamp
- **`chainKey`** + **`safeAddress`**: Pin the session to a specific Safe on a specific chain

### Session Status Lifecycle

```
active ──> expired     (expiresAt passed)
   │
   ├──> revoked        (explicit revocation)
   │
   ├──> exhausted      (usedCount >= maxUses)
   │
   └──> unusable       (missing infrastructure: Pimlico, Safe, session material)
            │
            └──> active  (infrastructure restored, revalidation succeeds)
```

The `unusable` state is unique: it is recoverable. If a session key is marked `unusable` because Pimlico was not configured, it can return to `active` once Pimlico is set up and `validateSessionCapabilityForBundle()` passes. All other terminal states are permanent.

Failure reasons tracked by `lastValidationFailure`:

| Reason | Meaning |
|---|---|
| `expired` | Session time window elapsed |
| `revoked` | Explicitly revoked by operator |
| `exhausted` | Usage limit reached |
| `allowlist-mismatch` | Target contract not in the session allowlist |
| `action-denied` | Action class not in the session's allowed set |
| `missing-safe` | Coop Safe not deployed or address mismatch |
| `missing-pimlico` | Pimlico API key not configured for live execution |
| `wrong-chain` | Bundle targets a different chain than the session scope |
| `missing-session-material` | Encrypted private key not available on this browser profile |
| `unsupported-action` | Action class is outside the phase-1 session scope |
| `module-unavailable` | Smart Sessions module not installed on the Safe |

### Session Key Material

Session keys are generated locally in the browser:

```typescript
createSessionSignerMaterial(): {
  privateKey: Hex;
  sessionAddress: Address;
  validatorAddress: Address;
  validatorInitData: Hex;
}
```

This generates a fresh secp256k1 private key, derives the address, and configures a Rhinestone `OwnableValidator` with threshold 1 (single-signer).

### Encrypted Session Material

The session private key is never stored in plaintext. It is encrypted using AES-256-GCM with a key derived via PBKDF2 (120,000 iterations, SHA-256) from a random wrapping secret:

```typescript
const encryptedSessionMaterialSchema = z.object({
  capabilityId: z.string().min(1),
  sessionAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  ciphertext: z.string().min(1),   // base64-encoded AES-GCM ciphertext
  iv: z.string().min(1),           // base64-encoded 12-byte IV
  salt: z.string().optional(),      // base64-encoded 16-byte salt (per-encryption)
  algorithm: z.literal("aes-gcm"),
  wrappedAt: z.string().datetime(),
  version: z.literal(1),
});
```

Each encryption generates a unique random salt and IV, ensuring that encrypting the same key twice produces different ciphertext. The `salt` field was added after the initial implementation; the decrypt function falls back to a static context string for legacy records that lack it.

### Smart Session Integration (ERC-4337)

The session module builds Rhinestone smart session objects for on-chain installation:

```typescript
buildSmartSession(input: { capability: SessionCapability }): {
  session: Session;           // Rhinestone Session object
  permissionId: Hex;          // Unique permission identifier
  modules: {
    validator: SmartSessionsValidator;
    fallback: SmartSessionsCompatibilityFallback;
  };
}
```

The built session includes:

- **UserOp policies**: `TimeFramePolicy` (valid until `scope.expiresAt`) and `UsageLimitPolicy` (capped at `scope.maxUses`)
- **Action entries**: Each allowed action class is expanded into `(target address, function selector)` pairs from the `GREEN_GOODS_ACTION_SELECTORS` mapping
- **ERC-4337 paymaster**: Enabled (`permitERC4337Paymaster: true`) so the session key does not need to hold ETH

Additional functions for the Safe owner workflow:

```typescript
// Generate the on-chain transaction to enable the session
buildEnableSessionExecution(capability): { permissionId; execution }

// Generate the on-chain transaction to remove the session
buildRemoveSessionExecution(capability): { permissionId; execution }

// Wrap a validator signature for use with the smart sessions module
wrapUseSessionSignature(input: { capability; validatorSignature }): Hex

// Check if the session is currently enabled on-chain
checkSessionCapabilityEnabled(input: { client; capability }): Promise<boolean>
```

### Session Validation for Bundle Execution

Before executing a bundle through a session key, `validateSessionCapabilityForBundle()` performs a comprehensive check:

1. Verify the action class is session-capable (phase-1 scope)
2. Verify the session status is `active` (not revoked, expired, exhausted, or unusable)
3. Verify encrypted session material is available on this browser profile
4. Verify Pimlico API key is configured (required for live 4337 execution)
5. Verify Safe address exists and matches the session scope
6. Verify chain key matches the session scope
7. Verify the action class is in the session's `allowedActions`
8. Resolve execution targets from the bundle payload and verify they are in the session's `targetAllowlist`
9. Verify typed authorization metadata is present and matches the session scope

If any check fails, the function returns the failure reason and may transition the session to `unusable` with the specific `lastValidationFailure` set for diagnostics.

### Session Audit Logging

Session lifecycle events are logged via `SessionCapabilityLogEntry`:

```typescript
const sessionCapabilityLogEventTypeSchema = z.enum([
  "session-issued",
  "session-rotated",
  "session-revoked",
  "session-module-installed",
  "session-module-install-failed",
  "session-execution-attempted",
  "session-execution-succeeded",
  "session-execution-failed",
  "session-validation-rejected",
]);
```

Each entry includes the capability ID, coop ID, optional action class, bundle ID, replay ID, and failure reason for traceability.

---

## Permit Module

**Source:** `packages/shared/src/modules/permit/`

The permit module provides execution permits for delegated off-chain actions. While sessions handle on-chain transactions via smart session keys, permits handle off-chain privileged operations like Storacha uploads and draft publishing.

### Delegated Action Classes

Permits are scoped to a subset of action classes that do not require on-chain transactions:

```typescript
const delegatedActionClassSchema = z.enum([
  "archive-artifact",
  "archive-snapshot",
  "refresh-archive-status",
  "publish-ready-draft",
]);
```

### ExecutionPermit Schema

```typescript
const executionPermitSchema = z.object({
  id: z.string().min(1),              // e.g. "permit-abc123"
  coopId: z.string().min(1),
  issuedBy: z.object({
    memberId: z.string().min(1),
    displayName: z.string().min(1),
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  }),
  executor: z.object({
    label: z.string().min(1),                      // e.g. "inference-bridge", "operator-console"
    localIdentityId: z.string().min(1).optional(),  // passkey identity binding
  }),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().optional(),
  maxUses: z.number().int().positive(),
  usedCount: z.number().int().nonnegative().default(0),
  allowedActions: z.array(delegatedActionClassSchema).min(1),
  targetAllowlist: z.record(z.array(z.string())).optional(),
  policyRef: z.string().min(1).optional(),  // link to governing ActionPolicy
  status: permitStatusSchema,               // active | expired | revoked | exhausted
});
```

Key design points:

- **`executor`**: Binds the permit to a specific runtime label and optionally a specific local passkey identity. A permit issued to `"inference-bridge"` cannot be used by `"operator-console"`.
- **`targetAllowlist`**: Per-action-class mapping of allowed target IDs. For `archive-artifact`, this might restrict which artifact IDs can be archived. When absent, any target is allowed.
- **`policyRef`**: Optional back-reference to the `ActionPolicy` that governs this action class, connecting permits to the policy layer.

### Permit Status Lifecycle

```
active ──> expired     (expiresAt passed)
   │
   ├──> revoked        (explicit revocation)
   │
   └──> exhausted      (usedCount >= maxUses)
```

Unlike sessions, permits have no `unusable` state -- they are either active or terminally inactive.

```typescript
computePermitStatus(permit, now?): PermitStatus  // recompute from fields
refreshPermitStatus(permit, now?): ExecutionPermit  // update status field if stale
isPermitUsable(permit, now?): boolean  // shorthand: status === "active"
```

### Permit Lifecycle Functions

```typescript
createExecutionPermit(input: {
  coopId: string;
  issuedBy: { memberId; displayName; address? };
  executor: { label; localIdentityId? };
  expiresAt: string;
  maxUses: number;
  allowedActions: DelegatedActionClass[];
  targetAllowlist?: Record<string, string[]>;
  policyRef?: string;
}): ExecutionPermit

revokePermit(permit, now?): ExecutionPermit
incrementPermitUsage(permit): ExecutionPermit
```

### Permit Enforcement

The `validatePermitForExecution()` function is the primary enforcement gate. It checks, in order:

1. **Revocation**: Rejects if `revokedAt` is set
2. **Expiry**: Rejects if `expiresAt <= now`
3. **Usage limit**: Rejects if `usedCount >= maxUses`
4. **Replay ID**: Rejects blank replay IDs
5. **Coop scope**: Rejects if the permit's `coopId` does not match the action's target coop
6. **Action allowlist**: Rejects if the action class is not in `allowedActions`
7. **Executor binding**: Rejects if the executor label does not match; rejects if `localIdentityId` is set and does not match
8. **Target allowlist**: If the permit has a `targetAllowlist` for this action class, rejects targets not in the list
9. **Replay protection**: Checks the replay ID against the shared `ReplayGuard`

Each rejection returns a typed `rejectType` for precise error handling:

```typescript
type PermitValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: string;
      rejectType:
        | "expired"
        | "revoked"
        | "exhausted"
        | "action-denied"
        | "coop-denied"
        | "target-denied"
        | "executor-denied"
        | "replay-rejected";
    };
```

### Permit Audit Logging

Every permit lifecycle event is logged via `PermitLogEntry`:

```typescript
const permitLogEventTypeSchema = z.enum([
  "permit-issued",
  "permit-revoked",
  "permit-expired",
  "delegated-execution-attempted",
  "delegated-execution-succeeded",
  "delegated-execution-failed",
  "delegated-replay-rejected",
  "delegated-exhausted-rejected",
]);
```

The log is a bounded, reverse-chronological array (default limit: 100 entries) with the same append/trim semantics as the policy action log.

---

## Operator Module

**Source:** `packages/shared/src/modules/operator/`

The operator module provides the anchor/trusted-node runtime that ties policy, session, and permit together. An "anchor" is a browser extension instance with elevated privileges -- it can perform live archive uploads, Safe deployments, and Green Goods transactions.

### Anchor Capability

The `AnchorCapability` represents whether anchor mode is enabled and who activated it:

```typescript
const anchorCapabilitySchema = z.object({
  enabled: z.boolean().default(false),
  nodeId: z.string().min(1).default("coop-extension"),
  updatedAt: z.string().datetime(),
  actorAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  actorDisplayName: z.string().min(1).optional(),
  memberId: z.string().min(1).optional(),
  memberDisplayName: z.string().min(1).optional(),
});
```

The anchor capability is bound to a specific authenticated member session via `actorAddress`. This ensures that if member A enables anchor mode and member B logs in, anchor mode is not inherited -- member B must explicitly re-enable it.

```typescript
// Check if anchor mode is active for the current auth session
isAnchorCapabilityActive(capability, authSession): boolean

// Describe the current state with a human-readable detail string
describeAnchorCapabilityStatus({ capability, authSession }): {
  enabled: boolean;
  active: boolean;
  detail: string;
}
```

Address comparison is case-insensitive (EIP-55 checksum safe).

### Privileged Action Types

The operator tracks a distinct set of privileged action types (broader than policy action classes):

```typescript
const privilegedActionTypeSchema = z.enum([
  "anchor-mode-toggle",
  "archive-upload",
  "archive-follow-up-refresh",
  "archive-anchor",
  "safe-deployment",
  "green-goods-transaction",
]);
```

### Privileged Action Log

Every privileged operation is recorded with rich context:

```typescript
const privilegedActionLogEntrySchema = z.object({
  id: z.string().min(1),
  actionType: privilegedActionTypeSchema,
  status: privilegedActionStatusSchema,   // attempted | succeeded | failed
  detail: z.string().min(1),
  createdAt: z.string().datetime(),
  context: privilegedActionContextSchema.default({}),
});

const privilegedActionContextSchema = z.object({
  coopId: z.string().optional(),
  coopName: z.string().optional(),
  memberId: z.string().optional(),
  memberDisplayName: z.string().optional(),
  actorAddress: z.string().optional(),
  chainKey: coopChainKeySchema.optional(),
  artifactId: z.string().optional(),
  receiptId: z.string().optional(),
  archiveScope: archiveScopeSchema.optional(),
  mode: integrationModeSchema.optional(),
});
```

The log is bounded (default limit: 50 entries) and maintained in reverse chronological order.

### Operator Console Workflow

The operator console (rendered in the extension's sidepanel) is the human interface for the entire authorization stack:

1. **Toggle anchor mode**: Enable/disable live privileged operations
2. **Review proposals**: View pending action bundles, approve or reject them
3. **Monitor sessions**: See active session keys, their scope, usage count, and status
4. **Manage permits**: Issue, revoke, and monitor execution permits
5. **View audit trail**: Browse privileged action logs, action bundle logs, session logs, and permit logs

---

## Integration: How the Modules Compose

### End-to-End Flow: On-Chain Action (Session Path)

```
1. Agent proposes "green-goods-create-garden"
   └─> createActionBundle() with policy lookup
       └─> Bundle status: "proposed" (approvalRequired: true)

2. Operator reviews in console
   └─> approveBundle()
       └─> Bundle status: "approved"

3. Executor validates pre-conditions
   └─> validateExecution(): status, expiry, replay, digest
   └─> validateSessionCapabilityForBundle(): scope, chain, safe, targets, material
       └─> All checks pass

4. Session key signs the UserOp
   └─> decryptSessionPrivateKey() with wrapping secret
   └─> wrapUseSessionSignature() encodes the smart session signature

5. UserOp submitted via Pimlico bundler (ERC-4337)
   └─> On success: markBundleExecuted(), recordExecutedReplayId()
   └─> incrementSessionCapabilityUsage()

6. Audit trail
   └─> createActionLogEntry("execution-succeeded")
   └─> createSessionCapabilityLogEntry("session-execution-succeeded")
   └─> createPrivilegedActionLogEntry("green-goods-transaction", "succeeded")
```

### End-to-End Flow: Off-Chain Action (Permit Path)

```
1. Agent proposes "archive-artifact"
   └─> createActionBundle() with policy lookup
       └─> Bundle status: "proposed" or "approved" (depends on policy)

2. If proposed, operator approves
   └─> approveBundle()

3. Executor validates pre-conditions
   └─> validateExecution(): status, expiry, replay, digest
   └─> validatePermitForExecution(): revocation, expiry, usage, coop, action,
       executor, targets, replay

4. Handler performs the archive upload
   └─> On success: markBundleExecuted(), recordExecutedReplayId()
   └─> incrementPermitUsage()

5. Audit trail
   └─> createActionLogEntry("execution-succeeded")
   └─> createPermitLogEntry("delegated-execution-succeeded")
   └─> createPrivilegedActionLogEntry("archive-upload", "succeeded")
```

### Trust Model

The authorization system maintains several security invariants:

**No implicit authority.** Every privileged action requires an explicit policy, and the default policy set requires approval for all action classes. Disabling approval for an action class is an explicit configuration choice.

**Defense in depth.** Actions pass through multiple validation layers: policy matching, bundle validation (digest + typed authorization), replay protection, and either session validation or permit enforcement. Compromising one layer does not grant execution authority.

**Scope minimization.** Sessions and permits are scoped to specific action classes, target addresses, chains, coops, and executors. A session key authorized for `green-goods-create-garden` on Sepolia cannot execute `safe-deployment` or operate on Arbitrum.

**Replay prevention.** The `ReplayGuard` is an append-only set. Once a replay ID is consumed, it can never be reused. The guard is immutable (returns new instances), preventing accidental mutation.

**Time-bounded authority.** Both sessions and permits have mandatory `expiresAt` fields. The policy layer adds optional `expiresAt` on policies themselves. Bundles default to 24-hour TTL.

**Encrypted key material.** Session private keys are encrypted at rest using AES-256-GCM with PBKDF2-derived keys. The wrapping secret never leaves the browser profile. Each encryption uses a unique random salt and IV.

**Audit completeness.** Every state transition is logged across three complementary log systems: action logs (bundle lifecycle), session/permit logs (capability lifecycle), and privileged action logs (operator-level events). Logs are bounded to prevent unbounded storage growth.

### Relationship to Safe Smart Accounts

The coop's on-chain identity is a Safe multisig. The authorization stack integrates with Safe as follows:

- **Policies** define which actions require approval before the Safe executes them
- **Sessions** install as Rhinestone smart session modules on the Safe, enabling delegated execution with on-chain enforcement of time, usage, and action constraints
- **The Safe address** is embedded in the EIP-712 typed data domain, binding bundle digests to a specific Safe
- **Chain configuration** is resolved via `getCoopChainConfig()`, never hardcoded

---

## Key Files

| File | Role |
|---|---|
| `shared/src/modules/policy/policy.ts` | Policy CRUD: create, find, update, upsert, expiry checks |
| `shared/src/modules/policy/action-bundle.ts` | Bundle creation, EIP-712 typed data, scoped payload resolution, validation |
| `shared/src/modules/policy/approval.ts` | State machine transitions, batch expiry, status filters |
| `shared/src/modules/policy/executor.ts` | Bounded execution: pre-validation, handler dispatch, replay recording |
| `shared/src/modules/policy/replay.ts` | Immutable replay guard: check, record, export |
| `shared/src/modules/policy/log.ts` | Action log entries: create, append, format labels |
| `shared/src/modules/session/session.ts` | Session capabilities, smart session building, encryption, validation |
| `shared/src/modules/permit/permit.ts` | Permit CRUD: create, revoke, increment, status lifecycle |
| `shared/src/modules/permit/enforcement.ts` | Permit enforcement: 9-step validation gate |
| `shared/src/modules/permit/log.ts` | Permit log entries: create, append, format labels |
| `shared/src/modules/operator/operator.ts` | Anchor capability, privileged action logging |
| `shared/src/contracts/schema.ts` | All Zod schemas for domain types |
