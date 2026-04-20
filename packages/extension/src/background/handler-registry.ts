import {
  type UiPreferences,
  authSessionToLocalIdentity,
  buildAgentLogExport,
  buildAgentManifest,
  clearSensitiveLocalData,
  getAuthSession,
  getPrivacyIdentitiesForCoop,
  getPrivacyIdentity,
  getStealthKeyPair,
  mergeCoopStateUpdate,
  readAgentFeedbackHistory,
  readAgentReputation,
  setAuthSession,
  setSoundPreferences,
  upsertLocalIdentity,
} from '@coop/shared';
import { listRegisteredSkills } from '../runtime/agent/registry';
import type {
  DashboardResponse,
  ReceiverSyncRuntimeStatus,
  RuntimeActionResponse,
  RuntimeRequest,
} from '../runtime/messages';
import { notifySidepanelIntent } from '../runtime/messages';
import type { CaptureRuntimeMessage } from './runtime-capture-dispatch';

import {
  configuredChain,
  configuredOnchainMode,
  db,
  ensureReceiverSyncOffscreenDocument,
  getCoops,
  getLocalSetting,
  getReceiverSyncRuntime,
  hydrateUiPreferences,
  reportReceiverSyncRuntime,
  saveResolvedUiPreferences,
  setLocalSetting,
  setRuntimeHealth,
  stateKeys,
  syncAgentCadenceAlarm,
  syncCaptureAlarm,
  uiPreferences,
} from './context';

import { listReceiverPairings, selectActiveReceiverPairingsForSync } from '@coop/shared';
import { filterVisibleReceiverPairings } from '../runtime/receiver';
import { consumePendingSidepanelIntent, setPendingSidepanelIntent } from './context';
import { getDashboard, refreshBadge } from './dashboard';
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
  handleQueueGreenGoodsMemberSync,
  handleRejectAction,
  handleRevokePermit,
  handleSetActionPolicy,
} from './handlers/actions';
import {
  ensureOnboardingBurst,
  handleActivateWebLlmProviderPromotion,
  handleApproveAgentPlan,
  handleGetAgentDashboard,
  handleGetWebLlmProviderPromotionState,
  handleListSkillManifests,
  handleQueueGreenGoodsAssessment,
  handleQueueGreenGoodsGapAdminSync,
  handleQueueGreenGoodsWorkApproval,
  handleRejectAgentPlan,
  handleRetrySkillRun,
  handleRunAgentCycle,
  handleSetAgentSkillAutoRun,
} from './handlers/agent';
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
} from './handlers/archive';
import {
  handleCreateCoop,
  handleJoinCoop,
  handleLeaveCoop,
  handleResolveOnchainState,
  handleSetAnchorMode,
  handleUpdateCoopDetails,
} from './handlers/coop';
import {
  handleAddKnowledgeSource,
  handleGetKnowledgeStats,
  handleListKnowledgeSources,
  handleRemoveKnowledgeSource,
  handleToggleKnowledgeSource,
} from './handlers/knowledge-source';
import { handleRefreshKnowledgeSource } from './handlers/knowledge-source-fetch';
import {
  handleProvisionMemberOnchainAccount,
  handleSubmitGreenGoodsWorkSubmission,
} from './handlers/member-account';
import {
  handleArchiveReceiverIntake,
  handleConvertReceiverIntake,
  handleCreateInvite,
  handleCreateReceiverPairing,
  handleEnsureInviteCodes,
  handleIngestReceiverCapture,
  handleRegenerateInviteCode,
  handleRevokeInvite,
  handleRevokeInviteType,
  handleSetActiveReceiverPairing,
  handleSetReceiverIntakeArchiveWorthiness,
} from './handlers/receiver';
import {
  handlePromoteSignalToDraft,
  handlePublishDraft,
  handleUpdateMeetingSettings,
  handleUpdateReviewDraft,
} from './handlers/review';
import {
  handleGetSessionCapabilities,
  handleGetSessionCapabilityLog,
  handleIssueSessionCapability,
  handleRevokeSessionCapability,
  handleRotateSessionCapability,
} from './handlers/session';
import { getActiveReviewContextForSession } from './operator';
import { getPopupSidepanelState, togglePopupSidepanel } from './sidepanel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** All RuntimeRequest types EXCEPT capture types (those are dispatched separately). */
export type RegistryRequest = Exclude<RuntimeRequest, CaptureRuntimeMessage>;

