import {
  type AgentObservation,
  type ReviewDraft,
  type UiPreferences,
  createPermitLogEntry,
  defaultSoundPreferences,
  deriveExtensionIconState,
  extensionIconBadge,
  extensionIconStateLabel,
  filterReceiverCapturesForMemberContext,
  filterVisibleReviewDrafts,
  getAuthSession,
  getPendingOutboxCount,
  getSoundPreferences,
  listActionBundles,
  listActionLogEntries,
  listAgentObservations,
  listExecutionPermits,
  listLocalIdentities,
  listPermitLogEntries,
  listReceiverCaptures,
  listReceiverPairings,
  listReviewDrafts,
  listSessionCapabilities,
  listSessionCapabilityLogEntries,
  listTabCandidates,
  listTabRoutings,
  pendingBundles,
  pruneOutbox,
  queryRecentMemories,
  reconcileOutbox,
  refreshPermitStatus,
  saveExecutionPermit,
  savePermitLogEntry,
} from '@coop/shared';
import { isTrustedNodeRole } from '../runtime/agent-harness';
import {
  type CoopBadgeSummary,
  type DashboardResponse,
  POPUP_SNAPSHOT_KEY,
  type PopupSnapshot,
  type ProactiveSignal,
  type RuntimeSummary,
  notifyDashboardUpdated,
} from '../runtime/messages';
import { filterVisibleReceiverPairings } from '../runtime/receiver';
import { sessionCapabilityChanged } from '../runtime/session-capability';
import {
  configuredArchiveMode,
  configuredChain,
  configuredOnchainMode,
  configuredPrivacyMode,
  configuredProviderMode,
  configuredReceiverAppUrl,
  configuredSessionMode,
  configuredSignalingUrls,
  configuredWebsocketSyncUrl,
  db,
  getCoops,
  getLocalSetting,
  getRuntimeHealth,
  hydrateUiPreferences,
  localEnhancementAvailability,
  stateKeys,
} from './context';
import { getAgentCycleState } from './handlers/agent';
import { refreshStoredSessionCapabilityStatuses } from './handlers/session';
import { getActiveReviewContextForSession, getOperatorState } from './operator';

// ---- Refresh helpers shared by dashboard + other handlers ----

export async function refreshStoredPermitStatuses() {
  const permits = await listExecutionPermits(db);
  const refreshed = permits.map((permit) => refreshPermitStatus(permit));

  for (const permit of refreshed) {
    const original = permits.find((candidate) => candidate.id === permit.id);
    if (!original || original.status === permit.status) {
      continue;
    }

    await saveExecutionPermit(db, permit);

    if (permit.status === 'expired') {
      await savePermitLogEntry(
        db,
        createPermitLogEntry({
          permitId: permit.id,
          eventType: 'permit-expired',
          detail: `Permit ${permit.id} expired at ${permit.expiresAt}.`,
          coopId: permit.coopId,
        }),
      );
    }
  }

  return refreshed;
}

// ---- Extension Icon ----

