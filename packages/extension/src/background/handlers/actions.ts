import {
  type ActionBundle,
  type ActionLogEntry,
  type ActionPolicy,
  type CoopSharedState,
  type DelegatedActionClass,
  type Erc8004LiveExecutor,
  type ExecutionGrant,
  type GrantLogEntry,
  type GreenGoodsGardenState,
  type PolicyActionClass,
  approveBundle,
  createActionBundle,
  createActionLogEntry,
  createDefaultPolicies,
  createExecutionGrant,
  createGrantLogEntry,
  createGreenGoodsAssessment,
  createGreenGoodsGarden,
  createGreenGoodsGardenPools,
  createReplayGuard,
  executeBundle as executeBundleAction,
  expireStaleBundles,
  findMatchingPolicy,
  getActionBundle,
  getAuthSession,
  getExecutionGrant,
  getReviewDraft,
  giveAgentFeedback,
  incrementGrantUsage,
  listActionBundles,
  listActionBundlesByStatus,
  listActionLogEntries,
  listActionPolicies,
  listExecutionGrants,
  listGrantLogEntries,
  listRecordedReplayIds,
  nowIso,
  pendingBundles,
  recordReplayId,
  refreshGrantStatus,
  registerAgentIdentity,
  rejectBundle,
  resolveGreenGoodsGapAdminChanges,
  resolveScopedActionPayload,
  revokeGrant,
  saveActionBundle,
  saveActionLogEntry,
  saveExecutionGrant,
  saveGrantLogEntry,
  setActionPolicies,
  setGreenGoodsGardenDomains,
  submitGreenGoodsWorkApproval,
  syncGreenGoodsGapAdmins,
  syncGreenGoodsGardenProfile,
  updateGreenGoodsState,
  upsertPolicyForActionClass,
  validateGrantForExecution,
} from '@coop/shared';
import type { Address } from 'viem';
import {
  createRuntimeGrantExecutor,
  resolveDelegatedActionExecution,
} from '../../runtime/grant-runtime';
import type { RuntimeActionResponse, RuntimeRequest } from '../../runtime/messages';
import { resolveReceiverPairingMember } from '../../runtime/receiver';
import { validateReviewDraftPublish } from '../../runtime/review';
import {
  configuredOnchainMode,
  configuredPimlicoApiKey,
  db,
  ensureReceiverSyncOffscreenDocument,
  getCoops,
  saveState,
  updateCoopGreenGoodsState,
} from '../context';
import { refreshBadge } from '../dashboard';
import {
  findAuthenticatedCoopMember,
  getTrustedNodeContext,
  logPrivilegedAction,
  requireCreatorGrantManager,
} from '../operator';
import { emitAgentObservationIfMissing, requestAgentCycle } from './agent';
import {
  handleArchiveArtifact,
  handleArchiveSnapshot,
  handleRefreshArchiveStatus,
} from './archive';
import { publishDraftWithContext } from './review';
import { buildGreenGoodsSessionExecutor, createOwnerSafeExecutionContext } from './session';

// ---- Policy Helpers ----

export async function ensureActionPolicies(): Promise<ActionPolicy[]> {
  const policies = await listActionPolicies(db);
  if (policies.length > 0) {
    return policies;
  }
  const defaults = createDefaultPolicies();
  await setActionPolicies(db, defaults);
  return defaults;
}

// ---- Policy Handlers ----

export async function handleGetActionPolicies(): Promise<RuntimeActionResponse<ActionPolicy[]>> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) {
    return { ok: true, data: [] };
  }
  const policies = await ensureActionPolicies();
  return { ok: true, data: policies };
}

export async function handleSetActionPolicy(
  message: Extract<RuntimeRequest, { type: 'set-action-policy' }>,
): Promise<RuntimeActionResponse<ActionPolicy[]>> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }
  const current = await ensureActionPolicies();
  const updated = upsertPolicyForActionClass(current, message.payload.actionClass, {
    approvalRequired: message.payload.approvalRequired,
  });
  await setActionPolicies(db, updated);
  return { ok: true, data: updated };
}

// ---- Action Bundle Handlers ----

export async function handleProposeAction(
  message: Extract<RuntimeRequest, { type: 'propose-action' }>,
): Promise<RuntimeActionResponse<ActionBundle>> {
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: message.payload.coopId,
    requestedMemberId: message.payload.memberId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }
  const policies = await ensureActionPolicies();
  const policy = findMatchingPolicy(policies, {
    actionClass: message.payload.actionClass,
    coopId: message.payload.coopId,
    memberId: message.payload.memberId,
  });
  if (!policy) {
    return {
      ok: false,
      error: `No policy found for action class "${message.payload.actionClass}".`,
    };
  }

  const bundle = createActionBundle({
    actionClass: message.payload.actionClass,
    coopId: message.payload.coopId,
    memberId: message.payload.memberId,
    payload: message.payload.payload,
    policy,
    chainId: trustedNodeContext.coop.onchainState.chainId,
    chainKey: trustedNodeContext.coop.onchainState.chainKey,
    safeAddress: trustedNodeContext.coop.onchainState.safeAddress as Address,
  });
  await saveActionBundle(db, bundle);

  const logEntry = createActionLogEntry({
    bundle,
    eventType: 'proposal-created',
    detail: `Proposed ${message.payload.actionClass} for coop ${message.payload.coopId}.`,
  });
  await saveActionLogEntry(db, logEntry);

  return { ok: true, data: bundle };
}

export async function handleApproveAction(
  message: Extract<RuntimeRequest, { type: 'approve-action' }>,
): Promise<RuntimeActionResponse<ActionBundle>> {
  const bundle = await getActionBundle(db, message.payload.bundleId);
  if (!bundle) {
    return { ok: false, error: 'Action bundle not found.' };
  }
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: bundle.coopId,
    requestedMemberId: bundle.memberId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }

  const result = approveBundle(bundle);
  if ('error' in result) {
    return { ok: false, error: result.error };
  }

  await saveActionBundle(db, result);
  const logEntry = createActionLogEntry({
    bundle: result,
    eventType: 'proposal-approved',
    detail: `Approved ${result.actionClass} bundle ${result.id}.`,
  });
  await saveActionLogEntry(db, logEntry);

  return { ok: true, data: result };
}

