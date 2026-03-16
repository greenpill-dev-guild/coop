import {
  type ReceiverCapture,
  type UiPreferences,
  authSessionToLocalIdentity,
  buildAgentLogExport,
  buildAgentManifest,
  coopSharedStateSchema,
  getAuthSession,
  getPrivacyIdentitiesForCoop,
  getPrivacyIdentity,
  getSoundPreferences,
  getStealthKeyPair,
  listReceiverPairings,
  selectActiveReceiverPairingsForSync,
  setAuthSession,
  setSoundPreferences,
  upsertLocalIdentity,
} from '@coop/shared';
import { listRegisteredSkills } from './runtime/agent-registry';
import type {
  DashboardResponse,
  ReceiverSyncRuntimeStatus,
  RuntimeActionResponse,
  RuntimeRequest,
} from './runtime/messages';
import { notifyDashboardUpdated } from './runtime/messages';
import { filterVisibleReceiverPairings } from './runtime/receiver';

// ---- Context (shared state) ----
import {
  contextMenuIds,
  db,
  ensureDbReady,
  ensureDefaults,
  ensureReceiverSyncOffscreenDocument,
  getCoops,
  getLocalSetting,
  getReceiverSyncRuntime,
  hydrateUiPreferences,
  reportReceiverSyncRuntime,
  saveResolvedUiPreferences,
  saveState,
  setLocalSetting,
  setRuntimeHealth,
  stateKeys,
  syncCaptureAlarm,
  uiPreferences,
} from './background/context';

// ---- Operator ----
import { getActiveReviewContextForSession } from './background/operator';

// ---- Dashboard ----
import { getDashboard, refreshBadge } from './background/dashboard';

import {
  handleApproveAction,
  handleExecuteAction,
  handleExecuteWithPermit,
  handleGetActionHistory,
  handleGetActionPolicies,
  handleGetActionQueue,
  handleGetPermitLog,
  handleGetPermits,
  handleIssuePermit,
  handleProposeAction,
  handleRejectAction,
  handleRevokePermit,
  handleSetActionPolicy,
} from './background/handlers/actions';
import {
  handleApproveAgentPlan,
  handleGetAgentDashboard,
  handleListSkillManifests,
  handleQueueGreenGoodsAssessment,
  handleQueueGreenGoodsGapAdminSync,
  handleQueueGreenGoodsWorkApproval,
  handleRejectAgentPlan,
  handleRetrySkillRun,
  handleRunAgentCycle,
  handleSetAgentSkillAutoRun,
  syncAgentObservations,
} from './background/handlers/agent';
import {
  handleAnchorArchiveCid,
  handleArchiveArtifact,
  handleArchiveSnapshot,
  handleExportArtifact,
  handleExportReceipt,
  handleExportSnapshot,
  handleFvmRegistration,
  handleProvisionArchiveSpace,
  handleRefreshArchiveStatus,
  handleRemoveCoopArchiveConfig,
  handleRetrieveArchiveBundle,
  handleSetArtifactArchiveWorthiness,
  handleSetCoopArchiveConfig,
  pollUnsealedArchiveReceipts,
} from './background/handlers/archive';
// ---- Handlers ----
import {
  captureActiveTab,
  captureVisibleScreenshot,
  openCoopSidepanel,
  registerContextMenus,
  runCaptureCycle,
} from './background/handlers/capture';
import {
  handleCreateCoop,
  handleJoinCoop,
  handleResolveOnchainState,
  handleSetAnchorMode,
} from './background/handlers/coop';
import {
  handleArchiveReceiverIntake,
  handleConvertReceiverIntake,
  handleCreateInvite,
  handleCreateReceiverPairing,
  handleIngestReceiverCapture,
  handleSetActiveReceiverPairing,
  handleSetReceiverIntakeArchiveWorthiness,
} from './background/handlers/receiver';
import {
  handlePublishDraft,
  handleUpdateMeetingSettings,
  handleUpdateReviewDraft,
} from './background/handlers/review';
import {
  handleGetSessionCapabilities,
  handleGetSessionCapabilityLog,
  handleIssueSessionCapability,
  handleRevokeSessionCapability,
  handleRotateSessionCapability,
} from './background/handlers/session';

