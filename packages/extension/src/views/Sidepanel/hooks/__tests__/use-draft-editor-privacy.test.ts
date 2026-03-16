import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stub chrome.runtime before importing the hook.
const sendMessageMock = vi.fn();

Object.defineProperty(globalThis, 'chrome', {
  configurable: true,
  value: {
    runtime: {
      sendMessage: sendMessageMock,
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  },
});

vi.mock('../../../../runtime/audio', () => ({
  playCoopSound: vi.fn(),
}));

vi.mock('../../../../runtime/messages', async () => {
  return {
    sendRuntimeMessage: sendMessageMock,
  };
});

vi.mock('../../../../runtime/inference-bridge', () => ({
  InferenceBridge: vi.fn(),
}));

const { useDraftEditor } = await import('../useDraftEditor');

function makeReviewDraft(overrides: Record<string, unknown> = {}) {
  return {
    id: 'draft-1',
    title: 'Test Draft',
    summary: 'A test summary',
    tags: ['test'],
    category: 'thought',
    whyItMatters: 'Because testing matters',
    suggestedNextStep: 'Ship it',
    workflowStage: 'ready' as const,
    suggestedTargetCoopIds: ['coop-1'],
    sources: [{ label: 'Source', url: 'https://example.com', domain: 'example.com' }],
    rationale: '',
    provenance: { type: 'manual' as const },
    ...overrides,
  };
}

describe('useDraftEditor — anonymous publish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes anonymousPublish state defaulting to false', () => {
    const { result } = renderHook(() =>
      useDraftEditor({
        activeCoop: undefined,
        setMessage: vi.fn(),
        setPanelTab: vi.fn(),
        loadDashboard: vi.fn().mockResolvedValue(undefined),
        soundPreferences: {
          enabled: true,
          volume: 0.5,
          roosterCallEnabled: true,
          softCluckEnabled: true,
        },
        inferenceBridgeRef: { current: null },
      }),
    );

    expect(result.current.anonymousPublish).toBe(false);
    expect(typeof result.current.setAnonymousPublish).toBe('function');
  });

  it('toggles anonymousPublish state', () => {
    const { result } = renderHook(() =>
      useDraftEditor({
        activeCoop: undefined,
        setMessage: vi.fn(),
        setPanelTab: vi.fn(),
        loadDashboard: vi.fn().mockResolvedValue(undefined),
        soundPreferences: {
          enabled: true,
          volume: 0.5,
          roosterCallEnabled: true,
          softCluckEnabled: true,
        },
        inferenceBridgeRef: { current: null },
      }),
    );

    act(() => {
      result.current.setAnonymousPublish(true);
    });

    expect(result.current.anonymousPublish).toBe(true);
  });

  it('passes anonymous flag to publish-draft message when enabled', async () => {
    const draft = makeReviewDraft();

    sendMessageMock.mockResolvedValue({ ok: true });

    const { result } = renderHook(() =>
      useDraftEditor({
        activeCoop: undefined,
        setMessage: vi.fn(),
        setPanelTab: vi.fn(),
        loadDashboard: vi.fn().mockResolvedValue(undefined),
        soundPreferences: {
          enabled: true,
          volume: 0.5,
          roosterCallEnabled: true,
          softCluckEnabled: true,
        },
        inferenceBridgeRef: { current: null },
      }),
    );

    // Enable anonymous publish
    act(() => {
      result.current.setAnonymousPublish(true);
    });

    await act(async () => {
      await result.current.publishDraft(draft as never);
    });

    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'publish-draft',
        payload: expect.objectContaining({
          anonymous: true,
        }),
      }),
    );
  });

  it('does not pass anonymous flag when disabled', async () => {
    const draft = makeReviewDraft();

    sendMessageMock.mockResolvedValue({ ok: true });

    const { result } = renderHook(() =>
      useDraftEditor({
        activeCoop: undefined,
        setMessage: vi.fn(),
        setPanelTab: vi.fn(),
        loadDashboard: vi.fn().mockResolvedValue(undefined),
        soundPreferences: {
          enabled: true,
          volume: 0.5,
          roosterCallEnabled: true,
          softCluckEnabled: true,
        },
        inferenceBridgeRef: { current: null },
      }),
    );

    await act(async () => {
      await result.current.publishDraft(draft as never);
    });

    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'publish-draft',
        payload: expect.objectContaining({
          anonymous: false,
        }),
      }),
    );
  });
});
