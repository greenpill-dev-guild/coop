---
paths:
  - "**/__tests__/**"
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
  - "**/*.spec.cjs"
  - "**/tests/**"
  - "**/e2e/**"
---

# Test Rules

## Running Tests

- Always use `bun run test` (NEVER `bun test`). `bun test` uses the built-in runner which ignores vitest config.
- Run a specific file: `bun run test packages/shared/src/modules/coop/__tests__/flows.test.ts`
- Run a specific module's tests: `bun run test packages/shared/src/modules/coop/`
- Run with coverage: `bun run test --coverage`
- E2E tests: `bun run test:e2e` (Playwright)
- Validation before committing: `bun format && bun lint && bun run test && bun build`

## Test Architecture

- **Unit tests**: Vitest + happy-dom. Co-located in `__tests__/` directories next to source.
- **E2E tests**: Playwright in `/e2e/`. Extension loaded via `--load-extension` in persistent Chrome context.
- **Coverage**: v8 provider. Thresholds: 85% lines/functions/statements, 70% branches.
- **Environment**: happy-dom with polyfills for IndexedDB (fake-indexeddb), crypto.subtle, HTMLMediaElement, HTMLDialogElement.

## Writing Quality Tests

### Structure

```typescript
import { describe, expect, it } from 'vitest';

const FIXED_NOW = '2026-03-22T00:00:00.000Z'; // deterministic timestamps

describe('moduleName', () => {
  describe('functionName', () => {
    it('does the expected thing with valid input', () => { /* happy path */ });
    it('rejects invalid input with a clear error', () => { /* sad path */ });
    it('handles the edge case where X is empty', () => { /* edge case */ });
  });
});
```

### Naming Conventions

- `describe` blocks: module or function name
- `it` blocks: plain English describing the behavior, not the implementation
- Good: `it('rejects expired invites with a clear error')`
- Bad: `it('should call validateInvite and return false')`

### What to Test per Module

Every shared module should cover:
1. **Happy path**: Primary use case works correctly
2. **Input validation**: Zod schemas reject malformed input
3. **Edge cases**: Empty arrays, missing optional fields, boundary values
4. **Error paths**: Network failures, missing data, expired state
5. **State transitions**: Before → action → after (especially for coop flows)

### Coverage Expectations by Package

| Package | Target | Notes |
|---------|--------|-------|
| `shared/modules/policy` | 90%+ | Critical path — approval, replay, execution |
| `shared/modules/coop` | 85%+ | Core flows — create, join, invite, sync, publish |
| `shared/modules/archive` | 85%+ | Upload, receipt, snapshot chain, retrieval |
| `shared/modules/auth` | 85%+ | Passkey identity, session, member conversion |
| `shared/modules/onchain` | 80%+ | Safe config, provider, signatures |
| `shared/modules/receiver` | 80%+ | Pairing, sync, capture, relay |
| `shared/modules/storage` | 80%+ | Dexie CRUD, migration, privacy storage |
| `shared/modules/agent` | 80%+ | Harness, memory, registry |
| `shared/modules/privacy` | 75%+ | Groups, membership, lifecycle (proof gen is mocked) |
| `shared/modules/greengoods` | 75%+ | Gardener lifecycle, garden sync |
| `shared/modules/session` | 75%+ | Capability validation, scoped execution |
| `extension/runtime` | 80%+ | Agent runtime, messages, handlers |
| `extension/views` | 70%+ | Component rendering, hook behavior |
| `app` | 70%+ | Landing, board, receiver hooks |

## Mocking Patterns

### When to Mock

Mock **external boundaries only** — keep internal module interactions real:

| Mock | Don't Mock |
|------|------------|
| WebAuthn / passkey creation | Zod schema validation |
| Semaphore ZK proof generation | Internal shared module functions |
| Chrome extension APIs | Dexie database operations (use fake-indexeddb) |
| Storacha/Filecoin uploads | Crypto hashing / HMAC |
| Network requests (fetch) | Timestamp generation (use fixed values) |
| WebRTC/WebSocket connections | State transitions |

### Mock Setup Pattern

Use `vi.hoisted` + `vi.mock` with `importOriginal` to preserve real exports:

```typescript
const mocks = vi.hoisted(() => ({
  generateProof: vi.fn().mockResolvedValue({ /* fake proof */ }),
}));

vi.mock('@semaphore-protocol/proof', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@semaphore-protocol/proof')>();
  return { ...actual, ...mocks };
});
```

**Never** mock a module without spreading the original — missing exports cause cascading failures.

### Chrome API Mocks

For extension tests, the global `chrome` mock is set up in test files. Always include:

```typescript
globalThis.chrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    id: 'test-extension-id',
  },
  storage: {
    local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
    session: { get: vi.fn(), set: vi.fn() },
  },
  // ... add what the component under test actually uses
} as unknown as typeof chrome;
```

### Database Tests

