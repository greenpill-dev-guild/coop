import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sharedMocks = vi.hoisted(() => {
  class MockYMap<T> {
    private readonly items = new Map<string, T>();
    private readonly observers = new Set<() => void>();

    set(key: string, value: T) {
      this.items.set(key, value);
      for (const observer of this.observers) {
        observer();
      }
      return this;
    }

    get(key: string) {
      return this.items.get(key);
    }

    has(key: string) {
      return this.items.has(key);
    }

    entries() {
      return this.items.entries();
    }

    values() {
      return this.items.values();
    }

    observe(callback: () => void) {
      this.observers.add(callback);
    }

    unobserve(callback: () => void) {
      this.observers.delete(callback);
    }
  }

  function createMockHandoffDoc() {
    const maps = new Map<string, MockYMap<string>>();
    return {
      destroy: vi.fn(),
      getMap: vi.fn((name: string) => {
        let map = maps.get(name);
        if (!map) {
          map = new MockYMap<string>();
          maps.set(name, map);
        }
        return map;
      }),
    };
  }

  return {
    applyCoopDocSnapshot: vi.fn(),
    assertInviteHandoffPayloadMatchesInvite: vi.fn(),
    buildIceServers: vi.fn(() => ['stun:coop.test']),
    buildRedactedSyncRoomSecret: vi.fn(
      (coopId: string, roomId: string) => `encrypted://local/sync-room-secret/${coopId}/${roomId}`,
    ),
    compactCoopArtifacts: vi.fn(() => ({ archivedIds: [] as string[], remainingCount: 1 })),
    connectInviteHandoffProviders: vi.fn(),
    connectSyncProviders: vi.fn(),
    createRoomRotationAnnouncement: vi.fn(
      ({
        currentRoom,
        retiredRoom,
        createdAt,
      }: {
        currentRoom: {
          coopId: string;
          roomId: string;
          roomEpoch?: number;
          previousRoomIds?: string[];
          signalingUrls: string[];
          rotatedAt?: string;
          rotatedBy?: string;
        };
        retiredRoom: { roomId: string };
        createdAt?: string;
      }) => ({
        announcementId: `room-rotation:${currentRoom.roomId}`,
        coopId: currentRoom.coopId,
        previousRoomId: retiredRoom.roomId,
        roomId: currentRoom.roomId,
        roomEpoch: currentRoom.roomEpoch ?? 1,
        previousRoomIds: currentRoom.previousRoomIds ?? [],
        signalingUrls: currentRoom.signalingUrls,
        rotatedAt: currentRoom.rotatedAt,
        rotatedBy: currentRoom.rotatedBy,
        createdAt: createdAt ?? '2026-05-17T00:00:00.000Z',
        proof: 'rotation-proof',
      }),
    ),
    createBlobRelayTransport: vi.fn(() => undefined),
    createInviteHandoffRequest: vi.fn(),
    createCoopDb: vi.fn(() => ({})),
    createCoopDoc: vi.fn(),
    decryptInviteHandoffPayload: vi.fn(),
    deriveSyncRoomId: vi.fn((coopId: string, roomSecret: string) =>
      roomSecret === 'room-secret-new' ? 'room-2' : `${coopId}:${roomSecret}`,
    ),
    encodeCoopDoc: vi.fn(() => new Uint8Array([9, 9, 9])),
    encodeCoopDocSnapshot: vi.fn(() => new Uint8Array([8, 8, 8])),
    encryptInviteHandoffPayload: vi.fn(),
    hashJson: vi.fn((value: unknown) => JSON.stringify(value)),
    hydrateCoopDoc: vi.fn(() => createMockHandoffDoc()),
    isRedactedSyncRoomSecret: vi.fn(
      (value: string | undefined) =>
        typeof value === 'string' && value.startsWith('encrypted://local/sync-room-secret/'),
    ),
    inviteHandoffRequestSchema: {
      parse: vi.fn((value: unknown) => value),
    },
    inviteHandoffResponseSchema: {
      parse: vi.fn((value: unknown) => value),
    },
    isPreferredSyncRoomRotation: vi.fn(
      (
        candidate: { roomEpoch?: number; rotatedAt?: string; rotatedBy?: string; roomId: string },
        current: { roomEpoch?: number; rotatedAt?: string; rotatedBy?: string; roomId: string },
      ) =>
        [
          String(candidate.roomEpoch ?? 1).padStart(12, '0'),
          candidate.rotatedAt ?? '',
          candidate.rotatedBy ?? '',
          candidate.roomId,
        ].join('\u0000') >
        [
          String(current.roomEpoch ?? 1).padStart(12, '0'),
          current.rotatedAt ?? '',
          current.rotatedBy ?? '',
          current.roomId,
        ].join('\u0000'),
    ),
    mergeCoopDocUpdates: vi.fn(() => new Uint8Array([1, 2, 3])),
    parseInviteCode: vi.fn(),
    readCoopState: vi.fn(),
    redactSyncRoomSecrets: vi.fn(
      (room: {
        coopId: string;
        roomId: string;
        roomSecret: string;
        inviteSigningSecret: string;
        signalingUrls: string[];
      }) => ({
        ...room,
        roomSecret: `encrypted://local/sync-room-secret/${room.coopId}/${room.roomId}`,
        inviteSigningSecret: `encrypted://local/sync-room-secret/${room.coopId}/${room.roomId}/invite`,
      }),
    ),
    summarizeSyncTransportHealth: vi.fn(() => ({
      syncError: false,
      note: 'WebSocket sync connected.',
      configuredSignalingCount: 1,
      signalingConnectionCount: 1,
      peerCount: 1,
      broadcastPeerCount: 0,
      websocketConnected: true,
    })),
    validateInvite: vi.fn(() => true),
    verifyInviteCodeProof: vi.fn(() => true),
    verifyRoomRotationAnnouncement: vi.fn((value: unknown) => value),
    writeCoopState: vi.fn(),
    createMockHandoffDoc,
  };
});

