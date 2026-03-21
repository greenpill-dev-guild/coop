import { useEffect, useRef, useState } from 'react';

interface CoopFilterPillProps {
  coops: { id: string; name: string }[];
  activeCoopId: string | undefined;
  onFilter: (coopId: string | null) => void;
}

export function CoopFilterPill({ coops, activeCoopId, onFilter }: CoopFilterPillProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (coops.length === 0) return null;

  const activeCoop = coops.find((c) => c.id === activeCoopId) ?? coops[0];

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  function handleSelect(coopId: string | null) {
    onFilter(coopId);
    setOpen(false);
  }

  // 1 coop: static pill label, no dropdown
  if (coops.length === 1) {
    return (
      <div className="coop-filter-pill">
        <span className="coop-filter-pill__trigger">{activeCoop.name}</span>
      </div>
    );
  }

  return (
    <div className="coop-filter-pill" ref={ref} onKeyDown={handleKeyDown}>
      <button
        className="coop-filter-pill__trigger"
        onClick={() => setOpen((prev) => !prev)}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {activeCoop.name} {open ? '\u25B4' : '\u25BE'}
      </button>
      {open ? (
        <div
          className="coop-filter-pill__menu"
          role="menu"
          tabIndex={-1}
          aria-label="Filter by coop"
        >
          <button
            className={`coop-filter-pill__option${!activeCoopId ? ' is-active' : ''}`}
            onClick={() => handleSelect(null)}
            role="menuitem"
            type="button"
          >
            All coops
          </button>
          {coops.map((coop) => (
            <button
              className={`coop-filter-pill__option${coop.id === activeCoopId ? ' is-active' : ''}`}
              key={coop.id}
              onClick={() => handleSelect(coop.id)}
              role="menuitem"
              type="button"
            >
              {coop.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Use CoopFilterPill instead */
export const CoopSwitcher = CoopFilterPill;
