import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BottomSheet } from '../components/BottomSheet';

describe('BottomSheet', () => {
  it('opens the dialog and renders the title when open is true', () => {
    render(
      <BottomSheet open onClose={vi.fn()} title="Receiver actions">
        <p>Sheet body</p>
      </BottomSheet>,
    );

    expect(screen.getByRole('dialog')).toHaveAttribute('open');
    expect(screen.getByRole('heading', { name: 'Receiver actions' })).toBeInTheDocument();
    expect(screen.getByText('Sheet body')).toBeInTheDocument();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose}>
        <p>Sheet body</p>
      </BottomSheet>,
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the user drags the sheet beyond the threshold', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose}>
        <p>Sheet body</p>
      </BottomSheet>,
    );

    const content = document.querySelector('.bottom-sheet-content') as HTMLDivElement;
    Object.defineProperty(content, 'offsetHeight', {
      configurable: true,
      value: 200,
    });

    fireEvent.touchStart(content, {
      touches: [{ clientY: 20 }],
    });
    fireEvent.touchMove(content, {
      touches: [{ clientY: 120 }],
    });

    expect(content.style.transform).toBe('translateY(100px)');

    fireEvent.touchEnd(content);

    expect(content.style.transform).toBe('');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when the drag distance stays below the dismissal threshold', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose}>
        <p>Sheet body</p>
      </BottomSheet>,
    );

    const content = document.querySelector('.bottom-sheet-content') as HTMLDivElement;
    Object.defineProperty(content, 'offsetHeight', {
      configurable: true,
      value: 200,
    });

    fireEvent.touchStart(content, {
      touches: [{ clientY: 20 }],
    });
    fireEvent.touchMove(content, {
      touches: [{ clientY: 60 }],
    });
    fireEvent.touchEnd(content);

    expect(onClose).not.toHaveBeenCalled();
  });
});