Use real Dexie with fake-indexeddb (already polyfilled in vitest.setup.ts):

```typescript
import { createCoopDexie } from '../../storage/db';

function freshDb() {
  return createCoopDexie(`test-${crypto.randomUUID()}`);
}
```

Each test gets its own database instance — no cleanup needed.

## Timeout Handling

### Default Timeout

The global timeout is **5000ms**. Most unit tests should complete well within this.

### When to Increase Timeout

Add explicit timeouts for tests that:
- Perform bulk IndexedDB writes (15+ records): use `15_000`
- Process large binary data (blob chunking, compression): use `15_000`
- Chain multiple async operations: use `10_000`

```typescript
it('handles bulk memory persistence', async () => {
  // ... bulk writes
}, 15_000);
```

### When a Test Times Out

1. **Check for unresolved promises** — most common cause. A mock returning `undefined` instead of a resolved promise.
2. **Check for missing await** — async operation completes after test exits.
3. **Last resort**: increase timeout. But document why.

Never increase the global timeout — keep it tight to catch regressions.

## Testing Async & Real-Time Operations

### Polling State Changes

```typescript
// In E2E tests, use Playwright's expect.poll:
await expect.poll(async () => {
  const dashboard = await getDashboard(page);
  return dashboard?.drafts.length ?? 0;
}, { timeout: 30_000 }).toBeGreaterThan(0);

// In unit tests, use a simple retry loop:
async function waitFor<T>(fn: () => Promise<T>, predicate: (v: T) => boolean, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = await fn();
    if (predicate(result)) return result;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('waitFor timed out');
}
```

### Testing Sync/WebRTC

Never connect to real signaling in unit tests. Mock the transport layer:

```typescript
vi.mock('y-webrtc', () => ({
  WebrtcProvider: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    destroy: vi.fn(),
    awareness: { setLocalState: vi.fn() },
    connected: true,
  })),
}));
```

For real sync testing, use E2E tests with the local API server on port 4444.

### Testing Cryptography

Use real crypto (crypto.subtle is polyfilled). Don't mock hashing, HMAC, or key derivation — these are deterministic and fast. Mock only proof generation (Semaphore) and key creation (WebAuthn) which require external systems.

## E2E Test Patterns

### Extension Loading

```javascript
const context = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chromium',
  args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
});
const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
const extensionId = new URL(worker.url()).host;
```

### Virtual WebAuthn (Passkey in Tests)

```javascript
const cdpSession = await context.newCDPSession(page);
await cdpSession.send('WebAuthn.enable');
await cdpSession.send('WebAuthn.addVirtualAuthenticator', {
  options: {
    protocol: 'ctap2',
    transport: 'internal',
    hasResidentKey: true,
    hasUserVerification: true,
    isUserVerified: true,
    automaticPresenceSimulation: true,
  },
});
```

### Multi-Profile Testing

Two separate browser contexts sharing the same signaling server:

```javascript
const creatorDir = path.join(os.tmpdir(), `coop-e2e-creator-${Date.now()}`);
const memberDir = path.join(os.tmpdir(), `coop-e2e-member-${Date.now()}`);

const creator = await launchExtensionProfile(creatorDir);
const member = await launchExtensionProfile(memberDir);
// Both connect to ws://127.0.0.1:4444 for sync
```

### E2E Environment

- Signaling: `ws://127.0.0.1:4444` (local API started by Playwright)
- Onchain: `mock` mode (no real chain calls)
- Archive: `mock` mode (no real uploads)
- The E2E extension build is separate from dev builds — see `e2e/helpers/extension-build.cjs`

## Anti-Patterns

- **Don't test implementation details**: Test behavior, not internal function calls.
- **Don't use `any` in test types**: If you need a partial mock, use `Partial<T>` or `Pick<T, K>`.
- **Don't share mutable state between tests**: Each `it()` should be independent.
- **Don't write tests that pass when the feature is broken**: Assert specific values, not just "truthy".
- **Don't skip Zod validation in tests**: If production code validates, test code should too.
- **Don't create global test helpers for one-off needs**: Inline small helpers in the test file.
- **Don't mock internal shared modules**: If `coop/flows.ts` calls `auth/identity.ts`, test with the real identity module.
- **Don't add `.skip` or `.todo` without a comment explaining why and when it should be re-enabled.**

## Adding Tests for New Features

When implementing a new feature:

1. **Create the test file first** in `__tests__/` next to the source module
2. **Write failing tests** for the expected behavior
3. **Implement the feature** until tests pass
4. **Add edge cases**: What happens with empty input? Expired state? Missing fields?
5. **Run the full suite**: `bun run test` — ensure no regressions
6. **Check coverage**: `bun run test --coverage` — aim for the module's target

When fixing a bug:
1. **Write a test that reproduces the bug** (it should fail)
2. **Fix the bug**
3. **Verify the test passes**
4. **Add a regression guard** if the bug was subtle
