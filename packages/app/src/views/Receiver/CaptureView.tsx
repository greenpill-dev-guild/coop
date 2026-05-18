import type { ReceiverCapture } from '@coop/shared/app';
import type { RefObject } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { SyncPill } from '../../components/SyncPill';
import { sizeLabel } from './format';

type CaptureViewProps = {
  isRecording: boolean;
  newestCapture: ReceiverCapture | null;
  hatchedCaptureId: string | null;
  pairingReady: boolean;
  photoInputRef: RefObject<HTMLInputElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onStartRecording: () => void;
  onFinishRecording: (action: 'save' | 'cancel') => void;
  onPickFile: (event: React.ChangeEvent<HTMLInputElement>, kind: 'photo' | 'file') => void;
  onNavigateInbox: () => void;
  onNavigatePair: () => void;
};

function receiverPreviewLabel(kind: ReceiverCapture['kind']) {
  switch (kind) {
    case 'audio':
      return 'Voice note';
    case 'photo':
      return 'Photo';
    case 'file':
      return 'File';
    case 'link':
      return 'Link';
  }
}

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

export function CaptureView({
  isRecording,
  newestCapture,
  hatchedCaptureId,
  pairingReady,
  photoInputRef,
  fileInputRef,
  onStartRecording,
  onFinishRecording,
  onPickFile,
  onNavigateInbox,
  onNavigatePair,
}: CaptureViewProps) {
  return (
    <section className="receiver-grid receiver-hatch-grid" data-qa="hatch-screen">
      <Card className="receiver-capture-card receiver-hatch-card">
        <div className="receiver-hatch-heading">
          <p className="eyebrow">Primary Capture</p>
          <h2>Audio first, in one thumb-sized action.</h2>
        </div>
        <div className="egg-stage">
          <button
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            aria-pressed={isRecording}
            className={isRecording ? 'egg-button is-recording' : 'egg-button'}
            data-qa="record-button"
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
          <p className="quiet-note receiver-hatch-audio-note">
            {isRecording
              ? 'The egg is pulsing. Tap again to save, or cancel if you are not ready.'
              : 'Tap to save a voice note on this phone. Pair when you are ready to send it to private intake.'}
          </p>
          {isRecording ? (
            <div className="cta-row">
              <Button
                variant="primary"
                data-qa="save-voice-note"
                onClick={() => onFinishRecording('save')}
              >
                Save voice note
              </Button>
              <Button
                variant="secondary"
                data-qa="cancel-voice-note"
                onClick={() => onFinishRecording('cancel')}
              >
                Cancel
              </Button>
            </div>
          ) : null}
        </div>

        <div className="receiver-actions-grid">
          <button
            className="capture-action-btn"
            data-qa="take-photo"
            onClick={() => photoInputRef.current?.click()}
            type="button"
          >
            <CameraIcon />
            <span>Take photo</span>
          </button>
          <button
            className="capture-action-btn"
            data-qa="attach-file"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <PaperclipIcon />
            <span>Attach file</span>
          </button>
        </div>
        <p className="quiet-note receiver-hatch-link-note">
          Shared links save here first.
        </p>
        <div
          className={[
            'receiver-last-saved-strip',
            newestCapture ? '' : 'is-empty',
            newestCapture?.id === hatchedCaptureId ? 'is-newborn' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          data-qa="last-saved-strip"
        >
          {newestCapture ? (
            <>
              <div className="receiver-last-saved-copy">
                <span className="receiver-last-saved-kind">
                  {receiverPreviewLabel(newestCapture.kind)}
                </span>
                <strong>{newestCapture.title}</strong>
                <p>
                  {newestCapture.sourceUrl ||
                    newestCapture.note ||
                    `${sizeLabel(newestCapture.byteSize)} · ${newestCapture.mimeType}`}
                </p>
              </div>
              <SyncPill state={newestCapture.syncState} />
              <div className="receiver-last-saved-actions">
                <Button
                  variant="secondary"
                  size="small"
                  data-qa="view-roost"
                  onClick={onNavigateInbox}
                >
                  View Roost
                </Button>
                {!pairingReady ? (
                  <Button
                    variant="secondary"
                    size="small"
                    data-qa="mate-to-sync"
                    onClick={onNavigatePair}
                  >
                    Pair to sync
                  </Button>
                ) : null}
              </div>
            </>
          ) : (
            <p>No captures yet. Record, take a photo, attach a file, or share a link.</p>
          )}
        </div>
        <input
          accept="image/*"
          aria-label="Take photo"
          capture="environment"
          data-qa="photo-input"
          hidden
          onChange={(event) => void onPickFile(event, 'photo')}
          ref={photoInputRef}
          type="file"
        />
        <input
          aria-label="Attach file"
          data-qa="file-input"
          hidden
          onChange={(event) => void onPickFile(event, 'file')}
          ref={fileInputRef}
          type="file"
        />
      </Card>
    </section>
  );
}
