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

vi.mock('../../context', () => ({
  db: {
    tabCandidates: { put: vi.fn() },
    pageExtracts: { put: vi.fn() },
    reviewDrafts: { bulkPut: vi.fn() },
    captureRuns: { put: vi.fn() },
  },
  extensionCaptureDeviceId: 'extension-browser',
  getCoops: vi.fn().mockResolvedValue([]),
  prefersLocalEnhancement: false,
  setRuntimeHealth: vi.fn(),
  notifyExtensionEvent: vi.fn(),
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
}));

const { captureActiveTab, runCaptureCycle } = await import('../capture');

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
