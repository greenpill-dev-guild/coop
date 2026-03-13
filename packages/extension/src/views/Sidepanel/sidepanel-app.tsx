import {
  type AuthSession,
  type CoopSharedState,
  type InviteCode,
  type ReceiverCapture,
  type ReceiverPairingRecord,
  type ReviewDraft,
  type SoundPreferences,
  artifactCategorySchema,
  buildCoopArchiveStory,
  buildCoopBoardDeepLink,
  buildMeetingModeSections,
  connectSyncProviders,
  createCoopBoardSnapshot,
  createCoopDoc,
  createPasskeySession,
  defaultSoundPreferences,
  describeArchiveReceipt,
  describeOnchainModeSummary,
  getCoopChainLabel,
  getReceiverPairingStatus,
  hashJson,
  isArchiveReceiptRefreshable,
  isArchiveWorthy,
  readCoopState,
  sessionToMember,
  summarizeSyncTransportHealth,
  withArchiveWorthiness,
  writeCoopState,
} from '@coop/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { playCoopSound } from '../../runtime/audio';
import {
  parseConfiguredSignalingUrls,
  resolveConfiguredChain,
  resolveConfiguredOnchainMode,
  resolveReceiverAppUrl,
} from '../../runtime/config';
import { type DashboardResponse, sendRuntimeMessage } from '../../runtime/messages';
import {
  filterPrivateReceiverIntake,
  filterVisibleReceiverPairings,
  filterVisibleReviewDrafts,
  isReceiverPairingVisibleForMemberContext,
  resolveReceiverPairingMember,
} from '../../runtime/receiver';
import { OperatorConsole } from './operator-console';
import { type CreateFormState, initialCreateForm, toSetupInsights } from './setup-insights';

const tabs = ['Loose Chickens', 'Roost', 'Coops', 'Feed', 'Meeting Mode', 'Settings'] as const;
type PanelTab = (typeof tabs)[number];

type SyncBinding = {
  doc: ReturnType<typeof createCoopDoc>;
  disconnect: () => void;
  lastHash: string;
  healthTimer?: number;
  timer?: number;
};

const configuredChain = resolveConfiguredChain(import.meta.env.VITE_COOP_CHAIN);
const configuredOnchainMode = resolveConfiguredOnchainMode(
  import.meta.env.VITE_COOP_ONCHAIN_MODE,
  import.meta.env.VITE_PIMLICO_API_KEY,
);
const configuredSignalingUrls = parseConfiguredSignalingUrls(
  import.meta.env.VITE_COOP_SIGNALING_URLS,
);
const configuredReceiverAppUrl = resolveReceiverAppUrl(import.meta.env.VITE_COOP_RECEIVER_APP_URL);
const configuredOnchainSummary = describeOnchainModeSummary({
  mode: configuredOnchainMode,
  chainKey: configuredChain,
});

