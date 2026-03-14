import {
  type ReceiverCapture,
  type TabCandidate,
  createId,
  createLocalEnhancementAdapter,
  createReceiverCapture,
  getAuthSession,
  nowIso,
  runPassivePipeline,
} from '@coop/shared';
import type { RuntimeActionResponse } from '../../runtime/messages';
import { resolveReceiverPairingMember } from '../../runtime/receiver';
import {
  type CaptureSnapshot,
  extractPageSnapshot,
  isSupportedUrl,
} from '../../runtime/tab-capture';
import {
  contextMenuIds,
  db,
  extensionCaptureDeviceId,
  getCoops,
  notifyExtensionEvent,
  prefersLocalEnhancement,
  setRuntimeHealth,
} from '../context';
import { refreshBadge } from '../dashboard';
import { getActiveReviewContextForSession } from '../operator';
import { syncHighConfidenceDraftObservations } from './agent';

export async function collectCandidate(
  tab: chrome.tabs.Tab,
): Promise<{ candidate: TabCandidate; snapshot: CaptureSnapshot } | null> {
  if (!tab.id || !tab.url || !isSupportedUrl(tab.url)) {
    return null;
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractPageSnapshot,
  });
  const result = results?.[0]?.result;

  if (!result) {
    return null;
  }

  return {
    candidate: {
      id: createId('candidate'),
      tabId: tab.id,
      windowId: tab.windowId ?? 0,
      url: tab.url,
      canonicalUrl: tab.url,
      title: result.title || tab.title || tab.url,
      domain: new URL(tab.url).hostname.replace(/^www\./, ''),
      favicon: tab.favIconUrl,
      excerpt: result.metaDescription ?? result.paragraphs[0],
      tabGroupHint: undefined,
      capturedAt: nowIso(),
    },
    snapshot: result,
  };
}

export async function runCaptureForTabs(tabs: chrome.tabs.Tab[]) {
  const coops = await getCoops();
  const candidates: TabCandidate[] = [];
  const inferenceAdapter = createLocalEnhancementAdapter({
    prefersLocalModels: prefersLocalEnhancement,
    hasWorkerRuntime: true,
    hasWebGpu: typeof navigator !== 'undefined' && 'gpu' in navigator,
  });
  let lastCaptureError: string | undefined;

  for (const tab of tabs) {
    if (!isSupportedUrl(tab.url)) {
      continue;
    }

    try {
      const collected = await collectCandidate(tab);
      if (!collected) {
        continue;
      }
      const { candidate, snapshot } = collected;
      candidates.push(candidate);
      await db.tabCandidates.put(candidate);

      if (coops.length > 0) {
        const { extract, drafts } = runPassivePipeline({
          candidate,
          page: snapshot,
          coops,
          inferenceAdapter,
        });
        await db.pageExtracts.put(extract);
        await db.reviewDrafts.bulkPut(drafts);
        await syncHighConfidenceDraftObservations(drafts);
      }
    } catch (error) {
      lastCaptureError =
        error instanceof Error ? error.message : `Capture failed for ${tab.url ?? 'unknown tab'}.`;
    }
  }

  await db.captureRuns.put({
    id: createId('capture'),
    state: lastCaptureError ? 'failed' : 'completed',
    capturedAt: nowIso(),
    candidateCount: candidates.length,
  });
  await setRuntimeHealth({
    syncError: Boolean(lastCaptureError),
    lastCaptureError,
  });
  await refreshBadge();

  return candidates.length;
}

export async function runCaptureCycle() {
  return runCaptureForTabs(await chrome.tabs.query({}));
}

export async function captureActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    return 0;
  }
  return runCaptureForTabs([tab]);
}

export async function captureVisibleScreenshot(): Promise<ReceiverCapture> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.windowId || !tab.url || !isSupportedUrl(tab.url)) {
    throw new Error('Open a standard web page before capturing a screenshot.');
  }

  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: 'png',
  });
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const timestamp = nowIso();
  const coops = await getCoops();
  const authSession = await getAuthSession(db);
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  const activeCoop = coops.find((coop) => coop.profile.id === activeContext.activeCoopId);
  const activeMember = resolveReceiverPairingMember(activeCoop, authSession);
  const capture = {
    ...createReceiverCapture({
      deviceId: extensionCaptureDeviceId,
      kind: 'photo',
      blob,
      fileName: `coop-screenshot-${timestamp.replace(/[:.]/gu, '-')}.png`,
      title: `Page screenshot · ${tab.title || new URL(tab.url).hostname}`,
      note: `Captured from ${tab.url} via Extension Browser.`,
      sourceUrl: tab.url,
      createdAt: timestamp,
    }),
    coopId: activeCoop?.profile.id,
    coopDisplayName: activeCoop?.profile.name,
    memberId: activeMember?.id,
    memberDisplayName: activeMember?.displayName,
    updatedAt: timestamp,
  } satisfies ReceiverCapture;

  const shared = await import('@coop/shared');
  await shared.saveReceiverCapture(db, capture, blob);
  await refreshBadge();
  await notifyExtensionEvent({
    eventKind: 'screenshot-saved',
    entityId: capture.id,
    state: 'saved',
    title: 'Screenshot saved',
    message: activeCoop?.profile.name
      ? `Saved a private screenshot for ${activeCoop.profile.name}.`
      : 'Saved a private local screenshot to Coop.',
  });
  return capture;
}

export async function registerContextMenus() {
  await chrome.contextMenus.removeAll();
  await chrome.contextMenus.create({
    id: contextMenuIds.open,
    title: 'Open Coop',
    contexts: ['action'],
  });
  await chrome.contextMenus.create({
    id: contextMenuIds.roundUp,
    title: 'Round up this tab',
    contexts: ['page', 'action'],
  });
  await chrome.contextMenus.create({
    id: contextMenuIds.screenshot,
    title: 'Capture screenshot to Coop',
    contexts: ['page', 'action'],
  });
}

export async function openCoopSidepanel() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.windowId) {
    return false;
  }

  await chrome.sidePanel.open({ windowId: tab.windowId });
  return true;
}
