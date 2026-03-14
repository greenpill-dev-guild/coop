import type { ActionBundle, ActionLogEntry, ActionLogEventType } from '../../contracts/schema';
import { actionLogEntrySchema } from '../../contracts/schema';
import { createId, nowIso } from '../../utils';

const ACTION_LOG_LIMIT = 100;

export function createActionLogEntry(input: {
  bundle: ActionBundle;
  eventType: ActionLogEventType;
  detail: string;
  createdAt?: string;
}): ActionLogEntry {
  return actionLogEntrySchema.parse({
    id: createId('alog'),
    bundleId: input.bundle.id,
    eventType: input.eventType,
    actionClass: input.bundle.actionClass,
    detail: input.detail,
    createdAt: input.createdAt ?? nowIso(),
    coopId: input.bundle.coopId,
    memberId: input.bundle.memberId,
  });
}

export function appendActionLog(
  entries: ActionLogEntry[],
  entry: ActionLogEntry,
  limit = ACTION_LOG_LIMIT,
): ActionLogEntry[] {
  return [entry, ...entries]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

export function formatActionLogEventLabel(eventType: ActionLogEventType): string {
  switch (eventType) {
    case 'proposal-created':
      return 'Proposed';
    case 'proposal-approved':
      return 'Approved';
    case 'proposal-rejected':
      return 'Rejected';
    case 'execution-started':
      return 'Executing';
    case 'execution-succeeded':
      return 'Executed';
    case 'execution-failed':
      return 'Failed';
    case 'replay-rejected':
      return 'Replay rejected';
    case 'expiry-rejected':
      return 'Expired';
  }
}

export function formatActionClassLabel(actionClass: ActionBundle['actionClass']): string {
  switch (actionClass) {
    case 'archive-artifact':
      return 'Archive artifact';
    case 'archive-snapshot':
      return 'Archive snapshot';
    case 'refresh-archive-status':
      return 'Refresh archive status';
    case 'publish-ready-draft':
      return 'Publish ready draft';
    case 'safe-deployment':
      return 'Safe deployment';
    case 'green-goods-create-garden':
      return 'Green Goods create garden';
    case 'green-goods-sync-garden-profile':
      return 'Green Goods sync garden profile';
    case 'green-goods-set-garden-domains':
      return 'Green Goods set garden domains';
    case 'green-goods-create-garden-pools':
      return 'Green Goods create garden pools';
    case 'green-goods-submit-work-approval':
      return 'Green Goods submit work approval';
    case 'green-goods-create-assessment':
      return 'Green Goods create assessment';
    case 'green-goods-sync-gap-admins':
      return 'Green Goods sync GAP admins';
    case 'erc8004-register-agent':
      return 'ERC-8004 register agent';
    case 'erc8004-give-feedback':
      return 'ERC-8004 give feedback';
  }
}
