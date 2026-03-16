# WebAuthn Blocker Fix Proposal

**Issue:** BLOCKER-001 – Coop creation fails with credential error  
**Root Cause:** Missing algorithm identifiers in credential creation  
**Fix Complexity:** Low (1–2 file changes)  
**Estimated Time:** 15 minutes

---

## The Problem

```
Error: pubKeyCredParams is missing at least one of the default algorithm identifiers: ES256 and RS256
Error: A request is already pending.
```

**Location:** `packages/shared/src/modules/auth/auth.ts` (line ~37)

```typescript
// CURRENT (missing pubKeyCredParams):
const credential = await createWebAuthnCredential({
  name: input.displayName,
  user: {
    name: input.displayName,
    displayName: input.displayName,
  },
  rp: {
    id: rpId,
    name: 'Coop',
  },
});
```

---

## Root Causes

### 1. Missing pubKeyCredParams
The viem `createWebAuthnCredential` call doesn't specify which algorithms to support. Chromium requires both ES256 and RS256 for broad compatibility.

**Fix:**
```typescript
const credential = await createWebAuthnCredential({
  name: input.displayName,
  user: {
    name: input.displayName,
    displayName: input.displayName,
  },
  rp: {
    id: rpId,
    name: 'Coop',
  },
  // Add these two algorithm identifiers:
  pubKeyCredParams: [
    { alg: -7, type: 'public-key' },    // ES256 (ECDSA with SHA-256)
    { alg: -257, type: 'public-key' }   // RS256 (RSA with SHA-256)
  ],
});
```

### 2. "Request Already Pending"
When a credential request fails, it may not be cleaned up properly. If the user retries, a new request finds the old one still pending.

**Potential Fix:**
- Add abort signal or timeout
- Clear pending requests on error
- Use try-catch with proper error handling

---

## Recommended Fix

### File 1: `packages/shared/src/modules/auth/auth.ts`

**Change Location:** Lines 37–48 (createAuthSession function)

**Old Code:**
```typescript
const credential =
  input.credential ??
  (await createWebAuthnCredential({
    name: input.displayName,
    user: {
      name: input.displayName,
      displayName: input.displayName,
    },
    rp: {
      id: rpId,
      name: 'Coop',
    },
  }));
```

**New Code:**
```typescript
const credential =
  input.credential ??
  (await createWebAuthnCredential({
    name: input.displayName,
    user: {
      name: input.displayName,
      displayName: input.displayName,
    },
    rp: {
      id: rpId,
      name: 'Coop',
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' },    // ES256
      { alg: -257, type: 'public-key' },  // RS256
    ],
  }));
```

### File 2 (Optional): Mock Mode Override

**Location:** `packages/shared/src/modules/auth/auth.ts` (top of createAuthSession)

If `VITE_COOP_ONCHAIN_MODE=mock`, skip WebAuthn entirely:

```typescript
export async function createAuthSession(input: {
  displayName: string;
  credential?: AuthSession['passkey'];
  rpId?: string;
}) {
  // If in mock mode, skip WebAuthn
  if (import.meta.env.VITE_COOP_ONCHAIN_MODE === 'mock' && !input.credential) {
    // Generate mock credential
    const mockCredId = crypto.getRandomValues(new Uint8Array(32));
    const mockPubKey = crypto.getRandomValues(new Uint8Array(65)); // EC public key
    
    return authSessionSchema.parse({
      authMode: 'passkey-mock',
      displayName: input.displayName,
      primaryAddress: `mock-0x${Array.from(mockPubKey).map(b => b.toString(16).padStart(2, '0')).join('')}`,
      createdAt: nowIso(),
      identityWarning: createDeviceBoundWarning(input.displayName),
      passkey: {
        id: Array.from(mockCredId).map(b => b.toString(16).padStart(2, '0')).join(''),
        publicKey: `0x${Array.from(mockPubKey).map(b => b.toString(16).padStart(2, '0')).join('')}`,
        rpId: resolvePasskeyRpId(input.rpId),
      },
    });
  }

  // ... rest of function with pubKeyCredParams fix
}
```

---

## Testing the Fix

### Unit Test
Add to `packages/shared/src/modules/auth/__tests__/auth.test.ts`:

```typescript
it('specifies both ES256 and RS256 algorithms in credential creation', async () => {
  const mockCreateWebAuthnCredential = vi.fn(async () => ({
    id: 'test-cred-id',
    publicKey: '0xtest',
  }));
  
  vi.mock('viem/account-abstraction', () => ({
    createWebAuthnCredential: mockCreateWebAuthnCredential,
    toWebAuthnAccount: vi.fn(),
  }));

  await createAuthSession({ displayName: 'Test User' });

  expect(mockCreateWebAuthnCredential).toHaveBeenCalledWith(
    expect.objectContaining({
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
    })
  );
});
```

### Manual Test
1. Rebuild extension: `bun run --filter @coop/extension build`
2. Reload in Chrome: `chrome://extensions/` → Reload
3. Try coop creation: Should succeed or show clear error

---

## Secondary Improvements

### Improve Error Messages
In `packages/extension/src/background/handlers/coop.ts`, catch and display credential errors:

```typescript
try {
  const session = await createAuthSession({ displayName });
} catch (e) {
  if (e.message.includes('WebAuthn')) {
    return { 
      ok: false, 
      error: 'Passkey registration failed. Your browser may not support it. Try using a different device or browser.',
      soundEvent: 'error'
    };
  }
  throw e;
}
```

### Add Retry Logic
Auto-retry once on "already pending" error:

```typescript
async function createAuthSessionWithRetry(input, maxRetries = 2) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await createAuthSession(input);
    } catch (e) {
      if (e.message.includes('already pending') && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s, retry
        continue;
      }
      throw e;
    }
  }
}
```

---

## Impact

- ✅ **Fixes:** "A request is already pending" error
- ✅ **Fixes:** Missing algorithm identifiers error
- ✅ **Enables:** Mock mode for testing (no WebAuthn)
- ✅ **Improves:** Error messages (users understand what went wrong)
- ✅ **Adds:** Retry logic (resilience)

---

## Deployment Checklist

- [ ] Apply pubKeyCredParams fix
- [ ] Test with manual coop creation
- [ ] Run unit tests: `bun run test`
- [ ] Run E2E: `bun run test:e2e:extension`
- [ ] Rebuild extension
- [ ] Submit to Chrome Web Store (if ready)

---

## Next Steps (For Afo)

1. Apply the `pubKeyCredParams` fix (high confidence, low risk)
2. Test coop creation manually
3. Optionally add mock mode & retry logic
4. Run full test suite
5. Commit & push
6. Luiz resumes testing flows 2–6

---

**Proposal Generated:** 2026-03-16 14:36 UTC  
**Confidence Level:** High (root cause clearly identified)  
**Fix Time:** 5–15 minutes
