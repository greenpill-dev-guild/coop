import {
  buildCoopBoardDeepLink,
  createArchiveBundle,
  createCoop,
  createCoopBoardSnapshot,
  createMockArchiveReceipt,
  createReceiverDraftSeed,
  recordArchiveReceipt,
  withArchiveWorthiness,
} from '@coop/shared';
import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetReceiverDb } from '../app';
import { bootstrapCoopBoardHandoff } from '../board-handoff';
import { renderRootApp } from './root-app-test-utils';

vi.mock('@xyflow/react', () => ({
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  MarkerType: {
    ArrowClosed: 'arrowclosed',
  },
  Position: {
    Left: 'left',
    Right: 'right',
  },
  ReactFlow: ({
    nodes,
    edges,
  }: {
    nodes: Array<{ id: string; data: { title: string } }>;
    edges: Array<{ id: string; label?: string }>;
  }) => (
    <div data-testid="mock-react-flow">
      {nodes.map((node) => (
        <div key={node.id}>{node.data.title}</div>
      ))}
      {edges.map((edge) => (
        <div key={edge.id}>{edge.label}</div>
      ))}
    </div>
  ),
}));

function buildSetupInsights() {
  return {
    summary: 'A compact setup payload for board rendering and archive receipt storytelling.',
    crossCuttingPainPoints: ['Context slips between review and archive'],
    crossCuttingOpportunities: ['Make archive receipts visible in the board'],
    lenses: [
      {
        lens: 'capital-formation',
        currentState: 'Funding links live in browsers.',
        painPoints: 'The best leads disappear.',
        improvements: 'Archive the good ones visibly.',
      },
      {
        lens: 'impact-reporting',
        currentState: 'Evidence lands late.',
        painPoints: 'Snapshots are hard to inspect.',
        improvements: 'Keep the archive trail legible.',
      },
      {
        lens: 'governance-coordination',
        currentState: 'Reviews happen weekly.',
        painPoints: 'Good context leaves no trail.',
        improvements: 'Show the board and archive story together.',
      },
      {
        lens: 'knowledge-garden-resources',
        currentState: 'Research stays private too long.',
        painPoints: 'Artifacts lose provenance.',
        improvements: 'Preserve capture to archive relationships.',
      },
    ],
  } as const;
}

function buildBoardSnapshot() {
  const created = createCoop({
    coopName: 'Board Coop',
    purpose: 'Make capture, review, publish, and archive flows legible.',
    creatorDisplayName: 'Mina',
    captureMode: 'manual',
    seedContribution: 'I bring field notes and archive instincts.',
    setupInsights: buildSetupInsights(),
  });
  const creator = created.creator;
  const artifact = created.state.artifacts[0];
  if (!artifact) {
    throw new Error('Expected a seed artifact.');
  }

  const capture = withArchiveWorthiness(
    {
      id: 'capture-1',
      deviceId: 'device-1',
      pairingId: 'pairing-1',
      coopId: created.state.profile.id,
      coopDisplayName: created.state.profile.name,
      memberId: creator.id,
      memberDisplayName: creator.displayName,
      kind: 'file' as const,
      title: 'forest-notes.txt',
      note: 'Archive this after review.',
      fileName: 'forest-notes.txt',
      mimeType: 'text/plain',
      byteSize: 88,
      createdAt: '2026-03-12T18:00:00.000Z',
      updatedAt: '2026-03-12T18:00:00.000Z',
      syncState: 'synced' as const,
      syncedAt: '2026-03-12T18:01:00.000Z',
      retryCount: 0,
      intakeStatus: 'draft' as const,
      linkedDraftId: 'draft-receiver-capture-1',
    },
    true,
    '2026-03-12T18:01:30.000Z',
  );

  const draft = createReceiverDraftSeed({
    capture,
    availableCoopIds: [created.state.profile.id],
    preferredCoopId: created.state.profile.id,
    preferredCoopLabel: created.state.profile.name,
    workflowStage: 'ready',
    createdAt: '2026-03-12T18:02:00.000Z',
  });

  const stateWithFlaggedArtifact = {
    ...created.state,
    artifacts: [withArchiveWorthiness(artifact, true, '2026-03-12T18:03:00.000Z')],
  };
  const bundle = createArchiveBundle({
    scope: 'artifact',
    state: stateWithFlaggedArtifact,
    artifactIds: [artifact.id],
  });
  const receipt = createMockArchiveReceipt({
    bundle,
    delegationIssuer: 'trusted-node-demo',
    artifactIds: [artifact.id],
  });
  const nextState = recordArchiveReceipt(stateWithFlaggedArtifact, receipt, [artifact.id]);

  return createCoopBoardSnapshot({
    state: nextState,
    receiverCaptures: [capture],
    drafts: [draft],
    activeMemberId: creator.id,
    activeMemberDisplayName: creator.displayName,
    createdAt: '2026-03-12T18:05:00.000Z',
  });
}