export interface HandlerContext {
  sender: chrome.runtime.MessageSender;
}

/**
 * Background handler pattern:
 *
 * 1. Each handler is `(message, context) => Promise<RuntimeActionResponse>`.
 * 2. `message` is a typed variant of RuntimeRequest, discriminated by `type`.
 * 3. Handlers never throw — catch errors and return `{ ok: false, error }`.
 * 4. Side effects (sounds, badges) are returned in the response — views handle playback.
 * 5. Domain logic lives in `@coop/shared` — handlers orchestrate shared functions + Chrome APIs.
 * 6. New handlers: add the request type to RuntimeRequest, implement the handler,
 *    then register it in the `handlerRegistry` below — the type system enforces exhaustiveness.
 */
type HandlerFn<T extends RegistryRequest['type'] = RegistryRequest['type']> = (
  message: Extract<RegistryRequest, { type: T }>,
  context: HandlerContext,
) => Promise<RuntimeActionResponse>;

/**
 * A fully-typed record that maps every non-capture `RuntimeRequest.type` to its
 * handler function. Adding a new variant to RuntimeRequest without adding it here
 * causes a compile error.
 */
type HandlerRecord = {
  [K in RegistryRequest['type']]: HandlerFn<K>;
};

// ---------------------------------------------------------------------------
// Receiver sync config helper (moved from background.ts)
// ---------------------------------------------------------------------------

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

async function handleRunAutoresearchCycle(
  message: Extract<RegistryRequest, { type: 'run-autoresearch-cycle' }>,
) {
  const { runCycle } = await import('../runtime/agent/experiment-loop');
  const { skillId } = message.payload;
  const config = (await db.autoresearchConfigs.get(skillId)) ?? {
    skillId,
    enabled: true,
    maxExperimentsPerCycle: 5,
    timeBudgetMs: 60000,
    qualityFloor: 0.3,
    updatedAt: Date.now(),
  };
  const summary = await runCycle(db, skillId, config);
  return { ok: true, data: summary };
}

// ---------------------------------------------------------------------------
// Handler registry
// ---------------------------------------------------------------------------

