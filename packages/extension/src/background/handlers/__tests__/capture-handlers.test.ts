import type { CoopSharedState } from '@coop/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Chrome API mock ---

const chromeTabsMock = {
  query: vi.fn(),
  captureVisibleTab: vi.fn(),
};
const chromeScrMock = {
  executeScript: vi.fn(),
};

beforeEach(() => {
  Object.assign(globalThis, {
    chrome: {
      tabs: chromeTabsMock,
      scripting: chromeScrMock,
    },
  });
});

afterEach(() => {
  vi.clearAllMocks();
  Reflect.deleteProperty(globalThis, 'chrome');
});

// --- Mocks for context ---

function mockDexieTable() {
  const chain = {
    put: vi.fn(),
    where: vi.fn().mockReturnValue({
      equals: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(undefined),
        sortBy: vi.fn().mockResolvedValue([]),
      }),
    }),
  };
  return chain;
}

const mockFindRecentCandidateByUrlHash = vi.fn().mockResolvedValue(undefined);
const mockFindExistingExtractByTextHash = vi.fn().mockResolvedValue(undefined);
const mockSaveTabCandidate = vi.fn().mockResolvedValue(undefined);
const mockSavePageExtract = vi.fn().mockResolvedValue(undefined);
const mockAddOutboxEntry = vi.fn().mockResolvedValue(undefined);

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared')>();
  return {
    ...actual,
    findRecentCandidateByUrlHash: mockFindRecentCandidateByUrlHash,
    findExistingExtractByTextHash: mockFindExistingExtractByTextHash,
    saveTabCandidate: mockSaveTabCandidate,
    savePageExtract: mockSavePageExtract,
    addOutboxEntry: mockAddOutboxEntry,
  };
});

vi.mock('../../context', () => ({
  db: {
    tabCandidates: mockDexieTable(),
    pageExtracts: mockDexieTable(),
    reviewDrafts: { bulkPut: vi.fn() },
    captureRuns: { put: vi.fn() },
    syncOutbox: { put: vi.fn() },
    settings: {
      get: vi.fn().mockResolvedValue(undefined),
    },
  },
  extensionCaptureDeviceId: 'extension-browser',
  getCoops: vi.fn().mockResolvedValue([]),
  prefersLocalEnhancement: false,
  setRuntimeHealth: vi.fn(),
  notifyExtensionEvent: vi.fn(),
  getLocalSetting: vi.fn().mockResolvedValue('manual'),
  stateKeys: { captureMode: 'capture-mode' },
  getCapturePeriodMinutes: vi.fn().mockReturnValue(null),
  markUrlCaptured: vi.fn(),
  wasRecentlyCaptured: vi.fn().mockReturnValue(false),
  uiPreferences: {
    excludedCategories: [],
    customExcludedDomains: [],
    captureOnClose: false,
    notificationsEnabled: false,
  },
  ensureDbReady: vi.fn().mockResolvedValue(undefined),
  tabUrlCache: new Map(),
  removeFromTabCache: vi.fn(),
}));

vi.mock('../../dashboard', () => ({
  refreshBadge: vi.fn(),
}));

vi.mock('../../operator', () => ({
  getActiveReviewContextForSession: vi.fn().mockResolvedValue({
    activeCoopId: undefined,
    activeMemberId: undefined,
  }),
}));

vi.mock('../agent', () => ({
  syncHighConfidenceDraftObservations: vi.fn(),
  emitRoundupBatchObservation: vi.fn(),
  drainAgentCycles: vi.fn(),
}));

const { captureActiveTab, handleTabRemoved, runCaptureCycle, runCaptureForTabs } = await import(
  '../capture'
);

