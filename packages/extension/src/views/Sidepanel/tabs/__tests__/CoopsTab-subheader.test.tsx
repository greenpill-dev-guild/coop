import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * CoopsTab subheader regression fix:
 * - Level 1 (list view): uses PopupSubheader with coop filter tags (including "All")
 * - Level 2 (detail view): uses sidepanel-action-row with popup-icon-button for Back/Board/Snapshot/Export
 * - Uses SidepanelSubheader sticky wrapper in both views
 */

import type { CoopSharedState } from '@coop/shared';
import type { DashboardResponse } from '../../../../runtime/messages';
import { CoopsTab, type CoopsTabProps } from '../CoopsTab';

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
    members: [],
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

function buildRuntimeConfig(): DashboardResponse['runtimeConfig'] {
  return {
    captureMode: 'manual',
    onchainMode: 'mock',
    archiveMode: 'mock',
    sessionMode: 'off',
    privacyMode: 'off',
    providerMode: 'standard',
    fvmChain: 'filecoin-calibration',
    localEnhancement: 'off',
  };
}

function buildProps(overrides: Partial<CoopsTabProps> = {}): CoopsTabProps {
  const coop = createMinimalCoop();
  return {
    dashboard: {
      candidates: [],
      coops: [],
      runtimeConfig: buildRuntimeConfig(),
    } as unknown as DashboardResponse,
    activeCoop: coop,
    allCoops: [coop],
    currentMemberId: 'member-1',
    archiveStory: null,
    archiveReceipts: [],
    refreshableArchiveReceipts: [],
    runtimeConfig: buildRuntimeConfig(),
    boardUrl: 'https://board.example.com',
    archiveSnapshot: vi.fn().mockResolvedValue(undefined),
    exportLatestReceipt: vi.fn().mockResolvedValue(undefined),
    refreshArchiveStatus: vi.fn().mockResolvedValue(undefined),
    archiveArtifact: vi.fn().mockResolvedValue(undefined),
    toggleArtifactArchiveWorthiness: vi.fn().mockResolvedValue(undefined),
    onAnchorOnChain: vi.fn(),
    onFvmRegister: vi.fn(),
    selectActiveCoop: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CoopsTab subheader — Level 1 (list view)', () => {
  it('renders PopupSubheader with coop filter tags including "All"', () => {
    const coop2 = createMinimalCoop({ id: 'coop-2', name: 'Beta Coop' });
    render(<CoopsTab {...buildProps({ allCoops: [createMinimalCoop(), coop2] })} />);

    // PopupSubheader renders a <fieldset> with aria-label
    const fieldset = screen.getByRole('group', { name: 'Filter by coop' });
    expect(fieldset).toBeInTheDocument();

    // Should have "All" + two coop tags
    const buttons = fieldset.querySelectorAll('button');
    expect(buttons.length).toBe(3);
    expect(buttons[0].textContent).toBe('All');
  });

  it('wraps filter pills in a sticky sidepanel-subheader in list view', () => {
    render(<CoopsTab {...buildProps()} />);

    const wrapper = document.querySelector('.sidepanel-subheader');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.querySelector('.popup-subheader')).not.toBeNull();
    // Old BEM sub-element classes remain absent
    expect(document.querySelector('.sidepanel-subheader__pills')).toBeNull();
  });
});

describe('CoopsTab subheader — Level 2 (detail view)', () => {
  async function enterDetailView() {
    const user = userEvent.setup();
    render(<CoopsTab {...buildProps()} />);

    // CoopCard renders as button.coop-card-button — click to enter detail view
    const coopCardBtn = document.querySelector('.coop-card-button') as HTMLElement;
    expect(coopCardBtn).not.toBeNull();
    await user.click(coopCardBtn);
  }

  it('renders action row with Back button as popup-icon-button', async () => {
    await enterDetailView();

    const actionRow = document.querySelector('.sidepanel-action-row');
    expect(actionRow).not.toBeNull();

    const backBtn = screen.getByLabelText('Back to all coops');
    expect(backBtn.classList.contains('popup-icon-button')).toBe(true);
  });

  it('renders coop name as strong element in the action row', async () => {
    await enterDetailView();

    const actionRow = document.querySelector('.sidepanel-action-row');
    expect(actionRow).not.toBeNull();
    const strong = actionRow?.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe('Alpha Coop');
  });

  it('renders Board, Snapshot, Export as popup-icon-button actions', async () => {
    await enterDetailView();

    const boardBtn = screen.getByLabelText('Open Board');
    expect(boardBtn.classList.contains('popup-icon-button')).toBe(true);

    const snapshotBtn = screen.getByLabelText('Save Snapshot');
    expect(snapshotBtn.classList.contains('popup-icon-button')).toBe(true);

    const exportBtn = screen.getByLabelText('Export Proof');
    expect(exportBtn.classList.contains('popup-icon-button')).toBe(true);
  });

  it('wraps action row in a sticky sidepanel-subheader in detail view', async () => {
    await enterDetailView();

    const wrapper = document.querySelector('.sidepanel-subheader');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.querySelector('.sidepanel-action-row')).not.toBeNull();
    // Old BEM sub-element classes remain absent
    expect(document.querySelector('.sidepanel-subheader__actions')).toBeNull();
    expect(document.querySelector('.sidepanel-subheader__label')).toBeNull();
  });
});
