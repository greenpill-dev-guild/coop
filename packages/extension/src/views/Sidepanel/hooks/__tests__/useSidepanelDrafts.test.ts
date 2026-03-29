import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { downloadTextMock, sendRuntimeMessageMock } = vi.hoisted(() => ({
  downloadTextMock: vi.fn(async () => undefined),
  sendRuntimeMessageMock: vi.fn(),
}));

vi.mock('../../../../runtime/messages', () => ({
  sendRuntimeMessage: sendRuntimeMessageMock,
}));

vi.mock('../../helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../helpers')>();
  return {
    ...actual,
    downloadText: downloadTextMock,
  };
});

const { useSidepanelDrafts } = await import('../useSidepanelDrafts');

function makeActiveCoop() {
  return {
    profile: {
      id: 'coop-1',
      name: 'River Coop',
    },
    artifacts: [
      {
        id: 'artifact-1',
      },
      {
        id: 'artifact-2',
      },
    ],
    archiveReceipts: [
      {
        id: 'receipt-1',
      },
      {
        id: 'receipt-2',
      },
    ],
  } as never;
}

function makeDeps(overrides: Partial<Parameters<typeof useSidepanelDrafts>[0]> = {}) {
  return {
    activeCoop: makeActiveCoop(),
    dashboard: {
      uiPreferences: {
        preferredExportMethod: 'download',
      },
    } as never,
    browserUxCapabilities: {
      canSaveFile: false,
    } as never,
    setMessage: vi.fn(),
    loadDashboard: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('useSidepanelDrafts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (
      globalThis as typeof globalThis & {
        showSaveFilePicker?: unknown;
      }
    ).showSaveFilePicker = undefined;
  });

  it('archives artifacts through runtime messages and reloads the dashboard', async () => {
    const deps = makeDeps();
    sendRuntimeMessageMock.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useSidepanelDrafts(deps));

    await act(async () => {
      await result.current.archiveArtifact('artifact-1');
    });

    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
      type: 'archive-artifact',
      payload: {
        coopId: 'coop-1',
        artifactId: 'artifact-1',
      },
    });
    expect(deps.setMessage).toHaveBeenCalledWith('Saved proof created and stored.');
    expect(deps.loadDashboard).toHaveBeenCalledTimes(1);
  });

  it('falls back to a download when the file picker is unavailable', async () => {
    const deps = makeDeps({
      dashboard: {
        uiPreferences: {
          preferredExportMethod: 'file-picker',
        },
      } as never,
      browserUxCapabilities: {
        canSaveFile: true,
      } as never,
    });

    const { result } = renderHook(() => useSidepanelDrafts(deps));

    await expect(result.current.saveTextExport('notes.txt', 'hello coop')).resolves.toBe(
      'download',
    );
    expect(downloadTextMock).toHaveBeenCalledWith('notes.txt', 'hello coop');
  });

  it('writes exports through the browser file picker when available', async () => {
    const deps = makeDeps({
      dashboard: {
        uiPreferences: {
          preferredExportMethod: 'file-picker',
        },
      } as never,
      browserUxCapabilities: {
        canSaveFile: true,
      } as never,
    });
    const write = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    (
      globalThis as typeof globalThis & {
        showSaveFilePicker?: (options?: unknown) => Promise<{
          createWritable: () => Promise<{
            write: (data: Blob) => Promise<void>;
            close: () => Promise<void>;
          }>;
        }>;
      }
    ).showSaveFilePicker = vi.fn(async () => ({
      createWritable: async () => ({ write, close }),
    }));

    sendRuntimeMessageMock.mockResolvedValue({ ok: true, data: '{"ok":true}' });

    const { result } = renderHook(() => useSidepanelDrafts(deps));

    await act(async () => {
      await result.current.exportSnapshot('json');
    });

    expect(write).toHaveBeenCalledTimes(1);
    const blob = write.mock.calls[0]?.[0];
    expect(blob).toBeInstanceOf(Blob);
    await expect(blob.text()).resolves.toBe('{"ok":true}');
    expect(close).toHaveBeenCalledTimes(1);
    expect(downloadTextMock).not.toHaveBeenCalled();
    expect(deps.setMessage).toHaveBeenCalledWith('Coop snapshot exported as JSON via file picker.');
  });

  it('surfaces export failures without attempting a save', async () => {
    const deps = makeDeps();
    sendRuntimeMessageMock.mockResolvedValue({ ok: false, error: 'snapshot broken' });

    const { result } = renderHook(() => useSidepanelDrafts(deps));

    await act(async () => {
      await result.current.exportLatestReceipt('text');
    });

    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
      type: 'export-receipt',
      payload: {
        coopId: 'coop-1',
        receiptId: 'receipt-2',
        format: 'text',
      },
    });
    expect(deps.setMessage).toHaveBeenCalledWith('snapshot broken');
    expect(downloadTextMock).not.toHaveBeenCalled();
  });

  it('updates save marks and reports runtime failures', async () => {
    const deps = makeDeps();
    sendRuntimeMessageMock.mockResolvedValue({ ok: false, error: 'save mark failed' });

    const { result } = renderHook(() => useSidepanelDrafts(deps));

    await act(async () => {
      await result.current.toggleArtifactArchiveWorthiness('artifact-1', true);
    });

    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
      type: 'set-artifact-archive-worthy',
      payload: {
        coopId: 'coop-1',
        artifactId: 'artifact-1',
        archiveWorthy: true,
      },
    });
    expect(deps.setMessage).toHaveBeenCalledWith('save mark failed');
    expect(deps.loadDashboard).not.toHaveBeenCalled();
  });

  it('dispatches anchor and Filecoin registration actions and refreshes afterward', async () => {
    const deps = makeDeps();
    sendRuntimeMessageMock
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, error: 'registration failed' });

    const { result } = renderHook(() => useSidepanelDrafts(deps));

    act(() => {
      result.current.handleAnchorOnChain('receipt-1');
      result.current.handleFvmRegister('receipt-2');
    });

    await waitFor(() => expect(deps.loadDashboard).toHaveBeenCalledTimes(2));

    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(1, {
      type: 'anchor-archive-cid',
      payload: {
        coopId: 'coop-1',
        receiptId: 'receipt-1',
      },
    });
    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(2, {
      type: 'fvm-register-archive',
      payload: {
        coopId: 'coop-1',
        receiptId: 'receipt-2',
      },
    });
    expect(deps.setMessage).toHaveBeenNthCalledWith(1, 'Anchor transaction submitted.');
    expect(deps.setMessage).toHaveBeenNthCalledWith(2, 'registration failed');
  });

  it('archives and exports the latest coop records through helper actions', async () => {
    const deps = makeDeps();
    sendRuntimeMessageMock
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          message: 'Archive status refreshed.',
        },
      })
      .mockResolvedValueOnce({ ok: true, data: 'latest artifact text' });

    const { result } = renderHook(() => useSidepanelDrafts(deps));

    await act(async () => {
      await result.current.archiveLatestArtifact();
      await result.current.archiveSnapshot();
      await result.current.refreshArchiveStatus('receipt-1');
      await result.current.exportLatestArtifact('text');
    });

    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(1, {
      type: 'archive-artifact',
      payload: {
        coopId: 'coop-1',
        artifactId: 'artifact-2',
      },
    });
    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(2, {
      type: 'archive-snapshot',
      payload: {
        coopId: 'coop-1',
      },
    });
    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(3, {
      type: 'refresh-archive-status',
      payload: {
        coopId: 'coop-1',
        receiptId: 'receipt-1',
      },
    });
    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(4, {
      type: 'export-artifact',
      payload: {
        coopId: 'coop-1',
        artifactId: 'artifact-2',
        format: 'text',
      },
    });
    expect(downloadTextMock).toHaveBeenCalledWith(
      'River Coop-artifact.txt',
      'latest artifact text',
    );
    expect(deps.setMessage).toHaveBeenCalledWith('Archive status refreshed.');
  });
});
