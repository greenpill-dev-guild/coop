import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingOverlay, onboardingSteps } from '../OnboardingOverlay';

describe('OnboardingOverlay', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('has exactly 3 onboarding steps', () => {
    expect(onboardingSteps).toHaveLength(3);
  });

  it('covers Chickens, Roost, and Feed tabs', () => {
    const tabs = onboardingSteps.map((s) => s.tab);
    expect(tabs).toEqual(['Chickens', 'Roost', 'Feed']);
  });

  it('renders step 0 content when shown', () => {
    render(<OnboardingOverlay step={0} onAdvance={() => {}} onDismiss={() => {}} />);
    expect(screen.getByRole('dialog', { name: /welcome to coop/i })).toBeInTheDocument();
    expect(screen.getByText('Loose Chickens')).toBeInTheDocument();
    expect(
      screen.getByText(/watches your open tabs and catches the useful ones/),
    ).toBeInTheDocument();
  });

  it('renders step 1 content', () => {
    render(<OnboardingOverlay step={1} onAdvance={() => {}} onDismiss={() => {}} />);
    expect(screen.getByText('The Roost')).toBeInTheDocument();
    expect(screen.getByText(/tidy, and shape your catches into drafts/)).toBeInTheDocument();
  });

  it('renders step 2 content', () => {
    render(<OnboardingOverlay step={2} onAdvance={() => {}} onDismiss={() => {}} />);
    expect(screen.getByText('Coop Feed')).toBeInTheDocument();
    expect(screen.getByText(/good finds turn into shared opportunities/)).toBeInTheDocument();
  });

  it('shows "Next" button on non-final steps', () => {
    render(<OnboardingOverlay step={0} onAdvance={() => {}} onDismiss={() => {}} />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('shows "Skip" button on non-final steps', () => {
    render(<OnboardingOverlay step={0} onAdvance={() => {}} onDismiss={() => {}} />);
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
  });

  it('shows "Get started" button on the final step', () => {
    render(<OnboardingOverlay step={2} onAdvance={() => {}} onDismiss={() => {}} />);
    expect(screen.getByRole('button', { name: 'Get started' })).toBeInTheDocument();
  });

  it('does not show "Skip" button on the final step', () => {
    render(<OnboardingOverlay step={2} onAdvance={() => {}} onDismiss={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
  });

  it('calls onAdvance when "Next" is clicked', async () => {
    const user = userEvent.setup();
    const onAdvance = vi.fn();
    render(<OnboardingOverlay step={0} onAdvance={onAdvance} onDismiss={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onAdvance).toHaveBeenCalledOnce();
  });

  it('calls onDismiss when "Skip" is clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<OnboardingOverlay step={1} onAdvance={() => {}} onDismiss={onDismiss} />);
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('calls onAdvance when "Get started" is clicked on the final step', async () => {
    const user = userEvent.setup();
    const onAdvance = vi.fn();
    render(<OnboardingOverlay step={2} onAdvance={onAdvance} onDismiss={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Get started' }));
    expect(onAdvance).toHaveBeenCalledOnce();
  });

  it('renders the correct number of progress dots', () => {
    const { container } = render(
      <OnboardingOverlay step={1} onAdvance={() => {}} onDismiss={() => {}} />,
    );
    const dots = container.querySelectorAll('.onboarding-dot');
    expect(dots).toHaveLength(3);
  });

  it('marks the active dot and done dots correctly', () => {
    const { container } = render(
      <OnboardingOverlay step={1} onAdvance={() => {}} onDismiss={() => {}} />,
    );
    const dots = container.querySelectorAll('.onboarding-dot');
    expect(dots[0]).toHaveClass('is-done');
    expect(dots[1]).toHaveClass('is-active');
    expect(dots[2]).not.toHaveClass('is-active');
    expect(dots[2]).not.toHaveClass('is-done');
  });

  it('returns null when step is null', () => {
    const { container } = render(
      <OnboardingOverlay step={null} onAdvance={() => {}} onDismiss={() => {}} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('returns null when step is out of bounds', () => {
    const { container } = render(
      <OnboardingOverlay step={5} onAdvance={() => {}} onDismiss={() => {}} />,
    );
    expect(container.innerHTML).toBe('');
  });

  describe('focus management', () => {
    it('calls onDismiss when Escape key is pressed', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(<OnboardingOverlay step={0} onAdvance={() => {}} onDismiss={onDismiss} />);
      await user.keyboard('{Escape}');
      expect(onDismiss).toHaveBeenCalledOnce();
    });

    it('auto-focuses the primary action button on mount', () => {
      render(<OnboardingOverlay step={0} onAdvance={() => {}} onDismiss={() => {}} />);
      expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
    });

    it('sets inert on sibling content when open', () => {
      // Render the overlay alongside sibling elements, mimicking sidepanel-shell structure
      const { container } = render(
        <div className="sidepanel-shell">
          <OnboardingOverlay step={0} onAdvance={() => {}} onDismiss={() => {}} />
          <header className="panel-header">Header</header>
          <main className="content-shell">Main</main>
        </div>,
      );

      const shell = container.querySelector('.sidepanel-shell');
      const siblingHeader = shell?.querySelector('.panel-header');
      const siblingMain = shell?.querySelector('.content-shell');

      expect(siblingHeader?.getAttribute('inert')).toBe('');
      expect(siblingMain?.getAttribute('inert')).toBe('');
    });

    it('removes inert from siblings when unmounted', () => {
      const { container, rerender } = render(
        <div className="sidepanel-shell">
          <OnboardingOverlay step={0} onAdvance={() => {}} onDismiss={() => {}} />
          <header className="panel-header">Header</header>
        </div>,
      );

      const shell = container.querySelector('.sidepanel-shell');
      const siblingHeader = shell?.querySelector('.panel-header');

      expect(siblingHeader?.getAttribute('inert')).toBe('');

      // Rerender with step=null so the overlay unmounts and cleans up inert
      rerender(
        <div className="sidepanel-shell">
          <OnboardingOverlay step={null} onAdvance={() => {}} onDismiss={() => {}} />
          <header className="panel-header">Header</header>
        </div>,
      );

      expect(siblingHeader.hasAttribute('inert')).toBe(false);
    });
  });
});
