import type { ReceiverCapture } from '@coop/shared';
import type { ChangeEvent, RefObject } from 'react';
import type { CaptureCard } from './index';

export type CapturePanelProps = {
  isRecording: boolean;
  newestCapture: ReceiverCapture | undefined;
  hatchedCaptureId: string | null;
  captures: CaptureCard[];
  canShare: boolean;
  pairingReady: boolean;
  photoInputRef: RefObject<HTMLInputElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onStartRecording: () => void;
  onFinishRecording: (mode: 'save' | 'cancel') => void;
  onPickFile: (event: ChangeEvent<HTMLInputElement>, kind: 'photo' | 'file') => void;
  onNavigateToInbox: () => void;
  onNavigateToPair: () => void;
  onShareCapture: (card: CaptureCard) => void;
  syncStateLabel: (state: ReceiverCapture['syncState']) => string;
  receiverPreviewLabel: (kind: ReceiverCapture['kind']) => string;
  sizeLabel: (byteSize: number) => string;
};

export function CapturePanel({
  isRecording,
  newestCapture,
  hatchedCaptureId,
  captures,
  canShare,
  pairingReady,
  photoInputRef,
  fileInputRef,
  onStartRecording,
  onFinishRecording,
  onPickFile,
  onNavigateToInbox,
  onNavigateToPair,
  onShareCapture,
  syncStateLabel,
  receiverPreviewLabel,
  sizeLabel,
}: CapturePanelProps) {
  return (
    <section className="receiver-grid">
      <article className="nest-card receiver-card receiver-capture-card">
        <p className="eyebrow">Primary Capture</p>
        <h2>Audio first, in one thumb-sized action.</h2>
        <div className="egg-stage">
          <button
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            className={isRecording ? 'egg-button is-recording' : 'egg-button'}
            onClick={() => (isRecording ? onFinishRecording('save') : void onStartRecording())}
            type="button"
          >
            <span className="egg-shell" />
            <span className="egg-core">{isRecording ? 'Stop' : 'Record'}</span>
          </button>
          <p className="quiet-note">
            {isRecording
              ? 'The egg is pulsing. Tap again to save, or cancel if you are not ready.'
              : 'Audio uses getUserMedia + MediaRecorder and stays on this device until queued.'}
          </p>
          {isRecording ? (
            <div className="cta-row">
              <button
                className="button button-primary"
                onClick={() => onFinishRecording('save')}
                type="button"
              >
                Save voice note
              </button>
              <button
                className="button button-secondary"
                onClick={() => onFinishRecording('cancel')}
                type="button"
              >
                Cancel
              </button>
            </div>
          ) : null}
        </div>

        <div className="receiver-actions-grid">
          <button
            className="button button-secondary"
            onClick={() => photoInputRef.current?.click()}
            type="button"
          >
            Take photo
          </button>
          <button
            className="button button-secondary"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            Attach file
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
      </article>

      <article className="nest-card receiver-card">
        <p className="eyebrow">Round Up Preview</p>
        <h2>Fresh captures settle into the Roost as chicks.</h2>
        {newestCapture ? (
          <article
            className={
              newestCapture.id === hatchedCaptureId ? 'nest-item-card is-newborn' : 'nest-item-card'
            }
          >
            <div className="nest-item-topline">
              <span className="nest-item-chick">{receiverPreviewLabel(newestCapture.kind)}</span>
              <span className={`sync-pill is-${newestCapture.syncState}`}>
                {syncStateLabel(newestCapture.syncState)}
              </span>
            </div>
            <strong>{newestCapture.title}</strong>
            <p>
              {newestCapture.sourceUrl ||
                newestCapture.note ||
                `${sizeLabel(newestCapture.byteSize)} · ${newestCapture.mimeType}`}
            </p>
            <div className="cta-row">
              <button
                className="button button-secondary button-small"
                onClick={onNavigateToInbox}
                type="button"
              >
                Open Roost
              </button>
              {!pairingReady ? (
                <button
                  className="button button-secondary button-small"
                  onClick={onNavigateToPair}
                  type="button"
                >
                  Pair to sync
                </button>
              ) : null}
              {canShare ? (
                <button
                  className="button button-secondary button-small"
                  onClick={() => {
                    const card = captures.find(
                      (entry) => entry.capture.id === newestCapture.id,
                    ) ?? { capture: newestCapture };
                    void onShareCapture(card);
                  }}
                  type="button"
                >
                  Share
                </button>
              ) : null}
            </div>
          </article>
        ) : (
          <div className="empty-nest">
            Save a voice note, photo, file, or shared link and the first chick appears here.
          </div>
        )}
      </article>
    </section>
  );
}
