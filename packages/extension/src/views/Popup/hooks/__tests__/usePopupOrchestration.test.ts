import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type makeArtifact,
  makeDashboard,
  type makeDraft,
} from '../../../__test-utils__/popup-harness';
import type { PopupPendingCapture } from '../../popup-types';

const {
  clearAgentDeltaMock,
  goHomeMock,
  loadDashboardMock,
  navigateMock,
  openDraftMock,
  prepareFileCaptureMock,
  prepareVisibleScreenshotMock,
  saveAudioCaptureDirectMock,
  savePendingCaptureMock,
  sendRuntimeMessageMock,
  setCreateFormMock,
  setJoinFormMock,
  state,
} = vi.hoisted(() => ({
  sendRuntimeMessageMock: vi.fn(),
  prepareVisibleScreenshotMock: vi.fn(),
  prepareFileCaptureMock: vi.fn(),
  savePendingCaptureMock: vi.fn(),
  saveAudioCaptureDirectMock: vi.fn(),
  navigateMock: vi.fn(),
  goHomeMock: vi.fn(),
  openDraftMock: vi.fn(),
  setCreateFormMock: vi.fn(),
  setJoinFormMock: vi.fn(),
  loadDashboardMock: vi.fn(async () => undefined),
  clearAgentDeltaMock: vi.fn(),
  state: {
    dashboard: null as ReturnType<typeof makeDashboard> | null,
    snapshot: null as {
      coopOptions?: Array<{ id: string; name: string }>;
      draftCount?: number;
      lastCaptureAt?: string;
      syncLabel?: string;
      syncDetail?: string;
      syncTone?: 'ok' | 'warning' | 'critical';
    } | null,
    hasCoops: false,
    coops: [] as ReturnType<typeof makeDashboard>['coops'],
    visibleDrafts: [] as Array<ReturnType<typeof makeDraft>>,
    recentArtifacts: [] as Array<ReturnType<typeof makeArtifact>>,
    loading: false,
    dashboardError: '',
    agentDelta: null as { message: string } | null,
    selectedDraft: null as ReturnType<typeof makeDraft> | null,
    navigationState: {
      screen: 'home' as const,
      selectedDraftId: null,
      createForm: {
        coopName: '',
        creatorName: '',
        purpose: '',
        starterNote: '',
      },
      joinForm: {
        inviteCode: '',
        displayName: '',
        starterNote: '',
      },
    },
  },
}));

vi.mock('../../../../runtime/messages', () => ({
  sendRuntimeMessage: sendRuntimeMessageMock,
}));

vi.mock('../../../shared/useCaptureActions', () => ({
  useCaptureActions: () => ({
    isCapturing: false,
    isRoundupInFlight: false,
    prepareVisibleScreenshot: prepareVisibleScreenshotMock,
    prepareFileCapture: prepareFileCaptureMock,
    savePendingCapture: savePendingCaptureMock,
    saveAudioCaptureDirect: saveAudioCaptureDirectMock,
    prepareAudioCapture: vi.fn(),
    runManualCapture: vi.fn(),
    runActiveTabCapture: vi.fn(),
  }),
}));

vi.mock('../../../shared/useCoopActions', () => ({
  useCoopActions: () => ({}),
}));

vi.mock('../../../shared/useQuickDraftActions', () => ({
  useQuickDraftActions: () => ({}),
}));

vi.mock('../usePersistedPopupState', () => ({
  usePersistedPopupState: (_key: string, initialState: unknown) => ({
    loading: false,
    state: initialState,
    setState: vi.fn(),
  }),
}));

vi.mock('../usePopupDashboard', () => ({
  usePopupDashboard: () => ({
    dashboard: state.dashboard,
    snapshot: state.snapshot,
    hasCoops: state.hasCoops,
    coops: state.coops,
    loading: state.loading,
    dashboardError: state.dashboardError,
    loadDashboard: loadDashboardMock,
    visibleDrafts: state.visibleDrafts,
    recentArtifacts: state.recentArtifacts,
    agentDelta: state.agentDelta,
    clearAgentDelta: clearAgentDeltaMock,
  }),
}));

vi.mock('../usePopupDraftHandlers', () => ({
  usePopupDraftHandlers: () => ({
    selectedDraft: state.selectedDraft,
    draftSaving: false,
    handleSaveSelectedDraft: vi.fn(async () => undefined),
    handleToggleSelectedDraftReady: vi.fn(async () => undefined),
    handleShareSelectedDraft: vi.fn(async () => undefined),
    handleMarkDraftReady: vi.fn(async () => undefined),
    handleShareDraft: vi.fn(async () => undefined),
    updateSelectedDraft: vi.fn(),
    resolveDraftValue: <T>(draft: T) => draft,
  }),
}));

vi.mock('../usePopupFormHandlers', () => ({
  usePopupFormHandlers: () => ({
    createSubmitting: false,
    joinSubmitting: false,
    handleCreateSubmit: vi.fn(async () => undefined),
    handleJoinSubmit: vi.fn(async () => undefined),
    handlePasteCreatePurpose: vi.fn(async () => undefined),
    handlePasteJoinInviteCode: vi.fn(async () => undefined),
  }),
}));