describe('capture handlers', () => {
  it('returns 0 when no active tab is found', async () => {
    chromeTabsMock.query.mockResolvedValue([]);
    const count = await captureActiveTab();
    expect(count).toBe(0);
  });

  it('skips tabs with unsupported urls', async () => {
    chromeTabsMock.query.mockResolvedValue([
      { id: 1, url: 'chrome://extensions', windowId: 1 },
      { id: 2, url: 'about:blank', windowId: 1 },
    ]);
    const count = await runCaptureCycle();
    expect(count).toBe(0);
  });

  it('captures a valid http tab and returns count 1', async () => {
    chromeTabsMock.query.mockResolvedValueOnce([
      { id: 10, url: 'https://example.com/page', windowId: 1, title: 'Example' },
    ]);
    chromeScrMock.executeScript.mockResolvedValue([
      {
        result: {
          title: 'Example Page',
          metaDescription: 'An example page',
          headings: ['Welcome'],
          paragraphs: ['Hello world'],
          previewImageUrl: undefined,
        },
      },
    ]);

    const count = await captureActiveTab();
    expect(count).toBe(1);
  });

  it('records a failed capture run when scripting throws', async () => {
    chromeTabsMock.query.mockResolvedValue([
      { id: 20, url: 'https://restricted.com', windowId: 1, title: 'Restricted' },
    ]);
    chromeScrMock.executeScript.mockRejectedValue(new Error('Cannot access'));

    const { setRuntimeHealth } = await import('../../context');
    const count = await runCaptureCycle();
    expect(count).toBe(0);
    expect(vi.mocked(setRuntimeHealth)).toHaveBeenCalledWith(
      expect.objectContaining({ syncError: true }),
    );
  });
});

describe('persistent URL-hash dedup (Tier 2)', () => {
  it('skips capture when a recent candidate with the same URL hash exists', async () => {
    const recentCandidate = {
      id: 'candidate-existing',
      capturedAt: new Date(Date.now() - 60_000).toISOString(), // 1 minute ago
    };
    mockFindRecentCandidateByUrlHash.mockResolvedValueOnce(recentCandidate);

    const tabs = [
      {
        id: 30,
        url: 'https://example.com/already-captured',
        windowId: 1,
        title: 'Already Captured',
      },
    ] as chrome.tabs.Tab[];

    const count = await runCaptureForTabs(tabs);

    expect(count).toBe(0);
    expect(mockFindRecentCandidateByUrlHash).toHaveBeenCalled();
    expect(chromeScrMock.executeScript).not.toHaveBeenCalled();
  });

  it('proceeds with capture when the URL-hash match is older than the cooldown', async () => {
    const oldCandidate = {
      id: 'candidate-old',
      capturedAt: new Date(Date.now() - 10 * 60_000).toISOString(), // 10 minutes ago
    };
    mockFindRecentCandidateByUrlHash.mockResolvedValueOnce(oldCandidate);

    chromeScrMock.executeScript.mockResolvedValue([
      {
        result: {
          title: 'Fresh Page',
          metaDescription: 'desc',
          headings: [],
          paragraphs: [],
          previewImageUrl: undefined,
        },
      },
    ]);

    const tabs = [
      { id: 31, url: 'https://example.com/old-capture', windowId: 1, title: 'Old Capture' },
    ] as chrome.tabs.Tab[];

    const count = await runCaptureForTabs(tabs);

    expect(count).toBe(1);
    expect(chromeScrMock.executeScript).toHaveBeenCalled();
  });

  it('proceeds with capture when no existing candidate is found for URL hash', async () => {
    mockFindRecentCandidateByUrlHash.mockResolvedValueOnce(undefined);

    chromeScrMock.executeScript.mockResolvedValue([
      {
        result: {
          title: 'Brand New Page',
          metaDescription: 'new',
          headings: [],
          paragraphs: [],
          previewImageUrl: undefined,
        },
      },
    ]);

    const tabs = [
      { id: 32, url: 'https://example.com/brand-new', windowId: 1, title: 'Brand New' },
    ] as chrome.tabs.Tab[];

    const count = await runCaptureForTabs(tabs);

    expect(count).toBe(1);
  });
});

