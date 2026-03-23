import {
  type CoopSharedState,
  type ReceiverCapture,
  type TabCandidate,
  buildReadablePageExtract,
  canonicalizeUrl,
  compressImage,
  createId,
  createReceiverCapture,
  findExistingExtractByTextHash,
  findRecentCandidateByUrlHash,
  getAuthSession,
  hashText,
  isDomainExcluded,
  listPageExtracts,
  nowIso,
  savePageExtract,
  saveReceiverCapture,
  saveTabCandidate,
} from '@coop/shared';
import { resolveReceiverPairingMember } from '../../runtime/receiver';
import {
  type CaptureSnapshot,
  extractPageSnapshot,
  isSupportedUrl,
} from '../../runtime/tab-capture';
import {
  contextMenuIds,
  db,
  ensureDbReady,
  extensionCaptureDeviceId,
  getCapturePeriodMinutes,
  getCoops,
  getLocalSetting,
  markUrlCaptured,
  notifyExtensionEvent,
  removeFromTabCache,
  setRuntimeHealth,
  stateKeys,
  tabUrlCache,
  uiPreferences,
  wasRecentlyCaptured,
} from '../context';
import { refreshBadge } from '../dashboard';
import { getActiveReviewContextForSession } from '../operator';
import { drainAgentCycles, emitRoundupBatchObservation } from './agent';

export async function collectCandidate(
  tab: chrome.tabs.Tab,
  options?: { captureRunId?: string },
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

  // Resolve tab group name if the tab belongs to a Chrome tab group
  let tabGroupHint: string | undefined;
  if (tab.groupId && tab.groupId !== -1 && chrome.tabGroups) {
    try {
      const group = await chrome.tabGroups.get(tab.groupId);
      tabGroupHint = group.title || undefined;
    } catch {
      // Tab group may have been removed between query and get
    }
  }

  const canonical = canonicalizeUrl(tab.url);
  return {
    candidate: {
      id: createId('candidate'),
      tabId: tab.id,
      windowId: tab.windowId ?? 0,
      url: tab.url,
      canonicalUrl: canonical,
      canonicalUrlHash: hashText(canonical),
      title: result.title || tab.title || tab.url,
      domain: new URL(tab.url).hostname.replace(/^www\./, ''),
      favicon: tab.favIconUrl,
      excerpt: result.metaDescription ?? result.paragraphs[0],
      tabGroupHint,
      captureRunId: options?.captureRunId,
      capturedAt: nowIso(),
    },
    snapshot: result,
  };
}

export async function runCaptureForTabs(
  tabs: chrome.tabs.Tab[],
  options: { drainAgent?: boolean } = {},
) {
  const coops = await getCoops();
  const candidates: TabCandidate[] = [];
  const newExtractIds: string[] = [];
  const capturedDomains = new Set<string>();
  let skippedCount = 0;
  let lastCaptureError: string | undefined;
  const captureRunId = createId('capture');

  const captureMode = await getLocalSetting<string>(stateKeys.captureMode, 'manual');
  const periodMinutes = getCapturePeriodMinutes(captureMode);
  const dedupCooldownMs = (periodMinutes ?? 5) * 60_000;

  for (const tab of tabs) {
    if (!isSupportedUrl(tab.url)) {
      continue;
    }

    const domain = new URL(tab.url).hostname.replace(/^www\./, '');

    if (isDomainExcluded(domain, uiPreferences)) {
      skippedCount++;
      continue;
    }

    // Fast path: in-memory dedup (survives within a single SW lifetime)
    if (wasRecentlyCaptured(tab.url, dedupCooldownMs)) {
      skippedCount++;
      continue;
    }

    // Persistent dedup: check Dexie for a recent candidate with the same canonical URL hash.
    // This survives MV3 service-worker restarts where the in-memory map is lost.
    // Uses canonicalUrlHash (not canonicalUrl) because the stored canonicalUrl is redacted.
    const canonical = canonicalizeUrl(tab.url);
    const urlHash = hashText(canonical);
    const existingCandidate = await findRecentCandidateByUrlHash(db, urlHash);
    if (
      existingCandidate &&
      Date.now() - new Date(existingCandidate.capturedAt).getTime() < dedupCooldownMs
    ) {
      skippedCount++;
      continue;
    }

    try {
      const collected = await collectCandidate(tab, { captureRunId });
      if (!collected) {
        continue;
      }
      const { candidate, snapshot } = collected;
      candidates.push(candidate);
      capturedDomains.add(candidate.domain);
      markUrlCaptured(tab.url);
      await saveTabCandidate(db, candidate);

      const extract = buildReadablePageExtract({
        candidate,
        metaDescription: snapshot.metaDescription,
        headings: snapshot.headings,
        paragraphs: snapshot.paragraphs,
        previewImageUrl: snapshot.previewImageUrl,
      });

      // Content-hash dedup: skip extract if identical content already exists
      const duplicateExtractId = await findExistingExtractByTextHash(db, extract.textHash);
      if (duplicateExtractId) {
        newExtractIds.push(duplicateExtractId);
      } else {
        await savePageExtract(db, extract);
        newExtractIds.push(extract.id);
      }
    } catch (error) {
      lastCaptureError =
        error instanceof Error ? error.message : `Capture failed for ${tab.url ?? 'unknown tab'}.`;
    }
  }

  if (coops.length > 0) {
    await emitRoundupBatchObservation({
      extractIds: newExtractIds,
      eligibleCoopIds: coops.map((coop) => coop.profile.id),
    });
    if (options.drainAgent && newExtractIds.length > 0) {
      await drainAgentCycles({
        reason: 'capture-complete',
        force: true,
        maxPasses: 2,
      });
    }
  }

  await db.captureRuns.put({
    id: captureRunId,
    state: lastCaptureError ? 'failed' : 'completed',
    capturedAt: nowIso(),
    candidateCount: candidates.length,
    capturedDomains: [...capturedDomains],
    skippedCount,
  });
  await setRuntimeHealth({
    syncError: Boolean(lastCaptureError),
    lastCaptureError,
  });
  await refreshBadge();

  if (candidates.length > 0 || skippedCount > 0) {
    const domainCount = capturedDomains.size;
    const tabLabel = candidates.length !== 1 ? 'tabs' : 'tab';
    const domainLabel = domainCount !== 1 ? 'domains' : 'domain';
    const excludedNote = skippedCount > 0 ? ` ${skippedCount} excluded.` : '';
    await notifyExtensionEvent({
      eventKind: 'capture-roundup',
      entityId: captureRunId,
      state: 'completed',
      title: 'Round-up complete',
      message: `Captured ${candidates.length} ${tabLabel} from ${domainCount} ${domainLabel}.${excludedNote}`,
    });
  }

  return candidates.length;
}

