import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShareMenu, type ShareMenuProps } from '../ShareMenu';

function makeDefaultProps(overrides: Partial<ShareMenuProps> = {}): ShareMenuProps {
  return {
    url: 'https://example.com/article',
    title: 'River restoration lead',
    summary: 'A rounded-up draft that still needs quick review.',
    onShareToFeed: vi.fn(),
    ...overrides,
  };
}

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
    writable: true,
  });
  return writeText;
}

function mockNativeShare(enabled: boolean) {
  const shareFn = enabled ? vi.fn().mockResolvedValue(undefined) : undefined;
  Object.defineProperty(navigator, 'share', {
    value: shareFn,
    configurable: true,
    writable: true,
  });
  return shareFn;
}

describe('ShareMenu', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a share button', () => {
    render(<ShareMenu {...makeDefaultProps()} />);
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
  });

  it('opens a menu on click with share options', async () => {
    const user = userEvent.setup();
    render(<ShareMenu {...makeDefaultProps()} />);

    await user.click(screen.getByRole('button', { name: /share/i }));

    expect(screen.getByRole('menuitem', { name: /copy link/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /share to feed/i })).toBeInTheDocument();
  });

  it('closes the menu on outside click', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <span data-testid="outside">outside</span>
        <ShareMenu {...makeDefaultProps()} />
      </div>,
    );

    await user.click(screen.getByRole('button', { name: /share/i }));
    expect(screen.getByRole('menuitem', { name: /copy link/i })).toBeInTheDocument();

    await user.click(screen.getByTestId('outside'));
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: /copy link/i })).not.toBeInTheDocument();
    });
  });

  it('copies the URL to clipboard on "Copy link"', async () => {
    const user = userEvent.setup();
    const writeText = mockClipboard();

    render(<ShareMenu {...makeDefaultProps()} />);

    await user.click(screen.getByRole('button', { name: /share/i }));
    await user.click(screen.getByRole('menuitem', { name: /copy link/i }));

    expect(writeText).toHaveBeenCalledWith('https://example.com/article');
  });

  it('calls onShareToFeed when "Share to feed" is clicked', async () => {
    const onShareToFeed = vi.fn();
    const user = userEvent.setup();

    render(<ShareMenu {...makeDefaultProps({ onShareToFeed })} />);

    await user.click(screen.getByRole('button', { name: /share/i }));
    await user.click(screen.getByRole('menuitem', { name: /share to feed/i }));

    expect(onShareToFeed).toHaveBeenCalledOnce();
  });

  it('shows native share option when navigator.share is available', async () => {
    const user = userEvent.setup();
    mockNativeShare(true);

    render(<ShareMenu {...makeDefaultProps()} />);

    await user.click(screen.getByRole('button', { name: /share/i }));
    expect(screen.getByRole('menuitem', { name: /share via/i })).toBeInTheDocument();

    // Clean up
    mockNativeShare(false);
  });

  it('hides native share option when navigator.share is unavailable', async () => {
    const user = userEvent.setup();
    mockNativeShare(false);

    render(<ShareMenu {...makeDefaultProps()} />);

    await user.click(screen.getByRole('button', { name: /share/i }));
    expect(screen.queryByRole('menuitem', { name: /share via/i })).not.toBeInTheDocument();
  });

  it('invokes navigator.share with title, text, and url', async () => {
    const user = userEvent.setup();
    const shareFn = mockNativeShare(true);

    render(<ShareMenu {...makeDefaultProps()} />);

    await user.click(screen.getByRole('button', { name: /share/i }));
    await user.click(screen.getByRole('menuitem', { name: /share via/i }));

    expect(shareFn).toHaveBeenCalledWith({
      title: 'River restoration lead',
      text: 'A rounded-up draft that still needs quick review.',
      url: 'https://example.com/article',
    });

    // Clean up
    mockNativeShare(false);
  });

  it('closes the menu after an action is performed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockClipboard();

    render(<ShareMenu {...makeDefaultProps()} />);

    await user.click(screen.getByRole('button', { name: /share/i }));
    await user.click(screen.getByRole('menuitem', { name: /copy link/i }));

    // Advance past the "Copied!" confirmation timeout
    vi.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: /copy link/i })).not.toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it('shows a brief "Copied!" confirmation after copying', async () => {
    const user = userEvent.setup();
    mockClipboard();

    render(<ShareMenu {...makeDefaultProps()} />);

    await user.click(screen.getByRole('button', { name: /share/i }));
    await user.click(screen.getByRole('menuitem', { name: /copy link/i }));

    expect(screen.getByText(/copied/i)).toBeInTheDocument();
  });
});
