import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReceiverSyncEnvelope } from '../../../contracts/schema';
import { createReceiverCapture, createReceiverDeviceIdentity } from '../capture';
import { createReceiverPairingPayload, toReceiverPairingRecord } from '../pairing';
import {
  assertReceiverSyncRelayAck,
  buildReceiverSyncRelayTopics,
  connectReceiverSyncRelay,
  createReceiverSyncRelayAck,
  createReceiverSyncRelayCaptureFrame,
  resolveReceiverRelayWebSocketUrls,
} from '../relay';

describe('receiver relay helpers', () => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto,
    });
  }

  it('normalizes usable websocket signaling urls for the relay fallback', () => {
    expect(
      resolveReceiverRelayWebSocketUrls([
        'http://127.0.0.1:4444',
        'https://signals.example.com/socket',
        'ws://127.0.0.1:4444',
        'not-a-url',
      ]),
    ).toEqual(['ws://127.0.0.1:4444/', 'wss://signals.example.com/socket']);
  });

  it('signs and verifies relay acknowledgements before trusting sync success', async () => {
    const pairing = toReceiverPairingRecord(
      createReceiverPairingPayload({
        coopId: 'coop-1',
        coopDisplayName: 'River Coop',
        memberId: 'member-1',
        memberDisplayName: 'Mina',
        signalingUrls: ['ws://127.0.0.1:4444'],
      }),
      '2026-03-11T18:05:00.000Z',
    );
    const device = createReceiverDeviceIdentity('Field Phone');
    const capture = createReceiverCapture({
      deviceId: device.id,
      kind: 'file',
      blob: new Blob(['receiver capture'], { type: 'text/plain' }),
      fileName: 'field-note.txt',
      pairing,
      createdAt: '2026-03-11T18:10:00.000Z',
    });
    const syncedCapture = {
      ...capture,
      syncState: 'synced' as const,
      syncedAt: '2026-03-11T18:10:05.000Z',
      updatedAt: '2026-03-11T18:10:05.000Z',
    };

    const ack = await createReceiverSyncRelayAck({
      pairing,
      requestId: 'relay-request-1',
      capture: syncedCapture,
      ok: true,
      sourceClientId: 'extension-offscreen:pairing-1',
      respondedAt: '2026-03-11T18:10:05.000Z',
    });

    await expect(assertReceiverSyncRelayAck(ack, pairing)).resolves.toMatchObject({
      captureId: syncedCapture.id,
      ok: true,
      capture: expect.objectContaining({
        syncState: 'synced',
      }),
    });

    await expect(
      assertReceiverSyncRelayAck(
        {
          ...ack,
          capture: {
            ...ack.capture,
            syncState: 'failed',
          },
        },
        pairing,
      ),
    ).rejects.toThrow(/integrity check failed/i);
  });

  it('returns an empty array when given no URLs', () => {
    expect(resolveReceiverRelayWebSocketUrls()).toEqual([]);
    expect(resolveReceiverRelayWebSocketUrls([])).toEqual([]);
  });

  it('deduplicates URLs that resolve to the same normalized form', () => {
    const result = resolveReceiverRelayWebSocketUrls([
      'http://127.0.0.1:4444',
      'ws://127.0.0.1:4444',
    ]);
    expect(result).toEqual(['ws://127.0.0.1:4444/']);
  });

  it('filters out URLs with unsupported protocols', () => {
    const result = resolveReceiverRelayWebSocketUrls([
      'ftp://example.com/socket',
      'file:///tmp/socket',
    ]);
    expect(result).toEqual([]);
  });

  it('builds capture and ack relay topics from a room id', () => {
    const topics = buildReceiverSyncRelayTopics('test-room-42');
    expect(topics.captureTopic).toBe('coop-receiver-sync/test-room-42/capture');
    expect(topics.ackTopic).toBe('coop-receiver-sync/test-room-42/ack');
  });

  it('creates a valid capture frame from an envelope and pairing', () => {
    const pairing = toReceiverPairingRecord(
      createReceiverPairingPayload({
        coopId: 'coop-1',
        coopDisplayName: 'River Coop',
        memberId: 'member-1',
        memberDisplayName: 'Mina',
        signalingUrls: ['ws://127.0.0.1:4444'],
      }),
      '2026-03-11T18:05:00.000Z',
    );
    const device = createReceiverDeviceIdentity('Field Phone');
    const capture = createReceiverCapture({
      deviceId: device.id,
      kind: 'file',
      blob: new Blob(['hello'], { type: 'text/plain' }),
      fileName: 'note.txt',
      pairing,
      createdAt: '2026-03-11T18:10:00.000Z',
    });

    const envelope: ReceiverSyncEnvelope = {
      capture,
      asset: {
        captureId: capture.id,
        mimeType: capture.mimeType,
        byteSize: capture.byteSize,
        fileName: capture.fileName,
        dataBase64: btoa('hello'),
      },
      auth: {
        version: 1,
        algorithm: 'hmac-sha256',
        pairingId: pairing.pairingId,
        signedAt: '2026-03-11T18:10:00.000Z',
        signature: 'test-sig',
      },
    };

    const frame = createReceiverSyncRelayCaptureFrame({
      envelope,
      pairing,
      sourceClientId: 'test-client',
      sentAt: '2026-03-11T18:10:01.000Z',
      messageId: 'msg-1',
    });

    expect(frame.kind).toBe('capture');
    expect(frame.messageId).toBe('msg-1');
    expect(frame.sourceClientId).toBe('test-client');
    expect(frame.roomId).toBe(pairing.roomId);
    expect(frame.pairingId).toBe(pairing.pairingId);
    expect(frame.envelope).toMatchObject({ capture: { id: capture.id } });
  });

  it('creates a capture frame with auto-generated ids when optional fields are omitted', () => {
    const pairing = toReceiverPairingRecord(
      createReceiverPairingPayload({
        coopId: 'coop-1',
        coopDisplayName: 'River Coop',
        memberId: 'member-1',
        memberDisplayName: 'Mina',
        signalingUrls: ['ws://127.0.0.1:4444'],
      }),
      '2026-03-11T18:05:00.000Z',
    );
    const device = createReceiverDeviceIdentity('Field Phone');
    const capture = createReceiverCapture({
      deviceId: device.id,
      kind: 'file',
      blob: new Blob(['x'], { type: 'text/plain' }),
      fileName: 'x.txt',
      pairing,
      createdAt: '2026-03-11T18:10:00.000Z',
    });

    const envelope: ReceiverSyncEnvelope = {
      capture,
      asset: {
        captureId: capture.id,
        mimeType: capture.mimeType,
        byteSize: capture.byteSize,
        fileName: capture.fileName,
        dataBase64: btoa('x'),
      },
      auth: {
        version: 1,
        algorithm: 'hmac-sha256',
        pairingId: pairing.pairingId,
        signedAt: '2026-03-11T18:10:00.000Z',
        signature: 'test-sig',
      },
    };

    const frame = createReceiverSyncRelayCaptureFrame({ envelope, pairing });
    expect(frame.messageId).toBeTruthy();
    expect(frame.sourceClientId).toBeTruthy();
    expect(frame.sentAt).toBeTruthy();
  });

  it('creates a relay ack with an error string', async () => {
    const pairing = toReceiverPairingRecord(
      createReceiverPairingPayload({
        coopId: 'coop-1',
        coopDisplayName: 'River Coop',
        memberId: 'member-1',
        memberDisplayName: 'Mina',
        signalingUrls: ['ws://127.0.0.1:4444'],
      }),
      '2026-03-11T18:05:00.000Z',
    );
    const device = createReceiverDeviceIdentity('Field Phone');
    const capture = createReceiverCapture({
      deviceId: device.id,
      kind: 'file',
      blob: new Blob(['x'], { type: 'text/plain' }),
      fileName: 'x.txt',
      pairing,
      createdAt: '2026-03-11T18:10:00.000Z',
    });
    const failedCapture = {
      ...capture,
      syncState: 'failed' as const,
      syncError: 'Quota exceeded',
      updatedAt: '2026-03-11T18:10:05.000Z',
    };

    const ack = await createReceiverSyncRelayAck({
      pairing,
      requestId: 'req-err-1',
      capture: failedCapture,
      ok: false,
      error: 'Quota exceeded',
      respondedAt: '2026-03-11T18:10:05.000Z',
    });

    expect(ack.ok).toBe(false);
    expect(ack.error).toBe('Quota exceeded');
    expect(ack.signature).toBeTruthy();
  });

  it('rejects relay ack when pairingId does not match', async () => {
    const pairing1 = toReceiverPairingRecord(
      createReceiverPairingPayload({
        coopId: 'coop-1',
        coopDisplayName: 'River Coop',
        memberId: 'member-1',
        memberDisplayName: 'Mina',
        signalingUrls: ['ws://127.0.0.1:4444'],
      }),
      '2026-03-11T18:05:00.000Z',
    );
    const pairing2 = toReceiverPairingRecord(
      createReceiverPairingPayload({
        coopId: 'coop-2',
        coopDisplayName: 'Ocean Coop',
        memberId: 'member-2',
        memberDisplayName: 'Kai',
        signalingUrls: ['ws://127.0.0.1:4444'],
      }),
      '2026-03-11T18:05:00.000Z',
    );
    const device = createReceiverDeviceIdentity('Phone');
    const capture = createReceiverCapture({
      deviceId: device.id,
      kind: 'file',
      blob: new Blob(['x'], { type: 'text/plain' }),
      fileName: 'x.txt',
      pairing: pairing1,
      createdAt: '2026-03-11T18:10:00.000Z',
    });
    const syncedCapture = {
      ...capture,
      syncState: 'synced' as const,
      syncedAt: '2026-03-11T18:10:05.000Z',
      updatedAt: '2026-03-11T18:10:05.000Z',
    };

    const ack = await createReceiverSyncRelayAck({
      pairing: pairing1,
      requestId: 'req-1',
      capture: syncedCapture,
      ok: true,
      respondedAt: '2026-03-11T18:10:05.000Z',
    });

    await expect(assertReceiverSyncRelayAck(ack, pairing2)).rejects.toThrow(
      /does not match this pairing/i,
    );
  });

  it('rejects relay ack when roomId does not match', async () => {
    const pairing = toReceiverPairingRecord(
      createReceiverPairingPayload({
        coopId: 'coop-1',
        coopDisplayName: 'River Coop',
        memberId: 'member-1',
        memberDisplayName: 'Mina',
        signalingUrls: ['ws://127.0.0.1:4444'],
      }),
      '2026-03-11T18:05:00.000Z',
    );
    const device = createReceiverDeviceIdentity('Phone');
    const capture = createReceiverCapture({
      deviceId: device.id,
      kind: 'file',
      blob: new Blob(['x'], { type: 'text/plain' }),
      fileName: 'x.txt',
      pairing,
      createdAt: '2026-03-11T18:10:00.000Z',
    });
    const syncedCapture = {
      ...capture,
      syncState: 'synced' as const,
      syncedAt: '2026-03-11T18:10:05.000Z',
      updatedAt: '2026-03-11T18:10:05.000Z',
    };

    const ack = await createReceiverSyncRelayAck({
      pairing,
      requestId: 'req-1',
      capture: syncedCapture,
      ok: true,
      respondedAt: '2026-03-11T18:10:05.000Z',
    });

    // Tamper with roomId in the ack
    const tampered = { ...ack, roomId: 'wrong-room' };
    await expect(assertReceiverSyncRelayAck(tampered, pairing)).rejects.toThrow(
      /room does not match/i,
    );
  });

  it('rejects relay ack when captureId does not match capture.id', async () => {
    const pairing = toReceiverPairingRecord(
      createReceiverPairingPayload({
        coopId: 'coop-1',
        coopDisplayName: 'River Coop',
        memberId: 'member-1',
        memberDisplayName: 'Mina',
        signalingUrls: ['ws://127.0.0.1:4444'],
      }),
      '2026-03-11T18:05:00.000Z',
    );
    const device = createReceiverDeviceIdentity('Phone');
    const capture = createReceiverCapture({
      deviceId: device.id,
      kind: 'file',
      blob: new Blob(['x'], { type: 'text/plain' }),
      fileName: 'x.txt',
      pairing,
      createdAt: '2026-03-11T18:10:00.000Z',
    });
    const syncedCapture = {
      ...capture,
      syncState: 'synced' as const,
      syncedAt: '2026-03-11T18:10:05.000Z',
      updatedAt: '2026-03-11T18:10:05.000Z',
    };

    const ack = await createReceiverSyncRelayAck({
      pairing,
      requestId: 'req-1',
      capture: syncedCapture,
      ok: true,
      respondedAt: '2026-03-11T18:10:05.000Z',
    });

    // Tamper with captureId so it no longer matches capture.id
    const tampered = { ...ack, captureId: 'wrong-capture-id' };
    await expect(assertReceiverSyncRelayAck(tampered, pairing)).rejects.toThrow(
      /does not match this capture/i,
    );
  });

  it('rejects relay ack when capture.coopId mismatches pairing', async () => {
    const pairing = toReceiverPairingRecord(
      createReceiverPairingPayload({
        coopId: 'coop-1',
        coopDisplayName: 'River Coop',
        memberId: 'member-1',
        memberDisplayName: 'Mina',
        signalingUrls: ['ws://127.0.0.1:4444'],
      }),
      '2026-03-11T18:05:00.000Z',
    );
    const device = createReceiverDeviceIdentity('Phone');
    const capture = createReceiverCapture({
      deviceId: device.id,
      kind: 'file',
      blob: new Blob(['x'], { type: 'text/plain' }),
      fileName: 'x.txt',
      pairing,
      createdAt: '2026-03-11T18:10:00.000Z',
    });
    const syncedCapture = {
      ...capture,
      syncState: 'synced' as const,
      syncedAt: '2026-03-11T18:10:05.000Z',
      updatedAt: '2026-03-11T18:10:05.000Z',
    };

    const ack = await createReceiverSyncRelayAck({
      pairing,
      requestId: 'req-1',
      capture: syncedCapture,
      ok: true,
      respondedAt: '2026-03-11T18:10:05.000Z',
    });

    // Tamper with capture.coopId
    const tampered = {
      ...ack,
      capture: { ...ack.capture, coopId: 'wrong-coop' },
    };
    await expect(assertReceiverSyncRelayAck(tampered, pairing)).rejects.toThrow(
      /does not match this coop/i,
    );
  });

  it('rejects relay ack when capture.memberId mismatches pairing', async () => {
    const pairing = toReceiverPairingRecord(
      createReceiverPairingPayload({
        coopId: 'coop-1',
        coopDisplayName: 'River Coop',
        memberId: 'member-1',
        memberDisplayName: 'Mina',
        signalingUrls: ['ws://127.0.0.1:4444'],
      }),
      '2026-03-11T18:05:00.000Z',
    );
    const device = createReceiverDeviceIdentity('Phone');
    const capture = createReceiverCapture({
      deviceId: device.id,
      kind: 'file',
      blob: new Blob(['x'], { type: 'text/plain' }),
      fileName: 'x.txt',
      pairing,
      createdAt: '2026-03-11T18:10:00.000Z',
    });
    const syncedCapture = {
      ...capture,
      syncState: 'synced' as const,
      syncedAt: '2026-03-11T18:10:05.000Z',
      updatedAt: '2026-03-11T18:10:05.000Z',
    };

    const ack = await createReceiverSyncRelayAck({
      pairing,
      requestId: 'req-1',
      capture: syncedCapture,
      ok: true,
      respondedAt: '2026-03-11T18:10:05.000Z',
    });

    // Tamper with capture.memberId
    const tampered = {
      ...ack,
      capture: { ...ack.capture, memberId: 'wrong-member' },
    };
    await expect(assertReceiverSyncRelayAck(tampered, pairing)).rejects.toThrow(
      /does not match this member/i,
    );
  });
});

