import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NestSyncDetailSection, type NestSyncDetailSectionProps } from '../NestSyncDetailSection';

function buildProps(
  overrides: Partial<NestSyncDetailSectionProps> = {},
): NestSyncDetailSectionProps {
  return {
    runtimeConfig: {
      chainKey: 'sepolia',
      onchainMode: 'mock',
      archiveMode: 'mock',
      sessionMode: 'off',
      providerMode: 'bundler',
      privacyMode: 'off',
      receiverAppUrl: 'http://127.0.0.1:3001',
      signalingUrls: ['wss://api.coop.town'],
      websocketSyncUrl: 'wss://api.coop.town/yws',
    },
    summary: {
      iconState: 'idle',
      iconLabel: 'Idle',
      pendingDrafts: 0,
      routedTabs: 0,
      insightDrafts: 0,
      pendingActions: 0,
      staleObservationCount: 0,
      pendingAttentionCount: 0,
      coopCount: 1,
      syncState: 'Healthy',
      syncLabel: 'Healthy',
      syncDetail: 'All transports connected',
      syncTone: 'ok',
      captureMode: 'manual',
      agentCadenceMinutes: 16,
      localEnhancement: 'Heuristics-first fallback',
      localInferenceOptIn: false,
      pendingOutboxCount: 0,
    },
    ...overrides,
  };
}

describe('NestSyncDetailSection', () => {
  it('renders signaling URLs', () => {
    render(<NestSyncDetailSection {...buildProps()} />);

    expect(screen.getByText('wss://api.coop.town')).toBeDefined();
  });

  it('renders websocket sync URL when configured', () => {
    render(<NestSyncDetailSection {...buildProps()} />);

    expect(screen.getByText('wss://api.coop.town/yws')).toBeDefined();
  });

  it('shows "Not configured" when websocket sync URL is absent', () => {
    render(
      <NestSyncDetailSection
        {...buildProps({
          runtimeConfig: {
            ...buildProps().runtimeConfig,
            websocketSyncUrl: undefined,
          },
        })}
      />,
    );

    expect(screen.getByText('Not configured')).toBeDefined();
  });

  it('renders sync status with correct tone badge', () => {
    render(<NestSyncDetailSection {...buildProps()} />);

    const statusBadge = screen.getByTestId('sync-status-badge');
    expect(statusBadge.textContent).toBe('Healthy');
    expect(statusBadge.className).toContain('ok');
  });

  it('renders sync detail text', () => {
    render(<NestSyncDetailSection {...buildProps()} />);

    expect(screen.getByText('All transports connected')).toBeDefined();
  });

  it('renders error tone badge when sync is degraded', () => {
    render(
      <NestSyncDetailSection
        {...buildProps({
          summary: {
            ...buildProps().summary,
            syncLabel: 'Error',
            syncTone: 'error',
            syncDetail: 'Signaling connection lost',
          },
        })}
      />,
    );

    const statusBadge = screen.getByTestId('sync-status-badge');
    expect(statusBadge.textContent).toBe('Error');
    expect(statusBadge.className).toContain('error');
  });

  it('renders warning tone badge when sync is local-only', () => {
    render(
      <NestSyncDetailSection
        {...buildProps({
          summary: {
            ...buildProps().summary,
            syncLabel: 'Local',
            syncTone: 'warning',
            syncDetail: 'No signaling server connection',
          },
        })}
      />,
    );

    const statusBadge = screen.getByTestId('sync-status-badge');
    expect(statusBadge.textContent).toBe('Local');
    expect(statusBadge.className).toContain('warning');
  });

  it('lists multiple signaling URLs', () => {
    render(
      <NestSyncDetailSection
        {...buildProps({
          runtimeConfig: {
            ...buildProps().runtimeConfig,
            signalingUrls: ['wss://api.coop.town', 'wss://dev-api.coop.town'],
          },
        })}
      />,
    );

    expect(screen.getByText('wss://api.coop.town')).toBeDefined();
    expect(screen.getByText('wss://dev-api.coop.town')).toBeDefined();
  });

  it('shows empty signaling message when no URLs configured', () => {
    render(
      <NestSyncDetailSection
        {...buildProps({
          runtimeConfig: {
            ...buildProps().runtimeConfig,
            signalingUrls: [],
          },
        })}
      />,
    );

    expect(screen.getByText('No signaling URLs configured')).toBeDefined();
  });

  it('renders outbox count when items are pending', () => {
    render(
      <NestSyncDetailSection
        {...buildProps({
          summary: {
            ...buildProps().summary,
            pendingOutboxCount: 3,
          },
        })}
      />,
    );

    expect(screen.getByText('3')).toBeDefined();
  });
});
