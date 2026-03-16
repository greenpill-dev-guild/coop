import {
  type CoopSharedState,
  type PrivilegedActionLogEntry,
  appendPrivilegedActionLog,
  createPrivilegedActionLogEntry,
  describeAnchorCapabilityStatus,
  getAnchorCapability,
  getAuthSession,
  listPrivilegedActionLog,
  setPrivilegedActionLog,
} from '@coop/shared';
import { isTrustedNodeRole } from '../runtime/agent-harness';
import { describePrivilegedFeatureAvailability } from '../runtime/operator';
import { resolveActiveReviewContext, resolveReceiverPairingMember } from '../runtime/receiver';
import {
  configuredArchiveMode,
  configuredOnchainMode,
  db,
  getCoops,
  getLocalSetting,
  getResolvedTrustedNodeArchiveConfig,
  stateKeys,
  trustedNodeArchiveBootstrap,
} from './context';

export async function getActiveReviewContextForSession(
  coops: CoopSharedState[],
  authSession: Awaited<ReturnType<typeof getAuthSession>>,
) {
  const requestedActiveCoopId = await getLocalSetting<string | undefined>(
    stateKeys.activeCoopId,
    undefined,
  );
  return resolveActiveReviewContext(coops, authSession, requestedActiveCoopId);
}

export async function getOperatorState(input?: {
  coops?: CoopSharedState[];
  authSession?: Awaited<ReturnType<typeof getAuthSession>>;
}) {
  const coops = input?.coops ?? (await getCoops());
  const authSession = input?.authSession ?? (await getAuthSession(db));
  const [anchorCapability, actionLog, trustedNodeArchiveConfig] = await Promise.all([
    getAnchorCapability(db),
    listPrivilegedActionLog(db),
    getResolvedTrustedNodeArchiveConfig(),
  ]);
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  const activeCoop = coops.find((coop) => coop.profile.id === activeContext.activeCoopId);
  const activeMember = resolveReceiverPairingMember(activeCoop, authSession);
  const anchorStatus = describeAnchorCapabilityStatus({
    capability: anchorCapability,
    authSession,
  });
  const liveArchive = describePrivilegedFeatureAvailability({
    mode: configuredArchiveMode,
    capability: anchorCapability,
    authSession,
    liveLabel: 'archive uploads',
  });
  const liveArchiveWithConfig =
    configuredArchiveMode === 'live' && liveArchive.available && !trustedNodeArchiveConfig
      ? {
          available: false,
          detail: trustedNodeArchiveBootstrap.error
            ? `Live archive uploads are blocked by invalid trusted-node archive bootstrap config: ${trustedNodeArchiveBootstrap.error}`
            : 'Live archive uploads are unavailable until this anchor node is provisioned with trusted-node archive delegation config.',
        }
      : liveArchive;
  const liveOnchain = describePrivilegedFeatureAvailability({
    mode: configuredOnchainMode,
    capability: anchorCapability,
    authSession,
    liveLabel: 'Safe deployments',
  });

  return {
    anchorCapability,
    actionLog,
    authSession,
    activeCoop,
    activeContext,
    activeMember,
    anchorStatus,
    liveArchive: liveArchiveWithConfig,
    liveOnchain,
  };
}

export async function appendOperatorActionLog(entry: PrivilegedActionLogEntry) {
  const current = await listPrivilegedActionLog(db);
  const next = appendPrivilegedActionLog(current, entry);
  await setPrivilegedActionLog(db, next);
  return next;
}

export async function logPrivilegedAction(input: {
  actionType: PrivilegedActionLogEntry['actionType'];
  status: PrivilegedActionLogEntry['status'];
  detail: string;
  coop?: CoopSharedState;
  memberId?: string;
  memberDisplayName?: string;
  authSession?: Awaited<ReturnType<typeof getAuthSession>>;
  artifactId?: string;
  receiptId?: string;
  archiveScope?: PrivilegedActionLogEntry['context']['archiveScope'];
}) {
  const authSession = input.authSession ?? (await getAuthSession(db));
  const entry = createPrivilegedActionLogEntry({
    actionType: input.actionType,
    status: input.status,
    detail: input.detail,
    context: {
      coopId: input.coop?.profile.id,
      coopName: input.coop?.profile.name,
      memberId: input.memberId,
      memberDisplayName: input.memberDisplayName,
      actorAddress: authSession?.primaryAddress,
      chainKey: input.coop?.onchainState.chainKey,
      artifactId: input.artifactId,
      receiptId: input.receiptId,
      archiveScope: input.archiveScope,
      mode:
        input.actionType === 'safe-deployment' ||
        input.actionType === 'green-goods-transaction' ||
        input.actionType === 'archive-anchor'
          ? configuredOnchainMode
          : input.actionType === 'anchor-mode-toggle'
            ? undefined
            : configuredArchiveMode,
    },
  });
  await appendOperatorActionLog(entry);
  return entry;
}

export function findAuthenticatedCoopMember(
  coop: CoopSharedState,
  authSession: Awaited<ReturnType<typeof getAuthSession>>,
) {
  const authAddress = authSession?.primaryAddress?.toLowerCase();
  if (!authAddress) {
    return undefined;
  }

  return coop.members.find((member) => member.address.toLowerCase() === authAddress);
}

export async function requireCreatorGrantManager(
  coopId: string,
  authSession: Awaited<ReturnType<typeof getAuthSession>>,
  errorMessage: string,
) {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === coopId);
  if (!coop) {
    return { ok: false as const, error: 'Coop not found.' };
  }

  const member = findAuthenticatedCoopMember(coop, authSession);
  if (!member || member.role !== 'creator') {
    return { ok: false as const, error: errorMessage };
  }

  return {
    ok: true as const,
    coop,
    member,
  };
}

export async function getTrustedNodeContext(input?: {
  coopId?: string;
  requestedMemberId?: string;
}) {
  const authSession = await getAuthSession(db);
  if (!authSession) {
    return {
      ok: false as const,
      error: 'A passkey session is required for trusted-node controls.',
    };
  }

  const coops = await getCoops();
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  const coop =
    (input?.coopId
      ? coops.find((candidate) => candidate.profile.id === input.coopId)
      : activeContext.activeCoop) ?? null;
  if (!coop) {
    return {
      ok: false as const,
      error: 'Select a coop before using trusted-node controls.',
    };
  }

  const member = resolveReceiverPairingMember(coop, authSession, input?.requestedMemberId);
  if (!member || !isTrustedNodeRole(member.role)) {
    return {
      ok: false as const,
      error: 'Trusted-node controls are limited to creator or trusted members.',
    };
  }

  return {
    ok: true as const,
    authSession,
    coops,
    coop,
    member,
    activeContext,
  };
}
