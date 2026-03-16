import type { ReceiverCapture } from '@coop/shared';
import type { RefObject } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { SyncPill } from '../../components/SyncPill';
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

function sizeLabel(byteSize: number) {
  if (byteSize < 1024) {
    return `${byteSize} B`;
  }
  if (byteSize < 1024 * 1024) {
    return `${Math.max(1, Math.round(byteSize / 102.4) / 10)} KB`;
  }
  return `${Math.max(0.1, Math.round(byteSize / (1024 * 102.4)) / 10)} MB`;
}

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
            <span className="egg-shell" />
            <span className="egg-core">{isRecording ? 'Stop' : 'Record'}</span>
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
          <Button variant="secondary" onClick={() => photoInputRef.current?.click()}>
            Take photo
          </Button>
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            Attach file
          </Button>
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
            className={
              newestCapture.id === hatchedCaptureId ? 'nest-item-card is-newborn' : 'nest-item-card'
            }
          >
            <div className="nest-item-topline">
              <span className="nest-item-chick">{receiverPreviewLabel(newestCapture.kind)}</span>
              <SyncPill state={newestCapture.syncState} />
            </div>
            <strong>{newestCapture.title}</strong>
            <p>
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
            Save a voice note, photo, file, or shared link and the first chick appears here.
          </div>
        )}
      </Card>
    </section>
  );
}
