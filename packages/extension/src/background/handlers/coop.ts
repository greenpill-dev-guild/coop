import {
  type AnchorCapability,
  type CoopSharedState,
  computeThresholdForOwnerCount,
  createAnchorCapability,
  createCoop,
  createLocalMemberSignerBinding,
  createMockOnchainState,
  createStateFromInviteBootstrap,
  createUnavailableOnchainState,
  deployCoopSafe,
  describeOnchainModeSummary,
  getAuthSession,
  initializeCoopPrivacy,
  initializeMemberPrivacy,
  joinCoop,
  leaveCoop,
  markAccountPredicted,
  nowIso,
  parseInviteCode,
  predictMemberAccountAddress,
  saveLocalMemberSignerBinding,
  setAnchorCapability,
  updateCoopDetails,
  verifyInviteCodeProof,
} from '@coop/shared';
import type { RuntimeActionResponse, RuntimeRequest } from '../../runtime/messages';
import { requireAnchorModeForFeature } from '../../runtime/operator';
import {
  configuredChain,
  configuredOnchainMode,
  db,
  getCoops,
  notifyExtensionEvent,
  saveState,
  setLocalSetting,
  stateKeys,
} from '../context';
import { refreshBadge } from '../dashboard';
import { getOperatorState, logPrivilegedAction } from '../operator';
import { emitAgentObservationIfMissing, ensureOnboardingBurst, requestAgentCycle } from './agent';

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

  const pimlicoApiKey = import.meta.env.VITE_PIMLICO_API_KEY ?? process.env.VITE_PIMLICO_API_KEY;
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
  if (!operator.liveOnchain.available) {
    const liveSummary = describeOnchainModeSummary({
      mode: 'live',
      chainKey: configuredChain,
    });
    const statusNote = operator.anchorStatus.enabled
      ? `${liveSummary} is pending until this member re-enables anchor mode on this node.`
      : `${liveSummary} is pending until anchor mode is enabled on this node.`;
    await logPrivilegedAction({
      actionType: 'safe-deployment',
      status: 'failed',
      detail: operator.liveOnchain.detail,
      coop: operator.activeCoop,
      memberId: operator.activeMember?.id,
      memberDisplayName: operator.activeMember?.displayName,
      authSession,
    });
    return {
      ok: true,
      data: createUnavailableOnchainState({
        safeAddressSeed: message.payload.coopSeed,
        senderAddress: authSession.primaryAddress,
        chainKey: configuredChain,
        statusNote,
      }),
    } satisfies RuntimeActionResponse;
  }

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
  const authSession = await getAuthSession(db);
  if (!authSession?.passkey) {
    return {
      ok: false,
      error: 'A passkey session is required before creating a coop.',
    } satisfies RuntimeActionResponse;
  }

  const existingCoops = await getCoops();
  const created = createCoop(message.payload);
  let latestState = created.state;

  await saveState(latestState);
  await setLocalSetting(stateKeys.activeCoopId, latestState.profile.id);
  await setLocalSetting(stateKeys.captureMode, latestState.profile.captureMode);
  if (latestState.greenGoods?.enabled) {
    await emitAgentObservationIfMissing({
      trigger: 'green-goods-garden-requested',
      title: `Green Goods garden requested for ${latestState.profile.name}`,
      summary: `Create a Green Goods garden owned by ${latestState.profile.name}'s coop Safe.`,
      coopId: latestState.profile.id,
      payload: {
        status: latestState.greenGoods.status,
        requestedAt: latestState.greenGoods.requestedAt,
        weightScheme: latestState.greenGoods.weightScheme,
        domainMask: latestState.greenGoods.domainMask,
      },
    });
    await requestAgentCycle(`green-goods-create:${latestState.profile.id}`, true);
  }

  // Predict creator's member account address
  try {
    const creatorMember = latestState.members[0];
    const creatorAccount = latestState.memberAccounts.find(
      (a) => a.memberId === creatorMember?.id && a.status === 'pending',
    );
    if (creatorMember && creatorAccount) {
      const predictedAddress = await predictMemberAccountAddress({
        authSession,
        coopId: latestState.profile.id,
        memberId: creatorMember.id,
        chainKey: latestState.onchainState.chainKey,
        accountType: creatorAccount.accountType,
      });
      const updatedAccount = markAccountPredicted(creatorAccount, predictedAddress);
      latestState = {
        ...latestState,
        memberAccounts: latestState.memberAccounts.map((a) =>
          a.memberId === creatorMember.id ? updatedAccount : a,
        ),
      };
      await saveLocalMemberSignerBinding(
        db,
        createLocalMemberSignerBinding({
          coopId: latestState.profile.id,
          memberId: creatorMember.id,
          accountAddress: predictedAddress,
          accountType: creatorAccount.accountType,
          passkeyCredentialId: authSession.passkey.id,
        }),
      );
    }
  } catch (accountError) {
    console.warn('[coop:member-account] Failed to predict creator account:', accountError);
  }

  // Initialize privacy primitives for the new coop
  try {
    const creatorMemberId = latestState.members[0]?.id;
    if (creatorMemberId) {
      const privacyResult = await initializeCoopPrivacy(db, {
        coopId: latestState.profile.id,
        memberId: creatorMemberId,
      });
      // Add the creator's commitment to shared state for peer sync
      latestState = {
        ...latestState,
        memberCommitments: [privacyResult.identity.commitment],
      };
    }
  } catch (privacyError) {
    console.warn('[coop:privacy] Failed to initialize coop privacy:', privacyError);
  }

  // Persist final state with all post-create mutations (prediction, privacy)
  await saveState(latestState);

  try {
    const creatorMemberId = latestState.members[0]?.id;
    if (creatorMemberId) {
      await ensureOnboardingBurst({
        coopId: latestState.profile.id,
        memberId: creatorMemberId,
        reason: existingCoops.length === 0 ? 'coop-create-first' : 'coop-create',
      });
    }
  } catch (onboardingError) {
    console.warn(
      '[coop:onboarding] Failed to schedule onboarding proactive cycle:',
      onboardingError,
    );
  }
  await refreshBadge();
  return {
    ok: true,
    data: latestState,
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

  const authSession = await getAuthSession(db);
  if (!authSession?.passkey) {
    return {
      ok: false,
      error: 'A passkey session is required before joining a coop.',
    } satisfies RuntimeActionResponse;
  }

  const coop = existingCoop ?? createStateFromInviteBootstrap(invite);

  const joined = joinCoop({
    state: coop,
    invite,
    displayName: message.payload.displayName,
    seedContribution: message.payload.seedContribution,
    member: message.payload.member,
  });
  let latestState = joined.state;
  const joinedMember = joined.member;
  await setLocalSetting(stateKeys.activeCoopId, latestState.profile.id);

  // Initialize privacy identity for the new member
  try {
    const privacyRecord = await initializeMemberPrivacy(db, {
      coopId: latestState.profile.id,
      memberId: joinedMember.id,
    });
    const currentCommitments = latestState.memberCommitments ?? [];
    if (!currentCommitments.includes(privacyRecord.commitment)) {
      latestState = {
        ...latestState,
        memberCommitments: [...currentCommitments, privacyRecord.commitment],
      };
    }
  } catch (privacyError) {
    console.warn('[coop:privacy] Failed to initialize member privacy:', privacyError);
  }

  // Auto-predict Kernel account address for the joining member
  try {
    const memberAccount = latestState.memberAccounts.find((a) => a.memberId === joinedMember.id);
    if (memberAccount && memberAccount.status === 'pending') {
      const predictedAddress = await predictMemberAccountAddress({
        authSession,
        coopId: latestState.profile.id,
        memberId: joinedMember.id,
        chainKey: latestState.onchainState.chainKey,
        accountType: memberAccount.accountType,
      });
      const updatedAccount = markAccountPredicted(memberAccount, predictedAddress);
      latestState = {
        ...latestState,
        memberAccounts: latestState.memberAccounts.map((a) =>
          a.memberId === joinedMember.id ? updatedAccount : a,
        ),
      };
      await saveLocalMemberSignerBinding(
        db,
        createLocalMemberSignerBinding({
          coopId: latestState.profile.id,
          memberId: joinedMember.id,
          accountAddress: predictedAddress,
          accountType: memberAccount.accountType,
          passkeyCredentialId: authSession.passkey.id,
        }),
      );

      // If trusted member, queue safe-add-owner action
      if (joinedMember.role === 'trusted') {
        const currentOwners = latestState.onchainState.safeOwners ?? [];
        const newThreshold = computeThresholdForOwnerCount(currentOwners.length + 1);
        await emitAgentObservationIfMissing({
          trigger: 'safe-add-owner-requested',
          title: `Trusted member ${joinedMember.displayName} needs Safe co-signer access`,
          summary: `Add Kernel account ${predictedAddress} as Safe owner with threshold ${newThreshold}.`,
          coopId: latestState.profile.id,
          payload: {
            memberId: joinedMember.id,
            ownerAddress: predictedAddress,
            newThreshold,
            memberRole: joinedMember.role,
          },
        });
      }
    }
  } catch (accountError) {
    console.warn('[coop:member-account] Failed to auto-predict member account:', accountError);
  }

  // Single consolidated save for all post-join state mutations
  await saveState(latestState);

  try {
    await ensureOnboardingBurst({
      coopId: latestState.profile.id,
      memberId: joinedMember.id,
      reason: 'coop-join',
    });
  } catch (onboardingError) {
    console.warn('[coop:onboarding] Failed to schedule join proactive cycle:', onboardingError);
  }
  await refreshBadge();
  return {
    ok: true,
    data: latestState,
  } satisfies RuntimeActionResponse;
}

