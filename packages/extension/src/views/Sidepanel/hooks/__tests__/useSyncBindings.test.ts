import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeCoopState } from '../../../../__tests__/fixtures';

const { sendRuntimeMessageMock } = vi.hoisted(() => ({
  sendRuntimeMessageMock: vi.fn(),
}));

vi.mock('../../../../runtime/messages', () => ({
  sendRuntimeMessage: sendRuntimeMessageMock,
}));

const { useSyncBindings } = await import('../useSyncBindings');

describe('useSyncBindings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendRuntimeMessageMock.mockResolvedValue({ ok: true });
  });

  it('asks the offscreen runtime to refresh sync bindings when mounted', () => {
    renderHook(() =>
      useSyncBindings({
        coops: [],
        loadDashboard: vi.fn(async () => undefined),
      }),
    );

    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
      type: 'refresh-coop-sync-bindings',
      payload: { reason: 'sidepanel-mounted' },
    });
  });

  it('asks the offscreen runtime to refresh when the coop list changes', () => {
    const { rerender } = renderHook(
      ({ coops }) =>
        useSyncBindings({
          coops,
          loadDashboard: vi.fn(async () => undefined),
        }),
      {
        initialProps: { coops: [makeCoopState({ profile: { id: 'coop-1' } })] },
      },
    );

    rerender({ coops: [makeCoopState({ profile: { id: 'coop-2' } })] });

    expect(sendRuntimeMessageMock).toHaveBeenLastCalledWith({
      type: 'refresh-coop-sync-bindings',
      payload: { reason: 'sidepanel-coops-changed' },
    });
  });
});
