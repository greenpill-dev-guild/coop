---
paths:
  - "**/__tests__/**"
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "**/tests/**"
---

# Test Rules

- Always use `bun run test` (NEVER `bun test`). `bun test` uses the built-in runner which ignores vitest config.
- Unit tests use Vitest. E2E tests use Playwright.
- Tests live in `__tests__/` directories co-located with source, or in `tests/` at package root for E2E.
- Mock modes (`mock` onchain/archive) are the default for tests. Only `arbitrum-safe-live` suite uses real APIs.
- When writing tests for shared modules, test pure functions directly. When testing extension/app, test through the message/handoff interfaces.
- Validation before committing: `bun format && bun lint && bun run test && bun build`.
