import {
  type UiPreferences,
  createPermitLogEntry,
  defaultSoundPreferences,
  deriveExtensionIconState,
  extensionIconBadge,
  extensionIconStateLabel,
  filterReceiverCapturesForMemberContext,
  filterVisibleReviewDrafts,
  getAuthSession,
  getSoundPreferences,
  listActionBundles,
  listActionLogEntries,
  listExecutionPermits,
  listLocalIdentities,
  listPermitLogEntries,
  listReceiverCaptures,
  listReceiverPairings,
  listSessionCapabilities,
  listSessionCapabilityLogEntries,
  listTabRoutings,
  pendingBundles,
  refreshPermitStatus,
  saveExecutionPermit,
  savePermitLogEntry,
} from '@coop/shared';
import { isTrustedNodeRole } from '../runtime/agent-harness';
import {
  type CoopBadgeSummary,
  type DashboardResponse,
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
  db,
  getCoops,
  getLocalSetting,
  getRuntimeHealth,
  hydrateUiPreferences,
  localEnhancementAvailability,
  stateKeys,
} from './context';
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
    case 'idle':
      return {
        16: 'icons/icon-16.png',
        32: 'icons/icon-32.png',
        48: 'icons/icon-48.png',
        128: 'icons/icon-128.png',
      };
    case 'watching':
      return {
        16: 'icons/icon-watching-16.png',
        32: 'icons/icon-watching-32.png',
        48: 'icons/icon-watching-48.png',
        128: 'icons/icon-watching-128.png',
      };
    case 'review-needed':
      return {
        16: 'icons/icon-review-needed-16.png',
        32: 'icons/icon-review-needed-32.png',
        48: 'icons/icon-review-needed-48.png',
        128: 'icons/icon-review-needed-128.png',
      };
    case 'error-offline':
      return {
        16: 'icons/icon-error-offline-16.png',
        32: 'icons/icon-error-offline-32.png',
        48: 'icons/icon-error-offline-48.png',
        128: 'icons/icon-error-offline-128.png',
      };
  }
}

export function summarizeSyncStatus(input: {
  coopCount: number;
  runtimeHealth: Awaited<ReturnType<typeof getRuntimeHealth>>;
}): Pick<RuntimeSummary, 'syncState' | 'syncLabel' | 'syncDetail' | 'syncTone'> {
  const { coopCount, runtimeHealth } = input;

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
        syncLabel: 'Local only',
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

  return {
    syncState: 'Peer-ready local-first sync',
    syncLabel: 'Healthy',
    syncDetail: 'Peer-ready local-first sync.',
    syncTone: 'ok',
  };
}

// ---- Badge / Summary ----

export async function buildSummary(): Promise<RuntimeSummary> {
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
  ] = await Promise.all([
    db.reviewDrafts.toArray(),
    getCoops(),
    getLocalSetting<RuntimeSummary['captureMode']>(stateKeys.captureMode, 'manual'),
    getRuntimeHealth(),
    getAuthSession(db),
    db.captureRuns.orderBy('capturedAt').last(),
    hydrateUiPreferences(),
    listTabRoutings(db, { status: ['routed', 'drafted'], limit: 500 }),
    listActionBundles(db),
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
  const pendingAttentionCount = visibleDrafts.length + routedTabs + pendingActions;
  const enhancement = localEnhancementAvailability();
  const iconState = deriveExtensionIconState({
    pendingDrafts: pendingAttentionCount,
    watching: coops.length > 0,
    offline: runtimeHealth.offline,
    missingPermission: runtimeHealth.missingPermission,
    syncError: runtimeHealth.syncError || Boolean(runtimeHealth.lastCaptureError),
  });
  const syncSummary = summarizeSyncStatus({
    coopCount: coops.length,
    runtimeHealth,
  });

  return {
    iconState,
    iconLabel: extensionIconStateLabel(iconState),
    pendingDrafts: visibleDrafts.length,
    routedTabs,
    insightDrafts,
    pendingActions,
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
  };
}

export async function refreshBadge() {
  const summary = await buildSummary();
  const badge = extensionIconBadge(summary.iconState);
  await chrome.action.setIcon({ path: extensionIconPaths(summary.iconState) });
  await chrome.action.setBadgeText({ text: badge.text });
  await chrome.action.setBadgeBackgroundColor({ color: badge.color });
  await chrome.action.setTitle({
    title: summary.iconState === 'idle' ? 'Coop' : `Coop: ${summary.iconLabel}`,
  });
  void notifyDashboardUpdated();
}

// ---- Full Dashboard ----

export async function getDashboard(): Promise<DashboardResponse> {
  const [
    coops,
    drafts,
    candidates,
    tabRoutings,
    summary,
    soundPreferences,
    resolvedUiPreferences,
    authSession,
    identities,
    receiverPairings,
    receiverIntake,
  ] = await Promise.all([
    getCoops(),
    db.reviewDrafts.reverse().sortBy('createdAt'),
    db.tabCandidates.reverse().sortBy('capturedAt'),
    listTabRoutings(db, { status: ['routed', 'drafted', 'published'], limit: 500 }),
    buildSummary(),
    getSoundPreferences(db),
    hydrateUiPreferences(),
    getAuthSession(db),
    listLocalIdentities(db),
    listReceiverPairings(db),
    listReceiverCaptures(db),
  ]);
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  const orderedDrafts = drafts.reverse();
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

  return {
    coops,
    activeCoopId: activeContext.activeCoopId ?? summary.activeCoopId,
    coopBadges,
    drafts: visibleDrafts,
    candidates: candidates.reverse().slice(-12).reverse(),
    tabRoutings: topTabRoutings,
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
  };
}
