import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ContributeTab } from '../tabs';

describe('ContributeTab', () => {
  it('renders stub cards with coming-soon badges', () => {
    render(
      <ContributeTab
        activeCoop={undefined}
        activeMember={undefined}
        createReceiverPairing={vi.fn()}
        copyText={vi.fn()}
      />,
    );

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

  it('renders the pair-a-device card with working button', async () => {
    const createPairing = vi.fn();
    const user = userEvent.setup();

    render(
      <ContributeTab
        activeCoop={undefined}
        activeMember={undefined}
        createReceiverPairing={createPairing}
        copyText={vi.fn()}
      />,
    );

    const pairButton = screen.getByRole('button', { name: /pair a device/i });
    expect(pairButton).toBeEnabled();
    await user.click(pairButton);
    expect(createPairing).toHaveBeenCalledTimes(1);
  });

  it('shows garden activities card when greenGoods is enabled', () => {
    render(
      <ContributeTab
        activeCoop={
          {
            profile: { id: 'coop-1', name: 'Test' },
            greenGoods: { enabled: true, gardenAddress: '0x123' },
          } as never
        }
        activeMember={undefined}
        createReceiverPairing={vi.fn()}
        copyText={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Garden Activities' })).toBeVisible();
    expect(screen.getByText(/garden: linked/i)).toBeVisible();
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
        createReceiverPairing={vi.fn()}
        copyText={vi.fn()}
      />,
    );

    expect(screen.queryByRole('heading', { name: 'Garden Activities' })).toBeNull();
  });
});
