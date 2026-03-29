import type { ReviewDraft } from '@coop/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useQuickDraftActions } from '../useQuickDraftActions';

const { playCoopSoundMock, sendRuntimeMessageMock } = vi.hoisted(() => ({
  playCoopSoundMock: vi.fn(),
  sendRuntimeMessageMock: vi.fn(),
}));

vi.mock('../../../runtime/audio', () => ({
  playCoopSound: playCoopSoundMock,
}));

vi.mock('../../../runtime/messages', () => ({
  sendRuntimeMessage: sendRuntimeMessageMock,
}));

function makeDraft(overrides: Partial<ReviewDraft> = {}) {
  return {
    id: 'draft-1',
    workflowStage: 'candidate',
    suggestedTargetCoopIds: ['coop-1'],
    ...overrides,
  } as ReviewDraft;
}

describe('useQuickDraftActions', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('saves drafts, sets a success message, and reloads the dashboard', async () => {
    const setMessage = vi.fn();
    const loadDashboard = vi.fn(async () => undefined);
    const nextDraft = makeDraft({ workflowStage: 'ready' });
    sendRuntimeMessageMock.mockResolvedValue({
      ok: true,
      data: nextDraft,
    });

    const actions = useQuickDraftActions({
      setMessage,
      loadDashboard,
      soundPreferences: { enabled: true } as never,
    });

    await expect(actions.saveDraft(makeDraft())).resolves.toEqual(nextDraft);
    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
      type: 'update-review-draft',
      payload: { draft: makeDraft() },
    });
    expect(setMessage).toHaveBeenCalledWith('Draft saved.');
    expect(loadDashboard).toHaveBeenCalledTimes(1);
  });

  it('surfaces save failures without reloading the dashboard', async () => {
    const setMessage = vi.fn();
    const loadDashboard = vi.fn(async () => undefined);
    sendRuntimeMessageMock.mockResolvedValue({
      ok: false,
      error: 'Could not save.',
    });

    const actions = useQuickDraftActions({
      setMessage,
      loadDashboard,
      soundPreferences: { enabled: true } as never,
    });

    await expect(actions.saveDraft(makeDraft())).resolves.toBeNull();
    expect(setMessage).toHaveBeenCalledWith('Could not save.');
    expect(loadDashboard).not.toHaveBeenCalled();
  });

  it('updates workflow stage messages for ready and candidate transitions', async () => {
    const setMessage = vi.fn();
    const loadDashboard = vi.fn(async () => undefined);
    sendRuntimeMessageMock.mockResolvedValue({
      ok: true,
      data: makeDraft({ workflowStage: 'ready' }),
    });

    const actions = useQuickDraftActions({
      setMessage,
      loadDashboard,
      soundPreferences: { enabled: true } as never,
    });

    await actions.changeWorkflowStage(makeDraft(), 'ready');
    await actions.changeWorkflowStage(makeDraft({ workflowStage: 'ready' }), 'candidate');

    expect(setMessage).toHaveBeenNthCalledWith(1, 'Draft is ready to share.');
    expect(setMessage).toHaveBeenNthCalledWith(2, 'Draft moved back to draft.');
    expect(loadDashboard).toHaveBeenCalledTimes(2);
  });

  it('publishes drafts, plays the returned sound event, and reloads the dashboard', async () => {
    const setMessage = vi.fn();
    const loadDashboard = vi.fn(async () => undefined);
    const draft = makeDraft({ suggestedTargetCoopIds: ['coop-1', 'coop-2'] });
    sendRuntimeMessageMock.mockResolvedValue({
      ok: true,
      soundEvent: 'draft-shared',
    });

    const actions = useQuickDraftActions({
      setMessage,
      loadDashboard,
      soundPreferences: { enabled: true } as never,
    });

    await expect(actions.publishDraft(draft)).resolves.toBe(true);
    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
      type: 'publish-draft',
      payload: {
        draft,
        targetCoopIds: ['coop-1', 'coop-2'],
      },
    });
    expect(playCoopSoundMock).toHaveBeenCalledWith('draft-shared', { enabled: true });
    expect(setMessage).toHaveBeenCalledWith('Draft shared with the coop feed.');
    expect(loadDashboard).toHaveBeenCalledTimes(1);
  });

  it('surfaces publish failures without playing sound or reloading', async () => {
    const setMessage = vi.fn();
    const loadDashboard = vi.fn(async () => undefined);
    sendRuntimeMessageMock.mockResolvedValue({
      ok: false,
      error: 'Could not share this draft.',
    });

    const actions = useQuickDraftActions({
      setMessage,
      loadDashboard,
      soundPreferences: { enabled: true } as never,
    });

    await expect(actions.publishDraft(makeDraft())).resolves.toBe(false);
    expect(playCoopSoundMock).not.toHaveBeenCalled();
    expect(loadDashboard).not.toHaveBeenCalled();
    expect(setMessage).toHaveBeenCalledWith('Could not share this draft.');
  });
});
