import type { HTMLAttributes, ReactNode } from 'react';
import { useId, useRef, useState } from 'react';

export function PopupTooltip(props: {
  content: string;
  align?: 'start' | 'center' | 'end';
  children: (input: { targetProps: HTMLAttributes<HTMLElement> }) => ReactNode;
}) {
  const { content, align = 'center', children } = props;
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      className={`popup-tooltip popup-tooltip--${align}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      ref={ref}
    >
      {children({
        targetProps: {
          'aria-describedby': open ? tooltipId : undefined,
          onBlur: (event) => {
            if (ref.current?.contains(event.relatedTarget as Node | null)) {
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
      {open ? (
        <span
          className={`popup-tooltip__bubble popup-tooltip__bubble--${align} is-open`}
          id={tooltipId}
          role="tooltip"
        >
          {content}
        </span>
      ) : null}
    </div>
  );
}
