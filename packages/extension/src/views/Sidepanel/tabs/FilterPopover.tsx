import { useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterPopoverProps {
  /** Label shown on the trigger button (also used for aria-label). */
  label: string;
  options: FilterOption[];
  value: string;
  /** The "neutral" value (used to determine whether trigger shows active indicator). */
  defaultValue?: string;
  onChange: (value: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FilterPopover({
  label,
  options,
  value,
  defaultValue = 'all',
  onChange,
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const isFiltered = value !== defaultValue;

  return (
    <div className="filter-popover" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className={`filter-popover__trigger${isFiltered ? ' is-filtered' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        {label}
        <span className="filter-popover__chevron" aria-hidden="true">
          {open ? '\u25B4' : '\u25BE'}
        </span>
      </button>

      {open && (
        <div className="filter-popover__menu" role="menu">
          {options.map((option) => (
            <button
              aria-checked={option.value === value}
              className={`filter-popover__item${option.value === value ? ' is-active' : ''}`}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              role="menuitem"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
