---
name: security
user-invocable: false
description: Application security - passkey credentials, Safe multisig, extension runtime, signaling server, receiver HMAC, archive encryption, session keys, permits, agent pipeline, invite codes, CRDT integrity, stealth addresses, ZK proofs. Use for security reviews, pre-release audits, and threat modeling.
version: "2.0.0"
status: active
packages: ["shared", "extension", "app", "api"]
dependencies: []
last_updated: "2026-03-31"
last_verified: "2026-03-31"
---

# Security Skill

Comprehensive application security guide covering all trust boundaries in the Coop stack: browser extension runtime, signaling server, peer sync, cross-device pairing, onchain operations, local encryption, and identity.

---

## Activation

| Trigger | Action |
|---------|--------|
| "security audit", "security review" | Full application security review (all parts) |
| "check for vulnerabilities" | Targeted vulnerability scan |
| "access control review" | Safe/passkey/session-key access control audit |
| Pre-release | Mandatory security checklist (Part 12) |

---

## Part 1: Passkey & Authentication Security

### Passkey Credential Safety

```typescript
// ALWAYS: Validate passkey responses before trusting
async function verifyPasskeyAuth(credential: PublicKeyCredential) {
  // Verify the credential came from our relying party
  if (!credential.response) {
    throw new Error("Invalid credential response");
  }

  // Only store: credential ID, public key, user handle
  // NEVER store raw passkey private material
}

// NEVER: Log or transmit passkey credential details
// NEVER: Store private key material in localStorage/IndexedDB
```

### Session Management

```typescript
// ALWAYS: Expire sessions after inactivity
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// ALWAYS: Clear sensitive state on logout
function signOut() {
  authStore.reset();
  clearSensitiveData();
  // Don't clear local Dexie data (it's the user's local data)
}
```

---

## Part 2: Safe & Onchain Security

### Safe Transaction Safety

```typescript
// ALWAYS: Verify Safe address before transactions
async function verifySafeOwnership(safeAddress: Address, userAddress: Address) {
  const owners = await getSafeOwners(safeAddress);
  if (!owners.includes(userAddress)) {
    throw new Error("User is not a Safe owner");
  }
}

// ALWAYS: Simulate transactions before execution
const simulation = await publicClient.simulateContract({
  address: targetContract,
  abi,
  functionName,
  args,
  account: safeAddress,
});

// NEVER: Skip simulation for Safe transactions
// NEVER: Hardcode Safe addresses
```

### ERC-4337 Security

| Risk | Mitigation |
|------|------------|
| Bundler manipulation | Verify bundler responses, check UserOp on-chain |
| Gas estimation attacks | Add buffer to gas estimates, set max gas limits |
| Paymaster spoofing | Verify paymaster contract address |
| Nonce replay | Always use fresh nonces from entrypoint |

---

## Part 3: Local Data Protection

### IndexedDB/Dexie Security

```typescript
// ALWAYS: Scope data access to authenticated user
async function getUserData(userId: string) {
  return db.tabs.where("userId").equals(userId).toArray();
}

// NEVER: Store unencrypted secrets in IndexedDB
// NEVER: Store API keys, private keys, or tokens in Dexie

// ALWAYS: Clean up sensitive data
async function clearUserSession(userId: string) {
  await db.sessions.where("userId").equals(userId).delete();
}
```

### Extension Storage Security

```typescript
// ALWAYS: Use chrome.storage.local for extension state (encrypted at rest by browser)
// NEVER: Use localStorage in extension context (accessible to content scripts)
// NEVER: Store credentials in chrome.storage.sync (synced to Google account)

// Extension permissions: request minimum required
// manifest.json: only request "activeTab", "storage", "sidePanel" etc.
// NEVER: Request "tabs" permission unless absolutely needed (exposes all tab URLs)
```

---

## Part 4: CRDT / Yjs Integrity

### Peer Trust Model

Yjs syncs with any connected peer. The codebase uses `ORIGIN_LOCAL` tagging to distinguish local writes from remote merges.

