import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type TooltipPlacement = 'above' | 'below';

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function Tooltip(props: {
  content: string;
  align?: 'start' | 'center' | 'end';
  /** Preferred placement — auto-flips when there isn't enough space. */
  placement?: TooltipPlacement;
  children: (input: { targetProps: HTMLAttributes<HTMLElement> }) => ReactNode;
}) {
  const { content, align = 'center', placement: preferPlacement = 'above', children } = props;
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [placement, setPlacement] = useState<TooltipPlacement>('above');
  const [bubbleStyle, setBubbleStyle] = useState<CSSProperties | null>(null);
  const tooltipId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setHost(document.querySelector<HTMLElement>('[data-tooltip-root]'));
  }, []);

  const updatePosition = useCallback(() => {
    if (!open || !host || !wrapperRef.current || !bubbleRef.current) {
      setBubbleStyle(null);
      return;
    }

    const gap = 8;
    const inset = 4;
    const hostRect = host.getBoundingClientRect();
    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    const bubbleRect = bubbleRef.current.getBoundingClientRect();
    const maxLeft = Math.max(inset, hostRect.width - bubbleRect.width - inset);
    const maxTop = Math.max(inset, hostRect.height - bubbleRect.height - inset);

    const alignedLeft =
      align === 'start'
        ? wrapperRect.left - hostRect.left
        : align === 'end'
          ? wrapperRect.right - hostRect.left - bubbleRect.width
          : wrapperRect.left - hostRect.left + wrapperRect.width / 2 - bubbleRect.width / 2;
    const left = clamp(alignedLeft, inset, maxLeft);

    const aboveTop = wrapperRect.top - hostRect.top - bubbleRect.height - gap;
    const belowTop = wrapperRect.bottom - hostRect.top + gap;
    const aboveFits = aboveTop >= inset;
    const belowFits = belowTop + bubbleRect.height <= hostRect.height - inset;

    const nextPlacement: TooltipPlacement =
      preferPlacement === 'below' ? (belowFits ? 'below' : 'above') : aboveFits ? 'above' : 'below';
    const rawTop = nextPlacement === 'above' ? aboveTop : belowTop;
    const top = clamp(rawTop, inset, maxTop);

    setPlacement(nextPlacement);
    setBubbleStyle({
      left,
      top,
    });
  }, [align, host, open, preferPlacement]);

  // content and open are intentionally included: updatePosition is stable but must re-fire when tooltip content or visibility changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: content/open trigger repositioning on change
  useLayoutEffect(() => {
    updatePosition();
  }, [content, open, updatePosition]);

  useEffect(() => {
    if (!open || !host) {
      return;
    }

    const update = () => {
      updatePosition();
    };

    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [host, open, updatePosition]);

  return (
    <div
      className={`coop-tooltip coop-tooltip--${align}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      ref={wrapperRef}
    >
      {children({
        targetProps: {
          'aria-describedby': open ? tooltipId : undefined,
          onBlur: (event) => {
            if (wrapperRef.current?.contains(event.relatedTarget as Node | null)) {
              return;
            }
            setOpen(false);
          },
          onFocus: () => setOpen(true),
          onKeyDown: (event) => {
            if (event.key === 'Escape') {
              setOpen(false);
            }
          },
        },
      })}
      {open && host
        ? createPortal(
            <span
              className={`coop-tooltip__bubble coop-tooltip__bubble--${placement} is-open`}
              id={tooltipId}
              ref={bubbleRef}
              role="tooltip"
              style={bubbleStyle ?? { left: 0, top: 0, visibility: 'hidden' }}
            >
              {content}
            </span>,
            host,
          )
        : null}
    </div>
  );
}
