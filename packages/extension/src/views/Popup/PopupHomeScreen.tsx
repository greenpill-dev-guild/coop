import { useState } from 'react';
import { PopupTooltip } from './PopupTooltip';
import type { PopupHomeQueueItem } from './popup-types';

function formatCategoryLabel(value: string) {
  return value
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function QueueThumbnail(props: { item: PopupHomeQueueItem }) {
  const { item } = props;
  const [imageMissing, setImageMissing] = useState(!item.previewImageUrl);

  if (item.previewImageUrl && !imageMissing) {
    return (
      <img
        alt=""
        className="popup-review-queue__thumb-image"
        onError={() => setImageMissing(true)}
        src={item.previewImageUrl}
      />
    );
  }

  return (
    <span aria-hidden="true" className="popup-review-queue__thumb-fallback">
      {item.title.charAt(0).toUpperCase()}
    </span>
  );
}

export function PopupHomeScreen(props: {
  draftCount: number;
  lastCaptureLabel: string;
  syncLabel: string;
  syncDetail: string;
  syncTone: 'ok' | 'warning' | 'error';
  reviewQueue: PopupHomeQueueItem[];
  onPrimaryAction: () => void;
  primaryActionLabel: string;
  onCaptureTab: () => void;
  onOpenDrafts: () => void;
  onOpenDraft: (draftId: string) => void;
}) {
  const {
    draftCount,
    lastCaptureLabel,
    syncLabel,
    syncDetail,
    syncTone,
    reviewQueue,
    onPrimaryAction,
    primaryActionLabel,
    onCaptureTab,
    onOpenDrafts,
    onOpenDraft,
  } = props;

  return (
    <section className="popup-screen">
      <div className="popup-stat-grid" aria-label="Quick status">
        <div className="popup-stat">
          <span>Drafts</span>
          <strong>{draftCount}</strong>
        </div>
        <div className="popup-stat">
          <span>Last roundup</span>
          <strong>{lastCaptureLabel}</strong>
        </div>
        <PopupTooltip content={syncDetail}>
          {({ targetProps }) => (
            <div
              {...targetProps}
              className={`popup-stat popup-stat--interactive popup-stat--tone-${syncTone}`}
              tabIndex={0}
            >
              <span>Sync</span>
              <strong>{syncLabel}</strong>
            </div>
          )}
        </PopupTooltip>
      </div>

      <div className="popup-stack">
        <button className="popup-primary-action" onClick={onPrimaryAction} type="button">
          {primaryActionLabel}
        </button>
        <button className="popup-secondary-action" onClick={onCaptureTab} type="button">
          Capture this tab
        </button>
      </div>

      <section className="popup-list-section">
        <div className="popup-section-heading">
          <strong>Review queue</strong>
          {draftCount > 0 ? (
            <button className="popup-text-button" onClick={onOpenDrafts} type="button">
              See all
            </button>
          ) : null}
        </div>
        {reviewQueue.length > 0 ? (
          <ul className="popup-list-reset popup-review-queue">
            {reviewQueue.map((item) => (
              <li key={item.id}>
                <button
                  className="popup-review-queue__card"
                  onClick={() => onOpenDraft(item.id)}
                  type="button"
                >
                  <span className="popup-review-queue__thumb">
                    <QueueThumbnail item={item} />
                  </span>
                  <span className="popup-review-queue__body">
                    <strong>{item.title}</strong>
                    <span className="popup-review-queue__summary">{item.summary}</span>
                    <span className="popup-review-queue__pills">
                      <span className="popup-mini-pill">
                        {formatCategoryLabel(item.category)}
                      </span>
                      <span className="popup-mini-pill popup-mini-pill--muted">{item.coopLabel}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="popup-empty-state">
            Nothing is waiting for review right now. Round up a tab to start a fresh queue.
          </p>
        )}
      </section>
    </section>
  );
}