export async function handleRejectAction(
  message: Extract<RuntimeRequest, { type: 'reject-action' }>,
): Promise<RuntimeActionResponse<ActionBundle>> {
  const bundle = await getActionBundle(db, message.payload.bundleId);
  if (!bundle) {
    return { ok: false, error: 'Action bundle not found.' };
  }
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: bundle.coopId,
    requestedMemberId: bundle.memberId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }

  const result = rejectBundle(bundle);
  if ('error' in result) {
    return { ok: false, error: result.error };
  }

  await saveActionBundle(db, result);
  const logEntry = createActionLogEntry({
    bundle: result,
    eventType: 'proposal-rejected',
    detail: `Rejected ${result.actionClass} bundle ${result.id}.`,
  });
  await saveActionLogEntry(db, logEntry);

  return { ok: true, data: result };
}

export async function handleExecuteAction(
  message: Extract<RuntimeRequest, { type: 'execute-action' }>,
): Promise<RuntimeActionResponse<ActionBundle>> {
  const bundle = await getActionBundle(db, message.payload.bundleId);
  if (!bundle) {
    return { ok: false, error: 'Action bundle not found.' };
  }
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: bundle.coopId,
    requestedMemberId: bundle.memberId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }

  const policies = await ensureActionPolicies();
  const policy = findMatchingPolicy(policies, {
    actionClass: bundle.actionClass,
    coopId: bundle.coopId,
    memberId: bundle.memberId,
  });
  if (!policy) {
    return {
      ok: false,
      error: `No policy found for action class "${bundle.actionClass}".`,
    };
  }

  const replayIds = await listRecordedReplayIds(db);
  const replayGuard = createReplayGuard(replayIds);

  const handlers: Partial<
    Record<
      PolicyActionClass,
      (payload: Record<string, unknown>) => Promise<{ ok: boolean; error?: string; data?: unknown }>
    >
  > = {
    'archive-artifact': async (payload) => {
      const scopedPayload = resolveScopedActionPayload({
        actionClass: 'archive-artifact',
        payload,
        expectedCoopId: bundle.coopId,
      });
      if (!scopedPayload.ok) {
        return { ok: false, error: scopedPayload.reason };
      }
      const coopId = scopedPayload.normalizedPayload.coopId as string;
      const artifactId = scopedPayload.normalizedPayload.artifactId as string;
      const result = await handleArchiveArtifact({
        type: 'archive-artifact',
        payload: { coopId, artifactId },
      });
      return { ok: result.ok, error: result.error, data: result.data };
    },
    'archive-snapshot': async (payload) => {
      const scopedPayload = resolveScopedActionPayload({
        actionClass: 'archive-snapshot',
        payload,
        expectedCoopId: bundle.coopId,
      });
      if (!scopedPayload.ok) {
        return { ok: false, error: scopedPayload.reason };
      }
      const coopId = scopedPayload.normalizedPayload.coopId as string;
      const result = await handleArchiveSnapshot({
        type: 'archive-snapshot',
        payload: { coopId },
      });
      return { ok: result.ok, error: result.error, data: result.data };
    },
    'refresh-archive-status': async (payload) => {
      const scopedPayload = resolveScopedActionPayload({
        actionClass: 'refresh-archive-status',
        payload,
        expectedCoopId: bundle.coopId,
      });
      if (!scopedPayload.ok) {
        return { ok: false, error: scopedPayload.reason };
      }
      const coopId = scopedPayload.normalizedPayload.coopId as string;
      const receiptId = scopedPayload.normalizedPayload.receiptId as string | undefined;
      const result = await handleRefreshArchiveStatus({
        type: 'refresh-archive-status',
        payload: { coopId, receiptId },
      });
      return { ok: result.ok, error: result.error, data: result.data };
    },
    'publish-ready-draft': async (payload) => {
      const scopedPayload = resolveScopedActionPayload({
        actionClass: 'publish-ready-draft',
        payload,
        expectedCoopId: bundle.coopId,
      });
      if (!scopedPayload.ok) {
        return { ok: false, error: scopedPayload.reason };
      }
      const draftId = scopedPayload.normalizedPayload.draftId as string;
      const targetCoopIds = scopedPayload.normalizedPayload.targetCoopIds as string[];
      const persistedDraft = await getReviewDraft(db, draftId);
      if (!persistedDraft) {
        return { ok: false, error: 'Draft not found.' };
      }

      const coops = await getCoops();
      const authSession = await getAuthSession(db);
      const scopedCoop = coops.find((item) => item.profile.id === bundle.coopId);
      const scopedMember = scopedCoop
        ? resolveReceiverPairingMember(scopedCoop, authSession, bundle.memberId)
        : undefined;
      const validation = validateReviewDraftPublish({
        persistedDraft,
        incomingDraft: persistedDraft,
        targetCoopIds,
        states: coops,
        authSession,
        activeCoopId: scopedCoop?.profile.id,
        activeMemberId: scopedMember?.id,
      });
      if (!validation.ok) {
        return { ok: false, error: validation.error };
      }

      const publishResult = await publishDraftWithContext({
        draft: persistedDraft,
        targetCoopIds,
        authSession,
        activeCoopId: scopedCoop?.profile.id,
        activeMemberId: scopedMember?.id,
      });
      return { ok: publishResult.ok, error: publishResult.error, data: publishResult.data };
    },
    'safe-deployment': async () => {
      return {
        ok: false,
        error: 'Safe deployment requires direct human confirmation in this phase.',
      };
    },
    'green-goods-create-garden': async (payload) => {
      const scopedPayload = resolveScopedActionPayload({
        actionClass: 'green-goods-create-garden',
        payload,
        expectedCoopId: bundle.coopId,
      });
      if (!scopedPayload.ok) {
        return { ok: false, error: scopedPayload.reason };
      }

      try {
        const provisioningCoop = await updateCoopGreenGoodsState({
          coopId: bundle.coopId,
          apply(current) {
            if (!current?.enabled) {
              throw new Error('Green Goods is not enabled for this coop.');
            }
            return updateGreenGoodsState(current, {
              status: 'provisioning',
              provisioningAt: nowIso(),
              name: scopedPayload.normalizedPayload.name as string,
              slug: scopedPayload.normalizedPayload.slug as string | undefined,
              description: scopedPayload.normalizedPayload.description as string,
              location: scopedPayload.normalizedPayload.location as string,
              bannerImage: scopedPayload.normalizedPayload.bannerImage as string,
              metadata: scopedPayload.normalizedPayload.metadata as string,
              openJoining: scopedPayload.normalizedPayload.openJoining as boolean,
              maxGardeners: scopedPayload.normalizedPayload.maxGardeners as number,
              weightScheme: scopedPayload.normalizedPayload
                .weightScheme as GreenGoodsGardenState['weightScheme'],
              domains: scopedPayload.normalizedPayload.domains as GreenGoodsGardenState['domains'],
              statusNote: 'Provisioning Green Goods garden via the coop Safe.',
              lastError: undefined,
            });
          },
        });
        const provisioningGarden = provisioningCoop.greenGoods;
        if (!provisioningGarden) {
          throw new Error('Green Goods state is missing.');
        }

        const result = await createGreenGoodsGarden({
          mode: configuredOnchainMode,
          coopId: bundle.coopId,
          authSession: trustedNodeContext.authSession,
          pimlicoApiKey: configuredPimlicoApiKey,
          onchainState: provisioningCoop.onchainState,
          garden: provisioningGarden,
          operatorAddresses: scopedPayload.normalizedPayload.operatorAddresses as `0x${string}`[],
          gardenerAddresses: scopedPayload.normalizedPayload.gardenerAddresses as `0x${string}`[],
          liveExecutor: await buildGreenGoodsSessionExecutor({
            coop: provisioningCoop,
            bundle,
          }),
        });

        const linkedCoop = await updateCoopGreenGoodsState({
          coopId: bundle.coopId,
          apply(current) {
            if (!current) {
              throw new Error('Green Goods state is missing.');
            }
            return updateGreenGoodsState(current, {
              status: 'linked',
              gardenAddress: result.gardenAddress,
              tokenId: result.tokenId,
              gapProjectUid: result.gapProjectUid,
              gapAdminAddresses: [],
              linkedAt: nowIso(),
              lastTxHash: result.txHash,
              statusNote: result.detail,
              lastError: undefined,
            });
          },
        });

        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'succeeded',
          detail: `Created Green Goods garden ${result.gardenAddress}.`,
          coop: linkedCoop,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        await emitAgentObservationIfMissing({
          trigger: 'green-goods-sync-needed',
          title: `Green Goods sync needed for ${linkedCoop.profile.name}`,
          summary: `Garden ${result.gardenAddress} should be synced to the latest coop state.`,
          coopId: linkedCoop.profile.id,
          payload: {
            gardenAddress: result.gardenAddress,
            status: linkedCoop.greenGoods?.status,
            lastProfileSyncAt: linkedCoop.greenGoods?.lastProfileSyncAt,
            lastDomainSyncAt: linkedCoop.greenGoods?.lastDomainSyncAt,
            lastPoolSyncAt: linkedCoop.greenGoods?.lastPoolSyncAt,
          },
        });
        const desiredAdmins = linkedCoop.members
          .filter((member) => member.role === 'creator' || member.role === 'trusted')
          .map((member) => member.address);
        const currentAdmins = (linkedCoop.greenGoods?.gapAdminAddresses ?? []) as `0x${string}`[];
        const gapChanges = resolveGreenGoodsGapAdminChanges({
          desiredAdmins: desiredAdmins as `0x${string}`[],
          currentAdmins,
        });
        if (gapChanges.addAdmins.length > 0 || gapChanges.removeAdmins.length > 0) {
          await emitAgentObservationIfMissing({
            trigger: 'green-goods-gap-admin-sync-needed',
            title: `Green Goods GAP admin sync needed for ${linkedCoop.profile.name}`,
            summary: `Karma GAP admins should match the trusted operators for ${linkedCoop.profile.name}.`,
            coopId: linkedCoop.profile.id,
            payload: {
              gardenAddress: result.gardenAddress,
              desiredAdmins,
              currentAdmins: linkedCoop.greenGoods?.gapAdminAddresses ?? [],
            },
          });
        }
        await ensureReceiverSyncOffscreenDocument();
        await requestAgentCycle(`green-goods-sync:${linkedCoop.profile.id}`, true);

        return { ok: true, data: linkedCoop.greenGoods };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Green Goods garden creation failed.';
        try {
          await updateCoopGreenGoodsState({
            coopId: bundle.coopId,
            apply(current) {
              if (!current) {
                throw new Error(message);
              }
              return updateGreenGoodsState(current, {
                status: 'error',
                lastError: message,
                statusNote: message,
              });
            },
          });
        } catch {
          // Ignore follow-up state patch failures and return the original error.
        }
        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'failed',
          detail: `Green Goods garden creation failed: ${message}`,
          coop: trustedNodeContext.coop,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: false, error: message };
      }
    },
    'green-goods-sync-garden-profile': async (payload) => {
      const scopedPayload = resolveScopedActionPayload({
        actionClass: 'green-goods-sync-garden-profile',
        payload,
        expectedCoopId: bundle.coopId,
      });
      if (!scopedPayload.ok) {
        return { ok: false, error: scopedPayload.reason };
      }

      try {
        const coop = await updateCoopGreenGoodsState({
          coopId: bundle.coopId,
          apply(current) {
            if (!current?.gardenAddress) {
              throw new Error('Green Goods garden is not linked yet.');
            }
            return updateGreenGoodsState(current, {
              name: scopedPayload.normalizedPayload.name as string,
              description: scopedPayload.normalizedPayload.description as string,
              location: scopedPayload.normalizedPayload.location as string,
              bannerImage: scopedPayload.normalizedPayload.bannerImage as string,
              metadata: scopedPayload.normalizedPayload.metadata as string,
              openJoining: scopedPayload.normalizedPayload.openJoining as boolean,
              maxGardeners: scopedPayload.normalizedPayload.maxGardeners as number,
              status: 'linked',
              statusNote: 'Syncing Green Goods garden profile fields.',
              lastError: undefined,
            });
          },
        });
        const result = await syncGreenGoodsGardenProfile({
          mode: configuredOnchainMode,
          authSession: trustedNodeContext.authSession,
          pimlicoApiKey: configuredPimlicoApiKey,
          onchainState: coop.onchainState,
          gardenAddress: scopedPayload.normalizedPayload.gardenAddress as `0x${string}`,
          output: {
            name: scopedPayload.normalizedPayload.name as string,
            description: scopedPayload.normalizedPayload.description as string,
            location: scopedPayload.normalizedPayload.location as string,
            bannerImage: scopedPayload.normalizedPayload.bannerImage as string,
            metadata: scopedPayload.normalizedPayload.metadata as string,
            openJoining: scopedPayload.normalizedPayload.openJoining as boolean,
            maxGardeners: scopedPayload.normalizedPayload.maxGardeners as number,
            domains: coop.greenGoods?.domains ?? [],
            ensurePools: true,
            rationale: 'Sync Green Goods garden profile fields.',
          },
          liveExecutor: await buildGreenGoodsSessionExecutor({
            coop,
            bundle,
          }),
        });
        const updated = await updateCoopGreenGoodsState({
          coopId: bundle.coopId,
          apply(current) {
            if (!current) {
              throw new Error('Green Goods state is missing.');
            }
            return updateGreenGoodsState(current, {
              status: 'linked',
              lastProfileSyncAt: nowIso(),
              lastTxHash: result.txHash,
              statusNote: result.detail,
              lastError: undefined,
            });
          },
        });
        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'succeeded',
          detail: `Synced Green Goods garden profile for ${scopedPayload.normalizedPayload.gardenAddress as string}.`,
          coop: updated,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: true, data: updated.greenGoods };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Green Goods garden profile sync failed.';
        try {
          await updateCoopGreenGoodsState({
            coopId: bundle.coopId,
            apply(current) {
              if (!current) {
                throw new Error(message);
              }
              return updateGreenGoodsState(current, {
                status: 'error',
                lastError: message,
                statusNote: message,
              });
            },
          });
        } catch {
          // Ignore follow-up state patch failures and return the original error.
        }
        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'failed',
          detail: `Green Goods garden profile sync failed: ${message}`,
          coop: trustedNodeContext.coop,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: false, error: message };
      }
    },
    // The remaining green-goods handlers follow the same pattern.
    // Including them inline since they're part of the execute-action dispatch table.
    'green-goods-set-garden-domains': async (payload) => {
      const scopedPayload = resolveScopedActionPayload({
        actionClass: 'green-goods-set-garden-domains',
        payload,
        expectedCoopId: bundle.coopId,
      });
      if (!scopedPayload.ok) return { ok: false, error: scopedPayload.reason };
      try {
        const coop = trustedNodeContext.coop;
        const result = await setGreenGoodsGardenDomains({
          mode: configuredOnchainMode,
          authSession: trustedNodeContext.authSession,
          pimlicoApiKey: configuredPimlicoApiKey,
          onchainState: coop.onchainState,
          gardenAddress: scopedPayload.normalizedPayload.gardenAddress as `0x${string}`,
          domains: scopedPayload.normalizedPayload.domains as GreenGoodsGardenState['domains'],
          liveExecutor: await buildGreenGoodsSessionExecutor({ coop, bundle }),
        });
        const updated = await updateCoopGreenGoodsState({
          coopId: bundle.coopId,
          apply(current) {
            if (!current) throw new Error('Green Goods state is missing.');
            return updateGreenGoodsState(current, {
              status: 'linked',
              domains: scopedPayload.normalizedPayload.domains as GreenGoodsGardenState['domains'],
              lastDomainSyncAt: nowIso(),
              lastTxHash: result.txHash,
              statusNote: result.detail,
              lastError: undefined,
            });
          },
        });
        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'succeeded',
          detail: `Updated Green Goods garden domains for ${scopedPayload.normalizedPayload.gardenAddress as string}.`,
          coop: updated,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: true, data: updated.greenGoods };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Green Goods domain sync failed.';
        try {
          await updateCoopGreenGoodsState({
            coopId: bundle.coopId,
            apply(current) {
              if (!current) throw new Error(message);
              return updateGreenGoodsState(current, {
                status: 'error',
                lastError: message,
                statusNote: message,
              });
            },
          });
        } catch {
          /* ignore */
        }
        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'failed',
          detail: `Green Goods domain sync failed: ${message}`,
          coop: trustedNodeContext.coop,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: false, error: message };
      }
    },
    'green-goods-create-garden-pools': async (payload) => {
      const scopedPayload = resolveScopedActionPayload({
        actionClass: 'green-goods-create-garden-pools',
        payload,
        expectedCoopId: bundle.coopId,
      });
      if (!scopedPayload.ok) return { ok: false, error: scopedPayload.reason };
      try {
        const coop = trustedNodeContext.coop;
        const result = await createGreenGoodsGardenPools({
          mode: configuredOnchainMode,
          authSession: trustedNodeContext.authSession,
          pimlicoApiKey: configuredPimlicoApiKey,
          onchainState: coop.onchainState,
          gardenAddress: scopedPayload.normalizedPayload.gardenAddress as `0x${string}`,
          liveExecutor: await buildGreenGoodsSessionExecutor({ coop, bundle }),
        });
        const updated = await updateCoopGreenGoodsState({
          coopId: bundle.coopId,
          apply(current) {
            if (!current) throw new Error('Green Goods state is missing.');
            return updateGreenGoodsState(current, {
              status: 'linked',
              lastPoolSyncAt: nowIso(),
              lastTxHash: result.txHash,
              statusNote: result.detail,
              lastError: undefined,
            });
          },
        });
        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'succeeded',
          detail: `Created Green Goods signal pools for ${scopedPayload.normalizedPayload.gardenAddress as string}.`,
          coop: updated,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: true, data: updated.greenGoods };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Green Goods pool creation failed.';
        try {
          await updateCoopGreenGoodsState({
            coopId: bundle.coopId,
            apply(current) {
              if (!current) throw new Error(message);
              return updateGreenGoodsState(current, {
                status: 'error',
                lastError: message,
                statusNote: message,
              });
            },
          });
        } catch {
          /* ignore */
        }
        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'failed',
          detail: `Green Goods pool creation failed: ${message}`,
          coop: trustedNodeContext.coop,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: false, error: message };
      }
    },
    'green-goods-submit-work-approval': async (payload) => {
      const scopedPayload = resolveScopedActionPayload({
        actionClass: 'green-goods-submit-work-approval',
        payload,
        expectedCoopId: bundle.coopId,
      });
      if (!scopedPayload.ok) return { ok: false, error: scopedPayload.reason };
      try {
        const coop = trustedNodeContext.coop;
        const result = await submitGreenGoodsWorkApproval({
          mode: configuredOnchainMode,
          authSession: trustedNodeContext.authSession,
          pimlicoApiKey: configuredPimlicoApiKey,
          onchainState: coop.onchainState,
          gardenAddress: scopedPayload.normalizedPayload.gardenAddress as `0x${string}`,
          output: {
            actionUid: scopedPayload.normalizedPayload.actionUid as number,
            workUid: scopedPayload.normalizedPayload.workUid as `0x${string}`,
            approved: scopedPayload.normalizedPayload.approved as boolean,
            feedback: scopedPayload.normalizedPayload.feedback as string,
            confidence: scopedPayload.normalizedPayload.confidence as number,
            verificationMethod: scopedPayload.normalizedPayload.verificationMethod as number,
            reviewNotesCid: scopedPayload.normalizedPayload.reviewNotesCid as string,
            rationale: 'Submit Green Goods work approval.',
          },
        });
        const updated = await updateCoopGreenGoodsState({
          coopId: bundle.coopId,
          apply(current) {
            if (!current) throw new Error('Green Goods state is missing.');
            return updateGreenGoodsState(current, {
              status: 'linked',
              lastWorkApprovalAt: nowIso(),
              lastTxHash: result.txHash,
              statusNote: result.detail,
              lastError: undefined,
            });
          },
        });
        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'succeeded',
          detail: `Submitted Green Goods work approval for ${scopedPayload.normalizedPayload.workUid as string}.`,
          coop: updated,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: true, data: updated.greenGoods };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Green Goods work approval submission failed.';
        try {
          await updateCoopGreenGoodsState({
            coopId: bundle.coopId,
            apply(current) {
              if (!current) throw new Error(message);
              return updateGreenGoodsState(current, {
                status: 'error',
                lastError: message,
                statusNote: message,
              });
            },
          });
        } catch {
          /* ignore */
        }
        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'failed',
          detail: `Green Goods work approval submission failed: ${message}`,
          coop: trustedNodeContext.coop,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: false, error: message };
      }
    },
    'green-goods-create-assessment': async (payload) => {
      const scopedPayload = resolveScopedActionPayload({
        actionClass: 'green-goods-create-assessment',
        payload,
        expectedCoopId: bundle.coopId,
      });
      if (!scopedPayload.ok) return { ok: false, error: scopedPayload.reason };
      try {
        const coop = trustedNodeContext.coop;
        const result = await createGreenGoodsAssessment({
          mode: configuredOnchainMode,
          authSession: trustedNodeContext.authSession,
          pimlicoApiKey: configuredPimlicoApiKey,
          onchainState: coop.onchainState,
          gardenAddress: scopedPayload.normalizedPayload.gardenAddress as `0x${string}`,
          output: {
            title: scopedPayload.normalizedPayload.title as string,
            description: scopedPayload.normalizedPayload.description as string,
            assessmentConfigCid: scopedPayload.normalizedPayload.assessmentConfigCid as string,
            domain: scopedPayload.normalizedPayload
              .domain as GreenGoodsGardenState['domains'][number],
            startDate: scopedPayload.normalizedPayload.startDate as number,
            endDate: scopedPayload.normalizedPayload.endDate as number,
            location: scopedPayload.normalizedPayload.location as string,
            rationale: 'Create Green Goods assessment.',
          },
        });
        const updated = await updateCoopGreenGoodsState({
          coopId: bundle.coopId,
          apply(current) {
            if (!current) throw new Error('Green Goods state is missing.');
            return updateGreenGoodsState(current, {
              status: 'linked',
              lastAssessmentAt: nowIso(),
              lastTxHash: result.txHash,
              statusNote: result.detail,
              lastError: undefined,
            });
          },
        });
        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'succeeded',
          detail: `Created Green Goods assessment ${scopedPayload.normalizedPayload.title as string}.`,
          coop: updated,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: true, data: updated.greenGoods };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Green Goods assessment creation failed.';
        try {
          await updateCoopGreenGoodsState({
            coopId: bundle.coopId,
            apply(current) {
              if (!current) throw new Error(message);
              return updateGreenGoodsState(current, {
                status: 'error',
                lastError: message,
                statusNote: message,
              });
            },
          });
        } catch {
          /* ignore */
        }
        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'failed',
          detail: `Green Goods assessment creation failed: ${message}`,
          coop: trustedNodeContext.coop,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: false, error: message };
      }
    },
    'green-goods-sync-gap-admins': async (payload) => {
      const scopedPayload = resolveScopedActionPayload({
        actionClass: 'green-goods-sync-gap-admins',
        payload,
        expectedCoopId: bundle.coopId,
      });
      if (!scopedPayload.ok) return { ok: false, error: scopedPayload.reason };
      try {
        const coop = trustedNodeContext.coop;
        const addAdmins = scopedPayload.normalizedPayload.addAdmins as `0x${string}`[];
        const removeAdmins = scopedPayload.normalizedPayload.removeAdmins as `0x${string}`[];
        const result = await syncGreenGoodsGapAdmins({
          mode: configuredOnchainMode,
          authSession: trustedNodeContext.authSession,
          pimlicoApiKey: configuredPimlicoApiKey,
          onchainState: coop.onchainState,
          gardenAddress: scopedPayload.normalizedPayload.gardenAddress as `0x${string}`,
          addAdmins,
          removeAdmins,
        });
        const nextAdminAddresses = coop.members
          .filter((m) => m.role === 'creator' || m.role === 'trusted')
          .map((m) => m.address);
        const updated = await updateCoopGreenGoodsState({
          coopId: bundle.coopId,
          apply(current) {
            if (!current) throw new Error('Green Goods state is missing.');
            return updateGreenGoodsState(current, {
              status: 'linked',
              gapAdminAddresses: nextAdminAddresses,
              lastGapAdminSyncAt: nowIso(),
              lastTxHash: result.txHash,
              statusNote: result.detail,
              lastError: undefined,
            });
          },
        });
        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'succeeded',
          detail: `Synced Green Goods GAP admins for ${scopedPayload.normalizedPayload.gardenAddress as string}.`,
          coop: updated,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: true, data: updated.greenGoods };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Green Goods GAP admin sync failed.';
        try {
          await updateCoopGreenGoodsState({
            coopId: bundle.coopId,
            apply(current) {
              if (!current) throw new Error(message);
              return updateGreenGoodsState(current, {
                status: 'error',
                lastError: message,
                statusNote: message,
              });
            },
          });
        } catch {
          /* ignore */
        }
        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'failed',
          detail: `Green Goods GAP admin sync failed: ${message}`,
          coop: trustedNodeContext.coop,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: false, error: message };
      }
    },
    'erc8004-register-agent': async (payload) => {
      const scopedPayload = resolveScopedActionPayload({
        actionClass: 'erc8004-register-agent',
        payload,
        expectedCoopId: bundle.coopId,
      });
      if (!scopedPayload.ok) return { ok: false, error: scopedPayload.reason };
      try {
        const coop = trustedNodeContext.coop;
        const agentURI = scopedPayload.normalizedPayload.agentURI as string;
        const metadata =
          (scopedPayload.normalizedPayload.metadata as Array<{ key: string; value: string }>) ?? [];
        let liveExecutor: Erc8004LiveExecutor | undefined;
        if (configuredOnchainMode === 'live') {
          const context = await createOwnerSafeExecutionContext({
            authSession: trustedNodeContext.authSession,
            onchainState: coop.onchainState,
          });
          liveExecutor = async (tx) =>
            context.smartClient.sendTransaction({ ...tx, value: tx.value ?? 0n });
        }
        const result = await registerAgentIdentity({
          mode: configuredOnchainMode,
          onchainState: coop.onchainState,
          agentURI,
          metadata,
          coopId: bundle.coopId,
          pimlicoApiKey: configuredPimlicoApiKey,
          liveExecutor,
        });
        const nextState: CoopSharedState = {
          ...coop,
          agentIdentity: {
            enabled: true,
            agentId: result.agentId,
            agentURI,
            registrationTxHash: result.txHash,
            registeredAt: nowIso(),
            feedbackCount: 0,
            status: 'registered',
            statusNote: result.detail,
          },
        };
        await saveState(nextState);
        await logPrivilegedAction({
          actionType: 'erc8004-registration',
          status: 'succeeded',
          detail: `ERC-8004 agent registered (agentId=${result.agentId}) via tx ${result.txHash}.`,
          coop: nextState,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: true, data: nextState.agentIdentity };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'ERC-8004 agent registration failed.';
        await logPrivilegedAction({
          actionType: 'erc8004-registration',
          status: 'failed',
          detail: message,
          coop: trustedNodeContext.coop,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: false, error: message };
      }
    },
    'erc8004-give-feedback': async (payload) => {
      const scopedPayload = resolveScopedActionPayload({
        actionClass: 'erc8004-give-feedback',
        payload,
        expectedCoopId: bundle.coopId,
      });
      if (!scopedPayload.ok) return { ok: false, error: scopedPayload.reason };
      try {
        const coop = trustedNodeContext.coop;
        const targetAgentId = scopedPayload.normalizedPayload.targetAgentId as number;
        const value = scopedPayload.normalizedPayload.value as number;
        const tag1 = scopedPayload.normalizedPayload.tag1 as string;
        const tag2 = scopedPayload.normalizedPayload.tag2 as string;
        const rationale = (scopedPayload.normalizedPayload.rationale as string) ?? '';
        let feedbackExecutor: Erc8004LiveExecutor | undefined;
        if (configuredOnchainMode === 'live') {
          const ctx = await createOwnerSafeExecutionContext({
            authSession: trustedNodeContext.authSession,
            onchainState: coop.onchainState,
          });
          feedbackExecutor = async (tx) =>
            ctx.smartClient.sendTransaction({ ...tx, value: tx.value ?? 0n });
        }
        const result = await giveAgentFeedback({
          mode: configuredOnchainMode,
          onchainState: coop.onchainState,
          targetAgentId,
          value,
          tag1,
          tag2,
          comment: rationale,
          pimlicoApiKey: configuredPimlicoApiKey,
          liveExecutor: feedbackExecutor,
        });
        const currentIdentity = coop.agentIdentity;
        if (currentIdentity) {
          const nextState: CoopSharedState = {
            ...coop,
            agentIdentity: {
              ...currentIdentity,
              feedbackCount: (currentIdentity.feedbackCount ?? 0) + 1,
              lastFeedbackAt: nowIso(),
            },
          };
          await saveState(nextState);
        }
        await logPrivilegedAction({
          actionType: 'erc8004-feedback',
          status: 'succeeded',
          detail: `ERC-8004 feedback submitted for agentId=${targetAgentId} via tx ${result.txHash}.`,
          coop,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: true, data: { txHash: result.txHash } };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'ERC-8004 feedback submission failed.';
        await logPrivilegedAction({
          actionType: 'erc8004-feedback',
          status: 'failed',
          detail: message,
          coop: trustedNodeContext.coop,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: false, error: message };
      }
    },
  };

  const startLogEntry = createActionLogEntry({
    bundle,
    eventType: 'execution-started',
    detail: `Executing ${bundle.actionClass} bundle ${bundle.id}.`,
  });
  await saveActionLogEntry(db, startLogEntry);

  const executionResult = await executeBundleAction({
    bundle,
    policy,
    replayGuard,
    handlers,
  });

  await saveActionBundle(db, executionResult.bundle);

  if (executionResult.ok) {
    await recordReplayId(db, bundle.replayId, bundle.id, nowIso());
    const successLogEntry = createActionLogEntry({
      bundle: executionResult.bundle,
      eventType: 'execution-succeeded',
      detail: executionResult.detail,
    });
    await saveActionLogEntry(db, successLogEntry);
  } else {
    const failLogEntry = createActionLogEntry({
      bundle: executionResult.bundle,
      eventType: 'execution-failed',
      detail: executionResult.detail,
    });
    await saveActionLogEntry(db, failLogEntry);
  }

  return {
    ok: executionResult.ok,
    data: executionResult.bundle,
    error: executionResult.ok ? undefined : executionResult.detail,
  };
}

export async function handleGetActionQueue(): Promise<RuntimeActionResponse<ActionBundle[]>> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) {
    return { ok: true, data: [] };
  }
  const bundles = await listActionBundlesByStatus(db, ['proposed', 'approved']);
  const processed = expireStaleBundles(
    bundles.filter((bundle) => bundle.coopId === trustedNodeContext.coop.profile.id),
  );
  for (const bundle of processed) {
    if (bundle.status === 'expired') {
      await saveActionBundle(db, bundle);
    }
  }
  return { ok: true, data: pendingBundles(processed) };
}

