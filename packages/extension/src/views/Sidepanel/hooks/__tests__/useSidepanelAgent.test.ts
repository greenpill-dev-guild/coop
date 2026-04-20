import { act, renderHook, waitFor } from '@testing-library/react';
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

    await waitFor(() => {
      expect(deps.setAgentDashboard).toHaveBeenNthCalledWith(1, dashboard);
      expect(deps.setAgentDashboard).toHaveBeenNthCalledWith(2, dashboard);
    });
    // Success toast is now handled by AGENT_CYCLE_FINISHED background event,
    // so handleRunAgentCycle no longer calls setMessage on success.
    expect(deps.setMessage).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(deps.loadDashboard).toHaveBeenCalledTimes(2);
    });
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

  it('activates WebLLM promotion and refreshes the agent dashboard', async () => {
    const deps = makeDeps();
    sendRuntimeMessageMock.mockResolvedValue({
      ok: true,
      data: {
        promotable: true,
        promotedSkillIds: ['tab-router', 'opportunity-extractor'],
        failedChecks: [],
      },
    });

    const { result } = renderHook(() => useSidepanelAgent(deps));

    await act(async () => {
      await result.current.handleActivateWebLlmProviderPromotion();
    });

    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
      type: 'activate-webllm-provider-promotion',
    });
    expect(deps.loadAgentDashboard).toHaveBeenCalledTimes(1);
    expect(deps.setMessage).toHaveBeenCalledWith('WebLLM promotion activated for 2 skills.');
  });

  it('reports failed release-gate checks when WebLLM promotion is blocked', async () => {
    const deps = makeDeps();
    sendRuntimeMessageMock.mockResolvedValue({
      ok: true,
      data: {
        promotable: false,
        promotedSkillIds: [],
        failedChecks: ['traced', 'malicious-pack-clean'],
      },
    });

    const { result } = renderHook(() => useSidepanelAgent(deps));

    await act(async () => {
      await result.current.handleActivateWebLlmProviderPromotion();
    });

    expect(deps.loadAgentDashboard).toHaveBeenCalledTimes(1);
    expect(deps.setMessage).toHaveBeenCalledWith(
      'WebLLM promotion did not pass the release gate. Failed checks: traced, malicious-pack-clean.',
    );
  });

  it('surfaces runtime failures', async () => {
    const deps = makeDeps();
    sendRuntimeMessageMock.mockResolvedValue({ ok: false, error: 'agent failed' });

    const { result } = renderHook(() => useSidepanelAgent(deps));

    await act(async () => {
      await result.current.handleRunAgentCycle();
    });

    await waitFor(() => {
      expect(deps.setMessage).toHaveBeenCalledWith('agent failed');
    });
  });

  it('maps trusted-node pre-flight errors to friendly messages', async () => {
    const deps = makeDeps();

    const cases = [
      {
        raw: 'A passkey session is required for trusted-node controls.',
        friendly: 'Sign in with your passkey first.',
      },
      {
        raw: 'Select a coop before using trusted-node controls.',
        friendly: 'Select a coop first.',
      },
      {
        raw: 'Trusted-node controls are limited to creator or trusted members.',
        friendly: 'Only trusted members can run helpers.',
      },
    ];

    for (const { raw, friendly } of cases) {
      vi.clearAllMocks();
      sendRuntimeMessageMock.mockResolvedValue({ ok: false, error: raw });

      const { result } = renderHook(() => useSidepanelAgent(deps));
      await act(async () => {
        await result.current.handleRunAgentCycle();
      });

      await waitFor(() => {
        expect(deps.setMessage).toHaveBeenCalledWith(friendly);
      });
    }
  });

  it('surfaces approval and rejection failures without refreshing dashboards', async () => {
    const deps = makeDeps();
    sendRuntimeMessageMock
      .mockResolvedValueOnce({ ok: false, error: 'approval blocked' })
      .mockResolvedValueOnce({ ok: false, error: 'rejection blocked' });

    const { result } = renderHook(() => useSidepanelAgent(deps));

    await act(async () => {
      await result.current.handleApproveAgentPlan('plan-1');
      await result.current.handleRejectAgentPlan('plan-2');
    });

    expect(deps.setMessage).toHaveBeenNthCalledWith(1, 'approval blocked');
    expect(deps.setMessage).toHaveBeenNthCalledWith(2, 'rejection blocked');
    expect(deps.loadAgentDashboard).not.toHaveBeenCalled();
    expect(deps.loadDashboard).not.toHaveBeenCalled();
  });
});
