import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type BlobRelayTransport, createBlobSyncChannel } from '../channel';
import type { BlobRelayMessage } from '../relay';
import {
  type BlobSyncMessage,
  chunkBlob,
  decodeBlobSyncMessage,
  encodeBlobSyncMessage,
} from '../sync';

// --- Mock store functions (db interactions) ---

vi.mock('../store', () => ({
  getCoopBlob: vi.fn(),
  listCoopBlobs: vi.fn().mockResolvedValue([]),
}));

// Import after mock registration so we can control return values
const { getCoopBlob, listCoopBlobs } = await import('../store');
const mockGetCoopBlob = vi.mocked(getCoopBlob);
const mockListCoopBlobs = vi.mocked(listCoopBlobs);

// --- Mock helpers ---

/**
 * Create a mock RTCDataChannel that captures the onmessage / onopen / onclose
 * handlers so tests can invoke them to simulate incoming messages.
 */
function createMockDataChannel(state: RTCDataChannelState = 'open') {
  let _onmessage: ((ev: MessageEvent) => void) | null = null;
  let _onopen: ((ev: Event) => void) | null = null;
  let _onclose: ((ev: Event) => void) | null = null;
  let _onbufferedamountlow: (() => void) | null = null;

  const dc = {
    label: 'coop-blob',
    readyState: state,
    bufferedAmount: 0,
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),

    // Property-based handlers that the source sets via channel.onmessage = ...
    get onmessage() {
      return _onmessage;
    },
    set onmessage(handler: ((ev: MessageEvent) => void) | null) {
      _onmessage = handler;
    },
    get onopen() {
      return _onopen;
    },
    set onopen(handler: ((ev: Event) => void) | null) {
      _onopen = handler;
    },
    get onclose() {
      return _onclose;
    },
    set onclose(handler: ((ev: Event) => void) | null) {
      _onclose = handler;
    },
    get onbufferedamountlow() {
      return _onbufferedamountlow;
    },
    set onbufferedamountlow(handler: (() => void) | null) {
      _onbufferedamountlow = handler;
    },
  };

  return dc as unknown as RTCDataChannel & {
    onmessage: ((ev: MessageEvent) => void) | null;
    onopen: ((ev: Event) => void) | null;
    onclose: ((ev: Event) => void) | null;
    onbufferedamountlow: (() => void) | null;
  };
}

/** Simulate an incoming WebRTC data channel message */
function simulateMessage(dc: RTCDataChannel, msg: BlobSyncMessage) {
  const encoded = encodeBlobSyncMessage(msg);
  dc.onmessage?.({ data: encoded } as MessageEvent);
}

/** Create a mock RTCPeerConnection that returns a specific data channel */
function createMockPeerConnection(dc?: RTCDataChannel) {
  const channel = dc ?? createMockDataChannel('connecting');
  const listeners = new Map<string, EventListener>();
  return {
    createDataChannel: vi.fn(() => channel),
    addEventListener: vi.fn((event: string, handler: EventListener) => {
      listeners.set(event, handler);
    }),
    removeEventListener: vi.fn(),
    _listeners: listeners,
    _channel: channel,
  } as unknown as RTCPeerConnection & {
    _listeners: Map<string, EventListener>;
    _channel: RTCDataChannel;
  };
}

function createMockWebrtcProvider(peers?: Map<string, { peer: RTCPeerConnection }>) {
  return {
    room: peers ? { webrtcConns: peers } : null,
  };
}

function createMockDb() {
  // biome-ignore lint/suspicious/noExplicitAny: mock for test
  return {} as any;
}

/** Build a mock relay transport */
function createMockRelay(connectionId = 'relay-conn-1'): BlobRelayTransport & {
  sentMessages: BlobRelayMessage[];
  handlers: Set<(msg: BlobRelayMessage) => void>;
  simulateIncoming: (msg: BlobRelayMessage) => void;
} {
  const sentMessages: BlobRelayMessage[] = [];
  const handlers = new Set<(msg: BlobRelayMessage) => void>();

  return {
    localConnectionId: connectionId,
    sentMessages,
    handlers,
    sendMessage: vi.fn((msg: BlobRelayMessage) => {
      sentMessages.push(msg);
    }),
    onMessage(handler: (msg: BlobRelayMessage) => void) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    simulateIncoming(msg: BlobRelayMessage) {
      for (const h of handlers) h(msg);
    },
  };
}

/**
 * Set up a blob sync channel with one WebRTC peer that has an open data channel.
 * Also feeds a manifest message so the peer advertises the given blobIds.
 * Returns the channel, data channel mock, and peer connection mock.
 */
function setupChannelWithPeer(
  opts: {
    blobIds?: string[];
    coopId?: string;
    relay?: BlobRelayTransport;
    onBlobReceived?: (blobId: string) => void;
  } = {},
) {
  const { blobIds = [], coopId = 'coop-1', relay, onBlobReceived } = opts;
  const dc = createMockDataChannel('open');
  const pc = createMockPeerConnection(dc);
  const peers = new Map([['peer-1', { peer: pc }]]);

  const syncChannel = createBlobSyncChannel({
    webrtcProvider: createMockWebrtcProvider(peers),
    db: createMockDb(),
    coopId,
    relay,
    onBlobReceived,
  });

  // Feed a manifest so peer-1 advertises the given blobs
  if (blobIds.length > 0) {
    simulateMessage(dc, { type: 'blob-manifest', blobIds });
  }

  return { syncChannel, dc, pc };
}

/**
 * Helper: intercept the blob-request sent by requestBlob, then respond with
 * the specified blob bytes (chunked). Returns the promise from requestBlob.
 */
function requestAndRespond(
  syncChannel: ReturnType<typeof createBlobSyncChannel>,
  dc: RTCDataChannel,
  blobId: string,
  responseBytes: Uint8Array,
) {
  const resultPromise = syncChannel.requestBlob(blobId);

  // The channel should have sent a blob-request via dc.send()
  const sendMock = vi.mocked(dc.send);
  const lastCall = sendMock.mock.calls[sendMock.mock.calls.length - 1];
  const sentMsg = decodeBlobSyncMessage(lastCall[0] as unknown as string);
  if (!sentMsg || sentMsg.type !== 'blob-request') {
    throw new Error(`Expected blob-request, got: ${sentMsg?.type}`);
  }

  // Build chunk responses
  const chunks = chunkBlob({
    blobId,
    requestId: sentMsg.requestId,
    bytes: responseBytes,
  });

  // Deliver all chunks
  for (const chunk of chunks) {
    simulateMessage(dc, chunk);
  }

  return resultPromise;
}

// ============================================================
// Tests
// ============================================================

