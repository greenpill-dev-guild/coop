import { useCallback, useEffect, useRef, useState } from 'react';
import { Tooltip } from '../shared/Tooltip';
import { usePopupOverlayFocusTrap } from './hooks/usePopupOverlayFocusTrap';
import type { PopupFeedArtifactItem } from './popup-types';

function formatCategoryLabel(value: string) {
  return value
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function ShareArrowIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 16 16" width="14" height="14">
      <path
        d="M8 2v8M5 5l3-3 3 3M3 10v3h10v-3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="popup-theme-option__icon" fill="none" viewBox="0 0 20 20">
      <path
        d="M5 5l10 10M15 5 5 15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function PopupArtifactDialog(props: {
  artifact: PopupFeedArtifactItem;
  onClose: () => void;
  onOpenInSidepanel: () => void | Promise<void>;
}) {
  const { artifact, onClose, onOpenInSidepanel } = props;
  const [imageMissing, setImageMissing] = useState(!artifact.previewImageUrl);
  const [shareLabel, setShareLabel] = useState<'Share' | 'Copied!'>('Share');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const shareLabelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceLinks = artifact.sources.filter((source) => Boolean(source.url));

  useEffect(() => {
    return () => {
      if (shareLabelTimerRef.current) clearTimeout(shareLabelTimerRef.current);
    };
  }, []);

  const handleShare = useCallback(async () => {
    const url = artifact.sources[0]?.url;
    if (!url) return;

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: artifact.title, text: artifact.summary, url });
        return;
      } catch {
        // User cancelled or share failed -- fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareLabel('Copied!');
      shareLabelTimerRef.current = setTimeout(() => setShareLabel('Share'), 1500);
    } catch {
      // Clipboard API may fail silently in some contexts
    }
  }, [artifact.title, artifact.summary, artifact.sources]);

  usePopupOverlayFocusTrap({
    containerRef: dialogRef,
    initialFocusRef: closeButtonRef,
    onClose,
  });

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click-to-dismiss is supplementary to the close button
    <div className="popup-dialog-backdrop" onClick={onClose} role="presentation">
      <dialog
        aria-labelledby="popup-artifact-dialog-title"
        aria-modal="true"
        className="popup-dialog"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        open
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="popup-dialog__header">
          <div className="popup-dialog__header-bar">
            <div className="popup-review-queue__pills">
              <span className="popup-mini-pill popup-mini-pill--muted">{artifact.coopLabel}</span>
              <span className="popup-mini-pill">{formatCategoryLabel(artifact.category)}</span>
            </div>
            <Tooltip align="end" content="Close">
              {({ targetProps }) => (
                <button
                  {...targetProps}
                  aria-label="Close details"
                  className="popup-icon-button popup-dialog__close"
                  onClick={onClose}
                  ref={closeButtonRef}
                  type="button"
                >
                  <CloseIcon />
                </button>
              )}
            </Tooltip>
          </div>
          <h2 id="popup-artifact-dialog-title">{artifact.title}</h2>
        </div>

        <div className="popup-dialog__body">
          {artifact.previewImageUrl && !imageMissing ? (
            <div className="popup-preview-card">
              <img
                alt=""
                className="popup-preview-card__image"
                onError={() => setImageMissing(true)}
                src={artifact.previewImageUrl}
              />
            </div>
          ) : null}

          <section className="popup-dialog__section">
            <strong>Summary</strong>
            <p>{artifact.summary}</p>
          </section>

          <section className="popup-dialog__section">
            <strong>Why it matters</strong>
            <p>{artifact.whyItMatters}</p>
          </section>

          <section className="popup-dialog__section">
            <strong>Suggested next step</strong>
            <p>{artifact.suggestedNextStep}</p>
          </section>

          {sourceLinks.length > 0 ? (
            <section className="popup-dialog__section">
              <strong>Sources</strong>
              <ul className="popup-list-reset popup-dialog__sources">
                {sourceLinks.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} rel="noreferrer" target="_blank">
                      {source.label || source.domain}
                    </a>
                    <span>{source.domain}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="popup-dialog__footer">
          {artifact.sources[0]?.url ? (
            <button
              className="popup-primary-action popup-primary-action--small"
              onClick={() => void handleShare()}
              type="button"
            >
              <ShareArrowIcon /> {shareLabel}
            </button>
          ) : null}
          <button
            className="popup-primary-action popup-primary-action--small"
            onClick={() => void onOpenInSidepanel()}
            type="button"
          >
            Full view
          </button>
        </div>
      </dialog>
    </div>
  );
}
