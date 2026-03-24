import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PopupFeedScreen } from '../PopupFeedScreen';
import type { PopupFeedArtifactItem } from '../popup-types';

function makeArtifact(overrides: Partial<PopupFeedArtifactItem> = {}): PopupFeedArtifactItem {
  return {
    id: 'artifact-1',
    originId: 'origin-1',
    targetCoopId: 'coop-1',
    title: 'Shared artifact',
    summary: 'Summary text',
    sources: [{ label: 'Source', url: 'https://example.com/shared', domain: 'example.com' }],
    tags: [],
    category: 'opportunity',
    whyItMatters: 'Because',
    suggestedNextStep: 'Do something',
    createdBy: 'user-1',
    createdAt: new Date().toISOString(),
    reviewStatus: 'pending',
    archiveStatus: 'none',
    archiveReceiptIds: [],
    attachments: [],
    coopLabel: 'Test Coop',
    coopIds: ['coop-1'],
    ...overrides,
  };
}

describe('PopupFeedScreen', () => {
  afterEach(cleanup);

  it('does not render a ShareMenu in feed rows (share moved to dialog)', () => {
    const artifacts = [
      makeArtifact({ id: 'a1' }),
      makeArtifact({
        id: 'a2',
        sources: [{ label: 'S2', url: 'https://example.com/b', domain: 'example.com' }],
      }),
    ];

    const { container } = render(
      <PopupFeedScreen
        artifacts={artifacts}
        filterTags={[]}
        onOpenArtifact={vi.fn()}
        onDismissArtifact={vi.fn()}
      />,
    );

    const shareMenus = container.querySelectorAll('.share-menu');
    expect(shareMenus.length).toBe(0);
  });

  it('renders a dismiss button for each artifact', () => {
    const artifacts = [makeArtifact({ id: 'a1' }), makeArtifact({ id: 'a2' })];

    render(
      <PopupFeedScreen
        artifacts={artifacts}
        filterTags={[]}
        onOpenArtifact={vi.fn()}
        onDismissArtifact={vi.fn()}
      />,
    );

    const dismissButtons = screen.getAllByRole('button', { name: 'Dismiss' });
    expect(dismissButtons.length).toBe(2);
  });

  it('shows the empty state when no artifacts are present', () => {
    render(
      <PopupFeedScreen
        artifacts={[]}
        filterTags={[]}
        onOpenArtifact={vi.fn()}
        onDismissArtifact={vi.fn()}
      />,
    );

    expect(screen.getByText('Nothing shared in the coop yet')).toBeInTheDocument();
  });
});
