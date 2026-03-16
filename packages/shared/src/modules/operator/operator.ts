import type {
  AnchorCapability,
  AuthSession,
  PrivilegedActionContext,
  PrivilegedActionLogEntry,
  PrivilegedActionStatus,
  PrivilegedActionType,
} from '../../contracts/schema';
import { anchorCapabilitySchema, privilegedActionLogEntrySchema } from '../../contracts/schema';
import { createId, nowIso } from '../../utils';

export interface AnchorCapabilityStatus {
  enabled: boolean;
  active: boolean;
  detail: string;
}

export function createAnchorCapability(input: {
  enabled: boolean;
  authSession?: Pick<AuthSession, 'displayName' | 'primaryAddress'> | null;
  memberId?: string;
  memberDisplayName?: string;
  updatedAt?: string;
  nodeId?: string;
}): AnchorCapability {
  return anchorCapabilitySchema.parse({
    enabled: input.enabled,
    nodeId: input.nodeId ?? 'coop-extension',
    updatedAt: input.updatedAt ?? nowIso(),
    actorAddress: input.authSession?.primaryAddress,
    actorDisplayName: input.authSession?.displayName,
    memberId: input.memberId,
    memberDisplayName: input.memberDisplayName,
  });
}

export function isAnchorCapabilityActive(
  capability: AnchorCapability | null | undefined,
  authSession?: Pick<AuthSession, 'primaryAddress'> | null,
) {
  if (!capability?.enabled || !capability.actorAddress) {
    return false;
  }

  return capability.actorAddress?.toLowerCase() === authSession?.primaryAddress?.toLowerCase();
}

export function describeAnchorCapabilityStatus(input: {
  capability: AnchorCapability | null | undefined;
  authSession?: Pick<AuthSession, 'primaryAddress'> | null;
}): AnchorCapabilityStatus {
  if (!input.capability?.enabled) {
    return {
      enabled: false,
      active: false,
      detail:
        'Anchor mode is off. Live archive, Safe actions, and archive follow-up stay disabled.',
    };
  }

  if (isAnchorCapabilityActive(input.capability, input.authSession)) {
    return {
      enabled: true,
      active: true,
      detail: 'Anchor mode is active for this authenticated member context.',
    };
  }

  return {
    enabled: true,
    active: false,
    detail:
      'Anchor mode was enabled for a different member session. Live features stay unavailable until this member re-enables anchor mode.',
  };
}

export function createPrivilegedActionLogEntry(input: {
  actionType: PrivilegedActionType;
  status: PrivilegedActionStatus;
  detail: string;
  createdAt?: string;
  context?: Partial<PrivilegedActionContext>;
}): PrivilegedActionLogEntry {
  return privilegedActionLogEntrySchema.parse({
    id: createId('action'),
    actionType: input.actionType,
    status: input.status,
    detail: input.detail,
    createdAt: input.createdAt ?? nowIso(),
    context: input.context ?? {},
  });
}

export function appendPrivilegedActionLog(
  entries: PrivilegedActionLogEntry[],
  entry: PrivilegedActionLogEntry,
  limit = 50,
) {
  return [...entries, entry]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}
