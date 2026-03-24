import type { CoopSharedState } from '@coop/shared';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoopCard, type CoopCardProps } from '../CoopCard';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function createMockCoop(overrides: Partial<CoopSharedState> = {}): CoopSharedState {
  return {
    profile: {
      id: 'coop-1',
      name: 'Test Coop',
      purpose: 'Test purpose',
      spaceType: 'community',
      createdAt: '2026-01-15T10:00:00.000Z',
      createdBy: 'member-1',
      captureMode: 'manual',
      safeAddress: '0x1234567890123456789012345678901234567890',
      active: true,
    },
    members: [
      {
        id: 'member-1',
        displayName: 'Alice',
        role: 'creator',
        authMode: 'passkey',
        address: '0x1111111111111111111111111111111111111111',
        joinedAt: '2026-01-15T10:00:00.000Z',
        identityWarning: '',
      },
      {
        id: 'member-2',
        displayName: 'Bob',
        role: 'member',
        authMode: 'passkey',
        address: '0x2222222222222222222222222222222222222222',
        joinedAt: '2026-01-16T10:00:00.000Z',
        identityWarning: '',
      },
    ],
    artifacts: [
      {
        id: 'artifact-1',
        title: 'Test Artifact',
        summary: 'Summary',
        whyItMatters: 'It matters',
        suggestedNextStep: 'Next step',
        category: 'insight',
        tags: [],
        sources: [],
        reviewStatus: 'published',
        archiveStatus: 'not-archived',
        archiveWorthiness: 'not-flagged',
        archiveReceiptIds: [],
        createdAt: '2026-03-01T12:00:00.000Z',
        createdBy: 'member-1',
        updatedAt: '2026-03-01T12:00:00.000Z',
      },
      {
        id: 'artifact-2',
        title: 'Draft Artifact',
        summary: 'Draft summary',
        whyItMatters: 'Matters',
        suggestedNextStep: 'Step',
        category: 'thought',
        tags: [],
        sources: [],
        reviewStatus: 'draft',
        archiveStatus: 'not-archived',
        archiveWorthiness: 'not-flagged',
        archiveReceiptIds: [],
        createdAt: '2026-03-02T12:00:00.000Z',
        createdBy: 'member-2',
        updatedAt: '2026-03-02T12:00:00.000Z',
      },
    ],
    archiveReceipts: [
      {
        id: 'receipt-1',
        scope: 'artifact',
        rootCid: 'bafybeig...',
        uploadedAt: '2026-03-10T08:00:00.000Z',
        delegationMode: 'mock',
        delegationIssuer: 'did:key:abc',
        itemCount: 1,
        title: 'Test Archive',
        purpose: 'artifact-archive',
        summary: 'Archived artifact',
        gatewayBaseUrl: 'https://storacha.link',
        filecoinStatus: 'pending',
      },
    ],
    onchainState: {
      chainId: 11155111,
      chainKey: 'sepolia',
      safeAddress: '0x1234567890123456789012345678901234567890',
      safeCapability: 'ready',
      statusNote: 'Safe deployed',
    },
    setupInsights: {
      version: 1,
      lenses: [],
      summaryNarrative: '',
      seedContribution: '',
    },
    soul: {
      identity: '',
      norms: '',
      ritualGuidance: '',
    },
    rituals: [
      {
        id: 'r-1',
        name: 'Weekly sync',
        cadence: 'weekly',
        namedMoments: ['check-in'],
        facilitatorExpectation: 'Anyone can facilitate',
        defaultCapturePosture: 'open',
      },
    ],
    memberAccounts: [],
    reviewBoard: [],
    memoryProfile: {
      version: 1,
      updatedAt: '2026-01-15T10:00:00.000Z',
      topDomains: [],
      topTags: [],
      categoryStats: [],
      ritualLensWeights: [],
      exemplarArtifactIds: [],
      archiveSignals: { archivedTagCounts: {}, archivedDomainCounts: {} },
    },
    syncRoom: {
      signalingServers: ['wss://coop-signal.fly.dev/ws'],
      roomId: 'room-1',
      password: 'pw',
    },
    invites: [],
    memberCommitments: [],
    ...overrides,
  } as CoopSharedState;
}

