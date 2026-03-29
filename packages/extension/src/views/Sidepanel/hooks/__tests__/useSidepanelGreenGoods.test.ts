import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { buildMintPayloadMock, sendRuntimeMessageMock } = vi.hoisted(() => ({
  buildMintPayloadMock: vi.fn(() => ({ mint: 'payload' })),
  sendRuntimeMessageMock: vi.fn(),
}));

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared')>();
  return {
    ...actual,
    buildGreenGoodsMintHypercertPayload: buildMintPayloadMock,
  };
});

vi.mock('../../../../runtime/messages', () => ({
  sendRuntimeMessage: sendRuntimeMessageMock,
}));

const { useSidepanelGreenGoods } = await import('../useSidepanelGreenGoods');

function makeDeps(overrides: Partial<Parameters<typeof useSidepanelGreenGoods>[0]> = {}) {
  return {
    activeCoop: {
      profile: {
        id: 'coop-1',
      },
    } as never,
    activeMember: {
      id: 'member-1',
    } as never,
    setMessage: vi.fn(),
    loadDashboard: vi.fn(async () => undefined),
    loadAgentDashboard: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('useSidepanelGreenGoods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('guards work submissions until a coop and member are active', async () => {
    const deps = makeDeps({ activeCoop: undefined, activeMember: undefined });

    const { result } = renderHook(() => useSidepanelGreenGoods(deps));

    await act(async () => {
      await result.current.handleSubmitGreenGoodsWorkSubmission({
        actionUid: 6,
        title: 'Patch inlet',
        feedback: 'Done',
        metadataCid: 'bafy',
        mediaCids: [],
      });
    });

    expect(deps.setMessage).toHaveBeenCalledWith(
      'Open the coop as the member who should submit this work first.',
    );
    expect(sendRuntimeMessageMock).not.toHaveBeenCalled();
  });

  it('submits work and queues operator actions with dashboard refreshes', async () => {
    const deps = makeDeps();
    sendRuntimeMessageMock
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useSidepanelGreenGoods(deps));

    await act(async () => {
      await result.current.handleSubmitGreenGoodsWorkSubmission({
        actionUid: 6,
        title: 'Patch inlet',
        feedback: 'Done',
        metadataCid: 'bafy-meta',
        mediaCids: ['bafy-media'],
      });
      await result.current.handleQueueGreenGoodsWorkApproval('coop-1', {
        memberAccount: '0xmember',
      } as never);
      await result.current.handleQueueGreenGoodsAssessment('coop-1', {
        memberAccount: '0xmember',
      } as never);
      await result.current.handleQueueGreenGoodsGapAdminSync('coop-1');
    });

    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(1, {
      type: 'submit-green-goods-work-submission',
      payload: {
        coopId: 'coop-1',
        memberId: 'member-1',
        submission: {
          actionUid: 6,
          title: 'Patch inlet',
          feedback: 'Done',
          metadataCid: 'bafy-meta',
          mediaCids: ['bafy-media'],
        },
      },
    });
    expect(deps.setMessage).toHaveBeenCalledWith(
      'Green Goods work submission submitted from your member smart account.',
    );
    expect(deps.setMessage).toHaveBeenCalledWith('Green Goods work approval queued.');
    expect(deps.setMessage).toHaveBeenCalledWith('Green Goods assessment queued.');
    expect(deps.setMessage).toHaveBeenCalledWith('Green Goods GAP admin sync queued.');
    expect(deps.loadDashboard).toHaveBeenCalledTimes(4);
    expect(deps.loadAgentDashboard).toHaveBeenCalledTimes(3);
  });

  it('queues a Hypercert mint with the generated payload', async () => {
    const deps = makeDeps();
    sendRuntimeMessageMock.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useSidepanelGreenGoods(deps));

    await act(async () => {
      await result.current.handleQueueGreenGoodsHypercertMint('coop-1', {
        gardenAddress: '0xgarden',
        title: 'Wetland repair',
        description: 'Restore watershed',
        workScopes: ['repair'],
        impactScopes: ['water'],
        workTimeframeStart: '2026-03-01',
        workTimeframeEnd: '2026-03-10',
        impactTimeframeStart: '2026-03-01',
        impactTimeframeEnd: '2026-03-20',
        externalUrl: 'https://example.com',
        imageUri: 'ipfs://image',
        domain: 'water',
        sdgs: ['6'],
        capitals: ['natural'],
        outcomes: ['clean-water'],
        allowlist: ['0xabc'],
        attestations: [],
      });
    });

    expect(buildMintPayloadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        coopId: 'coop-1',
        gardenAddress: '0xgarden',
        title: 'Wetland repair',
      }),
    );
    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
      type: 'propose-action',
      payload: {
        actionClass: 'green-goods-mint-hypercert',
        coopId: 'coop-1',
        memberId: 'member-1',
        payload: { mint: 'payload' },
      },
    });
    expect(deps.setMessage).toHaveBeenCalledWith('Green Goods Hypercert mint queued for approval.');
    expect(deps.loadDashboard).toHaveBeenCalledTimes(1);
  });

  it('reports gardener sync outcomes and Hypercert guardrails', async () => {
    const guardDeps = makeDeps({
      activeCoop: {
        profile: { id: 'coop-2' },
      } as never,
    });
    const syncedDeps = makeDeps();
    sendRuntimeMessageMock
      .mockResolvedValueOnce({
        ok: true,
        data: {
          proposed: 2,
          skippedMemberIds: ['member-2'],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          proposed: 0,
          skippedMemberIds: [],
        },
      });

    const { result: guardResult } = renderHook(() => useSidepanelGreenGoods(guardDeps));
    const { result: syncedResult } = renderHook(() => useSidepanelGreenGoods(syncedDeps));

    await act(async () => {
      await guardResult.current.handleQueueGreenGoodsHypercertMint('coop-1', {
        gardenAddress: '0xgarden',
      } as never);
      await syncedResult.current.handleQueueGreenGoodsMemberSync('coop-1');
      await syncedResult.current.handleQueueGreenGoodsMemberSync('coop-1');
    });

    expect(guardDeps.setMessage).toHaveBeenCalledWith(
      'Open the coop as the trusted operator who should queue this Hypercert first.',
    );
    expect(syncedDeps.setMessage).toHaveBeenCalledWith(
      'Queued 2 gardener sync actions and skipped 1 member waiting on provisioning.',
    );
    expect(syncedDeps.setMessage).toHaveBeenCalledWith(
      'Garden member bindings are already in sync.',
    );
    expect(syncedDeps.loadDashboard).toHaveBeenCalledTimes(2);
  });
});
