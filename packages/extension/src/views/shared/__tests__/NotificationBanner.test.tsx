import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationBanner } from '../NotificationBanner';

describe('NotificationBanner', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renders the banner message', () => {
    render(<NotificationBanner id="test-1" message="3 chickens waiting for review." />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('3 chickens waiting for review.')).toBeInTheDocument();
  });

  it('hides after the dismiss button is clicked', () => {
    render(<NotificationBanner id="test-2" message="New items arrived." />);

    expect(screen.getByRole('status')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('does not persist dismissal when persistDismissal is false', () => {
    const { unmount } = render(
      <NotificationBanner id="test-2b" message="Transient toast." persistDismissal={false} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    unmount();

    render(<NotificationBanner id="test-2b" message="Transient toast." persistDismissal={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('Transient toast.');
  });

  it('stays hidden for the same id after dismissal (sessionStorage)', () => {
    const { unmount } = render(<NotificationBanner id="test-3" message="Should not reappear." />);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    unmount();

    render(<NotificationBanner id="test-3" message="Should not reappear." />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows an action button when onAction and actionLabel are provided', () => {
    const actionFn = vi.fn();
    render(
      <NotificationBanner
        id="test-4"
        message="Items need review."
        actionLabel="Review"
        onAction={actionFn}
      />,
    );

    const actionButton = screen.getByRole('button', { name: 'Review' });
    expect(actionButton).toBeInTheDocument();

    fireEvent.click(actionButton);
    expect(actionFn).toHaveBeenCalledTimes(1);
  });

  it('does not render an action button when only message is provided', () => {
    render(<NotificationBanner id="test-5" message="Just info." />);

    expect(screen.queryByRole('button', { name: 'Review' })).not.toBeInTheDocument();
    // Dismiss button should still be there
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('renders different banners independently', () => {
    render(
      <>
        <NotificationBanner id="banner-a" message="Banner A" />
        <NotificationBanner id="banner-b" message="Banner B" />
      </>,
    );

    expect(screen.getByText('Banner A')).toBeInTheDocument();
    expect(screen.getByText('Banner B')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[0]);

    expect(screen.queryByText('Banner A')).not.toBeInTheDocument();
    expect(screen.getByText('Banner B')).toBeInTheDocument();
  });

  it('calls onDismiss after the banner is dismissed', () => {
    const handleDismiss = vi.fn();
    render(
      <NotificationBanner id="banner-dismiss" message="Dismiss me" onDismiss={handleDismiss} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });
});
