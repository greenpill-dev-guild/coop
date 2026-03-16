---
paths:
  - "packages/shared/src/contracts/**"
---

# Schema Rules

- `contracts/schema.ts` is the SINGLE source of truth for all domain types. All Zod schemas live here.
- Types are always inferred: `export type Foo = z.infer<typeof fooSchema>`.
- Key schema groups:
  - **Identity**: authSession, localPasskeyIdentity, passkeyCredential
  - **Coop state**: coopSharedState (top-level CRDT doc shape), coopProfile, coopSoul, ritualDefinition
  - **Content pipeline**: tabCandidate, readablePageExtract, coopInterpretation, reviewDraft, artifact
  - **Receiver**: receiverCapture, receiverPairingRecord, receiverSyncEnvelope
  - **Archive**: archiveReceipt, archiveBundle, archiveDelegationMaterial
  - **Onchain**: onchainState (legacy chain keys migrated via `migrateLegacyChainKeys()` in storage module)
- Adding a new domain concept? Add the Zod schema here first, then use it in the module.
- Never create standalone TypeScript interfaces for domain types. Utility interfaces (like `CoopDocRecord`) in module files are OK.
