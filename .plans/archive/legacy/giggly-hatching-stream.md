# Architecture Refactoring — God Module Splits, Component Extraction, Test Coverage

## Context

The architecture audit found clean package boundaries and zero import violations, but identified:
- 6 god modules (500-1,565 lines) that are hard to reason about and maintain
- Inconsistent component decomposition in extension tabs
- A test coverage gap for `useReceiverSync`

All changes are pure structural refactoring — no behavior changes, no feature additions. Every existing import path continues to work via barrel re-exports.

---

## Phase 1: Split `shared/modules/coop/flows.ts` (992L → 3 files + barrel)

**Risk: High** (12+ importers across packages). Run `validate smoke` immediately after.

### New files

| File | Functions moved | ~Lines |
|------|----------------|--------|
| `flows-invites.ts` | `INVITE_MANAGER_ROLES`, `DEFAULT_INVITE_TYPES`, `createInviteBootstrapSnapshot`, `createStateFromInviteBootstrap`, `serializeInviteBootstrapForProof`, `createInviteProof`, `verifyInviteCodeProof`, `generateInviteCode`, `parseInviteCode`, `validateInvite`, `addInviteToState`, `hasInviteHistoryForType`, `getCurrentInviteForType`, `ensureInviteCodes`, `seedDefaultInviteCodes`, `canManageInvites`, `ComputedInviteStatus`, `getComputedInviteStatus`, `revokeInviteCode`, `revokeInviteType`, `regenerateInviteCode`, `applyAddInviteToDoc`, `applyRevokeInviteToDoc` | ~430 |
| `flows-creation.ts` | `CreateCoopInput`, `JoinCoopInput`, re-export `createMember`/`createDeviceBoundWarning`, `createInitialArtifacts` (private), `createCoop`, `joinCoop`, `applyJoinToDoc`, `readStateFromDoc` | ~400 |
| `flows-updates.ts` | `updateCoopDetails`, `updateCoopMeetingSettings`, `LeaveCoopInput`, `LeaveCoopResult`, `leaveCoop` | ~110 |

**Dependency direction**: `flows-creation.ts` imports from `flows-invites.ts` (one-way). `flows-updates.ts` is standalone. Bootstrap snapshot functions live in `flows-invites.ts` to avoid circular deps.

**`flows.ts` becomes a 3-line barrel**:
```typescript
export * from './flows-creation';
export * from './flows-invites';
export * from './flows-updates';
```

**Verification**: `bun run validate smoke`

---

## Phase 2: Split `extension/runtime/agent/runner-skills.ts` (1,565L → 4 files + orchestrator)

**Risk: Medium** (extension-internal only).

### New files

| File | Functions moved | ~Lines |
|------|----------------|--------|
| `runner-skills-prompt.ts` | `buildSkillPrompt`, `createHeuristicCapitalFormationBrief` | ~240 |
| `runner-skills-completion.ts` | `completeSkill<T>`, `maybePatchDraft`, `resolveActionMemberId`, `dispatchActionProposal`, `uniqueById` | ~320 |
| `runner-skills-context.ts` | `loadExtractsForObservation`, `emitObservationIfMissing`, `findExistingDraftForRouting`, `persistTabRouterOutput`, `buildSkillContext` | ~290 |
| `runner-skills-memory.ts` | `extractMemoriesFromOutput`, `writeSkillMemories` | ~200 |

**`runner-skills.ts` keeps**: `runObservationPlan()` (~410 lines) — the main orchestrator — plus re-exports from all split files.

**Dependency direction**: `completion` imports from `prompt`. All others are standalone. `runner-skills.ts` imports from all four.

**Verification**: `bun run validate quick`

---

## Phase 3: Split `extension/runtime/agent/output-handlers.ts` (905L → 5 files + router)

**Risk: Low** (extension-internal, 3 external importers all go through barrel).

### New files

