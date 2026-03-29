import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePopupOverlayFocusTrap } from '../usePopupOverlayFocusTrap';

function FocusTrapHarness(props: {
  includeActions?: boolean;
  onClose?: () => void;
}) {
  const { includeActions = true, onClose } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLButtonElement>(null);

  usePopupOverlayFocusTrap({
    containerRef,
    initialFocusRef,
    onClose,
  });

  return (
    <>
      <div className="popup-surface" data-testid="surface">
        <button type="button">Surface button</button>
      </div>
      <div data-testid="overlay" ref={containerRef} tabIndex={-1}>
        {includeActions ? (
          <>
            <button ref={initialFocusRef} type="button">
              First action
            </button>
            <button type="button">Last action</button>
          </>
        ) : null}
      </div>
    </>
  );
}

describe('usePopupOverlayFocusTrap', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('moves focus to the initial target and restores popup-surface attributes on cleanup', () => {
    const previousFocus = document.createElement('button');
    previousFocus.textContent = 'Previous focus';
    document.body.append(previousFocus);
    previousFocus.focus();

    const { unmount } = render(<FocusTrapHarness />);

    const surface = screen.getByTestId('surface');
    expect(screen.getByRole('button', { name: 'First action' })).toHaveFocus();
    expect(surface).toHaveAttribute('aria-hidden', 'true');
    expect(surface).toHaveAttribute('inert');

    unmount();

    expect(previousFocus).toHaveFocus();
    expect(surface).not.toHaveAttribute('aria-hidden');
    expect(surface).not.toHaveAttribute('inert');
  });

  it('wraps focus from the last action back to the first action on Tab', () => {
    render(<FocusTrapHarness />);

    screen.getByRole('button', { name: 'Last action' }).focus();
    fireEvent.keyDown(window, { key: 'Tab' });

    expect(screen.getByRole('button', { name: 'First action' })).toHaveFocus();
  });

  it('wraps focus from the first action to the last action on Shift+Tab', () => {
    render(<FocusTrapHarness />);

    screen.getByRole('button', { name: 'First action' }).focus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });

    expect(screen.getByRole('button', { name: 'Last action' })).toHaveFocus();
  });

  it('focuses the container when the overlay has no focusable children', () => {
    render(<FocusTrapHarness includeActions={false} />);

    fireEvent.keyDown(window, { key: 'Tab' });

    expect(screen.getByTestId('overlay')).toHaveFocus();
  });

  it('invokes onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<FocusTrapHarness onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