async function downloadText(filename: string, value: string) {
  const url = URL.createObjectURL(new Blob([value], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SidepanelApp() {
  const [panelTab, setPanelTab] = useState<PanelTab>('Coops');
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [createForm, setCreateForm] = useState<CreateFormState>(initialCreateForm);
  const [joinInvite, setJoinInvite] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinSeed, setJoinSeed] = useState('');
  const [inviteResult, setInviteResult] = useState<InviteCode | null>(null);
  const [pairingResult, setPairingResult] = useState<ReceiverPairingRecord | null>(null);
  const [message, setMessage] = useState('');
  const [draftEdits, setDraftEdits] = useState<Record<string, ReviewDraft>>({});
  const [meetingSettings, setMeetingSettings] = useState({
    weeklyReviewCadence: '',
    facilitatorExpectation: '',
    defaultCapturePosture: '',
  });
  const syncBindings = useRef<Map<string, SyncBinding>>(new Map());

  const activeCoop = useMemo(
    () =>
      dashboard?.coops.find((coop) => coop.profile.id === dashboard.activeCoopId) ??
      dashboard?.coops[0],
    [dashboard],
  );
  const soundPreferences = dashboard?.soundPreferences ?? defaultSoundPreferences;
  const authSession = dashboard?.authSession ?? null;
  const activeMember = useMemo(
    () => resolveReceiverPairingMember(activeCoop, authSession),
    [activeCoop, authSession],
  );
  const visibleReceiverPairings = useMemo(
    () =>
      filterVisibleReceiverPairings(
        dashboard?.receiverPairings ?? [],
        activeCoop?.profile.id,
        activeMember?.id,
      ),
    [activeCoop?.profile.id, activeMember?.id, dashboard?.receiverPairings],
  );
  const activeReceiverPairing = useMemo(() => {
    if (
      pairingResult &&
      isReceiverPairingVisibleForMemberContext(
        pairingResult,
        activeCoop?.profile.id,
        activeMember?.id,
      )
    ) {
      return pairingResult;
    }

    return (
      visibleReceiverPairings.find((pairing) => pairing.active) ??
      visibleReceiverPairings[0] ??
      null
    );
  }, [activeCoop?.profile.id, activeMember?.id, pairingResult, visibleReceiverPairings]);
  const activeReceiverPairingStatus = activeReceiverPairing
    ? getReceiverPairingStatus(activeReceiverPairing)
    : null;
  const receiverIntake = filterPrivateReceiverIntake(
    dashboard?.receiverIntake ?? [],
    activeCoop?.profile.id,
    activeMember?.id,
  );
  const visibleDrafts = useMemo(
    () =>
      filterVisibleReviewDrafts(dashboard?.drafts ?? [], activeCoop?.profile.id, activeMember?.id),
    [activeCoop?.profile.id, activeMember?.id, dashboard?.drafts],
  );
  const meetingMode = useMemo(
    () =>
      buildMeetingModeSections({
        captures: dashboard?.receiverIntake ?? [],
        drafts: visibleDrafts,
        coopId: activeCoop?.profile.id,
        memberId: activeMember?.id,
      }),
    [activeCoop?.profile.id, activeMember?.id, dashboard?.receiverIntake, visibleDrafts],
  );
  const archiveStory = useMemo(
    () => (activeCoop ? buildCoopArchiveStory(activeCoop) : null),
    [activeCoop],
  );
  const archiveReceipts = useMemo(
    () =>
      activeCoop
        ? [...activeCoop.archiveReceipts]
            .reverse()
            .map((receipt) => describeArchiveReceipt({ receipt, state: activeCoop }))
        : [],
    [activeCoop],
  );
  const refreshableArchiveReceipts = useMemo(
    () =>
      activeCoop
        ? activeCoop.archiveReceipts.filter((receipt) => isArchiveReceiptRefreshable(receipt))
        : [],
    [activeCoop],
  );
  const boardSnapshot = useMemo(
    () =>
      activeCoop
        ? createCoopBoardSnapshot({
            state: activeCoop,
            receiverCaptures: dashboard?.receiverIntake ?? [],
            drafts: dashboard?.drafts ?? [],
            activeMemberId: activeMember?.id,
            activeMemberDisplayName: activeMember?.displayName,
          })
        : null,
    [
      activeCoop,
      activeMember?.displayName,
      activeMember?.id,
      dashboard?.drafts,
      dashboard?.receiverIntake,
    ],
  );
  const boardUrl = useMemo(
    () =>
      boardSnapshot ? buildCoopBoardDeepLink(configuredReceiverAppUrl, boardSnapshot) : undefined,
    [boardSnapshot],
  );

  const loadDashboard = useCallback(async () => {
    const response = await sendRuntimeMessage<DashboardResponse>({ type: 'get-dashboard' });
    if (response.ok && response.data) {
      setDashboard(response.data);
    } else if (response.error) {
      setMessage(response.error);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
    const interval = window.setInterval(() => void loadDashboard(), 3500);
    return () => window.clearInterval(interval);
  }, [loadDashboard]);

  useEffect(() => {
    const ritual = activeCoop?.rituals[0];
    if (!ritual) {
      return;
    }

    setMeetingSettings({
      weeklyReviewCadence: ritual.weeklyReviewCadence,
      facilitatorExpectation: ritual.facilitatorExpectation,
      defaultCapturePosture: ritual.defaultCapturePosture,
    });
  }, [activeCoop?.rituals]);

  useEffect(() => {
    if (
      pairingResult &&
      !isReceiverPairingVisibleForMemberContext(
        pairingResult,
        activeCoop?.profile.id,
        activeMember?.id,
      )
    ) {
      setPairingResult(null);
    }
  }, [activeCoop?.profile.id, activeMember?.id, pairingResult]);

  useEffect(() => {
    return () => {
      for (const binding of syncBindings.current.values()) {
        binding.disconnect();
      }
      syncBindings.current.clear();
    };
  }, []);

  useEffect(() => {
    const nextIds = new Set(dashboard?.coops.map((coop) => coop.profile.id) ?? []);

    for (const [coopId, binding] of syncBindings.current.entries()) {
      if (!nextIds.has(coopId)) {
        binding.disconnect();
        syncBindings.current.delete(coopId);
      }
    }

    for (const coop of dashboard?.coops ?? []) {
      const nextHash = hashJson(coop);
      const existing = syncBindings.current.get(coop.profile.id);

      if (!existing) {
        const doc = createCoopDoc(coop);
        const providers = connectSyncProviders(doc, coop.syncRoom);
        const binding: SyncBinding = {
          doc,
          lastHash: nextHash,
          disconnect() {
            if (binding.timer) {
              window.clearTimeout(binding.timer);
            }
            if (binding.healthTimer) {
              window.clearTimeout(binding.healthTimer);
            }
            disposeSyncHealth?.();
            doc.off('update', onDocUpdate);
            providers.disconnect();
          },
        };

        const reportSyncHealth = async () => {
          const health = summarizeSyncTransportHealth(providers.webrtc);
          await sendRuntimeMessage({
            type: 'report-sync-health',
            payload: {
              syncError: health.syncError,
              note: health.note,
            },
          });
        };

        const scheduleSyncHealthReport = (delay = 0) => {
          if (binding.healthTimer) {
            window.clearTimeout(binding.healthTimer);
          }
          binding.healthTimer = window.setTimeout(() => {
            void reportSyncHealth();
          }, delay);
        };

        let disposeSyncHealth: (() => void) | undefined;

        if (providers.webrtc) {
          const provider = providers.webrtc;
          const onProviderSignal = () => scheduleSyncHealthReport();
          const onProviderDisconnect = () => scheduleSyncHealthReport(1200);

          provider.on('status', onProviderSignal);
          provider.on('synced', onProviderSignal);
          provider.on('peers', onProviderSignal);

          const signalingConnections = provider.signalingConns as Array<{
            on(event: 'connect' | 'disconnect', listener: () => void): void;
            off(event: 'connect' | 'disconnect', listener: () => void): void;
          }>;

          for (const connection of signalingConnections) {
            connection.on('connect', onProviderSignal);
            connection.on('disconnect', onProviderDisconnect);
          }

          scheduleSyncHealthReport(2500);
          disposeSyncHealth = () => {
            provider.off('status', onProviderSignal);
            provider.off('synced', onProviderSignal);
            provider.off('peers', onProviderSignal);
            for (const connection of signalingConnections) {
              connection.off('connect', onProviderSignal);
              connection.off('disconnect', onProviderDisconnect);
            }
          };
        } else {
          void reportSyncHealth();
        }

        const onDocUpdate = () => {
          if (binding.timer) {
            window.clearTimeout(binding.timer);
          }
          binding.timer = window.setTimeout(async () => {
            const nextState = readCoopState(doc);
            const remoteHash = hashJson(nextState);
            if (remoteHash === binding.lastHash) {
              return;
            }
            binding.lastHash = remoteHash;
            const persist = await sendRuntimeMessage({
              type: 'persist-coop-state',
              payload: { state: nextState },
            });
            if (!persist.ok) {
              await sendRuntimeMessage({
                type: 'report-sync-health',
                payload: {
                  syncError: true,
                  note: persist.error ?? 'Could not persist synced coop state.',
                },
              });
              return;
            }
            await reportSyncHealth();
            await loadDashboard();
          }, 280);
        };

        doc.on('update', onDocUpdate);
        syncBindings.current.set(coop.profile.id, binding);
        continue;
      }

      if (existing.lastHash !== nextHash) {
        existing.lastHash = nextHash;
        writeCoopState(existing.doc, coop);
      }
    }
  }, [dashboard?.coops, loadDashboard]);

  async function ensureAuthSession(displayName: string) {
    const response = await sendRuntimeMessage<AuthSession | null>({ type: 'get-auth-session' });
    if (!response.ok) {
      throw new Error(response.error ?? 'Could not load the passkey session.');
    }

    const session = await createPasskeySession({
      displayName,
      credential: response.data?.passkey,
      rpId: response.data?.passkey?.rpId,
    });
    const persist = await sendRuntimeMessage({
      type: 'set-auth-session',
      payload: session,
    });
    if (!persist.ok) {
      throw new Error(persist.error ?? 'Could not persist the passkey session.');
    }
    await loadDashboard();
    return session;
  }

  async function resolveOnchainState(coopSeed: string) {
    const response = await sendRuntimeMessage({
      type: 'resolve-onchain-state',
      payload: { coopSeed },
    });
    if (!response.ok || !response.data) {
      throw new Error(response.error ?? 'Could not resolve the onchain state.');
    }
    return response.data;
  }

  async function createCoopAction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const session = await ensureAuthSession(createForm.creatorDisplayName);
      const creator = sessionToMember(session, createForm.creatorDisplayName, 'creator');
      const coopSeed = [
        createForm.coopName.trim(),
        createForm.creatorDisplayName.trim(),
        session.primaryAddress,
        globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
      ].join(':');
      const onchainState = await resolveOnchainState(coopSeed);
      const response = await sendRuntimeMessage({
        type: 'create-coop',
        payload: {
          coopName: createForm.coopName,
          purpose: createForm.purpose,
          creatorDisplayName: createForm.creatorDisplayName,
          captureMode: createForm.captureMode,
          seedContribution: createForm.seedContribution,
          setupInsights: toSetupInsights(createForm),
          signalingUrls: configuredSignalingUrls,
          creator,
          onchainState,
        },
      });
      if (!response.ok) {
        setMessage(response.error ?? 'Unable to create coop.');
        return;
      }
      if (response.soundEvent) {
        await playCoopSound(response.soundEvent, soundPreferences);
      }
      setMessage(`Coop created. ${onchainState.statusNote} Initial artifacts are ready.`);
      setCreateForm(initialCreateForm);
      setPanelTab('Feed');
      await loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create coop.');
    }
  }

  async function runManualCapture() {
    const response = await sendRuntimeMessage<number>({ type: 'manual-capture' });
    setMessage(
      response.ok
        ? `Manual round-up completed. ${response.data ?? 0} tabs were inspected locally.`
        : (response.error ?? 'Manual round-up failed.'),
    );
    setPanelTab('Roost');
    await loadDashboard();
  }

  async function createInvite(inviteType: 'trusted' | 'member') {
    if (!activeCoop) {
      return;
    }
    const creator = activeCoop.members[0]?.id;
    const response = await sendRuntimeMessage<InviteCode>({
      type: 'create-invite',
      payload: {
        coopId: activeCoop.profile.id,
        inviteType,
        createdBy: creator,
      },
    });
    if (!response.ok || !response.data) {
      setMessage(response.error ?? 'Invite creation failed.');
      return;
    }
    setInviteResult(response.data);
    setMessage(`${inviteType === 'trusted' ? 'Trusted' : 'Member'} invite generated.`);
    await loadDashboard();
  }

  async function createReceiverPairing() {
    if (!activeCoop || !activeMember) {
      setMessage(
        'Pairing requires the current member session for this coop. Open the coop as that member first.',
      );
      return;
    }

    const response = await sendRuntimeMessage<ReceiverPairingRecord>({
      type: 'create-receiver-pairing',
      payload: {
        coopId: activeCoop.profile.id,
        memberId: activeMember.id,
      },
    });
    if (!response.ok || !response.data) {
      setMessage(response.error ?? 'Receiver pairing failed.');
      return;
    }

    setPairingResult(response.data);
    setMessage('Receiver pairing payload generated.');
    await loadDashboard();
  }

  async function selectReceiverPairing(pairingId: string) {
    const response = await sendRuntimeMessage({
      type: 'set-active-receiver-pairing',
      payload: {
        pairingId,
      },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not switch receiver pairing.');
      return;
    }

    setPairingResult(
      dashboard?.receiverPairings.find((pairing) => pairing.pairingId === pairingId) ?? null,
    );
    await loadDashboard();
  }

  async function selectActiveCoop(coopId: string) {
    const response = await sendRuntimeMessage({
      type: 'set-active-coop',
      payload: { coopId },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not switch coops.');
      return;
    }
    await loadDashboard();
  }

  async function joinCoopAction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const session = await ensureAuthSession(joinName);
      const member = sessionToMember(session, joinName, 'member');
      const response = await sendRuntimeMessage({
        type: 'join-coop',
        payload: {
          inviteCode: joinInvite,
          displayName: joinName,
          seedContribution: joinSeed,
          member,
        },
      });
      if (!response.ok) {
        setMessage(response.error ?? 'Join failed.');
        return;
      }
      setMessage('Member joined and seed contribution published.');
      setJoinInvite('');
      setJoinName('');
      setJoinSeed('');
      await loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Join failed.');
    }
  }

  function draftValue(draft: ReviewDraft) {
    return draftEdits[draft.id] ?? draft;
  }

  function updateDraft(draft: ReviewDraft, patch: Partial<ReviewDraft>) {
    setDraftEdits((current) => ({
      ...current,
      [draft.id]: {
        ...draftValue(draft),
        ...patch,
      },
    }));
  }

  function toggleDraftTargetCoop(draft: ReviewDraft, coopId: string) {
    const currentTargets = draftValue(draft).suggestedTargetCoopIds;
    const nextTargets = currentTargets.includes(coopId)
      ? currentTargets.filter((target) => target !== coopId)
      : [...currentTargets, coopId];

    if (nextTargets.length === 0) {
      setMessage('Keep at least one coop selected for this draft.');
      return;
    }

    updateDraft(draft, {
      suggestedTargetCoopIds: nextTargets,
    });
  }

  async function saveDraft(draft: ReviewDraft, workflowStage = draftValue(draft).workflowStage) {
    const editedDraft = {
      ...draftValue(draft),
      workflowStage,
    };
    const response = await sendRuntimeMessage<ReviewDraft>({
      type: 'update-review-draft',
      payload: {
        draft: editedDraft,
      },
    });
    if (!response.ok || !response.data) {
      setMessage(response.error ?? 'Could not save the draft.');
      return null;
    }

    setDraftEdits((current) => ({
      ...current,
      [draft.id]: response.data,
    }));
    await loadDashboard();
    return response.data;
  }

  async function changeDraftWorkflowStage(
    draft: ReviewDraft,
    workflowStage: 'candidate' | 'ready',
  ) {
    const savedDraft = await saveDraft(draft, workflowStage);
    if (!savedDraft) {
      return;
    }

    setMessage(
      workflowStage === 'ready'
        ? 'Draft moved into the ready-to-publish lane.'
        : 'Draft moved back into candidate review.',
    );
  }

  async function convertReceiverCapture(
    capture: ReceiverCapture,
    workflowStage: 'candidate' | 'ready',
  ) {
    const response = await sendRuntimeMessage<ReviewDraft>({
      type: 'convert-receiver-intake',
      payload: {
        captureId: capture.id,
        workflowStage,
        targetCoopId: activeCoop?.profile.id,
      },
    });
    if (!response.ok || !response.data) {
      setMessage(response.error ?? 'Could not convert receiver intake.');
      return;
    }

    setDraftEdits((current) => ({
      ...current,
      [response.data.id]: response.data,
    }));
    setMessage(
      workflowStage === 'ready'
        ? 'Receiver intake moved into an editable draft.'
        : 'Receiver intake moved into candidate review.',
    );
    setPanelTab(workflowStage === 'ready' ? 'Roost' : 'Meeting Mode');
    await loadDashboard();
  }

  async function archiveReceiverCapture(captureId: string) {
    const response = await sendRuntimeMessage({
      type: 'archive-receiver-intake',
      payload: { captureId },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not archive this intake item.');
      return;
    }
    setMessage('Receiver intake archived locally.');
    await loadDashboard();
  }

  async function toggleReceiverCaptureArchiveWorthiness(capture: ReceiverCapture) {
    const response = await sendRuntimeMessage<ReceiverCapture>({
      type: 'set-receiver-intake-archive-worthy',
      payload: {
        captureId: capture.id,
        archiveWorthy: !isArchiveWorthy(capture),
      },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update archive-worthy status.');
      return;
    }
    setMessage(
      !isArchiveWorthy(capture)
        ? 'Receiver intake marked archive-worthy.'
        : 'Receiver intake removed from archive-worthy.',
    );
    await loadDashboard();
  }

  async function publishDraft(draft: ReviewDraft) {
    const editedDraft = draftValue(draft);
    const response = await sendRuntimeMessage({
      type: 'publish-draft',
      payload: {
        draft: editedDraft,
        targetCoopIds: editedDraft.suggestedTargetCoopIds,
      },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Publish failed.');
      return;
    }
    if (response.soundEvent) {
      await playCoopSound(response.soundEvent, soundPreferences);
    }
    setMessage('Draft pushed into shared coop memory.');
    setDraftEdits((current) => {
      const next = { ...current };
      delete next[draft.id];
      return next;
    });
    await loadDashboard();
  }

  async function toggleDraftArchiveWorthiness(draft: ReviewDraft) {
    const editedDraft = withArchiveWorthiness(
      draftValue(draft),
      !isArchiveWorthy(draftValue(draft)),
    );
    const response = await sendRuntimeMessage<ReviewDraft>({
      type: 'update-review-draft',
      payload: {
        draft: editedDraft,
      },
    });
    if (!response.ok || !response.data) {
      setMessage(response.error ?? 'Could not update archive-worthy status.');
      return;
    }
    setDraftEdits((current) => ({
      ...current,
      [draft.id]: response.data,
    }));
    setMessage(
      isArchiveWorthy(response.data)
        ? 'Draft marked archive-worthy.'
        : 'Draft removed from archive-worthy.',
    );
    await loadDashboard();
  }

  async function archiveArtifact(artifactId: string) {
    if (!activeCoop) {
      return;
    }
    const response = await sendRuntimeMessage({
      type: 'archive-artifact',
      payload: {
        coopId: activeCoop.profile.id,
        artifactId,
      },
    });
    setMessage(
      response.ok ? 'Archive receipt created and stored.' : (response.error ?? 'Archive failed.'),
    );
    await loadDashboard();
  }

  async function toggleArtifactArchiveWorthiness(artifactId: string, flagged: boolean) {
    if (!activeCoop) {
      return;
    }
    const response = await sendRuntimeMessage({
      type: 'set-artifact-archive-worthy',
      payload: {
        coopId: activeCoop.profile.id,
        artifactId,
        archiveWorthy: flagged,
      },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update archive-worthy status.');
      return;
    }
    setMessage(
      flagged ? 'Artifact marked archive-worthy.' : 'Artifact removed from archive-worthy.',
    );
    await loadDashboard();
  }

  async function archiveLatestArtifact() {
    if (!activeCoop || activeCoop.artifacts.length === 0) {
      return;
    }
    const latest = [...activeCoop.artifacts].reverse()[0];
    if (!latest) {
      return;
    }
    await archiveArtifact(latest.id);
  }

  async function archiveSnapshot() {
    if (!activeCoop) {
      return;
    }
    const response = await sendRuntimeMessage({
      type: 'archive-snapshot',
      payload: {
        coopId: activeCoop.profile.id,
      },
    });
    setMessage(
      response.ok
        ? 'Snapshot archive receipt created and stored.'
        : (response.error ?? 'Snapshot archive failed.'),
    );
    await loadDashboard();
  }

  async function toggleAnchorMode(enabled: boolean) {
    const response = await sendRuntimeMessage({
      type: 'set-anchor-mode',
      payload: { enabled },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update anchor mode.');
      return;
    }
    setMessage(enabled ? 'Anchor mode enabled for this node.' : 'Anchor mode disabled.');
    await loadDashboard();
  }

  async function refreshArchiveStatus(receiptId?: string) {
    if (!activeCoop) {
      return;
    }

    const response = await sendRuntimeMessage<{
      checked: number;
      updated: number;
      failed: number;
      message: string;
    }>({
      type: 'refresh-archive-status',
      payload: {
        coopId: activeCoop.profile.id,
        receiptId,
      },
    });
    setMessage(
      response.ok
        ? (response.data?.message ?? 'Archive follow-up refresh completed.')
        : (response.error ?? 'Archive follow-up refresh failed.'),
    );
    await loadDashboard();
  }

  async function exportSnapshot(format: 'json' | 'text') {
    if (!activeCoop) {
      return;
    }
    const response = await sendRuntimeMessage<string>({
      type: 'export-snapshot',
      payload: {
        coopId: activeCoop.profile.id,
        format,
      },
    });
    if (!response.ok || !response.data) {
      setMessage(response.error ?? 'Export failed.');
      return;
    }
    await downloadText(
      `${activeCoop.profile.name}-snapshot.${format === 'json' ? 'json' : 'txt'}`,
      response.data,
    );
    setMessage(`Snapshot exported as ${format.toUpperCase()}.`);
  }

  async function exportLatestArtifact(format: 'json' | 'text') {
    if (!activeCoop || activeCoop.artifacts.length === 0) {
      return;
    }
    const latest = [...activeCoop.artifacts].reverse()[0];
    if (!latest) {
      return;
    }
    const response = await sendRuntimeMessage<string>({
      type: 'export-artifact',
      payload: {
        coopId: activeCoop.profile.id,
        artifactId: latest.id,
        format,
      },
    });
    if (!response.ok || !response.data) {
      setMessage(response.error ?? 'Artifact export failed.');
      return;
    }
    await downloadText(
      `${activeCoop.profile.name}-artifact.${format === 'json' ? 'json' : 'txt'}`,
      response.data,
    );
    setMessage(`Latest artifact exported as ${format.toUpperCase()}.`);
  }

  async function exportLatestReceipt(format: 'json' | 'text') {
    if (!activeCoop || activeCoop.archiveReceipts.length === 0) {
      return;
    }
    const latest = [...activeCoop.archiveReceipts].reverse()[0];
    if (!latest) {
      return;
    }
    const response = await sendRuntimeMessage<string>({
      type: 'export-receipt',
      payload: {
        coopId: activeCoop.profile.id,
        receiptId: latest.id,
        format,
      },
    });
    if (!response.ok || !response.data) {
      setMessage(response.error ?? 'Archive receipt export failed.');
      return;
    }
    await downloadText(
      `${activeCoop.profile.name}-archive-receipt.${format === 'json' ? 'json' : 'txt'}`,
      response.data,
    );
    setMessage(`Latest archive receipt exported as ${format.toUpperCase()}.`);
  }

  async function updateSound(next: SoundPreferences) {
    const response = await sendRuntimeMessage({
      type: 'set-sound-preferences',
      payload: next,
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update sound settings.');
      return;
    }
    await loadDashboard();
  }

  async function updateCaptureMode(captureMode: CaptureMode) {
    const response = await sendRuntimeMessage({
      type: 'set-capture-mode',
      payload: { captureMode },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update capture mode.');
      return;
    }
    setMessage(`Capture cadence updated to ${captureMode}.`);
    await loadDashboard();
  }

  async function saveMeetingSettingsAction() {
    if (!activeCoop) {
      return;
    }

    const response = await sendRuntimeMessage({
      type: 'update-meeting-settings',
      payload: {
        coopId: activeCoop.profile.id,
        weeklyReviewCadence: meetingSettings.weeklyReviewCadence,
        facilitatorExpectation: meetingSettings.facilitatorExpectation,
        defaultCapturePosture: meetingSettings.defaultCapturePosture,
      },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not save meeting settings.');
      return;
    }
    setMessage('Meeting settings updated.');
    await loadDashboard();
  }

  async function testSound() {
    await playCoopSound('sound-test', soundPreferences);
    setMessage('Sound test played.');
  }

  function renderDraftCard(draft: ReviewDraft, context: 'roost' | 'meeting') {
    const value = draftValue(draft);

    return (
      <article className="draft-card stack" key={draft.id}>
        <div className="badge-row">
          <span className="badge">{value.workflowStage === 'ready' ? 'ready' : 'candidate'}</span>
          <span className="badge">{value.category}</span>
          {value.provenance.type === 'receiver' ? <span className="badge">receiver</span> : null}
          {isArchiveWorthy(value) ? <span className="badge">archive-worthy</span> : null}
        </div>
        <div className="field-grid">
          <label htmlFor={`title-${draft.id}`}>Title</label>
          <input
            id={`title-${draft.id}`}
            onChange={(event) => updateDraft(draft, { title: event.target.value })}
            value={value.title}
          />
        </div>
        <div className="field-grid">
          <label htmlFor={`summary-${draft.id}`}>Summary</label>
          <textarea
            id={`summary-${draft.id}`}
            onChange={(event) => updateDraft(draft, { summary: event.target.value })}
            value={value.summary}
          />
        </div>
        <div className="detail-grid">
          <div className="field-grid">
            <label htmlFor={`category-${draft.id}`}>Category</label>
            <select
              id={`category-${draft.id}`}
              onChange={(event) =>
                updateDraft(draft, { category: event.target.value as ReviewDraft['category'] })
              }
              value={value.category}
            >
              {artifactCategorySchema.options.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div className="field-grid">
            <label htmlFor={`tags-${draft.id}`}>Tags</label>
            <input
              id={`tags-${draft.id}`}
              onChange={(event) =>
                updateDraft(draft, {
                  tags: event.target.value
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                })
              }
              value={value.tags.join(', ')}
            />
          </div>
        </div>
        <div className="field-grid">
          <label htmlFor={`why-${draft.id}`}>Why it matters</label>
          <textarea
            id={`why-${draft.id}`}
            onChange={(event) => updateDraft(draft, { whyItMatters: event.target.value })}
            value={value.whyItMatters}
          />
        </div>
        <div className="field-grid">
          <label htmlFor={`next-step-${draft.id}`}>Suggested next step</label>
          <textarea
            id={`next-step-${draft.id}`}
            onChange={(event) => updateDraft(draft, { suggestedNextStep: event.target.value })}
            value={value.suggestedNextStep}
          />
        </div>
        <div className="field-grid">
          <span className="helper-text">Route to coop(s)</span>
          <div className="badge-row">
            {(dashboard?.coops ?? []).map((coop) => {
              const selected = value.suggestedTargetCoopIds.includes(coop.profile.id);
              return (
                <button
                  className={selected ? 'inline-button' : 'secondary-button'}
                  key={coop.profile.id}
                  onClick={() => toggleDraftTargetCoop(draft, coop.profile.id)}
                  type="button"
                >
                  {selected ? 'Included' : 'Add'} {coop.profile.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="helper-text">{value.rationale}</div>
        {isArchiveWorthy(value) ? (
          <div className="helper-text">
            This draft is flagged for durable preservation once the summary is clean.
          </div>
        ) : null}
        <div className="action-row">
          <button className="secondary-button" onClick={() => void saveDraft(draft)} type="button">
            Save draft
          </button>
          <button
            className="secondary-button"
            onClick={() => void toggleDraftArchiveWorthiness(draft)}
            type="button"
          >
            {isArchiveWorthy(value) ? 'Remove archive flag' : 'Mark archive-worthy'}
          </button>
          {value.workflowStage === 'candidate' ? (
            <button
              className="secondary-button"
              onClick={() => void changeDraftWorkflowStage(draft, 'ready')}
              type="button"
            >
              Mark ready
            </button>
          ) : (
            <button
              className="secondary-button"
              onClick={() => void changeDraftWorkflowStage(draft, 'candidate')}
              type="button"
            >
              Send back to candidate
            </button>
          )}
          {value.workflowStage === 'ready' ? (
            <button
              className="primary-button"
              onClick={() => void publishDraft(draft)}
              type="button"
            >
              Push into coop
            </button>
          ) : null}
          <a
            className="secondary-button"
            href={value.sources[0]?.url}
            rel="noreferrer"
            target="_blank"
          >
            {context === 'meeting' ? 'Open source' : 'Source'}
          </a>
        </div>
      </article>
    );
  }

  function renderReceiverIntakeCard(capture: ReceiverCapture) {
    return (
      <article className="draft-card stack" key={capture.id}>
        <strong>{capture.title}</strong>
        <div className="badge-row">
          <span className="badge">{capture.kind}</span>
          <span className="badge">{capture.syncState}</span>
          <span className="badge">{capture.intakeStatus}</span>
          {isArchiveWorthy(capture) ? <span className="badge">archive-worthy</span> : null}
        </div>
        <div className="helper-text">
          {capture.memberDisplayName ?? 'Unknown member'} ·{' '}
          {new Date(capture.syncedAt ?? capture.createdAt).toLocaleString()}
        </div>
        <div className="helper-text">
          {capture.fileName ?? `${capture.byteSize} bytes`} · {capture.mimeType}
        </div>
        {capture.syncError ? <div className="helper-text">{capture.syncError}</div> : null}
        <div className="action-row">
          <button
            className="secondary-button"
            onClick={() => void toggleReceiverCaptureArchiveWorthiness(capture)}
            type="button"
          >
            {isArchiveWorthy(capture) ? 'Remove archive flag' : 'Mark archive-worthy'}
          </button>
          <button
            className="secondary-button"
            onClick={() => void convertReceiverCapture(capture, 'candidate')}
            type="button"
          >
            Convert to candidate
          </button>
          <button
            className="primary-button"
            onClick={() => void convertReceiverCapture(capture, 'ready')}
            type="button"
          >
            Convert to draft
          </button>
          <button
            className="secondary-button"
            onClick={() => void archiveReceiverCapture(capture.id)}
            type="button"
          >
            Archive locally
          </button>
        </div>
      </article>
    );
  }

  function renderArtifactCard(artifact: CoopSharedState['artifacts'][number]) {
    const latestReceipt =
      [...archiveReceipts].find((receipt) =>
        activeCoop?.artifacts
          .find((candidate) => candidate.id === artifact.id)
          ?.archiveReceiptIds.includes(receipt.id),
      ) ?? null;

    return (
      <article className="artifact-card stack" key={artifact.id}>
        <strong>{artifact.title}</strong>
        <div className="badge-row">
          <span className="badge">{artifact.category}</span>
          <span className="badge">{artifact.reviewStatus}</span>
          <span className="badge">{artifact.archiveStatus}</span>
          {isArchiveWorthy(artifact) ? <span className="badge">archive-worthy</span> : null}
        </div>
        <div className="helper-text">{artifact.summary}</div>
        <div className="helper-text">{artifact.whyItMatters}</div>
        {latestReceipt ? (
          <div className="helper-text">
            Archived via {latestReceipt.purpose.toLowerCase()} ·{' '}
            <a
              className="source-link"
              href={latestReceipt.gatewayUrl}
              rel="noreferrer"
              target="_blank"
            >
              Inspect receipt
            </a>
          </div>
        ) : null}
        <div className="action-row">
          <button
            className="secondary-button"
            onClick={() =>
              void toggleArtifactArchiveWorthiness(artifact.id, !isArchiveWorthy(artifact))
            }
            type="button"
          >
            {isArchiveWorthy(artifact) ? 'Remove archive flag' : 'Mark archive-worthy'}
          </button>
          <button
            className="primary-button"
            onClick={() => void archiveArtifact(artifact.id)}
            type="button"
          >
            Archive artifact
          </button>
        </div>
      </article>
    );
  }

  function renderArchiveReceiptCard(receipt: (typeof archiveReceipts)[number]) {
    return (
      <article className="draft-card stack" key={receipt.id}>
        <div className="badge-row">
          <span className="badge">{receipt.scope}</span>
          <span className="badge">{receipt.filecoinStatus}</span>
          <span className="badge">{receipt.delegationMode}</span>
        </div>
        <strong>{receipt.title}</strong>
        <div className="helper-text">{receipt.purpose}</div>
        <div className="helper-text">{receipt.summary}</div>
        <div className="detail-grid archive-detail-grid">
          <div>
            <strong>Gateway</strong>
            <div className="helper-text">
              <a className="source-link" href={receipt.gatewayUrl} rel="noreferrer" target="_blank">
                {receipt.gatewayUrl}
              </a>
            </div>
          </div>
          <div>
            <strong>Root CID</strong>
            <div className="helper-text">{receipt.rootCid}</div>
          </div>
          <div>
            <strong>Archived</strong>
            <div className="helper-text">{new Date(receipt.uploadedAt).toLocaleString()}</div>
          </div>
          <div>
            <strong>Scope</strong>
            <div className="helper-text">{receipt.itemCount} item(s)</div>
          </div>
          <div>
            <strong>Piece CID</strong>
            <div className="helper-text">{receipt.primaryPieceCid ?? 'Not reported yet'}</div>
          </div>
          <div>
            <strong>Delegation source</strong>
            <div className="helper-text">
              {receipt.delegationSource ?? receipt.delegationIssuer}
            </div>
          </div>
          <div>
            <strong>Filecoin follow-up</strong>
            <div className="helper-text">
              {receipt.dealCount > 0
                ? `${receipt.dealCount} deal(s) tracked`
                : receipt.aggregateCount > 0
                  ? `${receipt.aggregateCount} aggregate(s) tracked`
                  : 'No Filecoin follow-up data yet'}
            </div>
          </div>
        </div>
        <div className="helper-text">
          {receipt.lastRefreshedAt
            ? `Last refreshed ${new Date(receipt.lastRefreshedAt).toLocaleString()}`
            : 'No follow-up refresh yet.'}
        </div>
        {receipt.lastRefreshError ? (
          <div className="helper-text">Latest refresh error: {receipt.lastRefreshError}</div>
        ) : null}
        {receipt.delegationMode === 'live' && receipt.filecoinStatus !== 'sealed' ? (
          <div className="action-row">
            <button
              className="secondary-button"
              disabled={!dashboard?.operator.liveArchiveAvailable}
              onClick={() => void refreshArchiveStatus(receipt.id)}
              type="button"
            >
              Refresh Filecoin status
            </button>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <div className="coop-shell sidepanel-shell">
      <header className="panel-header">
        <div className="panel-brand">
          <img src="/branding/coop-wordmark-flat.png" alt="Coop" />
          <div
            className={
              dashboard?.summary.iconState === 'error-offline'
                ? 'state-pill is-error'
                : 'state-pill'
            }
          >
            {dashboard?.summary.iconLabel ?? 'Loading'}
          </div>
        </div>
        <div className="summary-strip">
          <div className="summary-card">
            <span>Active coop</span>
            <strong>{activeCoop?.profile.name ?? 'None yet'}</strong>
          </div>
          <div className="summary-card">
            <span>Roost</span>
            <strong>{dashboard?.summary.pendingDrafts ?? 0} drafts</strong>
          </div>
          <div className="summary-card">
            <span>Sync</span>
            <strong>{dashboard?.summary.syncState ?? 'Loading'}</strong>
          </div>
        </div>
        {dashboard?.coops.length ? (
          <div className="field-grid">
            <label htmlFor="active-coop-select">Working context</label>
            <select
              id="active-coop-select"
              onChange={(event) => void selectActiveCoop(event.target.value)}
              value={dashboard.activeCoopId ?? activeCoop?.profile.id ?? ''}
            >
              {(dashboard.coops ?? []).map((coop) => (
                <option key={coop.profile.id} value={coop.profile.id}>
                  {coop.profile.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="state-text">
          Capture: {dashboard?.summary.captureMode ?? 'manual'} · Local enhancement:{' '}
          {dashboard?.summary.localEnhancement ?? 'Heuristics-first'} · Onchain:{' '}
          {configuredOnchainSummary}
        </div>
        {boardUrl ? (
          <div className="action-row">
            <a className="secondary-button" href={boardUrl} rel="noreferrer" target="_blank">
              Open board
            </a>
          </div>
        ) : null}
      </header>

      <nav className="tab-strip">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={panelTab === tab ? 'is-active' : ''}
            onClick={() => setPanelTab(tab)}
            type="button"
          >
            {tab}
          </button>
        ))}
      </nav>

      <main className="content-shell">
        {message ? <div className="panel-card helper-text">{message}</div> : null}

        {panelTab === 'Loose Chickens' && (
          <section className="panel-card">
            <h2>Loose Chickens</h2>
            <p className="helper-text">
              Raw browsing exhaust stays local. These are the recent candidates Coop inspected
              before anything reached shared memory.
            </p>
            <div className="action-row">
              <button className="primary-button" onClick={runManualCapture} type="button">
                Manual round-up
              </button>
            </div>
            <ul className="list-reset stack">
              {dashboard?.candidates.map((candidate) => (
                <li className="draft-card" key={candidate.id}>
                  <strong>{candidate.title}</strong>
                  <div className="meta-text">{candidate.domain}</div>
                  <a className="source-link" href={candidate.url} rel="noreferrer" target="_blank">
                    {candidate.url}
                  </a>
                </li>
              ))}
            </ul>
            {dashboard?.candidates.length === 0 ? (
              <div className="empty-state">Run a manual round-up to populate local candidates.</div>
            ) : null}
          </section>
        )}

        {panelTab === 'Roost' && (
          <section className="panel-card">
            <h2>Roost</h2>
            <p className="helper-text">
              Review, tighten, and explicitly push drafts. Nothing becomes shared memory until you
              do.
            </p>
            <div className="artifact-grid">
              {visibleDrafts.map((draft) => renderDraftCard(draft, 'roost'))}
            </div>
            {visibleDrafts.length === 0 ? (
              <div className="empty-state">
                No drafts yet. Run manual round-up from Loose Chickens.
              </div>
            ) : null}
          </section>
        )}

        {panelTab === 'Coops' && (
          <section className="stack">
            <article className="panel-card">
              <h2>Create Coop</h2>
              <form className="form-grid" onSubmit={createCoopAction}>
                <div className="detail-grid">
                  <div className="field-grid">
                    <label htmlFor="coop-name">Coop name</label>
                    <input
                      id="coop-name"
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, coopName: event.target.value }))
                      }
                      required
                      value={createForm.coopName}
                    />
                  </div>
                  <div className="field-grid">
                    <label htmlFor="coop-purpose">Short purpose</label>
                    <input
                      id="coop-purpose"
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, purpose: event.target.value }))
                      }
                      required
                      value={createForm.purpose}
                    />
                  </div>
                  <div className="field-grid">
                    <label htmlFor="creator-name">Creator display name</label>
                    <input
                      id="creator-name"
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          creatorDisplayName: event.target.value,
                        }))
                      }
                      required
                      value={createForm.creatorDisplayName}
                    />
                  </div>
                  <div className="field-grid">
                    <label htmlFor="capture-mode">Capture mode</label>
                    <select
                      id="capture-mode"
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          captureMode: event.target.value as CaptureMode,
                        }))
                      }
                      value={createForm.captureMode}
                    >
                      <option value="manual">Manual</option>
                      <option value="30-min">Every 30 min</option>
                      <option value="60-min">Every 60 min</option>
                    </select>
                  </div>
                </div>

                <div className="field-grid">
                  <label htmlFor="summary">Overall summary</label>
                  <textarea
                    id="summary"
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, summary: event.target.value }))
                    }
                    required
                    value={createForm.summary}
                  />
                </div>

                <div className="field-grid">
                  <label htmlFor="seed-contribution">Creator seed contribution</label>
                  <textarea
                    id="seed-contribution"
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        seedContribution: event.target.value,
                      }))
                    }
                    required
                    value={createForm.seedContribution}
                  />
                </div>

                <div className="lens-grid">
                  {[
                    ['capitalCurrent', 'capitalPain', 'capitalImprove', 'Capital Formation'],
                    ['impactCurrent', 'impactPain', 'impactImprove', 'Impact Reporting'],
                    [
                      'governanceCurrent',
                      'governancePain',
                      'governanceImprove',
                      'Governance & Coordination',
                    ],
                    [
                      'knowledgeCurrent',
                      'knowledgePain',
                      'knowledgeImprove',
                      'Knowledge Garden & Resources',
                    ],
                  ].map(([currentKey, painKey, improveKey, title]) => (
                    <div className="panel-card" key={title}>
                      <h3>{title}</h3>
                      <div className="field-grid">
                        <label htmlFor={`${currentKey}`}>How do we do this now?</label>
                        <textarea
                          id={`${currentKey}`}
                          onChange={(event) =>
                            setCreateForm((current) => ({
                              ...current,
                              [currentKey]: event.target.value,
                            }))
                          }
                          required
                          value={createForm[currentKey as keyof CreateFormState] as string}
                        />
                      </div>
                      <div className="field-grid">
                        <label htmlFor={`${painKey}`}>What is not working well?</label>
                        <textarea
                          id={`${painKey}`}
                          onChange={(event) =>
                            setCreateForm((current) => ({
                              ...current,
                              [painKey]: event.target.value,
                            }))
                          }
                          required
                          value={createForm[painKey as keyof CreateFormState] as string}
                        />
                      </div>
                      <div className="field-grid">
                        <label htmlFor={`${improveKey}`}>What should improve?</label>
                        <textarea
                          id={`${improveKey}`}
                          onChange={(event) =>
                            setCreateForm((current) => ({
                              ...current,
                              [improveKey]: event.target.value,
                            }))
                          }
                          required
                          value={createForm[improveKey as keyof CreateFormState] as string}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button className="primary-button" type="submit">
                  Launch the coop
                </button>
              </form>
            </article>

            <article className="panel-card">
              <h2>Invite and Join</h2>
              <div className="action-row">
                <button
                  className="secondary-button"
                  onClick={() => createInvite('trusted')}
                  type="button"
                >
                  Create trusted invite
                </button>
                <button
                  className="secondary-button"
                  onClick={() => createInvite('member')}
                  type="button"
                >
                  Create member invite
                </button>
              </div>
              {inviteResult ? (
                <div className="field-grid">
                  <label htmlFor="invite-code">Latest invite code</label>
                  <textarea id="invite-code" readOnly value={inviteResult.code} />
                </div>
              ) : null}

              <form className="form-grid" onSubmit={joinCoopAction}>
                <div className="field-grid">
                  <label htmlFor="join-code">Invite code</label>
                  <textarea
                    id="join-code"
                    onChange={(event) => setJoinInvite(event.target.value)}
                    required
                    value={joinInvite}
                  />
                </div>
                <div className="detail-grid">
                  <div className="field-grid">
                    <label htmlFor="join-name">Display name</label>
                    <input
                      id="join-name"
                      onChange={(event) => setJoinName(event.target.value)}
                      required
                      value={joinName}
                    />
                  </div>
                  <div className="field-grid">
                    <label htmlFor="join-seed">Seed contribution</label>
                    <input
                      id="join-seed"
                      onChange={(event) => setJoinSeed(event.target.value)}
                      required
                      value={joinSeed}
                    />
                  </div>
                </div>
                <button className="primary-button" type="submit">
                  Join coop
                </button>
              </form>
            </article>

            {activeCoop ? (
              <article className="panel-card">
                <h2>{activeCoop.profile.name}</h2>
                <div className="detail-grid">
                  <div>
                    <strong>Purpose</strong>
                    <p className="helper-text">{activeCoop.profile.purpose}</p>
                  </div>
                  <div>
                    <strong>Safe</strong>
                    <p className="helper-text">
                      {activeCoop.onchainState.safeAddress}
                      <br />
                      {getCoopChainLabel(activeCoop.onchainState.chainKey)} ·{' '}
                      {activeCoop.onchainState.statusNote}
                    </p>
                  </div>
                </div>
                <ul className="list-reset stack">
                  {activeCoop.members.map((member) => (
                    <li className="member-row" key={member.id}>
                      <strong>{member.displayName}</strong>
                      <div className="helper-text">
                        {member.role} · {member.address}
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            ) : null}

            <article className="panel-card">
              <h2>Receiver Pairing</h2>
              <p className="helper-text">
                Generate a private pairing payload for the current coop and member context. Synced
                captures land here first, not in shared coop memory.
              </p>
              <div className="action-row">
                <button className="primary-button" onClick={createReceiverPairing} type="button">
                  Generate receiver pairing
                </button>
              </div>
              {activeReceiverPairing ? (
                <div className="stack">
                  {activeReceiverPairingStatus ? (
                    <p className="helper-text">
                      Status: {activeReceiverPairingStatus.status} ·{' '}
                      {activeReceiverPairingStatus.message}
                    </p>
                  ) : null}
                  {activeReceiverPairing.signalingUrls.length > 0 ? (
                    <div className="helper-text">
                      Signaling: {activeReceiverPairing.signalingUrls.join(', ')}
                    </div>
                  ) : (
                    <div className="empty-state">
                      No usable signaling URLs are configured for this pairing yet. Receiver sync
                      stays blocked until signaling is available.
                    </div>
                  )}
                  <div className="field-grid">
                    <label htmlFor="receiver-pairing-payload">Pairing payload</label>
                    <textarea
                      id="receiver-pairing-payload"
                      readOnly
                      value={activeReceiverPairing.pairingCode ?? ''}
                    />
                  </div>
                  <div className="field-grid">
                    <label htmlFor="receiver-pairing-link">Deep link</label>
                    <input
                      id="receiver-pairing-link"
                      readOnly
                      value={activeReceiverPairing.deepLink ?? ''}
                    />
                  </div>
                  <div className="receiver-pairing-list">
                    {visibleReceiverPairings.map((pairing) => (
                      <button
                        className={pairing.active ? 'inline-button' : 'secondary-button'}
                        key={pairing.pairingId}
                        onClick={() => void selectReceiverPairing(pairing.pairingId)}
                        type="button"
                      >
                        {pairing.memberDisplayName} · {getReceiverPairingStatus(pairing).status} ·{' '}
                        {pairing.lastSyncedAt
                          ? `Last sync ${new Date(pairing.lastSyncedAt).toLocaleString()}`
                          : 'Waiting for first sync'}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  No receiver pairing yet. Generate one to open `/pair` on the PWA.
                </div>
              )}
            </article>

            <article className="panel-card">
              <h2>Private Receiver Intake</h2>
              <p className="helper-text">
                Receiver captures stay private to this member until you explicitly move them into
                candidate review, editable drafts, or a local archive.
              </p>
              <div className="receiver-intake-list">
                {receiverIntake.map((capture) => renderReceiverIntakeCard(capture))}
              </div>
              {receiverIntake.length === 0 ? (
                <div className="empty-state">
                  No paired receiver captures yet. Once the PWA syncs, they appear here.
                </div>
              ) : null}
            </article>
          </section>
        )}

        {panelTab === 'Feed' && (
          <section className="stack">
            <article className="panel-card">
              <h2>Feed</h2>
              <p className="helper-text">
                Shared coop memory plus the visible archive trail. Mark important artifacts
                archive-worthy before you preserve them.
              </p>
              <div className="summary-strip">
                <div className="summary-card">
                  <span>Published artifacts</span>
                  <strong>{activeCoop?.artifacts.length ?? 0}</strong>
                </div>
                <div className="summary-card">
                  <span>Archive-worthy</span>
                  <strong>{archiveStory?.archiveWorthyArtifactCount ?? 0}</strong>
                </div>
                <div className="summary-card">
                  <span>Archive receipts</span>
                  <strong>{activeCoop?.archiveReceipts.length ?? 0}</strong>
                </div>
              </div>
              <div className="action-row">
                {boardUrl ? (
                  <a className="primary-button" href={boardUrl} rel="noreferrer" target="_blank">
                    Open board
                  </a>
                ) : null}
                <button className="secondary-button" onClick={archiveSnapshot} type="button">
                  Archive coop snapshot
                </button>
                <button
                  className="secondary-button"
                  onClick={() => exportLatestReceipt('text')}
                  type="button"
                >
                  Export latest receipt
                </button>
              </div>
            </article>

            <OperatorConsole
              actionLog={dashboard?.operator.actionLog ?? []}
              anchorActive={dashboard?.operator.anchorActive ?? false}
              anchorCapability={dashboard?.operator.anchorCapability ?? null}
              anchorDetail={
                dashboard?.operator.anchorDetail ??
                'Anchor mode is off. Live features stay unavailable.'
              }
              archiveMode={dashboard?.operator.archiveMode ?? 'mock'}
              liveArchiveAvailable={dashboard?.operator.liveArchiveAvailable ?? true}
              liveArchiveDetail={
                dashboard?.operator.liveArchiveDetail ??
                'Mock archive uploads stay available without anchor mode.'
              }
              liveOnchainAvailable={dashboard?.operator.liveOnchainAvailable ?? true}
              liveOnchainDetail={
                dashboard?.operator.liveOnchainDetail ??
                'Mock Safe deployment stays available without anchor mode.'
              }
              onRefreshArchiveStatus={() => refreshArchiveStatus()}
              onToggleAnchor={toggleAnchorMode}
              onchainMode={dashboard?.operator.onchainMode ?? configuredOnchainMode}
              refreshableReceiptCount={refreshableArchiveReceipts.length}
            />

            <article className="panel-card">
              <h2>Archive Story</h2>
              <p className="helper-text">
                {archiveStory?.snapshotSummary ??
                  'Archive receipts explain what the coop preserved, why it matters, and where to inspect it.'}
              </p>
              <div className="detail-grid archive-detail-grid">
                <div>
                  <strong>Latest snapshot</strong>
                  <p className="helper-text">
                    {archiveStory?.latestSnapshotReceipt?.summary ??
                      'No snapshot archived yet. Create one to preserve the coop state.'}
                  </p>
                </div>
                <div>
                  <strong>Latest artifact receipt</strong>
                  <p className="helper-text">
                    {archiveStory?.latestArtifactReceipt?.summary ??
                      'Artifact receipts appear here once a published artifact is archived.'}
                  </p>
                </div>
              </div>
            </article>

            <article className="panel-card">
              <h2>Published Artifacts</h2>
              <div className="artifact-grid">
                {activeCoop?.artifacts.map((artifact) => renderArtifactCard(artifact))}
              </div>
              {activeCoop?.artifacts.length === 0 ? (
                <div className="empty-state">No shared artifacts yet.</div>
              ) : null}
            </article>

            <article className="panel-card">
              <h2>Archive Receipts</h2>
              <div className="artifact-grid">
                {archiveReceipts.map((receipt) => renderArchiveReceiptCard(receipt))}
              </div>
              {archiveReceipts.length === 0 ? (
                <div className="empty-state">
                  Archive receipts appear here after an artifact or snapshot is preserved.
                </div>
              ) : null}
            </article>
          </section>
        )}

        {panelTab === 'Meeting Mode' && (
          <section className="stack">
            <article className="panel-card">
              <h2>Meeting Mode</h2>
              <p className="helper-text">
                Use this weekly ritual surface to move private intake into candidate review, turn
                candidate drafts into ready drafts, and only then push them into shared memory.
              </p>
              <div className="summary-strip">
                <div className="summary-card">
                  <span>Private intake</span>
                  <strong>{meetingMode.privateIntake.length}</strong>
                </div>
                <div className="summary-card">
                  <span>Candidate drafts</span>
                  <strong>{meetingMode.candidateDrafts.length}</strong>
                </div>
                <div className="summary-card">
                  <span>Ready drafts</span>
                  <strong>{meetingMode.readyDrafts.length}</strong>
                </div>
              </div>
            </article>

            <article className="panel-card">
              <h2>Ritual Settings</h2>
              <div className="form-grid">
                <div className="field-grid">
                  <label htmlFor="meeting-cadence">Weekly cadence label</label>
                  <input
                    id="meeting-cadence"
                    onChange={(event) =>
                      setMeetingSettings((current) => ({
                        ...current,
                        weeklyReviewCadence: event.target.value,
                      }))
                    }
                    value={meetingSettings.weeklyReviewCadence}
                  />
                </div>
                <div className="field-grid">
                  <label htmlFor="meeting-facilitator">Facilitator label / expectation</label>
                  <textarea
                    id="meeting-facilitator"
                    onChange={(event) =>
                      setMeetingSettings((current) => ({
                        ...current,
                        facilitatorExpectation: event.target.value,
                      }))
                    }
                    value={meetingSettings.facilitatorExpectation}
                  />
                </div>
                <div className="field-grid">
                  <label htmlFor="meeting-posture">Default meeting posture</label>
                  <textarea
                    id="meeting-posture"
                    onChange={(event) =>
                      setMeetingSettings((current) => ({
                        ...current,
                        defaultCapturePosture: event.target.value,
                      }))
                    }
                    value={meetingSettings.defaultCapturePosture}
                  />
                </div>
                <div className="action-row">
                  <button
                    className="primary-button"
                    onClick={saveMeetingSettingsAction}
                    type="button"
                  >
                    Save ritual settings
                  </button>
                </div>
              </div>
            </article>

            <article className="panel-card">
              <h2>Private Intake</h2>
              <div className="artifact-grid">
                {meetingMode.privateIntake.map((capture) => renderReceiverIntakeCard(capture))}
              </div>
              {meetingMode.privateIntake.length === 0 ? (
                <div className="empty-state">No private intake items are waiting for review.</div>
              ) : null}
            </article>

            <article className="panel-card">
              <h2>Candidate Drafts</h2>
              <div className="artifact-grid">
                {meetingMode.candidateDrafts.map((draft) => renderDraftCard(draft, 'meeting'))}
              </div>
              {meetingMode.candidateDrafts.length === 0 ? (
                <div className="empty-state">No candidate drafts are waiting for the ritual.</div>
              ) : null}
            </article>

            <article className="panel-card">
              <h2>Ready To Publish</h2>
              <div className="artifact-grid">
                {meetingMode.readyDrafts.map((draft) => renderDraftCard(draft, 'meeting'))}
              </div>
              {meetingMode.readyDrafts.length === 0 ? (
                <div className="empty-state">No drafts are ready to publish yet.</div>
              ) : null}
            </article>

            <article className="panel-card">
              <h2>Published Board Snapshot</h2>
              <div className="group-grid">
                {activeCoop?.reviewBoard.map((group) => (
                  <article className="group-card" key={group.id}>
                    <strong>
                      {group.groupBy === 'category' ? 'Category' : 'Member'}: {group.label}
                    </strong>
                    <div className="helper-text">{group.artifactIds.length} artifacts</div>
                  </article>
                ))}
              </div>
              {activeCoop?.reviewBoard.length === 0 ? (
                <div className="empty-state">
                  The board fills as published artifacts accumulate.
                </div>
              ) : null}
            </article>
          </section>
        )}

        {panelTab === 'Settings' && (
          <section className="stack">
            <article className="panel-card">
              <h2>Settings</h2>
              <div className="field-grid">
                <strong>Passkey identity</strong>
                <div className="helper-text">
                  {authSession ? (
                    <>
                      {authSession.displayName} · {authSession.primaryAddress}
                      <br />
                      {authSession.identityWarning}
                    </>
                  ) : (
                    'No passkey stored yet. Coop will prompt for one during create or join.'
                  )}
                </div>
              </div>
              <div className="field-grid">
                <label htmlFor="settings-capture-mode">Capture cadence</label>
                <select
                  id="settings-capture-mode"
                  onChange={(event) => void updateCaptureMode(event.target.value as CaptureMode)}
                  value={dashboard?.summary.captureMode ?? 'manual'}
                >
                  <option value="manual">Manual</option>
                  <option value="30-min">Every 30 min</option>
                  <option value="60-min">Every 60 min</option>
                </select>
              </div>
              <div className="field-grid">
                <label htmlFor="sound-enabled">Sound</label>
                <select
                  id="sound-enabled"
                  onChange={(event) =>
                    void updateSound({
                      ...soundPreferences,
                      enabled: event.target.value === 'on',
                    })
                  }
                  value={soundPreferences.enabled ? 'on' : 'off'}
                >
                  <option value="off">Muted</option>
                  <option value="on">On for explicit success moments</option>
                </select>
              </div>
              <div className="action-row">
                <button className="secondary-button" onClick={testSound} type="button">
                  Test squeaky sound
                </button>
                <button className="secondary-button" onClick={runManualCapture} type="button">
                  Run manual round-up
                </button>
              </div>
              <p className="helper-text">
                Passive scans stay silent. Reduced-sound preferences override success sounds.
              </p>
            </article>

            <article className="panel-card">
              <h2>Archive and Export</h2>
              <p className="helper-text">
                Mock archive flows stay available without anchor mode. Live archive uploads and
                follow-up refreshes require anchor mode from the Operator Console.
              </p>
              <div className="action-row">
                <button className="primary-button" onClick={archiveLatestArtifact} type="button">
                  Archive latest artifact
                </button>
                <button className="secondary-button" onClick={archiveSnapshot} type="button">
                  Archive coop snapshot
                </button>
                <button
                  className="secondary-button"
                  onClick={() => exportSnapshot('json')}
                  type="button"
                >
                  Export JSON snapshot
                </button>
                <button
                  className="secondary-button"
                  onClick={() => exportSnapshot('text')}
                  type="button"
                >
                  Export text bundle
                </button>
                <button
                  className="secondary-button"
                  onClick={() => exportLatestArtifact('json')}
                  type="button"
                >
                  Export artifact JSON
                </button>
                <button
                  className="secondary-button"
                  onClick={() => exportLatestArtifact('text')}
                  type="button"
                >
                  Export artifact text
                </button>
                <button
                  className="secondary-button"
                  onClick={() => exportLatestReceipt('json')}
                  type="button"
                >
                  Export receipt JSON
                </button>
                <button
                  className="secondary-button"
                  onClick={() => exportLatestReceipt('text')}
                  type="button"
                >
                  Export receipt text
                </button>
              </div>
            </article>
          </section>
        )}
      </main>
    </div>
  );
}
