import { describe, expect, it } from 'vitest';
import { type SyncTransportHealth, summarizeSyncTransportHealth } from '../sync';

// ---- Helpers to build mock provider shapes ----

/** Minimal shape matching Pick<WebrtcProvider, 'room' | 'signalingUrls' | 'signalingConns'> */
function mockWebrtc(opts: {
  signalingUrls?: string[];
  connectedSignalingCount?: number;
  peerCount?: number;
  broadcastPeerCount?: number;
}) {
  const {
    signalingUrls = ['wss://signal.example.com'],
    connectedSignalingCount = 0,
    peerCount = 0,
    broadcastPeerCount = 0,
  } = opts;

  const totalSignaling = signalingUrls.length;
  const signalingConns = Array.from({ length: totalSignaling }, (_, i) => ({
    connected: i < connectedSignalingCount,
  }));

  return {
    signalingUrls,
    signalingConns,
    room: {
      webrtcConns: new Map(Array.from({ length: peerCount }, (_, i) => [`peer-${i}`, {}])),
      bcConns: new Set(Array.from({ length: broadcastPeerCount }, (_, i) => `bc-${i}`)),
    },
  } as Parameters<typeof summarizeSyncTransportHealth>[0];
}

/** Minimal shape matching Pick<WebsocketProvider, 'wsconnected'> */
function mockWebsocket(connected: boolean) {
  return { wsconnected: connected };
}

