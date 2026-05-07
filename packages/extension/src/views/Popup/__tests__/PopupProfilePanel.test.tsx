import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PopupProfilePanel } from '../PopupProfilePanel';

const baseProps = {
  soundPreferences: {
    enabled: true,
    reducedMotion: false,
    reducedSound: false,
  },
  uiPreferences: {
    notificationsEnabled: true,
    localInferenceOptIn: true,
    uiMode: 'simple' as const,
    preferredExportMethod: 'download' as const,
    heartbeatEnabled: true,
    agentCadenceMinutes: 64 as const,
    excludedCategories: [],
    customExcludedDomains: [],
    captureOnClose: false,
  },
  themePreference: 'system' as const,
  coops: [{ name: 'Starter Coop' }],
  accountLabel: '0x1234',
  onToggleSound: vi.fn(),
  onToggleNotifications: vi.fn(),
  onSetAgentCadence: vi.fn(),
  onSetTheme: vi.fn(),
};

describe('PopupProfilePanel', () => {
  it('hides Agent Cadence in simple mode', () => {
    render(<PopupProfilePanel {...baseProps} />);

    expect(screen.queryByText('Agent Cadence')).not.toBeInTheDocument();
  });

  it('restores Agent Cadence in advanced mode', () => {
    render(
      <PopupProfilePanel
        {...baseProps}
        uiPreferences={{ ...baseProps.uiPreferences, uiMode: 'advanced' }}
      />,
    );

    expect(screen.getByText('Agent Cadence')).toBeInTheDocument();
  });
});
