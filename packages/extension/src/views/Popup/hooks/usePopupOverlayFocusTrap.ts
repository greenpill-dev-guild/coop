import { useEffect, type RefObject } from 'react';

const focusableSelector =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function usePopupOverlayFocusTrap(input: {
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onClose?: () => void;
}) {
  const { containerRef, initialFocusRef, onClose } = input;

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const surface = document.querySelector<HTMLElement>('.popup-surface');
    const hadAriaHidden = surface?.getAttribute('aria-hidden');
    const hadInert = surface?.hasAttribute('inert') ?? false;

    if (surface) {
      surface.setAttribute('aria-hidden', 'true');
      surface.setAttribute('inert', '');
    }

    function getFocusableElements() {
      if (!containerRef.current) {
        return [] as HTMLElement[];
      }

      return Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      );
    }

    const initialTarget =
      initialFocusRef?.current ?? getFocusableElements()[0] ?? containerRef.current;
    initialTarget?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && onClose) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        containerRef.current?.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (!activeElement || !containerRef.current?.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
        return;
      }

      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last?.focus();
        return;
      }

      if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);

      if (surface) {
        if (hadAriaHidden === null) {
          surface.removeAttribute('aria-hidden');
        } else {
          surface.setAttribute('aria-hidden', hadAriaHidden);
        }

        if (!hadInert) {
          surface.removeAttribute('inert');
        }
      }

      previousFocus?.focus();
    };
  }, [containerRef, initialFocusRef, onClose]);
}
