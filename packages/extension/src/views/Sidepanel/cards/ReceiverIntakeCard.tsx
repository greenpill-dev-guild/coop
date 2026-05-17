import { type ReceiverCapture, isArchiveWorthy } from '@coop/shared';
import type { DraftEditorReturn } from './card-shared';

export interface ReceiverIntakeCardProps {
  capture: ReceiverCapture;
  draftEditor: DraftEditorReturn;
}

export function ReceiverIntakeCard({ capture, draftEditor }: ReceiverIntakeCardProps) {
  return (
    <article className="draft-card stack" key={capture.id}>
      <strong>{capture.title}</strong>
      <div className="badge-row">
        <span className="badge">{capture.kind}</span>
        <span className="badge">{capture.syncState}</span>
        <span className="badge">{capture.intakeStatus}</span>
        {isArchiveWorthy(capture) ? <span className="badge">worth saving</span> : null}
      </div>
      <div className="helper-text">
        {capture.memberDisplayName ?? 'Unknown member'} ·{' '}
        {new Date(capture.syncedAt ?? capture.createdAt).toLocaleString()}
      </div>
      <div className="helper-text">
        {capture.fileName ?? `${capture.byteSize} bytes`} · {capture.mimeType}
      </div>
      {(capture.intakeStatus ?? 'private-intake') === 'private-intake' ? (
        <div className="helper-text">
          Add context before sharing so Coop can suggest the right route.
        </div>
      ) : null}
      {capture.sourceUrl ? (
        <div className="helper-text">
          <a className="source-link" href={capture.sourceUrl} rel="noreferrer" target="_blank">
            {capture.sourceUrl}
          </a>
        </div>
      ) : null}
      {capture.syncError ? <div className="helper-text">{capture.syncError}</div> : null}
      <div className="action-row">
        <button
          className="secondary-button"
          onClick={() => void draftEditor.toggleReceiverCaptureArchiveWorthiness(capture)}
          type="button"
        >
          {isArchiveWorthy(capture) ? 'Remove save mark' : 'Mark worth saving'}
        </button>
        <button
          className="secondary-button"
          onClick={() => void draftEditor.convertReceiverCapture(capture, 'candidate')}
          type="button"
        >
          Move to hatching
        </button>
        <button
          className="primary-button"
          onClick={() => void draftEditor.convertReceiverCapture(capture, 'ready')}
          type="button"
        >
          Make a draft
        </button>
        <button
          className="secondary-button"
          onClick={() => void draftEditor.archiveReceiverCapture(capture.id)}
          type="button"
        >
          Save locally
        </button>
      </div>
    </article>
  );
}
