import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { playCoopSoundMock, sendRuntimeMessageMock } = vi.hoisted(() => ({
  playCoopSoundMock: vi.fn(async () => undefined),
  sendRuntimeMessageMock: vi.fn(),
}));

vi.mock('../../../../runtime/audio', () => ({
  playCoopSound: playCoopSoundMock,
}));

vi.mock('../../../../runtime/messages', () => ({
  sendRuntimeMessage: sendRuntimeMessageMock,
}));

const { useDraftEditor } = await import('../useDraftEditor');

function makeDraft(overrides: Record<string, unknown> = {}) {
  return {
    id: 'draft-1',
    title: 'Watershed lead',
    summary: 'A draft summary',
    tags: ['river'],
    category: 'opportunity',
    whyItMatters: 'The coop can act now.',
    suggestedNextStep: 'Reach out.',
    workflowStage: 'ready' as const,
    suggestedTargetCoopIds: ['coop-1'],
    sources: [{ label: 'Source', url: 'https://example.com', domain: 'example.com' }],
    rationale: 'Strong fit',
    provenance: { type: 'manual' as const },
    archiveWorthiness: { flagged: true, flaggedAt: '2026-03-28T00:00:00.000Z' },
    ...overrides,
  };
}

function makeCapture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'capture-1',
    archiveWorthiness: { flagged: false },
    ...overrides,
  } as never;
}

function makeDeps(overrides: Partial<Parameters<typeof useDraftEditor>[0]> = {}) {
  return {
    activeCoop: {
      profile: {
        id: 'coop-1',
        name: 'River Coop',
        purpose: 'Organize field signals',
      },
    } as never,
    setMessage: vi.fn(),
    setPanelTab: vi.fn(),
    loadDashboard: vi.fn(async () => undefined),
    soundPreferences: {
      enabled: true,
      reducedMotion: false,
      reducedSound: false,
    },
    inferenceBridgeRef: { current: null },
    ...overrides,
  };
}

