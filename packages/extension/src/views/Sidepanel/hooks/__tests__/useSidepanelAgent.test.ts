import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendRuntimeMessageMock } = vi.hoisted(() => ({
  sendRuntimeMessageMock: vi.fn(),
}));

vi.mock('../../../../runtime/messages', () => ({
  sendRuntimeMessage: sendRuntimeMessageMock,
}));

const { useSidepanelAgent } = await import('../useSidepanelAgent');

function makeDeps(overrides: Partial<Parameters<typeof useSidepanelAgent>[0]> = {}) {
  return {
    setMessage: vi.fn(),
    setAgentDashboard: vi.fn(),
    loadDashboard: vi.fn(async () => undefined),
    loadAgentDashboard: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('useSidepanelAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs the agent cycle and retries skill runs with returned dashboards', async () => {
    const deps = makeDeps();
    const dashboard = { plans: [] };
    sendRuntimeMessageMock
      .mockResolvedValueOnce({ ok: true, data: dashboard })
      .mockResolvedValueOnce({ ok: true, data: dashboard });

    const { result } = renderHook(() => useSidepanelAgent(deps));

    await act(async () => {
      await result.current.handleRunAgentCycle();
      await result.current.handleRetrySkillRun('skill-run-1');
    });

    expect(deps.setAgentDashboard).toHaveBeenNthCalledWith(1, dashboard);
    expect(deps.setAgentDashboard).toHaveBeenNthCalledWith(2, dashboard);
    expect(deps.setMessage).toHaveBeenCalledWith('Agent cycle requested.');
    expect(deps.loadDashboard).toHaveBeenCalledTimes(2);
  });

  it('approves, rejects, and toggles auto-run settings', async () => {
    const deps = makeDeps();
    sendRuntimeMessageMock
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useSidepanelAgent(deps));

    await act(async () => {
      await result.current.handleApproveAgentPlan('plan-1');
      await result.current.handleRejectAgentPlan('plan-2');
      await result.current.handleToggleSkillAutoRun('skill-1', true);
    });

    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(1, {
      type: 'approve-agent-plan',
      payload: { planId: 'plan-1' },
    });
    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(2, {
      type: 'reject-agent-plan',
      payload: { planId: 'plan-2' },
    });
    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(3, {
      type: 'set-agent-skill-auto-run',
      payload: { skillId: 'skill-1', enabled: true },
    });
    expect(deps.loadAgentDashboard).toHaveBeenCalledTimes(3);
    expect(deps.loadDashboard).toHaveBeenCalledTimes(1);
  });

  it('surfaces runtime failures', async () => {
    const deps = makeDeps();
    sendRuntimeMessageMock.mockResolvedValue({ ok: false, error: 'agent failed' });

    const { result } = renderHook(() => useSidepanelAgent(deps));

    await act(async () => {
      await result.current.handleRunAgentCycle();
    });

    expect(deps.setMessage).toHaveBeenCalledWith('agent failed');
  });
});