export async function seedCoopFromStoredRoundup(coop: CoopSharedState) {
  const extracts = await listPageExtracts(db);
  if (extracts.length === 0) {
    return 0;
  }

  await emitRoundupBatchObservation({
    extractIds: extracts.map((extract) => extract.id),
    eligibleCoopIds: [coop.profile.id],
  });
  await drainAgentCycles({
    reason: `seed-coop:${coop.profile.id}`,
    force: true,
    maxPasses: 2,
  });
  await refreshBadge();
  return extracts.length;
}

export async function primeCoopRoundup(
  coop: CoopSharedState,
  options: { captureOpenTabs?: boolean } = {},
) {
  const seededDrafts = await seedCoopFromStoredRoundup(coop);
  const capturedTabs = options.captureOpenTabs ? await runCaptureCycle() : 0;
  return {
    seededDrafts,
    capturedTabs,
  };
}

export async function runCaptureCycle() {
  return runCaptureForTabs(await chrome.tabs.query({}), { drainAgent: true });
}

export async function captureActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    return 0;
  }
  return runCaptureForTabs([tab], { drainAgent: true });
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
  const rawBlob = await response.blob();

  // Compress PNG → WebP before storage; fall back to raw PNG on failure
  let blob: Blob;
  let fileExt: string;
  try {
    ({ blob } = await compressImage({ blob: rawBlob }));
    fileExt = 'webp';
  } catch {
    blob = rawBlob;
    fileExt = 'png';
  }

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
      fileName: `coop-screenshot-${timestamp.replace(/[:.]/gu, '-')}.${fileExt}`,
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

  await saveReceiverCapture(db, capture, blob);
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

export async function handleTabRemoved(tabId: number) {
  const cached = tabUrlCache.get(tabId);
  removeFromTabCache(tabId);

  try {
    await ensureDbReady();

    if (!uiPreferences.captureOnClose) {
      return;
    }
    if (!cached?.url || !isSupportedUrl(cached.url)) {
      return;
    }

    const domain = new URL(cached.url).hostname.replace(/^www\./, '');
    if (isDomainExcluded(domain, uiPreferences)) {
      return;
    }
    if (wasRecentlyCaptured(cached.url, 5 * 60_000)) {
      return;
    }

    // Persistent dedup for tab-close captures (uses hash since canonicalUrl is redacted in Dexie)
    const canonical = canonicalizeUrl(cached.url);
    const urlHash = hashText(canonical);
    const existingCandidate = await findRecentCandidateByUrlHash(db, urlHash);
    if (
      existingCandidate &&
      Date.now() - new Date(existingCandidate.capturedAt).getTime() < 5 * 60_000
    ) {
      return;
    }

    const candidate: TabCandidate = {
      id: createId('candidate'),
      tabId,
      windowId: cached.windowId,
      url: cached.url,
      canonicalUrl: canonical,
      canonicalUrlHash: urlHash,
      title: cached.title || cached.url,
      domain,
      favicon: cached.favIconUrl,
      excerpt: undefined,
      tabGroupHint: undefined,
      capturedAt: nowIso(),
    };

    await saveTabCandidate(db, candidate);
    markUrlCaptured(cached.url);

    const extract = buildReadablePageExtract({
      candidate,
      metaDescription: undefined,
      headings: [],
      paragraphs: [],
      previewImageUrl: undefined,
    });

    // Content-hash dedup: skip extract if identical content already exists
    const duplicateExtractId = await findExistingExtractByTextHash(db, extract.textHash);
    if (!duplicateExtractId) {
      await savePageExtract(db, extract);
    }

    const extractIdForObservation = duplicateExtractId ?? extract.id;
    const coops = await getCoops();
    if (coops.length > 0) {
      await emitRoundupBatchObservation({
        extractIds: [extractIdForObservation],
        eligibleCoopIds: coops.map((coop) => coop.profile.id),
      });
    }
  } catch (error) {
    console.error(
      '[coop] tab-close capture failed:',
      error instanceof Error ? error.message : error,
    );
  }
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
