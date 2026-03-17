import type { ReviewDraft, SoundPreferences } from '@coop/shared';
import { playCoopSound } from '../../runtime/audio';
import { sendRuntimeMessage } from '../../runtime/messages';

export function useQuickDraftActions(deps: {
  setMessage: (message: string) => void;
  loadDashboard: () => Promise<void>;
  soundPreferences: SoundPreferences;
}) {
  const { setMessage, loadDashboard, soundPreferences } = deps;

  async function saveDraft(draft: ReviewDraft) {
    const response = await sendRuntimeMessage<ReviewDraft>({
      type: 'update-review-draft',
      payload: { draft },
    });
    if (!response.ok || !response.data) {
      setMessage(response.error ?? 'Could not save the draft.');
      return null;
    }
    setMessage('Draft saved.');
    await loadDashboard();
    return response.data;
  }

  async function changeWorkflowStage(draft: ReviewDraft, workflowStage: 'candidate' | 'ready') {
    const response = await sendRuntimeMessage<ReviewDraft>({
      type: 'update-review-draft',
      payload: {
        draft: {
          ...draft,
          workflowStage,
        },
      },
    });
    if (!response.ok || !response.data) {
      setMessage(response.error ?? 'Could not update the draft status.');
      return null;
    }
    setMessage(
      workflowStage === 'ready' ? 'Draft is ready to share.' : 'Draft moved back to draft.',
    );
    await loadDashboard();
    return response.data;
  }

  async function publishDraft(draft: ReviewDraft) {
    const response = await sendRuntimeMessage({
      type: 'publish-draft',
      payload: {
        draft,
        targetCoopIds: draft.suggestedTargetCoopIds,
      },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not share this draft.');
      return false;
    }
    if (response.soundEvent) {
      await playCoopSound(response.soundEvent, soundPreferences);
    }
    setMessage('Draft shared with the coop feed.');
    await loadDashboard();
    return true;
  }

  return {
    saveDraft,
    changeWorkflowStage,
    publishDraft,
  };
}
