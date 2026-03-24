import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PopupDraftListScreen } from '../PopupDraftListScreen';
import type { PopupDraftListItem } from '../popup-types';

function makeDraft(overrides: Partial<PopupDraftListItem> = {}): PopupDraftListItem {
  return {
    id: 'draft-1',
    title: 'River restoration lead',
    summary: 'A test draft',
    category: 'opportunity',
    coopLabel: 'Test Coop',
    coopIds: ['coop-1'],
    workflowStage: 'ready',
    sourceUrl: 'https://example.com/river',
    ...overrides,
  };
}

describe('PopupDraftListScreen', () => {
  afterEach(cleanup);

  it('renders a ShareMenu trigger (share-menu class) for each draft row with a sourceUrl', () => {
    const drafts = [
      makeDraft({ id: 'draft-1', sourceUrl: 'https://example.com/a' }),
      makeDraft({ id: 'draft-2', sourceUrl: 'https://example.com/b' }),
    ];

    const { container } = render(
      <PopupDraftListScreen
        drafts={drafts}
        filterTags={[]}
        onOpenDraft={vi.fn()}
        onMarkReady={vi.fn()}
        onShare={vi.fn()}
        onRoundUp={vi.fn()}
      />,
    );

    // ShareMenu renders a container with class "share-menu"
    const shareMenus = container.querySelectorAll('.share-menu');
    expect(shareMenus.length).toBe(2);
  });

  it('does not render a ShareMenu for drafts without a sourceUrl', () => {
    const drafts = [makeDraft({ id: 'draft-no-url', sourceUrl: undefined })];

    const { container } = render(
      <PopupDraftListScreen
        drafts={drafts}
        filterTags={[]}
        onOpenDraft={vi.fn()}
        onMarkReady={vi.fn()}
        onShare={vi.fn()}
        onRoundUp={vi.fn()}
      />,
    );

    const shareMenus = container.querySelectorAll('.share-menu');
    expect(shareMenus.length).toBe(0);
  });
});