export const handlerRegistry: HandlerRecord = {
  // ---- Auth ----
  'get-auth-session': async () => ({
    ok: true,
    data: await getAuthSession(db),
  }),

  'set-auth-session': async (message) => {
    await setAuthSession(db, message.payload);
    if (message.payload) {
      const identity = authSessionToLocalIdentity(message.payload);
      if (identity) {
        await upsertLocalIdentity(db, identity);
      }
    }
    return { ok: true };
  },

  // ---- Anchor ----
  'set-anchor-mode': async (message) => handleSetAnchorMode(message),

  // ---- Dashboard ----
  'get-dashboard': async (message, { sender }) => {
    if (sender.url?.endsWith('/sidepanel.html')) {
      const coops = await getCoops();
      const authSession = await getAuthSession(db);
      const activeContext = await getActiveReviewContextForSession(coops, authSession);
      if (activeContext.activeCoop?.profile.id && activeContext.activeMemberId) {
        await ensureOnboardingBurst({
          coopId: activeContext.activeCoop.profile.id,
          memberId: activeContext.activeMemberId,
          reason: 'sidepanel-open',
        });
      }
    }
    return {
      ok: true,
      data: await getDashboard(),
    } satisfies RuntimeActionResponse<DashboardResponse>;
  },

  // ---- Sidepanel ----
  'get-sidepanel-state': async (message) => ({
    ok: true,
    data: await getPopupSidepanelState(message.payload.windowId),
  }),

  'toggle-sidepanel': async (message) => ({
    ok: true,
    data: await togglePopupSidepanel(message.payload.windowId),
  }),

  'set-sidepanel-intent': async (message) => {
    await setPendingSidepanelIntent(message.payload);
    await notifySidepanelIntent(message.payload);
    return { ok: true };
  },

  'consume-sidepanel-intent': async () => ({
    ok: true,
    data: await consumePendingSidepanelIntent(),
  }),

  // ---- Receiver sync ----
  'get-receiver-sync-config': async () => {
    await ensureReceiverSyncOffscreenDocument();
    return {
      ok: true,
      data: await getReceiverSyncConfig(),
    } satisfies RuntimeActionResponse<Awaited<ReturnType<typeof getReceiverSyncConfig>>>;
  },

  'get-receiver-sync-runtime': async () =>
    ({
      ok: true,
      data: await getReceiverSyncRuntime(),
    }) satisfies RuntimeActionResponse<ReceiverSyncRuntimeStatus>,

  // ---- Data management ----
  'clear-sensitive-local-data': async () => {
    await clearSensitiveLocalData(db);
    await refreshBadge();
    return { ok: true };
  },

  // ---- Coop CRUD ----
  'create-coop': async (message) => handleCreateCoop(message),
  'resolve-onchain-state': async (message) => handleResolveOnchainState(message),
  'update-coop-details': async (message) => handleUpdateCoopDetails(message),
  'leave-coop': async (message) => handleLeaveCoop(message),
  'join-coop': async (message) => handleJoinCoop(message),

  // ---- Receiver pairing & intake ----
  'create-receiver-pairing': async (message) => handleCreateReceiverPairing(message),
  'convert-receiver-intake': async (message) => handleConvertReceiverIntake(message),
  'archive-receiver-intake': async (message) => handleArchiveReceiverIntake(message),
  'set-receiver-intake-archive-worthy': async (message) =>
    handleSetReceiverIntakeArchiveWorthiness(message),
  'set-active-receiver-pairing': async (message) => handleSetActiveReceiverPairing(message),
  'ingest-receiver-capture': async (message) => handleIngestReceiverCapture(message),

  // ---- Invites ----
  'create-invite': async (message) => handleCreateInvite(message),
  'ensure-invite-codes': async (message) => handleEnsureInviteCodes(message),
  'regenerate-invite-code': async (message) => handleRegenerateInviteCode(message),
  'revoke-invite': async (message) => handleRevokeInvite(message),
  'revoke-invite-type': async (message) => handleRevokeInviteType(message),

  // ---- Member account ----
  'provision-member-onchain-account': async (message) =>
    handleProvisionMemberOnchainAccount(message),
  'submit-green-goods-work-submission': async (message) =>
    handleSubmitGreenGoodsWorkSubmission(message),

  // ---- Review ----
  'publish-draft': async (message) => handlePublishDraft(message),
  'update-review-draft': async (message) => handleUpdateReviewDraft(message),
  'promote-signal-to-draft': async (message) => handlePromoteSignalToDraft(message),
  'update-meeting-settings': async (message) => handleUpdateMeetingSettings(message),

  // ---- Archive ----
  'archive-artifact': async (message) => handleArchiveArtifact(message),
  'set-artifact-archive-worthy': async (message) => handleSetArtifactArchiveWorthiness(message),
  'archive-snapshot': async (message) => handleArchiveSnapshot(message),
  'refresh-archive-status': async (message) => handleRefreshArchiveStatus(message),
  'retrieve-archive-bundle': async (message) => handleRetrieveArchiveBundle(message),
  'provision-archive-space': async (message) => handleProvisionArchiveSpace(message.payload),
  'set-coop-archive-config': async (message) => handleSetCoopArchiveConfig(message.payload),
  'remove-coop-archive-config': async (message) => handleRemoveCoopArchiveConfig(message.payload),
  'anchor-archive-cid': async (message) => handleAnchorArchiveCid(message.payload),
  'fvm-register-archive': async (message) => handleFvmRegistration(message.payload),

  // ---- Knowledge Sources ----
  'add-knowledge-source': async (message) => handleAddKnowledgeSource(message),
  'remove-knowledge-source': async (message) => handleRemoveKnowledgeSource(message),
  'toggle-knowledge-source': async (message) => handleToggleKnowledgeSource(message),
  'list-knowledge-sources': async (message) => handleListKnowledgeSources(message),
  'refresh-knowledge-source': async (message) => handleRefreshKnowledgeSource(message),
  'get-knowledge-stats': async (message) => handleGetKnowledgeStats(message),

  // ---- Autoresearch ----
  'list-autoresearch-configs': async () => {
    const configs: Record<string, import('@coop/shared').AutoresearchConfig> = {};
    const all = await db.autoresearchConfigs.toArray();
    for (const c of all) configs[c.skillId] = c;
    return { ok: true, data: configs };
  },

  'set-autoresearch-config': async (message) => {
    const { skillId, enabled } = message.payload;
    const existing = await db.autoresearchConfigs.get(skillId);
    const config = {
      skillId,
      enabled,
      maxExperimentsPerCycle: existing?.maxExperimentsPerCycle ?? 5,
      timeBudgetMs: existing?.timeBudgetMs ?? 60000,
      qualityFloor: existing?.qualityFloor ?? 0.3,
      updatedAt: Date.now(),
    };
    await db.autoresearchConfigs.put(config);
    return { ok: true };
  },

  'run-autoresearch-cycle': handleRunAutoresearchCycle,

  'list-experiment-records': async () => {
    const records = await db.experimentRecords.orderBy('createdAt').reverse().limit(100).toArray();
    return { ok: true, data: records };
  },

  // ---- Export ----
  'export-snapshot': async (message) => handleExportSnapshot(message),
  'export-artifact': async (message) => handleExportArtifact(message),
  'export-receipt': async (message) => handleExportReceipt(message),

  // ---- Preferences ----
  'set-sound-preferences': async (message) => {
    await setSoundPreferences(db, message.payload);
    return { ok: true };
  },

  'get-ui-preferences': async () =>
    ({
      ok: true,
      data: await hydrateUiPreferences(),
    }) satisfies RuntimeActionResponse<UiPreferences>,

  'set-ui-preferences': async (message) => {
    const nextPreferences = await saveResolvedUiPreferences(message.payload);
    await syncAgentCadenceAlarm(nextPreferences.agentCadenceMinutes);
    return {
      ok: true,
      data: nextPreferences,
    } satisfies RuntimeActionResponse<UiPreferences>;
  },

  'set-capture-mode': async (message) => {
    await setLocalSetting(stateKeys.captureMode, message.payload.captureMode);
    await syncCaptureAlarm(message.payload.captureMode);
    await refreshBadge();
    return { ok: true };
  },

  'set-active-coop': async (message) => {
    await setLocalSetting(stateKeys.activeCoopId, message.payload.coopId);
    await refreshBadge();
    return { ok: true };
  },

  // ---- Coop state sync ----
  'persist-coop-state': async (message) => {
    try {
      const merged = await mergeCoopStateUpdate(
        db,
        message.payload.coopId,
        message.payload.docUpdate,
      );
      await refreshBadge();
      // Transient Zod validation warnings are not fatal — the CRDT merge
      // was persisted successfully and will self-heal as sync converges.
      const warning = (merged as { _validationWarning?: string })._validationWarning;
      if (warning) {
        console.warn('persist-coop-state: transient validation warning:', warning);
      }
      return { ok: true };
    } catch (error) {
      console.warn('persist-coop-state failed:', error);
      return { ok: false, error: 'Invalid coop state' };
    }
  },

  'report-sync-health': async (message) => {
    await setRuntimeHealth({
      syncError: message.payload.syncError,
      lastSyncError: message.payload.note,
    });
    await refreshBadge();
    return { ok: true };
  },

  'report-receiver-sync-runtime': async (message) =>
    ({
      ok: true,
      data: await reportReceiverSyncRuntime(message.payload),
    }) satisfies RuntimeActionResponse<ReceiverSyncRuntimeStatus>,

  'set-local-inference-opt-in': async (message) => ({
    ok: true,
    data: await saveResolvedUiPreferences({
      ...uiPreferences,
      localInferenceOptIn: message.payload.enabled,
    }),
  }),

  // ---- Green Goods ----
  'queue-green-goods-work-approval': async (message) => handleQueueGreenGoodsWorkApproval(message),
  'queue-green-goods-assessment': async (message) => handleQueueGreenGoodsAssessment(message),
  'queue-green-goods-gap-admin-sync': async (message) => handleQueueGreenGoodsGapAdminSync(message),
  'queue-green-goods-member-sync': async (message) => handleQueueGreenGoodsMemberSync(message),

  // ---- Agent ----
  'get-agent-dashboard': async () => handleGetAgentDashboard(),
  'run-agent-cycle': async () => handleRunAgentCycle(),
  'get-webllm-provider-promotion-state': async () => handleGetWebLlmProviderPromotionState(),
  'activate-webllm-provider-promotion': async () => handleActivateWebLlmProviderPromotion(),
  'approve-agent-plan': async (message) => handleApproveAgentPlan(message),
  'reject-agent-plan': async (message) => handleRejectAgentPlan(message),
  'retry-skill-run': async (message) => handleRetrySkillRun(message),
  'list-skill-manifests': async () => handleListSkillManifests(),
  'set-agent-skill-auto-run': async (message) => handleSetAgentSkillAutoRun(message),

  // ---- Actions & policies ----
  'get-action-policies': async () => handleGetActionPolicies(),
  'set-action-policy': async (message) => handleSetActionPolicy(message),
  'propose-action': async (message) => handleProposeAction(message),
  'approve-action': async (message) => handleApproveAction(message),
  'reject-action': async (message) => handleRejectAction(message),
  'execute-action': async (message) => handleExecuteAction(message),
  'get-action-queue': async () => handleGetActionQueue(),
  'get-action-history': async () => handleGetActionHistory(),

  // ---- Permits ----
  'issue-permit': async (message) => handleIssuePermit(message),
  'revoke-permit': async (message) => handleRevokePermit(message),
  'execute-with-permit': async (message) => handleExecuteWithPermit(message),
  'get-permits': async () => handleGetPermits(),
  'get-permit-log': async () => handleGetPermitLog(),

  // ---- Session capabilities ----
  'issue-session-capability': async (message) => handleIssueSessionCapability(message),
  'rotate-session-capability': async (message) => handleRotateSessionCapability(message),
  'revoke-session-capability': async (message) => handleRevokeSessionCapability(message),
  'get-session-capabilities': async () => handleGetSessionCapabilities(),
  'get-session-capability-log': async () => handleGetSessionCapabilityLog(),

  // ---- Agent manifest & log ----
  'export-agent-manifest': async (message) => {
    const coops = await getCoops();
    const coop = coops.find((item) => item.profile.id === message.payload.coopId);
    if (!coop) {
      return { ok: false, error: 'Coop not found.' };
    }
    const skillEntries = listRegisteredSkills();
    const manifest = buildAgentManifest({
      coop,
      skills: skillEntries.map((e) => e.manifest.id),
      agentId: coop.agentIdentity?.agentId,
    });
    return { ok: true, data: manifest };
  },

  'export-agent-log': async (message) => {
    const coops = await getCoops();
    const coop = coops.find((item) => item.profile.id === message.payload.coopId);
    if (!coop) {
      return { ok: false, error: 'Coop not found.' };
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
    return { ok: true, data: agentLog };
  },

  // ---- Agent identity & reputation ----
  'get-agent-identity': async (message) => {
    const coops = await getCoops();
    const coop = coops.find((item) => item.profile.id === message.payload.coopId);
    if (!coop) {
      return { ok: false, error: 'Coop not found.' };
    }
    return { ok: true, data: coop.agentIdentity ?? null };
  },

  'get-agent-reputation': async (message) => {
    const reputation = await readAgentReputation({
      mode: configuredOnchainMode,
      chainKey: configuredChain,
      agentId: message.payload.agentId,
    });
    return { ok: true, data: reputation };
  },

  'get-agent-feedback-history': async (message) => {
    const history = await readAgentFeedbackHistory({
      mode: configuredOnchainMode,
      chainKey: configuredChain,
      agentId: message.payload.agentId,
    });
    return { ok: true, data: history };
  },

  // ---- Privacy & stealth ----
  'get-privacy-identity': async (message) => {
    const identityRecord = await getPrivacyIdentity(
      db,
      message.payload.coopId,
      message.payload.memberId,
    );
    return { ok: true, data: identityRecord ?? null };
  },

  'get-stealth-meta-address': async (message) => {
    const stealthKp = await getStealthKeyPair(db, message.payload.coopId);
    return { ok: true, data: stealthKp?.metaAddress ?? null };
  },

  'get-membership-commitments': async (message) => {
    const identities = await getPrivacyIdentitiesForCoop(db, message.payload.coopId);
    return { ok: true, data: identities.map((id) => id.commitment) };
  },
};

// ---------------------------------------------------------------------------
// Dispatch helper
// ---------------------------------------------------------------------------

/**
 * Look up and invoke the handler for a non-capture RuntimeRequest.
 * Returns the response, or `null` if the message type is not in the registry.
 */
export function dispatchRegistryMessage(
  message: RegistryRequest,
  context: HandlerContext,
): Promise<RuntimeActionResponse> {
  const handler = handlerRegistry[message.type] as HandlerFn<typeof message.type> | undefined;
  if (!handler) {
    // Exhaustiveness is enforced at the type level via HandlerRecord,
    // so this branch should be unreachable at runtime.
    return Promise.resolve({
      ok: false,
      error: `Unknown message type: ${(message as RuntimeRequest).type}`,
    });
  }
  return (handler as HandlerFn<typeof message.type>)(message as never, context);
}