```typescript
// ALWAYS: Tag local writes with origin
doc.transact(() => { /* ... */ }, ORIGIN_LOCAL);

// ALWAYS: Validate data structure after Yjs merge
function validateCoopState(yDoc: Y.Doc): boolean {
  const yMap = yDoc.getMap("coop");
  // Verify required fields present and well-typed
  if (!yMap.get("profile") || !yMap.get("members")) return false;
  return true;
}

// ALWAYS: Use per-member CRDT maps to prevent cross-member overwrites
// See: packages/shared/src/modules/storage/ for the origin-tagged pattern
```

### Room Security

```typescript
// ALWAYS: Use unique, unpredictable room names derived from coop state
const roomName = `coop-${coopId}-${syncRoomSecret}`;

// ALWAYS: Encrypt y-webrtc rooms when possible
const provider = new WebrtcProvider(roomName, yDoc, {
  password: coopEncryptionKey,
});

// NEVER: Use predictable or sequential room names
// NEVER: Broadcast room names over unencrypted channels
```

---

## Part 5: Extension Runtime Security

### Message Origin Validation

The background service worker validates all incoming runtime messages against the extension's own origin. This is the primary trust boundary for the extension.

**Canonical pattern** (`packages/extension/src/background.ts`, lines 328-344):

```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const senderUrl = sender.url ?? sender.tab?.url ?? '';

  // Only allow messages from our own extension origin
  if (!senderUrl.startsWith(`chrome-extension://${chrome.runtime.id}`)) {
    // Exception: receiver bridge content script for ingest messages
    if (message.type === 'ingest-receiver-capture') {
      // Allowed — this comes from the isolated content script
    } else {
      sendResponse({ ok: false, error: 'Unauthorized sender.' });
      return true;
    }
  }
  // ... dispatch to handlers
});
```

### Rules

- **ALWAYS**: Check `sender.url` or `sender.tab.url` against `chrome-extension://${chrome.runtime.id}`
- **ALWAYS**: Whitelist specific message types from content scripts, never allow all
- **NEVER**: Accept arbitrary messages from web pages without type filtering
- **NEVER**: Trust `sender.tab.url` for content-script messages from untrusted pages — only trust the message type whitelist

### Content Script Isolation

The receiver bridge (`packages/extension/entrypoints/receiver-bridge.content.ts`) is the only content script and uses strict isolation:

```typescript
export default defineContentScript({
  matches: ['*://*.coop.town/*', 'http://127.0.0.1:3001/*', 'http://localhost:3001/*'],
  world: 'ISOLATED',  // Prevents page scripts from accessing extension APIs
  runAt: 'document_idle',
});
```

**Message filtering rules** (lines 36-56):
1. Verify `event.source === window` (same-frame only)
2. Check `data.source === 'coop-receiver-app'` (app identifier)
3. Validate `requestId` is a string
4. Only allow message types: `'ping'` and `'ingest'`
5. Post responses with `window.location.origin` (restricts delivery)

### Rules

- **ALWAYS**: Use `world: 'ISOLATED'` for content scripts
- **ALWAYS**: Filter by source identifier and enumerate allowed message types
- **ALWAYS**: Respond with `window.location.origin`, not `'*'`
- **NEVER**: Accept arbitrary message types from page context
- **NEVER**: Forward raw page content to the background without validation

---

## Part 6: API & Signaling Server Security

The signaling server (`packages/api/`) is the only network-facing service. It handles WebSocket connections for peer discovery and Yjs document sync.

### Current State

**Middleware** (`packages/api/src/middleware/index.ts`): Only `logger()` is applied.

**WebSocket handler** (`packages/api/src/ws/handler.ts`): Accepts `subscribe`, `unsubscribe`, `publish`, `ping` message types. Topic names are opaque strings.

### Known Gaps (Track These)

