import type {
  DelegatedActionClass,
  PermitLogEntry,
  PermitLogEventType,
} from '../../contracts/schema';
import { permitLogEntrySchema } from '../../contracts/schema';
import { createId, nowIso } from '../../utils';

const PERMIT_LOG_LIMIT = 100;

export function createPermitLogEntry(input: {
  permitId: string;
  eventType: PermitLogEventType;
  detail: string;
  actionClass?: DelegatedActionClass;
  coopId?: string;
  replayId?: string;
  createdAt?: string;
}): PermitLogEntry {
  return permitLogEntrySchema.parse({
    id: createId('plog'),
    permitId: input.permitId,
    eventType: input.eventType,
    actionClass: input.actionClass,
    detail: input.detail,
    createdAt: input.createdAt ?? nowIso(),
    coopId: input.coopId,
    replayId: input.replayId,
  });
}

export function appendPermitLog(
  entries: PermitLogEntry[],
  entry: PermitLogEntry,
  limit = PERMIT_LOG_LIMIT,
): PermitLogEntry[] {
  return [entry, ...entries]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

export function formatPermitLogEventLabel(eventType: PermitLogEventType): string {
  switch (eventType) {
    case 'permit-issued':
      return 'Issued';
    case 'permit-revoked':
      return 'Revoked';
    case 'permit-expired':
      return 'Expired';
    case 'delegated-execution-attempted':
      return 'Attempted';
    case 'delegated-execution-succeeded':
      return 'Succeeded';
    case 'delegated-execution-failed':
      return 'Failed';
    case 'delegated-replay-rejected':
      return 'Replay rejected';
    case 'delegated-exhausted-rejected':
      return 'Exhausted';
  }
}
