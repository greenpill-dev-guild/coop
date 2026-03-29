import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendRuntimeMessageMock } = vi.hoisted(() => ({
  sendRuntimeMessageMock: vi.fn(async () => undefined),
}));

vi.mock('../../../../runtime/messages', () => ({
  sendRuntimeMessage: sendRuntimeMessageMock,
}));

const { useSidepanelActions } = await import('../useSidepanelActions');

describe('useSidepanelActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches policy and action lifecycle messages', async () => {
    const loadDashboard = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useSidepanelActions({
        activeCoop: {
          profile: { id: 'coop-1' },
        } as never,
        activeMember: {
          id: 'member-1',
        } as never,
        loadDashboard,
      }),
    );

    await act(async () => {
      await result.current.handleSetPolicy('archive-upload', true);
      await result.current.handleProposeAction('archive-upload', { rootCid: 'bafy' });
      await result.current.handleApproveAction('bundle-1');
      await result.current.handleRejectAction('bundle-2');
      await result.current.handleExecuteAction('bundle-3');
    });

    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(1, {
      type: 'set-action-policy',
      payload: { actionClass: 'archive-upload', approvalRequired: true },
    });
    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(2, {
      type: 'propose-action',
      payload: {
        actionClass: 'archive-upload',
        coopId: 'coop-1',
        memberId: 'member-1',
        payload: { rootCid: 'bafy' },
      },
    });
    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(3, {
      type: 'approve-action',
      payload: { bundleId: 'bundle-1' },
    });
    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(4, {
      type: 'reject-action',
      payload: { bundleId: 'bundle-2' },
    });
    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(5, {
      type: 'execute-action',
      payload: { bundleId: 'bundle-3' },
    });
    expect(loadDashboard).toHaveBeenCalledTimes(5);
  });
});