function renderCard(overrides: Partial<CoopCardProps> = {}) {
  const defaultProps: CoopCardProps = {
    coop: createMockCoop(),
    currentMemberId: 'member-1',
    onClick: vi.fn(),
    ...overrides,
  };
  return { ...render(<CoopCard {...defaultProps} />), props: defaultProps };
}

// ---------------------------------------------------------------------------
// Tests — compact inline layout
// ---------------------------------------------------------------------------

describe('CoopCard', () => {
  afterEach(() => {
    cleanup();
  });

  // --- Name display ---

  it('renders the coop name as bold text', () => {
    renderCard();
    const name = document.querySelector('.coop-card__name');
    expect(name).not.toBeNull();
    expect(name?.textContent).toBe('Test Coop');
  });

  // --- Inline stats ---

  it('displays space type label in meta line', () => {
    renderCard();
    const button = screen.getByRole('button');
    expect(button.textContent).toContain('Community');
  });

  it('displays chain label in meta line', () => {
    renderCard();
    const button = screen.getByRole('button');
    expect(button.textContent).toContain('Sepolia');
  });

  it('displays member count as inline text', () => {
    renderCard();
    const button = screen.getByRole('button');
    expect(button.textContent).toContain('2 members');
  });

  it('shows singular member count when only 1 member', () => {
    const coop = createMockCoop({
      members: [
        {
          id: 'member-1',
          displayName: 'Alice',
          role: 'creator',
          authMode: 'passkey',
          address: '0x1111111111111111111111111111111111111111',
          joinedAt: '2026-01-15T10:00:00.000Z',
          identityWarning: '',
        },
      ],
    });
    renderCard({ coop });
    expect(screen.getByRole('button').textContent).toContain('1 member');
  });

  // --- Stat lines ---

  it('displays shared finds count inline', () => {
    renderCard();
    const button = screen.getByRole('button');
    expect(button.textContent).toContain('1 shared');
  });

  it('displays saved count inline', () => {
    renderCard();
    const button = screen.getByRole('button');
    expect(button.textContent).toContain('1 saved');
  });

  it('displays pending drafts count inline', () => {
    renderCard();
    const button = screen.getByRole('button');
    expect(button.textContent).toContain('1 draft');
  });

  // --- Last activity (relative time) ---

  it('displays relative time for last activity', () => {
    renderCard();
    const button = screen.getByRole('button');
    // The meta line should contain a relative time value (e.g. "14d")
    expect(button.textContent).toMatch(/\d+[dhm]/);
  });

  // --- Click interaction ---

  it('calls onClick when card is clicked', async () => {
    const onClick = vi.fn();
    renderCard({ onClick });
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('calls onClick when Enter key is pressed', async () => {
    const onClick = vi.fn();
    renderCard({ onClick });
    const card = screen.getByRole('button');
    card.focus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('calls onClick when Space key is pressed', async () => {
    const onClick = vi.fn();
    renderCard({ onClick });
    const card = screen.getByRole('button');
    card.focus();
    await userEvent.keyboard(' ');
    expect(onClick).toHaveBeenCalledOnce();
  });

  // --- Edge cases ---

  it('handles coop with no artifacts', () => {
    const coop = createMockCoop({ artifacts: [] });
    renderCard({ coop });
    const text = screen.getByRole('button').textContent ?? '';
    expect(text).toContain('0 shared');
    expect(text).toContain('0 drafts');
  });

  it('handles coop with no archive receipts', () => {
    const coop = createMockCoop({ archiveReceipts: [] });
    renderCard({ coop });
    const text = screen.getByRole('button').textContent ?? '';
    expect(text).toContain('0 saved');
  });

  // --- Chevron ---

  it('renders a chevron SVG in the name row', () => {
    renderCard();
    const nameRow = document.querySelector('.coop-card__name-row');
    expect(nameRow).not.toBeNull();
    expect(nameRow?.querySelector('svg')).not.toBeNull();
  });
});