| Gap | Risk | Status |
|-----|------|--------|
| No CORS middleware | Any origin can connect | Open |
| No WebSocket authentication | Anyone can subscribe/publish to topics | Open — topic name secrecy is the only barrier |
| No rate limiting | Connection flooding possible | Open |
| No topic authorization | No cryptographic binding of topics to identities | Open |
| No payload validation | `publish` accepts any payload | Open |

### Rules For New API Code

- **ALWAYS**: Validate JSON payloads with Zod schemas before processing
- **ALWAYS**: Add CORS restrictions to known origins when deploying publicly
- **ALWAYS**: Log connection metadata (IP, user-agent) for audit
- **NEVER**: Trust topic names as an authentication mechanism — they are discoverable
- **NEVER**: Accept unbounded payloads — enforce max message size
- **NEVER**: Store sensitive state server-side — the server is a relay, not a data store

### When Adding Authentication

Prefer signed connection tokens over session cookies for WebSocket auth. The connection should carry a proof of coop membership (e.g., a signed challenge or invite proof) that the server can verify without storing secrets.

---

## Part 7: Receiver & Cross-Device Security

### HMAC Envelope Validation

Every receiver sync envelope is signed with HMAC-SHA256 using the pairing secret. This is the trust boundary between the PWA and the extension.

**Canonical pattern** (`packages/shared/src/modules/receiver/capture.ts`, lines 36-92):

Signed fields: `captureId, deviceId, pairingId, coopId, memberId, kind, title, note, sourceUrl, fileName, mimeType, byteSize, createdAt` plus asset metadata.

```typescript
// ALWAYS: Verify HMAC before trusting any receiver envelope
const computedSignature = await hmacSign(pairingSecret, canonicalPayload);
if (computedSignature !== envelope.auth.signature) {
  throw new Error('Receiver envelope signature mismatch');
}

// ALWAYS: Verify pairing binding — envelope must match pairing ID, coop ID, member ID
// ALWAYS: Validate payload structure with Zod before HMAC check (reject malformed early)
```

### Pairing Security

```typescript
// ALWAYS: Generate pairing secrets with crypto.getRandomValues()
// ALWAYS: Store pairing records in chrome.storage.local (encrypted at rest)
// NEVER: Transmit pairing secrets over unencrypted channels
// NEVER: Reuse pairing secrets across devices or coops
```

### Cross-Origin PostMessage

The receiver bridge communicates with the PWA via `postMessage`. Rules:

- **ALWAYS**: Specify `targetOrigin` (use `window.location.origin`, never `'*'`)
- **ALWAYS**: Validate `event.origin` against known receiver origins
- **NEVER**: Accept messages from arbitrary origins

---

## Part 8: Archive & Encryption

### AES-GCM Archive Encryption

**Canonical pattern** (`packages/shared/src/modules/archive/crypto.ts`):

- **Algorithm**: AES-GCM (authenticated encryption)
- **IV**: 12 bytes, cryptographically random per operation (line 58)
- **AAD**: Contextual metadata — `coopId`, `bundleId`, `blobId` (lines 63-67)
- **Key derivation**: SHA-256 hash of archive config JSON (lines 31-49)

### Known Limitations

| Limitation | Risk | Mitigation |
|-----------|------|------------|
| No salt in key derivation | Deterministic key from config | Acceptable if config includes unique secrets |
| No key rotation | Same key for lifetime of archive config | Track for future improvement |
| Key material derived from config JSON | Config ordering matters | Use `hashJson()` for stable serialization |

### Rules

- **ALWAYS**: Generate a fresh random IV per encryption operation
- **ALWAYS**: Include contextual AAD (coopId, blobId) to bind ciphertext to context
- **ALWAYS**: Catch and surface decryption failures explicitly — never silently return empty data
- **NEVER**: Reuse IVs with the same key
- **NEVER**: Log or expose derived key material
- **NEVER**: Store archive encryption keys in IndexedDB unencrypted

---

## Part 9: Session Keys & Permits

### Session Key Wrapping

