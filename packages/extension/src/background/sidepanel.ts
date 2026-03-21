import type { PopupSidepanelState } from '../runtime/messages';
import { isSidepanelOpen, setSidepanelWindowState } from './context';

type SidepanelLifecycleInfo = {
  windowId: number;
  tabId?: number;
  path?: string;
};

type SidepanelApi = typeof chrome.sidePanel & {
  close?: (options: { windowId?: number; tabId?: number }) => Promise<void>;
  onOpened?: {
    addListener: (callback: (info: SidepanelLifecycleInfo) => void) => void;
  };
  onClosed?: {
    addListener: (callback: (info: SidepanelLifecycleInfo) => void) => void;
  };
};

let registeredLifecycleListeners = false;

function getSidepanelApi(): SidepanelApi {
  return chrome.sidePanel as SidepanelApi;
}

export function registerSidepanelLifecycleListeners() {
  if (registeredLifecycleListeners) {
    return;
  }

  registeredLifecycleListeners = true;
  const sidePanelApi = getSidepanelApi();

  sidePanelApi.onOpened?.addListener?.((info) => {
    void setSidepanelWindowState(info.windowId, true);
  });

  sidePanelApi.onClosed?.addListener?.((info) => {
    void setSidepanelWindowState(info.windowId, false);
  });
}

export async function getPopupSidepanelState(windowId: number): Promise<PopupSidepanelState> {
  const sidePanelApi = getSidepanelApi();
  return {
    open: await isSidepanelOpen(windowId),
    canClose: typeof sidePanelApi.close === 'function',
  };
}

export async function togglePopupSidepanel(windowId: number): Promise<PopupSidepanelState> {
  const sidePanelApi = getSidepanelApi();
  const currentState = await getPopupSidepanelState(windowId);

  if (currentState.open && currentState.canClose) {
    await sidePanelApi.close?.({ windowId });
    await setSidepanelWindowState(windowId, false);
    return {
      open: false,
      canClose: true,
    };
  }

  await sidePanelApi.open({ windowId });
  await setSidepanelWindowState(windowId, true);
  return {
    open: true,
    canClose: currentState.canClose,
  };
}