import { handleAgentHeartbeat } from './background/handlers/heartbeat';

// ---- Receiver Sync Config ----

async function getReceiverSyncConfig() {
  const [pairings, coops, authSession] = await Promise.all([
    listReceiverPairings(db),
    getCoops(),
    getAuthSession(db),
  ]);
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  return {
    pairings: filterVisibleReceiverPairings(
      selectActiveReceiverPairingsForSync(pairings),
      activeContext.activeCoopId,
      activeContext.activeMemberId,
    ),
  };
}

// ---- Chrome Event Listeners ----

chrome.contextMenus.onClicked.addListener((info) => {
  void (async () => {
    await ensureDefaults();
    switch (info.menuItemId) {
      case contextMenuIds.open:
        await openCoopSidepanel();
        break;
      case contextMenuIds.roundUp:
        await captureActiveTab();
        break;
      case contextMenuIds.screenshot:
        await captureVisibleScreenshot();
        break;
    }
  })();
});

chrome.commands.onCommand.addListener((command) => {
  void (async () => {
    await ensureDefaults();
    switch (command) {
      case 'open-sidepanel':
        await openCoopSidepanel();
        break;
      case 'round-up-tab':
        await captureActiveTab();
        break;
      case 'capture-screenshot':
        await captureVisibleScreenshot();
        break;
    }
  })();
});

chrome.runtime.onInstalled.addListener(async () => {
  await ensureDbReady();
  await ensureDefaults();
  await registerContextMenus();
  await syncCaptureAlarm(await getLocalSetting(stateKeys.captureMode, 'manual'));
  await chrome.alarms.create('archive-status-poll', { periodInMinutes: 360 });
  await chrome.alarms.create('agent-heartbeat', { periodInMinutes: 5 });
  await ensureReceiverSyncOffscreenDocument();
  await syncAgentObservations();
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  await refreshBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureDbReady();
  await ensureDefaults();
  await registerContextMenus();
  await syncCaptureAlarm(await getLocalSetting(stateKeys.captureMode, 'manual'));
  await chrome.alarms.create('archive-status-poll', { periodInMinutes: 360 });
  await chrome.alarms.create('agent-heartbeat', { periodInMinutes: 5 });
  await ensureReceiverSyncOffscreenDocument();
  await syncAgentObservations();
  await refreshBadge();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  await ensureDbReady();
  if (alarm.name === 'agent-heartbeat') {
    await handleAgentHeartbeat();
    return;
  }
  if (alarm.name === 'archive-status-poll') {
    await pollUnsealedArchiveReceipts();
    return;
  }

  const captureMode = await getLocalSetting(stateKeys.captureMode, 'manual');
  if (captureMode !== 'manual') {
    await runCaptureCycle();
  }
  await syncAgentObservations();
});

// ---- Message Dispatcher ----

