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
  } as unknown as CoopSharedState;
}

function buildProps(overrides: Partial<RoostTabProps> = {}): RoostTabProps {
  const coop = createMinimalCoop();
  return {
    activeCoop: coop,
    activeMember: coop.members[0],
    allCoops: [coop],
    selectActiveCoop: vi.fn(),
    greenGoodsActionQueue: [],
    summary: null,
    agentDashboard: null,
    onProvisionMemberOnchainAccount: vi.fn(),
    onSubmitGreenGoodsWorkSubmission: vi.fn(),
    onRunAgentCycle: vi.fn(),
    onApproveAgentPlan: vi.fn(),
    onRejectAgentPlan: vi.fn(),
    onOpenSynthesisSegment: vi.fn(),
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

  it('does not render the removed direct impact-report form', () => {
    render(<RoostTab {...buildProps()} />);

    expect(screen.queryByTestId('gg-impact')).not.toBeInTheDocument();
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

  it('renders only Focus by default in simple mode', () => {
    render(<RoostTab {...buildProps()} />);

    const nav = document.querySelector('.nest-sub-tabs');
    expect(nav).not.toBeNull();
    expect(screen.getByRole('button', { name: /focus/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^agent$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /garden/i })).not.toBeInTheDocument();
  });

  it('restores Agent and Garden sub-tab pills in advanced mode', () => {
    render(<RoostTab {...buildProps({ uiMode: 'advanced' })} />);

    expect(screen.getByRole('button', { name: /focus/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^agent$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /garden/i })).toBeInTheDocument();
  });

  it('shows Garden in simple mode when Green Goods is enabled', () => {
    const props = buildProps();
    const activeCoop = props.activeCoop;
    if (!activeCoop) {
      throw new Error('Expected active coop fixture to be initialized');
    }
    const greenGoodsCoop = {
      ...activeCoop,
      greenGoods: {
        enabled: true,
        memberBindings: [],
      },
    } as unknown as CoopSharedState;

    render(<RoostTab {...props} activeCoop={greenGoodsCoop} allCoops={[greenGoodsCoop]} />);

    expect(screen.getByRole('button', { name: /focus/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^agent$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /garden/i })).toBeInTheDocument();
  });

  it('shows badge on Focus pill when drafts or stale items exist', () => {
    render(
      <RoostTab
        {...buildProps({
          summary: {
            routedTabs: 0,
            pendingDrafts: 2,
            staleObservationCount: 1,
          } as RoostTabProps['summary'],
        })}
      />,
    );

    const badge = document.querySelector('.nest-sub-tabs .nest-badge');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe('3');
  });
});
