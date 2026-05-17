import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { CoopSharedState, SoundPreferences } from '@coop/shared';
import { NestSettingsSection, type NestSettingsSectionProps } from '../NestSettingsSection';

function makeActiveCoop(overrides: Partial<CoopSharedState> = {}): CoopSharedState {
  return {
    profile: {
      id: 'coop-1',
      name: 'Alpha Coop',
      purpose: 'Restore watersheds',
      spaceType: 'community',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'member-1',
      captureMode: 'manual',
      safeAddress: '0x1111111111111111111111111111111111111111',
      active: true,
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
    setupInsights: {
      version: 1,
      lenses: [],
      summaryNarrative: '',
      seedContribution: '',
    },
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
    syncRoom: { signalingServers: [], roomId: 'room-1', password: 'pw' },
    invites: [],
    memberCommitments: [],
    ...overrides,
  } as unknown as CoopSharedState;
}

function buildProps(overrides: Partial<NestSettingsSectionProps> = {}): NestSettingsSectionProps {
  return {
    dashboard: {
      activeCoopId: 'coop-1',
      coops: [],
      coopBadges: [],
      receiverPairings: [],
      recentCaptureRuns: [
        {
          id: 'run-1',
          capturedAt: '2026-03-01T09:30:00.000Z',
          candidateCount: 1,
          capturedDomains: ['watershed.org'],
          skippedCount: 2,
        },
      ],
      summary: {
        iconState: 'ready',
        iconLabel: 'Coop',
        pendingDrafts: 0,
        routedTabs: 0,
        insightDrafts: 0,
        pendingActions: 0,
        staleObservationCount: 0,
        pendingAttentionCount: 0,
        coopCount: 1,
        syncState: 'idle',
        syncLabel: 'Idle',
        syncDetail: 'Idle',
        syncTone: 'ok',
        captureMode: 'manual',
        agentCadenceMinutes: 64,
        localEnhancement: 'ready',
        localInferenceOptIn: false,
        pendingOutboxCount: 0,
      },
      uiPreferences: {
        localInferenceOptIn: false,
        uiMode: 'simple',
        agentCadenceMinutes: 64,
        captureOnClose: false,
        notificationsEnabled: true,
        preferredExportMethod: 'download',
        excludedCategories: [],
        customExcludedDomains: [],
      },
      operator: {
        liveArchiveAvailable: true,
        policyActionQueue: [],
      },
    } as unknown as NestSettingsSectionProps['dashboard'],
    activeCoop: makeActiveCoop(),
    runtimeConfig: {
      chainKey: 'sepolia',
      onchainMode: 'mock',
      archiveMode: 'mock',
      sessionMode: 'off',
      providerMode: 'standard',
      privacyMode: 'off',
      receiverAppUrl: 'https://receiver.test',
      signalingUrls: ['wss://api.coop.town'],
      websocketSyncUrl: 'wss://api.coop.town/yws',
    } as NestSettingsSectionProps['runtimeConfig'],
    authSession: {
      displayName: 'Ari',
      primaryAddress: '0xAri',
      identityWarning: 'Development passkey',
    } as NestSettingsSectionProps['authSession'],
    soundPreferences: { enabled: true } as SoundPreferences,
    inferenceState: null,
    browserUxCapabilities: {
      canNotify: true,
      canScanQr: false,
      canShare: true,
      canSetBadge: true,
      canSaveFile: false,
    },
    configuredReceiverAppUrl: 'https://pocket.coop',
    tabCapture: {
      updateAgentCadence: vi.fn(),
      toggleCaptureOnClose: vi.fn(),
      updateExcludedCategories: vi.fn(),
      updateCustomExcludedDomains: vi.fn(),
    } as unknown as NestSettingsSectionProps['tabCapture'],
    updateSound: vi.fn(),
    testSound: vi.fn(),
    toggleLocalInferenceOptIn: vi.fn(),
    clearSensitiveLocalData: vi.fn(),
    updateUiPreferences: vi.fn(async () => null),
    ...overrides,
  };
}

describe('NestSettingsSection interactions', () => {
  it('updates the advanced controls preference from the browser-local settings card', async () => {
    const user = userEvent.setup();
    const updateUiPreferences = vi.fn(async () => null);

    render(<NestSettingsSection {...buildProps({ updateUiPreferences })} />);

    await user.selectOptions(screen.getByLabelText(/show advanced controls/i), 'advanced');

    expect(updateUiPreferences).toHaveBeenCalledWith({ uiMode: 'advanced' });
  });

  it('hides advanced settings cards in simple mode', () => {
    render(<NestSettingsSection {...buildProps()} />);

    expect(screen.queryByRole('heading', { name: /privacy exclusions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /nest setup/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /local helper/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^data$/i })).not.toBeInTheDocument();
  });

  it('restores advanced settings cards in advanced mode', () => {
    render(
      <NestSettingsSection
        {...buildProps({
          dashboard: {
            ...buildProps().dashboard,
            uiPreferences: {
              ...buildProps().dashboard?.uiPreferences,
              uiMode: 'advanced',
            },
          } as NestSettingsSectionProps['dashboard'],
        })}
      />,
    );

    expect(screen.getByRole('heading', { name: /privacy exclusions/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /nest setup/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /local helper/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^data$/i })).toBeInTheDocument();
  });

  it('updates coop cadence and capture-on-close preferences', async () => {
    const user = userEvent.setup();
    const tabCapture = {
      updateAgentCadence: vi.fn(),
      toggleCaptureOnClose: vi.fn(),
      updateExcludedCategories: vi.fn(),
      updateCustomExcludedDomains: vi.fn(),
    };

    render(
      <NestSettingsSection
        {...buildProps({
          dashboard: {
            ...buildProps().dashboard,
            uiPreferences: {
              ...buildProps().dashboard?.uiPreferences,
              uiMode: 'advanced',
            },
          } as NestSettingsSectionProps['dashboard'],
          tabCapture: tabCapture as unknown as NestSettingsSectionProps['tabCapture'],
        })}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/agent cadence/i), '16');
    await user.selectOptions(screen.getByLabelText(/capture closing tabs/i), 'on');

    expect(tabCapture.updateAgentCadence).toHaveBeenCalledWith(16);
    expect(tabCapture.toggleCaptureOnClose).toHaveBeenCalledWith(true);
  });

  it('updates browser-local sound, notifications, and export preferences', async () => {
    const user = userEvent.setup();
    const updateSound = vi.fn();
    const updateUiPreferences = vi.fn(async () => null);

    render(
      <NestSettingsSection
        {...buildProps({
          browserUxCapabilities: {
            canNotify: true,
            canScanQr: false,
            canShare: true,
            canSetBadge: true,
            canSaveFile: true,
          },
          updateSound,
          updateUiPreferences,
          dashboard: {
            ...buildProps().dashboard,
            uiPreferences: {
              ...buildProps().dashboard?.uiPreferences,
              uiMode: 'advanced',
            },
          } as NestSettingsSectionProps['dashboard'],
        })}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/coop sounds/i), 'off');
    await user.selectOptions(screen.getByLabelText(/notifications/i), 'off');
    await user.selectOptions(screen.getByLabelText(/export method/i), 'file-picker');

    expect(updateSound).toHaveBeenCalledWith({ enabled: false });
    expect(updateUiPreferences).toHaveBeenNthCalledWith(1, { notificationsEnabled: false });
    expect(updateUiPreferences).toHaveBeenNthCalledWith(2, {
      preferredExportMethod: 'file-picker',
    });
  });

  it('disables the file-picker export option when the browser cannot save files', () => {
    render(
      <NestSettingsSection
        {...buildProps({
          dashboard: {
            ...buildProps().dashboard,
            uiPreferences: {
              ...buildProps().dashboard?.uiPreferences,
              uiMode: 'advanced',
            },
          } as NestSettingsSectionProps['dashboard'],
        })}
      />,
    );

    expect(screen.getByRole('option', { name: /file picker/i })).toBeDisabled();
  });

  it('updates excluded categories and custom excluded domains', async () => {
    const user = userEvent.setup();
    const tabCapture = {
      updateAgentCadence: vi.fn(),
      toggleCaptureOnClose: vi.fn(),
      updateExcludedCategories: vi.fn(),
      updateCustomExcludedDomains: vi.fn(),
    };

    render(
      <NestSettingsSection
        {...buildProps({
          tabCapture: tabCapture as unknown as NestSettingsSectionProps['tabCapture'],
          dashboard: {
            ...buildProps().dashboard,
            uiPreferences: {
              ...buildProps().dashboard?.uiPreferences,
              uiMode: 'advanced',
              customExcludedDomains: ['already-blocked.com', 'remove-me.com'],
            },
          } as NestSettingsSectionProps['dashboard'],
        })}
      />,
    );

    await user.click(screen.getByRole('checkbox', { name: /email/i }));
    await user.type(
      screen.getByLabelText(/custom excluded domains/i),
      'https://Private-Site.com/path{enter}',
    );

    const removeMeRow = screen.getByText('remove-me.com').closest('li');
    if (!removeMeRow) {
      throw new Error('expected remove-me.com row');
    }
    await user.click(within(removeMeRow).getByRole('button', { name: /remove/i }));

    expect(tabCapture.updateExcludedCategories).toHaveBeenCalledWith(['email']);
    expect(tabCapture.updateCustomExcludedDomains).toHaveBeenNthCalledWith(1, [
      'already-blocked.com',
      'remove-me.com',
      'private-site.com',
    ]);
    expect(tabCapture.updateCustomExcludedDomains).toHaveBeenNthCalledWith(2, [
      'already-blocked.com',
    ]);
  });

  it('toggles the local helper and renders recent roundup details', async () => {
    const user = userEvent.setup();
    const toggleLocalInferenceOptIn = vi.fn();

    render(
      <NestSettingsSection
        {...buildProps({
          dashboard: {
            ...buildProps().dashboard,
            uiPreferences: {
              ...buildProps().dashboard?.uiPreferences,
              uiMode: 'advanced',
            },
          } as NestSettingsSectionProps['dashboard'],
          toggleLocalInferenceOptIn,
        })}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/local helper/i), 'on');

    expect(toggleLocalInferenceOptIn).toHaveBeenCalledOnce();
    expect(screen.getByText(/1 tab captured/i)).toBeInTheDocument();
    expect(screen.getByText(/watershed\.org/i)).toBeInTheDocument();
    expect(screen.getByText(/2 excluded/i)).toBeInTheDocument();
  });
});