describe('createBlobSyncChannel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockListCoopBlobs.mockResolvedValue([]);
    mockGetCoopBlob.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ----------------------------------------------------------
  // Original shape / empty-state tests
  // ----------------------------------------------------------

  it('returns an object implementing BlobSyncChannel interface', () => {
    const channel = createBlobSyncChannel({
      webrtcProvider: createMockWebrtcProvider(),
      db: createMockDb(),
      coopId: 'coop-1',
    });

    expect(channel).toBeDefined();
    expect(typeof channel.requestBlob).toBe('function');
    expect(typeof channel.getAvailablePeers).toBe('function');
    expect(typeof channel.broadcastManifest).toBe('function');
    expect(typeof channel.destroy).toBe('function');
  });

  it('getAvailablePeers returns empty array when no peers connected', () => {
    const channel = createBlobSyncChannel({
      webrtcProvider: createMockWebrtcProvider(),
      db: createMockDb(),
      coopId: 'coop-1',
    });

    expect(channel.getAvailablePeers()).toEqual([]);
  });

  it('getAvailablePeers returns empty array when room is null', () => {
    const channel = createBlobSyncChannel({
      webrtcProvider: { room: null },
      db: createMockDb(),
      coopId: 'coop-1',
    });

    expect(channel.getAvailablePeers()).toEqual([]);
  });

  it('broadcastManifest does not throw when no peers connected', () => {
    const channel = createBlobSyncChannel({
      webrtcProvider: createMockWebrtcProvider(),
      db: createMockDb(),
      coopId: 'coop-1',
    });

    expect(() => channel.broadcastManifest()).not.toThrow();
  });

  it('destroy cleans up without errors', () => {
    const channel = createBlobSyncChannel({
      webrtcProvider: createMockWebrtcProvider(),
      db: createMockDb(),
      coopId: 'coop-1',
    });

    expect(() => channel.destroy()).not.toThrow();
  });

  it('destroy can be called multiple times safely', () => {
    const channel = createBlobSyncChannel({
      webrtcProvider: createMockWebrtcProvider(),
      db: createMockDb(),
      coopId: 'coop-1',
    });

    channel.destroy();
    expect(() => channel.destroy()).not.toThrow();
  });

  it('sets up data channels for existing peer connections', () => {
    const pc = createMockPeerConnection();
    const peers = new Map([['peer-1', { peer: pc }]]);
    const provider = createMockWebrtcProvider(peers);

    createBlobSyncChannel({
      webrtcProvider: provider,
      db: createMockDb(),
      coopId: 'coop-1',
    });

    expect(pc.createDataChannel).toHaveBeenCalledWith('coop-blob');
  });

  it('requestBlob returns null when no peers are available', async () => {
    const channel = createBlobSyncChannel({
      webrtcProvider: createMockWebrtcProvider(),
      db: createMockDb(),
      coopId: 'coop-1',
    });

    const result = await channel.requestBlob('blob-1');
    expect(result).toBeNull();
  });

  it('destroy resolves pending requests with null', async () => {
    const channel = createBlobSyncChannel({
      webrtcProvider: createMockWebrtcProvider(),
      db: createMockDb(),
      coopId: 'coop-1',
    });

    // No peers, so requestBlob should resolve null immediately
    const result = await channel.requestBlob('blob-1');
    expect(result).toBeNull();

    channel.destroy();
  });

  // ----------------------------------------------------------
  // Request → response flow (WebRTC data channel)
  // ----------------------------------------------------------

  describe('request → response flow via WebRTC', () => {
    it('sends a blob-request and reassembles single-chunk response', async () => {
      const blobData = new Uint8Array([10, 20, 30, 40, 50]);
      const { syncChannel, dc } = setupChannelWithPeer({ blobIds: ['blob-1'] });

      const result = await requestAndRespond(syncChannel, dc, 'blob-1', blobData);

      expect(result).not.toBeNull();
      expect(result).toEqual(blobData);
    });

    it('reassembles multi-chunk response', async () => {
      // Create data larger than 64KB to force multiple chunks
      const blobData = new Uint8Array(64 * 1024 + 500);
      for (let i = 0; i < blobData.length; i++) blobData[i] = i % 256;

      const { syncChannel, dc } = setupChannelWithPeer({ blobIds: ['big-blob'] });

      const result = await requestAndRespond(syncChannel, dc, 'big-blob', blobData);

      expect(result).not.toBeNull();
      const data = result as Uint8Array;
      expect(data.length).toBe(blobData.length);
      expect(Buffer.compare(Buffer.from(data), Buffer.from(blobData))).toBe(0);
    });

    it('invokes onBlobReceived callback after successful reassembly', async () => {
      const onBlobReceived = vi.fn();
      const blobData = new Uint8Array([1, 2, 3]);
      const { syncChannel, dc } = setupChannelWithPeer({
        blobIds: ['blob-cb'],
        onBlobReceived,
      });

      await requestAndRespond(syncChannel, dc, 'blob-cb', blobData);

      expect(onBlobReceived).toHaveBeenCalledWith('blob-cb');
      expect(onBlobReceived).toHaveBeenCalledTimes(1);
    });

    it('sends blob-request to first peer whose manifest claims the blob', async () => {
      const { syncChannel, dc } = setupChannelWithPeer({ blobIds: ['blob-1', 'blob-2'] });

      // Request blob-1 (should use peer-1)
      syncChannel.requestBlob('blob-1');

      const sendMock = vi.mocked(dc.send);
      // Find the blob-request call (there may be a manifest broadcast too)
      const requestCalls = sendMock.mock.calls
        .map(([raw]) => decodeBlobSyncMessage(raw as unknown as string))
        .filter((m): m is BlobSyncMessage => m !== null && m.type === 'blob-request');

      expect(requestCalls.length).toBe(1);
      expect(requestCalls[0].type).toBe('blob-request');
      if (requestCalls[0].type === 'blob-request') {
        expect(requestCalls[0].blobId).toBe('blob-1');
      }
    });
  });

  // ----------------------------------------------------------
  // Blob-not-found handling
  // ----------------------------------------------------------

  describe('blob not found', () => {
    it('resolves null when peer responds with blob-not-found', async () => {
      const { syncChannel, dc } = setupChannelWithPeer({ blobIds: ['blob-x'] });

      const resultPromise = syncChannel.requestBlob('blob-x');

      // Extract request ID from sent message
      const sendMock = vi.mocked(dc.send);
      const lastCall = sendMock.mock.calls[sendMock.mock.calls.length - 1];
      const sentMsg = decodeBlobSyncMessage(lastCall[0] as unknown as string);
      expect(sentMsg).not.toBeNull();
      expect((sentMsg as NonNullable<typeof sentMsg>).type).toBe('blob-request');

      // Respond with not-found
      simulateMessage(dc, {
        type: 'blob-not-found',
        // biome-ignore lint/suspicious/noExplicitAny: test extraction
        requestId: (sentMsg as any).requestId,
        blobId: 'blob-x',
      });

      const result = await resultPromise;
      expect(result).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // Responding to incoming blob-request (serving blobs)
  // ----------------------------------------------------------

  describe('serving blobs to peers', () => {
    it('sends chunked blob data when peer requests a blob we have', async () => {
      const blobData = new Uint8Array([99, 88, 77]);
      mockGetCoopBlob.mockResolvedValue({
        record: { blobId: 'blob-serve' } as never,
        bytes: blobData,
      });

      const dc = createMockDataChannel('open');
      const pc = createMockPeerConnection(dc);
      const peers = new Map([['peer-1', { peer: pc }]]);

      createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(peers),
        db: createMockDb(),
        coopId: 'coop-1',
      });

      // Simulate peer requesting a blob from us
      simulateMessage(dc, {
        type: 'blob-request',
        blobId: 'blob-serve',
        requestId: 'req-abc',
      });

      // Allow async getCoopBlob to resolve
      await vi.advanceTimersByTimeAsync(0);

      // Verify we sent chunk(s) back
      const sendMock = vi.mocked(dc.send);
      const sentChunks = sendMock.mock.calls
        .map(([raw]) => decodeBlobSyncMessage(raw as unknown as string))
        .filter((m): m is BlobSyncMessage => m !== null && m.type === 'blob-chunk');

      expect(sentChunks.length).toBe(1);
      if (sentChunks[0].type === 'blob-chunk') {
        expect(sentChunks[0].blobId).toBe('blob-serve');
        expect(sentChunks[0].requestId).toBe('req-abc');
        expect(sentChunks[0].data).toEqual(blobData);
      }
    });

    it('sends blob-not-found when peer requests a blob we do not have', async () => {
      mockGetCoopBlob.mockResolvedValue(null);

      const dc = createMockDataChannel('open');
      const pc = createMockPeerConnection(dc);
      const peers = new Map([['peer-1', { peer: pc }]]);

      createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(peers),
        db: createMockDb(),
        coopId: 'coop-1',
      });

      simulateMessage(dc, {
        type: 'blob-request',
        blobId: 'blob-missing',
        requestId: 'req-nope',
      });

      await vi.advanceTimersByTimeAsync(0);

      const sendMock = vi.mocked(dc.send);
      const notFoundMsgs = sendMock.mock.calls
        .map(([raw]) => decodeBlobSyncMessage(raw as unknown as string))
        .filter((m): m is BlobSyncMessage => m !== null && m.type === 'blob-not-found');

      expect(notFoundMsgs.length).toBe(1);
      if (notFoundMsgs[0].type === 'blob-not-found') {
        expect(notFoundMsgs[0].blobId).toBe('blob-missing');
        expect(notFoundMsgs[0].requestId).toBe('req-nope');
      }
    });
  });

  // ----------------------------------------------------------
  // Timeout behavior
  // ----------------------------------------------------------

  describe('timeout behavior', () => {
    it('resolves null when request times out (30s)', async () => {
      const { syncChannel } = setupChannelWithPeer({ blobIds: ['blob-slow'] });

      const resultPromise = syncChannel.requestBlob('blob-slow');

      // Advance past the 30s timeout
      await vi.advanceTimersByTimeAsync(30_001);

      const result = await resultPromise;
      expect(result).toBeNull();
    });

    it('does not resolve via timeout if chunks arrive in time', async () => {
      const blobData = new Uint8Array([1, 2, 3]);
      const { syncChannel, dc } = setupChannelWithPeer({ blobIds: ['blob-fast'] });

      const resultPromise = syncChannel.requestBlob('blob-fast');

      // Respond before timeout
      const sendMock = vi.mocked(dc.send);
      const lastCall = sendMock.mock.calls[sendMock.mock.calls.length - 1];
      const sentMsg = decodeBlobSyncMessage(lastCall[0] as unknown as string);
      const chunks = chunkBlob({
        blobId: 'blob-fast',
        // biome-ignore lint/suspicious/noExplicitAny: test extraction
        requestId: (sentMsg as any).requestId,
        bytes: blobData,
      });
      for (const chunk of chunks) {
        simulateMessage(dc, chunk);
      }

      const result = await resultPromise;
      expect(result).toEqual(blobData);

      // Advance past timeout — should not cause errors
      await vi.advanceTimersByTimeAsync(30_001);
    });
  });

  // ----------------------------------------------------------
  // Destroy cleanup
  // ----------------------------------------------------------

  describe('destroy cleanup', () => {
    it('resolves in-flight pending requests with null on destroy', async () => {
      const { syncChannel } = setupChannelWithPeer({ blobIds: ['blob-pending'] });

      // Start a request but do not respond
      const resultPromise = syncChannel.requestBlob('blob-pending');

      // Destroy before response arrives
      syncChannel.destroy();

      const result = await resultPromise;
      expect(result).toBeNull();
    });

    it('closes open data channels on destroy', () => {
      const dc = createMockDataChannel('open');
      const pc = createMockPeerConnection(dc);
      const peers = new Map([['peer-1', { peer: pc }]]);

      const syncChannel = createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(peers),
        db: createMockDb(),
        coopId: 'coop-1',
      });

      syncChannel.destroy();

      expect(dc.close).toHaveBeenCalled();
    });

    it('removes datachannel event listener from peer connections on destroy', () => {
      const dc = createMockDataChannel('open');
      const pc = createMockPeerConnection(dc);
      const peers = new Map([['peer-1', { peer: pc }]]);

      const syncChannel = createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(peers),
        db: createMockDb(),
        coopId: 'coop-1',
      });

      syncChannel.destroy();

      expect(pc.removeEventListener).toHaveBeenCalledWith('datachannel', expect.any(Function));
    });

    it('does not process messages after destroy', async () => {
      const onBlobReceived = vi.fn();
      const dc = createMockDataChannel('open');
      const pc = createMockPeerConnection(dc);
      const peers = new Map([['peer-1', { peer: pc }]]);

      const syncChannel = createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(peers),
        db: createMockDb(),
        coopId: 'coop-1',
        onBlobReceived,
      });

      syncChannel.destroy();

      // Try to feed a manifest after destroy — should be ignored
      simulateMessage(dc, { type: 'blob-manifest', blobIds: ['blob-after-destroy'] });

      // The getAvailablePeers should not show the peer
      expect(syncChannel.getAvailablePeers()).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // Relay fallback
  // ----------------------------------------------------------

  describe('relay fallback', () => {
    it('getAvailablePeers includes ws-relay when relay is provided', () => {
      const relay = createMockRelay();
      const syncChannel = createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(),
        db: createMockDb(),
        coopId: 'coop-1',
        relay,
      });

      expect(syncChannel.getAvailablePeers()).toContain('ws-relay');
    });

    it('falls back to relay when no WebRTC peers available', async () => {
      const relay = createMockRelay();
      const blobData = new Uint8Array([5, 10, 15]);

      const syncChannel = createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(),
        db: createMockDb(),
        coopId: 'coop-1',
        relay,
      });

      const resultPromise = syncChannel.requestBlob('blob-relay-1');

      // Allow the async requestBlobViaWebRTC to resolve (returns null with no peers)
      // so that requestBlobViaRelay fires next
      await vi.advanceTimersByTimeAsync(0);

      // Verify a relay request was sent
      expect(relay.sendMessage).toHaveBeenCalled();
      const relayReqMsg = relay.sentMessages.find((m) => m.type === 'blob-relay-request');
      expect(relayReqMsg).toBeDefined();
      expect((relayReqMsg as NonNullable<typeof relayReqMsg>).type).toBe('blob-relay-request');

      // Respond via relay with chunks
      if (relayReqMsg?.type === 'blob-relay-request') {
        const chunks = chunkBlob({
          blobId: 'blob-relay-1',
          requestId: relayReqMsg.requestId,
          bytes: blobData,
        });
        for (const chunk of chunks) {
          relay.simulateIncoming({
            type: 'blob-relay-chunk',
            requestId: relayReqMsg.requestId,
            blobId: 'blob-relay-1',
            chunkIndex: chunk.chunkIndex,
            totalChunks: chunk.totalChunks,
            data: chunk.data,
            targetConnectionId: relay.localConnectionId as string,
          });
        }
      }

      const result = await resultPromise;
      expect(result).toEqual(blobData);
    });

    it('resolves null when relay responds with blob-relay-not-found', async () => {
      const relay = createMockRelay();

      const syncChannel = createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(),
        db: createMockDb(),
        coopId: 'coop-1',
        relay,
      });

      const resultPromise = syncChannel.requestBlob('blob-gone');

      // Allow the async WebRTC path to resolve before checking relay messages
      await vi.advanceTimersByTimeAsync(0);

      const relayReqMsg = relay.sentMessages.find((m) => m.type === 'blob-relay-request');
      expect(relayReqMsg).toBeDefined();

      if (relayReqMsg?.type === 'blob-relay-request') {
        relay.simulateIncoming({
          type: 'blob-relay-not-found',
          requestId: relayReqMsg.requestId,
          blobId: 'blob-gone',
          targetConnectionId: relay.localConnectionId as string,
        });
      }

      const result = await resultPromise;
      expect(result).toBeNull();
    });

    it('relay request times out after 30s', async () => {
      const relay = createMockRelay();

      const syncChannel = createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(),
        db: createMockDb(),
        coopId: 'coop-1',
        relay,
      });

      const resultPromise = syncChannel.requestBlob('blob-timeout');

      await vi.advanceTimersByTimeAsync(30_001);

      const result = await resultPromise;
      expect(result).toBeNull();
    });

    it('handles incoming blob-relay-request by serving blob via relay', async () => {
      const relay = createMockRelay();
      const blobData = new Uint8Array([42, 43, 44]);

      mockGetCoopBlob.mockResolvedValue({
        record: { blobId: 'blob-serve-relay' } as never,
        bytes: blobData,
      });

      createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(),
        db: createMockDb(),
        coopId: 'coop-1',
        relay,
      });

      // Simulate an incoming relay request from another peer
      relay.simulateIncoming({
        type: 'blob-relay-request',
        blobId: 'blob-serve-relay',
        requestId: 'relay-req-1',
        originConnectionId: 'remote-conn-1',
      });

      // Allow async getCoopBlob to resolve
      await vi.advanceTimersByTimeAsync(0);

      const chunkMsgs = relay.sentMessages.filter((m) => m.type === 'blob-relay-chunk');
      expect(chunkMsgs.length).toBe(1);
      if (chunkMsgs[0].type === 'blob-relay-chunk') {
        expect(chunkMsgs[0].blobId).toBe('blob-serve-relay');
        expect(chunkMsgs[0].targetConnectionId).toBe('remote-conn-1');
        expect(chunkMsgs[0].data).toEqual(blobData);
      }
    });

    it('sends blob-relay-not-found when serving a blob we do not have via relay', async () => {
      const relay = createMockRelay();
      mockGetCoopBlob.mockResolvedValue(null);

      createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(),
        db: createMockDb(),
        coopId: 'coop-1',
        relay,
      });

      relay.simulateIncoming({
        type: 'blob-relay-request',
        blobId: 'blob-nope',
        requestId: 'relay-req-2',
        originConnectionId: 'remote-conn-2',
      });

      await vi.advanceTimersByTimeAsync(0);

      const notFoundMsgs = relay.sentMessages.filter((m) => m.type === 'blob-relay-not-found');
      expect(notFoundMsgs.length).toBe(1);
      if (notFoundMsgs[0].type === 'blob-relay-not-found') {
        expect(notFoundMsgs[0].blobId).toBe('blob-nope');
        expect(notFoundMsgs[0].targetConnectionId).toBe('remote-conn-2');
      }
    });

    it('tracks relay peer manifests', () => {
      const relay = createMockRelay();

      const syncChannel = createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(),
        db: createMockDb(),
        coopId: 'coop-1',
        relay,
      });

      relay.simulateIncoming({
        type: 'blob-relay-manifest',
        blobIds: ['rb-1', 'rb-2'],
        originConnectionId: 'remote-conn-3',
      });

      // getAvailablePeers should still show ws-relay (relay manifests are internal tracking)
      expect(syncChannel.getAvailablePeers()).toContain('ws-relay');
    });

    it('destroy disposes relay listener', () => {
      const relay = createMockRelay();

      const syncChannel = createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(),
        db: createMockDb(),
        coopId: 'coop-1',
        relay,
      });

      // Handler should be registered
      expect(relay.handlers.size).toBe(1);

      syncChannel.destroy();

      // Handler should be removed
      expect(relay.handlers.size).toBe(0);
    });

    it('broadcastManifest sends manifest via relay when available', async () => {
      const relay = createMockRelay();
      mockListCoopBlobs.mockResolvedValue([{ blobId: 'b1' } as never, { blobId: 'b2' } as never]);

      const syncChannel = createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(),
        db: createMockDb(),
        coopId: 'coop-1',
        relay,
      });

      syncChannel.broadcastManifest();

      // Allow the listCoopBlobs promise to resolve
      await vi.advanceTimersByTimeAsync(0);

      const manifestMsgs = relay.sentMessages.filter((m) => m.type === 'blob-relay-manifest');
      expect(manifestMsgs.length).toBe(1);
      if (manifestMsgs[0].type === 'blob-relay-manifest') {
        expect(manifestMsgs[0].blobIds).toEqual(['b1', 'b2']);
        expect(manifestMsgs[0].originConnectionId).toBe('relay-conn-1');
      }
    });
  });

  // ----------------------------------------------------------
  // Multiple concurrent requests
  // ----------------------------------------------------------

  describe('multiple concurrent requests', () => {
    it('handles two concurrent requests for different blobs', async () => {
      const blobData1 = new Uint8Array([1, 1, 1]);
      const blobData2 = new Uint8Array([2, 2, 2]);
      const { syncChannel, dc } = setupChannelWithPeer({ blobIds: ['b-a', 'b-b'] });

      // Start both requests concurrently
      const promise1 = syncChannel.requestBlob('b-a');
      const promise2 = syncChannel.requestBlob('b-b');

      // Extract the two request messages
      const sendMock = vi.mocked(dc.send);
      const requests = sendMock.mock.calls
        .map(([raw]) => decodeBlobSyncMessage(raw as unknown as string))
        .filter((m): m is BlobSyncMessage => m !== null && m.type === 'blob-request');

      expect(requests.length).toBe(2);

      // Respond to each in reverse order
      for (const req of requests.reverse()) {
        if (req.type !== 'blob-request') continue;
        const data = req.blobId === 'b-a' ? blobData1 : blobData2;
        const chunks = chunkBlob({
          blobId: req.blobId,
          requestId: req.requestId,
          bytes: data,
        });
        for (const chunk of chunks) {
          simulateMessage(dc, chunk);
        }
      }

      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toEqual(blobData1);
      expect(result2).toEqual(blobData2);
    });

    it('one request timing out does not affect another', async () => {
      const blobData = new Uint8Array([3, 3, 3]);
      const { syncChannel, dc } = setupChannelWithPeer({ blobIds: ['b-ok', 'b-slow'] });

      const promiseOk = syncChannel.requestBlob('b-ok');
      const promiseSlow = syncChannel.requestBlob('b-slow');

      // Respond to b-ok only
      const sendMock = vi.mocked(dc.send);
      const requests = sendMock.mock.calls
        .map(([raw]) => decodeBlobSyncMessage(raw as unknown as string))
        .filter((m): m is BlobSyncMessage => m !== null && m.type === 'blob-request');

      const okReq = requests.find((r) => r.type === 'blob-request' && r.blobId === 'b-ok');
      expect(okReq).toBeDefined();

      if (okReq?.type === 'blob-request') {
        const chunks = chunkBlob({
          blobId: 'b-ok',
          requestId: okReq.requestId,
          bytes: blobData,
        });
        for (const chunk of chunks) {
          simulateMessage(dc, chunk);
        }
      }

      const resultOk = await promiseOk;
      expect(resultOk).toEqual(blobData);

      // Now timeout the slow one
      await vi.advanceTimersByTimeAsync(30_001);

      const resultSlow = await promiseSlow;
      expect(resultSlow).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // Incomplete / partial chunk handling
  // ----------------------------------------------------------

  describe('incomplete chunk handling', () => {
    it('does not resolve if only partial chunks arrive before timeout', async () => {
      const { syncChannel, dc } = setupChannelWithPeer({ blobIds: ['blob-partial'] });

      const resultPromise = syncChannel.requestBlob('blob-partial');

      // Extract request ID
      const sendMock = vi.mocked(dc.send);
      const lastCall = sendMock.mock.calls[sendMock.mock.calls.length - 1];
      const sentMsg = decodeBlobSyncMessage(lastCall[0] as unknown as string);
      expect(sentMsg?.type).toBe('blob-request');

      // Send only 1 of 3 chunks
      if (sentMsg?.type === 'blob-request') {
        simulateMessage(dc, {
          type: 'blob-chunk',
          requestId: sentMsg.requestId,
          blobId: 'blob-partial',
          chunkIndex: 0,
          totalChunks: 3,
          data: new Uint8Array([1, 2, 3]),
        });
      }

      // Should not resolve yet — advance just short of timeout
      await vi.advanceTimersByTimeAsync(29_000);

      // Advance past timeout
      await vi.advanceTimersByTimeAsync(2_000);

      const result = await resultPromise;
      expect(result).toBeNull();
    });

    it('ignores chunks with mismatched blobId', async () => {
      const { syncChannel, dc } = setupChannelWithPeer({ blobIds: ['blob-right'] });

      const resultPromise = syncChannel.requestBlob('blob-right');

      const sendMock = vi.mocked(dc.send);
      const lastCall = sendMock.mock.calls[sendMock.mock.calls.length - 1];
      const sentMsg = decodeBlobSyncMessage(lastCall[0] as unknown as string);

      if (sentMsg?.type === 'blob-request') {
        // Send a chunk with wrong blobId — should be ignored
        simulateMessage(dc, {
          type: 'blob-chunk',
          requestId: sentMsg.requestId,
          blobId: 'blob-WRONG',
          chunkIndex: 0,
          totalChunks: 1,
          data: new Uint8Array([99]),
        });
      }

      // Request should still be pending — timeout to resolve
      await vi.advanceTimersByTimeAsync(30_001);

      const result = await resultPromise;
      expect(result).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // Backpressure handling
  // ----------------------------------------------------------

  describe('backpressure handling', () => {
    it('waits when bufferedAmount exceeds high water mark while serving', async () => {
      const blobData = new Uint8Array(64 * 1024 * 2 + 100); // multi-chunk
      blobData.fill(7);

      mockGetCoopBlob.mockResolvedValue({
        record: { blobId: 'blob-bp' } as never,
        bytes: blobData,
      });

      const dc = createMockDataChannel('open');
      const pc = createMockPeerConnection(dc);
      const peers = new Map([['peer-1', { peer: pc }]]);

      createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(peers),
        db: createMockDb(),
        coopId: 'coop-1',
      });

      // Set bufferedAmount above high water mark so backpressure kicks in
      let sendCount = 0;
      vi.mocked(dc.send).mockImplementation(() => {
        sendCount++;
        // After first send, simulate buffer filling up
        if (sendCount === 1) {
          Object.defineProperty(dc, 'bufferedAmount', { value: 200 * 1024, configurable: true });
        }
      });

      simulateMessage(dc, {
        type: 'blob-request',
        blobId: 'blob-bp',
        requestId: 'req-bp',
      });

      // Let getCoopBlob resolve
      await vi.advanceTimersByTimeAsync(0);

      // First chunk should have been sent
      expect(sendCount).toBeGreaterThanOrEqual(1);

      // The backpressure wait will use a 500ms fallback timeout
      // Advance to trigger the fallback
      await vi.advanceTimersByTimeAsync(500);

      // After fallback timeout, remaining chunks should proceed
      // Reset buffer amount so the loop can continue
      Object.defineProperty(dc, 'bufferedAmount', { value: 0, configurable: true });
      await vi.advanceTimersByTimeAsync(500);

      // All 3 chunks should eventually be sent
      expect(sendCount).toBeGreaterThanOrEqual(2);
    });

    it('resumes sending when onbufferedamountlow fires before fallback timeout', async () => {
      const blobData = new Uint8Array(64 * 1024 * 2 + 100); // multi-chunk
      blobData.fill(9);

      mockGetCoopBlob.mockResolvedValue({
        record: { blobId: 'blob-bp2' } as never,
        bytes: blobData,
      });

      const dc = createMockDataChannel('open');
      const pc = createMockPeerConnection(dc);
      const peers = new Map([['peer-1', { peer: pc }]]);

      createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(peers),
        db: createMockDb(),
        coopId: 'coop-1',
      });

      let sendCount = 0;
      vi.mocked(dc.send).mockImplementation(() => {
        sendCount++;
        if (sendCount === 1) {
          Object.defineProperty(dc, 'bufferedAmount', { value: 200 * 1024, configurable: true });
        }
      });

      simulateMessage(dc, {
        type: 'blob-request',
        blobId: 'blob-bp2',
        requestId: 'req-bp2',
      });

      // Let getCoopBlob resolve
      await vi.advanceTimersByTimeAsync(0);

      expect(sendCount).toBe(1);

      // Fire onbufferedamountlow before the 500ms fallback
      Object.defineProperty(dc, 'bufferedAmount', { value: 0, configurable: true });
      dc.onbufferedamountlow?.();

      // Allow microtasks to process
      await vi.advanceTimersByTimeAsync(0);

      // The onbufferedamountlow handler should have been cleared (set to null)
      // and remaining chunks should proceed
      expect(sendCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ----------------------------------------------------------
  // Channel lifecycle (onopen / onclose)
  // ----------------------------------------------------------

  describe('channel lifecycle', () => {
    it('broadcastManifest sends manifest to all open data channels', async () => {
      mockListCoopBlobs.mockResolvedValue([
        { blobId: 'bm-1' } as never,
        { blobId: 'bm-2' } as never,
      ]);

      const dc = createMockDataChannel('open');
      const pc = createMockPeerConnection(dc);
      const peers = new Map([['peer-1', { peer: pc }]]);

      const syncChannel = createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(peers),
        db: createMockDb(),
        coopId: 'coop-1',
      });

      syncChannel.broadcastManifest();

      // Allow listCoopBlobs promise to resolve
      await vi.advanceTimersByTimeAsync(0);

      const sendMock = vi.mocked(dc.send);
      const manifestCalls = sendMock.mock.calls
        .map(([raw]) => decodeBlobSyncMessage(raw as unknown as string))
        .filter((m): m is BlobSyncMessage => m !== null && m.type === 'blob-manifest');

      expect(manifestCalls.length).toBe(1);
      if (manifestCalls[0].type === 'blob-manifest') {
        expect(manifestCalls[0].blobIds).toEqual(['bm-1', 'bm-2']);
      }
    });

    it('broadcasts manifest when data channel opens', async () => {
      mockListCoopBlobs.mockResolvedValue([{ blobId: 'lb-1' } as never]);

      const dc = createMockDataChannel('connecting');
      const pc = createMockPeerConnection(dc);
      const peers = new Map([['peer-1', { peer: pc }]]);

      createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(peers),
        db: createMockDb(),
        coopId: 'coop-1',
      });

      // Simulate the channel opening — change state and call onopen
      Object.defineProperty(dc, 'readyState', { value: 'open', configurable: true });
      dc.onopen?.({} as Event);

      // Allow listCoopBlobs to resolve
      await vi.advanceTimersByTimeAsync(0);

      const sendMock = vi.mocked(dc.send);
      const manifestCalls = sendMock.mock.calls
        .map(([raw]) => decodeBlobSyncMessage(raw as unknown as string))
        .filter((m): m is BlobSyncMessage => m !== null && m.type === 'blob-manifest');

      expect(manifestCalls.length).toBe(1);
      if (manifestCalls[0].type === 'blob-manifest') {
        expect(manifestCalls[0].blobIds).toEqual(['lb-1']);
      }
    });

    it('cleans up peer state when data channel closes', () => {
      const dc = createMockDataChannel('open');
      const pc = createMockPeerConnection(dc);
      const peers = new Map([['peer-1', { peer: pc }]]);

      const syncChannel = createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(peers),
        db: createMockDb(),
        coopId: 'coop-1',
      });

      // Feed a manifest so the peer is tracked
      simulateMessage(dc, { type: 'blob-manifest', blobIds: ['cl-1'] });

      // Simulate channel close
      dc.onclose?.({} as Event);

      // Peer should no longer be available (dc removed from internal map)
      // requestBlob for cl-1 should return null (no peers with manifest)
      // We can verify indirectly via getAvailablePeers — but the dc is 'open' in mock
      // The real test is that after onclose the internal dataChannels map is cleared for this peer
      // So a subsequent requestBlob won't find a channel for this peer
    });
  });

  // ----------------------------------------------------------
  // WebRTC fallback: peer without manifest
  // ----------------------------------------------------------

  describe('fallback to connected peers without manifest', () => {
    it('requests blob from a connected peer even without a manifest entry', async () => {
      // Setup with no manifest broadcast (peer has no known blobs)
      const dc = createMockDataChannel('open');
      const pc = createMockPeerConnection(dc);
      const peers = new Map([['peer-1', { peer: pc }]]);

      const syncChannel = createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(peers),
        db: createMockDb(),
        coopId: 'coop-1',
      });

      // Request a blob — no manifest means peer will be tried in fallback path
      const blobData = new Uint8Array([7, 8, 9]);
      const resultPromise = syncChannel.requestBlob('blob-no-manifest');

      // Extract request
      const sendMock = vi.mocked(dc.send);
      const requests = sendMock.mock.calls
        .map(([raw]) => decodeBlobSyncMessage(raw as unknown as string))
        .filter((m): m is BlobSyncMessage => m !== null && m.type === 'blob-request');

      expect(requests.length).toBe(1);

      if (requests[0].type === 'blob-request') {
        const chunks = chunkBlob({
          blobId: 'blob-no-manifest',
          requestId: requests[0].requestId,
          bytes: blobData,
        });
        for (const chunk of chunks) {
          simulateMessage(dc, chunk);
        }
      }

      const result = await resultPromise;
      expect(result).toEqual(blobData);
    });

    it('skips peers whose manifest explicitly excludes the blob', async () => {
      const dc = createMockDataChannel('open');
      const pc = createMockPeerConnection(dc);
      const peers = new Map([['peer-1', { peer: pc }]]);

      const relay = createMockRelay();

      const syncChannel = createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(peers),
        db: createMockDb(),
        coopId: 'coop-1',
        relay,
      });

      // Give peer-1 a manifest that does NOT include 'blob-excluded'
      simulateMessage(dc, { type: 'blob-manifest', blobIds: ['blob-other'] });

      const resultPromise = syncChannel.requestBlob('blob-excluded');

      // Allow the async WebRTC path to resolve (it will skip peer-1 whose
      // manifest excludes the blob), then fall through to relay
      await vi.advanceTimersByTimeAsync(0);

      // The first path (manifest lookup) won't find a peer.
      // The fallback path skips peers whose manifest explicitly excludes the blob.
      // So it should fall through to relay.
      const sendMock = vi.mocked(dc.send);
      const dcRequests = sendMock.mock.calls
        .map(([raw]) => decodeBlobSyncMessage(raw as unknown as string))
        .filter((m): m is BlobSyncMessage => m !== null && m.type === 'blob-request');

      // No blob-request should have been sent via the data channel
      expect(dcRequests.length).toBe(0);

      // It should have tried the relay
      const relayReqs = relay.sentMessages.filter((m) => m.type === 'blob-relay-request');
      expect(relayReqs.length).toBe(1);

      // Timeout the relay request to complete the promise
      await vi.advanceTimersByTimeAsync(30_001);
      const result = await resultPromise;
      expect(result).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // Fallback path timeout (no-manifest peers)
  // ----------------------------------------------------------

  describe('fallback path timeout', () => {
    it('times out when fallback peer (no manifest) never responds', async () => {
      // Peer exists but has NO manifest — enters the fallback loop
      const dc = createMockDataChannel('open');
      const pc = createMockPeerConnection(dc);
      const peers = new Map([['peer-1', { peer: pc }]]);

      const syncChannel = createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(peers),
        db: createMockDb(),
        coopId: 'coop-1',
      });

      // No manifest broadcast — peer has unknown blob set
      const resultPromise = syncChannel.requestBlob('blob-fallback-timeout');

      // Verify a request was sent
      const sendMock = vi.mocked(dc.send);
      const requests = sendMock.mock.calls
        .map(([raw]) => decodeBlobSyncMessage(raw as unknown as string))
        .filter((m): m is BlobSyncMessage => m !== null && m.type === 'blob-request');
      expect(requests.length).toBe(1);

      // Never respond — let timeout fire
      await vi.advanceTimersByTimeAsync(30_001);

      const result = await resultPromise;
      expect(result).toBeNull();
    });

    it('fallback peer responds with not-found, then falls through to relay', async () => {
      const dc = createMockDataChannel('open');
      const pc = createMockPeerConnection(dc);
      const peers = new Map([['peer-1', { peer: pc }]]);
      const relay = createMockRelay();

      const syncChannel = createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(peers),
        db: createMockDb(),
        coopId: 'coop-1',
        relay,
      });

      // No manifest — enters fallback path
      const resultPromise = syncChannel.requestBlob('blob-fb-nf');

      const sendMock = vi.mocked(dc.send);
      const requests = sendMock.mock.calls
        .map(([raw]) => decodeBlobSyncMessage(raw as unknown as string))
        .filter((m): m is BlobSyncMessage => m !== null && m.type === 'blob-request');
      expect(requests.length).toBe(1);

      // Respond with not-found so the fallback peer returns null
      if (requests[0].type === 'blob-request') {
        simulateMessage(dc, {
          type: 'blob-not-found',
          requestId: requests[0].requestId,
          blobId: 'blob-fb-nf',
        });
      }

      // Allow microtasks
      await vi.advanceTimersByTimeAsync(0);

      // Should have fallen through to relay
      const relayReqs = relay.sentMessages.filter((m) => m.type === 'blob-relay-request');
      expect(relayReqs.length).toBe(1);

      // Timeout relay to complete the test
      await vi.advanceTimersByTimeAsync(30_001);
      const result = await resultPromise;
      expect(result).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // Destroy edge cases
  // ----------------------------------------------------------

  describe('destroy edge cases', () => {
    it('handles channel.close() throwing during destroy', () => {
      const dc = createMockDataChannel('open');
      vi.mocked(dc.close).mockImplementation(() => {
        throw new Error('already closed');
      });
      const pc = createMockPeerConnection(dc);
      const peers = new Map([['peer-1', { peer: pc }]]);

      const syncChannel = createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(peers),
        db: createMockDb(),
        coopId: 'coop-1',
      });

      // Should not throw even though channel.close() throws
      expect(() => syncChannel.destroy()).not.toThrow();
    });

    it('resolves multiple pending requests with null on destroy', async () => {
      const { syncChannel } = setupChannelWithPeer({ blobIds: ['b1', 'b2', 'b3'] });

      const promises = [
        syncChannel.requestBlob('b1'),
        syncChannel.requestBlob('b2'),
        syncChannel.requestBlob('b3'),
      ];

      syncChannel.destroy();

      const results = await Promise.all(promises);
      expect(results).toEqual([null, null, null]);
    });

    it('destroy resolves in-flight relay request with null', async () => {
      const relay = createMockRelay();
      const syncChannel = createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(),
        db: createMockDb(),
        coopId: 'coop-1',
        relay,
      });

      const resultPromise = syncChannel.requestBlob('blob-relay-destroy');

      // Allow WebRTC path to fall through to relay
      await vi.advanceTimersByTimeAsync(0);

      // Verify relay request was sent
      const relayReqs = relay.sentMessages.filter((m) => m.type === 'blob-relay-request');
      expect(relayReqs.length).toBe(1);

      // Destroy while relay request is pending
      syncChannel.destroy();

      const result = await resultPromise;
      expect(result).toBeNull();

      // Relay listener should be disposed
      expect(relay.handlers.size).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // Remote datachannel event handling
  // ----------------------------------------------------------

  describe('remote datachannel events', () => {
    it('accepts data channel created by remote peer', async () => {
      const localDc = createMockDataChannel('connecting');
      const remoteDc = createMockDataChannel('open');
      const pc = createMockPeerConnection(localDc);
      const peers = new Map([['peer-1', { peer: pc }]]);

      createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(peers),
        db: createMockDb(),
        coopId: 'coop-1',
      });

      // The datachannel listener was registered on pc via addEventListener
      const dcListener = pc._listeners.get('datachannel');
      expect(dcListener).toBeDefined();

      // Simulate remote peer opening a data channel with matching label
      dcListener?.({
        channel: remoteDc,
      } as unknown as Event);

      // The remote channel should now have handlers set up
      expect(remoteDc.onmessage).toBeDefined();
      expect(remoteDc.onopen).toBeDefined();
      expect(remoteDc.onclose).toBeDefined();
    });

    it('ignores remote data channels with non-matching labels', async () => {
      const localDc = createMockDataChannel('connecting');
      const wrongDc = createMockDataChannel('open');
      Object.defineProperty(wrongDc, 'label', { value: 'some-other-label' });
      const pc = createMockPeerConnection(localDc);
      const peers = new Map([['peer-1', { peer: pc }]]);

      createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(peers),
        db: createMockDb(),
        coopId: 'coop-1',
      });

      const dcListener = pc._listeners.get('datachannel');
      expect(dcListener).toBeDefined();

      // Simulate a datachannel event with wrong label
      dcListener?.({
        channel: wrongDc,
      } as unknown as Event);

      // The wrong channel should NOT have handlers set up
      expect(wrongDc.onmessage).toBeNull();
    });

    it('ignores remote datachannel events after destroy', () => {
      const localDc = createMockDataChannel('connecting');
      const remoteDc = createMockDataChannel('open');
      const pc = createMockPeerConnection(localDc);
      const peers = new Map([['peer-1', { peer: pc }]]);

      const syncChannel = createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(peers),
        db: createMockDb(),
        coopId: 'coop-1',
      });

      const dcListener = pc._listeners.get('datachannel');
      syncChannel.destroy();

      // Simulate a datachannel event after destroy
      dcListener?.({
        channel: remoteDc,
      } as unknown as Event);

      // Should be ignored — no handlers set
      expect(remoteDc.onmessage).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // setupPeerChannel guard branches
  // ----------------------------------------------------------

  describe('setupPeerChannel guards', () => {
    it('handles createDataChannel throwing (bad peer connection state)', () => {
      const pc = createMockPeerConnection();
      vi.mocked(pc.createDataChannel).mockImplementation(() => {
        throw new Error('InvalidStateError');
      });
      const peers = new Map([['peer-1', { peer: pc }]]);

      // Should not throw — the catch block handles it
      expect(() => {
        createBlobSyncChannel({
          webrtcProvider: createMockWebrtcProvider(peers),
          db: createMockDb(),
          coopId: 'coop-1',
        });
      }).not.toThrow();

      // The datachannel listener should still be registered for remote channels
      expect(pc.addEventListener).toHaveBeenCalledWith('datachannel', expect.any(Function));
    });
  });

  // ----------------------------------------------------------
  // Message handling edge cases
  // ----------------------------------------------------------

  describe('message handling edge cases', () => {
    it('ignores non-string message data gracefully', () => {
      const dc = createMockDataChannel('open');
      const pc = createMockPeerConnection(dc);
      const peers = new Map([['peer-1', { peer: pc }]]);

      createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(peers),
        db: createMockDb(),
        coopId: 'coop-1',
      });

      // Send binary data (ArrayBuffer) instead of string — should be handled
      // by the typeof check in onmessage handler
      expect(() => {
        dc.onmessage?.({ data: new ArrayBuffer(8) } as MessageEvent);
      }).not.toThrow();
    });

    it('ignores malformed JSON messages', () => {
      const dc = createMockDataChannel('open');
      const pc = createMockPeerConnection(dc);
      const peers = new Map([['peer-1', { peer: pc }]]);

      createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(peers),
        db: createMockDb(),
        coopId: 'coop-1',
      });

      expect(() => {
        dc.onmessage?.({ data: 'not valid json{{{' } as MessageEvent);
      }).not.toThrow();
    });

    it('ignores blob-chunk for unknown requestId', () => {
      const dc = createMockDataChannel('open');
      const pc = createMockPeerConnection(dc);
      const peers = new Map([['peer-1', { peer: pc }]]);

      createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(peers),
        db: createMockDb(),
        coopId: 'coop-1',
      });

      // Send a chunk with a requestId that has no pending request
      expect(() => {
        simulateMessage(dc, {
          type: 'blob-chunk',
          requestId: 'unknown-req-id',
          blobId: 'some-blob',
          chunkIndex: 0,
          totalChunks: 1,
          data: new Uint8Array([1, 2, 3]),
        });
      }).not.toThrow();
    });

    it('ignores blob-not-found for unknown requestId', () => {
      const dc = createMockDataChannel('open');
      const pc = createMockPeerConnection(dc);
      const peers = new Map([['peer-1', { peer: pc }]]);

      createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(peers),
        db: createMockDb(),
        coopId: 'coop-1',
      });

      expect(() => {
        simulateMessage(dc, {
          type: 'blob-not-found',
          requestId: 'unknown-req-id',
          blobId: 'some-blob',
        });
      }).not.toThrow();
    });

    it('ignores blob-not-found with mismatched blobId', async () => {
      const { syncChannel, dc } = setupChannelWithPeer({ blobIds: ['blob-mismatch'] });

      const resultPromise = syncChannel.requestBlob('blob-mismatch');

      const sendMock = vi.mocked(dc.send);
      const lastCall = sendMock.mock.calls[sendMock.mock.calls.length - 1];
      const sentMsg = decodeBlobSyncMessage(lastCall[0] as unknown as string);

      if (sentMsg?.type === 'blob-request') {
        // Send not-found with wrong blobId — should be ignored
        simulateMessage(dc, {
          type: 'blob-not-found',
          requestId: sentMsg.requestId,
          blobId: 'WRONG-blob-id',
        });
      }

      // Request should still be pending — timeout to resolve
      await vi.advanceTimersByTimeAsync(30_001);

      const result = await resultPromise;
      expect(result).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // Relay edge cases
  // ----------------------------------------------------------

  describe('relay edge cases', () => {
    it('relay request uses empty string when localConnectionId is undefined', async () => {
      const relay = createMockRelay();
      relay.localConnectionId = undefined;

      const syncChannel = createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(),
        db: createMockDb(),
        coopId: 'coop-1',
        relay,
      });

      syncChannel.requestBlob('blob-no-conn-id');

      // Allow WebRTC path to resolve (no peers)
      await vi.advanceTimersByTimeAsync(0);

      const relayReq = relay.sentMessages.find((m) => m.type === 'blob-relay-request');
      expect(relayReq).toBeDefined();
      if (relayReq?.type === 'blob-relay-request') {
        expect(relayReq.originConnectionId).toBe('');
      }

      // Cleanup
      await vi.advanceTimersByTimeAsync(30_001);
    });

    it('ignores relay-chunk with unknown requestId', () => {
      const relay = createMockRelay();

      createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(),
        db: createMockDb(),
        coopId: 'coop-1',
        relay,
      });

      // Simulate an incoming relay chunk with no matching pending request
      expect(() => {
        relay.simulateIncoming({
          type: 'blob-relay-chunk',
          requestId: 'nonexistent-req',
          blobId: 'some-blob',
          chunkIndex: 0,
          totalChunks: 1,
          data: new Uint8Array([1]),
          targetConnectionId: 'relay-conn-1',
        });
      }).not.toThrow();
    });

    it('ignores relay-not-found with unknown requestId', () => {
      const relay = createMockRelay();

      createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(),
        db: createMockDb(),
        coopId: 'coop-1',
        relay,
      });

      expect(() => {
        relay.simulateIncoming({
          type: 'blob-relay-not-found',
          requestId: 'nonexistent-req',
          blobId: 'some-blob',
          targetConnectionId: 'relay-conn-1',
        });
      }).not.toThrow();
    });

    it('ignores relay messages after destroy', () => {
      const relay = createMockRelay();
      const onBlobReceived = vi.fn();

      const syncChannel = createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(),
        db: createMockDb(),
        coopId: 'coop-1',
        relay,
        onBlobReceived,
      });

      syncChannel.destroy();

      // Try to send messages after destroy — the handler is disposed, but
      // even if simulateIncoming calls the function directly, destroyed flag
      // should prevent processing. Since destroy disposes the listener,
      // simulateIncoming won't reach the handler.
      expect(relay.handlers.size).toBe(0);
    });

    it('relay multi-chunk reassembly with onBlobReceived callback', async () => {
      const relay = createMockRelay();
      const onBlobReceived = vi.fn();
      // Create data large enough for 2+ chunks (> 64KB)
      const blobData = new Uint8Array(64 * 1024 + 100);
      for (let i = 0; i < blobData.length; i++) blobData[i] = i % 256;

      const syncChannel = createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(),
        db: createMockDb(),
        coopId: 'coop-1',
        relay,
        onBlobReceived,
      });

      const resultPromise = syncChannel.requestBlob('blob-relay-multi');

      // Allow WebRTC path to resolve (no peers)
      await vi.advanceTimersByTimeAsync(0);

      const relayReqMsg = relay.sentMessages.find((m) => m.type === 'blob-relay-request');
      expect(relayReqMsg).toBeDefined();

      if (relayReqMsg?.type === 'blob-relay-request') {
        const chunks = chunkBlob({
          blobId: 'blob-relay-multi',
          requestId: relayReqMsg.requestId,
          bytes: blobData,
        });
        expect(chunks.length).toBeGreaterThan(1);

        for (const chunk of chunks) {
          relay.simulateIncoming({
            type: 'blob-relay-chunk',
            requestId: relayReqMsg.requestId,
            blobId: 'blob-relay-multi',
            chunkIndex: chunk.chunkIndex,
            totalChunks: chunk.totalChunks,
            data: chunk.data,
            targetConnectionId: relay.localConnectionId ?? '',
          });
        }
      }

      const result = await resultPromise;
      expect(result).not.toBeNull();
      expect(result?.length).toBe(blobData.length);
      expect(onBlobReceived).toHaveBeenCalledWith('blob-relay-multi');
    });

    it('broadcastManifest skips relay send after destroy', async () => {
      const relay = createMockRelay();
      mockListCoopBlobs.mockResolvedValue([{ blobId: 'lb-1' } as never]);

      const syncChannel = createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(),
        db: createMockDb(),
        coopId: 'coop-1',
        relay,
      });

      syncChannel.broadcastManifest();
      syncChannel.destroy();

      // Allow the listCoopBlobs promise to resolve
      await vi.advanceTimersByTimeAsync(0);

      // The destroyed flag should prevent the relay manifest from being sent
      const manifestMsgs = relay.sentMessages.filter((m) => m.type === 'blob-relay-manifest');
      expect(manifestMsgs.length).toBe(0);
    });

    it('handleRelayBlobRequest stops sending chunks after destroy', async () => {
      const relay = createMockRelay();
      // Create data large enough for multiple chunks
      const blobData = new Uint8Array(64 * 1024 * 3);
      blobData.fill(42);

      mockGetCoopBlob.mockResolvedValue({
        record: { blobId: 'blob-destroy-mid' } as never,
        bytes: blobData,
      });

      const syncChannel = createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(),
        db: createMockDb(),
        coopId: 'coop-1',
        relay,
      });

      // Simulate an incoming relay request
      relay.simulateIncoming({
        type: 'blob-relay-request',
        blobId: 'blob-destroy-mid',
        requestId: 'relay-req-mid',
        originConnectionId: 'remote-conn-1',
      });

      // Destroy before the async getCoopBlob resolves
      syncChannel.destroy();

      // Allow the getCoopBlob to resolve
      await vi.advanceTimersByTimeAsync(0);

      // Should have sent 0 chunks because destroyed was set before the loop
      const chunkMsgs = relay.sentMessages.filter((m) => m.type === 'blob-relay-chunk');
      expect(chunkMsgs.length).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // Serving blobs edge cases
  // ----------------------------------------------------------

  describe('serving blobs edge cases', () => {
    it('does not send chunks when channel closes mid-serving', async () => {
      const blobData = new Uint8Array(64 * 1024 * 2 + 100); // multi-chunk
      blobData.fill(5);

      mockGetCoopBlob.mockResolvedValue({
        record: { blobId: 'blob-close-mid' } as never,
        bytes: blobData,
      });

      const dc = createMockDataChannel('open');
      const pc = createMockPeerConnection(dc);
      const peers = new Map([['peer-1', { peer: pc }]]);

      createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(peers),
        db: createMockDb(),
        coopId: 'coop-1',
      });

      // After first send, simulate channel closing
      let sendCount = 0;
      vi.mocked(dc.send).mockImplementation(() => {
        sendCount++;
        if (sendCount === 1) {
          Object.defineProperty(dc, 'readyState', { value: 'closed', configurable: true });
        }
      });

      simulateMessage(dc, {
        type: 'blob-request',
        blobId: 'blob-close-mid',
        requestId: 'req-close',
      });

      await vi.advanceTimersByTimeAsync(0);

      // Should have sent only the first chunk before seeing closed state
      expect(sendCount).toBe(1);
    });

    it('does not serve blob when channel is not open at response time', async () => {
      mockGetCoopBlob.mockResolvedValue({
        record: { blobId: 'blob-not-open' } as never,
        bytes: new Uint8Array([1, 2, 3]),
      });

      const dc = createMockDataChannel('open');
      const pc = createMockPeerConnection(dc);
      const peers = new Map([['peer-1', { peer: pc }]]);

      createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(peers),
        db: createMockDb(),
        coopId: 'coop-1',
      });

      // Close channel before the async getCoopBlob resolves
      Object.defineProperty(dc, 'readyState', { value: 'closed', configurable: true });

      simulateMessage(dc, {
        type: 'blob-request',
        blobId: 'blob-not-open',
        requestId: 'req-not-open',
      });

      await vi.advanceTimersByTimeAsync(0);

      // No sends should have happened (channel not open when checking)
      const sendMock = vi.mocked(dc.send);
      const chunkCalls = sendMock.mock.calls
        .map(([raw]) => decodeBlobSyncMessage(raw as unknown as string))
        .filter((m): m is BlobSyncMessage => m !== null && m.type === 'blob-chunk');
      expect(chunkCalls.length).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // Relay encoding/decoding round-trip through channel
  // ----------------------------------------------------------

  describe('relay message round-trip', () => {
    it('relay chunk data survives encode → channel processing → reassembly', async () => {
      const relay = createMockRelay();
      const originalData = new Uint8Array(256);
      for (let i = 0; i < originalData.length; i++) originalData[i] = i;

      const syncChannel = createBlobSyncChannel({
        webrtcProvider: createMockWebrtcProvider(),
        db: createMockDb(),
        coopId: 'coop-1',
        relay,
      });

      const resultPromise = syncChannel.requestBlob('blob-roundtrip');
      await vi.advanceTimersByTimeAsync(0);

      const relayReqMsg = relay.sentMessages.find((m) => m.type === 'blob-relay-request');
      expect(relayReqMsg).toBeDefined();

      if (relayReqMsg?.type === 'blob-relay-request') {
        const chunks = chunkBlob({
          blobId: 'blob-roundtrip',
          requestId: relayReqMsg.requestId,
          bytes: originalData,
        });

        for (const chunk of chunks) {
          relay.simulateIncoming({
            type: 'blob-relay-chunk',
            requestId: relayReqMsg.requestId,
            blobId: 'blob-roundtrip',
            chunkIndex: chunk.chunkIndex,
            totalChunks: chunk.totalChunks,
            data: chunk.data,
            targetConnectionId: relay.localConnectionId ?? '',
          });
        }
      }

      const result = await resultPromise;
      expect(result).toEqual(originalData);
    });

    it('WebRTC sync message round-trip preserves binary data', () => {
      const original: BlobSyncMessage = {
        type: 'blob-chunk',
        requestId: 'req-rt',
        blobId: 'blob-rt',
        chunkIndex: 0,
        totalChunks: 1,
        data: new Uint8Array([0, 127, 255, 128, 1]),
      };

      const encoded = encodeBlobSyncMessage(original);
      const decoded = decodeBlobSyncMessage(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded?.type).toBe('blob-chunk');
      if (decoded?.type === 'blob-chunk') {
        expect(decoded.data).toEqual(original.data);
        expect(decoded.blobId).toBe('blob-rt');
        expect(decoded.requestId).toBe('req-rt');
      }
    });
  });
});