**Canonical pattern** (`packages/shared/src/modules/session/session.ts`):

- **KDF**: PBKDF2 with 120,000 iterations, SHA-256
- **Salt**: 16 bytes (from stored base64), falls back to `SESSION_WRAPPING_CONTEXT` string if missing
- **Wrapping**: AES-GCM 256-bit key, 12-byte IV

### Session Key Scope Enforcement

Session keys are constrained by (lines 531-601):
1. **Chain binding** — key only valid on specified chain
2. **Safe address binding** — key only valid for specified Safe
3. **Action class allowlist** — only permitted action types
4. **Target address allowlist** — per-action contract whitelisting
5. **Usage counting** — enforced `maxUses` limit (lines 295-316)
6. **Status lifecycle** — Active -> Expired/Revoked/Exhausted

### Permit Enforcement Chain

**Canonical pattern** (`packages/shared/src/modules/permit/enforcement.ts`, lines 22-110):

Validation order (all must pass):
1. Revocation check
2. Expiration check
3. Usage limit check
4. Replay ID validation
5. Coop scope check
6. Action allowlist check
7. Executor label binding
8. Executor passkey identity binding
9. Target allowlist check
10. Replay protection via `checkReplayId()`

### Rules

- **ALWAYS**: Enforce the full permit validation chain — never skip steps
- **ALWAYS**: Use fresh nonces for replay protection
- **ALWAYS**: Decrement usage count atomically with execution
- **NEVER**: Trust client-supplied scope claims — verify against stored permit
- **NEVER**: Fall back to `SESSION_WRAPPING_CONTEXT` salt in production — ensure salt is always stored
- **NEVER**: Allow session keys without explicit target allowlists

---

## Part 10: Agent Pipeline Security

### Skill Output Validation

The agent pipeline runs 16+ skills that produce structured output. All outputs are validated against Zod schemas before use.

**Canonical pattern** (`packages/shared/src/modules/agent/agent.ts`, lines 48-68):

```typescript
// Every skill output has a registered Zod schema
const skillOutputSchemas: Record<SkillOutputSchemaRef, ZodSchema> = {
  'tab-router': tabRouterOutputSchema,
  'opportunity-extractor': opportunityExtractorOutputSchema,
  // ... 16 total skill schemas
};

// ALWAYS: Parse skill output through its registered schema before use
const parsed = skillOutputSchemas[skill.outputSchemaRef].safeParse(rawOutput);
if (!parsed.success) {
  // Reject invalid output
}
```

### Untrusted Input Handling

Captured web content (page titles, meta descriptions, paragraphs, headings) flows into the agent pipeline. This content is attacker-controlled on any public web page.

### Rules

- **ALWAYS**: Validate all skill outputs with Zod schemas before storing or displaying
- **ALWAYS**: Treat extracted page content as untrusted input — never interpolate into code execution contexts
- **ALWAYS**: Deduplicate observations via `hashJson()` fingerprinting to prevent flooding
- **NEVER**: Pass raw page content to `eval()`, `new Function()`, or template engines
- **NEVER**: Use skill output to construct URLs, file paths, or shell commands without validation
- **NEVER**: Trust skill output for authorization decisions — it's advisory only

---

## Part 11: Invite & Membership Security

### Invite Code Signing

**Canonical pattern** (`packages/shared/src/modules/coop/flows.ts`, lines 152-200):

Invite codes are signed with SHA-256 hash combining the `inviteSigningSecret` and serialized bootstrap data (coopId, coopDisplayName, inviteId, inviteType, expiresAt, roomId, signalingUrls, bootstrapState).

```typescript
// Verification recomputes proof and compares
const expectedProof = hashText(inviteSigningSecret + serialize(bootstrapData));
if (expectedProof !== invite.bootstrap.inviteProof) {
  throw new Error('Invalid invite code');
}
```

### Rules