const blobMocks = vi.hoisted(() => ({
  broadcastManifest: vi.fn(),
  destroy: vi.fn(),
  requestBlob: vi.fn(async () => new Uint8Array([4, 5, 6])),
}));

vi.mock('@coop/shared', () => {
  return {
    ORIGIN_LOCAL: 'local',
    applyCoopDocSnapshot: sharedMocks.applyCoopDocSnapshot,
    assertInviteHandoffPayloadMatchesInvite: sharedMocks.assertInviteHandoffPayloadMatchesInvite,
    buildIceServers: sharedMocks.buildIceServers,
    buildRedactedSyncRoomSecret: sharedMocks.buildRedactedSyncRoomSecret,
    compactCoopArtifacts: sharedMocks.compactCoopArtifacts,
    connectInviteHandoffProviders: sharedMocks.connectInviteHandoffProviders,
    connectSyncProviders: sharedMocks.connectSyncProviders,
    createRoomRotationAnnouncement: sharedMocks.createRoomRotationAnnouncement,
    createBlobRelayTransport: sharedMocks.createBlobRelayTransport,
    createInviteHandoffRequest: sharedMocks.createInviteHandoffRequest,
    createCoopDb: sharedMocks.createCoopDb,
    createCoopDoc: sharedMocks.createCoopDoc,
    decryptInviteHandoffPayload: sharedMocks.decryptInviteHandoffPayload,
    deriveSyncRoomId: sharedMocks.deriveSyncRoomId,
    encodeCoopDoc: sharedMocks.encodeCoopDoc,
    encodeCoopDocSnapshot: sharedMocks.encodeCoopDocSnapshot,
    encryptInviteHandoffPayload: sharedMocks.encryptInviteHandoffPayload,
    hashJson: sharedMocks.hashJson,
    hydrateCoopDoc: sharedMocks.hydrateCoopDoc,
    isRedactedSyncRoomSecret: sharedMocks.isRedactedSyncRoomSecret,
    inviteHandoffRequestSchema: sharedMocks.inviteHandoffRequestSchema,
    inviteHandoffResponseSchema: sharedMocks.inviteHandoffResponseSchema,
    isPreferredSyncRoomRotation: sharedMocks.isPreferredSyncRoomRotation,
    mergeCoopDocUpdates: sharedMocks.mergeCoopDocUpdates,
    parseInviteCode: sharedMocks.parseInviteCode,
    readCoopState: sharedMocks.readCoopState,
    redactSyncRoomSecrets: sharedMocks.redactSyncRoomSecrets,
    summarizeSyncTransportHealth: sharedMocks.summarizeSyncTransportHealth,
    validateInvite: sharedMocks.validateInvite,
    verifyInviteCodeProof: sharedMocks.verifyInviteCodeProof,
    verifyRoomRotationAnnouncement: sharedMocks.verifyRoomRotationAnnouncement,
    writeCoopState: sharedMocks.writeCoopState,
  };
});

vi.mock('@coop/shared/blob-channel', () => ({
  createBlobSyncChannel: vi.fn(() => ({
    broadcastManifest: blobMocks.broadcastManifest,
    destroy: blobMocks.destroy,
    requestBlob: blobMocks.requestBlob,
  })),
}));

function buildCoop() {
  return {
    profile: {
      id: 'coop-1',
      name: 'Runtime Coop',
    },
    syncRoom: {
      coopId: 'coop-1',
      roomId: 'room-1',
      roomSecret: 'room-secret',
      inviteSigningSecret: 'invite-secret',
      signalingUrls: ['wss://signal.coop.test'],
    },
    members: [
      {
        id: 'member-creator',
        displayName: 'June',
        role: 'creator',
        authMode: 'passkey',
        address: '0x1111111111111111111111111111111111111111',
        joinedAt: '2026-05-17T00:00:00.000Z',
        identityWarning: 'Test member.',
      },
    ],
    invites: [
      {
        id: 'invite-1',
        type: 'member',
        expiresAt: '2026-06-01T00:00:00.000Z',
        code: 'invite-code',
        bootstrap: {
          coopId: 'coop-1',
          coopDisplayName: 'Runtime Coop',
          inviteId: 'invite-1',
          inviteType: 'member',
          expiresAt: '2026-06-01T00:00:00.000Z',
          roomId: 'room-1',
          signalingUrls: ['wss://signal.coop.test'],
          inviteProof: 'invite-proof',
          handoff: {
            inviteId: 'invite-1',
            roomId: 'invite-room-1',
            roomSecret: 'invite-room-secret',
            signalingUrls: ['wss://signal.coop.test'],
          },
        },
        createdAt: '2026-05-17T00:00:00.000Z',
        createdBy: 'member-creator',
        usedByMemberIds: [],
      },
    ],
  };
}

