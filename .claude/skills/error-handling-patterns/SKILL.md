---
name: error-handling-patterns
user-invocable: false
description: Robust error handling strategies for graceful failures and debugging. Use for error handling implementations, error flow debugging, error boundaries, retry mechanisms, and user-friendly error messages.
version: "1.0.0"
status: active
packages: ["shared", "app", "extension"]
dependencies: []
last_updated: "2026-03-12"
last_verified: "2026-03-12"
---

# Error Handling Patterns

Build resilient applications with robust error handling that gracefully handles failures.

## Activation

When invoked:
- Classify the error category (network/validation/auth/permission/blockchain/storage/sync).
- Choose a user-facing response (toast, redirect, form error, retry).
- Ensure logging captures actionable context.
- Add or update tests for error paths.

## Part 1: Error Categories

### Recoverable vs Unrecoverable

| Recoverable | Unrecoverable |
|-------------|---------------|
| Network timeout | Out of memory |
| Missing file | Stack overflow |
| Invalid user input | Programming bugs |
| API rate limit | Type errors |

### Coop Error Categories

| Category | Examples | Response |
|----------|----------|----------|
| `network` | Fetch failed, timeout | Retry with backoff, show offline |
| `validation` | Invalid input, schema mismatch | Show form errors |
| `auth` | Passkey failed, session expired | Redirect to login |
| `permission` | Forbidden action, wrong role | Show access denied |
| `blockchain` | Safe tx failed, bundler rejected | Show failure, offer retry |
| `storage` | IndexedDB full, quota exceeded | Prompt cleanup |
| `sync` | Yjs merge conflict, WebRTC failure | Retry sync, show indicator |

## Part 2: TypeScript Error Handling

### Error Utility Structure

```
packages/shared/src/utils/errors/
├── extract-message.ts          # extractErrorMessage(), extractErrorMessageOr()
├── categorize-error.ts         # categorizeError() -> ErrorCategory
├── validation-error.ts         # ValidationError class
└── user-messages.ts            # USER_FRIENDLY_ERRORS mapping
```

### ValidationError Class

```typescript
import { ValidationError } from "@coop/shared";

// Usage: precondition checks for programming errors
if (!coopId) {
  throw new ValidationError("coopId is required for listing members");
}
```

### Error Categorization

```typescript
import { categorizeError } from "@coop/shared";
import type { ErrorCategory, CategorizedError } from "@coop/shared";

const { message, category, metadata } = categorizeError(error);
// category: "network" | "validation" | "auth" | "permission" | "blockchain" | "storage" | "sync" | "unknown"

if (category === "network") {
  toast.error("Network error. Please check your connection.");
} else if (category === "blockchain") {
  toast.error("Transaction failed. Please try again.");
}
```

### Error Message Extraction

```typescript
import { extractErrorMessage, extractErrorMessageOr } from "@coop/shared";

const msg = extractErrorMessage(error);           // May return ""
const safe = extractErrorMessageOr(error, "Unknown error"); // Fallback guaranteed
```

## Part 3: React Error Handling

### Error Boundaries

```typescript
import { ErrorBoundary } from "@coop/shared";

<ErrorBoundary fallback={<ErrorFallback />}>
  <CoopContent />
</ErrorBoundary>
```

## Part 4: Retry Patterns

### Exponential Backoff

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    shouldRetry = () => true,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Usage with categorizeError for retry decisions
import { categorizeError } from "@coop/shared";

const result = await withRetry(
  () => fetch("/api/coops"),
  {
    maxRetries: 3,
    shouldRetry: (error) => categorizeError(error).category === "network",
  }
);
```

## Best Practices

### Do's

1. **Fail fast** -- Validate early, fail quickly
2. **Preserve context** -- Include stack traces and metadata
3. **Meaningful messages** -- Explain what happened
4. **Log appropriately** -- Errors warrant logging
5. **Clean up resources** -- Use try-finally
6. **Type-safe handling** -- Use discriminated unions

### Don'ts

```typescript
// Never swallow errors
try { await riskyOp(); } catch (e) { }

// Never catch too broadly
try { /* lots of code */ } catch (e) { console.log("error"); }

// Always log AND handle
try {
  await riskyOp();
} catch (error) {
  logger.error("Operation failed", { error, context });
  toast.error(getUserFriendlyMessage(error));
}

// Always specific catches using categorizeError
try {
  await publishContent(data);
} catch (error) {
  const { category } = categorizeError(error);
  if (category === "validation") {
    setFormErrors(extractErrorMessage(error));
  } else if (category === "network") {
    queueForRetry(data);
  } else {
    throw error; // Rethrow unexpected errors
  }
}
```

## Anti-Patterns

- Swallowing exceptions with empty `catch {}` blocks
- Returning generic errors without category/context metadata
- Retrying non-recoverable errors (validation/permission) indefinitely
- Showing raw blockchain revert messages directly to users
- Logging sensitive values (keys, tokens, passkey data) in error payloads

## Related Skills

- `react` -- Error boundaries and component-level error handling
- `monitoring` -- Error tracking and observability
- `data-layer` -- Sync failure categorization and retry patterns
- `web3` -- Domain-specific error handling for Safe and blockchain errors
- `testing` -- Testing error paths and failure scenarios
