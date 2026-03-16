import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createCoop } from '../flows';
import {
  connectSyncProviders,
  createCoopDoc,
  createSyncRoomConfig,
  encodeCoopDoc,
  hydrateCoopDoc,
  readCoopState,
  summarizeSyncTransportHealth,
  toSyncRoomBootstrap,
  updateCoopState,
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

  it('round-trips greenGoods state through Yjs encoding', () => {
    const created = createCoop({
      coopName: 'Garden Coop',
      purpose: 'Coordinate bioregional stewardship.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'Field notes and funding leads.',
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
      greenGoods: { enabled: true },
    });

    const update = encodeCoopDoc(created.doc);
    const hydrated = hydrateCoopDoc(update);
    const state = readCoopState(hydrated);

    expect(state.greenGoods?.enabled).toBe(true);
    expect(state.greenGoods?.status).toBe('requested');
    expect(state.greenGoods?.domains.length).toBeGreaterThan(0);
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

const defaultSetupInsights = {
  summary: 'A concise but valid setup payload for sync testing.',
  crossCuttingPainPoints: ['Context drifts'],
  crossCuttingOpportunities: ['Shared state stays typed'],
  lenses: [
    {
      lens: 'capital-formation' as const,
      currentState: 'Links are scattered.',
      painPoints: 'Funding context disappears.',
      improvements: 'Route leads into shared state.',
    },
    {
      lens: 'impact-reporting' as const,
      currentState: 'Reporting is rushed.',
      painPoints: 'Evidence gets dropped.',
      improvements: 'Collect evidence incrementally.',
    },
    {
      lens: 'governance-coordination' as const,
      currentState: 'Calls happen weekly.',
      painPoints: 'Actions slip.',
      improvements: 'Review actions through the board.',
    },
    {
      lens: 'knowledge-garden-resources' as const,
      currentState: 'Resources live in tabs.',
      painPoints: 'Research repeats.',
      improvements: 'Persist high-signal references.',
    },
  ],
};

function createTestCoopState() {
  return createCoop({
    coopName: 'Test Coop',
    purpose: 'Unit testing sync helpers.',
    creatorDisplayName: 'Tester',
    captureMode: 'manual',
    seedContribution: 'Testing seed.',
    setupInsights: defaultSetupInsights,
  });
}

describe('connectSyncProviders', () => {
  it('returns a no-op result when window is undefined (SSR path)', () => {
    const originalWindow = globalThis.window;
    // biome-ignore lint/performance/noDelete: needed to simulate server env
    delete (globalThis as { window?: unknown }).window;

    try {
      const doc = new Y.Doc();
      const room = createSyncRoomConfig('coop-ssr-test');

      const result = connectSyncProviders(doc, room);

      expect(result.roomId).toBe(room.roomId);
      expect(result.indexeddb).toBeUndefined();
      expect(result.webrtc).toBeUndefined();
      // disconnect should be a no-op that does not throw
      result.disconnect();
    } finally {
      if (originalWindow !== undefined) {
        globalThis.window = originalWindow as typeof globalThis.window;
      }
    }
  });

  it('creates indexeddb persistence when window is defined', async () => {
    if (typeof window === 'undefined') {
      return;
    }

    const doc = new Y.Doc();
    const room = createSyncRoomConfig('coop-browser-test');

    const result = connectSyncProviders(doc, room);

    expect(result.roomId).toBe(room.roomId);
    expect(result.indexeddb).toBeDefined();
    // WebRTC may or may not be defined depending on env, but disconnect should not throw
    result.disconnect();
    doc.destroy();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
});

describe('summarizeSyncTransportHealth', () => {
  it('reports syncError true with descriptive note when webrtc is undefined', () => {
    const health = summarizeSyncTransportHealth(undefined);

    expect(health.syncError).toBe(true);
    expect(health.note).toContain('unavailable');
    expect(health.configuredSignalingCount).toBe(0);
    expect(health.signalingConnectionCount).toBe(0);
    expect(health.peerCount).toBe(0);
    expect(health.broadcastPeerCount).toBe(0);
  });

  it('reports syncError true when no signaling connections and no peers', () => {
    const health = summarizeSyncTransportHealth({
      room: null,
      signalingUrls: ['wss://sig1.example.com', 'wss://sig2.example.com'],
      signalingConns: [{ connected: false }, { connected: false }],
    });

    expect(health.syncError).toBe(true);
    expect(health.note).toContain('No signaling server connection');
    expect(health.configuredSignalingCount).toBe(2);
    expect(health.signalingConnectionCount).toBe(0);
    expect(health.peerCount).toBe(0);
    expect(health.broadcastPeerCount).toBe(0);
  });

  it('reports connected with correct peer count when webrtc peers exist', () => {
    const health = summarizeSyncTransportHealth({
      room: {
        webrtcConns: new Map([
          ['peer-1', undefined as never],
          ['peer-2', undefined as never],
        ]),
        bcConns: new Set(['bc-peer-1']),
      } as never,
      signalingUrls: ['wss://sig.example.com'],
      signalingConns: [{ connected: true }],
    });

    expect(health.syncError).toBe(false);
    expect(health.note).toContain('Connected to 3 peers');
    expect(health.configuredSignalingCount).toBe(1);
    expect(health.signalingConnectionCount).toBe(1);
    expect(health.peerCount).toBe(2);
    expect(health.broadcastPeerCount).toBe(1);
  });

  it('uses singular "peer" when exactly one peer is connected', () => {
    const health = summarizeSyncTransportHealth({
      room: {
        webrtcConns: new Map(),
        bcConns: new Set(['bc-peer-1']),
      } as never,
      signalingUrls: ['wss://sig.example.com'],
      signalingConns: [{ connected: true }],
    });

    expect(health.syncError).toBe(false);
    expect(health.note).toBe('Connected to 1 peer.');
  });

  it('reports signaling-only state when signaling connected but no peers yet', () => {
    const health = summarizeSyncTransportHealth({
      room: {
        webrtcConns: new Map(),
        bcConns: new Set(),
      } as never,
      signalingUrls: ['wss://sig.example.com'],
      signalingConns: [{ connected: true }],
    });

    expect(health.syncError).toBe(false);
    expect(health.note).toContain('Waiting for peers');
    expect(health.configuredSignalingCount).toBe(1);
    expect(health.signalingConnectionCount).toBe(1);
    expect(health.peerCount).toBe(0);
    expect(health.broadcastPeerCount).toBe(0);
  });

  it('handles missing signalingConns gracefully', () => {
    const health = summarizeSyncTransportHealth({
      room: null,
      signalingUrls: ['wss://sig.example.com'],
      signalingConns: undefined as never,
    });

    expect(health.syncError).toBe(true);
    expect(health.signalingConnectionCount).toBe(0);
  });

  it('handles null room with some connected signaling', () => {
    const health = summarizeSyncTransportHealth({
      room: null,
      signalingUrls: ['wss://sig.example.com'],
      signalingConns: [{ connected: true }],
    });

    // room is null so peerCount and broadcastPeerCount are 0,
    // but signaling is connected so falls through to the signaling-only branch
    expect(health.syncError).toBe(false);
    expect(health.note).toContain('Waiting for peers');
    expect(health.peerCount).toBe(0);
    expect(health.broadcastPeerCount).toBe(0);
    expect(health.signalingConnectionCount).toBe(1);
  });
});

describe('updateCoopState', () => {
  it('reads current state, applies updater, and writes the result back', () => {
    const { doc, state } = createTestCoopState();
    const originalName = state.profile.name;

    const next = updateCoopState(doc, (current) => ({
      ...current,
      profile: {
        ...current.profile,
        name: 'Updated Coop Name',
      },
    }));

    expect(next.profile.name).toBe('Updated Coop Name');
    expect(originalName).not.toBe('Updated Coop Name');

    // Verify the doc reflects the update
    const reRead = readCoopState(doc);
    expect(reRead.profile.name).toBe('Updated Coop Name');
  });

  it('preserves all other state fields when updating a single field', () => {
    const { doc, state } = createTestCoopState();

    updateCoopState(doc, (current) => ({
      ...current,
      profile: {
        ...current.profile,
        purpose: 'New purpose for testing.',
      },
    }));

    const reRead = readCoopState(doc);
    expect(reRead.profile.purpose).toBe('New purpose for testing.');
    expect(reRead.profile.id).toBe(state.profile.id);
    expect(reRead.syncRoom.roomId).toBe(state.syncRoom.roomId);
    expect(reRead.members).toHaveLength(state.members.length);
  });
});

describe('toSyncRoomBootstrap', () => {
  it('extracts only coopId, roomId, and signalingUrls from a full config', () => {
    const room = createSyncRoomConfig('coop-bootstrap-test');

    const bootstrap = toSyncRoomBootstrap(room);

    expect(bootstrap.coopId).toBe(room.coopId);
    expect(bootstrap.roomId).toBe(room.roomId);
    expect(bootstrap.signalingUrls).toEqual(room.signalingUrls);
    // Must NOT include secrets
    expect(bootstrap).not.toHaveProperty('roomSecret');
    expect(bootstrap).not.toHaveProperty('inviteSigningSecret');
  });

  it('returns a valid SyncRoomBootstrap shape', () => {
    const room = createSyncRoomConfig('coop-shape-test');
    const bootstrap = toSyncRoomBootstrap(room);

    expect(Object.keys(bootstrap).sort()).toEqual(['coopId', 'roomId', 'signalingUrls']);
  });
});
