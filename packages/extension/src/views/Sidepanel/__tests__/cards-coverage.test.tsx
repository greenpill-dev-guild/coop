import type { CoopSharedState, ReceiverCapture, ReviewDraft } from '@coop/shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  ArchiveReceiptCard,
  ArtifactCard,
  DraftCard,
  type DraftCardProps,
  ReceiverIntakeCard,
  SkeletonCards,
  SkeletonSummary,
} from '../cards';

function makeDraft(overrides: Partial<ReviewDraft> = {}): ReviewDraft {
  return {
    id: 'draft-1',
    interpretationId: 'interp-1',
    extractId: 'extract-1',
    sourceCandidateId: 'candidate-1',
    title: 'River restoration lead',
    summary: 'A concise summary for the coop.',
    sources: [
      {
        label: 'Example',
        url: 'https://example.com/river',
        domain: 'example.com',
      },
    ],
    tags: ['river', 'grant', 'community', 'repair', 'soil'],
    category: 'opportunity',
    whyItMatters: 'This helps the coop act this week.',
    suggestedNextStep: 'Reach out to the partner.',
    suggestedTargetCoopIds: ['coop-1'],
    confidence: 0.91,
    rationale: 'It matches the current ritual focus.',
    status: 'draft',
    workflowStage: 'ready',
    archiveWorthiness: { flagged: true, flaggedAt: '2026-03-28T00:00:00.000Z' },
    attachments: [{ type: 'link', href: 'https://example.com/attachment' }] as never[],
    provenance: {
      type: 'tab',
      interpretationId: 'interp-1',
      extractId: 'extract-1',
      sourceCandidateId: 'candidate-1',
    },
    createdAt: '2026-03-28T00:00:00.000Z',
    ...overrides,
  };
}

function makeDraftEditor(overrides: Record<string, unknown> = {}) {
  return {
    draftValue: (draft: ReviewDraft) => draft,
    updateDraft: vi.fn(),
    saveDraft: vi.fn(async () => draftValue),
    publishDraft: vi.fn(async () => undefined),
    refineDraft: vi.fn(async () => undefined),
    toggleDraftTargetCoop: vi.fn(),
    changeDraftWorkflowStage: vi.fn(async () => undefined),
    toggleDraftArchiveWorthiness: vi.fn(async () => undefined),
    applyRefineResult: vi.fn(),
    dismissRefineResult: vi.fn(),
    refiningDrafts: new Set<string>(),
    refineResults: {},
    anonymousPublish: false,
    setAnonymousPublish: vi.fn(),
    convertReceiverCapture: vi.fn(async () => undefined),
    archiveReceiverCapture: vi.fn(async () => undefined),
    toggleReceiverCaptureArchiveWorthiness: vi.fn(async () => undefined),
    ...overrides,
  } as DraftCardProps['draftEditor'];
}

const draftValue = makeDraft();

function makeCoops(): CoopSharedState[] {
  return [
    {
      profile: { id: 'coop-1', name: 'River Coop' },
    },
    {
      profile: { id: 'coop-2', name: 'Soil Coop' },
    },
  ] as CoopSharedState[];
}

function makeCapture(overrides: Partial<ReceiverCapture> = {}): ReceiverCapture {
  return {
    id: 'capture-1',
    deviceId: 'device-1',
    kind: 'photo',
    title: 'Pocket finding',
    note: 'Field note',
    mimeType: 'image/webp',
    byteSize: 321,
    createdAt: '2026-03-28T00:00:00.000Z',
    syncedAt: '2026-03-28T01:00:00.000Z',
    syncState: 'queued',
    intakeStatus: 'private-intake',
    archiveWorthiness: { flagged: true, flaggedAt: '2026-03-28T01:00:00.000Z' },
    memberDisplayName: 'Ari',
    sourceUrl: 'https://example.com/capture',
    fileName: 'capture.webp',
    ...overrides,
  } as ReceiverCapture;
}

