import {
  type AnchorCapability,
  type CoopSharedState,
  createAnchorCapability,
  createCoop,
  createMockOnchainState,
  createStateFromInviteBootstrap,
  createUnavailableOnchainState,
  deployCoopSafe,
  getAuthSession,
  initializeCoopPrivacy,
  initializeMemberPrivacy,
  joinCoop,
  nowIso,
  parseInviteCode,
  setAnchorCapability,
  verifyInviteCodeProof,
} from '@coop/shared';
import type { RuntimeActionResponse, RuntimeRequest } from '../../runtime/messages';
import { requireAnchorModeForFeature } from '../../runtime/operator';
import {
  configuredChain,
  configuredOnchainMode,
  db,
  ensureReceiverSyncOffscreenDocument,
  getCoops,
  notifyExtensionEvent,
  saveState,
  setLocalSetting,
  stateKeys,
  syncCaptureAlarm,
} from '../context';
import { refreshBadge } from '../dashboard';
import { getOperatorState, logPrivilegedAction } from '../operator';
import { emitAgentObservationIfMissing, requestAgentCycle } from './agent';

export async function handleSetAnchorMode(
  message: Extract<RuntimeRequest, { type: 'set-anchor-mode' }>,
) {
  const operator = await getOperatorState();
  if (message.payload.enabled && !operator.authSession) {
    return {
      ok: false,
      error: 'Anchor mode requires an authenticated passkey member session.',
    } satisfies RuntimeActionResponse;
  }

  const capability = createAnchorCapability({
    enabled: message.payload.enabled,
    authSession: operator.authSession,
    memberId: operator.activeMember?.id,
    memberDisplayName: operator.activeMember?.displayName,
  });
  await setAnchorCapability(db, capability);
  await logPrivilegedAction({
    actionType: 'anchor-mode-toggle',
    status: 'succeeded',
    detail: message.payload.enabled
      ? 'Anchor mode enabled for this operator node.'
      : 'Anchor mode disabled for this operator node.',
    coop: operator.activeCoop,
    memberId: operator.activeMember?.id,
    memberDisplayName: operator.activeMember?.displayName,
    authSession: operator.authSession,
  });
  return {
    ok: true,
    data: capability,
  } satisfies RuntimeActionResponse<AnchorCapability>;
}

export async function handleResolveOnchainState(
  message: Extract<RuntimeRequest, { type: 'resolve-onchain-state' }>,
) {
  const authSession = await getAuthSession(db);
  if (!authSession) {
    return {
      ok: false,
      error: 'A passkey session is required before creating a coop.',
    } satisfies RuntimeActionResponse;
  }

  if (configuredOnchainMode === 'mock') {
    return {
      ok: true,
      data: createMockOnchainState({
        seed: message.payload.coopSeed,
        senderAddress: authSession.primaryAddress,
        chainKey: configuredChain,
      }),
    } satisfies RuntimeActionResponse;
  }

  const pimlicoApiKey = import.meta.env.VITE_PIMLICO_API_KEY;
  if (!pimlicoApiKey) {
    return {
      ok: true,
      data: createUnavailableOnchainState({
        safeAddressSeed: message.payload.coopSeed,
        senderAddress: authSession.primaryAddress,
        chainKey: configuredChain,
      }),
    } satisfies RuntimeActionResponse;
  }

  const operator = await getOperatorState({
    authSession,
  });

  try {
    await logPrivilegedAction({
      actionType: 'safe-deployment',
      status: 'attempted',
      detail: 'Attempting live Safe deployment.',
      coop: operator.activeCoop,
      memberId: operator.activeMember?.id,
      memberDisplayName: operator.activeMember?.displayName,
      authSession,
    });
    requireAnchorModeForFeature({
      capability: operator.anchorCapability,
      authSession,
      feature: 'live Safe deployments',
    });
    const onchainState = await deployCoopSafe({
      authSession,
      coopSeed: message.payload.coopSeed,
      pimlico: {
        apiKey: pimlicoApiKey,
        chainKey: configuredChain,
        sponsorshipPolicyId: import.meta.env.VITE_PIMLICO_SPONSORSHIP_POLICY_ID,
      },
    });
    await logPrivilegedAction({
      actionType: 'safe-deployment',
      status: 'succeeded',
      detail: `Live Safe deployed on ${onchainState.chainKey}.`,
      coop: operator.activeCoop,
      memberId: operator.activeMember?.id,
      memberDisplayName: operator.activeMember?.displayName,
      authSession,
    });
    await notifyExtensionEvent({
      eventKind: 'safe-deployment',
      entityId: message.payload.coopSeed,
      state: 'succeeded',
      title: 'Safe deployed',
      message: `Live Safe deployment completed on ${onchainState.chainKey}.`,
    });
    return {
      ok: true,
      data: onchainState,
    } satisfies RuntimeActionResponse;
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : 'Live Safe deployment failed unexpectedly.';
    await logPrivilegedAction({
      actionType: 'safe-deployment',
      status: 'failed',
      detail: messageText,
      coop: operator.activeCoop,
      memberId: operator.activeMember?.id,
      memberDisplayName: operator.activeMember?.displayName,
      authSession,
    });
    await notifyExtensionEvent({
      eventKind: 'safe-deployment',
      entityId: message.payload.coopSeed,
      state: 'failed',
      title: 'Safe deployment failed',
      message: messageText,
    });
    return {
      ok: false,
      error: messageText,
    } satisfies RuntimeActionResponse;
  }
}

