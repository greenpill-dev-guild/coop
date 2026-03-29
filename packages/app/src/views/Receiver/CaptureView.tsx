import type { ReceiverCapture } from '@coop/shared';
import type { RefObject } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { SyncPill } from '../../components/SyncPill';
import { sizeLabel } from './format';
import type { CaptureCard } from './index';

type CaptureViewProps = {
  isRecording: boolean;
  newestCapture: ReceiverCapture | null;
  hatchedCaptureId: string | null;
  captures: CaptureCard[];
  pairingReady: boolean;
  canShare: boolean;
  photoInputRef: RefObject<HTMLInputElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onStartRecording: () => void;
  onFinishRecording: (action: 'save' | 'cancel') => void;
  onPickFile: (event: React.ChangeEvent<HTMLInputElement>, kind: 'photo' | 'file') => void;
  onShareCapture: (card: CaptureCard) => void;
  onNavigateInbox: () => void;
  onNavigatePair: () => void;
};

function receiverPreviewLabel(kind: ReceiverCapture['kind']) {
  switch (kind) {
    case 'audio':
      return 'Chick';
    case 'photo':
      return 'Feather';
    case 'file':
      return 'Twig';
    case 'link':
      return 'Trail';
  }
}

const CAPTURE_KIND_ACCENT: Record<ReceiverCapture['kind'], string> = {
  audio: 'accent-audio',
  photo: 'accent-photo',
  file: 'accent-file',
  link: 'accent-link',
};

function CameraIcon() {
  return (
    <svg
      aria-hidden="true"
      className="capture-action-icon"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg
      aria-hidden="true"
      className="capture-action-icon"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function CrackedEggIllustration() {
  return (
    <svg aria-hidden="true" className="empty-nest-egg-svg" fill="none" viewBox="0 0 80 80">
      <path
        d="M20 44 c0 0 2 18 20 18 s20-18 20-18"
        fill="var(--coop-orange)"
        fillOpacity="0.12"
        stroke="var(--coop-brown-soft)"
        strokeLinecap="round"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <path
        className="empty-nest-egg-top"
        d="M24 44 c0 0 -2-20 16-28 s20 28 20 28"
        fill="var(--coop-cream)"
        stroke="var(--coop-brown-soft)"
        strokeLinecap="round"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <path
        d="M22 44 l6-3 4 5 5-4 6 3 5-4 6 3 6-3"
        fill="none"
        stroke="var(--coop-brown-soft)"
        strokeLinecap="round"
        strokeOpacity="0.3"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function CaptureView({
  isRecording,
  newestCapture,
  hatchedCaptureId,
  captures,
  pairingReady,
  canShare,
  photoInputRef,
  fileInputRef,
  onStartRecording,
  onFinishRecording,
  onPickFile,
  onShareCapture,
  onNavigateInbox,
  onNavigatePair,
}: CaptureViewProps) {
  return (
    <section className="receiver-grid">
      <Card className="receiver-capture-card">
        <p className="eyebrow">Primary Capture</p>
        <h2>Audio first, in one thumb-sized action.</h2>
        <div className="egg-stage">
          <button
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            aria-pressed={isRecording}
            className={isRecording ? 'egg-button is-recording' : 'egg-button'}
            onClick={() => (isRecording ? onFinishRecording('save') : void onStartRecording())}
            type="button"
          >
            <span className="egg-halo" />
            <span className="egg-shell" />
            <span className="egg-core">{isRecording ? 'Stop' : 'Record'}</span>
            {isRecording ? (
              <>
                <span className="egg-pulse-ring egg-pulse-ring-1" />
                <span className="egg-pulse-ring egg-pulse-ring-2" />
                <span className="egg-pulse-ring egg-pulse-ring-3" />
              </>
            ) : null}
          </button>
          <output aria-live="polite" className="sr-only">
            {isRecording ? 'Recording started' : ''}
          </output>
          <p className="quiet-note">
            {isRecording
              ? 'The egg is pulsing. Tap again to save, or cancel if you are not ready.'
              : 'Audio uses getUserMedia + MediaRecorder and stays on this device until queued.'}
          </p>
          {isRecording ? (
            <div className="cta-row">
              <Button variant="primary" onClick={() => onFinishRecording('save')}>
                Save voice note
              </Button>
              <Button variant="secondary" onClick={() => onFinishRecording('cancel')}>
                Cancel
              </Button>
            </div>
          ) : null}
        </div>

        <div className="receiver-actions-grid">
          <button
            className="capture-action-btn"
            onClick={() => photoInputRef.current?.click()}
            type="button"
          >
            <CameraIcon />
            <span>Take photo</span>
          </button>
          <button
            className="capture-action-btn"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <PaperclipIcon />
            <span>Attach file</span>
          </button>
        </div>
        <p className="quiet-note">
          Shared URLs from other apps land here as link chicks when the installed PWA is used as a
          share target.
        </p>
        <input
          accept="image/*"
          aria-label="Take photo"
          capture="environment"
          hidden
          onChange={(event) => void onPickFile(event, 'photo')}
          ref={photoInputRef}
          type="file"
        />
        <input
          aria-label="Attach file"
          hidden
          onChange={(event) => void onPickFile(event, 'file')}
          ref={fileInputRef}
          type="file"
        />
      </Card>

      <Card>
        <p className="eyebrow">Hatch Preview</p>
        <h2>Fresh captures settle into the inbox as chicks.</h2>
        {newestCapture ? (
          <article
            className={[
              'nest-item-card',
              CAPTURE_KIND_ACCENT[newestCapture.kind],
              newestCapture.id === hatchedCaptureId ? 'is-newborn' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="nest-item-topline">
              <span className="nest-item-chick">{receiverPreviewLabel(newestCapture.kind)}</span>
              <SyncPill state={newestCapture.syncState} />
            </div>
            <strong className="nest-item-title">{newestCapture.title}</strong>
            <p className="nest-item-detail">
              {newestCapture.sourceUrl ||
                newestCapture.note ||
                `${sizeLabel(newestCapture.byteSize)} · ${newestCapture.mimeType}`}
            </p>
            <div className="cta-row">
              <Button variant="secondary" size="small" onClick={onNavigateInbox}>
                Open inbox
              </Button>
              {!pairingReady ? (
                <Button variant="secondary" size="small" onClick={onNavigatePair}>
                  Mate to sync
                </Button>
              ) : null}
              {canShare ? (
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => {
                    const card = captures.find(
                      (entry) => entry.capture.id === newestCapture.id,
                    ) ?? { capture: newestCapture };
                    void onShareCapture(card);
                  }}
                >
                  Share
                </Button>
              ) : null}
            </div>
          </article>
        ) : (
          <div className="empty-nest">
            <CrackedEggIllustration />
            <p className="empty-nest-label">No captures yet</p>
            <p className="empty-nest-hint">
              Save a voice note, photo, file, or shared link and the first chick appears here.
            </p>
          </div>
        )}
      </Card>
    </section>
  );
}
