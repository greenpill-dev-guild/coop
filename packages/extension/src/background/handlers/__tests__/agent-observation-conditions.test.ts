import { type ReceiverCapture, createAgentObservation } from '@coop/shared';
import { describe, expect, it } from 'vitest';

import {
  isRitualReviewDue,
  resolveObservationInactiveReason,
} from '../agent-observation-conditions';

function makeCoop() {
  return {
    profile: {
      id: 'coop-1',
      name: 'Test Coop',
      purpose: 'Test purpose',
    },
    rituals: [{ weeklyReviewCadence: 'Weekly review circle' }],
  } as const;
}

function makeDraft(overrides: Record<string, unknown> = {}) {
  return {
    id: 'draft-1',
    title: 'Review me',
    status: 'accepted',
    suggestedTargetCoopIds: ['coop-1'],
    provenance: {
      type: 'tab',
    },
    createdAt: '2026-03-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('isRitualReviewDue', () => {
  it('does not mark a new coop as due when there are no accepted or published drafts', () => {
    expect(isRitualReviewDue({ coop: makeCoop() as never, drafts: [] as never[] })).toBe(false);
    expect(
      isRitualReviewDue({
        coop: makeCoop() as never,
        drafts: [makeDraft({ status: 'draft' })] as never[],
      }),
    ).toBe(false);
  });

  it('marks the ritual as due when accepted drafts exist but no digest has been created', () => {
    expect(
      isRitualReviewDue({
        coop: makeCoop() as never,
        drafts: [makeDraft()] as never[],
      }),
    ).toBe(true);
  });

  it('does not mark the ritual as due when a fresh digest already exists', () => {
    expect(
      isRitualReviewDue({
        coop: makeCoop() as never,
        drafts: [
          makeDraft(),
          makeDraft({
            id: 'digest-1',
            provenance: {
              type: 'agent',
              skillId: 'review-digest',
            },
            status: 'published',
            // Must be within the 7-day freshness window relative to now
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          }),
        ] as never[],
      }),
    ).toBe(false);
  });
});

describe('resolveObservationInactiveReason', () => {
  it('dismisses generic audio backlog observations when a transcript observation is active', () => {
    const capture = {
      id: 'capture-audio-1',
      kind: 'audio',
      intakeStatus: 'private-intake',
      coopId: 'coop-1',
    } as ReceiverCapture;
    const receiverBacklog = createAgentObservation({
      trigger: 'receiver-backlog',
      title: 'Receiver backlog: audio',
      summary: 'Pending intake',
      coopId: 'coop-1',
      captureId: 'capture-audio-1',
      payload: {
        intakeStatus: 'private-intake',
        receiverKind: 'audio',
      },
    });
    const transcriptObservation = createAgentObservation({
      trigger: 'audio-transcript-ready',
      title: 'Voice note transcribed',
      summary: 'Transcript ready',
      coopId: 'coop-1',
      captureId: 'capture-audio-1',
      payload: {
        transcriptText: 'EPA grant requires a 20% local match.',
      },
    });

    const reason = resolveObservationInactiveReason({
      observation: receiverBacklog,
      coopsById: new Map(),
      draftsById: new Map(),
      capturesById: new Map([['capture-audio-1', capture]]),
      drafts: [],
      observations: [receiverBacklog, transcriptObservation],
    });

    expect(reason).toMatch(/transcript observation supersedes/i);
  });
});