describe('summarizeSyncTransportHealth', () => {
  // ---- 1. Healthy: signaling connected + peers present ----

  it('returns healthy status when signaling connected and peers present', () => {
    const result = summarizeSyncTransportHealth(
      mockWebrtc({
        connectedSignalingCount: 1,
        peerCount: 2,
        broadcastPeerCount: 0,
      }),
      mockWebsocket(true),
    );

    expect(result.syncError).toBe(false);
    expect(result.peerCount).toBe(2);
    expect(result.signalingConnectionCount).toBe(1);
    expect(result.websocketConnected).toBe(true);
    expect(result.note).toMatch(/Connected to 2 peers/);
  });

  it('returns healthy status with broadcast peers only', () => {
    const result = summarizeSyncTransportHealth(
      mockWebrtc({
        connectedSignalingCount: 1,
        peerCount: 0,
        broadcastPeerCount: 3,
      }),
      mockWebsocket(false),
    );

    expect(result.syncError).toBe(false);
    expect(result.broadcastPeerCount).toBe(3);
    expect(result.note).toMatch(/Connected to 3 peers/);
  });

  it('uses singular "peer" for exactly 1 total peer', () => {
    const result = summarizeSyncTransportHealth(
      mockWebrtc({
        connectedSignalingCount: 1,
        peerCount: 1,
        broadcastPeerCount: 0,
      }),
    );

    expect(result.note).toMatch(/Connected to 1 peer\./);
    expect(result.note).not.toMatch(/peers/);
  });

  // ---- 2. Warning: no peers connected ----

  it('returns waiting-for-peers status when signaling connected but no peers', () => {
    const result = summarizeSyncTransportHealth(
      mockWebrtc({
        signalingUrls: ['wss://a.example', 'wss://b.example'],
        connectedSignalingCount: 2,
        peerCount: 0,
        broadcastPeerCount: 0,
      }),
      mockWebsocket(false),
    );

    expect(result.syncError).toBe(false);
    expect(result.peerCount).toBe(0);
    expect(result.broadcastPeerCount).toBe(0);
    expect(result.signalingConnectionCount).toBe(2);
    expect(result.note).toMatch(/Waiting for peers/);
  });

  // ---- 3. Error: signaling disconnected ----

  it('returns syncError when no signaling and no peers and no websocket', () => {
    const result = summarizeSyncTransportHealth(
      mockWebrtc({
        connectedSignalingCount: 0,
        peerCount: 0,
        broadcastPeerCount: 0,
      }),
      mockWebsocket(false),
    );

    expect(result.syncError).toBe(true);
    expect(result.note).toMatch(/No signaling server connection/);
    expect(result.note).toMatch(/limited to this browser profile/);
  });

  it('downgrades to warning (not error) when signaling down but websocket connected', () => {
    const result = summarizeSyncTransportHealth(
      mockWebrtc({
        connectedSignalingCount: 0,
        peerCount: 0,
        broadcastPeerCount: 0,
      }),
      mockWebsocket(true),
    );

    expect(result.syncError).toBe(false);
    expect(result.websocketConnected).toBe(true);
    expect(result.note).toMatch(/WebSocket sync connected/);
    expect(result.note).toMatch(/No signaling server connection/);
  });

  // ---- 4. Correct counts ----

  it('reports correct counts for all fields', () => {
    const result = summarizeSyncTransportHealth(
      mockWebrtc({
        signalingUrls: ['wss://a.example', 'wss://b.example', 'wss://c.example'],
        connectedSignalingCount: 2,
        peerCount: 3,
        broadcastPeerCount: 1,
      }),
      mockWebsocket(true),
    );

    expect(result.configuredSignalingCount).toBe(3);
    expect(result.signalingConnectionCount).toBe(2);
    expect(result.peerCount).toBe(3);
    expect(result.broadcastPeerCount).toBe(1);
    expect(result.websocketConnected).toBe(true);
    expect(result.syncError).toBe(false);
  });

  // ---- 5. Websocket connected/disconnected states ----

  it('reports websocket connected state from provider', () => {
    const result = summarizeSyncTransportHealth(
      mockWebrtc({ connectedSignalingCount: 1, peerCount: 1 }),
      mockWebsocket(true),
    );
    expect(result.websocketConnected).toBe(true);
  });

  it('reports websocket disconnected state from provider', () => {
    const result = summarizeSyncTransportHealth(
      mockWebrtc({ connectedSignalingCount: 1, peerCount: 1 }),
      mockWebsocket(false),
    );
    expect(result.websocketConnected).toBe(false);
  });

  it('defaults websocketConnected to false when no websocket provider given', () => {
    const result = summarizeSyncTransportHealth(
      mockWebrtc({ connectedSignalingCount: 1, peerCount: 1 }),
    );
    expect(result.websocketConnected).toBe(false);
  });

  // ---- 6. No webrtc provider (offline/unavailable context) ----

  it('handles no webrtc provider with websocket fallback', () => {
    const result = summarizeSyncTransportHealth(undefined, mockWebsocket(true));

    expect(result.syncError).toBe(false);
    expect(result.configuredSignalingCount).toBe(0);
    expect(result.signalingConnectionCount).toBe(0);
    expect(result.peerCount).toBe(0);
    expect(result.broadcastPeerCount).toBe(0);
    expect(result.websocketConnected).toBe(true);
    expect(result.note).toMatch(/WebSocket sync connected/);
    expect(result.note).toMatch(/Peer sync is unavailable/);
  });

  it('returns error when no webrtc and no websocket', () => {
    const result = summarizeSyncTransportHealth(undefined, undefined);

    expect(result.syncError).toBe(true);
    expect(result.websocketConnected).toBe(false);
    expect(result.note).toMatch(/Peer sync is unavailable/);
  });

  it('returns error when no webrtc and websocket disconnected', () => {
    const result = summarizeSyncTransportHealth(undefined, mockWebsocket(false));

    expect(result.syncError).toBe(true);
    expect(result.note).toMatch(/Peer sync is unavailable/);
  });

  // ---- 7. Edge case: zero configured signaling URLs ----

  it('handles webrtc provider with zero configured signaling URLs', () => {
    const result = summarizeSyncTransportHealth(
      mockWebrtc({
        signalingUrls: [],
        connectedSignalingCount: 0,
        peerCount: 0,
        broadcastPeerCount: 0,
      }),
      mockWebsocket(false),
    );

    expect(result.configuredSignalingCount).toBe(0);
    expect(result.signalingConnectionCount).toBe(0);
    expect(result.syncError).toBe(true);
  });

  // ---- Edge: room is null (can happen before signaling completes) ----

  it('handles webrtc provider with null room', () => {
    const result = summarizeSyncTransportHealth(
      {
        signalingUrls: ['wss://signal.example.com'],
        signalingConns: [{ connected: true }],
        room: null,
      } as unknown as Parameters<typeof summarizeSyncTransportHealth>[0],
      mockWebsocket(false),
    );

    // room?.webrtcConns.size falls to 0, room?.bcConns.size falls to 0
    // signalingConnectionCount is 1, so this should be "waiting for peers"
    expect(result.syncError).toBe(false);
    expect(result.peerCount).toBe(0);
    expect(result.broadcastPeerCount).toBe(0);
    expect(result.note).toMatch(/Waiting for peers/);
  });

  // ---- Mixed peer types sum correctly ----

  it('sums webrtc and broadcast peers for total count in note', () => {
    const result = summarizeSyncTransportHealth(
      mockWebrtc({
        connectedSignalingCount: 1,
        peerCount: 2,
        broadcastPeerCount: 3,
      }),
    );

    expect(result.note).toMatch(/Connected to 5 peers/);
  });

  // ---- Type shape: all fields present in every return path ----

  it('always returns the full SyncTransportHealth shape', () => {
    const fields: (keyof SyncTransportHealth)[] = [
      'syncError',
      'configuredSignalingCount',
      'signalingConnectionCount',
      'peerCount',
      'broadcastPeerCount',
      'websocketConnected',
    ];

    // Test each return-path variant
    const variants = [
      summarizeSyncTransportHealth(undefined, undefined),
      summarizeSyncTransportHealth(mockWebrtc({ connectedSignalingCount: 0, peerCount: 0 })),
      summarizeSyncTransportHealth(mockWebrtc({ connectedSignalingCount: 1, peerCount: 0 })),
      summarizeSyncTransportHealth(mockWebrtc({ connectedSignalingCount: 1, peerCount: 1 })),
    ];

    for (const result of variants) {
      for (const field of fields) {
        expect(result).toHaveProperty(field);
      }
      // note is optional but always present in practice
      expect(result.note).toBeDefined();
    }
  });
});
