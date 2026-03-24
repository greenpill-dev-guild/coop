import type { CoopSharedState } from '@coop/shared';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoopsTab } from '../tabs/CoopsTab';
import type { CoopsTabProps } from '../tabs/CoopsTab';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../cards', () => ({
  ArtifactCard: ({ artifact }: { artifact: { id: string } }) => (
    <div data-testid={`artifact-${artifact.id}`}>Artifact</div>
  ),
  ArchiveReceiptCard: ({ receipt }: { receipt: { id: string } }) => (
    <div data-testid={`receipt-${receipt.id}`}>Receipt</div>
  ),
  SkeletonCards: () => <div data-testid="skeleton-cards">Loading</div>,
  SkeletonSummary: ({ label }: { label: string }) => (
    <div data-testid="skeleton-summary">{label}</div>
  ),
}));

vi.mock('../cards/CoopCard', () => ({
  CoopCard: ({
    coop,
    onClick,
  }: {
    coop: CoopSharedState;
    currentMemberId?: string;
    onClick: () => void;
  }) => (
    <button data-testid={`coop-card-${coop.profile.id}`} onClick={onClick} type="button">
      {coop.profile.name}
    </button>
  ),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCoop(id: string, name: string): CoopSharedState {
  return {
    profile: {
      id,
      name,
      purpose: 'Test',
      spaceType: 'community',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'me',
      captureMode: 'manual',
      safeAddress: '0x1111111111111111111111111111111111111111',
      active: true,
    },
    members: [],
    rituals: [],
    artifacts: [],
    reviewBoard: [],
    archiveReceipts: [],
    invites: [],
    onchainState: {
      safeAddress: '0x1111111111111111111111111111111111111111',
      chainKey: 'sepolia',
      statusNote: 'Ready',
      mode: 'mock',
    },
    syncRoom: { roomId: `room-${id}`, signalingUrls: [] },
    memoryProfile: {
      identity: '',
      goals: [],
      strategies: [],
      narratives: [],
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  } as CoopSharedState;
}

const defaultRuntimeConfig = {
  privacyMode: 'off' as const,
  sessionMode: 'passkey' as const,
  onchainMode: 'mock' as const,
  archiveMode: 'mock' as const,
  chainKey: 'sepolia' as const,
  receiverAppUrl: 'https://coop.town',
  signalingUrls: ['wss://api.coop.town'],
};

function baseProps(overrides?: Partial<CoopsTabProps>): CoopsTabProps {
  return {
    dashboard: {
      coops: [],
      activeCoopId: 'a',
      coopBadges: [],
      receiverPairings: [],
      summary: {
        iconState: 'ready',
        iconLabel: 'Coop',
        pendingDrafts: 0,
        syncState: 'idle',
        agentCadenceMinutes: 64,
        localEnhancement: 'ready',
        localInferenceOptIn: false,
      },
      uiPreferences: {
        localInferenceOptIn: false,
        agentCadenceMinutes: 64,
        captureOnClose: false,
        notificationsEnabled: true,
        preferredExportMethod: 'download',
        excludedCategories: [],
        customExcludedDomains: [],
      },
      operator: {
        policyActionQueue: [],
      },
    } as CoopsTabProps['dashboard'],
    activeCoop: makeCoop('a', 'Alpha Coop'),
    allCoops: [makeCoop('a', 'Alpha Coop'), makeCoop('b', 'Beta Coop')],
    currentMemberId: 'me',
    archiveStory: null,
    archiveReceipts: [],
    refreshableArchiveReceipts: [],
    runtimeConfig: defaultRuntimeConfig as CoopsTabProps['runtimeConfig'],
    boardUrl: 'https://board.example.com',
    archiveSnapshot: vi.fn(),
    exportLatestReceipt: vi.fn(),
    refreshArchiveStatus: vi.fn(),
    archiveArtifact: vi.fn(),
    toggleArtifactArchiveWorthiness: vi.fn(),
    onAnchorOnChain: vi.fn(),
    onFvmRegister: vi.fn(),
    selectActiveCoop: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Step 13: SidepanelSubheader in CoopsTab
// ---------------------------------------------------------------------------

describe('CoopsTab — SidepanelSubheader integration (Step 13)', () => {
  afterEach(cleanup);

  // --- Level 1: List view ---

  describe('Level 1 — list view', () => {
    it('renders SidepanelSubheader with coop filter pills', () => {
      const { container } = render(<CoopsTab {...baseProps()} />);

      const subheader = container.querySelector('.popup-subheader') as HTMLElement;
      expect(subheader).not.toBeNull();

      // Scope to subheader so we don't pick up CoopCard text
      expect(within(subheader).getByText('All')).toBeInTheDocument();
      expect(within(subheader).getByText('Alpha Coop')).toBeInTheDocument();
      expect(within(subheader).getByText('Beta Coop')).toBeInTheDocument();
    });

    it('"All" is active by default, showing all coop cards', () => {
      const { container } = render(<CoopsTab {...baseProps()} />);

      const subheader = container.querySelector('.popup-subheader') as HTMLElement;
      const allPill = within(subheader).getByText('All');
      expect(allPill).toHaveAttribute('aria-pressed', 'true');

      // Both coop cards should be visible
      expect(screen.getByTestId('coop-card-a')).toBeInTheDocument();
      expect(screen.getByTestId('coop-card-b')).toBeInTheDocument();
    });

    it('filters to a single coop when its pill is clicked', async () => {
      const user = userEvent.setup();
      const { container } = render(<CoopsTab {...baseProps()} />);

      // Click the pill in the subheader (not the CoopCard button)
      const subheader = container.querySelector('.popup-subheader') as HTMLElement;
      await user.click(within(subheader).getByText('Alpha Coop'));

      // Only Alpha card should be visible
      expect(screen.getByTestId('coop-card-a')).toBeInTheDocument();
      expect(screen.queryByTestId('coop-card-b')).not.toBeInTheDocument();
    });

    it('clicking "All" again shows all coop cards', async () => {
      const user = userEvent.setup();
      const { container } = render(<CoopsTab {...baseProps()} />);

      const subheader = container.querySelector('.popup-subheader') as HTMLElement;

      // Filter to Alpha
      await user.click(within(subheader).getByText('Alpha Coop'));
      expect(screen.queryByTestId('coop-card-b')).not.toBeInTheDocument();

      // Back to All
      await user.click(within(subheader).getByText('All'));
      expect(screen.getByTestId('coop-card-a')).toBeInTheDocument();
      expect(screen.getByTestId('coop-card-b')).toBeInTheDocument();
    });

    it('clicking a coop card drills into detail view', async () => {
      const user = userEvent.setup();
      const selectActiveCoop = vi.fn();

      render(<CoopsTab {...baseProps({ selectActiveCoop })} />);

      await user.click(screen.getByTestId('coop-card-a'));
      expect(selectActiveCoop).toHaveBeenCalledWith('a');

      // Detail view content should appear (Coop Feed heading)
      expect(screen.getByRole('heading', { name: /coop feed/i })).toBeInTheDocument();
    });
  });

  // --- Level 2: Detail view ---

  describe('Level 2 — detail view', () => {
    async function drillInto(coopId = 'a') {
      const user = userEvent.setup();
      const result = render(<CoopsTab {...baseProps()} />);

      await user.click(screen.getByTestId(`coop-card-${coopId}`));
      return { user, ...result };
    }

    it('renders a back arrow button', async () => {
      await drillInto();

      const backBtn = screen.getByRole('button', { name: /back/i });
      expect(backBtn).toBeInTheDocument();
    });

    it('renders the coop name as a label in the subheader', async () => {
      await drillInto();

      // The subheader should display the coop name
      expect(screen.getByText('Alpha Coop')).toBeInTheDocument();
    });

    it('renders action icons for Open Board, Save Snapshot, Export Proof', async () => {
      await drillInto();

      expect(screen.getByRole('button', { name: /open.*board/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save.*snapshot/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /export.*proof/i })).toBeInTheDocument();
    });

    it('clicking back returns to list view', async () => {
      const { user } = await drillInto();

      await user.click(screen.getByRole('button', { name: /back/i }));

      // Should see coop cards again
      expect(screen.getByTestId('coop-card-a')).toBeInTheDocument();
      expect(screen.getByTestId('coop-card-b')).toBeInTheDocument();
    });

    it('does not render the old "All Coops" secondary button', async () => {
      await drillInto();

      expect(screen.queryByText(/← all coops/i)).not.toBeInTheDocument();
    });

    it('does not render the old inline action-row', async () => {
      const { container } = await drillInto();

      expect(container.querySelector('.action-row')).toBeNull();
    });
  });
});