export async function handleGetActionHistory(): Promise<RuntimeActionResponse<ActionLogEntry[]>> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) {
    return { ok: true, data: [] };
  }
  const entries = (await listActionLogEntries(db, 50)).filter(
    (entry) => entry.coopId === trustedNodeContext.coop.profile.id,
  );
  return { ok: true, data: entries };
}

// ---- Grant Handlers ----

type PreparedDelegatedExecution =
  | {
      ok: true;
      normalizedPayload: Record<string, unknown>;
      targetIds: string[];
      execute(): Promise<RuntimeActionResponse>;
    }
  | {
      ok: false;
      error: string;
    };

async function prepareDelegatedExecution(
  message: Extract<RuntimeRequest, { type: 'execute-with-grant' }>,
  authSession: Awaited<ReturnType<typeof getAuthSession>>,
): Promise<PreparedDelegatedExecution> {
  const scopedAction = resolveDelegatedActionExecution({
    actionClass: message.payload.actionClass,
    coopId: message.payload.coopId,
    actionPayload: message.payload.actionPayload,
  });
  if (!scopedAction.ok) {
    return { ok: false, error: scopedAction.reason };
  }

  switch (message.payload.actionClass) {
    case 'archive-artifact': {
      const coopId = scopedAction.normalizedPayload.coopId as string;
      const artifactId = scopedAction.normalizedPayload.artifactId as string;
      const coops = await getCoops();
      const coop = coops.find((item) => item.profile.id === coopId);
      if (!coop) return { ok: false, error: 'Coop not found.' };
      if (!coop.artifacts.some((artifact) => artifact.id === artifactId))
        return { ok: false, error: 'Artifact not found.' };
      return {
        ok: true,
        normalizedPayload: scopedAction.normalizedPayload,
        targetIds: scopedAction.targetIds,
        execute: () =>
          handleArchiveArtifact({ type: 'archive-artifact', payload: { coopId, artifactId } }),
      };
    }
    case 'archive-snapshot': {
      const coopId = scopedAction.normalizedPayload.coopId as string;
      const coops = await getCoops();
      if (!coops.some((item) => item.profile.id === coopId))
        return { ok: false, error: 'Coop not found.' };
      return {
        ok: true,
        normalizedPayload: scopedAction.normalizedPayload,
        targetIds: scopedAction.targetIds,
        execute: () => handleArchiveSnapshot({ type: 'archive-snapshot', payload: { coopId } }),
      };
    }
    case 'refresh-archive-status': {
      const coopId = scopedAction.normalizedPayload.coopId as string;
      const receiptId = scopedAction.normalizedPayload.receiptId as string | undefined;
      const coops = await getCoops();
      const coop = coops.find((item) => item.profile.id === coopId);
      if (!coop) return { ok: false, error: 'Coop not found.' };
      if (receiptId && !coop.archiveReceipts.some((receipt) => receipt.id === receiptId))
        return { ok: false, error: 'Archive receipt not found.' };
      return {
        ok: true,
        normalizedPayload: scopedAction.normalizedPayload,
        targetIds: scopedAction.targetIds,
        execute: () =>
          handleRefreshArchiveStatus({
            type: 'refresh-archive-status',
            payload: { coopId, receiptId },
          }),
      };
    }
    case 'publish-ready-draft': {
      const draftId = scopedAction.normalizedPayload.draftId as string;
      const targetCoopIds = scopedAction.normalizedPayload.targetCoopIds as string[];
      const draft = await getReviewDraft(db, draftId);
      if (!draft) return { ok: false, error: 'Draft not found.' };
      const coops = await getCoops();
      const scopedCoop = coops.find((item) => item.profile.id === message.payload.coopId);
      const scopedMember = scopedCoop
        ? findAuthenticatedCoopMember(scopedCoop, authSession)
        : undefined;
      const validation = validateReviewDraftPublish({
        persistedDraft: draft,
        incomingDraft: draft,
        targetCoopIds,
        states: coops,
        authSession,
        activeCoopId: scopedCoop?.profile.id,
        activeMemberId: scopedMember?.id,
      });
      if (!validation.ok) return { ok: false, error: validation.error };
      return {
        ok: true,
        normalizedPayload: scopedAction.normalizedPayload,
        targetIds: scopedAction.targetIds,
        execute: () =>
          publishDraftWithContext({
            draft,
            targetCoopIds,
            authSession,
            activeCoopId: scopedCoop?.profile.id,
            activeMemberId: scopedMember?.id,
          }),
      };
    }
  }
}

