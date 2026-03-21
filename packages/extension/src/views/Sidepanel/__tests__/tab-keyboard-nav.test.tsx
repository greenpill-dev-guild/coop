import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SidepanelFooterNav } from '../TabStrip';

describe('SidepanelFooterNav', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders with aria-label for navigation', () => {
    render(
      <SidepanelFooterNav
        activeTab="chickens"
        onNavigate={() => {}}
        showManageTab={false}
        badges={{}}
      />,
    );
    const nav = screen.getByRole('navigation', { name: /sidepanel navigation/i });
    expect(nav).toBeInTheDocument();
  });

  it('renders 3 buttons when showManageTab is false', () => {
    render(
      <SidepanelFooterNav
        activeTab="chickens"
        onNavigate={() => {}}
        showManageTab={false}
        badges={{}}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
  });

  it('renders 4 buttons when showManageTab is true', () => {
    render(
      <SidepanelFooterNav
        activeTab="chickens"
        onNavigate={() => {}}
        showManageTab={true}
        badges={{}}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);
  });

  it('marks the active tab button with aria-current="page"', () => {
    render(
      <SidepanelFooterNav
        activeTab="feed"
        onNavigate={() => {}}
        showManageTab={true}
        badges={{}}
      />,
    );
    const feedButton = screen.getByRole('button', { name: /feed/i });
    expect(feedButton).toHaveAttribute('aria-current', 'page');

    const chickensButton = screen.getByRole('button', { name: /chickens/i });
    expect(chickensButton).not.toHaveAttribute('aria-current');
  });

  it('calls onNavigate when a tab button is clicked', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(
      <SidepanelFooterNav
        activeTab="chickens"
        onNavigate={onNavigate}
        showManageTab={true}
        badges={{}}
      />,
    );

    await user.click(screen.getByRole('button', { name: /feed/i }));
    expect(onNavigate).toHaveBeenCalledWith('feed');
  });

  it('shows badge count when provided', () => {
    render(
      <SidepanelFooterNav
        activeTab="chickens"
        onNavigate={() => {}}
        showManageTab={false}
        badges={{ chickens: 5 }}
      />,
    );
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('does not show badge when count is 0', () => {
    render(
      <SidepanelFooterNav
        activeTab="chickens"
        onNavigate={() => {}}
        showManageTab={false}
        badges={{ chickens: 0 }}
      />,
    );
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('caps badge display at 99+', () => {
    render(
      <SidepanelFooterNav
        activeTab="chickens"
        onNavigate={() => {}}
        showManageTab={false}
        badges={{ chickens: 150 }}
      />,
    );
    expect(screen.getByText('99+')).toBeInTheDocument();
  });
});
