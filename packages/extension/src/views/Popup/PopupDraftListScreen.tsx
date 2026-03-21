import type { ReviewDraft } from '@coop/shared';
import { PopupChoiceGroup } from './PopupChoiceGroup';
import type { PopupChoiceOption, PopupDraftListItem } from './popup-types';

function formatCategoryLabel(value: string) {
  return value
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function PopupDraftListScreen(props: {
  drafts: PopupDraftListItem[];
  filterOptions: Array<PopupChoiceOption<string>>;
  activeFilterId: string;
  onChangeFilter: (filterId: string) => void;
  onOpenDraft: (draftId: string) => void;
  onMarkReady: (draft: ReviewDraft) => void | Promise<void>;
  onShare: (draft: ReviewDraft) => void | Promise<void>;
}) {
  const { drafts, filterOptions, activeFilterId, onChangeFilter, onOpenDraft, onMarkReady, onShare } =
    props;

  return (
    <section className="popup-screen popup-screen--fill">
      <div className="popup-copy-block popup-copy-block--compact">
        <h1>Chickens</h1>
        <p>Rounded-up ideas across all your coops, ready for quick review.</p>
      </div>

      <PopupChoiceGroup
        ariaLabel="Filter chickens by coop"
        onChange={onChangeFilter}
        options={filterOptions}
        value={activeFilterId}
      />

      <div className="popup-list-grow">
        {drafts.length > 0 ? (
          <ul className="popup-list-reset popup-draft-list popup-activity-list--stretch">
            {drafts.map((draft) => (
              <li className="popup-draft-row" key={draft.id}>
                <div className="popup-draft-row__copy">
                  <strong>{draft.title}</strong>
                  <span>{draft.summary}</span>
                  <span className="popup-review-queue__pills">
                    <span className="popup-mini-pill">{formatCategoryLabel(draft.category)}</span>
                    <span className="popup-mini-pill popup-mini-pill--muted">{draft.coopLabel}</span>
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
                      onClick={() => void onShare(draft as ReviewDraft)}
                      type="button"
                    >
                      Share
                    </button>
                  ) : (
                    <button
                      className="popup-secondary-action"
                      onClick={() => void onMarkReady(draft as ReviewDraft)}
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
          <p className="popup-empty-state">
            No chickens match this filter right now. Round up a tab or open the receiver to hatch a new one.
          </p>
        )}
      </div>
    </section>
  );
}
