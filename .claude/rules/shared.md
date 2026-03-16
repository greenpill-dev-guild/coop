---
paths:
  - "packages/shared/src/**/*.ts"
---

# Shared Package Rules

- All domain types MUST be Zod schemas in `contracts/schema.ts`, then inferred with `z.infer<>`. Never define domain types elsewhere.
- Every CRUD function takes `db: CoopDexie` as first argument. Multi-table writes use `db.transaction('rw', ...)`.
- Never create React hooks in shared. Shared is pure functions and types only.
- Never use `Date.now()` directly for stored timestamps. Use `nowIso()`.
- Never store raw Yjs docs in Dexie. Use `encodeCoopDoc()` to get `Uint8Array` first.
- Never hardcode chain IDs. Use `getCoopChainConfig(chainKey)`.
- Never skip Zod validation for data crossing trust boundaries (invite codes, receiver sync envelopes, onchain state).
- Export through barrels only. Consumers use `import { x } from '@coop/shared'`.
