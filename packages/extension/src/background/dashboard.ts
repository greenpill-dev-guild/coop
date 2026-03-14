import {
  type UiPreferences,
  createGrantLogEntry,
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
  listExecutionGrants,
  listGrantLogEntries,
  listLocalIdentities,
  listReceiverCaptures,
  listReceiverPairings,
  listSessionCapabilities,
  listSessionCapabilityLogEntries,
  pendingBundles,
  refreshGrantStatus,
  saveExecutionGrant,
  saveGrantLogEntry,
} from '@coop/shared';
import { isTrustedNodeRole } from '../runtime/agent-harness';
import type { DashboardResponse, RuntimeSummary } from '../runtime/messages';
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

export async function refreshStoredGrantStatuses() {
  const grants = await listExecutionGrants(db);
  const refreshed = grants.map((grant) => refreshGrantStatus(grant));

  for (const grant of refreshed) {
    const original = grants.find((candidate) => candidate.id === grant.id);
    if (!original || original.status === grant.status) {
      continue;
    }

    await saveExecutionGrant(db, grant);

    if (grant.status === 'expired') {
      await saveGrantLogEntry(
        db,
        createGrantLogEntry({
          grantId: grant.id,
          eventType: 'grant-expired',
          detail: `Grant ${grant.id} expired at ${grant.expiresAt}.`,
          coopId: grant.coopId,
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
        16: 'icons/icon-idle-16.png',
        32: 'icons/icon-idle-32.png',
        48: 'icons/icon-idle-48.png',
        128: 'icons/icon-idle-128.png',
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

// ---- Badge / Summary ----

export async function buildSummary(): Promise<RuntimeSummary> {
  const [drafts, coops, captureMode, runtimeHealth, authSession, lastCapture, prefs] =
    await Promise.all([
      db.reviewDrafts.toArray(),
      getCoops(),
      getLocalSetting(stateKeys.captureMode, 'manual'),
      getRuntimeHealth(),
      getAuthSession(db),
      db.captureRuns.orderBy('capturedAt').last(),
      hydrateUiPreferences(),
    ]);
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  const visibleDrafts = filterVisibleReviewDrafts(
    drafts,
    activeContext.activeCoopId,
    activeContext.activeMemberId,
  );
  const enhancement = localEnhancementAvailability();
  const iconState = deriveExtensionIconState({
    pendingDrafts: visibleDrafts.length,
    watching: captureMode !== 'manual',
    offline: runtimeHealth.offline,
    missingPermission: runtimeHealth.missingPermission,
    syncError: runtimeHealth.syncError || Boolean(runtimeHealth.lastCaptureError),
  });

  return {
    iconState,
    iconLabel: extensionIconStateLabel(iconState),
    pendingDrafts: visibleDrafts.length,
    coopCount: coops.length,
    syncState:
      runtimeHealth.syncError || runtimeHealth.lastCaptureError
        ? (runtimeHealth.lastSyncError ??
          runtimeHealth.lastCaptureError ??
          'Runtime needs attention')
        : coops.length > 0
          ? 'Peer-ready local-first sync'
          : 'No coop yet',
    lastCaptureAt: lastCapture?.capturedAt,
    captureMode,
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
  await chrome.action.setTitle({ title: `Coop: ${summary.iconLabel}` });
}

// ---- Full Dashboard ----

export async function getDashboard(): Promise<DashboardResponse> {
  const [
    coops,
    drafts,
    candidates,
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
    executionGrants,
    grantLogEntries,
    sessionCapabilities,
    sessionCapabilityLogEntries,
  ] = await Promise.all([
    getOperatorState({
      coops,
      authSession,
    }),
    listActionBundles(db),
    listActionLogEntries(db, 50),
    refreshStoredGrantStatuses(),
    listGrantLogEntries(db),
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
  const scopedExecutionGrants = operatorAccess
    ? executionGrants.filter((grant) => grant.coopId === activeContext.activeCoopId)
    : [];
  const scopedGrantLogEntries = operatorAccess
    ? grantLogEntries.filter((entry) => entry.coopId === activeContext.activeCoopId)
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

  return {
    coops,
    activeCoopId: activeContext.activeCoopId ?? summary.activeCoopId,
    drafts: visibleDrafts,
    candidates: candidates.reverse().slice(-12).reverse(),
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
      grants: scopedExecutionGrants,
      grantLog: scopedGrantLogEntries,
      sessionCapabilities: scopedSessionCapabilities,
      sessionCapabilityLog: scopedSessionCapabilityLogEntries,
    },
  };
}
