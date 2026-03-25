import {
  type AuthSession,
  type OnchainState,
  type SoundPreferences,
  createPasskeySession,
  sessionToMember,
} from '@coop/shared';
import { playCoopSound } from '../../runtime/audio';
import { sendRuntimeMessage } from '../../runtime/messages';
import type { PopupCreateFormState, PopupJoinFormState } from '../Popup/popup-types';
import {
  type CreateFormState,
  initialCreateForm,
  toSetupInsights,
} from '../Sidepanel/setup-insights';

function createDefaultSeedContribution(coopName: string) {
  const trimmedName = coopName.trim() || 'this coop';
  return `I want ${trimmedName} to keep useful context, loose research, and next steps visible.`;
}

function toCreateFormState(form: PopupCreateFormState): CreateFormState {
  return {
    ...initialCreateForm,
    coopName: form.coopName,
    creatorDisplayName: form.creatorName,
    purpose: form.purpose,
    seedContribution: form.starterNote.trim() || createDefaultSeedContribution(form.coopName),
  };
}

export function useCoopActions(deps: {
  setMessage: (message: string) => void;
  loadDashboard: () => Promise<void>;
  soundPreferences: SoundPreferences;
  configuredSignalingUrls: string[];
}) {
  const { setMessage, loadDashboard, soundPreferences, configuredSignalingUrls } = deps;

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
    const response = await sendRuntimeMessage<OnchainState>({
      type: 'resolve-onchain-state',
      payload: { coopSeed },
    });
    if (!response.ok || !response.data) {
      throw new Error(response.error ?? 'Could not resolve the onchain state.');
    }
    return response.data;
  }

  async function createCoop(form: PopupCreateFormState) {
    try {
      const createForm = toCreateFormState(form);
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
          setupInsights: toSetupInsights(createForm, createForm.spaceType),
          signalingUrls: configuredSignalingUrls,
          creator,
          onchainState,
          greenGoods: {
            enabled: true,
          },
        },
      });
      if (!response.ok) {
        setMessage(response.error ?? 'Unable to create coop.');
        return null;
      }
      if (response.soundEvent) {
        await playCoopSound(response.soundEvent, soundPreferences);
      }
      setMessage('Coop created.');
      await loadDashboard();
      return response.data ?? null;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create coop.');
      return null;
    }
  }

  async function joinCoop(form: PopupJoinFormState) {
    try {
      const displayName = form.displayName.trim();
      const seedContribution =
        form.starterNote.trim() || "I want to help keep this coop's work visible and actionable.";
      const session = await ensureAuthSession(displayName);
      const member = sessionToMember(session, displayName, 'member');
      const response = await sendRuntimeMessage({
        type: 'join-coop',
        payload: {
          inviteCode: form.inviteCode,
          displayName,
          seedContribution,
          member,
        },
      });
      if (!response.ok) {
        setMessage(response.error ?? 'Could not join this coop.');
        return null;
      }
      setMessage('Joined coop.');
      await loadDashboard();
      return response.data ?? null;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not join this coop.');
      return null;
    }
  }

  async function switchCoop(coopId: string) {
    const response = await sendRuntimeMessage({
      type: 'set-active-coop',
      payload: { coopId },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not switch coops.');
      return false;
    }
    await loadDashboard();
    return true;
  }

  return {
    createCoop,
    joinCoop,
    switchCoop,
  };
}
