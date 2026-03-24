import type { CoopSharedState } from '@coop/shared';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoopCard, type CoopCardProps } from '../CoopCard';

/**
 * Step 10: CoopCard compact inline layout.
 *
 * We verify:
 * - No .summary-strip grid; stats rendered as inline text with dot separators
 * - Line 1: coop name + chevron
 * - Line 2: "{n} shared · {n} saved"
 * - Line 3: "{n} drafts · {n} members"
 * - Line 4: chain + space type + relative time
 * - No max-height: 160px; safety cap is 200px
 * - Click still works
 */

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
        title: 'Published',
        summary: '',
        whyItMatters: '',
        suggestedNextStep: '',
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
        title: 'Draft',
        summary: '',
        whyItMatters: '',
        suggestedNextStep: '',
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
        title: 'Archive',
        purpose: 'artifact-archive',
        summary: 'Archived',
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
    setupInsights: { version: 1, lenses: [], summaryNarrative: '', seedContribution: '' },
    soul: { identity: '', norms: '', ritualGuidance: '' },
    rituals: [],
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
    syncRoom: { signalingServers: [], roomId: '', password: '' },
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

afterEach(() => {
  cleanup();
});

describe('CoopCard compact layout (Step 10)', () => {
  // --- No summary-strip ---

  it('does not render a .summary-strip grid', () => {
    renderCard();
    expect(document.querySelector('.summary-strip')).toBeNull();
  });

  // --- Line 1: name + chevron ---

  it('renders coop name', () => {
    renderCard();
    expect(screen.getByText('Test Coop')).toBeInTheDocument();
  });

  it('renders a chevron indicator', () => {
    renderCard();
    const nameRow = document.querySelector('.coop-card__name-row');
    expect(nameRow).not.toBeNull();
    // Chevron is an SVG inside the name row
    const svg = nameRow?.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  // --- Line 2: shared + saved ---

  it('displays shared and saved counts as inline text', () => {
    renderCard();
    const button = screen.getByRole('button');
    const text = button.textContent ?? '';
    expect(text).toContain('1 shared');
    expect(text).toContain('1 saved');
  });

  // --- Line 3: drafts + members ---

  it('displays drafts and member counts as inline text', () => {
    renderCard();
    const button = screen.getByRole('button');
    const text = button.textContent ?? '';
    expect(text).toContain('1 draft');
    expect(text).toContain('2 members');
  });

  // --- Line 4: chain + space type ---

  it('displays chain and space type labels', () => {
    renderCard();
    const button = screen.getByRole('button');
    const text = button.textContent ?? '';
    // formatCoopSpaceTypeLabel('community') => 'Community'
    // getCoopChainLabel('sepolia', 'short') => 'Sepolia'
    expect(text).toContain('Sepolia');
    expect(text).toContain('Community');
  });

  // --- No badge elements for stats ---

  it('does not render stat values inside .badge elements', () => {
    renderCard();
    // There should be no .badge elements since we removed individual stat badges
    const badges = document.querySelectorAll('.badge');
    // The card should have 0 badge elements
    expect(badges.length).toBe(0);
  });

  // --- Click behavior preserved ---

  it('calls onClick when card is clicked', async () => {
    const onClick = vi.fn();
    renderCard({ onClick });
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  // --- Edge case ---

  it('handles zero stats gracefully', () => {
    const coop = createMockCoop({ artifacts: [], archiveReceipts: [] });
    renderCard({ coop });
    const text = screen.getByRole('button').textContent ?? '';
    expect(text).toContain('0 shared');
    expect(text).toContain('0 saved');
    expect(text).toContain('0 drafts');
  });
});
