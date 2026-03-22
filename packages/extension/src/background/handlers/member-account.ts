import {
  createGreenGoodsImpactReportOutput,
  createGreenGoodsWorkSubmissionOutput,
  createLocalMemberSignerBinding,
  createMemberAccountRecord,
  getAuthSession,
  getLocalMemberSignerBinding,
  markAccountActive,
  markAccountPredicted,
  nowIso,
  predictMemberAccountAddress,
  saveLocalMemberSignerBinding,
  sendTransactionViaMemberAccount,
  submitGreenGoodsImpactReport,
  submitGreenGoodsWorkSubmission,
  syncGreenGoodsMemberBindings,
} from '@coop/shared';
import type { Address } from 'viem';
import type { RuntimeActionResponse, RuntimeRequest } from '../../runtime/messages';
import {
  configuredGreenGoodsImpactReportSchemaUid,
  configuredGreenGoodsWorkSchemaUid,
  configuredOnchainMode,
  configuredPimlicoApiKey,
  db,
  getCoops,
  saveState,
} from '../context';
import { findAuthenticatedCoopMember } from '../operator';

async function requireAuthenticatedMemberContext(input: { coopId: string; memberId: string }) {
  const authSession = await getAuthSession(db);
  if (!authSession?.passkey) {
    return {
      ok: false as const,
      error: 'A stored passkey session is required for member on-chain actions.',
    };
  }

  const coops = await getCoops();
  const coop = coops.find((candidate) => candidate.profile.id === input.coopId);
  if (!coop) {
    return {
      ok: false as const,
      error: 'Coop not found.',
    };
  }

  const authenticatedMember = findAuthenticatedCoopMember(coop, authSession);
  if (!authenticatedMember || authenticatedMember.id !== input.memberId) {
    return {
      ok: false as const,
      error: 'Only the authenticated member can perform this member-scoped on-chain action.',
    };
  }

  return {
    ok: true as const,
    authSession,
    coop,
    authenticatedMember,
  };
}

function resolveMemberAccountForLocalBinding(input: {
  coop: Extract<
    Awaited<ReturnType<typeof requireAuthenticatedMemberContext>>,
    { ok: true }
  >['coop'];
  authenticatedMember: Extract<
    Awaited<ReturnType<typeof requireAuthenticatedMemberContext>>,
    { ok: true }
  >['authenticatedMember'];
  authSession: Extract<
    Awaited<ReturnType<typeof requireAuthenticatedMemberContext>>,
    { ok: true }
  >['authSession'];
  localBinding: NonNullable<Awaited<ReturnType<typeof getLocalMemberSignerBinding>>>;
}) {
  const existingAccount = input.coop.memberAccounts.find(
    (account) => account.memberId === input.authenticatedMember.id,
  );
  const baseAccount =
    existingAccount ??
    createMemberAccountRecord({
      memberId: input.authenticatedMember.id,
      coopId: input.coop.profile.id,
      ownerPasskeyCredentialId: input.authSession.passkey.id,
      chainKey: input.coop.onchainState.chainKey,
      accountType: input.localBinding.accountType,
    });

  return baseAccount.accountAddress?.toLowerCase() ===
    input.localBinding.accountAddress.toLowerCase() &&
    (baseAccount.status === 'predicted' || baseAccount.status === 'active')
    ? baseAccount
    : markAccountPredicted(baseAccount, input.localBinding.accountAddress as Address);
}

async function requireLocalMemberGreenGoodsContext(
  input: { coopId: string; memberId: string },
  actionLabel: 'impact' | 'work submission',
) {
  const resolution = await requireAuthenticatedMemberContext(input);
  if (!resolution.ok) {
    return resolution;
  }

  const { authSession, coop, authenticatedMember } = resolution;
  if (!coop.greenGoods?.enabled || !coop.greenGoods.gardenAddress) {
    return {
      ok: false as const,
      error: 'Green Goods is not linked for this coop yet.',
    };
  }

  const localBinding = await getLocalMemberSignerBinding(
    db,
    coop.profile.id,
    authenticatedMember.id,
  );
  if (!localBinding?.accountAddress) {
    return {
      ok: false as const,
      error: `Provision your member on-chain account on this browser before submitting ${actionLabel}.`,
    };
  }
  if (localBinding.passkeyCredentialId !== authSession.passkey.id) {
    return {
      ok: false as const,
      error: 'The stored signer binding belongs to a different passkey credential.',
    };
  }

  return {
    ok: true as const,
    authSession,
    coop,
    authenticatedMember,
    localBinding,
    memberAccount: resolveMemberAccountForLocalBinding({
      coop,
      authenticatedMember,
      authSession,
      localBinding,
    }),
  };
}

