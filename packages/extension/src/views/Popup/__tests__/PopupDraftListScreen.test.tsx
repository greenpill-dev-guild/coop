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

  it('renders Share button for ready drafts and Mark Ready for candidate drafts', () => {
    const drafts = [
      makeDraft({ id: 'draft-1', workflowStage: 'ready' }),
      makeDraft({ id: 'draft-2', workflowStage: 'candidate' }),
    ];

    render(
      <PopupDraftListScreen
        drafts={drafts}
        filterTags={[]}
        onOpenDraft={vi.fn()}
        onMarkReady={vi.fn()}
        onShare={vi.fn()}
        onRoundUp={vi.fn()}
      />,
    );

    expect(screen.getByText('Share')).toBeDefined();
    expect(screen.getByText('Mark Ready')).toBeDefined();
  });

  it('shows empty state with Roundup button when no drafts', () => {
    render(
      <PopupDraftListScreen
        drafts={[]}
        filterTags={[]}
        onOpenDraft={vi.fn()}
        onMarkReady={vi.fn()}
        onShare={vi.fn()}
        onRoundUp={vi.fn()}
      />,
    );

    expect(screen.getByText('No chickens here yet.')).toBeDefined();
    expect(screen.getByText('Roundup Chickens')).toBeDefined();
  });
});
