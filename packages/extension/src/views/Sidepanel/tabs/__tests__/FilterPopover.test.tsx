import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilterPopover } from '../FilterPopover';

describe('FilterPopover', () => {
  const options = [
    { value: 'all', label: 'All' },
    { value: 'drafts', label: 'Drafts' },
    { value: 'shared', label: 'Shared' },
  ];

  it('renders the trigger button with the label', () => {
    render(<FilterPopover label="Status" options={options} value="all" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /status/i })).toBeInTheDocument();
  });

  it('does not show the menu initially', () => {
    render(<FilterPopover label="Status" options={options} value="all" onChange={vi.fn()} />);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens the menu on trigger click', async () => {
    const user = userEvent.setup();
    render(<FilterPopover label="Status" options={options} value="all" onChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /status/i }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
  });

  it('calls onChange and closes when an option is selected', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<FilterPopover label="Status" options={options} value="all" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /status/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Drafts' }));

    expect(onChange).toHaveBeenCalledWith('drafts');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('marks the current value as active', async () => {
    const user = userEvent.setup();
    render(<FilterPopover label="Status" options={options} value="drafts" onChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /status/i }));

    const draftItem = screen.getByRole('menuitem', { name: 'Drafts' });
    expect(draftItem).toHaveAttribute('aria-checked', 'true');
  });

  it('closes on Escape key', async () => {
    const user = userEvent.setup();
    render(<FilterPopover label="Status" options={options} value="all" onChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /status/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on outside click', async () => {
    render(
      <div>
        <span data-testid="outside">outside</span>
        <FilterPopover label="Status" options={options} value="all" onChange={vi.fn()} />
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: /status/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('outside'));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('shows active indicator on trigger when value is not default', () => {
    render(
      <FilterPopover
        label="Status"
        options={options}
        value="drafts"
        defaultValue="all"
        onChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: /status/i });
    expect(trigger.classList.contains('is-filtered')).toBe(true);
  });

  it('does not show active indicator when value equals default', () => {
    render(
      <FilterPopover
        label="Status"
        options={options}
        value="all"
        defaultValue="all"
        onChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: /status/i });
    expect(trigger.classList.contains('is-filtered')).toBe(false);
  });
});