function buildCoopSyncConfigEntry(coop = buildCoop()) {
  return {
    coop: {
      ...coop,
      syncRoom: sharedMocks.redactSyncRoomSecrets(coop.syncRoom),
    },
    providerSyncRoom: coop.syncRoom,
    roomSecretAvailable: true,
    legacySecretMigrated: true,
    roomEpoch: 2,
  };
}

describe('coop sync offscreen runtime', () => {
  let sendMessageMock: ReturnType<typeof vi.fn>;
  let onRuntimeMessage:
    | ((
        message: {
          type?: string;
          payload?: { coopId?: string; blobId?: string; force?: boolean; reason?: string };
        },
        sender?: unknown,
        sendResponse?: (response: unknown) => void,
      ) => boolean | undefined)
    | null;
  let onUnload: ((event: Event) => void) | null;
  let providersDisconnectMock: ReturnType<typeof vi.fn>;
  let docOffMock: ReturnType<typeof vi.fn>;
  let scheduledTimeouts: Map<number, () => void>;
  let nextTimerId: number;

  async function flushMicrotasks(iterations = 32) {
    for (let index = 0; index < iterations; index += 1) {
      await Promise.resolve();
    }
  }

  async function runScheduledTimeouts() {
    const callbacks = [...scheduledTimeouts.values()];
    scheduledTimeouts.clear();
    for (const callback of callbacks) {
      callback();
      await flushMicrotasks();
    }
  }

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();

    onRuntimeMessage = null;
    onUnload = null;
    providersDisconnectMock = vi.fn();
    docOffMock = vi.fn();
    scheduledTimeouts = new Map();
    nextTimerId = 1;

    const coop = {
      ...buildCoop(),
      syncRoom: {
        ...buildCoop().syncRoom,
        roomEpoch: 2,
        previousRoomIds: ['room-old'],
      },
    };
    sharedMocks.isRedactedSyncRoomSecret.mockImplementation(
      (value: string | undefined) =>
        typeof value === 'string' && value.startsWith('encrypted://local/sync-room-secret/'),
    );
    sharedMocks.redactSyncRoomSecrets.mockImplementation(
      (room: {
        coopId: string;
        roomId: string;
        roomSecret: string;
        inviteSigningSecret: string;
        signalingUrls: string[];
      }) => ({
        ...room,
        roomSecret: `encrypted://local/sync-room-secret/${room.coopId}/${room.roomId}`,
        inviteSigningSecret: `encrypted://local/sync-room-secret/${room.coopId}/${room.roomId}/invite`,
      }),
    );
    sharedMocks.buildIceServers.mockReturnValue(['stun:coop.test']);
    sharedMocks.createBlobRelayTransport.mockReturnValue(undefined);
    sharedMocks.createCoopDb.mockReturnValue({});
    sharedMocks.connectInviteHandoffProviders.mockReturnValue({
      disconnect: vi.fn(),
    });
    sharedMocks.createInviteHandoffRequest.mockResolvedValue({
      request: {
        requestId: 'handoff-request-joiner',
        coopId: 'coop-1',
        inviteId: 'invite-1',
        memberId: 'member-joiner',
        memberDisplayName: 'Mina',
        publicKeyJwk: {},
        createdAt: '2026-05-17T00:00:00.000Z',
      },
      keyPair: {
        privateKey: {},
      },
    });
    sharedMocks.decryptInviteHandoffPayload.mockResolvedValue({
      requestId: 'handoff-request-joiner',
      coopId: 'coop-1',
      inviteId: 'invite-1',
      recipientMemberId: 'member-joiner',
      roomEpoch: 2,
      roomId: 'room-1',
      roomSecret: 'room-secret',
      inviteSigningSecret: 'invite-secret',
      signalingUrls: ['wss://signal.coop.test'],
      createdAt: '2026-05-17T00:00:00.000Z',
    });
    sharedMocks.deriveSyncRoomId.mockImplementation((coopId: string, roomSecret: string) =>
      roomSecret === 'room-secret-new' ? 'room-2' : `${coopId}:${roomSecret}`,
    );
    sharedMocks.encryptInviteHandoffPayload.mockImplementation(
      async ({
        request,
      }: {
        request: { requestId: string; coopId: string; inviteId: string; memberId: string };
      }) => ({
        requestId: request.requestId,
        coopId: request.coopId,
        inviteId: request.inviteId,
        memberId: request.memberId,
        roomId: 'room-1',
        signalingUrls: ['wss://signal.coop.test'],
        encryptedPayloadBase64: 'encrypted-payload',
        createdAt: '2026-05-17T00:00:00.000Z',
      }),
    );
    sharedMocks.parseInviteCode.mockReturnValue(coop.invites[0]);
    sharedMocks.validateInvite.mockReturnValue(true);
    sharedMocks.verifyInviteCodeProof.mockReturnValue(true);
    sharedMocks.encodeCoopDoc.mockReturnValue(new Uint8Array([9, 9, 9]));
    sharedMocks.encodeCoopDocSnapshot.mockReturnValue(new Uint8Array([8, 8, 8]));
    sharedMocks.hashJson.mockImplementation((value: unknown) => JSON.stringify(value));
    sharedMocks.mergeCoopDocUpdates.mockReturnValue(new Uint8Array([1, 2, 3]));
    sharedMocks.summarizeSyncTransportHealth.mockReturnValue({
      syncError: false,
      note: 'WebSocket sync connected.',
      configuredSignalingCount: 1,
      signalingConnectionCount: 1,
      peerCount: 1,
      broadcastPeerCount: 0,
      websocketConnected: true,
    });
    sharedMocks.writeCoopState.mockReturnValue(undefined);
    sharedMocks.createCoopDoc.mockImplementation(() => ({
      ...sharedMocks.createMockHandoffDoc(),
      on: vi.fn(),
      off: docOffMock,
    }));
    sharedMocks.connectSyncProviders.mockReturnValue({
      webrtc: {
        on: vi.fn(),
        off: vi.fn(),
        room: {
          webrtcConns: new Map([['peer-1', {}]]),
          bcConns: new Map(),
        },
        signalingUrls: ['wss://signal.coop.test'],
        signalingConns: [{ connected: true }],
      },
      websocket: {
        on: vi.fn(),
        off: vi.fn(),
        wsconnected: true,
      },
      disconnect: providersDisconnectMock,
    });
    sharedMocks.readCoopState.mockReturnValue(coop);
    sharedMocks.compactCoopArtifacts.mockReturnValue({ archivedIds: [], remainingCount: 1 });
    blobMocks.requestBlob.mockResolvedValue(new Uint8Array([4, 5, 6]));

    sendMessageMock = vi.fn(async (message: { type: string }) => {
      switch (message.type) {
        case 'get-coop-sync-config':
          return {
            ok: true,
            data: {
              coops: [buildCoopSyncConfigEntry(coop)],
              websocketSyncUrl: 'wss://api.coop.test/yws',
              iceConfig: {
                iceServers: [{ urls: ['turn:turn.coop.test:3478'] }],
                expiresAt: new Date(Date.now() + 60_000).toISOString(),
                degraded: false,
              },
            },
          };
        default:
          return { ok: true };
      }
    });

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        runtime: {
          sendMessage: sendMessageMock,
          onMessage: {
            addListener: vi.fn(
              (
                listener: (
                  message: {
                    type?: string;
                    payload?: { coopId?: string; blobId?: string; force?: boolean; reason?: string };
                  },
                  sender?: unknown,
                  sendResponse?: (response: unknown) => void,
                ) => boolean | undefined,
              ) => {
                onRuntimeMessage = listener;
              },
            ),
          },
        },
      },
    });

    vi.spyOn(window, 'addEventListener').mockImplementation(((
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) => {
      if (type === 'unload') {
        onUnload = listener as EventListener;
      }
    }) as typeof window.addEventListener);
    vi.spyOn(window, 'setTimeout').mockImplementation(((callback: TimerHandler) => {
      const timerId = nextTimerId;
      nextTimerId += 1;
      scheduledTimeouts.set(timerId, () => {
        if (typeof callback === 'function') {
          callback();
        }
      });
      return timerId;
    }) as typeof window.setTimeout);
    vi.spyOn(window, 'clearTimeout').mockImplementation(((timerId: number | undefined) => {
      if (typeof timerId === 'number') {
        scheduledTimeouts.delete(timerId);
      }
    }) as typeof window.clearTimeout);
    vi.spyOn(window, 'setInterval').mockImplementation(
      (() => 1) as unknown as typeof window.setInterval,
    );
    vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ update: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });

  afterEach(() => {
    onUnload?.(new Event('unload'));
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, 'chrome');
  });

  it('boots a coop binding, serves peer blob requests, and persists compaction updates', async () => {
    await import('../coop-sync-offscreen');
    await flushMicrotasks();

    expect(sharedMocks.connectSyncProviders).toHaveBeenCalledTimes(1);
    expect(sharedMocks.createCoopDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        syncRoom: expect.objectContaining({
          roomSecret: expect.stringContaining('encrypted://local/sync-room-secret/'),
          inviteSigningSecret: expect.stringContaining('encrypted://local/sync-room-secret/'),
        }),
      }),
    );
    expect(sharedMocks.connectSyncProviders).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        roomSecret: 'room-secret',
        inviteSigningSecret: 'invite-secret',
      }),
      expect.any(Array),
      'wss://api.coop.test/yws',
    );
    expect(blobMocks.broadcastManifest).toHaveBeenCalledTimes(1);

    const sendResponse = vi.fn();
    const keepAlive = onRuntimeMessage?.(
      {
        type: 'resolve-coop-blob-from-peers',
        payload: {
          coopId: 'coop-1',
          blobId: 'blob-1',
        },
      },
      undefined,
      sendResponse,
    );
    await flushMicrotasks();

    expect(keepAlive).toBe(true);
    expect(blobMocks.requestBlob).toHaveBeenCalledWith('blob-1');
    expect(sendResponse).toHaveBeenCalledWith({
      ok: true,
      data: { bytes: [4, 5, 6] },
    });

    sharedMocks.compactCoopArtifacts.mockReturnValueOnce({
      archivedIds: ['artifact-1'],
      remainingCount: 0,
    });
    await runScheduledTimeouts();

    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'persist-coop-state',
      payload: {
        coopId: 'coop-1',
        docUpdate: [9, 9, 9],
      },
    });
  });

  it('recreates providers before server-minted ICE credentials expire', async () => {
    await import('../coop-sync-offscreen');
    await flushMicrotasks();

    onRuntimeMessage?.({
      type: 'refresh-coop-sync-bindings',
    });
    await flushMicrotasks();

    expect(providersDisconnectMock).toHaveBeenCalledTimes(1);
    expect(sharedMocks.connectSyncProviders).toHaveBeenCalledTimes(2);
  });

  it('force-writes local coop state into an existing binding on save refresh', async () => {
    const coop = buildCoop();
    sendMessageMock.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'get-coop-sync-config') {
        return {
          ok: true,
          data: {
            coops: [buildCoopSyncConfigEntry(coop)],
            websocketSyncUrl: 'wss://api.coop.test/yws',
            iceConfig: {
              iceServers: [{ urls: ['turn:turn.coop.test:3478'] }],
              expiresAt: new Date(Date.now() + 300_000).toISOString(),
              degraded: false,
            },
          },
        };
      }
      return { ok: true };
    });

    await import('../coop-sync-offscreen');
    await flushMicrotasks();
    scheduledTimeouts.clear();
    sharedMocks.writeCoopState.mockClear();

    onRuntimeMessage?.({
      type: 'refresh-coop-sync-bindings',
      payload: { reason: 'save-state', force: true },
    });
    await flushMicrotasks();

    expect(sharedMocks.writeCoopState).toHaveBeenCalledTimes(1);
    expect(sharedMocks.writeCoopState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        profile: expect.objectContaining({ id: 'coop-1' }),
      }),
    );
  });

  it('responds to invite handoff requests with encrypted steady-room secrets', async () => {
    await import('../coop-sync-offscreen');
    await flushMicrotasks();

    const handoffDoc = sharedMocks.connectInviteHandoffProviders.mock.calls[0]?.[0] as {
      getMap: (name: string) => Map<string, string>;
    };
    const requests = handoffDoc.getMap('invite-handoff-requests');
    const responses = handoffDoc.getMap('invite-handoff-responses');

    requests.set(
      'handoff-request-1',
      JSON.stringify({
        requestId: 'handoff-request-1',
        coopId: 'coop-1',
        inviteId: 'invite-1',
        memberId: 'member-joiner',
        memberDisplayName: 'Mina',
        publicKeyJwk: {},
        createdAt: '2026-05-17T00:00:00.000Z',
      }),
    );
    await flushMicrotasks();

    expect(sharedMocks.encryptInviteHandoffPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          roomId: 'room-1',
          roomSecret: 'room-secret',
          inviteSigningSecret: 'invite-secret',
          recipientMemberId: 'member-joiner',
        }),
      }),
    );
    expect(JSON.parse(responses.get('handoff-request-1') ?? '{}')).toMatchObject({
      requestId: 'handoff-request-1',
      encryptedPayloadBase64: 'encrypted-payload',
    });
  });

  it('responds to room rotation handoff requests from retired steady rooms', async () => {
    const coop = {
      ...buildCoop(),
      syncRoom: {
        ...buildCoop().syncRoom,
        roomEpoch: 2,
        previousRoomIds: ['room-old'],
      },
    };
    const retiredRoom = {
      coopId: 'coop-1',
      roomId: 'room-old',
      roomSecret: 'room-secret-old',
      inviteSigningSecret: 'invite-secret-old',
      signalingUrls: ['wss://signal.coop.test'],
      roomEpoch: 1,
    };
    sendMessageMock.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'get-coop-sync-config') {
        return {
          ok: true,
          data: {
            coops: [
              {
                ...buildCoopSyncConfigEntry(coop),
                retiredProviderSyncRooms: [retiredRoom],
              },
            ],
            websocketSyncUrl: 'wss://api.coop.test/yws',
            iceConfig: null,
          },
        };
      }
      return { ok: true };
    });

    await import('../coop-sync-offscreen');
    await flushMicrotasks();

    const retiredCall = sharedMocks.connectSyncProviders.mock.calls.find(
      ([, room]) => room.roomId === 'room-old',
    );
    expect(retiredCall).toBeDefined();
    const retiredDoc = retiredCall?.[0] as {
      getMap: (name: string) => Map<string, string>;
    };
    const announcements = retiredDoc.getMap('room-rotation-announcements');
    const requests = retiredDoc.getMap('room-rotation-handoff-requests');
    const responses = retiredDoc.getMap('room-rotation-handoff-responses');
    expect(JSON.parse(announcements.get('room-rotation:room-1') ?? '{}')).toMatchObject({
      coopId: 'coop-1',
      previousRoomId: 'room-old',
      roomId: 'room-1',
      roomEpoch: 2,
      previousRoomIds: ['room-old'],
    });

    requests.set(
      'rotation-request-1',
      JSON.stringify({
        requestId: 'rotation-request-1',
        coopId: 'coop-1',
        inviteId: 'room-rotation:room-1',
        memberId: 'member-creator',
        memberDisplayName: 'June',
        publicKeyJwk: {},
        createdAt: '2026-05-17T00:00:00.000Z',
      }),
    );
    await flushMicrotasks();

    expect(sharedMocks.encryptInviteHandoffPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          roomId: 'room-1',
          roomSecret: 'room-secret',
          inviteSigningSecret: 'invite-secret',
        }),
      }),
    );
    expect(JSON.parse(responses.get('rotation-request-1') ?? '{}')).toMatchObject({
      requestId: 'rotation-request-1',
      encryptedPayloadBase64: 'encrypted-payload',
    });
  });

  it('discovers a rotated room id from old-room announcements before requesting handoff', async () => {
    const oldCoop = {
      ...buildCoop(),
      syncRoom: {
        ...buildCoop().syncRoom,
        roomEpoch: 1,
        previousRoomIds: [],
      },
    };
    sharedMocks.createInviteHandoffRequest.mockImplementationOnce(async (input) => ({
      request: {
        requestId: 'rotation-request-old-member',
        coopId: input.coopId,
        inviteId: input.inviteId,
        memberId: input.memberId,
        memberDisplayName: input.memberDisplayName,
        publicKeyJwk: {},
        createdAt: '2026-05-17T01:00:02.000Z',
      },
      keyPair: {
        privateKey: {},
      },
    }));
    sharedMocks.decryptInviteHandoffPayload.mockResolvedValueOnce({
      requestId: 'rotation-request-old-member',
      coopId: 'coop-1',
      inviteId: 'room-rotation:room-2',
      recipientMemberId: 'member-creator',
      roomEpoch: 2,
      roomId: 'room-2',
      roomSecret: 'room-secret-new',
      inviteSigningSecret: 'invite-secret-new',
      signalingUrls: ['wss://signal.coop.test'],
      createdAt: '2026-05-17T01:00:03.000Z',
    });
    sendMessageMock.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'get-coop-sync-config') {
        return {
          ok: true,
          data: {
            coops: [
              {
                ...buildCoopSyncConfigEntry(oldCoop),
                localMemberId: 'member-creator',
                localMemberDisplayName: 'June',
              },
            ],
            websocketSyncUrl: 'wss://api.coop.test/yws',
            iceConfig: null,
          },
        };
      }
      return { ok: true };
    });

    await import('../coop-sync-offscreen');
    await flushMicrotasks();

    const oldRoomCall = sharedMocks.connectSyncProviders.mock.calls.find(
      ([, room]) => room.roomId === 'room-1',
    );
    const oldRoomDoc = oldRoomCall?.[0] as {
      getMap: (name: string) => Map<string, string>;
    };
    const announcements = oldRoomDoc.getMap('room-rotation-announcements');
    announcements.set(
      'room-rotation:room-2',
      JSON.stringify({
        announcementId: 'room-rotation:room-2',
        coopId: 'coop-1',
        previousRoomId: 'room-1',
        roomId: 'room-2',
        roomEpoch: 2,
        previousRoomIds: ['room-1'],
        signalingUrls: ['wss://signal.coop.test'],
        rotatedAt: '2026-05-17T01:00:00.000Z',
        rotatedBy: 'member-creator',
        createdAt: '2026-05-17T01:00:01.000Z',
        proof: 'rotation-proof',
      }),
    );
    await flushMicrotasks();

    expect(
      sendMessageMock.mock.calls.some(
        ([message]) => message.type === 'persist-coop-room-rotation-announcement',
      ),
    ).toBe(false);
    expect(
      sendMessageMock.mock.calls.some(([message]) => message.type === 'persist-coop-room-handoff'),
    ).toBe(false);

    await flushMicrotasks();
    const handoffDoc = sharedMocks.connectSyncProviders.mock.calls
      .filter(([, room]) => room.roomId === 'room-1')
      .map(([doc]) => doc as { getMap: (name: string) => Map<string, string> })
      .find((doc) =>
        doc.getMap('room-rotation-handoff-requests').has('rotation-request-old-member'),
      );
    expect(handoffDoc).toBeDefined();
    const requests = handoffDoc?.getMap('room-rotation-handoff-requests');
    const responses = handoffDoc?.getMap('room-rotation-handoff-responses');
    expect(JSON.parse(requests?.get('rotation-request-old-member') ?? '{}')).toMatchObject({
      inviteId: 'room-rotation:room-2',
      memberId: 'member-creator',
    });

    responses?.set(
      'rotation-request-old-member',
      JSON.stringify({
        requestId: 'rotation-request-old-member',
        coopId: 'coop-1',
        inviteId: 'room-rotation:room-2',
        memberId: 'member-creator',
        roomId: 'room-2',
        signalingUrls: ['wss://signal.coop.test'],
        encryptedPayloadBase64: 'encrypted-payload',
        createdAt: '2026-05-17T01:00:04.000Z',
      }),
    );
    await flushMicrotasks();

    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'persist-coop-room-handoff',
      payload: {
        coopId: 'coop-1',
        syncRoom: {
          coopId: 'coop-1',
          roomId: 'room-2',
          roomSecret: 'room-secret-new',
          inviteSigningSecret: 'invite-secret-new',
          signalingUrls: ['wss://signal.coop.test'],
          roomEpoch: 2,
          previousRoomIds: ['room-1'],
          rotatedAt: '2026-05-17T01:00:00.000Z',
          rotatedBy: 'member-creator',
        },
        roomEpoch: 2,
      },
    });
  });

  it('does not persist a retired-room announcement while already on a current room', async () => {
    const coop = {
      ...buildCoop(),
      syncRoom: {
        ...buildCoop().syncRoom,
        roomId: 'room-a2',
        roomSecret: 'room-secret-a2',
        inviteSigningSecret: 'invite-secret-a2',
        roomEpoch: 2,
        previousRoomIds: ['room-old'],
        rotatedAt: '2026-05-17T01:00:00.000Z',
        rotatedBy: 'member-a',
      },
    };
    const retiredRoom = {
      coopId: 'coop-1',
      roomId: 'room-old',
      roomSecret: 'room-secret-old',
      inviteSigningSecret: 'invite-secret-old',
      signalingUrls: ['wss://signal.coop.test'],
      roomEpoch: 1,
    };
    sendMessageMock.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'get-coop-sync-config') {
        return {
          ok: true,
          data: {
            coops: [
              {
                ...buildCoopSyncConfigEntry(coop),
                retiredProviderSyncRooms: [retiredRoom],
              },
            ],
            websocketSyncUrl: 'wss://api.coop.test/yws',
            iceConfig: null,
          },
        };
      }
      return { ok: true };
    });

    await import('../coop-sync-offscreen');
    await flushMicrotasks();

    const retiredCall = sharedMocks.connectSyncProviders.mock.calls.find(
      ([, room]) => room.roomId === 'room-old',
    );
    const retiredDoc = retiredCall?.[0] as {
      getMap: (name: string) => Map<string, string>;
    };
    const announcements = retiredDoc.getMap('room-rotation-announcements');
    announcements.set(
      'room-rotation:room-c3',
      JSON.stringify({
        announcementId: 'room-rotation:room-c3',
        coopId: 'coop-1',
        previousRoomId: 'room-old',
        roomId: 'room-c3',
        roomEpoch: 3,
        previousRoomIds: ['room-old'],
        signalingUrls: ['wss://signal.coop.test'],
        rotatedAt: '2026-05-17T01:00:02.000Z',
        rotatedBy: 'stale-old-room-writer',
        createdAt: '2026-05-17T01:00:02.000Z',
        proof: 'rotation-proof',
      }),
    );
    await flushMicrotasks();

    expect(
      sendMessageMock.mock.calls.some(
        ([message]) => message.type === 'persist-coop-room-rotation-announcement',
      ),
    ).toBe(false);
    expect(
      sendMessageMock.mock.calls.some(([message]) => message.type === 'persist-coop-room-handoff'),
    ).toBe(false);
  });

  it('requests and persists a room rotation handoff when only a retired room secret is available', async () => {
    const targetRoom = {
      coopId: 'coop-1',
      roomId: 'room-2',
      roomSecret: 'encrypted://local/sync-room-secret/coop-1/room-2',
      inviteSigningSecret: 'encrypted://local/sync-room-secret/coop-1/room-2/invite',
      signalingUrls: ['wss://signal.coop.test'],
      roomEpoch: 2,
      previousRoomIds: ['room-old'],
    };
    const retiredRoom = {
      coopId: 'coop-1',
      roomId: 'room-old',
      roomSecret: 'room-secret-old',
      inviteSigningSecret: 'invite-secret-old',
      signalingUrls: ['wss://signal.coop.test'],
      roomEpoch: 1,
    };
    const coop = {
      ...buildCoop(),
      syncRoom: targetRoom,
    };
    sharedMocks.createInviteHandoffRequest.mockImplementationOnce(async (input) => ({
      request: {
        requestId: 'rotation-request-joiner',
        coopId: input.coopId,
        inviteId: input.inviteId,
        memberId: input.memberId,
        memberDisplayName: input.memberDisplayName,
        publicKeyJwk: {},
        createdAt: '2026-05-17T00:00:00.000Z',
      },
      keyPair: {
        privateKey: {},
      },
    }));
    sharedMocks.decryptInviteHandoffPayload.mockResolvedValueOnce({
      requestId: 'rotation-request-joiner',
      coopId: 'coop-1',
      inviteId: 'room-rotation:room-2',
      recipientMemberId: 'member-creator',
      roomEpoch: 2,
      roomId: 'room-2',
      roomSecret: 'room-secret-new',
      inviteSigningSecret: 'invite-secret-new',
      signalingUrls: ['wss://signal.coop.test'],
      createdAt: '2026-05-17T00:00:00.000Z',
    });
    sendMessageMock.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'get-coop-sync-config') {
        return {
          ok: true,
          data: {
            coops: [
              {
                coop,
                providerSyncRoom: undefined,
                retiredProviderSyncRooms: [retiredRoom],
                roomSecretAvailable: false,
                legacySecretMigrated: true,
                roomEpoch: 1,
                localMemberId: 'member-creator',
                localMemberDisplayName: 'June',
              },
            ],
            websocketSyncUrl: 'wss://api.coop.test/yws',
            iceConfig: null,
          },
        };
      }
      return { ok: true };
    });

    await import('../coop-sync-offscreen');
    await flushMicrotasks();

    const retiredCall = sharedMocks.connectSyncProviders.mock.calls.find(
      ([, room]) => room.roomId === 'room-old',
    );
    expect(retiredCall).toBeDefined();
    const retiredDoc = retiredCall?.[0] as {
      getMap: (name: string) => Map<string, string>;
    };
    const requests = retiredDoc.getMap('room-rotation-handoff-requests');
    const responses = retiredDoc.getMap('room-rotation-handoff-responses');
    expect(JSON.parse(requests.get('rotation-request-joiner') ?? '{}')).toMatchObject({
      inviteId: 'room-rotation:room-2',
      memberId: 'member-creator',
    });

    responses.set(
      'rotation-request-joiner',
      JSON.stringify({
        requestId: 'rotation-request-joiner',
        coopId: 'coop-1',
        inviteId: 'room-rotation:room-2',
        memberId: 'member-creator',
        roomId: 'room-2',
        signalingUrls: ['wss://signal.coop.test'],
        encryptedPayloadBase64: 'encrypted-payload',
        createdAt: '2026-05-17T00:00:00.000Z',
      }),
    );
    await flushMicrotasks();

    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'persist-coop-room-handoff',
      payload: {
        coopId: 'coop-1',
        syncRoom: {
          coopId: 'coop-1',
          roomId: 'room-2',
          roomSecret: 'room-secret-new',
          inviteSigningSecret: 'invite-secret-new',
          signalingUrls: ['wss://signal.coop.test'],
          roomEpoch: 2,
          previousRoomIds: ['room-old'],
        },
        roomEpoch: 2,
      },
    });
  });

  it('starts blob sync over the websocket relay when WebRTC is unavailable', async () => {
    sharedMocks.connectSyncProviders.mockReturnValueOnce({
      webrtc: undefined,
      websocket: {
        on: vi.fn(),
        off: vi.fn(),
        wsconnected: true,
      },
      disconnect: providersDisconnectMock,
    });
    sharedMocks.createBlobRelayTransport.mockReturnValueOnce({
      sendMessage: vi.fn(),
      onMessage: vi.fn(() => vi.fn()),
    } as never);

    await import('../coop-sync-offscreen');
    await flushMicrotasks();

    expect(blobMocks.broadcastManifest).toHaveBeenCalledTimes(1);
  });

  it('retries pending remote updates after transient persist failures', async () => {
    const coop = buildCoop();
    sendMessageMock.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'get-coop-sync-config') {
        return {
          ok: true,
          data: {
            coops: [buildCoopSyncConfigEntry(coop)],
            websocketSyncUrl: 'wss://api.coop.test/yws',
            iceConfig: null,
          },
        };
      }
      if (message.type === 'persist-coop-state') {
        const attempts = sendMessageMock.mock.calls.filter(
          ([candidate]) => candidate.type === 'persist-coop-state',
        ).length;
        return attempts === 1 ? { ok: false, error: 'temporary failure' } : { ok: true };
      }
      return { ok: true };
    });

    await import('../coop-sync-offscreen');
    await flushMicrotasks();
    scheduledTimeouts.clear();
    sharedMocks.readCoopState.mockReturnValue({
      ...coop,
      profile: { ...coop.profile, name: 'Remote Runtime Coop' },
    });
    const doc = sharedMocks.createCoopDoc.mock.results[0]?.value as {
      on: ReturnType<typeof vi.fn>;
    };
    const onUpdate = doc.on.mock.calls.find(([event]) => event === 'update')?.[1] as (
      update: Uint8Array,
      origin: string,
    ) => void;

    onUpdate(new Uint8Array([7, 8, 9]), 'remote');
    await runScheduledTimeouts();
    await runScheduledTimeouts();

    expect(
      sendMessageMock.mock.calls.filter(([message]) => message.type === 'persist-coop-state'),
    ).toHaveLength(2);
  });

  it('keeps malformed remote updates pending for retry instead of dropping them', async () => {
    await import('../coop-sync-offscreen');
    await flushMicrotasks();
    scheduledTimeouts.clear();
    sharedMocks.readCoopState.mockImplementation(() => {
      throw new Error('Remote coop state is malformed.');
    });
    const doc = sharedMocks.createCoopDoc.mock.results[0]?.value as {
      on: ReturnType<typeof vi.fn>;
    };
    const onUpdate = doc.on.mock.calls.find(([event]) => event === 'update')?.[1] as (
      update: Uint8Array,
      origin: string,
    ) => void;

    onUpdate(new Uint8Array([7, 8, 9]), 'remote');
    await runScheduledTimeouts();

    const runtimeReports = sendMessageMock.mock.calls.filter(
      ([message]) => message.type === 'report-coop-sync-runtime',
    );
    expect(runtimeReports.at(-1)?.[0]).toMatchObject({
      payload: {
        lastError: 'Remote coop state is malformed.',
        pendingUpdateCount: 1,
      },
    });
    expect(scheduledTimeouts.size).toBeGreaterThan(0);
  });
});
