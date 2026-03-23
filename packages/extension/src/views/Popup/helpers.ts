import type { Artifact, ReviewDraft } from '@coop/shared';
import type { PopupSubheaderTag } from './PopupSubheader';
import type { PopupDraftListItem, PopupFeedArtifactItem, PopupScreen } from './popup-types';

export function formatRelativeTime(timestamp?: string) {
  if (!timestamp) {
    return 'Never';
  }

  const elapsed = Date.now() - new Date(timestamp).getTime();
  if (Number.isNaN(elapsed) || elapsed < 0) {
    return 'Just now';
  }

  const minutes = Math.round(elapsed / 60000);
  if (minutes < 1) {
    return 'Just now';
  }
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.round(hours / 24);
  return `${days}d`;
}

export function normalizeCoopIds(targetCoopIds: string[], coopLabels: Map<string, string>) {
  return Array.from(new Set(targetCoopIds.filter((coopId) => coopLabels.has(coopId))));
}

export function formatCoopLabel(targetCoopIds: string[], coopLabels: Map<string, string>) {
  const normalized = normalizeCoopIds(targetCoopIds, coopLabels);

  if (normalized.length === 0) {
    return 'Unassigned';
  }

  const labels = normalized
    .map((coopId) => coopLabels.get(coopId))
    .filter((value): value is string => Boolean(value));

  if (labels.length === 0) {
    return 'Unassigned';
  }

  if (labels.length === 1) {
    return labels[0];
  }

  return `${labels[0]} +${labels.length - 1}`;
}

export function toDraftItems(input: {
  drafts: ReviewDraft[];
  coops: Array<{ id: string; name: string }>;
}): PopupDraftListItem[] {
  const coopLabels = new Map(input.coops.map((coop) => [coop.id, coop.name]));

  return input.drafts.map((draft) => {
    const coopIds = normalizeCoopIds(draft.suggestedTargetCoopIds, coopLabels);

    return {
      ...draft,
      coopIds,
      coopLabel: formatCoopLabel(draft.suggestedTargetCoopIds, coopLabels),
    };
  });
}

export function toFeedItems(input: {
  artifacts: Artifact[];
  coops: Array<{ id: string; name: string }>;
}): PopupFeedArtifactItem[] {
  const coopLabels = new Map(input.coops.map((coop) => [coop.id, coop.name]));

  return input.artifacts.map((artifact) => {
    const coopIds = normalizeCoopIds(
      artifact.targetCoopId ? [artifact.targetCoopId] : [],
      coopLabels,
    );

    return {
      ...artifact,
      coopIds,
      coopLabel: formatCoopLabel(coopIds, coopLabels),
    };
  });
}

export function isCompatibilitySidepanelError(error?: string) {
  const normalized = error?.toLowerCase() ?? '';
  return (
    normalized.includes('unknown message') ||
    normalized.includes('receiving end does not exist') ||
    normalized.includes('could not establish connection') ||
    normalized.includes('message port closed')
  );
}

export function popupSyncStatus(input: {
  syncLabel?: string;
  syncState?: string;
  syncDetail?: string;
  syncTone?: 'ok' | 'warning' | 'error';
  dashboardError?: string;
}) {
  const detail =
    input.syncDetail || input.syncState || input.dashboardError || 'Checking sync status.';
  const normalized = detail.toLowerCase();

  if (!input.syncLabel && !input.syncTone) {
    if (input.dashboardError) {
      return {
        label: 'Error',
        detail: input.dashboardError,
        tone: 'error' as const,
      };
    }

    return {
      label: 'Checking',
      detail: 'Checking sync status.',
      tone: 'ok' as const,
    };
  }

  if (input.syncTone === 'error') {
    return {
      label: 'Error',
      detail,
      tone: 'error' as const,
    };
  }

  if (
    normalized.includes('limited to this browser profile') ||
    normalized.includes('no signaling server connection')
  ) {
    return {
      label: 'Local',
      detail,
      tone: 'warning' as const,
    };
  }

  if (normalized.includes('offline')) {
    return {
      label: 'Offline',
      detail,
      tone: 'warning' as const,
    };
  }

  if (input.syncTone === 'warning') {
    return {
      label: input.syncLabel === 'Healthy' ? 'Degraded' : input.syncLabel || 'Degraded',
      detail,
      tone: 'warning' as const,
    };
  }

  return {
    label: 'Healthy',
    detail,
    tone: 'ok' as const,
  };
}

export function buildFilterTags(
  coops: Array<{ id: string; name: string }>,
  activeId: string,
  onChange: (id: string) => void,
): PopupSubheaderTag[] {
  const options = [
    { id: 'all', label: 'All coops' },
    ...coops.map((coop) => ({ id: coop.id, label: coop.name })),
  ];
  return options.map((opt) => ({
    id: opt.id,
    label: opt.label,
    active: opt.id === activeId,
    onClick: () => onChange(opt.id),
  }));
}

export function matchesCoopFilter(coopIds: string[], filterId: string) {
  return filterId === 'all' || coopIds.includes(filterId);
}

export function headerTitleForScreen(screen: PopupScreen | 'no-coop') {
  switch (screen) {
    case 'create':
      return 'Create Coop';
    case 'join':
      return 'Join Coop';
    case 'drafts':
      return 'Chickens';
    case 'draft-detail':
      return 'Review Chicken';
    case 'feed':
      return 'Feed';
    case 'profile':
      return 'Profile';
    case 'no-coop':
      return 'Coop';
    default:
      return 'Home';
  }
}

export function accountSummary(primaryAddress?: string) {
  if (!primaryAddress) {
    return 'Passkey profile is created when you create or join a coop.';
  }

  return `Account ID: ${primaryAddress.slice(0, 6)}\u2026${primaryAddress.slice(-4)}`;
}