describe('board app routes', () => {
  beforeEach(async () => {
    await resetReceiverDb();
  });

  afterEach(async () => {
    await resetReceiverDb();
    window.history.pushState({}, '', '/');
  });

  it('sanitizes the board snapshot handoff fragment after parsing', () => {
    const snapshot = buildBoardSnapshot();
    const deepLink = buildCoopBoardDeepLink('http://127.0.0.1:3001', snapshot);
    const parsedUrl = new URL(deepLink);

    window.history.pushState({}, '', `${parsedUrl.pathname}${parsedUrl.hash}`);

    const handoff = bootstrapCoopBoardHandoff(window);

    expect(window.location.pathname).toBe(`/board/${snapshot.coopId}`);
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
    expect(handoff).toEqual(snapshot);
  });

  it('renders the empty state when no board snapshot is available', async () => {
    window.history.pushState({}, '', '/board/nonexistent-coop');

    await renderRootApp();

    expect(
      await screen.findByRole('heading', { name: 'The board needs a coop snapshot' }),
    ).toBeVisible();
    expect(
      screen.getByText(
        'Open the board from the extension sidepanel so it can hand off a member-scoped snapshot.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to landing' })).toHaveAttribute(
      'href',
      '/landing',
    );
    expect(screen.getByTestId('board-empty-nest')).toBeVisible();
  });

  it('renders the toolbar with share and export buttons when snapshot is present', async () => {
    const snapshot = buildBoardSnapshot();
    window.history.pushState({}, '', `/board/${snapshot.coopId}`);

    await renderRootApp({ initialBoardSnapshot: snapshot });

    expect(await screen.findByRole('heading', { name: 'Board Coop' })).toBeVisible();
    const shareButton = screen.getByRole('button', { name: 'Share snapshot' });
    expect(shareButton).toBeVisible();
    const exportButton = screen.getByRole('button', { name: 'Export as image' });
    expect(exportButton).toBeVisible();
    expect(exportButton).toBeDisabled();
  });

  it('copies the URL to clipboard when share snapshot is clicked', async () => {
    const snapshot = buildBoardSnapshot();
    window.history.pushState({}, '', `/board/${snapshot.coopId}`);

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    });

    await renderRootApp({ initialBoardSnapshot: snapshot });

    const shareButton = await screen.findByRole('button', { name: 'Share snapshot' });
    await act(async () => {
      shareButton.click();
    });

    expect(writeTextMock).toHaveBeenCalledWith(window.location.href);
    expect(shareButton.textContent).toBe('Copied!');
  });

  it('renders the board route with graph labels and archive receipt details', async () => {
    const snapshot = buildBoardSnapshot();
    window.history.pushState({}, '', `/board/${snapshot.coopId}`);

    await renderRootApp({ initialBoardSnapshot: snapshot });

    expect(await screen.findByRole('heading', { name: 'Board Coop' })).toBeVisible();
    expect(screen.getByText(/saved proof trail/i)).toBeVisible();
    expect(screen.getByTestId('mock-react-flow')).toBeVisible();
    expect(screen.getAllByText('forest-notes.txt').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Setup Insights').length).toBeGreaterThan(0);
    expect(screen.getAllByText('captured by').length).toBeGreaterThan(0);
    expect(screen.getAllByText('draft seeded from capture').length).toBeGreaterThan(0);
    expect(screen.getAllByText('archived in').length).toBeGreaterThan(0);
    expect(screen.getByText(/shared find save/i)).toBeVisible();
    expect(screen.getByText(/save id/i)).toBeVisible();
    expect(screen.getAllByText(/open saved bundle/i).length).toBeGreaterThan(0);
  });
});
