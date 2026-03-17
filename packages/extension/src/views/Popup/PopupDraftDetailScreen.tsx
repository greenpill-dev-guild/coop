import type { ReviewDraft } from '@coop/shared';

export function PopupDraftDetailScreen(props: {
  draft: ReviewDraft;
  saving: boolean;
  onChange: (patch: Partial<ReviewDraft>) => void;
  onSave: () => void | Promise<void>;
  onToggleReady: () => void | Promise<void>;
  onShare: () => void | Promise<void>;
  onOpenWorkspace: () => void;
}) {
  const { draft, saving, onChange, onSave, onToggleReady, onShare, onOpenWorkspace } = props;

  return (
    <section className="popup-screen">
      <div className="popup-copy-block popup-copy-block--compact">
        <p className="popup-draft-meta">
          {draft.sources[0]?.domain ?? 'coop.local'} /{' '}
          {new Date(draft.createdAt).toLocaleDateString()}
        </p>
      </div>

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
              {draft.workflowStage === 'ready' ? 'Send back to draft' : 'Mark ready'}
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

      <div className="popup-inline-actions">
        <button className="popup-text-button" onClick={onOpenWorkspace} type="button">
          Advanced edit in workspace
        </button>
      </div>
    </section>
  );
}