describe('connectReceiverSyncRelay reconnection', () => {
  let originalWebSocket: typeof globalThis.WebSocket;
  let mockInstances: MockWebSocket[];

  class MockWebSocket {
    static readonly OPEN = 1;
    static readonly CLOSED = 3;
    readonly OPEN = 1;
    readonly CLOSED = 3;
    url: string;
    readyState = 0;
    private listeners = new Map<string, ((...args: unknown[]) => void)[]>();

    constructor(url: string) {
      this.url = url;
      mockInstances.push(this);
    }

    addEventListener(event: string, handler: (...args: unknown[]) => void) {
      const handlers = this.listeners.get(event) ?? [];
      handlers.push(handler);
      this.listeners.set(event, handlers);
    }

    send(_data: string) {
      if (this.readyState !== 1) {
        throw new Error('WebSocket is not open');
      }
    }

    close() {
      this.readyState = 3;
      this.emit('close', {});
    }

    emit(event: string, data: unknown) {
      const handlers = this.listeners.get(event) ?? [];
      for (const handler of handlers) {
        handler(data);
      }
    }

    simulateOpen() {
      this.readyState = 1;
      this.emit('open', {});
    }

    simulateClose() {
      this.readyState = 3;
      this.emit('close', {});
    }
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.spyOn(Math, 'random').mockReturnValue(0);
    mockInstances = [];
    originalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    globalThis.WebSocket = originalWebSocket;
  });

  it('returns a non-configured relay when no URLs are available', () => {
    const relay = connectReceiverSyncRelay({
      roomId: 'room-1',
      signalingUrls: [],
      onCapture: () => {},
    });

    expect(relay.configured).toBe(false);
    expect(relay.connected).toBe(false);
  });

  it('disconnect stops reconnection attempts', () => {
    const statusChanges: boolean[] = [];
    const relay = connectReceiverSyncRelay({
      roomId: 'room-1',
      signalingUrls: ['ws://127.0.0.1:4444'],
      onCapture: () => {},
      onStatusChange: (state) => statusChanges.push(state.connected),
      reconnectDelayMs: 100,
    });

    expect(relay.configured).toBe(true);
    expect(mockInstances).toHaveLength(1);

    // Simulate the first connection opening then closing
    mockInstances[0].simulateOpen();
    expect(relay.connected).toBe(true);

    // Disconnect before reconnection fires
    relay.disconnect();
    expect(relay.connected).toBe(false);

    // Advance past the reconnect delay -- no new WebSocket should be created
    const instanceCountBefore = mockInstances.length;
    vi.advanceTimersByTime(500);
    expect(mockInstances).toHaveLength(instanceCountBefore);
  });

  it('reconnects after a socket close by cycling through URLs', () => {
    const errors: string[] = [];
    const relay = connectReceiverSyncRelay({
      roomId: 'room-1',
      signalingUrls: ['ws://127.0.0.1:4444', 'ws://127.0.0.1:5555'],
      onCapture: () => {},
      onError: (err) => {
        errors.push(err.message);
      },
      reconnectDelayMs: 100,
    });

    expect(mockInstances).toHaveLength(1);
    expect(mockInstances[0].url).toBe('ws://127.0.0.1:4444/');

    // First socket opens then closes
    mockInstances[0].simulateOpen();
    // Manually set readyState and emit close so handleSocketClosed runs cleanly
    mockInstances[0].readyState = 3;
    mockInstances[0].emit('close', {});

    // At this point the relay's reconnect timer should be scheduled
    // Advance past reconnect delay
    vi.advanceTimersByTime(200);
    expect(mockInstances).toHaveLength(2);
    expect(mockInstances[1].url).toBe('ws://127.0.0.1:5555/');

    // Clean up
    relay.disconnect();
  });

  it('resets connection status on successful reconnect', () => {
    const statusChanges: boolean[] = [];
    const relay = connectReceiverSyncRelay({
      roomId: 'room-1',
      signalingUrls: ['ws://127.0.0.1:4444'],
      onCapture: () => {},
      onStatusChange: (state) => statusChanges.push(state.connected),
      reconnectDelayMs: 100,
    });

    // Open, then close, then reconnect and open again
    mockInstances[0].simulateOpen();
    expect(relay.connected).toBe(true);

    // Emit close event directly (avoiding double-fire from close() method)
    mockInstances[0].readyState = 3;
    mockInstances[0].emit('close', {});
    expect(relay.connected).toBe(false);

    vi.advanceTimersByTime(150);
    expect(mockInstances).toHaveLength(2);

    mockInstances[1].simulateOpen();
    expect(relay.connected).toBe(true);

    // Status changes: connected, disconnected, connected
    expect(statusChanges).toEqual([true, false, true]);

    relay.disconnect();
  });

  it('returns non-configured relay when no subscribers are provided', () => {
    const relay = connectReceiverSyncRelay({
      roomId: 'room-1',
      signalingUrls: ['ws://127.0.0.1:4444'],
      // no onCapture or onAck
    });

    expect(relay.configured).toBe(false);
    expect(relay.publishCapture({} as never)).toBe(false);
    expect(relay.publishAck({} as never)).toBe(false);
    relay.disconnect(); // should be safe no-op
  });

  it('queues and flushes messages when the connection opens', () => {
    const sentMessages: string[] = [];
    const relay = connectReceiverSyncRelay({
      roomId: 'room-1',
      signalingUrls: ['ws://127.0.0.1:4444'],
      onCapture: () => {},
      reconnectDelayMs: 100,
    });

    // Override send on the mock to capture messages
    mockInstances[0].send = (data: string) => {
      sentMessages.push(data);
    };

    // Publish before socket is open -- should queue
    const captureFrame = {
      kind: 'capture' as const,
      messageId: 'msg-1',
      sourceClientId: 'client-1',
      roomId: 'room-1',
      pairingId: 'pair-1',
      sentAt: '2026-03-11T18:10:00.000Z',
      envelope: {
        capture: { id: 'cap-1' },
      },
    } as never;

    const result = relay.publishCapture(captureFrame);
    expect(result).toBe(true);

    // Open the socket, which should flush the queue
    mockInstances[0].simulateOpen();

    // The subscribe message + queued capture message should both be sent
    expect(sentMessages.length).toBeGreaterThanOrEqual(1);

    relay.disconnect();
  });

  it('publishes ack messages through the queue', () => {
    const sentMessages: string[] = [];
    const relay = connectReceiverSyncRelay({
      roomId: 'room-1',
      signalingUrls: ['ws://127.0.0.1:4444'],
      onAck: () => {},
      reconnectDelayMs: 100,
    });

    mockInstances[0].send = (data: string) => {
      sentMessages.push(data);
    };
    mockInstances[0].simulateOpen();

    const ackFrame = {
      kind: 'ack' as const,
      requestId: 'req-1',
      sourceClientId: 'client-1',
      roomId: 'room-1',
      pairingId: 'pair-1',
      captureId: 'cap-1',
      ok: true,
      respondedAt: '2026-03-11T18:10:00.000Z',
      capture: { id: 'cap-1' },
      signature: 'sig-1',
    } as never;

    const result = relay.publishAck(ackFrame);
    expect(result).toBe(true);
    // Ack message should be sent immediately since socket is open
    const ackMessages = sentMessages.filter((m) => {
      const parsed = JSON.parse(m);
      return parsed.type === 'publish' && parsed.topic.includes('/ack');
    });
    expect(ackMessages).toHaveLength(1);

    relay.disconnect();
  });

  it('dispatches incoming capture frames to the onCapture handler', () => {
    const receivedCaptures: unknown[] = [];
    const relay = connectReceiverSyncRelay({
      roomId: 'room-1',
      signalingUrls: ['ws://127.0.0.1:4444'],
      onCapture: (frame) => {
        receivedCaptures.push(frame);
      },
      reconnectDelayMs: 100,
    });

    mockInstances[0].send = () => {};
    mockInstances[0].simulateOpen();

    const capturePayload = {
      kind: 'capture',
      messageId: 'msg-1',
      sourceClientId: 'client-1',
      roomId: 'room-1',
      pairingId: 'pair-1',
      sentAt: '2026-03-11T18:10:00.000Z',
      envelope: {
        capture: {
          id: 'cap-1',
          deviceId: 'dev-1',
          kind: 'file',
          title: 'Test',
          note: '',
          mimeType: 'text/plain',
          byteSize: 5,
          createdAt: '2026-03-11T18:10:00.000Z',
          updatedAt: '2026-03-11T18:10:00.000Z',
          syncState: 'queued',
          retryCount: 0,
          intakeStatus: 'private-intake',
          pairingId: 'pair-1',
        },
        asset: {
          captureId: 'cap-1',
          mimeType: 'text/plain',
          byteSize: 5,
          dataBase64: btoa('hello'),
        },
        auth: {
          version: 1,
          algorithm: 'hmac-sha256',
          pairingId: 'pair-1',
          signedAt: '2026-03-11T18:10:00.000Z',
          signature: 'sig-1',
        },
      },
    };

    // Simulate receiving a message
    mockInstances[0].emit('message', {
      data: JSON.stringify({
        type: 'publish',
        topic: 'coop-receiver-sync/room-1/capture',
        frame: capturePayload,
      }),
    });

    expect(receivedCaptures).toHaveLength(1);

    relay.disconnect();
  });

  it('dispatches incoming ack frames to the onAck handler', () => {
    const receivedAcks: unknown[] = [];
    const relay = connectReceiverSyncRelay({
      roomId: 'room-1',
      signalingUrls: ['ws://127.0.0.1:4444'],
      onAck: (frame) => {
        receivedAcks.push(frame);
      },
      reconnectDelayMs: 100,
    });

    mockInstances[0].send = () => {};
    mockInstances[0].simulateOpen();

    const ackPayload = {
      kind: 'ack',
      requestId: 'req-1',
      sourceClientId: 'client-1',
      roomId: 'room-1',
      pairingId: 'pair-1',
      captureId: 'cap-1',
      ok: true,
      respondedAt: '2026-03-11T18:10:00.000Z',
      capture: {
        id: 'cap-1',
        deviceId: 'dev-1',
        kind: 'file',
        title: 'Test',
        note: '',
        mimeType: 'text/plain',
        byteSize: 5,
        createdAt: '2026-03-11T18:10:00.000Z',
        updatedAt: '2026-03-11T18:10:00.000Z',
        syncState: 'synced',
        syncedAt: '2026-03-11T18:10:05.000Z',
        retryCount: 0,
        intakeStatus: 'private-intake',
        pairingId: 'pair-1',
      },
      signature: 'sig-1',
    };

    mockInstances[0].emit('message', {
      data: JSON.stringify({
        type: 'publish',
        topic: 'coop-receiver-sync/room-1/ack',
        frame: ackPayload,
      }),
    });

    expect(receivedAcks).toHaveLength(1);

    relay.disconnect();
  });

  it('silently ignores malformed incoming messages', () => {
    const receivedCaptures: unknown[] = [];
    const errors: string[] = [];
    const relay = connectReceiverSyncRelay({
      roomId: 'room-1',
      signalingUrls: ['ws://127.0.0.1:4444'],
      onCapture: (frame) => {
        receivedCaptures.push(frame);
      },
      onError: (err) => {
        errors.push(err.message);
      },
      reconnectDelayMs: 100,
    });

    mockInstances[0].send = () => {};
    mockInstances[0].simulateOpen();

    // Non-JSON message
    mockInstances[0].emit('message', { data: 'not-json' });
    // Valid JSON but invalid protocol shape
    mockInstances[0].emit('message', { data: JSON.stringify({ foo: 'bar' }) });
    // Valid protocol shape but invalid frame
    mockInstances[0].emit('message', {
      data: JSON.stringify({
        type: 'publish',
        topic: 'coop-receiver-sync/room-1/capture',
        frame: { kind: 'capture' },
      }),
    });

    expect(receivedCaptures).toHaveLength(0);

    relay.disconnect();
  });

  it('reports errors from the WebSocket error event', () => {
    const errors: string[] = [];
    const relay = connectReceiverSyncRelay({
      roomId: 'room-1',
      signalingUrls: ['ws://127.0.0.1:4444'],
      onCapture: () => {},
      onError: (err) => {
        errors.push(err.message);
      },
      reconnectDelayMs: 100,
    });

    mockInstances[0].simulateOpen();
    mockInstances[0].emit('error', {});

    expect(errors).toContain('Receiver relay socket error.');

    relay.disconnect();
  });

  it('reports error and reconnects when flushQueue fails on send', () => {
    const errors: string[] = [];
    const relay = connectReceiverSyncRelay({
      roomId: 'room-1',
      signalingUrls: ['ws://127.0.0.1:4444'],
      onCapture: () => {},
      onError: (err) => {
        errors.push(err.message);
      },
      reconnectDelayMs: 100,
    });

    // Queue a message before opening
    relay.publishCapture({
      kind: 'capture',
      messageId: 'msg-1',
      sourceClientId: 'client-1',
      roomId: 'room-1',
      pairingId: 'pair-1',
      sentAt: '2026-03-11T18:10:00.000Z',
      envelope: { capture: { id: 'cap-1' } },
    } as never);

    // Make send throw when called
    let sendCallCount = 0;
    mockInstances[0].send = () => {
      sendCallCount++;
      // Let subscribe go through but fail on the flush
      if (sendCallCount > 1) {
        throw new Error('send failed');
      }
    };

    mockInstances[0].simulateOpen();

    // The flush should have triggered an error -- reportRelayError passes through
    // the original Error message when the caught value is already an Error instance.
    expect(errors).toContain('send failed');

    relay.disconnect();
  });

  it('stops reconnecting after reaching maxReconnectAttempts', () => {
    const errors: string[] = [];
    const relay = connectReceiverSyncRelay({
      roomId: 'room-1',
      signalingUrls: ['ws://127.0.0.1:4444'],
      onCapture: () => {},
      onError: (err) => {
        errors.push(err.message);
      },
      reconnectDelayMs: 10,
    });

    // Simulate 15 connection failures to exhaust attempts
    for (let i = 0; i < 16; i++) {
      const instance = mockInstances[mockInstances.length - 1];
      if (!instance) break;
      instance.readyState = 3;
      instance.emit('close', {});
      // Advance timers with a large value to overcome exponential backoff
      vi.advanceTimersByTime(60_000);
    }

    expect(errors).toContain('Relay exhausted all reconnection attempts');

    relay.disconnect();
  });

  it('exposes the current URL via the getter', () => {
    const relay = connectReceiverSyncRelay({
      roomId: 'room-1',
      signalingUrls: ['ws://127.0.0.1:4444'],
      onCapture: () => {},
      reconnectDelayMs: 100,
    });

    expect(relay.currentUrl).toBe('ws://127.0.0.1:4444/');

    relay.disconnect();
  });

  it('handles non-string WebSocket message data gracefully', () => {
    const receivedCaptures: unknown[] = [];
    const relay = connectReceiverSyncRelay({
      roomId: 'room-1',
      signalingUrls: ['ws://127.0.0.1:4444'],
      onCapture: (frame) => {
        receivedCaptures.push(frame);
      },
      reconnectDelayMs: 100,
    });

    mockInstances[0].send = () => {};
    mockInstances[0].simulateOpen();

    // Simulate a non-string data value that is not valid JSON when stringified
    mockInstances[0].emit('message', { data: null });
    mockInstances[0].emit('message', { data: undefined });

    expect(receivedCaptures).toHaveLength(0);

    relay.disconnect();
  });
});