export async function handleCreateCoop(message: Extract<RuntimeRequest, { type: 'create-coop' }>) {
  const created = createCoop(message.payload);
  await saveState(created.state);
  await setLocalSetting(stateKeys.activeCoopId, created.state.profile.id);
  await setLocalSetting(stateKeys.captureMode, created.state.profile.captureMode);
  if (created.state.greenGoods?.enabled) {
    await emitAgentObservationIfMissing({
      trigger: 'green-goods-garden-requested',
      title: `Green Goods garden requested for ${created.state.profile.name}`,
      summary: `Create a Green Goods garden owned by ${created.state.profile.name}'s coop Safe.`,
      coopId: created.state.profile.id,
      payload: {
        status: created.state.greenGoods.status,
        requestedAt: created.state.greenGoods.requestedAt,
        weightScheme: created.state.greenGoods.weightScheme,
        domainMask: created.state.greenGoods.domainMask,
      },
    });
    await ensureReceiverSyncOffscreenDocument();
    await requestAgentCycle(`green-goods-create:${created.state.profile.id}`, true);
  }
  // Initialize privacy primitives for the new coop
  try {
    const creatorMemberId = created.state.members[0]?.id;
    if (creatorMemberId) {
      const privacyResult = await initializeCoopPrivacy(db, {
        coopId: created.state.profile.id,
        memberId: creatorMemberId,
      });
      // Add the creator's commitment to shared state for peer sync
      await saveState({
        ...created.state,
        memberCommitments: [privacyResult.identity.commitment],
      });
    }
  } catch (privacyError) {
    console.warn('[coop:privacy] Failed to initialize coop privacy:', privacyError);
  }
  await syncCaptureAlarm(created.state.profile.captureMode);
  await refreshBadge();
  return {
    ok: true,
    data: created.state,
    soundEvent: created.soundEvent,
  } satisfies RuntimeActionResponse<CoopSharedState>;
}

export async function handleJoinCoop(message: Extract<RuntimeRequest, { type: 'join-coop' }>) {
  const invite = parseInviteCode(message.payload.inviteCode);
  const coops = await getCoops();
  const existingCoop = coops.find((item) => item.profile.id === invite.bootstrap.coopId);
  if (existingCoop && !verifyInviteCodeProof(invite, existingCoop.syncRoom.inviteSigningSecret)) {
    return { ok: false, error: 'Invite verification failed.' } satisfies RuntimeActionResponse;
  }
  const coop = existingCoop ?? createStateFromInviteBootstrap(invite);

  const joined = joinCoop({
    state: coop,
    invite,
    displayName: message.payload.displayName,
    seedContribution: message.payload.seedContribution,
    member: message.payload.member,
  });
  await saveState(joined.state);
  await setLocalSetting(stateKeys.activeCoopId, joined.state.profile.id);
  // Initialize privacy identity for the new member
  try {
    const newMember = joined.state.members.find(
      (m) => m.displayName === message.payload.displayName,
    );
    if (newMember) {
      const privacyRecord = await initializeMemberPrivacy(db, {
        coopId: joined.state.profile.id,
        memberId: newMember.id,
      });
      const currentCommitments = joined.state.memberCommitments ?? [];
      if (!currentCommitments.includes(privacyRecord.commitment)) {
        await saveState({
          ...joined.state,
          memberCommitments: [...currentCommitments, privacyRecord.commitment],
        });
      }
    }
  } catch (privacyError) {
    console.warn('[coop:privacy] Failed to initialize member privacy:', privacyError);
  }
  await refreshBadge();
  return {
    ok: true,
    data: joined.state,
  } satisfies RuntimeActionResponse;
}
