import type { ReviewDraft } from '@coop/shared';
import { useState } from 'react';

export function PopupDraftDetailScreen(props: {
  draft: ReviewDraft;
  saving: boolean;
  onChange: (patch: Partial<ReviewDraft>) => void;
  onSave: () => void | Promise<void>;
  onToggleReady: () => void | Promise<void>;
  onShare: () => void | Promise<void>;
}) {
  const { draft, saving, onChange, onSave, onToggleReady, onShare } = props;
  const [previewMissing, setPreviewMissing] = useState(false);

  return (
    <section className="popup-screen">
      <div className="popup-copy-block">
        <h1>Review draft</h1>
        <p>Make quick edits here, then use the sidepanel for synthesis or heavier formatting.</p>
      </div>

      <div className="popup-copy-block popup-copy-block--compact">
        <p className="popup-draft-meta">
          {draft.sources[0]?.domain ?? 'coop.local'} /{' '}
          {new Date(draft.createdAt).toLocaleDateString()}
        </p>
      </div>

      {draft.previewImageUrl && !previewMissing ? (
        <div className="popup-preview-card">
          <img
            alt=""
            className="popup-preview-card__image"
            onError={() => setPreviewMissing(true)}
            src={draft.previewImageUrl}
          />
        </div>
      ) : null}

      <div className="popup-form">
        <label className="popup-field">
          <span>Title</span>
          <input
            onChange={(event) => onChange({ title: event.target.value })}
            value={draft.title}
          />
        </label>

        <label className="popup-field">
          <span>Summary</span>
          <textarea
            onChange={(event) => onChange({ summary: event.target.value })}
            value={draft.summary}
          />
        </label>

        <div className="popup-stack">
          <button
            className="popup-primary-action"
            disabled={saving}
            onClick={() => void onSave()}
            type="button"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <div className="popup-split-actions">
            <button
              className="popup-secondary-action"
              onClick={() => void onToggleReady()}
              type="button"
            >
              {draft.workflowStage === 'ready' ? 'Send Back to Draft' : 'Mark Ready'}
            </button>
            {draft.workflowStage === 'ready' ? (
              <button
                className="popup-secondary-action"
                onClick={() => void onShare()}
                type="button"
              >
                Share
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
