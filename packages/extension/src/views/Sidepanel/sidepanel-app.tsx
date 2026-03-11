import {
  type AuthSession,
  type CoopSharedState,
  type InviteCode,
  type ReviewDraft,
  type SoundPreferences,
  connectSyncProviders,
  createCoopDoc,
  createMockOnchainState,
  createPasskeySession,
  defaultSoundPreferences,
  deployCoopSafe,
  hashJson,
  readCoopState,
  sessionToMember,
  summarizeSyncTransportHealth,
  writeCoopState,
} from '@coop/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { playCoopSound } from '../../runtime/audio';
import {
  parseConfiguredSignalingUrls,
  resolveConfiguredChain,
  resolveConfiguredOnchainMode,
} from '../../runtime/config';
import { type DashboardResponse, sendRuntimeMessage } from '../../runtime/messages';
import { type CreateFormState, initialCreateForm, toSetupInsights } from './setup-insights';

const tabs = ['Loose Chickens', 'Roost', 'Coops', 'Feed', 'Review Board', 'Settings'] as const;
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
  const [message, setMessage] = useState('');
  const [draftEdits, setDraftEdits] = useState<Record<string, ReviewDraft>>({});
  const syncBindings = useRef<Map<string, SyncBinding>>(new Map());

  const activeCoop = useMemo(
    () =>
      dashboard?.coops.find((coop) => coop.profile.id === dashboard.activeCoopId) ??
      dashboard?.coops[0],
    [dashboard],
  );
  const soundPreferences = dashboard?.soundPreferences ?? defaultSoundPreferences;
  const authSession = dashboard?.authSession ?? null;

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

  async function resolveOnchainState(session: AuthSession, coopSeed: string) {
    if (configuredOnchainMode === 'mock') {
      return createMockOnchainState({
        seed: coopSeed,
        senderAddress: session.primaryAddress,
        chainKey: configuredChain,
      });
    }

    const pimlicoApiKey = import.meta.env.VITE_PIMLICO_API_KEY;
    if (!pimlicoApiKey) {
      throw new Error('Live onchain mode is enabled, but no Pimlico API key is configured.');
    }

    return deployCoopSafe({
      authSession: session,
      coopSeed,
      pimlico: {
        apiKey: pimlicoApiKey,
        chainKey: configuredChain,
        sponsorshipPolicyId: import.meta.env.VITE_PIMLICO_SPONSORSHIP_POLICY_ID,
      },
    });
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
      const onchainState = await resolveOnchainState(session, coopSeed);
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
      setMessage(
        `Coop created. ${configuredOnchainMode === 'mock' ? 'Mock' : 'Live'} ${configuredChain} Safe details and initial artifacts are ready.`,
      );
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

  async function publishDraft(draft: ReviewDraft) {
    if (!activeCoop) {
      return;
    }
    const actorId = activeCoop.members[0]?.id;
    const editedDraft = draftValue(draft);
    const response = await sendRuntimeMessage({
      type: 'publish-draft',
      payload: {
        draft: editedDraft,
        targetCoopIds: editedDraft.suggestedTargetCoopIds,
        actorId,
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

  async function archiveLatestArtifact() {
    if (!activeCoop || activeCoop.artifacts.length === 0) {
      return;
    }
    const latest = [...activeCoop.artifacts].reverse()[0];
    if (!latest) {
      return;
    }
    const response = await sendRuntimeMessage({
      type: 'archive-artifact',
      payload: {
        coopId: activeCoop.profile.id,
        artifactId: latest.id,
      },
    });
    setMessage(
      response.ok ? 'Archive receipt created and stored.' : (response.error ?? 'Archive failed.'),
    );
    await loadDashboard();
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

  async function testSound() {
    await playCoopSound('sound-test', soundPreferences);
    setMessage('Sound test played.');
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
        <div className="state-text">
          Capture: {dashboard?.summary.captureMode ?? 'manual'} · Local enhancement:{' '}
          {dashboard?.summary.localEnhancement ?? 'Heuristics-first'} · Onchain:{' '}
          {configuredOnchainMode} {configuredChain}
        </div>
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
              {dashboard?.drafts.map((draft) => {
                const value = draftValue(draft);
                return (
                  <article className="draft-card stack" key={draft.id}>
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
                    <div className="badge-row">
                      {value.tags.map((tag) => (
                        <span className="badge" key={tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="helper-text">{value.whyItMatters}</div>
                    <div className="action-row">
                      <button
                        className="primary-button"
                        onClick={() => publishDraft(draft)}
                        type="button"
                      >
                        Push into coop
                      </button>
                      <a
                        className="secondary-button"
                        href={value.sources[0]?.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open source
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
            {dashboard?.drafts.length === 0 ? (
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
                      {activeCoop.onchainState.chainKey} · {activeCoop.onchainState.statusNote}
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
          </section>
        )}

        {panelTab === 'Feed' && (
          <section className="panel-card">
            <h2>Feed</h2>
            <div className="artifact-grid">
              {activeCoop?.artifacts.map((artifact) => (
                <article className="artifact-card stack" key={artifact.id}>
                  <strong>{artifact.title}</strong>
                  <div className="badge-row">
                    <span className="badge">{artifact.category}</span>
                    <span className="badge">{artifact.reviewStatus}</span>
                    <span className="badge">{artifact.archiveStatus}</span>
                  </div>
                  <div className="helper-text">{artifact.summary}</div>
                  <div className="helper-text">{artifact.whyItMatters}</div>
                </article>
              ))}
            </div>
            {activeCoop?.artifacts.length === 0 ? (
              <div className="empty-state">No shared artifacts yet.</div>
            ) : null}
          </section>
        )}

        {panelTab === 'Review Board' && (
          <section className="panel-card">
            <h2>Review Board</h2>
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
              <div className="empty-state">The board fills as published artifacts accumulate.</div>
            ) : null}
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
