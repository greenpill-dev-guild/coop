import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockIsSidepanelOpen, mockSetSidepanelWindowState } = vi.hoisted(() => ({
  mockIsSidepanelOpen: vi.fn(),
  mockSetSidepanelWindowState: vi.fn(),
}));

vi.mock('../context', () => ({
  isSidepanelOpen: mockIsSidepanelOpen,
  setSidepanelWindowState: mockSetSidepanelWindowState,
}));

describe('sidepanel popup helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    mockIsSidepanelOpen.mockReset();
    mockSetSidepanelWindowState.mockReset();
    Reflect.deleteProperty(globalThis, 'chrome');
  });

  it('reports sidepanel state and close capability', async () => {
    mockIsSidepanelOpen.mockResolvedValue(true);

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        sidePanel: {
          open: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined),
        },
      },
    });

    const { getPopupSidepanelState } = await import('../sidepanel');

    await expect(getPopupSidepanelState(7)).resolves.toEqual({
      open: true,
      canClose: true,
    });
  });

  it('closes an open sidepanel when the close API is available', async () => {
    mockIsSidepanelOpen.mockResolvedValue(true);
    const close = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        sidePanel: {
          open: vi.fn().mockResolvedValue(undefined),
          close,
        },
      },
    });

    const { togglePopupSidepanel } = await import('../sidepanel');

    await expect(togglePopupSidepanel(7)).resolves.toEqual({
      open: false,
      canClose: true,
    });
    expect(close).toHaveBeenCalledWith({ windowId: 7 });
    expect(mockSetSidepanelWindowState).toHaveBeenCalledWith(7, false);
  });

  it('opens the sidepanel when it is closed', async () => {
    mockIsSidepanelOpen.mockResolvedValue(false);
    const open = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        sidePanel: {
          open,
        },
      },
    });

    const { togglePopupSidepanel } = await import('../sidepanel');

    await expect(togglePopupSidepanel(7)).resolves.toEqual({
      open: true,
      canClose: false,
    });
    expect(open).toHaveBeenCalledWith({ windowId: 7 });
    expect(mockSetSidepanelWindowState).toHaveBeenCalledWith(7, true);
  });

  it('registers lifecycle listeners only once and persists updates', async () => {
    const onOpenedAddListener = vi.fn();
    const onClosedAddListener = vi.fn();

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        sidePanel: {
          open: vi.fn().mockResolvedValue(undefined),
          onOpened: {
            addListener: onOpenedAddListener,
          },
          onClosed: {
            addListener: onClosedAddListener,
          },
        },
      },
    });

    const { registerSidepanelLifecycleListeners } = await import('../sidepanel');

    registerSidepanelLifecycleListeners();
    registerSidepanelLifecycleListeners();

    expect(onOpenedAddListener).toHaveBeenCalledTimes(1);
    expect(onClosedAddListener).toHaveBeenCalledTimes(1);

    const onOpened = onOpenedAddListener.mock.calls[0]?.[0] as (info: { windowId: number }) => void;
    const onClosed = onClosedAddListener.mock.calls[0]?.[0] as (info: { windowId: number }) => void;

    onOpened({ windowId: 7 });
    onClosed({ windowId: 7 });

    expect(mockSetSidepanelWindowState).toHaveBeenNthCalledWith(1, 7, true);
    expect(mockSetSidepanelWindowState).toHaveBeenNthCalledWith(2, 7, false);
  });
});