function createMemberGreenGoodsLiveExecutor(input: {
  authSession: Extract<
    Awaited<ReturnType<typeof requireAuthenticatedMemberContext>>,
    { ok: true }
  >['authSession'];
  coop: Extract<
    Awaited<ReturnType<typeof requireAuthenticatedMemberContext>>,
    { ok: true }
  >['coop'];
  localBinding: NonNullable<Awaited<ReturnType<typeof getLocalMemberSignerBinding>>>;
}) {
  if (configuredOnchainMode !== 'live') {
    return undefined;
  }

  return async ({ to, data, value }: { to: Address; data: `0x${string}`; value?: bigint }) => {
    const execution = await sendTransactionViaMemberAccount({
      authSession: input.authSession,
      pimlicoApiKey: configuredPimlicoApiKey ?? '',
      chainKey: input.coop.onchainState.chainKey,
      accountAddress: input.localBinding.accountAddress as Address,
      accountType: input.localBinding.accountType,
      to,
      data,
      value,
    });
    return {
      txHash: execution.txHash,
      receipt: execution.receipt,
      safeAddress: execution.accountAddress as Address,
    };
  };
}

function buildSuccessfulMemberGreenGoodsState(input: {
  coop: Extract<
    Awaited<ReturnType<typeof requireAuthenticatedMemberContext>>,
    { ok: true }
  >['coop'];
  authenticatedMember: Extract<
    Awaited<ReturnType<typeof requireAuthenticatedMemberContext>>,
    { ok: true }
  >['authenticatedMember'];
  authSession: Extract<
    Awaited<ReturnType<typeof requireAuthenticatedMemberContext>>,
    { ok: true }
  >['authSession'];
  localBinding: NonNullable<Awaited<ReturnType<typeof getLocalMemberSignerBinding>>>;
  memberAccount: ReturnType<typeof resolveMemberAccountForLocalBinding>;
  txHash: `0x${string}`;
  detail: string;
  activityField: 'lastImpactReportAt' | 'lastWorkSubmissionAt';
}) {
  const activityAt = nowIso();
  const nextAccount =
    configuredOnchainMode === 'live'
      ? markAccountActive(
          {
            ...input.memberAccount,
            ownerPasskeyCredentialId: input.authSession.passkey.id,
          },
          input.txHash,
          input.localBinding.accountAddress as Address,
        )
      : input.memberAccount;
  const memberAccounts = [
    ...input.coop.memberAccounts.filter(
      (account) => account.memberId !== input.authenticatedMember.id,
    ),
    nextAccount,
  ];
  const nextState = {
    ...input.coop,
    memberAccounts,
    greenGoods: {
      ...input.coop.greenGoods,
      memberBindings: syncGreenGoodsMemberBindings({
        current: input.coop.greenGoods,
        members: input.coop.members,
        memberAccounts,
      }),
      [input.activityField]: activityAt,
      lastTxHash: input.txHash,
      statusNote: input.detail,
      lastError: undefined,
    },
  };

  return {
    activityAt,
    nextAccount,
    nextState,
  };
}

async function persistLocalMemberBindingUse(
  localBinding: NonNullable<Awaited<ReturnType<typeof getLocalMemberSignerBinding>>>,
  input: { usedAt: string; lastError?: string },
) {
  await saveLocalMemberSignerBinding(db, {
    ...localBinding,
    lastUsedAt: input.usedAt,
    lastError: input.lastError,
  });
}

export async function handleProvisionMemberOnchainAccount(
  message: Extract<RuntimeRequest, { type: 'provision-member-onchain-account' }>,
) {
  const resolution = await requireAuthenticatedMemberContext(message.payload);
  if (!resolution.ok) {
    return {
      ok: false,
      error: resolution.error,
    } satisfies RuntimeActionResponse;
  }

  const { authSession, coop, authenticatedMember } = resolution;
  const existingAccount = coop.memberAccounts.find(
    (account) => account.memberId === message.payload.memberId,
  );
  const baseAccount =
    existingAccount ??
    createMemberAccountRecord({
      memberId: authenticatedMember.id,
      coopId: coop.profile.id,
      ownerPasskeyCredentialId: authSession.passkey.id,
      chainKey: coop.onchainState.chainKey,
    });

  const predictedAddress = await predictMemberAccountAddress({
    authSession,
    coopId: coop.profile.id,
    memberId: authenticatedMember.id,
    chainKey: coop.onchainState.chainKey,
    accountType: baseAccount.accountType,
  });
  const nextAccount = markAccountPredicted(
    {
      ...baseAccount,
      ownerPasskeyCredentialId: authSession.passkey.id,
    },
    predictedAddress,
  );

  await saveLocalMemberSignerBinding(
    db,
    createLocalMemberSignerBinding({
      coopId: coop.profile.id,
      memberId: authenticatedMember.id,
      accountAddress: predictedAddress,
      accountType: nextAccount.accountType,
      passkeyCredentialId: authSession.passkey.id,
    }),
  );

  const memberAccounts = [
    ...coop.memberAccounts.filter((account) => account.memberId !== authenticatedMember.id),
    nextAccount,
  ];
  const nextState = {
    ...coop,
    memberAccounts,
    greenGoods: coop.greenGoods
      ? {
          ...coop.greenGoods,
          memberBindings: syncGreenGoodsMemberBindings({
            current: coop.greenGoods,
            members: coop.members,
            memberAccounts,
          }),
        }
      : coop.greenGoods,
  };

  await saveState(nextState);

  return {
    ok: true,
    data: nextAccount,
  } satisfies RuntimeActionResponse;
}

