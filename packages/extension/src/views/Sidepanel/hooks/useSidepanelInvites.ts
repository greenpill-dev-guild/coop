import type { InviteCode, ReceiverPairingRecord } from '@coop/shared';
import { sendRuntimeMessage } from '../../../runtime/messages';
import type { useDashboard } from './useDashboard';

export interface SidepanelInvitesDeps {
  activeCoop: ReturnType<typeof useDashboard>['activeCoop'];
  activeMember: ReturnType<typeof useDashboard>['activeMember'];
  dashboard: ReturnType<typeof useDashboard>['dashboard'];
  inviteResult: InviteCode | null;
  setMessage: (msg: string) => void;
  setInviteResult: (result: InviteCode | null) => void;
  setPairingResult: (result: ReceiverPairingRecord | null) => void;
  loadDashboard: ReturnType<typeof useDashboard>['loadDashboard'];
}

export function useSidepanelInvites(deps: SidepanelInvitesDeps) {
  const {
    activeCoop,
    activeMember,
    dashboard,
    inviteResult,
    setMessage,
    setInviteResult,
    setPairingResult,
    loadDashboard,
  } = deps;

  async function createInvite(inviteType: 'trusted' | 'member') {
    if (!activeCoop || !activeMember) {
      return;
    }
    const creator = activeMember.id;
    const response = await sendRuntimeMessage<InviteCode>({
      type: 'regenerate-invite-code',
      payload: {
        coopId: activeCoop.profile.id,
        inviteType,
        createdBy: creator,
      },
    });
    if (!response.ok || !response.data) {
      setMessage(response.error ?? 'Invite regeneration failed.');
      return;
    }
    setInviteResult(response.data);
    setMessage(`${inviteType === 'trusted' ? 'Trusted' : 'Member'} flock invite regenerated.`);
    await loadDashboard();
  }

  async function revokeInvite(inviteId: string) {
    if (!activeCoop || !activeMember) {
      return;
    }
    const response = await sendRuntimeMessage({
      type: 'revoke-invite',
      payload: {
        coopId: activeCoop.profile.id,
        inviteId,
        revokedBy: activeMember.id,
      },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Invite revocation failed.');
      return;
    }
    if (inviteResult?.id === inviteId) {
      setInviteResult(null);
    }
    setMessage('Invite revoked.');
    await loadDashboard();
  }

  async function revokeInviteType(inviteType: 'trusted' | 'member') {
    if (!activeCoop || !activeMember) {
      return;
    }
    const response = await sendRuntimeMessage({
      type: 'revoke-invite-type',
      payload: {
        coopId: activeCoop.profile.id,
        inviteType,
        revokedBy: activeMember.id,
      },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Invite revoke failed.');
      return;
    }
    if (inviteResult?.type === inviteType) {
      setInviteResult(null);
    }
    setMessage(`${inviteType === 'trusted' ? 'Trusted' : 'Member'} flock invite revoked.`);
    await loadDashboard();
  }

  async function createReceiverPairing() {
    if (!activeCoop || !activeMember) {
      setMessage(
        'Mating Pocket Coop needs the current member session for this coop. Open the coop as that member first.',
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
      setMessage(response.error ?? 'Pocket Coop mating failed.');
      return;
    }

    setPairingResult(response.data);
    setMessage('Nest code generated for Pocket Coop.');
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
      setMessage(response.error ?? 'Could not switch nest code.');
      return;
    }

    const selectedPairing = dashboard?.receiverPairings.find(
      (pairing) => pairing.pairingId === pairingId,
    );
    setPairingResult(selectedPairing ? { ...selectedPairing, active: true } : null);
    await loadDashboard();
  }

  async function handleProvisionMemberOnchainAccount() {
    if (!activeCoop || !activeMember) {
      setMessage('Open the coop as the member who should own the garden account first.');
      return;
    }

    const response = await sendRuntimeMessage({
      type: 'provision-member-onchain-account',
      payload: {
        coopId: activeCoop.profile.id,
        memberId: activeMember.id,
      },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not provision the member smart account.');
      return;
    }
    setMessage('Member smart account predicted and stored on this browser.');
    await loadDashboard();
  }

  return {
    createInvite,
    revokeInvite,
    revokeInviteType,
    createReceiverPairing,
    selectReceiverPairing,
    handleProvisionMemberOnchainAccount,
  };
}
