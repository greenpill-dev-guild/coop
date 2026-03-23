import type { CoopSharedState } from '@coop/shared';

interface TabCoopSelectorProps {
  allCoops: CoopSharedState[];
  activeCoop: CoopSharedState | undefined;
  onSelect: (coopId: string) => void;
}

export function TabCoopSelector({ allCoops, activeCoop, onSelect }: TabCoopSelectorProps) {
  if (allCoops.length === 0) return null;

  // Single coop — just show the name, no selector needed
  if (allCoops.length === 1) {
    return (
      <div className="tab-coop-selector">
        <span className="tab-coop-selector__label">{allCoops[0].profile.name}</span>
      </div>
    );
  }

  return (
    <div className="tab-coop-selector">
      {allCoops.map((coop) => {
        const isActive = coop.profile.id === activeCoop?.profile.id;
        return (
          <button
            key={coop.profile.id}
            className={`tab-coop-selector__pill${isActive ? ' is-active' : ''}`}
            onClick={() => onSelect(coop.profile.id)}
            type="button"
          >
            {coop.profile.name}
          </button>
        );
      })}
    </div>
  );
}
