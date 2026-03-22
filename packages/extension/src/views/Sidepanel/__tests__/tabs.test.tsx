import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContributeTab } from '../tabs';

describe('ContributeTab', () => {
  it('renders stub cards with coming-soon badges', () => {
    render(<ContributeTab activeCoop={undefined} activeMember={undefined} copyText={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Impact Reporting' })).toBeVisible();
    expect(screen.getByRole('heading', { name: /capital & payouts/i })).toBeVisible();
    const comingSoonBadges = screen.getAllByText('Coming soon');
    expect(comingSoonBadges.length).toBe(2);

    // Disabled buttons
    const reportButton = screen.getByRole('button', { name: /report impact/i });
    expect(reportButton).toBeDisabled();
    const allocButton = screen.getByRole('button', { name: /view allocations/i });
    expect(allocButton).toBeDisabled();
  });

  it('does not render pair-a-device (moved to header)', () => {
    render(<ContributeTab activeCoop={undefined} activeMember={undefined} copyText={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /pair a device/i })).not.toBeInTheDocument();
  });

  it('shows garden activities card when greenGoods is enabled', () => {
    render(
      <ContributeTab
        activeCoop={
          {
            profile: { id: 'coop-1', name: 'Test' },
            greenGoods: {
              enabled: true,
              gardenAddress: '0x1234567890abcdef1234567890abcdef12345678',
            },
            onchainState: { chainKey: 'sepolia' },
          } as never
        }
        activeMember={undefined}
        copyText={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Garden Activities' })).toBeVisible();
    expect(screen.getByText(/garden:/i)).toBeVisible();
  });

  it('hides garden activities card when greenGoods is not enabled', () => {
    render(
      <ContributeTab
        activeCoop={
          {
            profile: { id: 'coop-1', name: 'Test' },
            greenGoods: { enabled: false },
          } as never
        }
        activeMember={undefined}
        copyText={vi.fn()}
      />,
    );

    expect(screen.queryByRole('heading', { name: 'Garden Activities' })).toBeNull();
  });
});
