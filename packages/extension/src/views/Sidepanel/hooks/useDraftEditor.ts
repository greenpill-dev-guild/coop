import type {
  CoopSharedState,
  ReceiverCapture,
  RefineResult,
  RefineTask,
  ReviewDraft,
  SoundPreferences,
} from '@coop/shared';
import { isArchiveWorthy, withArchiveWorthiness } from '@coop/shared';
import { useState } from 'react';
import { playCoopSound } from '../../../runtime/audio';
import type { InferenceBridge } from '../../../runtime/inference-bridge';
import { sendRuntimeMessage } from '../../../runtime/messages';

export function useDraftEditor(deps: {
  activeCoop: CoopSharedState | undefined;
  setMessage: (msg: string) => void;
  setPanelTab: (tab: string) => void;
  loadDashboard: () => Promise<void>;
  soundPreferences: SoundPreferences;
  inferenceBridgeRef: React.RefObject<InferenceBridge | null>;
}) {
  const {
    activeCoop,
    setMessage,
    setPanelTab,
    loadDashboard,
    soundPreferences,
    inferenceBridgeRef,
  } = deps;

  const [draftEdits, setDraftEdits] = useState<Record<string, ReviewDraft>>({});
  const [refineResults, setRefineResults] = useState<Record<string, RefineResult>>({});
  const [refiningDrafts, setRefiningDrafts] = useState<Set<string>>(new Set());
  const [anonymousPublish, setAnonymousPublish] = useState(false);

  function draftValue(draft: ReviewDraft) {
    return draftEdits[draft.id] ?? draft;
  }

  function updateDraft(draft: ReviewDraft, patch: Partial<ReviewDraft>) {
    setDraftEdits((current) => ({
      ...current,
      [draft.id]: {
        ...draftValue(draft),
        ...patch,
      },
    }));
  }

  function toggleDraftTargetCoop(draft: ReviewDraft, coopId: string) {
    const currentTargets = draftValue(draft).suggestedTargetCoopIds;
    const nextTargets = currentTargets.includes(coopId)
      ? currentTargets.filter((target) => target !== coopId)
      : [...currentTargets, coopId];

    if (nextTargets.length === 0) {
      setMessage('Keep at least one coop selected for this draft.');
      return;
    }

    updateDraft(draft, {
      suggestedTargetCoopIds: nextTargets,
    });
  }

  async function saveDraft(draft: ReviewDraft, workflowStage = draftValue(draft).workflowStage) {
    const editedDraft = {
      ...draftValue(draft),
      workflowStage,
    };
    const response = await sendRuntimeMessage<ReviewDraft>({
      type: 'update-review-draft',
      payload: {
        draft: editedDraft,
      },
    });
    if (!response.ok || !response.data) {
      setMessage(response.error ?? 'Could not save the draft.');
      return null;
    }

    setDraftEdits((current) => ({
      ...current,
      [draft.id]: response.data,
    }));
    await loadDashboard();
    return response.data;
  }

  async function refineDraft(draft: ReviewDraft, task: RefineTask) {
    const bridge = inferenceBridgeRef.current;
    if (!bridge) {
      setMessage('Local helper is not ready yet.');
      return;
    }

    const coop = activeCoop;
    if (!coop) {
      setMessage('Choose a coop before asking for a polish suggestion.');
      return;
    }

    const value = draftValue(draft);
    setRefiningDrafts((current) => new Set(current).add(draft.id));

    try {
      const result = await bridge.refine({
        draftId: draft.id,
        task,
        title: value.title,
        summary: value.summary,
        tags: value.tags,
        category: value.category,
        coopName: coop.profile.name,
        coopPurpose: coop.profile.purpose,
      });

      setRefineResults((current) => ({ ...current, [draft.id]: result }));
      setMessage(
        result.provider === 'local-model'
          ? `Draft polished with the local helper (${result.durationMs}ms).`
          : `Draft polished with quick rules (${result.durationMs}ms).`,
      );
    } catch {
      setMessage('Polish failed. Falling back to quick rules.');
    } finally {
      setRefiningDrafts((current) => {
        const next = new Set(current);
        next.delete(draft.id);
        return next;
      });
    }
  }

  function applyRefineResult(draft: ReviewDraft) {
    const result = refineResults[draft.id];
    if (!result) return;

    const patch: Partial<ReviewDraft> = {};
    if (result.refinedTitle) patch.title = result.refinedTitle;
    if (result.refinedSummary) patch.summary = result.refinedSummary;
    if (result.suggestedTags) patch.tags = result.suggestedTags;

    if (Object.keys(patch).length > 0) {
      updateDraft(draft, patch);
      setMessage('Polish suggestion applied to the draft. Save to the roost when ready.');
    }

    setRefineResults((current) => {
      const next = { ...current };
      delete next[draft.id];
      return next;
    });
  }

  function dismissRefineResult(draftId: string) {
    setRefineResults((current) => {
      const next = { ...current };
      delete next[draftId];
      return next;
    });
  }

  async function changeDraftWorkflowStage(
    draft: ReviewDraft,
    workflowStage: 'candidate' | 'ready',
  ) {
    const savedDraft = await saveDraft(draft, workflowStage);
    if (!savedDraft) {
      return;
    }

    setMessage(
      workflowStage === 'ready' ? 'Draft is ready to share.' : 'Draft moved back to hatching.',
    );
  }

  async function convertReceiverCapture(
    capture: ReceiverCapture,
    workflowStage: 'candidate' | 'ready',
  ) {
    const response = await sendRuntimeMessage<ReviewDraft>({
      type: 'convert-receiver-intake',
      payload: {
        captureId: capture.id,
        workflowStage,
        targetCoopId: activeCoop?.profile.id,
      },
    });
    if (!response.ok || !response.data) {
      setMessage(response.error ?? 'Could not move this Pocket Coop find.');
      return;
    }

    setDraftEdits((current) => ({
      ...current,
      [response.data.id]: response.data,
    }));
    setMessage(
      workflowStage === 'ready'
        ? 'Pocket Coop find moved into an editable draft.'
        : 'Pocket Coop find moved into hatching review.',
    );
    setPanelTab(workflowStage === 'ready' ? 'Roost' : 'Flock Meeting');
    await loadDashboard();
  }

  async function archiveReceiverCapture(captureId: string) {
    const response = await sendRuntimeMessage({
      type: 'archive-receiver-intake',
      payload: { captureId },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not save this Pocket Coop find.');
      return;
    }
    setMessage('Pocket Coop find saved locally.');
    await loadDashboard();
  }

  async function toggleReceiverCaptureArchiveWorthiness(capture: ReceiverCapture) {
    const response = await sendRuntimeMessage<ReceiverCapture>({
      type: 'set-receiver-intake-archive-worthy',
      payload: {
        captureId: capture.id,
        archiveWorthy: !isArchiveWorthy(capture),
      },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update the save mark.');
      return;
    }
    setMessage(
      !isArchiveWorthy(capture)
        ? 'Pocket Coop find marked worth saving.'
        : 'Pocket Coop find save mark removed.',
    );
    await loadDashboard();
  }

  async function publishDraft(draft: ReviewDraft) {
    const editedDraft = draftValue(draft);
    const response = await sendRuntimeMessage({
      type: 'publish-draft',
      payload: {
        draft: editedDraft,
        targetCoopIds: editedDraft.suggestedTargetCoopIds,
        anonymous: anonymousPublish,
      },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not share this draft with the coop.');
      return;
    }
    if (response.soundEvent) {
      await playCoopSound(response.soundEvent, soundPreferences);
    }
    const categoryLabel = formatArtifactCategoryLabel(editedDraft.category);
    const celebrationMsg = isOpportunityCategory(editedDraft.category)
      ? `${categoryLabel} just landed in the feed!`
      : 'Draft shared with the coop feed.';
    setMessage(celebrationMsg);
    setDraftEdits((current) => {
      const next = { ...current };
      delete next[draft.id];
      return next;
    });
    await loadDashboard();
  }

  async function toggleDraftArchiveWorthiness(draft: ReviewDraft) {
    const editedDraft = withArchiveWorthiness(
      draftValue(draft),
      !isArchiveWorthy(draftValue(draft)),
    );
    const response = await sendRuntimeMessage<ReviewDraft>({
      type: 'update-review-draft',
      payload: {
        draft: editedDraft,
      },
    });
    if (!response.ok || !response.data) {
      setMessage(response.error ?? 'Could not update the save mark.');
      return;
    }
    setDraftEdits((current) => ({
      ...current,
      [draft.id]: response.data,
    }));
    setMessage(
      isArchiveWorthy(response.data) ? 'Draft marked worth saving.' : 'Draft save mark removed.',
    );
    await loadDashboard();
  }

  return {
    draftEdits,
    refineResults,
    refiningDrafts,
    anonymousPublish,
    setAnonymousPublish,
    draftValue,
    updateDraft,
    toggleDraftTargetCoop,
    saveDraft,
    refineDraft,
    applyRefineResult,
    dismissRefineResult,
    changeDraftWorkflowStage,
    convertReceiverCapture,
    archiveReceiverCapture,
    toggleReceiverCaptureArchiveWorthiness,
    publishDraft,
    toggleDraftArchiveWorthiness,
  };
}

function isOpportunityCategory(category: string): boolean {
  return ['funding-lead', 'opportunity', 'next-step'].includes(category);
}

function formatArtifactCategoryLabel(category: string) {
  switch (category) {
    case 'setup-insight':
      return 'Setup insight';
    case 'coop-soul':
      return 'Coop soul';
    case 'ritual':
      return 'Ritual';
    case 'seed-contribution':
      return 'Starter note';
    case 'resource':
      return 'Resource';
    case 'thought':
      return 'Thought';
    case 'insight':
      return 'Insight';
    case 'funding-lead':
      return 'Funding lead';
    case 'evidence':
      return 'Evidence';
    case 'opportunity':
      return 'Opportunity';
    case 'next-step':
      return 'Next step';
    default:
      return category;
  }
}