describe('content-hash dedup (Tier 3)', () => {
  it('reuses the existing extract ID when content hash matches', async () => {
    mockFindRecentCandidateByUrlHash.mockResolvedValue(undefined);
    mockFindExistingExtractByTextHash.mockResolvedValueOnce('extract-existing-dup');

    chromeScrMock.executeScript.mockResolvedValue([
      {
        result: {
          title: 'Duplicate Content Page',
          metaDescription: 'duplicate',
          headings: ['Same'],
          paragraphs: ['Same content as before'],
          previewImageUrl: undefined,
        },
      },
    ]);

    const { emitRoundupBatchObservation } = await import('../agent');
    const { getCoops } = await import('../../context');
    vi.mocked(getCoops).mockResolvedValueOnce([
      { profile: { id: 'coop-1', name: 'Test Coop' } } as unknown as CoopSharedState,
    ]);

    const tabs = [
      { id: 40, url: 'https://example.com/dup-content', windowId: 1, title: 'Dup Content' },
    ] as chrome.tabs.Tab[];

    const count = await runCaptureForTabs(tabs);

    expect(count).toBe(1);
    // savePageExtract should NOT be called because the content hash already exists
    expect(mockSavePageExtract).not.toHaveBeenCalled();
    // The observation should be emitted with the existing extract ID
    expect(vi.mocked(emitRoundupBatchObservation)).toHaveBeenCalledWith(
      expect.objectContaining({
        extractIds: ['extract-existing-dup'],
      }),
    );
  });

  it('saves a new extract when no content hash match exists', async () => {
    mockFindRecentCandidateByUrlHash.mockResolvedValue(undefined);
    mockFindExistingExtractByTextHash.mockResolvedValueOnce(undefined);

    chromeScrMock.executeScript.mockResolvedValue([
      {
        result: {
          title: 'Unique Content Page',
          metaDescription: 'unique',
          headings: ['Unique'],
          paragraphs: ['This is entirely new content not seen before'],
          previewImageUrl: undefined,
        },
      },
    ]);

    const tabs = [
      { id: 41, url: 'https://example.com/unique-content', windowId: 1, title: 'Unique' },
    ] as chrome.tabs.Tab[];

    const count = await runCaptureForTabs(tabs);

    expect(count).toBe(1);
    expect(mockSavePageExtract).toHaveBeenCalled();
  });
});

describe('handleTabRemoved', () => {
  it('captures a tab on close when captureOnClose is enabled', async () => {
    const { tabUrlCache, uiPreferences } = await import('../../context');
    const contextModule = await import('../../context');

    // Enable captureOnClose
    (uiPreferences as Record<string, unknown>).captureOnClose = true;

    // Populate the tab cache with a URL for the tab being closed
    tabUrlCache.set(50, {
      url: 'https://example.com/closing-tab',
      title: 'Closing Tab',
      favIconUrl: 'https://example.com/favicon.ico',
      windowId: 1,
    });

    mockFindRecentCandidateByUrlHash.mockResolvedValueOnce(undefined);
    mockFindExistingExtractByTextHash.mockResolvedValueOnce(undefined);

    await handleTabRemoved(50);

    // Verify tab was captured: saveTabCandidate should have been called
    expect(mockSaveTabCandidate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        url: 'https://example.com/closing-tab',
        title: 'Closing Tab',
        domain: 'example.com',
        tabId: 50,
        windowId: 1,
      }),
    );
    // The cache entry should have been consumed
    expect(vi.mocked(contextModule.removeFromTabCache)).toHaveBeenCalledWith(50);

    // Restore
    (uiPreferences as Record<string, unknown>).captureOnClose = false;
  });

  it('does nothing when captureOnClose is disabled', async () => {
    const { tabUrlCache, uiPreferences } = await import('../../context');

    (uiPreferences as Record<string, unknown>).captureOnClose = false;

    tabUrlCache.set(51, {
      url: 'https://example.com/tab',
      title: 'Tab',
      windowId: 1,
    });

    await handleTabRemoved(51);

    expect(mockSaveTabCandidate).not.toHaveBeenCalled();
  });

  it('does nothing when cached tab URL is unsupported', async () => {
    const { tabUrlCache, uiPreferences } = await import('../../context');

    (uiPreferences as Record<string, unknown>).captureOnClose = true;

    tabUrlCache.set(52, {
      url: 'chrome://settings',
      title: 'Settings',
      windowId: 1,
    });

    await handleTabRemoved(52);

    expect(mockSaveTabCandidate).not.toHaveBeenCalled();

    (uiPreferences as Record<string, unknown>).captureOnClose = false;
  });

  it('does nothing when no cached data exists for the tab', async () => {
    const { uiPreferences } = await import('../../context');

    (uiPreferences as Record<string, unknown>).captureOnClose = true;

    // Don't add anything to tabUrlCache for tabId 53
    await handleTabRemoved(53);

    expect(mockSaveTabCandidate).not.toHaveBeenCalled();

    (uiPreferences as Record<string, unknown>).captureOnClose = false;
  });

  it('skips capture on close when URL was recently captured (in-memory dedup)', async () => {
    const { tabUrlCache, uiPreferences, wasRecentlyCaptured } = await import('../../context');

    (uiPreferences as Record<string, unknown>).captureOnClose = true;
    vi.mocked(wasRecentlyCaptured).mockReturnValueOnce(true);

    tabUrlCache.set(54, {
      url: 'https://example.com/recently-captured',
      title: 'Recent',
      windowId: 1,
    });

    await handleTabRemoved(54);

    expect(mockSaveTabCandidate).not.toHaveBeenCalled();

    (uiPreferences as Record<string, unknown>).captureOnClose = false;
  });

  it('skips capture on close when persistent URL-hash dedup matches', async () => {
    const { tabUrlCache, uiPreferences } = await import('../../context');

    (uiPreferences as Record<string, unknown>).captureOnClose = true;

    tabUrlCache.set(55, {
      url: 'https://example.com/persistent-dup',
      title: 'Persistent Dup',
      windowId: 1,
    });

    mockFindRecentCandidateByUrlHash.mockResolvedValueOnce({
      id: 'candidate-recent',
      capturedAt: new Date(Date.now() - 60_000).toISOString(), // 1 minute ago
    });

    await handleTabRemoved(55);

    expect(mockSaveTabCandidate).not.toHaveBeenCalled();

    (uiPreferences as Record<string, unknown>).captureOnClose = false;
  });

  it('uses content-hash dedup to skip saving a duplicate extract on close', async () => {
    const { tabUrlCache, uiPreferences } = await import('../../context');

    (uiPreferences as Record<string, unknown>).captureOnClose = true;

    tabUrlCache.set(56, {
      url: 'https://example.com/dup-extract-close',
      title: 'Dup Extract Close',
      windowId: 1,
    });

    mockFindRecentCandidateByUrlHash.mockResolvedValueOnce(undefined);
    mockFindExistingExtractByTextHash.mockResolvedValueOnce('extract-already-exists');

    await handleTabRemoved(56);

    // Candidate should still be saved (URL dedup passed)
    expect(mockSaveTabCandidate).toHaveBeenCalled();
    // But a new extract should NOT be saved (content hash matched)
    expect(mockSavePageExtract).not.toHaveBeenCalled();

    (uiPreferences as Record<string, unknown>).captureOnClose = false;
  });
});