export function extensionIconPaths(state: RuntimeSummary['iconState']) {
  switch (state) {
    case 'setup':
      return {
        16: 'icons/icon-16.png',
        32: 'icons/icon-32.png',
        48: 'icons/icon-48.png',
        128: 'icons/icon-128.png',
      };
    case 'ready':
      return {
        16: 'icons/icon-watching-16.png',
        32: 'icons/icon-watching-32.png',
        48: 'icons/icon-watching-48.png',
        128: 'icons/icon-watching-128.png',
      };
    case 'working':
      // TODO: create blue icon assets — reusing watching (green) for now
      return {
        16: 'icons/icon-watching-16.png',
        32: 'icons/icon-watching-32.png',
        48: 'icons/icon-watching-48.png',
        128: 'icons/icon-watching-128.png',
      };
    case 'attention':
      return {
        16: 'icons/icon-review-needed-16.png',
        32: 'icons/icon-review-needed-32.png',
        48: 'icons/icon-review-needed-48.png',
        128: 'icons/icon-review-needed-128.png',
      };
    case 'blocked':
      return {
        16: 'icons/icon-error-offline-16.png',
        32: 'icons/icon-error-offline-32.png',
        48: 'icons/icon-error-offline-48.png',
        128: 'icons/icon-error-offline-128.png',
      };
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function summarizeSyncStatus(input: {
  coopCount: number;
  runtimeHealth: Awaited<ReturnType<typeof getRuntimeHealth>>;
  pendingOutboxCount?: number;
}): Pick<RuntimeSummary, 'syncState' | 'syncLabel' | 'syncDetail' | 'syncTone'> {
  const { coopCount, runtimeHealth, pendingOutboxCount = 0 } = input;

  if (coopCount === 0) {
    return {
      syncState: 'No coop yet',
      syncLabel: 'No coop',
      syncDetail: 'Create or join a coop to enable shared sync.',
      syncTone: 'warning',
    };
  }

  if (runtimeHealth.offline) {
    return {
      syncState: 'Browser is offline. Shared sync will resume when the connection returns.',
      syncLabel: 'Offline',
      syncDetail: 'Browser is offline. Shared sync will resume when the connection returns.',
      syncTone: 'warning',
    };
  }

  const syncDetail =
    runtimeHealth.lastSyncError ??
    runtimeHealth.lastCaptureError ??
    'Runtime needs attention. Shared sync may be degraded.';
  const normalizedDetail = syncDetail.toLowerCase();

  if (runtimeHealth.syncError || runtimeHealth.lastCaptureError) {
    if (
      normalizedDetail.includes('no signaling server connection') ||
      normalizedDetail.includes('limited to this browser profile')
    ) {
      return {
        syncState: syncDetail,
        syncLabel: 'Local',
        syncDetail,
        syncTone: 'warning',
      };
    }

    if (normalizedDetail.includes('permission')) {
      return {
        syncState: syncDetail,
        syncLabel: 'Permission',
        syncDetail,
        syncTone: 'error',
      };
    }

    return {
      syncState: syncDetail,
      syncLabel: 'Needs attention',
      syncDetail,
      syncTone: 'error',
    };
  }

  if (pendingOutboxCount > 0) {
    const noun = pendingOutboxCount === 1 ? 'change' : 'changes';
    return {
      syncState: `Peer-ready local-first sync. ${pendingOutboxCount} ${noun} pending sync.`,
      syncLabel: 'Syncing',
      syncDetail: `${pendingOutboxCount} ${noun} pending sync.`,
      syncTone: 'ok',
    };
  }

  return {
    syncState: 'Peer-ready local-first sync',
    syncLabel: 'Healthy',
    syncDetail: 'Peer-ready local-first sync.',
    syncTone: 'ok',
  };
}

export function extensionActionTitle(
  summary: Pick<RuntimeSummary, 'iconState' | 'pendingAttentionCount' | 'syncDetail'>,
) {
  switch (summary.iconState) {
    case 'setup':
      return 'Coop';
    case 'blocked':
      return summary.syncDetail ? `Coop: ${summary.syncDetail}` : 'Coop: Error';
    case 'attention':
      return `Coop: ${summary.pendingAttentionCount} waiting for review`;
    case 'working':
      return 'Coop: Processing';
    case 'ready':
      return 'Coop';
    default: {
      const _exhaustive: never = summary.iconState;
      return _exhaustive;
    }
  }
}

export function describeActionIndicator(
  summary: Pick<RuntimeSummary, 'iconState' | 'pendingAttentionCount' | 'syncDetail'>,
) {
  const badge = extensionIconBadge(summary.iconState);
  const count = summary.pendingAttentionCount;
  return {
    badgeColor: badge.color,
    badgeText: count > 0 ? (count > 99 ? '99+' : String(count)) : '',
    title: extensionActionTitle(summary),
  };
}

// ---- Badge / Summary ----

const STALE_OBSERVATION_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export function isStalePendingObservation(observation: AgentObservation, now = Date.now()) {
  return (
    observation.status === 'pending' &&
    new Date(observation.createdAt).getTime() <= now - STALE_OBSERVATION_THRESHOLD_MS
  );
}

function summarizeSupportDetail(value: string, maxLength = 140) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 1)}…`;
}

export async function buildProactiveSignals(input: {
  coops: Awaited<ReturnType<typeof getCoops>>;
  drafts: ReviewDraft[];
  candidates: Awaited<ReturnType<typeof listTabCandidates>>;
  tabRoutings: Awaited<ReturnType<typeof listTabRoutings>>;
  activeCoopId?: string;
}): Promise<ProactiveSignal[]> {
  const scopedRoutings = input.tabRoutings.filter(
    (routing) =>
      (routing.status === 'routed' || routing.status === 'drafted') &&
      (!input.activeCoopId || routing.coopId === input.activeCoopId),
  );
  const groups = scopedRoutings.reduce((acc, routing) => {
    const key = routing.sourceCandidateId || routing.extractId;
    const bucket = acc.get(key) ?? [];
    bucket.push(routing);
    acc.set(key, bucket);
    return acc;
  }, new Map<string, typeof scopedRoutings>());

  const coopsById = new Map(input.coops.map((coop) => [coop.profile.id, coop] as const));
  const draftsById = new Map(input.drafts.map((draft) => [draft.id, draft] as const));
  const candidatesById = new Map(
    input.candidates.map((candidate) => [candidate.id, candidate] as const),
  );
  const supportCoopIds = [...new Set(scopedRoutings.map((routing) => routing.coopId))];
  const memoriesByCoop = new Map(
    await Promise.all(
      supportCoopIds.map(
        async (coopId) => [coopId, await queryRecentMemories(db, coopId, { limit: 2 })] as const,
      ),
    ),
  );

  return [...groups.entries()]
    .map(([groupId, routings]) => {
      const ranked = [...routings].sort(
        (left, right) => right.relevanceScore - left.relevanceScore,
      );
      const top = ranked[0];
      if (!top) {
        return null;
      }

      const candidate = candidatesById.get(top.sourceCandidateId);
      const draftId = ranked.find((routing) => typeof routing.draftId === 'string')?.draftId;
      const linkedDraft = draftId ? draftsById.get(draftId) : undefined;
      const targetCoops = ranked.map((routing) => {
        const coop = coopsById.get(routing.coopId);
        return {
          coopId: routing.coopId,
          coopName: coop?.profile.name ?? routing.coopId,
          relevanceScore: routing.relevanceScore,
          rationale: routing.rationale,
          suggestedNextStep: routing.suggestedNextStep,
          matchedRitualLenses: routing.matchedRitualLenses,
        };
      });

      const support = targetCoops
        .flatMap((target) => {
          const coop = coopsById.get(target.coopId);
          const memory = memoriesByCoop.get(target.coopId)?.[0];
          const relatedDraft = input.drafts.find(
            (draft) => draft.id !== draftId && draft.suggestedTargetCoopIds.includes(target.coopId),
          );
          const relatedArtifact = coop?.artifacts[0];
          return [
            memory
              ? {
                  id: `memory:${memory.id}`,
                  kind: 'memory' as const,
                  title: `Memory from ${target.coopName}`,
                  detail: summarizeSupportDetail(memory.content),
                }
              : null,
            relatedDraft
              ? {
                  id: `draft:${relatedDraft.id}`,
                  kind: 'draft' as const,
                  title: `Related draft in ${target.coopName}`,
                  detail: summarizeSupportDetail(relatedDraft.title),
                }
              : null,
            relatedArtifact
              ? {
                  id: `artifact:${relatedArtifact.id}`,
                  kind: 'artifact' as const,
                  title: `Recent artifact in ${target.coopName}`,
                  detail: summarizeSupportDetail(relatedArtifact.title),
                }
              : null,
          ].filter(Boolean);
        })
        .filter(
          (
            item,
          ): item is {
            id: string;
            kind: 'memory' | 'draft' | 'artifact';
            title: string;
            detail: string;
          } => Boolean(item),
        )
        .filter(
          (item, index, items) =>
            items.findIndex((candidateItem) => candidateItem.id === item.id) === index,
        )
        .slice(0, 2);

      return {
        id: `signal:${groupId}`,
        sourceCandidateId: top.sourceCandidateId,
        extractId: top.extractId,
        title: candidate?.title ?? linkedDraft?.title ?? 'Routed signal',
        url: candidate?.url ?? linkedDraft?.sources[0]?.url ?? '',
        domain: candidate?.domain ?? linkedDraft?.sources[0]?.domain ?? 'local',
        category: top.category,
        tags: [...new Set(ranked.flatMap((routing) => routing.tags))],
        archiveWorthinessHint: ranked.some((routing) => routing.archiveWorthinessHint),
        draftId,
        topRelevanceScore: top.relevanceScore,
        targetCoops,
        support,
        updatedAt: ranked[0]?.updatedAt ?? top.updatedAt,
      } satisfies ProactiveSignal;
    })
    .filter((signal): signal is ProactiveSignal => Boolean(signal))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function buildSummary(): Promise<{ summary: RuntimeSummary; drafts: ReviewDraft[] }> {
  const [
    drafts,
    coops,
    captureMode,
    runtimeHealth,
    authSession,
    lastCapture,
    prefs,
    tabRoutings,
    actionBundles,
    agentCycleState,
    observations,
  ] = await Promise.all([
    listReviewDrafts(db),
    getCoops(),
    getLocalSetting<RuntimeSummary['captureMode']>(stateKeys.captureMode, 'manual'),
    getRuntimeHealth(),
    getAuthSession(db),
    db.captureRuns.orderBy('capturedAt').last(),
    hydrateUiPreferences(),
    listTabRoutings(db, { status: ['routed', 'drafted'], limit: 500 }),
    listActionBundles(db),
    getAgentCycleState(),
    listAgentObservations(db, 500),
  ]);
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  const visibleDrafts = filterVisibleReviewDrafts(
    drafts,
    activeContext.activeCoopId,
    activeContext.activeMemberId,
  );
  const routedTabs = new Set(
    tabRoutings
      .filter(
        (routing) => !activeContext.activeCoopId || routing.coopId === activeContext.activeCoopId,
      )
      .map((routing) => routing.sourceCandidateId),
  ).size;
  const insightDrafts = visibleDrafts.filter(
    (draft) =>
      draft.provenance.type === 'agent' &&
      draft.provenance.skillId === 'memory-insight-synthesizer',
  ).length;
  const pendingActions = activeContext.activeCoopId
    ? pendingBundles(actionBundles.filter((bundle) => bundle.coopId === activeContext.activeCoopId))
        .length
    : 0;
  const staleObservationCount = observations.filter(
    (observation) =>
      isStalePendingObservation(observation) &&
      (!activeContext.activeCoopId || observation.coopId === activeContext.activeCoopId),
  ).length;
  const pendingAttentionCount =
    visibleDrafts.length + routedTabs + pendingActions + staleObservationCount;
  const enhancement = localEnhancementAvailability();
  const iconState = deriveExtensionIconState({
    hasCoop: coops.length > 0,
    agentActive: agentCycleState.running,
    pendingAttention: pendingAttentionCount,
    blocked: runtimeHealth.missingPermission,
  });
  const outboxCount = await getPendingOutboxCount(db).catch(() => 0);
  const syncSummary = summarizeSyncStatus({
    coopCount: coops.length,
    runtimeHealth,
    pendingOutboxCount: outboxCount,
  });

  const summary: RuntimeSummary = {
    iconState,
    iconLabel: extensionIconStateLabel(iconState),
    pendingDrafts: visibleDrafts.length,
    routedTabs,
    insightDrafts,
    pendingActions,
    staleObservationCount,
    pendingAttentionCount,
    coopCount: coops.length,
    syncState: syncSummary.syncState,
    syncLabel: syncSummary.syncLabel,
    syncDetail: syncSummary.syncDetail,
    syncTone: syncSummary.syncTone,
    lastCaptureAt: lastCapture?.capturedAt,
    captureMode,
    agentCadenceMinutes: prefs.agentCadenceMinutes,
    localEnhancement:
      enhancement.status === 'ready'
        ? (enhancement.model ?? enhancement.reason)
        : `Heuristics-first fallback (${enhancement.reason})`,
    localInferenceOptIn: prefs.localInferenceOptIn,
    activeCoopId: activeContext.activeCoopId,
    pendingOutboxCount: outboxCount,
  };
  return { summary, drafts };
}

export async function writePopupSnapshot(
  summary: RuntimeSummary,
  coops: Array<{ profile: { id: string; name: string }; artifacts: unknown[] }>,
  drafts: ReviewDraft[],
) {
  const recentDraftTitles = drafts
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3)
    .map((d) => d.title);

  const snapshot: PopupSnapshot = {
    hasCoops: coops.length > 0,
    coopCount: coops.length,
    coopOptions: coops.map((c) => ({ id: c.profile.id, name: c.profile.name })),
    activeCoopId: summary.activeCoopId,
    syncLabel: summary.syncLabel ?? 'Checking',
    syncTone: summary.syncTone ?? 'ok',
    syncDetail: summary.syncDetail ?? 'Checking sync status.',
    draftCount: summary.pendingDrafts,
    routedSignalCount: summary.routedTabs,
    staleObservationCount: summary.staleObservationCount,
    artifactCount: coops.reduce((sum, c) => sum + c.artifacts.length, 0),
    lastCaptureAt: summary.lastCaptureAt,
    recentDraftTitles,
    cachedAt: new Date().toISOString(),
  };

  await chrome.storage.local.set({ [POPUP_SNAPSHOT_KEY]: snapshot }).catch(() => {});
}

/** Reconcile + prune outbox entries. Call after writes (sync, capture, publish), not on reads. */
export async function reconcileOutboxEntries() {
  const coops = await getCoops();
  await Promise.all(
    coops.map((coop) => {
      const syncedKeys = new Set(coop.artifacts.map((a) => a.id));
      return reconcileOutbox(db, coop.profile.id, syncedKeys).catch(() => 0);
    }),
  );
  await pruneOutbox(db).catch(() => 0);
}

export async function refreshBadge() {
  await reconcileOutboxEntries();
  const [{ summary, drafts }, coops] = await Promise.all([buildSummary(), getCoops()]);
  const indicator = describeActionIndicator(summary);
  await chrome.action.setIcon({ path: extensionIconPaths(summary.iconState) });
  await chrome.action.setBadgeText({ text: indicator.badgeText });
  await chrome.action.setBadgeBackgroundColor({ color: indicator.badgeColor });
  await chrome.action.setTitle({
    title: indicator.title,
  });
  void writePopupSnapshot(summary, coops, drafts);
  void notifyDashboardUpdated();
}

// ---- Full Dashboard ----

export async function getDashboard(): Promise<DashboardResponse> {
  const [
    coops,
    drafts,
    candidates,
    tabRoutings,
    summaryResult,
    soundPreferences,
    resolvedUiPreferences,
    authSession,
    identities,
    receiverPairings,
    receiverIntake,
    recentCaptureRuns,
  ] = await Promise.all([
    getCoops(),
    listReviewDrafts(db),
    listTabCandidates(db, 200),
    listTabRoutings(db, { status: ['routed', 'drafted', 'published'], limit: 500 }),
    buildSummary(),
    getSoundPreferences(db),
    hydrateUiPreferences(),
    getAuthSession(db),
    listLocalIdentities(db),
    listReceiverPairings(db),
    listReceiverCaptures(db),
    db.captureRuns.orderBy('capturedAt').reverse().limit(5).toArray(),
  ]);
  const { summary } = summaryResult;
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  const orderedDrafts = drafts;
  const visibleDrafts = filterVisibleReviewDrafts(
    orderedDrafts,
    activeContext.activeCoopId,
    activeContext.activeMemberId,
  );
  const visibleReceiverIntake = filterReceiverCapturesForMemberContext(
    receiverIntake,
    activeContext.activeCoopId,
    activeContext.activeMemberId,
  );
  const visibleReceiverPairings = filterVisibleReceiverPairings(
    receiverPairings,
    activeContext.activeCoopId,
    activeContext.activeMemberId,
  );
  const [
    operator,
    actionBundles,
    actionLogEntries,
    executionPermits,
    permitLogEntries,
    sessionCapabilities,
    sessionCapabilityLogEntries,
  ] = await Promise.all([
    getOperatorState({
      coops,
      authSession,
    }),
    listActionBundles(db),
    listActionLogEntries(db, 50),
    refreshStoredPermitStatuses(),
    listPermitLogEntries(db),
    refreshStoredSessionCapabilityStatuses(),
    listSessionCapabilityLogEntries(db),
  ]);
  const operatorAccess = isTrustedNodeRole(operator.activeMember?.role);
  const scopedActionBundles = operatorAccess
    ? actionBundles.filter((bundle) => bundle.coopId === activeContext.activeCoopId)
    : [];
  const scopedActionLogEntries = operatorAccess
    ? actionLogEntries.filter((entry) => entry.coopId === activeContext.activeCoopId)
    : [];
  const scopedExecutionPermits = operatorAccess
    ? executionPermits.filter((permit) => permit.coopId === activeContext.activeCoopId)
    : [];
  const scopedPermitLogEntries = operatorAccess
    ? permitLogEntries.filter((entry) => entry.coopId === activeContext.activeCoopId)
    : [];
  const scopedSessionCapabilities = operatorAccess
    ? sessionCapabilities.filter((capability) => capability.coopId === activeContext.activeCoopId)
    : [];
  const scopedSessionCapabilityLogEntries = operatorAccess
    ? sessionCapabilityLogEntries.filter((entry) => entry.coopId === activeContext.activeCoopId)
    : [];
  const scopedPrivilegedActionLog = operatorAccess
    ? operator.actionLog.filter(
        (entry) => !entry.context.coopId || entry.context.coopId === activeContext.activeCoopId,
      )
    : [];
  const visibleTabRoutings = [...tabRoutings]
    .filter((routing) => routing.status !== 'dismissed')
    .reduce((grouped, routing) => {
      const bucket = grouped.get(routing.sourceCandidateId) ?? [];
      bucket.push(routing);
      grouped.set(routing.sourceCandidateId, bucket);
      return grouped;
    }, new Map<string, typeof tabRoutings>());
  const topTabRoutings = [...visibleTabRoutings.values()].flatMap((routings) =>
    [...routings].sort((left, right) => right.relevanceScore - left.relevanceScore).slice(0, 3),
  );

  const coopBadges: CoopBadgeSummary[] = coops.map((coop) => ({
    coopId: coop.profile.id,
    coopName: coop.profile.name,
    pendingDrafts: orderedDrafts.filter((d) => d.suggestedTargetCoopIds.includes(coop.profile.id))
      .length,
    routedTabs: new Set(
      tabRoutings
        .filter(
          (routing) =>
            routing.coopId === coop.profile.id &&
            (routing.status === 'routed' || routing.status === 'drafted'),
        )
        .map((routing) => routing.sourceCandidateId),
    ).size,
    insightDrafts: orderedDrafts.filter(
      (draft) =>
        draft.suggestedTargetCoopIds.includes(coop.profile.id) &&
        draft.provenance.type === 'agent' &&
        draft.provenance.skillId === 'memory-insight-synthesizer',
    ).length,
    artifactCount: coop.artifacts.length,
    pendingActions: operatorAccess
      ? pendingBundles(actionBundles.filter((b) => b.coopId === coop.profile.id)).length
      : 0,
    pendingAttentionCount:
      orderedDrafts.filter((d) => d.suggestedTargetCoopIds.includes(coop.profile.id)).length +
      new Set(
        tabRoutings
          .filter(
            (routing) =>
              routing.coopId === coop.profile.id &&
              (routing.status === 'routed' || routing.status === 'drafted'),
          )
          .map((routing) => routing.sourceCandidateId),
      ).size +
      (operatorAccess
        ? pendingBundles(actionBundles.filter((b) => b.coopId === coop.profile.id)).length
        : 0),
  }));
  const proactiveSignals = await buildProactiveSignals({
    coops,
    drafts: orderedDrafts,
    candidates,
    tabRoutings,
    activeCoopId: activeContext.activeCoopId,
  });

  return {
    coops,
    activeCoopId: activeContext.activeCoopId ?? summary.activeCoopId,
    coopBadges,
    drafts: visibleDrafts,
    candidates: candidates.slice(0, 12),
    tabRoutings: topTabRoutings,
    proactiveSignals,
    summary,
    soundPreferences: soundPreferences ?? defaultSoundPreferences,
    uiPreferences: resolvedUiPreferences,
    authSession,
    identities,
    receiverPairings: visibleReceiverPairings,
    receiverIntake: visibleReceiverIntake,
    runtimeConfig: {
      chainKey: configuredChain,
      onchainMode: configuredOnchainMode,
      archiveMode: configuredArchiveMode,
      sessionMode: configuredSessionMode,
      providerMode: configuredProviderMode,
      privacyMode: configuredPrivacyMode,
      receiverAppUrl: configuredReceiverAppUrl,
      signalingUrls: configuredSignalingUrls,
      websocketSyncUrl: configuredWebsocketSyncUrl,
    },
    operator: {
      anchorCapability: operator.anchorCapability,
      anchorActive: operator.anchorStatus.active,
      anchorDetail: operator.anchorStatus.detail,
      actionLog: scopedPrivilegedActionLog,
      archiveMode: configuredArchiveMode,
      onchainMode: configuredOnchainMode,
      liveArchiveAvailable: operator.liveArchive.available,
      liveArchiveDetail: operator.liveArchive.detail,
      liveOnchainAvailable: operator.liveOnchain.available,
      liveOnchainDetail: operator.liveOnchain.detail,
      policyActionQueue: pendingBundles(scopedActionBundles),
      policyActionLogEntries: scopedActionLogEntries,
      permits: scopedExecutionPermits,
      permitLog: scopedPermitLogEntries,
      sessionCapabilities: scopedSessionCapabilities,
      sessionCapabilityLog: scopedSessionCapabilityLogEntries,
    },
    recentCaptureRuns,
  };
}
