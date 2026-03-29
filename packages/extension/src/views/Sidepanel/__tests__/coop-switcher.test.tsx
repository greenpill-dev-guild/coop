import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CoopFilterPill } from '../CoopSwitcher';

describe('CoopFilterPill', () => {
  it('renders nothing when no coops are available', () => {
    const { container } = render(
      <CoopFilterPill coops={[]} activeCoopId={undefined} onFilter={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders a static pill when only one coop exists', () => {
    render(
      <CoopFilterPill
        coops={[{ id: 'coop-1', name: 'River Coop' }]}
        activeCoopId="coop-1"
        onFilter={vi.fn()}
      />,
    );

    expect(screen.getByText('River Coop')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('opens the menu, filters by coop, and closes on escape/outside clicks', async () => {
    const user = userEvent.setup();
    const onFilter = vi.fn();

    render(
      <CoopFilterPill
        coops={[
          { id: 'coop-1', name: 'River Coop' },
          { id: 'coop-2', name: 'Soil Coop' },
        ]}
        activeCoopId="coop-1"
        onFilter={onFilter}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'River Coop ▾' }));
    expect(screen.getByRole('menu', { name: 'Filter by coop' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu', { name: 'Filter by coop' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'River Coop ▾' }));
    await user.click(screen.getByRole('menuitem', { name: 'All coops' }));
    expect(onFilter).toHaveBeenCalledWith(null);

    await user.click(screen.getByRole('button', { name: 'River Coop ▾' }));
    await user.click(screen.getByRole('menuitem', { name: 'Soil Coop' }));
    expect(onFilter).toHaveBeenCalledWith('coop-2');

    await user.click(screen.getByRole('button', { name: 'River Coop ▾' }));
    await user.click(document.body);
    expect(screen.queryByRole('menu', { name: 'Filter by coop' })).not.toBeInTheDocument();
  });
});