export async function handleUpdateCoopDetails(
  message: Extract<RuntimeRequest, { type: 'update-coop-details' }>,
) {
  const coops = await getCoops();
  const coop = coops.find((c) => c.profile.id === message.payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }

  try {
    const nextState = updateCoopDetails({
      state: coop,
      profile: message.payload.profile,
      soul: message.payload.soul,
      setupInsights: message.payload.setupInsights,
    });
    await saveState(nextState);
    if (message.payload.profile?.captureMode !== undefined) {
      await setLocalSetting(stateKeys.captureMode, message.payload.profile.captureMode);
    }
    await refreshBadge();
    return { ok: true, data: nextState } satisfies RuntimeActionResponse<CoopSharedState>;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not update coop details.',
    } satisfies RuntimeActionResponse;
  }
}

export async function handleLeaveCoop(message: Extract<RuntimeRequest, { type: 'leave-coop' }>) {
  const coops = await getCoops();
  const coop = coops.find((c) => c.profile.id === message.payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }
  try {
    const result = leaveCoop({ state: coop, memberId: message.payload.memberId });
    await saveState(result.state);
    if (!result.state.profile.active) {
      const remaining = coops.filter((c) => c.profile.id !== message.payload.coopId);
      await setLocalSetting(stateKeys.activeCoopId, remaining[0]?.profile.id ?? '');
    }
    await refreshBadge();
    return { ok: true, data: result.state } satisfies RuntimeActionResponse<CoopSharedState>;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Leave coop failed.',
    } satisfies RuntimeActionResponse;
  }
}
