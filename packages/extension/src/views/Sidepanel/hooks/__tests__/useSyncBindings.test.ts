import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  buildIceServersMock,
  connectSyncProvidersMock,
  createBlobRelayTransportMock,
  createCoopDocMock,
  hashJsonMock,
  mergeCoopDocUpdatesMock,
  readCoopStateMock,
  sendRuntimeMessageMock,
  summarizeSyncTransportHealthMock,
  writeCoopStateMock,
} = vi.hoisted(() => ({
  buildIceServersMock: vi.fn(() => ['ice-server']),
  connectSyncProvidersMock: vi.fn(),
  createBlobRelayTransportMock: vi.fn(() => ({ kind: 'relay' })),
  createCoopDocMock: vi.fn(),
  hashJsonMock: vi.fn(),
  mergeCoopDocUpdatesMock: vi.fn(() => new Uint8Array([9, 9])),
  readCoopStateMock: vi.fn(),
  sendRuntimeMessageMock: vi.fn(),
  summarizeSyncTransportHealthMock: vi.fn(() => ({
    syncError: false,
    note: 'Healthy sync',
  })),
  writeCoopStateMock: vi.fn(),
}));

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared')>();
  return {
    ...actual,
    buildIceServers: buildIceServersMock,
    connectSyncProviders: connectSyncProvidersMock,
    createBlobRelayTransport: createBlobRelayTransportMock,
    createCoopDoc: createCoopDocMock,
    hashJson: hashJsonMock,
    mergeCoopDocUpdates: mergeCoopDocUpdatesMock,
    readCoopState: readCoopStateMock,
    summarizeSyncTransportHealth: summarizeSyncTransportHealthMock,
    writeCoopState: writeCoopStateMock,
  };
});

vi.mock('../../../../runtime/messages', () => ({
  sendRuntimeMessage: sendRuntimeMessageMock,
}));

const { useSyncBindings } = await import('../useSyncBindings');

type DocUpdateHandler = (update: Uint8Array) => void;

describe('useSyncBindings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('wires sync providers, reports health, persists remote updates, and cleans up', async () => {
    let updateHandler: DocUpdateHandler | null = null;
    const doc = {
      on: vi.fn((event: string, handler: DocUpdateHandler) => {
        if (event === 'update') {
          updateHandler = handler;
        }
      }),
      off: vi.fn(),
    };
    const rtcConnection = {
      on: vi.fn(),
      off: vi.fn(),
    };
    const providers = {
      webrtc: {
        on: vi.fn(),
        off: vi.fn(),
        signalingConns: [rtcConnection],
      },
      websocket: {
        on: vi.fn(),
        off: vi.fn(),
        wsconnected: true,
      },
      disconnect: vi.fn(),
    };

    createCoopDocMock.mockReturnValue(doc);
    connectSyncProvidersMock.mockReturnValue(providers);
    hashJsonMock.mockReturnValueOnce('hash-local').mockReturnValueOnce('hash-remote');
    readCoopStateMock.mockReturnValue({ id: 'remote-state' });
    sendRuntimeMessageMock.mockResolvedValue({ ok: true });

    const loadDashboard = vi.fn(async () => undefined);
    const coop = {
      profile: { id: 'coop-1' },
      syncRoom: { roomId: 'room-1' },
    } as never;

    const { rerender, unmount } = renderHook(
      ({ coops }) =>
        useSyncBindings({
          coops,
          loadDashboard,
        }),
      {
        initialProps: { coops: [coop] as unknown[] },
      },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(buildIceServersMock).toHaveBeenCalledTimes(1);
    expect(createCoopDocMock).toHaveBeenCalledWith(coop);
    expect(connectSyncProvidersMock).toHaveBeenCalledWith(doc, coop.syncRoom, ['ice-server']);
    expect(createBlobRelayTransportMock).toHaveBeenCalledWith(providers.websocket);
    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
      type: 'report-sync-health',
      payload: {
        syncError: false,
        note: 'Healthy sync',
      },
    });

    await act(async () => {
      updateHandler?.(new Uint8Array([1, 2, 3]));
      await vi.advanceTimersByTimeAsync(280);
    });

    expect(mergeCoopDocUpdatesMock).toHaveBeenCalledWith([new Uint8Array([1, 2, 3])]);
    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
      type: 'persist-coop-state',
      payload: {
        coopId: 'coop-1',
        docUpdate: new Uint8Array([9, 9]),
      },
    });
    expect(loadDashboard).toHaveBeenCalledTimes(1);

    hashJsonMock.mockReturnValueOnce('hash-next');
    rerender({
      coops: [
        {
          ...coop,
          profile: { id: 'coop-1', name: 'Updated River Coop' },
        } as never,
      ],
    });

    expect(writeCoopStateMock).toHaveBeenCalledWith(
      doc,
      expect.objectContaining({
        profile: expect.objectContaining({ name: 'Updated River Coop' }),
      }),
    );

    unmount();
    expect(doc.off).toHaveBeenCalledWith('update', expect.any(Function));
    expect(providers.disconnect).toHaveBeenCalledTimes(1);
  });

  it('reports sync persistence failures without refreshing the dashboard', async () => {
    let updateHandler: DocUpdateHandler | null = null;
    const doc = {
      on: vi.fn((event: string, handler: DocUpdateHandler) => {
        if (event === 'update') {
          updateHandler = handler;
        }
      }),
      off: vi.fn(),
    };
    const providers = {
      webrtc: null,
      websocket: null,
      disconnect: vi.fn(),
    };

    createCoopDocMock.mockReturnValue(doc);
    connectSyncProvidersMock.mockReturnValue(providers);
    hashJsonMock.mockReturnValueOnce('hash-local').mockReturnValueOnce('hash-remote');
    readCoopStateMock.mockReturnValue({ id: 'remote-state' });
    sendRuntimeMessageMock.mockImplementation(async (message: { type: string }) =>
      message.type === 'persist-coop-state' ? { ok: false, error: 'persist failed' } : { ok: true },
    );

    const loadDashboard = vi.fn(async () => undefined);
    renderHook(() =>
      useSyncBindings({
        coops: [
          {
            profile: { id: 'coop-1' },
            syncRoom: { roomId: 'room-1' },
          } as never,
        ],
        loadDashboard,
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
      updateHandler?.(new Uint8Array([7]));
      await vi.advanceTimersByTimeAsync(280);
    });

    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
      type: 'report-sync-health',
      payload: {
        syncError: true,
        note: 'persist failed',
      },
    });
    expect(loadDashboard).not.toHaveBeenCalled();
  });
});
