import {
  type AuthSession,
  type CaptureMode,
  type CoopSharedState,
  type CoopSpaceType,
  type SoundPreferences,
  createPasskeySession,
  getCoopSpacePreset,
  listCoopSpacePresets,
  sessionToMember,
} from '@coop/shared';
import { useMemo, useState } from 'react';
import { playCoopSound } from '../../../runtime/audio';
import { sendRuntimeMessage } from '../../../runtime/messages';
import {
  type CreateFormState,
  hasArchiveConfig,
  initialCreateForm,
  toSetupInsights,
} from '../setup-insights';

export function useCoopForm(deps: {
  setMessage: (msg: string) => void;
  setPanelTab: (tab: string) => void;
  loadDashboard: () => Promise<void>;
  soundPreferences: SoundPreferences;
  configuredSignalingUrls: string[];
}) {
  const { setMessage, setPanelTab, loadDashboard, soundPreferences, configuredSignalingUrls } =
    deps;

  const [createForm, setCreateForm] = useState<CreateFormState>(initialCreateForm);
  const [joinInvite, setJoinInvite] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinSeed, setJoinSeed] = useState('');

  const coopSpacePresets = useMemo(() => listCoopSpacePresets(), []);
  const selectedSpacePreset = useMemo(
    () => getCoopSpacePreset(createForm.spaceType),
    [createForm.spaceType],
  );

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
          spaceType: createForm.spaceType,
          creatorDisplayName: createForm.creatorDisplayName,
          captureMode: createForm.captureMode,
          seedContribution: createForm.seedContribution,
          setupInsights: toSetupInsights(createForm),
          signalingUrls: configuredSignalingUrls,
          creator,
          onchainState,
          greenGoods: {
            enabled: createForm.createGreenGoodsGarden,
          },
        },
      });
      if (!response.ok) {
        setMessage(response.error ?? 'Unable to create coop.');
        return;
      }
      if (response.soundEvent) {
        await playCoopSound(response.soundEvent, soundPreferences);
      }

      // Send per-coop archive config if the user filled in the archive fields
      const createdState = response.data as CoopSharedState | undefined;
      if (hasArchiveConfig(createForm) && createdState?.profile.id) {
        const archiveResult = await sendRuntimeMessage({
          type: 'set-coop-archive-config',
          payload: {
            coopId: createdState.profile.id,
            publicConfig: {
              spaceDid: createForm.archiveSpaceDid.trim(),
              delegationIssuer: createForm.archiveSpaceDid.trim(),
              gatewayBaseUrl: createForm.archiveGatewayUrl.trim() || 'https://storacha.link',
            },
            secrets: {
              agentPrivateKey: createForm.archiveAgentPrivateKey.trim() || undefined,
              spaceDelegation: createForm.archiveSpaceDelegation.trim(),
            },
          },
        });
        if (!archiveResult.ok) {
          setMessage(
            `Coop created, but archive config failed: ${archiveResult.error ?? 'Unknown error'}`,
          );
          setCreateForm(initialCreateForm);
          setPanelTab('Coop Feed');
          await loadDashboard();
          return;
        }
      }

      setMessage(
        `Coop created. ${onchainState.statusNote} First shared finds are ready.${
          createForm.createGreenGoodsGarden
            ? ' Green Goods garden request queued for the trusted-node agent.'
            : ''
        }${hasArchiveConfig(createForm) ? ' Storacha space connected.' : ''}`,
      );
      setCreateForm(initialCreateForm);
      setPanelTab('Coop Feed');
      await loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create coop.');
    }
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
        setMessage(response.error ?? 'Could not join this coop.');
        return;
      }
      setMessage('Member joined and starter note saved.');
      setJoinInvite('');
      setJoinName('');
      setJoinSeed('');
      await loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not join this coop.');
    }
  }

  return {
    createForm,
    setCreateForm,
    joinInvite,
    setJoinInvite,
    joinName,
    setJoinName,
    joinSeed,
    setJoinSeed,
    coopSpacePresets,
    selectedSpacePreset,
    createCoopAction,
    joinCoopAction,
  };
}
