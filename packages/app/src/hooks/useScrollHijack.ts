import { useEffect } from 'react';

/**
 * Custom hook to hijack scroll behavior in a specific section
 * Slows down scroll for better control and presentation during demos
 *
 * @param elementRef - React ref to the element to hijack scroll on
 * @param enabled - Whether to enable the hijack
 * @param slowdownFactor - How much to slow scroll (1.5 = 1.5x slower, 2 = 2x slower)
 */
export function useScrollHijack(
  elementRef: React.RefObject<HTMLElement>,
  enabled = true,
  slowdownFactor = 1.8,
) {
  useEffect(() => {
    if (!enabled || !elementRef.current) return;

    const element = elementRef.current;
    const viewport = getViewport(element);
    const scrollContainer = getScrollContainer(element);

    if (!viewport || !scrollContainer) return;

    let isHijacking = false;
    let rafId = 0;
    let currentScroll = scrollContainer.scrollTop;
    let targetScroll = currentScroll;
    let velocity = 0;
    const friction = 0.92; // Momentum smoothing

    const onWheel = (e: WheelEvent) => {
      // Check if scrolling within our hijack zone
      const rect = element.getBoundingClientRect();
      const isInZone = e.clientY >= rect.top && e.clientY <= rect.bottom;

      if (!isInZone) return;

      e.preventDefault();
      isHijacking = true;

      // Calculate target based on wheel delta
      const delta = e.deltaY / slowdownFactor;
      targetScroll += delta;

      // Clamp to boundaries
      const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
      targetScroll = Math.max(0, Math.min(targetScroll, maxScroll));
    };

    const onTouchStart = () => {
      isHijacking = false;
      cancelAnimationFrame(rafId);
    };

    const animate = () => {
      const diff = targetScroll - currentScroll;
      velocity = diff * 0.1 + velocity * friction;
      currentScroll += velocity;

      if (Math.abs(velocity) > 0.1) {
        scrollContainer.scrollTop = currentScroll;
        rafId = requestAnimationFrame(animate);
      } else {
        scrollContainer.scrollTop = targetScroll;
      }
    };

    const startAnimation = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(animate);
    };

    // Handlers
    element.addEventListener('wheel', onWheel, { passive: false });
    element.addEventListener('touchstart', onTouchStart);
    scrollContainer.addEventListener('scroll', startAnimation);

    // Handle keyboard scrolling
    const onKeyDown = (e: KeyboardEvent) => {
      const rect = element.getBoundingClientRect();
      const isInZone =
        document.activeElement === element || element.contains(document.activeElement);

      if (!isInZone) return;

      let delta = 0;
      switch (e.key) {
        case 'ArrowDown':
          delta = 50 / slowdownFactor;
          e.preventDefault();
          break;
        case 'ArrowUp':
          delta = -50 / slowdownFactor;
          e.preventDefault();
          break;
        case 'PageDown':
          delta = 300 / slowdownFactor;
          e.preventDefault();
          break;
        case 'PageUp':
          delta = -300 / slowdownFactor;
          e.preventDefault();
          break;
        default:
          return;
      }

      targetScroll += delta;
      const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
      targetScroll = Math.max(0, Math.min(targetScroll, maxScroll));
      startAnimation();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('touchstart', onTouchStart);
      scrollContainer.removeEventListener('scroll', startAnimation);
      window.removeEventListener('keydown', onKeyDown);
      cancelAnimationFrame(rafId);
    };
  }, [enabled, slowdownFactor]);
}

function getViewport(element: HTMLElement): HTMLElement | null {
  return element.closest('[data-scroll-hijack-viewport]') || element;
}

function getScrollContainer(element: HTMLElement): HTMLElement {
  // Find the scrollable parent or window
  let current: HTMLElement | null = element;
  while (current) {
    const style = window.getComputedStyle(current);
    if (
      style.overflowY === 'auto' ||
      style.overflowY === 'scroll' ||
      current === document.documentElement
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return document.documentElement;
}
