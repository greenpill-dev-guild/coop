import type { ReviewDraft } from '@coop/shared';

export function PopupDraftListScreen(props: {
  drafts: ReviewDraft[];
  onOpenDraft: (draftId: string) => void;
  onMarkReady: (draft: ReviewDraft) => void | Promise<void>;
  onShare: (draft: ReviewDraft) => void | Promise<void>;
  onOpenWorkspace: () => void;
}) {
  const { drafts, onOpenDraft, onMarkReady, onShare, onOpenWorkspace } = props;

  return (
    <section className="popup-screen">
      <div className="popup-copy-block popup-copy-block--compact">
        <h1>Drafts</h1>
        <p>Move quickly here, then hand off to the sidepanel for deeper review.</p>
      </div>

      {drafts.length > 0 ? (
        <ul className="popup-list-reset popup-draft-list">
          {drafts.slice(0, 5).map((draft) => (
            <li className="popup-draft-row" key={draft.id}>
              <div className="popup-draft-row__copy">
                <strong>{draft.title}</strong>
                <span>
                  {draft.sources[0]?.domain ?? 'coop.local'} /{' '}
                  {draft.workflowStage === 'ready' ? 'Ready to share' : 'Draft'}
                </span>
              </div>
              <div className="popup-row-actions">
                <button
                  className="popup-secondary-action"
                  onClick={() => onOpenDraft(draft.id)}
                  type="button"
                >
                  Review
                </button>
                {draft.workflowStage === 'ready' ? (
                  <button
                    className="popup-primary-action popup-primary-action--small"
                    onClick={() => void onShare(draft)}
                    type="button"
                  >
                    Share
                  </button>
                ) : (
                  <button
                    className="popup-secondary-action"
                    onClick={() => void onMarkReady(draft)}
                    type="button"
                  >
                    Mark ready
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="popup-empty-state">No items are waiting for review right now.</p>
      )}

      <div className="popup-inline-actions">
        <button className="popup-text-button" onClick={onOpenWorkspace} type="button">
          Open sidepanel for deeper review
        </button>
      </div>
    </section>
  );
}