| File | Contents | ~Lines |
|------|----------|--------|
| `output-handlers-helpers.ts` | All types (`SkillOutputHandlerExecutionContext`, `PersistedTabRouterResult`, `SkillOutputHandlerInput`, `SkillOutputHandlerResult`, `SkillOutputHandler`) + helper functions (`pushCreatedDraft`, `resolveSynthesisDraftContext`, `patchSynthesisDraft`, address resolvers, `validateActionClass`, `queueActionProposals`) | ~200 |
| `output-handlers-core.ts` | `opportunity-extractor`, `grant-fit-scorer`, `tab-router`, `capital-formation-brief` handlers. Exports `coreHandlers` partial record. | ~100 |
| `output-handlers-synthesis.ts` | `memory-insight`, `review-digest`, `publish-readiness-check` handlers. Exports `synthesisHandlers`. | ~180 |
| `output-handlers-greengoods.ts` | All 5 green-goods handlers. Exports `greenGoodsHandlers`. | ~290 |
| `output-handlers-erc8004.ts` | `erc8004-registration`, `erc8004-feedback` handlers. Exports `erc8004Handlers`. | ~95 |

**`output-handlers.ts` keeps**: `applySkillOutput()` router + `skillOutputHandlers` map assembly + re-exports all types/helpers.

**Verification**: `bun run validate quick`

---

## Phase 4: Extract tab components

**Risk: Low** (leaf UI components, no export surface).

### ChickensTab.tsx (894L → ~350L)

| New file | Extracted content |
|----------|------------------|
| `chickens-helpers.ts` | `isStalePendingObservation`, `formatRelativeTime`, `formatCategoryLabel`, `resolvePreviewImage`, `faviconUrl`, `resolveSourceDomain`, `resolveSourceUrl`, `ReviewItemKind`, `ReviewItem`, `buildReviewItems`, `ORIENTATION_CATEGORIES` |
| `ChickensPushControls.tsx` | `PushControls` component |
| `ChickensCompactCard.tsx` | `CompactCard` component |
| `ChickensCompactSharedCard.tsx` | `CompactSharedCard` component |

Keeps: `ChickenIcon`, `OrientationSummaryCard`, `TimeGroupSection`, main `ChickensTab`.

### NestTab.tsx (656L → ~310L)

| New file | Extracted content |
|----------|------------------|
| `NestCreationForm.tsx` | `NestCreationForm` component (~350 lines) |

### RoostTab.tsx (720L → ~220L)

| New file | Extracted content |
|----------|------------------|
| `roost-helpers.ts` | `isGardenerActionBundle`, `readBundleTargetMemberId`, `timeAgo`, `GardenStage`, `GARDEN_STAGE_COPY` |
| `RoostFocusSection.tsx` | `FocusSection` component |
| `RoostAgentSection.tsx` | `AgentSection` component |
| `RoostGardenSection.tsx` | `GardenSection` component |

**Verification**: `bun run validate quick`

---

## Phase 5: Add `useReceiverSync` behavioral tests

**Risk: Low** (additive only).

Extend `packages/app/src/hooks/__tests__/useReceiverSync.behavior.test.ts` with:

1. `it('resolves unavailable when the extension bridge times out')` — postMessage with no response, verify timeout returns `{ status: 'unavailable' }`
2. `it('disconnects the old binding when pairing changes')` — verify `disconnect()` called on old providers
3. `it('cleans up binding on unmount')` — verify cleanup of sync doc, providers
4. `it('serializes concurrent reconcilePairing calls')` — two calls while first is running, verify second queues

Follow existing test pattern: `vi.hoisted()` + `vi.mock()` with `importOriginal`, `makeDeps()` factory, `renderHook()` + `act()`.

**Verification**: `bun run test packages/app/src/hooks/__tests__/useReceiverSync.behavior.test.ts`

---

## Phase 6: Handler pattern documentation

**Risk: Minimal** (JSDoc only).

Add a JSDoc block to `packages/extension/src/background/handler-registry.ts` above the handler record type, documenting the common handler signature pattern. No code changes.

---

## Execution Strategy

6 phases, executed sequentially. Phases 2-4 can use parallel worktree agents since they touch different packages/directories.

| Phase | Package | New files | Modified files | Verify |
|-------|---------|-----------|----------------|--------|
| 1 | shared | 3 | 1 (flows.ts → barrel) | `validate smoke` |
| 2 | extension/runtime/agent | 4 | 1 (runner-skills.ts) | `validate quick` |
| 3 | extension/runtime/agent | 5 | 1 (output-handlers.ts) | `validate quick` |
| 4 | extension/views | 9 | 3 (tabs) | `validate quick` |
| 5 | app | 0 | 1 (test file) | `bun run test` on file |
| 6 | extension/background | 0 | 1 (handler-registry.ts) | `bun build` |

**Final gate**: `bun run validate smoke` (typecheck + lint + unit tests + build)

**Total**: 21 new files, ~10 modified files, 0 deleted files.
