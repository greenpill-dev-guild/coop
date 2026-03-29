import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { usePopupDraftHandlers } = await import('../usePopupDraftHandlers');

function makeDraft(overrides: Record<string, unknown> = {}) {
  return {
    id: 'draft-1',
    title: 'Draft',
    workflowStage: 'candidate',
    ...overrides,
  } as never;
}

describe('usePopupDraftHandlers', () => {
  it('updates, saves, toggles, and shares the selected draft', async () => {
    const saveDraft = vi.fn(async (draft) => ({ ...draft, title: 'Saved draft' }));
    const changeWorkflowStage = vi.fn(async (draft, stage) => ({ ...draft, workflowStage: stage }));
    const publishDraft = vi.fn(async () => ({ ok: true }));
    const navigate = vi.fn();
    const draft = makeDraft();

    const { result } = renderHook(() =>
      usePopupDraftHandlers({
        navigation: {
          state: { selectedDraftId: 'draft-1' },
          navigate,
        } as never,
        quickDraftActions: {
          saveDraft,
          changeWorkflowStage,
          publishDraft,
        } as never,
        visibleDrafts: [draft],
      }),
    );

    act(() => {
      result.current.updateSelectedDraft({ title: 'Edited draft' });
    });
    expect(result.current.selectedDraft).toMatchObject({ title: 'Edited draft' });

    await act(async () => {
      await result.current.handleSaveSelectedDraft();
      await result.current.handleToggleSelectedDraftReady();
      await result.current.handleShareSelectedDraft();
    });

    expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({ title: 'Edited draft' }));
    expect(changeWorkflowStage).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Edited draft' }),
      'ready',
    );
    expect(publishDraft).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Edited draft', workflowStage: 'candidate' }),
    );
    expect(result.current.draftEdits[draft.id]).toBeUndefined();
    expect(navigate).toHaveBeenCalledWith('drafts');
  });

  it('handles ready/share actions from list rows', async () => {
    const changeWorkflowStage = vi.fn(async (draft) => ({ ...draft, workflowStage: 'ready' }));
    const publishDraft = vi.fn(async () => ({ ok: true }));
    const draft = makeDraft({ id: 'draft-2' });

    const { result } = renderHook(() =>
      usePopupDraftHandlers({
        navigation: {
          state: { selectedDraftId: null },
          navigate: vi.fn(),
        } as never,
        quickDraftActions: {
          saveDraft: vi.fn(),
          changeWorkflowStage,
          publishDraft,
        } as never,
        visibleDrafts: [draft],
      }),
    );

    await act(async () => {
      await result.current.handleMarkDraftReady(draft);
    });

    expect(result.current.resolveDraftValue(draft)).toMatchObject({ workflowStage: 'ready' });

    await act(async () => {
      await result.current.handleShareDraft(draft);
    });

    expect(publishDraft).toHaveBeenCalledWith(expect.objectContaining({ workflowStage: 'ready' }));
    expect(result.current.draftEdits[draft.id]).toBeUndefined();
  });
});
