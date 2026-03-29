import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  preflightActiveTabCaptureMock,
  preflightManualCaptureMock,
  preflightScreenshotCaptureMock,
  sendRuntimeMessageMock,
} = vi.hoisted(() => ({
  preflightActiveTabCaptureMock: vi.fn(),
  preflightManualCaptureMock: vi.fn(),
  preflightScreenshotCaptureMock: vi.fn(),
  sendRuntimeMessageMock: vi.fn(),
}));

vi.mock('../../../../runtime/messages', () => ({
  sendRuntimeMessage: sendRuntimeMessageMock,
}));

vi.mock('../../../shared/capture-preflight', () => ({
  preflightActiveTabCapture: preflightActiveTabCaptureMock,
  preflightManualCapture: preflightManualCaptureMock,
  preflightScreenshotCapture: preflightScreenshotCaptureMock,
}));

const { useTabCapture } = await import('../useTabCapture');

function makeDeps(overrides: Partial<Parameters<typeof useTabCapture>[0]> = {}) {
  return {
    setMessage: vi.fn(),
    setPanelTab: vi.fn(),
    loadDashboard: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('useTabCapture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preflightManualCaptureMock.mockResolvedValue({ ok: true });
    preflightActiveTabCaptureMock.mockResolvedValue({ ok: true });
    preflightScreenshotCaptureMock.mockResolvedValue({ ok: true });
  });

  it('stops manual capture when preflight fails', async () => {
    const deps = makeDeps();
    preflightManualCaptureMock.mockResolvedValue({ ok: false, error: 'Grant tab access first.' });

    const { result } = renderHook(() => useTabCapture(deps));

    await act(async () => {
      await result.current.runManualCapture();
    });

    expect(deps.setMessage).toHaveBeenCalledWith('Grant tab access first.');
    expect(sendRuntimeMessageMock).not.toHaveBeenCalled();
  });

  it('routes successful manual capture results into chickens', async () => {
    const deps = makeDeps();
    sendRuntimeMessageMock.mockResolvedValue({ ok: true, data: 3 });

    const { result } = renderHook(() => useTabCapture(deps));

    await act(async () => {
      await result.current.runManualCapture();
    });

    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({ type: 'manual-capture' });
    expect(deps.setMessage).toHaveBeenCalledWith('Round-up complete. Coop checked 3 tabs locally.');
    expect(deps.setPanelTab).toHaveBeenCalledWith('chickens');
    expect(deps.loadDashboard).toHaveBeenCalledTimes(1);
  });

  it('surfaces active-tab capture exceptions', async () => {
    const deps = makeDeps();
    sendRuntimeMessageMock.mockRejectedValue(new Error('capture blew up'));

    const { result } = renderHook(() => useTabCapture(deps));

    await act(async () => {
      await result.current.runActiveTabCapture();
    });

    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({ type: 'capture-active-tab' });
    expect(deps.setMessage).toHaveBeenCalledWith('capture blew up');
    expect(deps.loadDashboard).not.toHaveBeenCalled();
  });

  it('navigates to nest after a successful screenshot capture', async () => {
    const deps = makeDeps();
    sendRuntimeMessageMock.mockResolvedValue({ ok: true, data: { id: 'capture-1' } });

    const { result } = renderHook(() => useTabCapture(deps));

    await act(async () => {
      await result.current.captureVisibleScreenshotAction();
    });

    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({ type: 'capture-visible-screenshot' });
    expect(deps.setMessage).toHaveBeenCalledWith('This page was snapped into Pocket Coop finds.');
    expect(deps.setPanelTab).toHaveBeenCalledWith('nest');
    expect(deps.loadDashboard).toHaveBeenCalledTimes(1);
  });

  it('updates agent cadence after loading current preferences', async () => {
    const deps = makeDeps();
    sendRuntimeMessageMock
      .mockResolvedValueOnce({
        ok: true,
        data: {
          agentCadenceMinutes: 15,
          captureOnClose: false,
          excludedCategories: [],
          customExcludedDomains: [],
        },
      })
      .mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useTabCapture(deps));

    await act(async () => {
      await result.current.updateAgentCadence(60);
    });

    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(1, { type: 'get-ui-preferences' });
    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(2, {
      type: 'set-ui-preferences',
      payload: expect.objectContaining({ agentCadenceMinutes: 60 }),
    });
    expect(deps.setMessage).toHaveBeenCalledWith('Agent cadence updated to 60 min.');
    expect(deps.loadDashboard).toHaveBeenCalledTimes(1);
  });

  it('updates excluded categories and custom domains', async () => {
    const deps = makeDeps();
    sendRuntimeMessageMock
      .mockResolvedValueOnce({
        ok: true,
        data: {
          agentCadenceMinutes: 15,
          captureOnClose: false,
          excludedCategories: ['finance'],
          customExcludedDomains: ['old.example'],
        },
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          agentCadenceMinutes: 15,
          captureOnClose: false,
          excludedCategories: [],
          customExcludedDomains: [],
        },
      })
      .mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useTabCapture(deps));

    await act(async () => {
      await result.current.updateExcludedCategories(['social']);
      await result.current.updateCustomExcludedDomains(['coop.town']);
    });

    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(2, {
      type: 'set-ui-preferences',
      payload: expect.objectContaining({ excludedCategories: ['social'] }),
    });
    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(4, {
      type: 'set-ui-preferences',
      payload: expect.objectContaining({ customExcludedDomains: ['coop.town'] }),
    });
    expect(deps.loadDashboard).toHaveBeenCalledTimes(2);
  });

  it('toggles capture-on-close and reports the new state', async () => {
    const deps = makeDeps();
    sendRuntimeMessageMock
      .mockResolvedValueOnce({
        ok: true,
        data: {
          agentCadenceMinutes: 15,
          captureOnClose: false,
          excludedCategories: [],
          customExcludedDomains: [],
        },
      })
      .mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useTabCapture(deps));

    await act(async () => {
      await result.current.toggleCaptureOnClose(true);
    });

    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(2, {
      type: 'set-ui-preferences',
      payload: expect.objectContaining({ captureOnClose: true }),
    });
    expect(deps.setMessage).toHaveBeenCalledWith('Closing tabs will now be captured.');
    expect(deps.loadDashboard).toHaveBeenCalledTimes(1);
  });
});
