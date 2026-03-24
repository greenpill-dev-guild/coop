import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Step 8: RoostTab must use PopupSubheader for coop filtering.
 *
 * We verify:
 * - Coop names rendered as filter pills
 * - Active coop is marked active
 * - Uses SidepanelSubheader sticky wrapper
 */

// Minimal mock for GreenGoods cards to avoid deep @coop/shared dependency chain
vi.mock('../../cards/GreenGoodsActionCards', () => ({
  GreenGoodsAccessSummary: () => <div data-testid="gg-summary" />,
  GreenGoodsImpactReportForm: () => <div data-testid="gg-impact" />,
  GreenGoodsWorkSubmissionForm: () => <div data-testid="gg-work" />,
  GreenGoodsProvisionButton: () => <div data-testid="gg-provision" />,
}));

import type { CoopSharedState } from '@coop/shared';
import { RoostTab, type RoostTabProps } from '../RoostTab';

function createMinimalCoop(overrides: Partial<CoopSharedState['profile']> = {}): CoopSharedState {
  return {
    profile: {
      id: 'coop-1',
      name: 'Alpha Coop',
      purpose: '',
      spaceType: 'community',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'member-1',
      captureMode: 'manual',
      safeAddress: '0x1111111111111111111111111111111111111111',
      active: true,
      ...overrides,
    },
    members: [
      {
        id: 'member-1',
        displayName: 'Alice',
        role: 'creator',
        authMode: 'passkey',
        address: '0x1111111111111111111111111111111111111111',
        joinedAt: '2026-01-01T00:00:00.000Z',
        identityWarning: '',
      },
    ],
    artifacts: [],
    archiveReceipts: [],
    onchainState: {
      chainId: 11155111,
      chainKey: 'sepolia',
      safeAddress: '0x1111111111111111111111111111111111111111',
      safeCapability: 'ready',
      statusNote: '',
    },
    setupInsights: { version: 1, lenses: [], summaryNarrative: '', seedContribution: '' },
    soul: { identity: '', norms: '', ritualGuidance: '' },
    rituals: [],
    memberAccounts: [],
    reviewBoard: [],
    memoryProfile: {
      version: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
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
  } as CoopSharedState;
}

function buildProps(overrides: Partial<RoostTabProps> = {}): RoostTabProps {
  const coop = createMinimalCoop();
  return {
    activeCoop: coop,
    activeMember: coop.members[0],
    allCoops: [coop],
    selectActiveCoop: vi.fn(),
    greenGoodsActionQueue: [],
    onProvisionMemberOnchainAccount: vi.fn(),
    onSubmitGreenGoodsWorkSubmission: vi.fn(),
    onSubmitGreenGoodsImpactReport: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RoostTab subheader integration', () => {
  it('renders coop name as a popup-subheader tag', () => {
    render(<RoostTab {...buildProps()} />);

    const subheader = document.querySelector('.popup-subheader');
    expect(subheader).not.toBeNull();
    expect(screen.getByText('Alpha Coop')).toBeInTheDocument();
  });

  it('does not render old TabCoopSelector class', () => {
    render(<RoostTab {...buildProps()} />);

    expect(document.querySelector('.tab-coop-selector')).toBeNull();
  });

  it('wraps filter pills in a sticky sidepanel-subheader', () => {
    render(<RoostTab {...buildProps()} />);

    const wrapper = document.querySelector('.sidepanel-subheader');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.querySelector('.popup-subheader')).not.toBeNull();
  });

  it('renders tags for multiple coops', () => {
    const coop2 = createMinimalCoop({ id: 'coop-2', name: 'Beta Coop' });
    const props = buildProps({
      allCoops: [createMinimalCoop(), coop2],
    });

    render(<RoostTab {...props} />);

    expect(screen.getByText('Alpha Coop')).toBeInTheDocument();
    expect(screen.getByText('Beta Coop')).toBeInTheDocument();
  });

  it('marks the active coop tag as active', () => {
    const coop2 = createMinimalCoop({ id: 'coop-2', name: 'Beta Coop' });
    const props = buildProps({
      allCoops: [createMinimalCoop(), coop2],
    });

    render(<RoostTab {...props} />);

    const activeTag = document.querySelector('.popup-subheader__tag.is-active');
    expect(activeTag).not.toBeNull();
    expect(activeTag?.textContent).toBe('Alpha Coop');
  });
});
