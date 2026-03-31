import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendRuntimeMessageMock } = vi.hoisted(() => ({
  sendRuntimeMessageMock: vi.fn(),
}));

vi.mock('../../../../runtime/messages', () => ({
  sendRuntimeMessage: sendRuntimeMessageMock,
}));

const { useSyncBindings } = await import('../useSyncBindings');

describe('useSyncBindings (thin shim)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendRuntimeMessageMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends refresh-coop-sync-bindings when coops change', async () => {
    const coop = { profile: { id: 'coop-1' }, syncRoom: { roomId: 'room-1' } } as never;
    const loadDashboard = vi.fn(async () => undefined);

    const { rerender } = renderHook(({ coops }) => useSyncBindings({ coops, loadDashboard }), {
      initialProps: { coops: [coop] as unknown[] },
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
      type: 'refresh-coop-sync-bindings',
    });

    sendRuntimeMessageMock.mockClear();

    const updatedCoop = {
      ...coop,
      profile: { id: 'coop-1', name: 'Updated' },
    } as never;
    rerender({ coops: [updatedCoop] as unknown[] });

    await act(async () => {
      await Promise.resolve();
    });

    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
      type: 'refresh-coop-sync-bindings',
    });
  });

  it('sends refresh when coops go from undefined to populated', async () => {
    const loadDashboard = vi.fn(async () => undefined);

    const { rerender } = renderHook(({ coops }) => useSyncBindings({ coops, loadDashboard }), {
      initialProps: { coops: undefined as unknown[] | undefined },
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
      type: 'refresh-coop-sync-bindings',
    });

    sendRuntimeMessageMock.mockClear();

    const coop = { profile: { id: 'coop-1' }, syncRoom: { roomId: 'room-1' } } as never;
    rerender({ coops: [coop] });

    await act(async () => {
      await Promise.resolve();
    });

    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
      type: 'refresh-coop-sync-bindings',
    });
  });

  it('does not manage sync providers locally — that is the offscreen document responsibility', async () => {
    const loadDashboard = vi.fn(async () => undefined);

    renderHook(() =>
      useSyncBindings({
        coops: [{ profile: { id: 'coop-1' }, syncRoom: { roomId: 'room-1' } } as never],
        loadDashboard,
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    // Only refresh-coop-sync-bindings should be sent — no report-sync-health, no persist
    const allCalls = sendRuntimeMessageMock.mock.calls.map(([msg]: [{ type: string }]) => msg.type);
    expect(allCalls).toEqual(['refresh-coop-sync-bindings']);
  });
});