- **ALWAYS**: Verify invite proofs before accepting join requests
- **ALWAYS**: Check expiration (`expiresAt`) before processing
- **ALWAYS**: Track revocation state (`revokedAt`) and reject revoked invites
- **NEVER**: Accept invite codes without proof verification
- **NEVER**: Expose the `inviteSigningSecret` outside the coop's local state

### Stealth Addresses (ERC-5564)

The stealth address module (`packages/shared/src/modules/stealth/stealth.ts`) implements secp256k1 ECDH for unlinkable recipient addresses.

- **ALWAYS**: Generate fresh ephemeral keys per stealth address
- **ALWAYS**: Use the view tag for efficient scanning without exposing spending keys
- **NEVER**: Reuse ephemeral keys across addresses
- **NEVER**: Log or persist stealth private keys in plaintext

### Semaphore ZK Membership Proofs

The privacy module (`packages/shared/src/modules/privacy/membership-proof.ts`) uses Semaphore for anonymous publishing with scope binding.

- **ALWAYS**: Bind proof scope to `coopId` to prevent cross-coop replay
- **ALWAYS**: Bind proof message to `artifactOriginId` to tie proof to specific content
- **ALWAYS**: Reconstruct the full member commitment list for verification
- **NEVER**: Accept proofs without verifying against the current member set

### Blob Relay

The blob relay (`packages/shared/src/modules/blob/relay.ts`) uses Zod schemas for all message types: `request`, `chunk`, `not-found`, `manifest`.

- **ALWAYS**: Validate all relay messages against discriminated union schema
- **ALWAYS**: Enforce chunk index bounds (non-negative, < totalChunks)
- **NEVER**: Accept unbounded blob sizes — enforce max blob size limits
- **NEVER**: Trust `targetConnectionId` for authorization — it's routing only

---

## Part 12: Pre-Release Security Checklist

### Checklist

**Identity & Auth**
- [ ] Passkey credential data never logged or stored improperly
- [ ] Session keys wrapped with PBKDF2 + AES-GCM, salt is not the fallback constant
- [ ] Invite codes verified with proof before join acceptance

**Onchain**
- [ ] All Safe transactions simulated before execution
- [ ] Safe owner verification before privileged operations
- [ ] Session key scope (chain, Safe, actions, targets) correctly enforced
- [ ] Permit enforcement chain runs all 10 validation steps

**Storage & Extension**
- [ ] No secrets in IndexedDB/localStorage
- [ ] Minimum required permissions in manifest.json
- [ ] Content script uses `world: 'ISOLATED'`
- [ ] Background message listener validates sender origin
- [ ] Only whitelisted message types accepted from content scripts

**Network & Sync**
- [ ] All API calls over HTTPS/WSS
- [ ] No sensitive data in URL parameters
- [ ] Receiver envelopes HMAC-signed and verified
- [ ] Yjs room names unpredictable, encrypted when possible
- [ ] PostMessage calls specify explicit `targetOrigin`

**Encryption & Privacy**
- [ ] Archive encryption uses fresh random IV per operation
- [ ] AAD binds ciphertext to context (coopId, blobId)
- [ ] Stealth address ephemeral keys are fresh per address
- [ ] Semaphore proofs scoped to coopId and bound to artifactOriginId

**Agent & Data**
- [ ] All agent skill outputs validated against Zod schemas
- [ ] Captured web content treated as untrusted input
- [ ] Blob relay messages validated against discriminated union schema
- [ ] No PII or credentials in error logs

**Dependencies**
- [ ] `bun audit` clean (no HIGH/CRITICAL)

### Severity Classification

| Severity | Criteria | Action |
|----------|----------|--------|
| **Critical** | Credential leak, unauthorized Safe access, HMAC bypass, key exposure | Block release, fix immediately |
| **High** | Data exposure, session hijack, permit bypass, archive decryption failure | Block release, fix before ship |
| **Medium** | Missing validation, weak defaults, unsalted KDF | Fix recommended, can ship with ack |
| **Low** | Code style, documentation, defense-in-depth | Fix in next iteration |

