import { describe, expect, it } from 'vitest';
import { createCoop } from '../flows';
import {
  encodeCoopDoc,
  hydrateCoopDoc,
  readCoopState,
  summarizeSyncTransportHealth,
} from '../sync';

describe('shared contracts and sync hydration', () => {
  it('round-trips a coop document through Yjs encoding', () => {
    const created = createCoop({
      coopName: 'Sync Coop',
      purpose: 'Verify that shared state survives Yjs serialization.',
      creatorDisplayName: 'Rae',
      captureMode: 'manual',
      seedContribution: 'I am testing shared contracts.',
      setupInsights: {
        summary: 'A concise but valid setup payload for sync testing.',
        crossCuttingPainPoints: ['Context drifts'],
        crossCuttingOpportunities: ['Shared state stays typed'],
        lenses: [
          {
            lens: 'capital-formation',
            currentState: 'Links are scattered.',
            painPoints: 'Funding context disappears.',
            improvements: 'Route leads into shared state.',
          },
          {
            lens: 'impact-reporting',
            currentState: 'Reporting is rushed.',
            painPoints: 'Evidence gets dropped.',
            improvements: 'Collect evidence incrementally.',
          },
          {
            lens: 'governance-coordination',
            currentState: 'Calls happen weekly.',
            painPoints: 'Actions slip.',
            improvements: 'Review actions through the board.',
          },
          {
            lens: 'knowledge-garden-resources',
            currentState: 'Resources live in tabs.',
            painPoints: 'Research repeats.',
            improvements: 'Persist high-signal references.',
          },
        ],
      },
    });

    const update = encodeCoopDoc(created.doc);
    const hydrated = hydrateCoopDoc(update);
    const state = readCoopState(hydrated);

    expect(state.profile.id).toBe(created.state.profile.id);
    expect(state.syncRoom.roomId).toBe(created.state.syncRoom.roomId);
    expect(state.memoryProfile.version).toBe(1);
  });

  it('surfaces degraded sync health when signaling is unavailable', () => {
    expect(summarizeSyncTransportHealth(undefined).syncError).toBe(true);

    const degraded = summarizeSyncTransportHealth({
      room: null,
      signalingUrls: ['wss://signaling.yjs.dev'],
      signalingConns: [{ connected: false }],
    });

    expect(degraded.syncError).toBe(true);
    expect(degraded.note).toContain('No signaling server connection');

    const healthy = summarizeSyncTransportHealth({
      room: {
        webrtcConns: new Map<string, never>([['peer-1', undefined as never]]),
        bcConns: new Set<string>(),
      } as never,
      signalingUrls: ['wss://signaling.yjs.dev'],
      signalingConns: [{ connected: true }],
    });

    expect(healthy.syncError).toBe(false);
    expect(healthy.note).toContain('Connected to 1 peer');
  });
});
