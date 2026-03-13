---
name: security
user-invocable: false
description: Application security - passkey credential safety, Safe multisig patterns, local storage encryption, CRDT integrity, extension permissions. Use for security reviews, pre-release audits, and threat modeling.
version: "1.0.0"
status: active
packages: ["shared", "extension", "app"]
dependencies: []
last_updated: "2026-03-12"
last_verified: "2026-03-12"
---

# Security Skill

Application security guide: passkey credential management, Safe operations safety, local data protection, CRDT integrity, and browser extension security.

---

## Activation

| Trigger | Action |
|---------|--------|
| "security audit", "security review" | Full application security review |
| "check for vulnerabilities" | Targeted vulnerability scan |
| "access control review" | Safe/passkey access control audit |
| Pre-release | Mandatory security checklist |

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

  // Never store raw passkey private material
  // Only store: credential ID, public key, user handle
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
  // Clear auth state
  authStore.reset();
  // Clear in-memory keys
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
  // Clear transient data, keep user's local content
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
// NEVER request "tabs" permission unless absolutely needed (exposes all tab URLs)
```

---

## Part 4: CRDT / Yjs Integrity

### Peer Trust Model

```typescript
// Yjs syncs with any connected peer -- validate shared state
yDoc.on("update", (update: Uint8Array, origin: any) => {
  // Log origin for audit trail
  logger.debug("Yjs update received", {
    origin: origin?.toString(),
    updateSize: update.byteLength,
  });
});

// ALWAYS: Validate data structure after Yjs merge
function validateCoopState(yDoc: Y.Doc): boolean {
  const yTabs = yDoc.getArray("tabs");
  // Verify all tabs have required fields
  for (const tab of yTabs.toArray()) {
    if (!tab.url || !tab.id) return false;
  }
  return true;
}
```

### Room Security

```typescript
// ALWAYS: Use unique, unpredictable room names
const roomName = `coop-${coopId}-${roomSecret}`;

// ALWAYS: Encrypt y-webrtc rooms when possible
const provider = new WebrtcProvider(roomName, yDoc, {
  password: coopEncryptionKey,
});
```

---

## Part 5: Pre-Release Security Checklist

### Checklist

- [ ] **Passkey**: Credential data never logged or stored improperly
- [ ] **Safe**: All transactions simulated before execution
- [ ] **Safe**: Owner verification before privileged operations
- [ ] **Storage**: No secrets in IndexedDB/localStorage
- [ ] **Extension**: Minimum required permissions in manifest.json
- [ ] **Extension**: Content script isolation (no direct DOM access to sensitive data)
- [ ] **Yjs**: Room names unpredictable, encrypted when possible
- [ ] **Network**: All API calls over HTTPS
- [ ] **Network**: No sensitive data in URL parameters
- [ ] **Errors**: No PII or credentials in error logs
- [ ] **Dependencies**: `bun audit` clean (no HIGH/CRITICAL)

### Severity Classification

| Severity | Criteria | Action |
|----------|----------|--------|
| **Critical** | Credential leak, unauthorized Safe access | Block release, fix immediately |
| **High** | Data exposure, session hijack | Block release, fix before ship |
| **Medium** | Missing validation, weak defaults | Fix recommended, can ship with ack |
| **Low** | Code style, documentation | Fix in next iteration |

---

## Part 6: Threat Modeling

### Coop Threat Actors

| Actor | Motivation | Attack Surface |
|-------|-----------|---------------|
| **Malicious peer** | Corrupt shared state | Yjs sync, WebRTC connection |
| **Extension exploit** | Steal credentials | Content scripts, extension storage |
| **Phishing** | Steal passkey | Fake auth prompts, social engineering |
| **Local attacker** | Access local data | IndexedDB, browser storage |

### Attack Scenarios

```
1. Yjs State Poisoning:
   Malicious peer -> inject corrupt data -> break coop state
   Mitigation: Validate state after merge, rate-limit updates

2. Extension Privilege Escalation:
   Exploit content script -> access extension storage -> steal session
   Mitigation: Minimal permissions, isolated content scripts

3. Passkey Phishing:
   Fake login page -> trick user into creating passkey for attacker's RP
   Mitigation: Verify relying party, educate users

4. Safe Drain:
   Compromised owner key -> execute unauthorized transactions
   Mitigation: Multi-sig threshold, transaction simulation
```

## Anti-Patterns

- **Never log passkey credential data** -- only log credential IDs
- **Never store secrets in IndexedDB/localStorage** -- use secure browser APIs
- **Never trust Yjs peer data blindly** -- validate after merge
- **Never request excessive extension permissions** -- minimum required
- **Never skip Safe transaction simulation** -- always verify before executing
- **Never hardcode API keys or addresses** -- use environment variables

## Related Skills

- `web3` -- Safe and ERC-4337 patterns
- `data-layer` -- Storage security patterns
- `monitoring` -- Post-deployment security monitoring
- `testing` -- Security-focused test scenarios
