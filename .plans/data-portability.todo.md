# Data Portability & Backup System

**Branch**: `feature/data-portability`
**Status**: IMPLEMENTED
**Created**: 2026-03-22
**Last Updated**: 2026-03-22

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Single `portability.ts` module in shared/storage | Keeps export/import close to DB layer; archive module handles Storacha, this handles local backup |
| 2 | Include wrapping secret in encrypted full-db export | Without it, all encrypted payloads are unreadable; export itself is passphrase-protected |
| 3 | Passphrase-based export encryption (AES-256-GCM + PBKDF2) | User-chosen passphrase protects the backup file; no dependency on passkey hardware |
| 4 | JSON format for all exports | Human-inspectable, schema-versioned, compatible with future import tools |
| 5 | Restore from archive rehydrates into Yjs doc via existing `writeCoopState` | Reuses CRDT write path; no custom Yjs deserialization needed |
| 6 | Granular export functions + one `exportFullDatabase` umbrella | Users can export individual data types or everything at once |
| 7 | All new code in `@coop/shared`, handlers in extension background | Follows module boundary pattern; extension only wires UI to shared functions |

## Requirements Coverage

| Requirement | Planned Step | Status |
|-------------|--------------|--------|
| Full DB export with wrapping secret | Steps 1-2 | |
| Full DB import/restore | Steps 1-2 | |
| Cryptographic key backup (passkey, Semaphore, stealth, signer bindings) | Step 3 | |
| Archive restore pipeline (fetch → validate → rehydrate) | Step 4 | |
| Granular exports (drafts, chickens, agent memory, receiver, blobs) | Step 5 | |
| Extension background handlers for all operations | Step 6 | |
| Comprehensive test coverage | Steps 1-6 (each step includes tests) | |

## CLAUDE.md Compliance
- [x] All modules in shared package
- [x] Barrel imports from @coop/shared
- [x] Single root .env only
- [x] No deep imports

## Impact Analysis

### Files to Create
- `packages/shared/src/modules/storage/portability.ts` — Full DB export/import + granular exports
- `packages/shared/src/modules/storage/__tests__/portability.test.ts` — Comprehensive tests
- `packages/shared/src/modules/archive/restore.ts` — Archive restore pipeline
- `packages/shared/src/modules/archive/__tests__/restore.test.ts` — Restore tests

### Files to Modify
- `packages/shared/src/modules/storage/db.ts` — Expose table enumeration helpers
- `packages/shared/src/modules/storage/index.ts` — Re-export portability
- `packages/shared/src/modules/archive/index.ts` — Re-export restore
- `packages/extension/src/background/handlers/archive.ts` — Add restore handler
- `packages/extension/src/background.ts` — Wire new message types

## Test Strategy
- **Unit tests**: Every export function round-trips (export → import → verify equality)
- **Unit tests**: Encrypted export with wrong passphrase fails gracefully
- **Unit tests**: Archive restore validates schema and rehydrates into CoopSharedState
- **Unit tests**: Granular exports cover all 7 encrypted payload types
- **Integration**: Full DB dump → clear DB → import → verify all tables restored

## Implementation Steps

### Step 1: Core portability module — export functions
**Files**: `packages/shared/src/modules/storage/portability.ts`
**Details**:
- `exportFullDatabase(db, passphrase)` — dumps all tables + wrapping secret, encrypts with passphrase
- `exportTableData(db, tableName)` — raw table dump for individual tables
- Granular: `exportChickens`, `exportDrafts`, `exportAgentMemories`, `exportReceiverCaptures`, `exportCryptoKeys`
- Schema version header for future migrations
- Each export includes metadata (timestamp, db version, table counts)

### Step 2: Core portability module — import functions + tests
**Files**: `packages/shared/src/modules/storage/portability.ts`, `portability.test.ts`
**Details**:
- `importFullDatabase(db, encryptedData, passphrase)` — decrypt, validate, restore all tables
- `importTableData(db, tableName, records)` — restore single table
- Conflict resolution: overwrite (default) or skip-existing
- Full round-trip tests for every export/import function

### Step 3: Cryptographic key backup
**Files**: `packages/shared/src/modules/storage/portability.ts`, tests
**Details**:
- `exportCryptoKeyBundle(db, passphrase)` — passkey identities, privacy identities, stealth key pairs, member signer bindings, archive secrets, wrapping secret, encrypted session materials
- `importCryptoKeyBundle(db, encryptedData, passphrase)` — restore all key material
- Tests: round-trip, wrong passphrase rejection, partial key restore

### Step 4: Archive restore pipeline
**Files**: `packages/shared/src/modules/archive/restore.ts`, `restore.test.ts`
**Details**:
- `restoreFromArchive(receipt, db)` — fetch bundle → validate schema → rehydrate CoopSharedState via `writeCoopState`
- `restoreFromExportedSnapshot(json, db)` — import from previously exported snapshot JSON
- Schema validation using existing zod schemas
- Tests: mock gateway fetch, schema validation, state rehydration

### Step 5: Barrel exports & handler wiring
**Files**: storage/index.ts, archive/index.ts, extension handlers
**Details**:
- Re-export all new functions through barrels
- Add background message handlers: `handle-export-full-db`, `handle-import-full-db`, `handle-export-crypto-keys`, `handle-import-crypto-keys`, `handle-restore-archive`
- Wire into extension background.ts message router

### Step 6: Integration tests & validation
**Details**:
- Full round-trip integration test: create DB with all data types → export → clear → import → verify
- Archive restore integration: mock Storacha gateway → restore → verify state
- Run full validation suite to ensure no regressions

## Validation
- [ ] `bun run test` passes
- [ ] `bun build` succeeds
- [ ] All new functions exported through `@coop/shared` barrel
- [ ] Round-trip tests cover every table