async function reserveGrantExecution(input: {
  grantId: string;
  actionClass: DelegatedActionClass;
  coopId: string;
  replayId: string;
  targetIds: string[];
  executor: Pick<ExecutionGrant['executor'], 'label' | 'localIdentityId'>;
}) {
  return db.transaction('rw', db.executionGrants, db.replayIds, async () => {
    const grant = await getExecutionGrant(db, input.grantId);
    if (!grant) return { ok: false as const, error: 'Grant not found.' };
    const refreshed = refreshGrantStatus(grant);
    if (refreshed.status !== grant.status) await saveExecutionGrant(db, refreshed);
    const replayExists = (await db.replayIds.get(input.replayId)) !== undefined;
    const validation = validateGrantForExecution({
      grant: refreshed,
      actionClass: input.actionClass,
      coopId: input.coopId,
      replayId: input.replayId,
      replayGuard: createReplayGuard(replayExists ? [input.replayId] : []),
      targetIds: input.targetIds,
      executor: input.executor,
    });
    if (!validation.ok) return { ok: false as const, grant: refreshed, validation };
    const reservedGrant = incrementGrantUsage(refreshed);
    await saveExecutionGrant(db, reservedGrant);
    await recordReplayId(db, input.replayId, reservedGrant.id, nowIso());
    return { ok: true as const, grant: reservedGrant };
  });
}