export async function handleSubmitGreenGoodsImpactReport(
  message: Extract<RuntimeRequest, { type: 'submit-green-goods-impact-report' }>,
) {
  const resolution = await requireLocalMemberGreenGoodsContext(message.payload, 'impact');
  if (!resolution.ok) {
    return {
      ok: false,
      error: resolution.error,
    } satisfies RuntimeActionResponse;
  }

  const { authSession, coop, authenticatedMember, localBinding, memberAccount } = resolution;
  const output = createGreenGoodsImpactReportOutput({
    gardenAddress: coop.greenGoods.gardenAddress as Address,
    title: message.payload.report.title,
    description: message.payload.report.description,
    domain: message.payload.report.domain,
    reportCid: message.payload.report.reportCid,
    metricsSummary: message.payload.report.metricsSummary,
    reportingPeriodStart: message.payload.report.reportingPeriodStart,
    reportingPeriodEnd: message.payload.report.reportingPeriodEnd,
    submittedBy: localBinding.accountAddress as Address,
  });

  try {
    const result = await submitGreenGoodsImpactReport({
      mode: configuredOnchainMode,
      authSession,
      pimlicoApiKey: configuredPimlicoApiKey,
      onchainState: coop.onchainState,
      gardenAddress: coop.greenGoods.gardenAddress as Address,
      output,
      schemaUid: configuredGreenGoodsImpactReportSchemaUid,
      liveExecutor: createMemberGreenGoodsLiveExecutor({
        authSession,
        coop,
        localBinding,
      }),
    });

    const { activityAt, nextAccount, nextState } = buildSuccessfulMemberGreenGoodsState({
      coop,
      authenticatedMember,
      authSession,
      localBinding,
      memberAccount,
      txHash: result.txHash,
      detail: result.detail,
      activityField: 'lastImpactReportAt',
    });

    await persistLocalMemberBindingUse(localBinding, {
      usedAt: activityAt,
      lastError: undefined,
    });
    await saveState(nextState);

    return {
      ok: true,
      data: {
        txHash: result.txHash,
        account: nextAccount,
        greenGoods: nextState.greenGoods,
      },
    } satisfies RuntimeActionResponse;
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : 'Green Goods impact report submission failed.';
    await persistLocalMemberBindingUse(localBinding, {
      usedAt: nowIso(),
      lastError: messageText,
    });
    return {
      ok: false,
      error: messageText,
    } satisfies RuntimeActionResponse;
  }
}

export async function handleSubmitGreenGoodsWorkSubmission(
  message: Extract<RuntimeRequest, { type: 'submit-green-goods-work-submission' }>,
) {
  const resolution = await requireLocalMemberGreenGoodsContext(message.payload, 'work submission');
  if (!resolution.ok) {
    return {
      ok: false,
      error: resolution.error,
    } satisfies RuntimeActionResponse;
  }

  const { authSession, coop, authenticatedMember, localBinding, memberAccount } = resolution;
  const output = createGreenGoodsWorkSubmissionOutput({
    gardenAddress: coop.greenGoods.gardenAddress as Address,
    actionUid: message.payload.submission.actionUid,
    title: message.payload.submission.title,
    feedback: message.payload.submission.feedback,
    metadataCid: message.payload.submission.metadataCid,
    mediaCids: message.payload.submission.mediaCids,
  });

  try {
    const result = await submitGreenGoodsWorkSubmission({
      mode: configuredOnchainMode,
      authSession,
      pimlicoApiKey: configuredPimlicoApiKey,
      onchainState: coop.onchainState,
      gardenAddress: coop.greenGoods.gardenAddress as Address,
      output,
      schemaUid: configuredGreenGoodsWorkSchemaUid,
      liveExecutor: createMemberGreenGoodsLiveExecutor({
        authSession,
        coop,
        localBinding,
      }),
    });

    const { activityAt, nextAccount, nextState } = buildSuccessfulMemberGreenGoodsState({
      coop,
      authenticatedMember,
      authSession,
      localBinding,
      memberAccount,
      txHash: result.txHash,
      detail: result.detail,
      activityField: 'lastWorkSubmissionAt',
    });

    await persistLocalMemberBindingUse(localBinding, {
      usedAt: activityAt,
      lastError: undefined,
    });
    await saveState(nextState);

    return {
      ok: true,
      data: {
        txHash: result.txHash,
        account: nextAccount,
        greenGoods: nextState.greenGoods,
      },
    } satisfies RuntimeActionResponse;
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : 'Green Goods work submission failed.';
    await persistLocalMemberBindingUse(localBinding, {
      usedAt: nowIso(),
      lastError: messageText,
    });
    return {
      ok: false,
      error: messageText,
    } satisfies RuntimeActionResponse;
  }
}