chrome.runtime.onMessage.addListener((message: RuntimeRequest, sender, sendResponse) => {
  void (async () => {
    await ensureDbReady();
    await ensureDefaults();

    const isExtensionContext = !sender.tab && sender.id === chrome.runtime.id;
    const isAllowedBridgeMessage = message.type === 'ingest-receiver-capture';

    if (!isExtensionContext && !isAllowedBridgeMessage) {
      sendResponse({
        ok: false,
        error: 'Unauthorized sender.',
      } satisfies RuntimeActionResponse);
      return;
    }

    switch (message.type) {
      case 'get-auth-session':
        sendResponse({
          ok: true,
          data: await getAuthSession(db),
        } satisfies RuntimeActionResponse);
        return;
      case 'set-auth-session':
        await setAuthSession(db, message.payload);
        if (message.payload) {
          const identity = authSessionToLocalIdentity(message.payload);
          if (identity) {
            await upsertLocalIdentity(db, identity);
          }
        }
        sendResponse({ ok: true } satisfies RuntimeActionResponse);
        return;
      case 'set-anchor-mode':
        sendResponse(await handleSetAnchorMode(message));
        return;
      case 'get-dashboard':
        sendResponse({
          ok: true,
          data: await getDashboard(),
        } satisfies RuntimeActionResponse<DashboardResponse>);
        return;
      case 'get-receiver-sync-config':
        await ensureReceiverSyncOffscreenDocument();
        sendResponse({
          ok: true,
          data: await getReceiverSyncConfig(),
        } satisfies RuntimeActionResponse<Awaited<ReturnType<typeof getReceiverSyncConfig>>>);
        return;
      case 'get-receiver-sync-runtime':
        sendResponse({
          ok: true,
          data: await getReceiverSyncRuntime(),
        } satisfies RuntimeActionResponse<ReceiverSyncRuntimeStatus>);
        return;
      case 'manual-capture':
        sendResponse({
          ok: true,
          data: await runCaptureCycle(),
        } satisfies RuntimeActionResponse<number>);
        return;
      case 'capture-active-tab':
        sendResponse({
          ok: true,
          data: await captureActiveTab(),
        } satisfies RuntimeActionResponse<number>);
        return;
      case 'capture-visible-screenshot':
        try {
          sendResponse({
            ok: true,
            data: await captureVisibleScreenshot(),
          } satisfies RuntimeActionResponse<ReceiverCapture>);
        } catch (error) {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : 'Screenshot capture failed.',
          } satisfies RuntimeActionResponse);
        }
        return;
      case 'create-coop':
        sendResponse(await handleCreateCoop(message));
        return;
      case 'resolve-onchain-state':
        sendResponse(await handleResolveOnchainState(message));
        return;
      case 'create-receiver-pairing':
        sendResponse(await handleCreateReceiverPairing(message));
        return;
      case 'convert-receiver-intake':
        sendResponse(await handleConvertReceiverIntake(message));
        return;
      case 'archive-receiver-intake':
        sendResponse(await handleArchiveReceiverIntake(message));
        return;
      case 'set-receiver-intake-archive-worthy':
        sendResponse(await handleSetReceiverIntakeArchiveWorthiness(message));
        return;
      case 'create-invite':
        sendResponse(await handleCreateInvite(message));
        return;
      case 'set-active-receiver-pairing':
        sendResponse(await handleSetActiveReceiverPairing(message));
        return;
      case 'ingest-receiver-capture':
        sendResponse(await handleIngestReceiverCapture(message));
        return;
      case 'join-coop':
        sendResponse(await handleJoinCoop(message));
        return;
      case 'publish-draft':
        sendResponse(await handlePublishDraft(message));
        return;
      case 'update-review-draft':
        sendResponse(await handleUpdateReviewDraft(message));
        return;
      case 'update-meeting-settings':
        sendResponse(await handleUpdateMeetingSettings(message));
        return;
      case 'archive-artifact':
        sendResponse(await handleArchiveArtifact(message));
        return;
      case 'set-artifact-archive-worthy':
        sendResponse(await handleSetArtifactArchiveWorthiness(message));
        return;
      case 'archive-snapshot':
        sendResponse(await handleArchiveSnapshot(message));
        return;
      case 'refresh-archive-status':
        sendResponse(await handleRefreshArchiveStatus(message));
        return;
      case 'retrieve-archive-bundle':
        sendResponse(await handleRetrieveArchiveBundle(message));
        return;
      case 'provision-archive-space':
        sendResponse(await handleProvisionArchiveSpace(message.payload));
        return;
      case 'set-coop-archive-config':
        sendResponse(await handleSetCoopArchiveConfig(message.payload));
        return;
      case 'remove-coop-archive-config':
        sendResponse(await handleRemoveCoopArchiveConfig(message.payload));
        return;
      case 'anchor-archive-cid':
        sendResponse(await handleAnchorArchiveCid(message.payload));
        return;
      case 'fvm-register-archive':
        sendResponse(await handleFvmRegistration(message.payload));
        return;
      case 'export-snapshot':
        sendResponse(await handleExportSnapshot(message));
        return;
      case 'export-artifact':
        sendResponse(await handleExportArtifact(message));
        return;
      case 'export-receipt':
        sendResponse(await handleExportReceipt(message));
        return;
      case 'set-sound-preferences':
        await setSoundPreferences(db, message.payload);
        sendResponse({ ok: true } satisfies RuntimeActionResponse);
        return;
      case 'get-ui-preferences':
        sendResponse({
          ok: true,
          data: await hydrateUiPreferences(),
        } satisfies RuntimeActionResponse<UiPreferences>);
        return;
      case 'set-ui-preferences':
        sendResponse({
          ok: true,
          data: await saveResolvedUiPreferences(message.payload),
        } satisfies RuntimeActionResponse<UiPreferences>);
        return;
      case 'set-capture-mode':
        await setLocalSetting(stateKeys.captureMode, message.payload.captureMode);
        await syncCaptureAlarm(message.payload.captureMode);
        await refreshBadge();
        sendResponse({ ok: true } satisfies RuntimeActionResponse);
        return;
      case 'set-active-coop':
        await setLocalSetting(stateKeys.activeCoopId, message.payload.coopId);
        await refreshBadge();
        void notifyDashboardUpdated();
        sendResponse({ ok: true } satisfies RuntimeActionResponse);
        return;
      case 'persist-coop-state': {
        const parsed = coopSharedStateSchema.safeParse(message.payload.state);
        if (!parsed.success) {
          console.warn('persist-coop-state validation failed:', parsed.error.issues);
          sendResponse({ ok: false, error: 'Invalid coop state' } satisfies RuntimeActionResponse);
          return;
        }
        await saveState(parsed.data);
        await refreshBadge();
        sendResponse({ ok: true } satisfies RuntimeActionResponse);
        return;
      }
      case 'report-sync-health':
        await setRuntimeHealth({
          syncError: message.payload.syncError,
          lastSyncError: message.payload.note,
        });
        await refreshBadge();
        sendResponse({ ok: true } satisfies RuntimeActionResponse);
        return;
      case 'report-receiver-sync-runtime':
        sendResponse({
          ok: true,
          data: await reportReceiverSyncRuntime(message.payload),
        } satisfies RuntimeActionResponse<ReceiverSyncRuntimeStatus>);
        return;
      case 'set-local-inference-opt-in':
        sendResponse({
          ok: true,
          data: await saveResolvedUiPreferences({
            ...uiPreferences,
            localInferenceOptIn: message.payload.enabled,
          }),
        });
        return;
      case 'queue-green-goods-work-approval':
        sendResponse(await handleQueueGreenGoodsWorkApproval(message));
        return;
      case 'queue-green-goods-assessment':
        sendResponse(await handleQueueGreenGoodsAssessment(message));
        return;
      case 'queue-green-goods-gap-admin-sync':
        sendResponse(await handleQueueGreenGoodsGapAdminSync(message));
        return;
      case 'get-agent-dashboard':
        sendResponse(await handleGetAgentDashboard());
        return;
      case 'run-agent-cycle':
        sendResponse(await handleRunAgentCycle());
        return;
      case 'approve-agent-plan':
        sendResponse(await handleApproveAgentPlan(message));
        return;
      case 'reject-agent-plan':
        sendResponse(await handleRejectAgentPlan(message));
        return;
      case 'retry-skill-run':
        sendResponse(await handleRetrySkillRun(message));
        return;
      case 'list-skill-manifests':
        sendResponse(await handleListSkillManifests());
        return;
      case 'set-agent-skill-auto-run':
        sendResponse(await handleSetAgentSkillAutoRun(message));
        return;
      case 'get-action-policies':
        sendResponse(await handleGetActionPolicies());
        return;
      case 'set-action-policy':
        sendResponse(await handleSetActionPolicy(message));
        return;
      case 'propose-action':
        sendResponse(await handleProposeAction(message));
        return;
      case 'approve-action':
        sendResponse(await handleApproveAction(message));
        return;
      case 'reject-action':
        sendResponse(await handleRejectAction(message));
        return;
      case 'execute-action':
        sendResponse(await handleExecuteAction(message));
        return;
      case 'get-action-queue':
        sendResponse(await handleGetActionQueue());
        return;
      case 'get-action-history':
        sendResponse(await handleGetActionHistory());
        return;
      case 'issue-permit':
        sendResponse(await handleIssuePermit(message));
        return;
      case 'revoke-permit':
        sendResponse(await handleRevokePermit(message));
        return;
      case 'execute-with-permit':
        sendResponse(await handleExecuteWithPermit(message));
        return;
      case 'get-permits':
        sendResponse(await handleGetPermits());
        return;
      case 'get-permit-log':
        sendResponse(await handleGetPermitLog());
        return;
      case 'issue-session-capability':
        sendResponse(await handleIssueSessionCapability(message));
        return;
      case 'rotate-session-capability':
        sendResponse(await handleRotateSessionCapability(message));
        return;
      case 'revoke-session-capability':
        sendResponse(await handleRevokeSessionCapability(message));
        return;
      case 'get-session-capabilities':
        sendResponse(await handleGetSessionCapabilities());
        return;
      case 'get-session-capability-log':
        sendResponse(await handleGetSessionCapabilityLog());
        return;
      case 'export-agent-manifest': {
        const coops = await getCoops();
        const coop = coops.find((item) => item.profile.id === message.payload.coopId);
        if (!coop) {
          sendResponse({ ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse);
          return;
        }
        const skillEntries = listRegisteredSkills();
        const manifest = buildAgentManifest({
          coop,
          skills: skillEntries.map((e) => e.manifest.id),
          agentId: coop.agentIdentity?.agentId,
        });
        sendResponse({ ok: true, data: manifest } satisfies RuntimeActionResponse);
        return;
      }
      case 'export-agent-log': {
        const coops = await getCoops();
        const coop = coops.find((item) => item.profile.id === message.payload.coopId);
        if (!coop) {
          sendResponse({ ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse);
          return;
        }
        let logs = await db.agentLogs.orderBy('timestamp').reverse().limit(500).toArray();
        if (message.payload.traceId) {
          logs = logs.filter((log) => log.traceId === message.payload.traceId);
        }
        const agentLog = buildAgentLogExport({
          logs,
          coopName: coop.profile.name,
          agentId: coop.agentIdentity?.agentId ?? 0,
        });
        sendResponse({ ok: true, data: agentLog } satisfies RuntimeActionResponse);
        return;
      }
      case 'get-agent-identity': {
        const coops = await getCoops();
        const coop = coops.find((item) => item.profile.id === message.payload.coopId);
        if (!coop) {
          sendResponse({ ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse);
          return;
        }
        sendResponse({
          ok: true,
          data: coop.agentIdentity ?? null,
        } satisfies RuntimeActionResponse);
        return;
      }
      case 'get-privacy-identity': {
        const identityRecord = await getPrivacyIdentity(
          db,
          message.payload.coopId,
          message.payload.memberId,
        );
        sendResponse({ ok: true, data: identityRecord ?? null } satisfies RuntimeActionResponse);
        return;
      }
      case 'get-stealth-meta-address': {
        const stealthKp = await getStealthKeyPair(db, message.payload.coopId);
        sendResponse({
          ok: true,
          data: stealthKp?.metaAddress ?? null,
        } satisfies RuntimeActionResponse);
        return;
      }
      case 'get-membership-commitments': {
        const identities = await getPrivacyIdentitiesForCoop(db, message.payload.coopId);
        sendResponse({
          ok: true,
          data: identities.map((id) => id.commitment),
        } satisfies RuntimeActionResponse);
        return;
      }
      default: {
        const _exhaustive: never = message;
        sendResponse({
          ok: false,
          error: `Unknown message type: ${(_exhaustive as RuntimeRequest).type}`,
        } satisfies RuntimeActionResponse);
        return;
      }
    }
  })().catch((error: unknown) => {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    } satisfies RuntimeActionResponse);
  });

  return true;
});