export async function handleIssueGrant(
  message: Extract<RuntimeRequest, { type: 'issue-grant' }>,
): Promise<RuntimeActionResponse<ExecutionGrant>> {
  const authSession = await getAuthSession(db);
  if (!authSession) return { ok: false, error: 'Authentication required to issue grants.' };
  const creatorResolution = await requireCreatorGrantManager(
    message.payload.coopId,
    authSession,
    'Only coop creators can issue execution grants.',
  );
  if (!creatorResolution.ok) return { ok: false, error: creatorResolution.error };
  const executor = createRuntimeGrantExecutor(authSession);
  if (!executor.localIdentityId)
    return { ok: false, error: 'A passkey member session is required to issue execution grants.' };
  const grant = createExecutionGrant({
    coopId: message.payload.coopId,
    issuedBy: {
      memberId: creatorResolution.member.id,
      displayName: creatorResolution.member.displayName,
      address: authSession.primaryAddress,
    },
    executor,
    expiresAt: message.payload.expiresAt,
    maxUses: message.payload.maxUses,
    allowedActions: message.payload.allowedActions,
    targetAllowlist: message.payload.targetAllowlist,
  });
  await saveExecutionGrant(db, grant);
  const logEntry = createGrantLogEntry({
    grantId: grant.id,
    eventType: 'grant-issued',
    detail: `Grant issued for ${grant.allowedActions.join(', ')} (max ${grant.maxUses} uses, expires ${grant.expiresAt}).`,
    coopId: grant.coopId,
  });
  await saveGrantLogEntry(db, logEntry);
  return { ok: true, data: grant };
}

