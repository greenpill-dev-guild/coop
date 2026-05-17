import type { CoopSharedState } from '@coop/shared';
import { useEffect, useMemo, useState } from 'react';
import type { useDraftEditor } from '../hooks/useDraftEditor';
import {
  type ReviewItem,
  type ReviewItemTarget,
  filterMeaningfulRouteTargets,
} from './chickens-helpers';

// ---------------------------------------------------------------------------
// PushControls
// ---------------------------------------------------------------------------

export interface PushControlsProps {
  item: ReviewItem;
  coops: CoopSharedState[];
  draftEditor?: ReturnType<typeof useDraftEditor>;
}

/** Render push controls for all review items — unified across signals and drafts. */
export function PushControls(props: PushControlsProps) {
  const { item, coops, draftEditor } = props;
  const [reviewOpen, setReviewOpen] = useState(false);

  const availableCoopIds = useMemo(() => new Set(coops.map((coop) => coop.profile.id)), [coops]);
  const routeTargets = useMemo(() => resolveRouteTargets(item, coops), [item, coops]);
  const initialSelectedTargetIds = useMemo(
    () => selectedTargetIds(routeTargets, availableCoopIds),
    [routeTargets, availableCoopIds],
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedTargetIds);

  useEffect(() => {
    setSelectedIds(initialSelectedTargetIds);
  }, [initialSelectedTargetIds]);

  // Stale observations have no push target
  if (item.kind === 'stale' || !draftEditor) return null;

  const recommendedTarget = routeTargets[0];
  const alternateTargets = routeTargets.slice(1);
  const selectedTargetNames = selectedIds
    .map((coopId) => coops.find((coop) => coop.profile.id === coopId)?.profile.name)
    .filter((name): name is string => Boolean(name));

  const handleShare = async () => {
    const targetCoopIds = selectedIds.filter((coopId) => availableCoopIds.has(coopId));
    if (targetCoopIds.length === 0) {
      return;
    }

    if (item.draft) {
      const publishableDraft = {
        ...item.draft,
        suggestedTargetCoopIds: targetCoopIds,
        workflowStage: 'ready' as const,
      };
      if (item.draft.workflowStage !== 'ready') {
        const savedDraft = await draftEditor.saveDraft(publishableDraft, 'ready');
        if (!savedDraft) return;
        await draftEditor.publishDraft(savedDraft);
        return;
      }
      await draftEditor.publishDraft(publishableDraft);
      setReviewOpen(false);
      return;
    }

    if (item.signal) {
      const draft = await draftEditor.promoteSignalToDraft(item.signal);
      if (!draft) return;
      await draftEditor.publishDraft({
        ...draft,
        suggestedTargetCoopIds: targetCoopIds,
        workflowStage: 'ready',
      });
      setReviewOpen(false);
    }
  };

  const toggleTarget = (coopId: string) => {
    setSelectedIds((current) => {
      if (current.includes(coopId)) {
        const next = current.filter((id) => id !== coopId);
        return next.length > 0 ? next : current;
      }
      return [...current, coopId];
    });
  };

  // 0 targets: "Select coops"
  if (coops.length === 0 || !recommendedTarget) {
    return (
      <div className="compact-card__actions">
        <button
          className="compact-card__push-btn compact-card__push-btn--muted"
          disabled
          type="button"
        >
          Select coops
        </button>
      </div>
    );
  }

  return (
    <div className="compact-card__route-controls">
      <div className="compact-card__actions">
        <button
          className="compact-card__push-btn"
          onClick={() => setReviewOpen((current) => !current)}
          type="button"
        >
          Review route
        </button>
      </div>

      {reviewOpen ? (
        <div className="compact-card__route-review">
          <div className="compact-card__route-review-header">
            <strong>Best fit: {recommendedTarget.name}</strong>
            {recommendedTarget.rationale ? <p>{recommendedTarget.rationale}</p> : null}
          </div>

          {alternateTargets.length > 0 ? (
            <div className="compact-card__route-options">
              {alternateTargets.map((target) => (
                <label className="compact-card__route-option" key={target.id}>
                  <input
                    checked={selectedIds.includes(target.id)}
                    onChange={() => toggleTarget(target.id)}
                    type="checkbox"
                  />
                  <span>
                    <strong>{target.name}</strong>
                    {target.rationale ? <small>{target.rationale}</small> : null}
                  </span>
                </label>
              ))}
            </div>
          ) : null}

          <div className="compact-card__detail-row">
            <span className="compact-card__detail-label">What will be shared</span>
            <p>
              {item.title}
              {selectedTargetNames.length > 0 ? ` to ${selectedTargetNames.join(', ')}` : ''}
            </p>
          </div>

          <button
            className="compact-card__push-btn"
            onClick={() => void handleShare()}
            type="button"
          >
            Share to selected coops
          </button>
        </div>
      ) : null}
    </div>
  );
}

function resolveRouteTargets(item: ReviewItem, coops: CoopSharedState[]): ReviewItemTarget[] {
  if (item.targetCoops.length > 0) {
    return filterMeaningfulRouteTargets(item.targetCoops);
  }

  return coops.slice(0, 1).map((coop) => ({
    id: coop.profile.id,
    name: coop.profile.name,
    matchedRitualLenses: [],
    selected: true,
  }));
}

function selectedTargetIds(targets: ReviewItemTarget[], availableCoopIds: Set<string>) {
  const selected = targets
    .filter((target) => target.selected && availableCoopIds.has(target.id))
    .map((target) => target.id);
  if (selected.length > 0) return selected;
  const firstAvailable = targets.find((target) => availableCoopIds.has(target.id));
  return firstAvailable ? [firstAvailable.id] : [];
}
