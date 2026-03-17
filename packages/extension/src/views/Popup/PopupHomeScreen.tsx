import type { PopupActivityItem } from './popup-types';

export function PopupHomeScreen(props: {
  draftCount: number;
  lastCaptureLabel: string;
  syncLabel: string;
  recentItems: PopupActivityItem[];
  onPrimaryAction: () => void;
  primaryActionLabel: string;
  onCaptureTab: () => void;
  onOpenFeed: () => void;
  onOpenDrafts: () => void;
  onOpenSettings: () => void;
  onOpenWorkspace: () => void;
}) {
  const {
    draftCount,
    lastCaptureLabel,
    syncLabel,
    recentItems,
    onPrimaryAction,
    primaryActionLabel,
    onCaptureTab,
    onOpenFeed,
    onOpenDrafts,
    onOpenSettings,
    onOpenWorkspace,
  } = props;

  return (
    <section className="popup-screen">
      <div className="popup-stack">
        <button className="popup-primary-action" onClick={onPrimaryAction} type="button">
          {primaryActionLabel}
        </button>
        <div className="popup-split-actions">
          <button className="popup-secondary-action" onClick={onCaptureTab} type="button">
            Capture this tab
          </button>
          <button className="popup-secondary-action" onClick={onOpenFeed} type="button">
            Open feed
          </button>
        </div>
      </div>

      <div className="popup-stat-grid" aria-label="Quick status">
        <div className="popup-stat">
          <span>Drafts</span>
          <strong>{draftCount}</strong>
        </div>
        <div className="popup-stat">
          <span>Last capture</span>
          <strong>{lastCaptureLabel}</strong>
        </div>
        <div className="popup-stat">
          <span>Sync</span>
          <strong>{syncLabel}</strong>
        </div>
      </div>

      <section className="popup-list-section">
        <div className="popup-section-heading">
          <strong>Next up</strong>
          {draftCount > 0 ? (
            <button className="popup-text-button" onClick={onOpenDrafts} type="button">
              Review drafts
            </button>
          ) : null}
        </div>
        {recentItems.length > 0 ? (
          <ul className="popup-list-reset popup-activity-list">
            {recentItems.map((item) => (
              <li className="popup-activity-row" key={item.id}>
                <div className="popup-activity-row__copy">
                  <strong>{item.title}</strong>
                  <span>{item.meta}</span>
                </div>
                <span className="popup-mini-pill">{item.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="popup-empty-state">Nothing is waiting right now. Capture a tab to start.</p>
        )}
      </section>

      <div className="popup-inline-actions">
        <button className="popup-text-button" onClick={onOpenDrafts} type="button">
          Drafts
        </button>
        <button className="popup-text-button" onClick={onOpenSettings} type="button">
          Settings
        </button>
        <button className="popup-text-button" onClick={onOpenWorkspace} type="button">
          Open workspace
        </button>
      </div>
    </section>
  );
}
