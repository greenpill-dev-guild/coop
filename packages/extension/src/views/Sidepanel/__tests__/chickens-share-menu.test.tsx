import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TabCandidate } from '@coop/shared';
import type { DashboardResponse } from '../../../runtime/messages';
import { ChickensTab, type ChickensTabProps } from '../tabs/ChickensTab';

function makeCandidate(overrides: Partial<TabCandidate> = {}): TabCandidate {
  return {
    id: 'cand-1',
    tabId: 1,
    windowId: 1,
    url: 'https://example.com/page',
    canonicalUrl: 'https://example.com/page',
    title: 'Example Page',
    domain: 'example.com',
    capturedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeDashboard(candidates: TabCandidate[]): DashboardResponse {
  return {
    coops: [],
    candidates,
    receiverCaptures: [],
    runtimeConfig: {
      archiveMode: 'mock',
      onchainMode: 'mock',
      privacyMode: 'off',
      hasApiKey: false,
    },
  } as unknown as DashboardResponse;
}

function makeTabCapture() {
  return {
    runManualCapture: vi.fn(),
    runActiveTabCapture: vi.fn(),
    captureVisibleScreenshotAction: vi.fn(),
    // biome-ignore lint/suspicious/noExplicitAny: test mock
  } as any;
}

function makeDraftEditor() {
  return {
    draftValue: vi.fn(),
    updateDraft: vi.fn(),
    saveDraft: vi.fn(),
    publishDraft: vi.fn(),
    refineDraft: vi.fn(),
    toggleDraftTargetCoop: vi.fn(),
    changeDraftWorkflowStage: vi.fn(),
    toggleDraftArchiveWorthiness: vi.fn(),
    applyRefineResult: vi.fn(),
    dismissRefineResult: vi.fn(),
    refiningDrafts: new Set<string>(),
    refineResults: {},
    anonymousPublish: false,
    setAnonymousPublish: vi.fn(),
    convertReceiverCapture: vi.fn(),
    archiveReceiverCapture: vi.fn(),
    toggleReceiverCaptureArchiveWorthiness: vi.fn(),
    // biome-ignore lint/suspicious/noExplicitAny: test mock
  } as any;
}

describe('ChickensTab candidate cards', () => {
  afterEach(cleanup);

  it('renders a ShareMenu for each candidate in an expanded domain group', () => {
    const candidates = [
      makeCandidate({ id: 'c1', url: 'https://example.com/a', title: 'Page A' }),
      makeCandidate({ id: 'c2', url: 'https://example.com/b', title: 'Page B' }),
    ];

    const { container } = render(
      <ChickensTab
        dashboard={makeDashboard(candidates)}
        visibleDrafts={[]}
        draftEditor={makeDraftEditor()}
        inferenceState={null}
        runtimeConfig={makeDashboard(candidates).runtimeConfig}
        tabCapture={makeTabCapture()}
      />,
    );

    // With only 2 candidates (< COLLAPSE_THRESHOLD of 3), the group should be expanded by default
    // Each candidate card should have a ShareMenu container
    const shareMenus = container.querySelectorAll('.share-menu');
    expect(shareMenus.length).toBe(2);
  });
});