describe('useDraftEditor action paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prevents removing the last target coop from a draft', () => {
    const deps = makeDeps();
    const draft = makeDraft({ suggestedTargetCoopIds: ['coop-1'] });

    const { result } = renderHook(() => useDraftEditor(deps));

    act(() => {
      result.current.toggleDraftTargetCoop(draft as never, 'coop-1');
    });

    expect(deps.setMessage).toHaveBeenCalledWith('Keep at least one coop selected for this draft.');
    expect(result.current.draftEdits).toEqual({});
  });

  it('guards polish requests when the bridge or active coop is unavailable', async () => {
    const noBridgeDeps = makeDeps();
    const noCoopDeps = makeDeps({
      activeCoop: undefined,
      inferenceBridgeRef: {
        current: {
          refine: vi.fn(),
        },
      },
    });

    const { result: noBridgeResult } = renderHook(() => useDraftEditor(noBridgeDeps));
    const { result: noCoopResult } = renderHook(() => useDraftEditor(noCoopDeps));

    await act(async () => {
      await noBridgeResult.current.refineDraft(makeDraft() as never, 'summary-compression');
      await noCoopResult.current.refineDraft(makeDraft() as never, 'summary-compression');
    });

    expect(noBridgeDeps.setMessage).toHaveBeenCalledWith('Local helper is not ready yet.');
    expect(noCoopDeps.setMessage).toHaveBeenCalledWith(
      'Choose a coop before asking for a polish suggestion.',
    );
  });

  it('stores polish results, applies them to the draft, and can dismiss them', async () => {
    const deps = makeDeps({
      inferenceBridgeRef: {
        current: {
          refine: vi.fn(async () => ({
            provider: 'local-model',
            refinedTitle: 'Sharper watershed lead',
            refinedSummary: 'Sharper summary',
            suggestedTags: ['fresh', 'watershed'],
            durationMs: 12,
          })),
        },
      },
    });
    const draft = makeDraft();

    const { result } = renderHook(() => useDraftEditor(deps));

    await act(async () => {
      await result.current.refineDraft(draft as never, 'summary-compression');
    });

    await waitFor(() =>
      expect(result.current.refineResults[draft.id]).toMatchObject({
        refinedTitle: 'Sharper watershed lead',
      }),
    );
    expect(deps.setMessage).toHaveBeenCalledWith('Draft polished with the local helper (12ms).');

    act(() => {
      result.current.applyRefineResult(draft as never);
    });

    expect(result.current.draftValue(draft as never)).toMatchObject({
      title: 'Sharper watershed lead',
      summary: 'Sharper summary',
      tags: ['fresh', 'watershed'],
    });
    expect(result.current.refineResults[draft.id]).toBeUndefined();
    expect(deps.setMessage).toHaveBeenCalledWith(
      'Polish suggestion applied to the draft. Save to the roost when ready.',
    );

    await act(async () => {
      await result.current.refineDraft(draft as never, 'summary-compression');
    });

    act(() => {
      result.current.dismissRefineResult(draft.id);
    });

    expect(result.current.refineResults[draft.id]).toBeUndefined();
  });

  it('saves drafts and reports workflow stage changes', async () => {
    const deps = makeDeps();
    const draft = makeDraft();
    sendRuntimeMessageMock
      .mockResolvedValueOnce({ ok: true, data: { ...draft, title: 'Saved title' } })
      .mockResolvedValueOnce({ ok: true, data: { ...draft, workflowStage: 'candidate' } });

    const { result } = renderHook(() => useDraftEditor(deps));

    let savedDraft: unknown;
    await act(async () => {
      savedDraft = await result.current.saveDraft(draft as never);
      await result.current.changeDraftWorkflowStage(draft as never, 'candidate');
    });

    expect(savedDraft).toMatchObject({ title: 'Saved title' });
    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(1, {
      type: 'update-review-draft',
      payload: {
        draft: expect.objectContaining({ title: 'Watershed lead' }),
      },
    });
    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(2, {
      type: 'update-review-draft',
      payload: {
        draft: expect.objectContaining({ workflowStage: 'candidate' }),
      },
    });
    expect(result.current.draftEdits[draft.id]).toMatchObject({ workflowStage: 'candidate' });
    expect(deps.setMessage).toHaveBeenCalledWith('Draft moved back to hatching.');
    expect(deps.loadDashboard).toHaveBeenCalledTimes(2);
  });

  it('converts receiver captures, archives them locally, and toggles save marks', async () => {
    const deps = makeDeps();
    const capture = makeCapture();
    const movedDraft = makeDraft({ id: 'draft-from-capture' });
    sendRuntimeMessageMock
      .mockResolvedValueOnce({ ok: true, data: movedDraft })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        data: { ...capture, archiveWorthiness: { flagged: true } },
      });

    const { result } = renderHook(() => useDraftEditor(deps));

    await act(async () => {
      await result.current.convertReceiverCapture(capture, 'ready');
      await result.current.archiveReceiverCapture(capture.id);
      await result.current.toggleReceiverCaptureArchiveWorthiness(capture);
    });

    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(1, {
      type: 'convert-receiver-intake',
      payload: {
        captureId: 'capture-1',
        workflowStage: 'ready',
        targetCoopId: 'coop-1',
      },
    });
    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(2, {
      type: 'archive-receiver-intake',
      payload: { captureId: 'capture-1' },
    });
    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(3, {
      type: 'set-receiver-intake-archive-worthy',
      payload: {
        captureId: 'capture-1',
        archiveWorthy: true,
      },
    });
    expect(deps.setPanelTab).toHaveBeenCalledWith('chickens');
    expect(deps.setMessage).toHaveBeenCalledWith('Pocket Coop find moved into an editable draft.');
    expect(deps.setMessage).toHaveBeenCalledWith('Pocket Coop find saved locally.');
    expect(deps.setMessage).toHaveBeenCalledWith('Pocket Coop find marked worth saving.');
    expect(deps.loadDashboard).toHaveBeenCalledTimes(3);
  });

  it('publishes drafts with sound feedback and clears local edits afterward', async () => {
    const deps = makeDeps();
    const draft = makeDraft();
    sendRuntimeMessageMock.mockResolvedValue({ ok: true, soundEvent: 'artifact-published' });

    const { result } = renderHook(() => useDraftEditor(deps));

    act(() => {
      result.current.updateDraft(draft as never, { title: 'Edited before publish' });
      result.current.setAnonymousPublish(true);
    });

    await act(async () => {
      await result.current.publishDraft(draft as never);
    });

    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
      type: 'publish-draft',
      payload: {
        draft: expect.objectContaining({ title: 'Edited before publish' }),
        targetCoopIds: ['coop-1'],
        anonymous: true,
      },
    });
    expect(playCoopSoundMock).toHaveBeenCalledWith('artifact-published', deps.soundPreferences);
    expect(deps.setMessage).toHaveBeenCalledWith('Opportunity just landed in the feed!');
    expect(result.current.draftEdits[draft.id]).toBeUndefined();
    expect(deps.loadDashboard).toHaveBeenCalledTimes(1);
  });

  it('updates a draft save mark and surfaces runtime errors', async () => {
    const deps = makeDeps();
    const draft = makeDraft();
    sendRuntimeMessageMock
      .mockResolvedValueOnce({
        ok: true,
        data: {
          ...draft,
          archiveWorthiness: { flagged: false, flaggedAt: '2026-03-28T01:00:00.000Z' },
        },
      })
      .mockResolvedValueOnce({ ok: false, error: 'publish broke' });

    const { result } = renderHook(() => useDraftEditor(deps));

    await act(async () => {
      await result.current.toggleDraftArchiveWorthiness(draft as never);
      await result.current.publishDraft(draft as never);
    });

    expect(deps.setMessage).toHaveBeenCalledWith('Draft save mark removed.');
    expect(deps.setMessage).toHaveBeenCalledWith('publish broke');
  });
});
