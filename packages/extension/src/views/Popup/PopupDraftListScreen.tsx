import type { ReviewDraft } from '@coop/shared';
import { PopupChoiceGroup } from './PopupChoiceGroup';
import { PopupOnboardingHero } from './PopupOnboardingHero';
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
  onRoundUp: () => void;
}) {
  const {
    drafts,
    filterOptions,
    activeFilterId,
    onChangeFilter,
    onOpenDraft,
    onMarkReady,
    onShare,
    onRoundUp,
  } = props;

  return (
    <section className="popup-screen popup-screen--fill">
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
                    <span className="popup-mini-pill popup-mini-pill--muted">
                      {draft.coopLabel}
                    </span>
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
                      Mark Ready
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="popup-empty-state popup-empty-state--illustrated">
            <PopupOnboardingHero variant="empty" />
            <p>No chickens here yet. Round up some tabs to get started.</p>
            <button className="popup-primary-action" onClick={onRoundUp} type="button">
              Round Up
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
