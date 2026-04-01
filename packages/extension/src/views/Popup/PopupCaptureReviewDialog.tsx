import { useRef } from 'react';
import { Tooltip } from '../shared/Tooltip';
import { usePopupOverlayFocusTrap } from './hooks/usePopupOverlayFocusTrap';
import type { PopupPendingCapture } from './popup-types';

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

function FileIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20" width="32" height="32">
      <path
        d="M11.5 2H5.5a1.5 1.5 0 0 0-1.5 1.5v13a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5V6.5L11.5 2Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
      <path
        d="M11.5 2v4.5H16M13 11H7M13 14H7M8.5 8H7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function formatBytes(byteSize: number) {
  if (byteSize < 1024) {
    return `${byteSize} B`;
  }
  if (byteSize < 1024 * 1024) {
    return `${(byteSize / 1024).toFixed(1)} KB`;
  }
  return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(durationSeconds?: number) {
  if (durationSeconds == null) {
    return null;
  }

  const total = Math.floor(durationSeconds);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function labelForKind(kind: PopupPendingCapture['kind']) {
  if (kind === 'photo') return 'Screenshot';
  if (kind === 'audio') return 'Voice note';
  return 'File';
}

function isImageMime(mimeType: string) {
  return mimeType.startsWith('image/');
}

function isAudioMime(mimeType: string) {
  return mimeType.startsWith('audio/');
}

function fileExtension(fileName?: string) {
  if (!fileName) return null;
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot + 1).toUpperCase() : null;
}

export function PopupCaptureReviewDialog(props: {
  capture: PopupPendingCapture;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onChange: (patch: Partial<PopupPendingCapture>) => void;
}) {
  const { capture, onChange, onClose, onSave, saving } = props;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  usePopupOverlayFocusTrap({
    containerRef: dialogRef,
    initialFocusRef: closeButtonRef,
    onClose,
  });

  const durationLabel = formatDuration(capture.durationSeconds);
  const hasImagePreview = capture.previewUrl && isImageMime(capture.mimeType);
  const hasAudioPreview = capture.previewUrl && isAudioMime(capture.mimeType);
  const isNonImageFile =
    capture.kind === 'file' && !isImageMime(capture.mimeType) && !isAudioMime(capture.mimeType);
  const ext = fileExtension(capture.fileName);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click-to-dismiss is supplementary to the close button
    <div
      className="popup-dialog-backdrop"
      onClick={saving ? undefined : onClose}
      role="presentation"
    >
      <dialog
        aria-labelledby="popup-capture-review-title"
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
              <span className="popup-mini-pill popup-mini-pill--muted">
                {labelForKind(capture.kind)}
              </span>
              <span className="popup-mini-pill">{formatBytes(capture.byteSize)}</span>
              {durationLabel ? <span className="popup-mini-pill">{durationLabel}</span> : null}
            </div>
            <Tooltip align="end" content="Close">
              {({ targetProps }) => (
                <button
                  {...targetProps}
                  aria-label="Close capture review"
                  className="popup-icon-button popup-dialog__close"
                  disabled={saving}
                  onClick={onClose}
                  ref={closeButtonRef}
                  type="button"
                >
                  <CloseIcon />
                </button>
              )}
            </Tooltip>
          </div>
          <h2 id="popup-capture-review-title">Review before saving</h2>
        </div>

        <div className="popup-dialog__body">
          {hasImagePreview ? (
            <div className="popup-preview-card">
              <img
                alt="Capture preview"
                className="popup-preview-card__image"
                src={capture.previewUrl}
              />
            </div>
          ) : hasAudioPreview ? (
            <div className="popup-audio-preview">
              <div className="popup-audio-preview__copy">
                <strong>
                  {capture.kind === 'audio' ? 'Voice note ready' : 'Audio file ready'}
                </strong>
                <span>Play it back before saving.</span>
              </div>
              {/* biome-ignore lint/a11y/useMediaCaption: Local draft previews do not have captions at capture time. */}
              <audio
                aria-label="Capture audio preview"
                className="popup-audio-preview__player"
                controls
                preload="metadata"
                src={capture.previewUrl}
              />
            </div>
          ) : isNonImageFile ? (
            <div className="popup-file-summary">
              <FileIcon />
              <div className="popup-file-summary__info">
                <span className="popup-file-summary__name">{capture.fileName || 'File'}</span>
                <span className="popup-file-summary__meta">
                  {ext ? `${ext} · ` : ''}
                  {formatBytes(capture.byteSize)}
                </span>
              </div>
            </div>
          ) : null}

          <section className="popup-dialog__section">
            <label className="popup-dialog__field">
              <span>Title</span>
              <input
                disabled={saving}
                onChange={(event) => onChange({ title: event.target.value })}
                type="text"
                value={capture.title}
              />
            </label>
            <label className="popup-dialog__field">
              <span>Context</span>
              <textarea
                disabled={saving}
                onChange={(event) => onChange({ note: event.target.value })}
                placeholder="What should Coop remember about this?"
                rows={3}
                value={capture.note}
              />
            </label>
          </section>

          {capture.fileName || capture.sourceUrl ? (
            <section className="popup-dialog__section">
              <strong>Details</strong>
              <div className="popup-dialog__meta">
                {capture.fileName ? (
                  <span className="popup-mini-pill popup-mini-pill--muted popup-mini-pill--wrap">
                    {capture.fileName}
                  </span>
                ) : null}
                {capture.sourceUrl ? (
                  <a href={capture.sourceUrl} rel="noreferrer" target="_blank">
                    Source page
                  </a>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>

        <div className="popup-dialog__footer">
          <button
            className="popup-secondary-action"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="popup-primary-action popup-primary-action--small"
            disabled={saving || !capture.title.trim()}
            onClick={onSave}
            type="button"
          >
            {saving ? 'Saving…' : 'Save as draft'}
          </button>
        </div>
      </dialog>
    </div>
  );
}
