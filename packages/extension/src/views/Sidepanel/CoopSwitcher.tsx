import { useEffect, useRef, useState } from 'react';
import type { CoopBadgeSummary } from '../../runtime/messages';

interface CoopSwitcherProps {
  coops: { id: string; name: string }[];
  activeCoopId: string | undefined;
  coopBadges: CoopBadgeSummary[];
  onSwitch: (coopId: string) => void | Promise<void>;
}

export function CoopSwitcher({ coops, activeCoopId, coopBadges, onSwitch }: CoopSwitcherProps) {
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

  // 0 coops: render nothing
  if (coops.length === 0) return null;

  const activeCoop = coops.find((c) => c.id === activeCoopId) ?? coops[0];
  const badgeMap = new Map(coopBadges.map((b) => [b.coopId, b]));
  const otherCoopsWithActivity = coops.filter((coop) => {
    if (coop.id === activeCoop.id) {
      return false;
    }
    const badge = badgeMap.get(coop.id);
    return (badge?.pendingAttentionCount ?? 0) > 0;
  });
  const hasOtherCoopActivity = otherCoopsWithActivity.length > 0;

  // 1 coop: static label
  if (coops.length === 1) {
    return (
      <div className="coop-switcher">
        <span className="coop-switcher__label">{activeCoop.name}</span>
      </div>
    );
  }

  // 2+ coops: pill trigger + dropdown
  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  function handleSelect(coopId: string) {
    void onSwitch(coopId);
    setOpen(false);
  }

  return (
    <div className="coop-switcher" ref={ref} onKeyDown={handleKeyDown}>
      <button
        className={`coop-switcher__trigger${hasOtherCoopActivity ? ' has-activity' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        title={
          hasOtherCoopActivity
            ? `${otherCoopsWithActivity.length} other coop${otherCoopsWithActivity.length === 1 ? '' : 's'} has roundup waiting.`
            : undefined
        }
      >
        <span className="coop-switcher__trigger-label">{activeCoop.name}</span>
        {hasOtherCoopActivity ? (
          <span className="coop-switcher__trigger-indicator" aria-hidden="true" />
        ) : null}
        <span className="coop-switcher__caret" aria-hidden="true">
          {open ? '\u25B4' : '\u25BE'}
        </span>
      </button>
      {open ? (
        <div className="coop-switcher__menu" role="menu" tabIndex={-1} aria-label="Switch coop">
          {coops.map((coop) => {
            const badge = badgeMap.get(coop.id);
            const isActive = coop.id === activeCoopId;
            const hasActivity = (badge?.pendingAttentionCount ?? 0) > 0;
            return (
              <div key={coop.id} role="menuitem" tabIndex={0} aria-current={isActive || undefined}>
                <button
                  className={`coop-switcher__option${isActive ? ' is-active' : ''}`}
                  onClick={() => handleSelect(coop.id)}
                  type="button"
                >
                  <span className="coop-switcher__name-row">
                    {hasActivity ? (
                      <span className="coop-switcher__status-dot" aria-hidden="true" />
                    ) : null}
                    <span className="coop-switcher__name">{coop.name}</span>
                  </span>
                  {badge ? (
                    <span className="coop-switcher__badges">
                      {badge.pendingDrafts > 0 ? (
                        <span className="coop-switcher__badge">{badge.pendingDrafts} drafts</span>
                      ) : null}
                      {badge.routedTabs > 0 ? (
                        <span className="coop-switcher__badge">{badge.routedTabs} routes</span>
                      ) : null}
                      {badge.insightDrafts > 0 ? (
                        <span className="coop-switcher__badge">{badge.insightDrafts} insights</span>
                      ) : null}
                      {badge.pendingActions > 0 ? (
                        <span className="coop-switcher__badge">{badge.pendingActions} actions</span>
                      ) : null}
                    </span>
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
