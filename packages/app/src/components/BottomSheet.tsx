import { type ReactNode, useCallback, useEffect, useRef } from 'react';

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragDeltaY = useRef(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragDeltaY.current = 0;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy > 0) {
      dragDeltaY.current = dy;
      const content = contentRef.current;
      if (content) content.style.transform = `translateY(${dy}px)`;
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    const content = contentRef.current;
    if (content) content.style.transform = '';
    const sheetHeight = contentRef.current?.offsetHeight ?? 0;
    if (sheetHeight > 0 && dragDeltaY.current > sheetHeight * 0.3) {
      onClose();
    }
    dragStartY.current = null;
    dragDeltaY.current = 0;
  }, [onClose]);

  return (
    <dialog
      className="bottom-sheet"
      ref={dialogRef}
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div
        className="bottom-sheet-content"
        ref={contentRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="bottom-sheet-handle" aria-hidden="true" />
        {title ? <h2 className="bottom-sheet-title">{title}</h2> : null}
        <div className="bottom-sheet-body">{children}</div>
      </div>
    </dialog>
  );
}
