import type { ReviewDraft } from '@coop/shared';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArtifactCard, DraftCard, type DraftCardProps } from '../cards';

function makeDraftEditor(overrides = {}) {
  return {
    draftValue: (d: ReviewDraft) => d,
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
    ...overrides,
  } as unknown as DraftCardProps['draftEditor'];
}

function makeReviewDraft(overrides: Partial<ReviewDraft> = {}): ReviewDraft {
  return {
    id: 'draft-1',
    interpretationId: 'interp-1',
    extractId: 'ext-1',
    sourceCandidateId: 'cand-1',
    title: 'Test Draft',
    summary: 'Summary text',
    sources: [{ label: 'Source', url: 'https://example.com/draft', domain: 'example.com' }],
    tags: ['test'],
    category: 'opportunity',
    whyItMatters: 'Because testing',
    suggestedNextStep: 'Test it',
    suggestedTargetCoopIds: ['coop-1'],
    confidence: 0.9,
    rationale: 'Test rationale',
    status: 'draft',
    workflowStage: 'ready',
    provenance: { type: 'extension' },
    createdAt: new Date().toISOString(),
    attachments: [],
    ...overrides,
  } as ReviewDraft;
}

describe('DraftCard onShareToFeed', () => {
  afterEach(cleanup);

  it('passes onShareToFeed callback to ShareMenu when provided', async () => {
    const onShareToFeed = vi.fn();
    const user = userEvent.setup();
    const draft = makeReviewDraft();

    render(
      <DraftCard
        draft={draft}
        context="roost"
        draftEditor={makeDraftEditor()}
        inferenceState={null}
        runtimeConfig={
          {
            archiveMode: 'mock',
            onchainMode: 'mock',
            privacyMode: 'off',
            hasApiKey: false,
          } as unknown as DraftCardProps['runtimeConfig']
        }
        coops={[]}
        onShareToFeed={onShareToFeed}
      />,
    );

    // Click the ShareMenu trigger
    const shareButton = screen.getByRole('button', { name: /^share$/i });
    await user.click(shareButton);

    // The "Share to feed" option should be visible when onShareToFeed is provided
    expect(screen.getByRole('menuitem', { name: /share to feed/i })).toBeInTheDocument();
  });

  it('does not show "Share to feed" option when onShareToFeed is not provided', async () => {
    const user = userEvent.setup();
    const draft = makeReviewDraft();

    render(
      <DraftCard
        draft={draft}
        context="roost"
        draftEditor={makeDraftEditor()}
        inferenceState={null}
        runtimeConfig={
          {
            archiveMode: 'mock',
            onchainMode: 'mock',
            privacyMode: 'off',
            hasApiKey: false,
          } as unknown as DraftCardProps['runtimeConfig']
        }
        coops={[]}
      />,
    );

    const shareButton = screen.getByRole('button', { name: /^share$/i });
    await user.click(shareButton);

    expect(screen.queryByRole('menuitem', { name: /share to feed/i })).not.toBeInTheDocument();
  });
});

describe('ArtifactCard onShareToFeed', () => {
  afterEach(cleanup);

  it('passes onShareToFeed callback to ShareMenu when provided', async () => {
    const onShareToFeed = vi.fn();
    const user = userEvent.setup();

    const artifact = {
      id: 'art-1',
      originId: 'origin-1',
      targetCoopId: 'coop-1',
      title: 'Shared Artifact',
      summary: 'Artifact summary',
      sources: [{ label: 'Source', url: 'https://example.com/artifact', domain: 'example.com' }],
      tags: [],
      category: 'opportunity' as const,
      whyItMatters: 'Important',
      suggestedNextStep: 'Act on it',
      createdBy: 'user-1',
      createdAt: new Date().toISOString(),
      reviewStatus: 'pending' as const,
      archiveStatus: 'none' as const,
      archiveReceiptIds: [],
      attachments: [],
    };

    render(
      <ArtifactCard
        artifact={artifact}
        archiveReceipts={[]}
        activeCoop={undefined}
        archiveArtifact={vi.fn()}
        toggleArtifactArchiveWorthiness={vi.fn()}
        onShareToFeed={onShareToFeed}
      />,
    );

    const shareButton = screen.getByRole('button', { name: /^share$/i });
    await user.click(shareButton);

    expect(screen.getByRole('menuitem', { name: /share to feed/i })).toBeInTheDocument();
  });
});