export async function handleRevokeGrant(
  message: Extract<RuntimeRequest, { type: 'revoke-grant' }>,
): Promise<RuntimeActionResponse<ExecutionGrant>> {
  const grant = await getExecutionGrant(db, message.payload.grantId);
  if (!grant) return { ok: false, error: 'Grant not found.' };
  const authSession = await getAuthSession(db);
  if (!authSession) return { ok: false, error: 'Authentication required to revoke grants.' };
  const creatorResolution = await requireCreatorGrantManager(
    grant.coopId,
    authSession,
    'Only coop creators can revoke execution grants.',
  );
  if (!creatorResolution.ok) return { ok: false, error: creatorResolution.error };
  const revoked = revokeGrant(grant);
  await saveExecutionGrant(db, revoked);
  const logEntry = createGrantLogEntry({
    grantId: revoked.id,
    eventType: 'grant-revoked',
    detail: `Grant ${revoked.id} revoked.`,
    coopId: revoked.coopId,
  });
  await saveGrantLogEntry(db, logEntry);
  return { ok: true, data: revoked };
}

export async function handleExecuteWithGrant(
  message: Extract<RuntimeRequest, { type: 'execute-with-grant' }>,
): Promise<RuntimeActionResponse> {
  const authSession = await getAuthSession(db);
  if (!authSession) return { ok: false, error: 'Authentication required for delegated execution.' };
  const executor = createRuntimeGrantExecutor(authSession);
  if (!executor.localIdentityId)
    return { ok: false, error: 'A passkey member session is required for delegated execution.' };
  const prepared = await prepareDelegatedExecution(message, authSession);
  if (!prepared.ok) return { ok: false, error: prepared.error };
  const reservation = await reserveGrantExecution({
    grantId: message.payload.grantId,
    actionClass: message.payload.actionClass,
    coopId: message.payload.coopId,
    replayId: message.payload.replayId,
    targetIds: prepared.targetIds,
    executor,
  });
  if (!reservation.ok) {
    if ('error' in reservation) return { ok: false, error: reservation.error };
    const logEventType =
      reservation.validation.rejectType === 'replay-rejected'
        ? ('delegated-replay-rejected' as const)
        : reservation.validation.rejectType === 'exhausted'
          ? ('delegated-exhausted-rejected' as const)
          : reservation.validation.rejectType === 'revoked'
            ? ('grant-revoked' as const)
            : reservation.validation.rejectType === 'expired'
              ? ('grant-expired' as const)
              : ('delegated-execution-failed' as const);
    await saveGrantLogEntry(
      db,
      createGrantLogEntry({
        grantId: reservation.grant.id,
        eventType: logEventType,
        detail: reservation.validation.reason,
        actionClass: message.payload.actionClass,
        coopId: message.payload.coopId,
        replayId: message.payload.replayId,
      }),
    );
    return { ok: false, error: reservation.validation.reason };
  }
  await saveGrantLogEntry(
    db,
    createGrantLogEntry({
      grantId: reservation.grant.id,
      eventType: 'delegated-execution-attempted',
      detail: `Attempting delegated ${message.payload.actionClass} on coop ${message.payload.coopId}.`,
      actionClass: message.payload.actionClass,
      coopId: message.payload.coopId,
      replayId: message.payload.replayId,
    }),
  );
  let result: RuntimeActionResponse;
  try {
    result = await prepared.execute();
  } catch (error) {
    result = {
      ok: false,
      error: error instanceof Error ? error.message : 'Delegated execution failed unexpectedly.',
    };
  }
  if (result.ok) {
    await saveGrantLogEntry(
      db,
      createGrantLogEntry({
        grantId: reservation.grant.id,
        eventType: 'delegated-execution-succeeded',
        detail: `Delegated ${message.payload.actionClass} succeeded.`,
        actionClass: message.payload.actionClass,
        coopId: message.payload.coopId,
        replayId: message.payload.replayId,
      }),
    );
  } else {
    await saveGrantLogEntry(
      db,
      createGrantLogEntry({
        grantId: reservation.grant.id,
        eventType: 'delegated-execution-failed',
        detail: result.error ?? 'Delegated execution failed.',
        actionClass: message.payload.actionClass,
        coopId: message.payload.coopId,
        replayId: message.payload.replayId,
      }),
    );
  }
  return result;
}

export async function handleGetGrants(): Promise<RuntimeActionResponse<ExecutionGrant[]>> {
  const { refreshStoredGrantStatuses } = await import('../dashboard');
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) return { ok: true, data: [] };
  return {
    ok: true,
    data: (await refreshStoredGrantStatuses()).filter(
      (grant) => grant.coopId === trustedNodeContext.coop.profile.id,
    ),
  };
}

export async function handleGetGrantLog(): Promise<RuntimeActionResponse<GrantLogEntry[]>> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) return { ok: true, data: [] };
  const entries = (await listGrantLogEntries(db)).filter(
    (entry) => entry.coopId === trustedNodeContext.coop.profile.id,
  );
  return { ok: true, data: entries };
}
