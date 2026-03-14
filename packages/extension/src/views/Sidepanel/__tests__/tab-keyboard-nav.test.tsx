import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TabStrip } from '../TabStrip';

const tabs = ['Chickens', 'Roost', 'Home', 'Feed'] as const;

describe('TabStrip WAI-ARIA keyboard navigation', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders with role="tablist" and aria-label', () => {
    render(<TabStrip tabs={tabs} activeTab="Home" onTabChange={() => {}} />);
    const tablist = screen.getByRole('tablist', { name: /sidepanel navigation/i });
    expect(tablist).toBeInTheDocument();
  });

  it('renders each tab button with role="tab"', () => {
    render(<TabStrip tabs={tabs} activeTab="Home" onTabChange={() => {}} />);
    const tabButtons = screen.getAllByRole('tab');
    expect(tabButtons).toHaveLength(4);
  });

  it('sets aria-selected=true only on the active tab', () => {
    render(<TabStrip tabs={tabs} activeTab="Roost" onTabChange={() => {}} />);
    const tabButtons = screen.getAllByRole('tab');
    expect(tabButtons[0]).toHaveAttribute('aria-selected', 'false');
    expect(tabButtons[1]).toHaveAttribute('aria-selected', 'true');
    expect(tabButtons[2]).toHaveAttribute('aria-selected', 'false');
    expect(tabButtons[3]).toHaveAttribute('aria-selected', 'false');
  });

  it('sets tabIndex=0 on active tab and tabIndex=-1 on others', () => {
    render(<TabStrip tabs={tabs} activeTab="Home" onTabChange={() => {}} />);
    const tabButtons = screen.getAllByRole('tab');
    expect(tabButtons[0]).toHaveAttribute('tabindex', '-1');
    expect(tabButtons[1]).toHaveAttribute('tabindex', '-1');
    expect(tabButtons[2]).toHaveAttribute('tabindex', '0');
    expect(tabButtons[3]).toHaveAttribute('tabindex', '-1');
  });

  it('assigns id and aria-controls on each tab button', () => {
    render(<TabStrip tabs={tabs} activeTab="Home" onTabChange={() => {}} />);
    const tabButtons = screen.getAllByRole('tab');
    for (let i = 0; i < tabs.length; i++) {
      expect(tabButtons[i]).toHaveAttribute('id', `tab-${tabs[i]}`);
      expect(tabButtons[i]).toHaveAttribute('aria-controls', `tabpanel-${tabs[i]}`);
    }
  });

  it('moves to next tab on ArrowRight', async () => {
    const onTabChange = vi.fn();
    const user = userEvent.setup();
    render(<TabStrip tabs={tabs} activeTab="Home" onTabChange={onTabChange} />);

    const homeTab = screen.getByRole('tab', { name: /home/i });
    homeTab.focus();
    await user.keyboard('{ArrowRight}');

    expect(onTabChange).toHaveBeenCalledWith('Feed');
  });

  it('moves to previous tab on ArrowLeft', async () => {
    const onTabChange = vi.fn();
    const user = userEvent.setup();
    render(<TabStrip tabs={tabs} activeTab="Home" onTabChange={onTabChange} />);

    const homeTab = screen.getByRole('tab', { name: /home/i });
    homeTab.focus();
    await user.keyboard('{ArrowLeft}');

    expect(onTabChange).toHaveBeenCalledWith('Roost');
  });

  it('wraps from last tab to first on ArrowRight', async () => {
    const onTabChange = vi.fn();
    const user = userEvent.setup();
    render(<TabStrip tabs={tabs} activeTab="Feed" onTabChange={onTabChange} />);

    const feedTab = screen.getByRole('tab', { name: /feed/i });
    feedTab.focus();
    await user.keyboard('{ArrowRight}');

    expect(onTabChange).toHaveBeenCalledWith('Chickens');
  });

  it('wraps from first tab to last on ArrowLeft', async () => {
    const onTabChange = vi.fn();
    const user = userEvent.setup();
    render(<TabStrip tabs={tabs} activeTab="Chickens" onTabChange={onTabChange} />);

    const chickensTab = screen.getByRole('tab', { name: /chickens/i });
    chickensTab.focus();
    await user.keyboard('{ArrowLeft}');

    expect(onTabChange).toHaveBeenCalledWith('Feed');
  });

  it('moves to first tab on Home key', async () => {
    const onTabChange = vi.fn();
    const user = userEvent.setup();
    render(<TabStrip tabs={tabs} activeTab="Feed" onTabChange={onTabChange} />);

    const feedTab = screen.getByRole('tab', { name: /feed/i });
    feedTab.focus();
    await user.keyboard('{Home}');

    expect(onTabChange).toHaveBeenCalledWith('Chickens');
  });

  it('moves to last tab on End key', async () => {
    const onTabChange = vi.fn();
    const user = userEvent.setup();
    render(<TabStrip tabs={tabs} activeTab="Chickens" onTabChange={onTabChange} />);

    const chickensTab = screen.getByRole('tab', { name: /chickens/i });
    chickensTab.focus();
    await user.keyboard('{End}');

    expect(onTabChange).toHaveBeenCalledWith('Feed');
  });

  it('does not call onTabChange for non-navigation keys', async () => {
    const onTabChange = vi.fn();
    const user = userEvent.setup();
    render(<TabStrip tabs={tabs} activeTab="Home" onTabChange={onTabChange} />);

    const homeTab = screen.getByRole('tab', { name: /home/i });
    homeTab.focus();
    await user.keyboard('a');

    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('focuses the new tab button after arrow key navigation', async () => {
    const onTabChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <TabStrip tabs={tabs} activeTab="Home" onTabChange={onTabChange} />,
    );

    const homeTab = screen.getByRole('tab', { name: /home/i });
    homeTab.focus();
    await user.keyboard('{ArrowRight}');

    // Simulate parent state update
    rerender(<TabStrip tabs={tabs} activeTab="Feed" onTabChange={onTabChange} />);

    const feedTab = screen.getByRole('tab', { name: /feed/i });
    expect(feedTab).toHaveFocus();
  });

  it('calls onTabChange when a tab button is clicked', async () => {
    const onTabChange = vi.fn();
    const user = userEvent.setup();
    render(<TabStrip tabs={tabs} activeTab="Home" onTabChange={onTabChange} />);

    await user.click(screen.getByRole('tab', { name: /roost/i }));
    expect(onTabChange).toHaveBeenCalledWith('Roost');
  });
});
