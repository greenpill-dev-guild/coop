import {
  type CoopSharedState,
  type ReceiverCapture,
  type TabCandidate,
  buildReadablePageExtract,
  canonicalizeUrl,
  compressImage,
  createId,
  createReceiverCapture,
  createReceiverDraftSeed,
  findDuplicatePageExtract,
  findRecentCandidateByUrlHash,
  getAuthSession,
  hashText,
  isDomainExcluded,
  isWhisperSupported,
  listPageExtracts,
  nowIso,
  resolveDraftTargetCoopIdsForUi,
  sanitizeTextForInference,
  saveCoopBlob,
  savePageExtract,
  saveReceiverCapture,
  saveReviewDraft,
  saveTabCandidate,
  transcribeAudio,
  updateReceiverCapture,
} from '@coop/shared';
import type {
  ActiveTabCaptureResult,
  PopupPreparedCapture,
  SidepanelIntent,
} from '../../runtime/messages';
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
import { focusCoopSidepanel } from '../sidepanel';
import {
  drainAgentCycles,
  emitAudioTranscriptObservation,
  emitRoundupBatchObservation,
} from './agent';

const EXPLICIT_ACTIVE_TAB_DEDUP_COOLDOWN_MS = 5_000;

export async function collectCandidate(
  tab: chrome.tabs.Tab,
  options?: { captureRunId?: string },
): Promise<{ candidate: TabCandidate; snapshot: CaptureSnapshot } | null> {
  if (tab.id == null || !tab.url || !isSupportedUrl(tab.url)) {
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
  options: {
    drainAgent?: boolean;
    dedupCooldownMs?: number;
    bypassRecentDuplicateCheck?: boolean;
  } = {},
) {
  const coops = await getCoops();
  const candidates: TabCandidate[] = [];
  const candidateIds: string[] = [];
  const newExtractIds: string[] = [];
  const capturedDomains = new Set<string>();
  let skippedCount = 0;
  let lastCaptureError: string | undefined;
  const captureRunId = createId('capture');

  const captureMode = await getLocalSetting<string>(stateKeys.captureMode, 'manual');
  const periodMinutes = getCapturePeriodMinutes(captureMode);
  const dedupCooldownMs = options.dedupCooldownMs ?? (periodMinutes ?? 5) * 60_000;

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
    if (!options.bypassRecentDuplicateCheck && wasRecentlyCaptured(tab.url, dedupCooldownMs)) {
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
      !options.bypassRecentDuplicateCheck &&
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
      candidateIds.push(candidate.id);
      capturedDomains.add(candidate.domain);
      markUrlCaptured(tab.url);
      await saveTabCandidate(db, candidate);

      const extract = buildReadablePageExtract({
        candidate,
        metaDescription: snapshot.metaDescription,
        headings: snapshot.headings,
        paragraphs: snapshot.paragraphs,
        socialPreviewImageUrl: snapshot.socialPreviewImageUrl,
        previewImageUrl: snapshot.previewImageUrl,
      });

      // Reuse an existing extract when the captured page is the same signal
      // under a print view, alternate path, or other small boilerplate drift.
      const duplicateExtractId = await findDuplicatePageExtract(db, extract);
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
      candidateIds,
      eligibleCoopIds: coops.map((coop) => coop.profile.id),
    });
    if (options.drainAgent && newExtractIds.length > 0) {
      await drainAgentCycles({
        reason: 'capture-complete',
        force: true,
        maxPasses: 2,
        syncBetweenPasses: true,
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
    syncBetweenPasses: true,
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

async function wasTabCapturedWithinCooldown(tab: chrome.tabs.Tab, cooldownMs: number) {
  if (!tab.url) {
    return false;
  }

  if (wasRecentlyCaptured(tab.url, cooldownMs)) {
    return true;
  }

  const canonical = canonicalizeUrl(tab.url);
  const urlHash = hashText(canonical);
  const existingCandidate = await findRecentCandidateByUrlHash(db, urlHash);

  return (
    !!existingCandidate &&
    Date.now() - new Date(existingCandidate.capturedAt).getTime() < cooldownMs
  );
}

async function resolveMostRecentStandardActiveTab() {
  const selectMostRecentSupportedTab = (tabs: chrome.tabs.Tab[]) =>
    tabs
      .filter((tab): tab is chrome.tabs.Tab & { url: string } =>
        Boolean(tab.url && isSupportedUrl(tab.url)),
      )
      .sort((left, right) => (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0))[0] ?? null;

  const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (currentTab?.url && isSupportedUrl(currentTab.url)) {
    return currentTab;
  }

  const activeTabs = await chrome.tabs.query({ active: true });
  const activeStandardTab = selectMostRecentSupportedTab(activeTabs);
  if (activeStandardTab) {
    return activeStandardTab;
  }

  const allTabs = await chrome.tabs.query({});
  return selectMostRecentSupportedTab(allTabs);
}

export async function captureActiveTab(options?: {
  allowRecentDuplicate?: boolean;
}): Promise<ActiveTabCaptureResult> {
  const tab = await resolveMostRecentStandardActiveTab();
  if (!tab) {
    return { capturedCount: 0 };
  }

  const allowRecentDuplicate = options?.allowRecentDuplicate === true;
  if (
    !allowRecentDuplicate &&
    (await wasTabCapturedWithinCooldown(tab, EXPLICIT_ACTIVE_TAB_DEDUP_COOLDOWN_MS))
  ) {
    return {
      capturedCount: 0,
      duplicateSuppressed: true,
    };
  }

  return {
    capturedCount: await runCaptureForTabs([tab], {
      drainAgent: true,
      dedupCooldownMs: EXPLICIT_ACTIVE_TAB_DEDUP_COOLDOWN_MS,
      bypassRecentDuplicateCheck: allowRecentDuplicate,
    }),
  };
}

function decodeBase64(dataBase64: string) {
  return Uint8Array.from(atob(dataBase64), (char) => char.charCodeAt(0));
}

async function encodeBlobBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

async function resolveCaptureContext() {
  const coops = await getCoops();
  const authSession = await getAuthSession(db);
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  const activeCoop = coops.find((coop) => coop.profile.id === activeContext.activeCoopId);
  const activeMember = resolveReceiverPairingMember(activeCoop, authSession);

  return {
    coops,
    activeContext,
    activeCoop,
    activeMember,
  };
}

async function persistPopupCapture(input: {
  kind: PopupPreparedCapture['kind'];
  blob: Blob;
  fileName?: string;
  title?: string;
  note?: string;
  sourceUrl?: string;
  createdAt?: string;
}) {
  const timestamp = input.createdAt ?? nowIso();
  const { activeCoop, activeMember } = await resolveCaptureContext();

  const capture = {
    ...createReceiverCapture({
      deviceId: extensionCaptureDeviceId,
      kind: input.kind,
      blob: input.blob,
      fileName: input.fileName,
      title: input.title,
      note: input.note,
      sourceUrl: input.sourceUrl,
      createdAt: timestamp,
    }),
    coopId: activeCoop?.profile.id,
    coopDisplayName: activeCoop?.profile.name,
    memberId: activeMember?.id,
    memberDisplayName: activeMember?.displayName,
    updatedAt: timestamp,
  } satisfies ReceiverCapture;

  await saveReceiverCapture(db, capture, input.blob);
  await refreshBadge();

  return {
    capture,
    activeCoop,
  };
}

async function startAudioTranscription(
  capture: ReceiverCapture,
  blob: Blob,
  durationSeconds: number,
) {
  try {
    const supported = await isWhisperSupported();
    if (!supported) return;
    const result = await transcribeAudio({ audioBlob: blob });
    if (!result.text.trim()) return;
    const transcriptBytes = new TextEncoder().encode(JSON.stringify(result));
    const blobId = createId('blob');
    const now = nowIso();
    await saveCoopBlob(
      db,
      {
        blobId,
        sourceEntityId: capture.id,
        coopId: capture.coopId ?? '',
        mimeType: 'application/json',
        byteSize: transcriptBytes.length,
        kind: 'audio-transcript',
        origin: 'self',
        createdAt: now,
        accessedAt: now,
      },
      transcriptBytes,
    );

    await emitAudioTranscriptObservation({
      captureId: capture.id,
      coopId: capture.coopId,
      transcriptText: result.text,
      durationSeconds: durationSeconds || result.duration,
    });

    await notifyExtensionEvent({
      eventKind: 'transcript-ready',
      entityId: capture.id,
      state: 'completed',
      title: 'Voice note transcribed',
      message: (() => {
        const preview = sanitizeTextForInference(result.text);
        return `"${preview.slice(0, 80)}${preview.length > 80 ? '…' : ''}"`;
      })(),
    });
  } catch (err) {
    console.warn('[captureAudio] Background transcription failed:', err);
  }
}

export async function prepareVisibleScreenshot(): Promise<PopupPreparedCapture> {
  const tab = await resolveMostRecentStandardActiveTab();
  if (tab?.windowId == null || !tab.url || !isSupportedUrl(tab.url)) {
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
  return {
    kind: 'photo',
    dataBase64: await encodeBlobBase64(blob),
    mimeType: blob.type || `image/${fileExt}`,
    fileName: `coop-screenshot-${timestamp.replace(/[:.]/gu, '-')}.${fileExt}`,
    title: `Page screenshot · ${tab.title || new URL(tab.url).hostname}`,
    note: `Captured from ${tab.url} via Extension Browser.`,
    sourceUrl: tab.url,
  };
}

export async function savePopupCapture(payload: PopupPreparedCapture): Promise<ReceiverCapture> {
  if (payload.kind === 'audio') {
    const estimatedBytes = Math.ceil((payload.dataBase64.length * 3) / 4);
    if (estimatedBytes > AUDIO_SIZE_LIMIT) {
      throw new Error('Audio recording exceeds the 25 MB size limit.');
    }
  }

  const blob = new Blob([decodeBase64(payload.dataBase64)], {
    type: payload.mimeType || 'application/octet-stream',
  });
  const { capture, activeCoop } = await persistPopupCapture({
    kind: payload.kind,
    blob,
    fileName: payload.fileName,
    title: payload.title,
    note: payload.note,
    sourceUrl: payload.sourceUrl,
  });

  if (payload.kind === 'audio') {
    void startAudioTranscription(capture, blob, payload.durationSeconds ?? 0);
  }

  if (payload.kind === 'photo') {
    await notifyExtensionEvent({
      eventKind: 'screenshot-saved',
      entityId: capture.id,
      state: 'saved',
      title: 'Screenshot saved',
      message: activeCoop?.profile.name
        ? `Saved a private screenshot for ${activeCoop.profile.name}.`
        : 'Saved a private local screenshot to Coop.',
    });
  }

  return capture;
}

export async function captureVisibleScreenshot(): Promise<ReceiverCapture> {
  return savePopupCapture(await prepareVisibleScreenshot());
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

    const duplicateExtractId = await findDuplicatePageExtract(db, extract);
    if (!duplicateExtractId) {
      await savePageExtract(db, extract);
    }

    const extractIdForObservation = duplicateExtractId ?? extract.id;
    const coops = await getCoops();
    if (coops.length > 0) {
      await emitRoundupBatchObservation({
        extractIds: [extractIdForObservation],
        candidateIds: [candidate.id],
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

export async function openCoopSidepanel(intent?: SidepanelIntent) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.windowId == null) {
    return false;
  }

  if (intent) {
    await focusCoopSidepanel(tab.windowId, intent);
    return true;
  }

  await chrome.sidePanel.open({ windowId: tab.windowId });
  return true;
}

// ---------------------------------------------------------------------------
// Popup capture handlers (file, note, audio)
// ---------------------------------------------------------------------------

const FILE_SIZE_LIMIT = 10 * 1024 * 1024; // 10 MB
const AUDIO_SIZE_LIMIT = 25 * 1024 * 1024; // 25 MB

export async function captureFile(payload: {
  fileName: string;
  mimeType: string;
  dataBase64: string;
  byteSize: number;
}): Promise<ReceiverCapture> {
  if (payload.byteSize > FILE_SIZE_LIMIT) {
    throw new Error('File exceeds the 10 MB size limit.');
  }
  return savePopupCapture({
    kind: 'file',
    dataBase64: payload.dataBase64,
    mimeType: payload.mimeType,
    fileName: payload.fileName,
    title: payload.fileName,
    note: '',
  });
}

export async function createNoteDraft(payload: { text: string }) {
  if (!payload.text.trim()) {
    throw new Error('Note text cannot be empty.');
  }

  const blob = new Blob([payload.text], { type: 'text/plain' });
  const timestamp = nowIso();
  const coops = await getCoops();
  const authSession = await getAuthSession(db);
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  const activeCoop = coops.find((coop) => coop.profile.id === activeContext.activeCoopId);
  const activeMember = resolveReceiverPairingMember(activeCoop, authSession);

  const capture = {
    ...createReceiverCapture({
      deviceId: extensionCaptureDeviceId,
      kind: 'link',
      blob,
      title: payload.text.slice(0, 100),
      note: payload.text,
      createdAt: timestamp,
    }),
    coopId: activeCoop?.profile.id,
    coopDisplayName: activeCoop?.profile.name,
    memberId: activeMember?.id,
    memberDisplayName: activeMember?.displayName,
    updatedAt: timestamp,
  } satisfies ReceiverCapture;

  await saveReceiverCapture(db, capture, blob);

  const availableCoopIds = coops.map((state) => state.profile.id);
  const preferredCoopId = activeContext.activeCoopId ?? capture.coopId;
  const preferredCoop = coops.find((state) => state.profile.id === preferredCoopId);
  const draft = createReceiverDraftSeed({
    capture,
    availableCoopIds,
    preferredCoopId,
    preferredCoopLabel: preferredCoop?.profile.name,
    workflowStage: 'candidate',
  });

  await saveReviewDraft(db, draft);
  await updateReceiverCapture(db, capture.id, {
    linkedDraftId: draft.id,
    updatedAt: nowIso(),
  });
  await refreshBadge();
  return draft;
}

export async function captureAudio(payload: {
  dataBase64: string;
  mimeType: string;
  durationSeconds: number;
  fileName: string;
}): Promise<ReceiverCapture> {
  // Estimate decoded size from base64 length to fail fast without allocating
  const estimatedBytes = Math.ceil((payload.dataBase64.length * 3) / 4);
  if (estimatedBytes > AUDIO_SIZE_LIMIT) {
    throw new Error('Audio recording exceeds the 25 MB size limit.');
  }
  return savePopupCapture({
    kind: 'audio',
    dataBase64: payload.dataBase64,
    mimeType: payload.mimeType,
    fileName: payload.fileName,
    title: 'Voice note',
    note: '',
    durationSeconds: payload.durationSeconds,
  });
}