vi.mock('../usePopupNavigation', () => ({
  usePopupNavigation: () => ({
    state: state.navigationState,
    navigate: navigateMock,
    goHome: goHomeMock,
    openDraft: openDraftMock,
    setCreateForm: setCreateFormMock,
    setJoinForm: setJoinFormMock,
  }),
}));

vi.mock('../usePopupNoteHandlers', () => ({
  usePopupNoteHandlers: () => ({
    handleSaveNote: vi.fn(async () => undefined),
    handlePasteNote: vi.fn(async () => undefined),
  }),
}));

vi.mock('../usePopupProfile', () => ({
  usePopupProfile: () => ({
    updateUiPreferences: vi.fn(async () => undefined),
    updateSound: vi.fn(async () => undefined),
    playBrandSound: vi.fn(),
    accountLabel: 'Ava',
    profileCoops: [],
    onCopyInviteCode: vi.fn(),
  }),
}));

vi.mock('../usePopupRecording', () => ({
  usePopupRecording: () => ({
    partialSaveMessage: null,
    clearPartialSaveMessage: vi.fn(),
    isRecording: false,
    status: 'idle',
    elapsedSeconds: 0,
    permissionMessage: null,
    startRecording: vi.fn(async () => undefined),
    stopRecording: vi.fn(),
    cancelRecording: vi.fn(),
  }),
}));

vi.mock('../usePopupTheme', () => ({
  usePopupTheme: () => ({
    themePreference: 'system',
    setThemePreference: vi.fn(),
  }),
}));

const { usePopupOrchestration } = await import('../usePopupOrchestration');

function resetPopupState() {
  const dashboard = makeDashboard();
  state.dashboard = dashboard;
  state.snapshot = null;
  state.hasCoops = true;
  state.coops = dashboard.coops;
  state.visibleDrafts = dashboard.drafts;
  state.recentArtifacts = dashboard.coops.flatMap((coop) => coop.artifacts);
  state.loading = false;
  state.dashboardError = '';
  state.agentDelta = null;
  state.selectedDraft = null;
  state.navigationState = {
    screen: 'home',
    selectedDraftId: null,
    createForm: {
      coopName: '',
      creatorName: '',
      purpose: '',
      starterNote: '',
    },
    joinForm: {
      inviteCode: '',
      displayName: '',
      starterNote: '',
    },
  };
}

describe('usePopupOrchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPopupState();

    sendRuntimeMessageMock.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'get-sidepanel-state') {
        return { ok: true, data: { open: false, canClose: true } };
      }
      return { ok: true };
    });

    prepareVisibleScreenshotMock.mockResolvedValue(null);
    prepareFileCaptureMock.mockResolvedValue(null);
    savePendingCaptureMock.mockResolvedValue(true);
    saveAudioCaptureDirectMock.mockResolvedValue(undefined);

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        tabs: {
          query: vi.fn().mockResolvedValue([{ windowId: 7 }]),
          create: vi.fn().mockResolvedValue(undefined),
        },
        sidePanel: {
          open: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined),
        },
        runtime: {
          getURL: vi.fn((path: string) => `chrome-extension://${path}`),
        },
      },
    });

    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  it('falls back to the no-coop screen when the dashboard has no coops', async () => {
    const emptyDashboard = makeDashboard({
      coops: [],
      activeCoopId: undefined,
      summary: {
        ...makeDashboard().summary,
        coopCount: 0,
        activeCoopId: undefined,
      },
    });
    state.dashboard = emptyDashboard;
    state.hasCoops = false;
    state.coops = [];
    state.recentArtifacts = [];
    state.visibleDrafts = [];

    const { result } = renderHook(() => usePopupOrchestration());

    await waitFor(() => {
      expect(result.current.currentScreen).toBe('no-coop');
    });

    expect(result.current.showCreateJoinInHeader).toBe(false);
    expect(result.current.showProfileAction).toBe(false);
    expect(result.current.showWorkspaceAction).toBe(false);
  });

  it('routes away from draft detail when the selected draft is missing', async () => {
    state.navigationState = {
      ...state.navigationState,
      screen: 'draft-detail',
      selectedDraftId: 'missing-draft',
    };
    state.selectedDraft = null;

    renderHook(() => usePopupOrchestration());

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('drafts');
    });
  });

  it('tracks and clears pending popup captures via orchestration handlers', async () => {
    const pendingCapture: PopupPendingCapture = {
      kind: 'photo',
      title: 'Popup screenshot',
      note: 'Reviewed in orchestration test.',
      mimeType: 'image/png',
      fileName: 'popup.png',
      byteSize: 512,
      previewUrl: 'blob:popup-preview',
    };
    prepareVisibleScreenshotMock.mockResolvedValueOnce(pendingCapture);

    const { result } = renderHook(() => usePopupOrchestration());

    await act(async () => {
      await result.current.handlePrepareScreenshot();
    });

    expect(result.current.pendingCapture).toEqual(pendingCapture);

    await act(async () => {
      await result.current.handleSavePendingCapture();
    });

    await waitFor(() => {
      expect(result.current.pendingCapture).toBeNull();
    });

    expect(savePendingCaptureMock).toHaveBeenCalledWith(pendingCapture);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:popup-preview');
  });
});