describe('outbox tracking on capture', () => {
  it('adds outbox entries for each coop when tabs are captured', async () => {
    const { getCoops } = await import('../../context');
    vi.mocked(getCoops).mockResolvedValueOnce([
      { profile: { id: 'coop-A', name: 'Coop A' } } as unknown as CoopSharedState,
      { profile: { id: 'coop-B', name: 'Coop B' } } as unknown as CoopSharedState,
    ]);

    mockFindRecentCandidateByUrlHash.mockResolvedValue(undefined);
    mockFindExistingExtractByTextHash.mockResolvedValue(undefined);

    chromeScrMock.executeScript.mockResolvedValue([
      {
        result: {
          title: 'Outbox Test Page',
          metaDescription: 'Testing outbox',
          headings: ['Hello'],
          paragraphs: ['Some content'],
          previewImageUrl: undefined,
        },
      },
    ]);
    mockAddOutboxEntry.mockClear();

    const tabs = [
      { id: 70, url: 'https://example.com/outbox-test', windowId: 1, title: 'Outbox Test' },
    ] as chrome.tabs.Tab[];

    const count = await runCaptureForTabs(tabs);

    expect(count).toBe(1);
    // Should have outbox entries for each coop the capture was emitted to
    expect(mockAddOutboxEntry).toHaveBeenCalled();
    const calls = mockAddOutboxEntry.mock.calls;
    expect(calls.length).toBe(2); // one per coop
    expect(calls[0][1]).toMatchObject({
      type: 'state-update',
      status: 'pending',
    });
  });

  it('does not add outbox entries when no coops exist', async () => {
    const { getCoops } = await import('../../context');
    vi.mocked(getCoops).mockResolvedValueOnce([]);

    mockFindRecentCandidateByUrlHash.mockResolvedValue(undefined);
    mockFindExistingExtractByTextHash.mockResolvedValue(undefined);

    chromeScrMock.executeScript.mockResolvedValue([
      {
        result: {
          title: 'No Coop Page',
          metaDescription: 'No coops',
          headings: [],
          paragraphs: [],
          previewImageUrl: undefined,
        },
      },
    ]);
    mockAddOutboxEntry.mockClear();

    const tabs = [
      { id: 71, url: 'https://example.com/no-coop', windowId: 1, title: 'No Coop' },
    ] as chrome.tabs.Tab[];

    const count = await runCaptureForTabs(tabs);

    expect(count).toBe(1);
    expect(mockAddOutboxEntry).not.toHaveBeenCalled();
  });
});