describe('sidepanel cards coverage', () => {
  it('renders and wires DraftCard interactions across edit, refine, privacy, and publish controls', async () => {
    const user = userEvent.setup();
    const draftEditor = makeDraftEditor({
      refineResults: {
        'draft-1': {
          provider: 'heuristic',
          refinedTitle: 'Sharper title',
          refinedSummary: 'Sharper summary',
          suggestedTags: ['fresh', 'priority'],
          durationMs: 22,
        },
      },
    });

    render(
      <DraftCard
        draft={draftValue}
        context="roost"
        draftEditor={draftEditor}
        inferenceState={{ capability: { status: 'ready' } } as never}
        runtimeConfig={{ privacyMode: 'on' } as never}
        coops={makeCoops()}
        onShareToFeed={vi.fn()}
      />,
    );

    expect(screen.getByText('worth saving')).toBeInTheDocument();
    expect(screen.getByText('+1 more')).toBeInTheDocument();
    expect(screen.getByText('River Coop')).toBeInTheDocument();
    expect(screen.getByText('Polish suggestion')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'River restoration lead updated' },
    });
    expect(draftEditor.updateDraft).toHaveBeenCalledWith(
      draftValue,
      expect.objectContaining({ title: 'River restoration lead updated' }),
    );

    fireEvent.change(screen.getByLabelText('Summary'), {
      target: { value: 'A concise summary for the coop. more' },
    });
    expect(draftEditor.updateDraft).toHaveBeenCalledWith(
      draftValue,
      expect.objectContaining({ summary: 'A concise summary for the coop. more' }),
    );

    await user.selectOptions(screen.getByLabelText('Category'), 'resource');
    expect(draftEditor.updateDraft).toHaveBeenCalledWith(
      draftValue,
      expect.objectContaining({ category: 'resource' }),
    );

    await user.click(screen.getByRole('button', { name: /add soil coop/i }));
    expect(draftEditor.toggleDraftTargetCoop).toHaveBeenCalledWith(draftValue, 'coop-2');

    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(draftEditor.applyRefineResult).toHaveBeenCalledWith(draftValue);

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(draftEditor.dismissRefineResult).toHaveBeenCalledWith('draft-1');

    await user.click(screen.getByRole('button', { name: 'Polish locally' }));
    expect(draftEditor.refineDraft).toHaveBeenCalledWith(draftValue, 'summary-compression');

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(draftEditor.saveDraft).toHaveBeenCalledWith(draftValue);

    await user.click(screen.getByRole('button', { name: 'Remove save mark' }));
    expect(draftEditor.toggleDraftArchiveWorthiness).toHaveBeenCalledWith(draftValue);

    await user.click(screen.getByRole('button', { name: 'Send back to hatching' }));
    expect(draftEditor.changeDraftWorkflowStage).toHaveBeenCalledWith(draftValue, 'candidate');

    await user.click(screen.getByRole('checkbox', { name: /publish anonymously/i }));
    expect(draftEditor.setAnonymousPublish).toHaveBeenCalledWith(true);

    await user.click(screen.getByRole('button', { name: 'Share with coop' }));
    expect(draftEditor.publishDraft).toHaveBeenCalledWith(draftValue);

    expect(screen.getByRole('link', { name: 'Open source' })).toHaveAttribute(
      'href',
      'https://example.com/river',
    );
  });

  it('renders ReceiverIntakeCard and dispatches receiver actions', async () => {
    const user = userEvent.setup();
    const capture = makeCapture();
    const draftEditor = makeDraftEditor();

    render(<ReceiverIntakeCard capture={capture} draftEditor={draftEditor} />);

    expect(screen.getByText('Pocket finding')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'https://example.com/capture' })).toBeInTheDocument();
    expect(screen.getByText('worth saving')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove save mark' }));
    expect(draftEditor.toggleReceiverCaptureArchiveWorthiness).toHaveBeenCalledWith(capture);

    await user.click(screen.getByRole('button', { name: 'Move to hatching' }));
    expect(draftEditor.convertReceiverCapture).toHaveBeenCalledWith(capture, 'candidate');

    await user.click(screen.getByRole('button', { name: 'Make a draft' }));
    expect(draftEditor.convertReceiverCapture).toHaveBeenCalledWith(capture, 'ready');

    await user.click(screen.getByRole('button', { name: 'Save locally' }));
    expect(draftEditor.archiveReceiverCapture).toHaveBeenCalledWith(capture.id);
  });

  it('renders ArtifactCard with latest saved proof and action buttons', async () => {
    const user = userEvent.setup();
    const archiveArtifact = vi.fn(async () => undefined);
    const toggleArtifactArchiveWorthiness = vi.fn(async () => undefined);
    const artifact = {
      id: 'artifact-1',
      originId: 'origin-1',
      targetCoopId: 'coop-1',
      title: 'Published artifact',
      summary: 'Shared summary',
      sources: [{ label: 'Source', url: 'https://example.com/artifact', domain: 'example.com' }],
      tags: ['one', 'two', 'three', 'four', 'five'],
      category: 'resource',
      whyItMatters: 'Worth sharing',
      suggestedNextStep: 'Post it',
      createdBy: 'member-1',
      createdAt: '2026-03-28T00:00:00.000Z',
      reviewStatus: 'published',
      archiveStatus: 'archived',
      archiveWorthiness: { flagged: false },
      archiveReceiptIds: ['receipt-1'],
      attachments: [],
    } as const;
    const receipt = {
      id: 'receipt-1',
      gatewayUrl: 'https://storacha.link/ipfs/bafy-receipt',
    } as never;
    const activeCoop = {
      artifacts: [artifact],
    } as CoopSharedState;

    render(
      <ArtifactCard
        artifact={artifact as never}
        archiveReceipts={[receipt]}
        activeCoop={activeCoop}
        archiveArtifact={archiveArtifact}
        toggleArtifactArchiveWorthiness={toggleArtifactArchiveWorthiness}
        onShareToFeed={vi.fn()}
      />,
    );

    expect(screen.getByText('+1 more')).toBeInTheDocument();
    expect(screen.getByText(/Saved already/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open saved proof' })).toHaveAttribute(
      'href',
      'https://storacha.link/ipfs/bafy-receipt',
    );

    await user.click(screen.getByRole('button', { name: 'Mark worth saving' }));
    expect(toggleArtifactArchiveWorthiness).toHaveBeenCalledWith('artifact-1', true);

    await user.click(screen.getByRole('button', { name: 'Save this find' }));
    expect(archiveArtifact).toHaveBeenCalledWith('artifact-1');
  });

  it('renders ArchiveReceiptCard lifecycle, links, and live actions', async () => {
    const user = userEvent.setup();
    const refreshArchiveStatus = vi.fn(async () => undefined);
    const onAnchorOnChain = vi.fn();
    const onFvmRegister = vi.fn();

    render(
      <ArchiveReceiptCard
        receipt={
          {
            id: 'receipt-1',
            scope: 'artifact',
            delegationMode: 'live',
            filecoinStatus: 'indexed',
            title: 'River proof',
            purpose: 'Archive a shared find',
            summary: 'Proof summary',
            gatewayUrl: 'https://storacha.link/ipfs/bafy-proof',
            rootCid: 'bafy-root',
            uploadedAt: '2026-03-28T00:00:00.000Z',
            itemCount: 3,
            primaryPieceCid: 'baga-piece',
            delegationSource: 'trusted-node',
            delegationIssuer: 'coop',
            dealCount: 1,
            aggregateCount: 1,
            filecoinDeals: [
              {
                provider: 'f01234',
                dealId: 22,
                aggregate: 'bafy-aggregate',
              },
            ],
            filecoinAggregates: [
              {
                aggregate: 'bafy-aggregate',
                inclusionProofAvailable: true,
              },
            ],
            lastRefreshedAt: '2026-03-28T01:00:00.000Z',
            filecoinInfoLastUpdatedAt: '2026-03-28T01:05:00.000Z',
            lastRefreshError: 'Gateway timeout',
          } as never
        }
        runtimeConfig={{ onchainMode: 'live' } as never}
        liveArchiveAvailable
        refreshArchiveStatus={refreshArchiveStatus}
        onAnchorOnChain={onAnchorOnChain}
        onFvmRegister={onFvmRegister}
      />,
    );

    expect(screen.getByText('Uploaded')).toBeInTheDocument();
    expect(screen.getByText('Indexed')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'https://storacha.link/ipfs/bafy-proof' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Gateway timeout/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Refresh deep-save check' }));
    expect(refreshArchiveStatus).toHaveBeenCalledWith('receipt-1');

    await user.click(screen.getByRole('button', { name: 'Anchor on-chain' }));
    expect(onAnchorOnChain).toHaveBeenCalledWith('receipt-1');

    await user.click(screen.getByRole('button', { name: 'Register on Filecoin' }));
    expect(onFvmRegister).toHaveBeenCalledWith('receipt-1');
  });

  it('renders skeleton helpers with the requested labels and counts', () => {
    render(
      <div>
        <SkeletonCards count={3} label="Loading cards" />
        <SkeletonSummary label="Loading summary" />
      </div>,
    );

    const cards = screen.getByLabelText('Loading cards');
    expect(within(cards).getAllByRole('generic', { hidden: true })).toHaveLength(3);
    expect(screen.getByLabelText('Loading summary')).toBeInTheDocument();
  });
});
