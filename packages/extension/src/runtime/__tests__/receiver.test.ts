import { createMockOnchainState } from '@coop/shared';
import { describe, expect, it } from 'vitest';
import {
  filterPrivateReceiverIntake,
  filterVisibleReceiverPairings,
  filterVisibleReviewDrafts,
  isReceiverPairingVisibleForMemberContext,
  resolveActiveReviewContext,
  resolveReceiverPairingMember,
} from '../receiver';

describe('receiver runtime helpers', () => {
  it('requires an authenticated address match before pairing a receiver', () => {
    const coop = {
      profile: {
        id: 'coop-1',
        name: 'River Coop',
        purpose: 'Test coop',
        createdAt: '2026-03-11T18:00:00.000Z',
        createdBy: 'member-1',
        captureMode: 'manual',
        safeAddress: '0x1111111111111111111111111111111111111111',
        active: true,
      },
      members: [
        {
          id: 'member-1',
          displayName: 'Mina',
          role: 'creator',
          authMode: 'wallet',
          address: '0x1111111111111111111111111111111111111111',
          joinedAt: '2026-03-11T18:00:00.000Z',
          identityWarning: '',
        },
        {
          id: 'member-2',
          displayName: 'Ari',
          role: 'member',
          authMode: 'wallet',
          address: '0x2222222222222222222222222222222222222222',
          joinedAt: '2026-03-11T18:05:00.000Z',
          identityWarning: '',
        },
      ],
      contributions: [],
      invites: [],
      ritual: {
        weeklyReviewCadence: 'Weekly',
        namedMoments: ['Roundup'],
        facilitatorExpectation: 'Facilitate',
        defaultCapturePosture: 'Capture',
      },
      soul: {
        purposeStatement: 'Test coop',
        toneAndWorkingStyle: 'Pragmatic',
        usefulSignalDefinition: 'Useful',
        artifactFocus: ['Notes'],
        whyThisCoopExists: 'To test',
      },
      artifacts: [],
      syncRoom: {
        coopId: 'coop-1',
        roomSecret: 'room-secret',
        roomId: 'room-1',
        inviteSigningSecret: 'invite-secret',
        signalingUrls: ['ws://127.0.0.1:4444'],
      },
      onchain: createMockOnchainState({}),
    };

    expect(resolveReceiverPairingMember(coop, null)).toBeUndefined();
    expect(
      resolveReceiverPairingMember(coop, {
        authMode: 'wallet',
        displayName: 'Mina',
        primaryAddress: '0x3333333333333333333333333333333333333333',
        createdAt: '2026-03-11T18:00:00.000Z',
        identityWarning: '',
      }),
    ).toBeUndefined();
    expect(
      resolveReceiverPairingMember(
        coop,
        {
          authMode: 'wallet',
          displayName: 'Ari',
          primaryAddress: '0x2222222222222222222222222222222222222222',
          createdAt: '2026-03-11T18:05:00.000Z',
          identityWarning: '',
        },
        'member-1',
      ),
    ).toBeUndefined();
    expect(
      resolveReceiverPairingMember(
        coop,
        {
          authMode: 'wallet',
          displayName: 'Ari',
          primaryAddress: '0x2222222222222222222222222222222222222222',
          createdAt: '2026-03-11T18:05:00.000Z',
          identityWarning: '',
        },
        'member-2',
      )?.id,
    ).toBe('member-2');
  });

  it('filters private receiver intake by coop and member', () => {
    const captures = [
      {
        id: 'capture-1',
        deviceId: 'device-1',
        pairingId: 'pairing-1',
        coopId: 'coop-1',
        coopDisplayName: 'River Coop',
        memberId: 'member-1',
        memberDisplayName: 'Mina',
        kind: 'audio',
        title: 'Voice note',
        note: '',
        mimeType: 'audio/webm',
        byteSize: 12,
        createdAt: '2026-03-11T18:00:00.000Z',
        updatedAt: '2026-03-11T18:00:00.000Z',
        syncState: 'synced',
        syncedAt: '2026-03-11T18:01:00.000Z',
        retryCount: 0,
        intakeStatus: 'private-intake',
      },
      {
        id: 'capture-2',
        deviceId: 'device-2',
        pairingId: 'pairing-2',
        coopId: 'coop-1',
        coopDisplayName: 'River Coop',
        memberId: 'member-2',
        memberDisplayName: 'Ari',
        kind: 'file',
        title: 'Field note',
        note: '',
        mimeType: 'text/plain',
        byteSize: 20,
        createdAt: '2026-03-11T18:02:00.000Z',
        updatedAt: '2026-03-11T18:02:00.000Z',
        syncState: 'synced',
        syncedAt: '2026-03-11T18:03:00.000Z',
        retryCount: 0,
        intakeStatus: 'candidate',
      },
      {
        id: 'capture-3',
        deviceId: 'device-3',
        pairingId: 'pairing-3',
        coopId: 'coop-2',
        coopDisplayName: 'Forest Coop',
        memberId: 'member-1',
        memberDisplayName: 'Mina',
        kind: 'photo',
        title: 'Canopy',
        note: '',
        mimeType: 'image/jpeg',
        byteSize: 32,
        createdAt: '2026-03-11T18:04:00.000Z',
        updatedAt: '2026-03-11T18:04:00.000Z',
        syncState: 'synced',
        syncedAt: '2026-03-11T18:05:00.000Z',
        retryCount: 0,
        intakeStatus: 'private-intake',
      },
    ];

    expect(
      filterPrivateReceiverIntake(captures, 'coop-1', 'member-1').map((item) => item.id),
    ).toEqual(['capture-1']);
    expect(filterPrivateReceiverIntake(captures, 'coop-1', 'member-2')).toEqual([]);
    expect(filterPrivateReceiverIntake(captures, 'coop-1', undefined)).toEqual([]);
  });

  it('resolves the active review context from the selected coop and auth session', () => {
    const coops = [
      {
        profile: {
          id: 'coop-1',
          name: 'River Coop',
          purpose: 'Test coop',
          createdAt: '2026-03-11T18:00:00.000Z',
          createdBy: 'member-1',
          captureMode: 'manual',
          safeAddress: '0x1111111111111111111111111111111111111111',
          active: true,
        },
        members: [
          {
            id: 'member-1',
            displayName: 'Mina',
            role: 'creator',
            authMode: 'wallet',
            address: '0x1111111111111111111111111111111111111111',
            joinedAt: '2026-03-11T18:00:00.000Z',
            identityWarning: '',
          },
        ],
        contributions: [],
        invites: [],
        ritual: {
          weeklyReviewCadence: 'Weekly',
          namedMoments: ['Roundup'],
          facilitatorExpectation: 'Facilitate',
          defaultCapturePosture: 'Capture',
        },
        soul: {
          purposeStatement: 'Test coop',
          toneAndWorkingStyle: 'Pragmatic',
          usefulSignalDefinition: 'Useful',
          artifactFocus: ['Notes'],
          whyThisCoopExists: 'To test',
        },
        artifacts: [],
        syncRoom: {
          coopId: 'coop-1',
          roomSecret: 'room-secret',
          roomId: 'room-1',
          inviteSigningSecret: 'invite-secret',
          signalingUrls: ['ws://127.0.0.1:4444'],
        },
        onchain: createMockOnchainState({}),
      },
    ];

    expect(
      resolveActiveReviewContext(
        coops,
        {
          authMode: 'wallet',
          displayName: 'Mina',
          primaryAddress: '0x1111111111111111111111111111111111111111',
          createdAt: '2026-03-11T18:00:00.000Z',
          identityWarning: '',
        },
        'coop-missing',
      ),
    ).toMatchObject({
      activeCoopId: 'coop-1',
      activeMemberId: 'member-1',
    });
  });

  it('keeps receiver drafts hidden from a different active member while preserving other drafts', () => {
    const drafts = [
      {
        id: 'draft-receiver-1',
        interpretationId: 'receiver-interpretation-1',
        extractId: 'receiver-extract-1',
        sourceCandidateId: 'receiver-source-1',
        title: 'Receiver note',
        summary: 'Private receiver summary',
        sources: [{ label: 'Receiver', url: 'coop://receiver/1', domain: 'receiver.local' }],
        tags: ['receiver'],
        category: 'thought',
        whyItMatters: 'Private to Mina',
        suggestedNextStep: 'Review privately',
        suggestedTargetCoopIds: ['coop-2'],
        confidence: 0.5,
        rationale: 'Receiver-only draft',
        status: 'draft',
        workflowStage: 'ready',
        provenance: {
          type: 'receiver',
          captureId: 'capture-1',
          pairingId: 'pairing-1',
          coopId: 'coop-1',
          memberId: 'member-1',
          receiverKind: 'audio',
          seedMethod: 'metadata-only',
        },
        createdAt: '2026-03-11T18:00:00.000Z',
      },
      {
        id: 'draft-tab-1',
        interpretationId: 'interp-1',
        extractId: 'extract-1',
        sourceCandidateId: 'candidate-1',
        title: 'Shared tab draft',
        summary: 'Normal tab draft',
        sources: [{ label: 'Shared tab', url: 'https://example.org', domain: 'example.org' }],
        tags: ['shared'],
        category: 'resource',
        whyItMatters: 'Visible to the current local session',
        suggestedNextStep: 'Publish when ready',
        suggestedTargetCoopIds: ['coop-2'],
        confidence: 0.8,
        rationale: 'Tab pipeline draft',
        status: 'draft',
        workflowStage: 'ready',
        provenance: {
          type: 'tab',
          interpretationId: 'interp-1',
          extractId: 'extract-1',
          sourceCandidateId: 'candidate-1',
        },
        createdAt: '2026-03-11T18:01:00.000Z',
      },
    ];

    expect(
      filterVisibleReviewDrafts(drafts, 'coop-1', 'member-1').map((draft) => draft.id),
    ).toEqual(['draft-receiver-1', 'draft-tab-1']);
    expect(
      filterVisibleReviewDrafts(drafts, 'coop-1', 'member-2').map((draft) => draft.id),
    ).toEqual(['draft-tab-1']);
  });

  it('limits receiver pairings to the active coop and paired member context', () => {
    const pairings = [
      {
        version: 1 as const,
        pairingId: 'pairing-1',
        coopId: 'coop-1',
        coopDisplayName: 'River Coop',
        memberId: 'member-1',
        memberDisplayName: 'Mina',
        pairSecret: 'secret-1',
        roomId: 'room-1',
        signalingUrls: ['ws://127.0.0.1:4444'],
        issuedAt: '2026-03-11T18:00:00.000Z',
        expiresAt: '2026-03-18T18:00:00.000Z',
        active: true,
      },
      {
        version: 1 as const,
        pairingId: 'pairing-2',
        coopId: 'coop-1',
        coopDisplayName: 'River Coop',
        memberId: 'member-2',
        memberDisplayName: 'Ari',
        pairSecret: 'secret-2',
        roomId: 'room-2',
        signalingUrls: ['ws://127.0.0.1:4444'],
        issuedAt: '2026-03-11T18:05:00.000Z',
        expiresAt: '2026-03-18T18:05:00.000Z',
        active: false,
      },
      {
        version: 1 as const,
        pairingId: 'pairing-3',
        coopId: 'coop-2',
        coopDisplayName: 'Forest Coop',
        memberId: 'member-1',
        memberDisplayName: 'Mina',
        pairSecret: 'secret-3',
        roomId: 'room-3',
        signalingUrls: ['ws://127.0.0.1:4444'],
        issuedAt: '2026-03-11T18:10:00.000Z',
        expiresAt: '2026-03-18T18:10:00.000Z',
        active: false,
      },
    ];

    expect(isReceiverPairingVisibleForMemberContext(pairings[0], 'coop-1', 'member-1')).toBe(true);
    expect(isReceiverPairingVisibleForMemberContext(pairings[1], 'coop-1', 'member-1')).toBe(false);
    expect(isReceiverPairingVisibleForMemberContext(pairings[2], 'coop-1', 'member-1')).toBe(false);
    expect(
      filterVisibleReceiverPairings(pairings, 'coop-1', 'member-1').map(
        (pairing) => pairing.pairingId,
      ),
    ).toEqual(['pairing-1']);
  });
});
