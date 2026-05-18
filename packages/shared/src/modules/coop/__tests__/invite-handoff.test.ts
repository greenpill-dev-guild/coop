import { describe, expect, it } from 'vitest';
import { createCoop, generateInviteCode } from '../flows';
import {
  assertInviteHandoffPayloadMatchesInvite,
  createInviteHandoffRequest,
  decryptInviteHandoffPayload,
  encryptInviteHandoffPayload,
} from '../invite-handoff';

function buildSetupInsights() {
  return {
    summary: 'Members need a reliable handoff path.',
    crossCuttingPainPoints: ['Invites should not expose steady sync secrets.'],
    crossCuttingOpportunities: ['Encrypted handoff can bootstrap new members.'],
    lenses: [
      {
        lens: 'capital-formation',
        currentState: 'N/A',
        painPoints: 'N/A',
        improvements: 'N/A',
      },
      {
        lens: 'impact-reporting',
        currentState: 'N/A',
        painPoints: 'N/A',
        improvements: 'N/A',
      },
      {
        lens: 'governance-coordination',
        currentState: 'N/A',
        painPoints: 'N/A',
        improvements: 'N/A',
      },
      {
        lens: 'knowledge-garden-resources',
        currentState: 'N/A',
        painPoints: 'N/A',
        improvements: 'N/A',
      },
    ],
  };
}

describe('invite handoff encryption', () => {
  it('delivers the steady room secret only inside the encrypted recipient payload', async () => {
    const created = createCoop({
      coopName: 'Forest Coop',
      purpose: 'Coordinate forest stewardship.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'I bring forest notes.',
      setupInsights: buildSetupInsights(),
    });
    const invite = generateInviteCode({
      state: created.state,
      createdBy: created.creator.id,
      type: 'member',
    });
    const { request, keyPair } = await createInviteHandoffRequest({
      coopId: created.state.profile.id,
      inviteId: invite.id,
      memberId: 'member-joiner',
      memberDisplayName: 'Mina',
    });

    const response = await encryptInviteHandoffPayload({
      request,
      payload: {
        requestId: request.requestId,
        coopId: created.state.profile.id,
        inviteId: invite.id,
        recipientMemberId: request.memberId,
        roomEpoch: 1,
        roomId: created.state.syncRoom.roomId,
        roomSecret: created.state.syncRoom.roomSecret,
        inviteSigningSecret: created.state.syncRoom.inviteSigningSecret,
        signalingUrls: created.state.syncRoom.signalingUrls,
        bootstrapSnapshot: invite.bootstrap.bootstrapState,
        createdAt: new Date().toISOString(),
      },
    });

    expect(response.encryptedPayloadBase64).not.toContain(created.state.syncRoom.roomSecret);
    const decrypted = await decryptInviteHandoffPayload({
      response,
      privateKey: keyPair.privateKey,
    });
    expect(assertInviteHandoffPayloadMatchesInvite({ invite, payload: decrypted })).toMatchObject({
      roomId: created.state.syncRoom.roomId,
      roomSecret: created.state.syncRoom.roomSecret,
      inviteSigningSecret: created.state.syncRoom.inviteSigningSecret,
      recipientMemberId: 'member-joiner',
    });
  });

  it('rejects a handoff payload that does not match the signed invite room id', async () => {
    const created = createCoop({
      coopName: 'Forest Coop',
      purpose: 'Coordinate forest stewardship.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'I bring forest notes.',
      setupInsights: buildSetupInsights(),
    });
    const invite = generateInviteCode({
      state: created.state,
      createdBy: created.creator.id,
      type: 'member',
    });

    expect(() =>
      assertInviteHandoffPayloadMatchesInvite({
        invite,
        payload: {
          requestId: 'request-1',
          coopId: created.state.profile.id,
          inviteId: invite.id,
          recipientMemberId: 'member-joiner',
          roomEpoch: 1,
          roomId: 'coop-room-attacker',
          roomSecret: 'room-secret-attacker',
          inviteSigningSecret: 'invite-secret-attacker',
          signalingUrls: created.state.syncRoom.signalingUrls,
          createdAt: new Date().toISOString(),
        },
      }),
    ).toThrow(/does not match the invite/i);
  });
});