---

## Part 13: Threat Modeling

### Coop Threat Actors

| Actor | Motivation | Attack Surface |
|-------|-----------|---------------|
| **Malicious peer** | Corrupt shared state, exfiltrate data | Yjs sync, WebRTC, signaling server |
| **Malicious web page** | Inject content, steal session | Content script bridge, captured page data |
| **Extension exploit** | Steal credentials | Content scripts, extension storage, runtime messages |
| **Rogue receiver** | Forge captures, replay envelopes | Receiver HMAC, pairing secret |
| **Network attacker** | Eavesdrop, inject messages | Signaling WebSocket, y-webrtc, blob relay |
| **Phishing** | Steal passkey | Fake auth prompts, social engineering |
| **Local attacker** | Access local data | IndexedDB, browser storage |

### Attack Scenarios

```
1. Yjs State Poisoning:
   Malicious peer -> inject corrupt data -> break coop state
   Mitigation: Validate state after merge, origin-tag local writes, per-member CRDT maps

2. Signaling Topic Hijack:
   Attacker guesses or intercepts topic name -> subscribes -> reads/injects messages
   Mitigation: Unpredictable topic names, future: signed connection tokens
   Current risk: MEDIUM (topic names include secrets, but no cryptographic binding)

3. Receiver Envelope Forgery:
   Attacker without pairing secret -> forge ingest message -> inject fake capture
   Mitigation: HMAC-SHA256 envelope signing with pairing secret (currently enforced)

4. Content Script Message Injection:
   Malicious page -> postMessage to content script -> trigger unauthorized action
   Mitigation: ISOLATED world, source filtering, type allowlist (currently enforced)

5. Extension Privilege Escalation:
   Exploit content script -> access extension storage -> steal session
   Mitigation: Minimal permissions, isolated content scripts (currently enforced)

6. Session Key Scope Escape:
   Compromised session key -> attempt actions outside permitted scope
   Mitigation: 10-step permit enforcement chain, target allowlists (currently enforced)

7. Archive Key Recovery:
   Attacker obtains archive config -> derive encryption key -> decrypt archives
   Mitigation: Config includes secret material, future: add salt and key rotation

8. Agent Prompt Injection:
   Attacker controls page content -> captured into agent pipeline -> manipulate skill output
   Mitigation: Zod schema validation on all skill outputs (currently enforced)
   Current risk: LOW (outputs are structured data, not executed code)

9. Safe Drain:
   Compromised owner key -> execute unauthorized transactions
   Mitigation: Multi-sig threshold, transaction simulation (currently enforced)

10. Passkey Phishing:
    Fake login page -> trick user into creating passkey for attacker's RP
    Mitigation: Verify relying party, educate users
```

---

## Anti-Patterns

- **Never log passkey credential data** — only log credential IDs
- **Never store secrets in IndexedDB/localStorage** — use secure browser APIs
- **Never trust Yjs peer data blindly** — validate after merge
- **Never request excessive extension permissions** — minimum required
- **Never skip Safe transaction simulation** — always verify before executing
- **Never hardcode API keys or addresses** — use environment variables
- **Never accept runtime messages without origin validation** — check sender URL
- **Never accept content script messages without type allowlist** — enumerate allowed types
- **Never trust signaling topic names as authentication** — they are routing, not identity
- **Never reuse IVs with the same encryption key** — generate fresh per operation
- **Never skip permit enforcement steps** — run the full chain
- **Never interpolate captured web content into executable contexts** — treat as untrusted
- **Never transmit pairing secrets over unencrypted channels** — use secure exchange
- **Never accept invite codes without proof verification** — always recompute and compare

## Related Skills

- `web3` — Safe and ERC-4337 patterns
- `data-layer` — Storage security patterns, Yjs sync, Dexie
- `testing` — Security-focused test scenarios
- `architecture` — Module boundary design and trust boundaries
- `error-handling-patterns` — Secure error surfacing without data leakage
