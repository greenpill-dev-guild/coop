import type { LocalInferenceCapability, RefineResult } from '@coop/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @coop/shared inference functions (created in a separate task)
vi.mock('@coop/shared', () => ({
  detectLocalInferenceCapability: (input: {
    userOptIn: boolean;
    hasWorker: boolean;
    hasWebGpu: boolean;
    modelReady?: boolean;
    modelLoading?: boolean;
    error?: string;
  }): LocalInferenceCapability => {
    if (!input.userOptIn) {
      return {
        status: 'disabled',
        reason: 'Disabled',
        hasWebGpu: false,
        hasWorker: false,
        userOptIn: false,
      };
    }
    if (!input.hasWorker) {
      return {
        status: 'unavailable',
        reason: 'No worker',
        hasWebGpu: input.hasWebGpu,
        hasWorker: false,
        userOptIn: true,
      };
    }
    if (input.error) {
      return {
        status: 'failed',
        reason: input.error,
        hasWebGpu: input.hasWebGpu,
        hasWorker: true,
        userOptIn: true,
      };
    }
    if (input.modelLoading) {
      return {
        status: 'loading',
        reason: 'Loading model...',
        hasWebGpu: input.hasWebGpu,
        hasWorker: true,
        userOptIn: true,
      };
    }
    if (input.modelReady) {
      return {
        status: 'ready',
        reason: input.hasWebGpu ? 'Ready (WebGPU)' : 'Ready (CPU/WASM)',
        model: 'Qwen2.5-0.5B-Instruct',
        hasWebGpu: input.hasWebGpu,
        hasWorker: true,
        userOptIn: true,
      };
    }
    return {
      status: 'unavailable',
      reason: 'Model not yet loaded',
      hasWebGpu: input.hasWebGpu,
      hasWorker: true,
      userOptIn: true,
    };
  },
  buildRefinePrompt: () => 'Rewrite the following title for River Coop...',
  parseRefineOutput: (
    _request: unknown,
    output: string,
    provider: string,
    model: string | undefined,
    durationMs: number,
  ): RefineResult => ({
    draftId: 'draft-1',
    task: 'title-refinement',
    refinedTitle: output.trim() || undefined,
    provider: provider as 'heuristic' | 'local-model',
    model,
    durationMs,
  }),
  createHeuristicProvider: () => ({
    kind: 'heuristic' as const,
    label: 'Keyword heuristics',
    refine: async () => ({
      draftId: 'draft-1',
      task: 'title-refinement' as const,
      refinedTitle: 'Cleaned title',
      provider: 'heuristic' as const,
      durationMs: 1,
    }),
  }),
}));

// Import after mock is set up
import { InferenceBridge } from '../inference-bridge';

describe('InferenceBridge', () => {
  let bridge: InferenceBridge;

  beforeEach(() => {
    bridge = new InferenceBridge();
  });

  it('starts in disabled state before opt-in', () => {
    const state = bridge.getState();

    expect(state.capability.status).toBe('disabled');
    expect(state.capability.userOptIn).toBe(false);
    expect(state.workerReady).toBe(false);
    expect(state.initProgress).toBe(0);
    expect(state.initMessage).toBe('');
  });

  it('handles worker construction failure gracefully on opt-in', () => {
    // In jsdom, Worker constructor will throw -- bridge catches it
    bridge.setOptIn(true);
    const state = bridge.getState();

    // After opt-in with worker failure, the bridge should still reflect
    // an error state rather than crashing
    expect(state.capability.userOptIn).toBe(true);
  });

  it('falls back to heuristic refine when model is not ready', async () => {
    const result = await bridge.refine({
      draftId: 'draft-1',
      task: 'title-refinement',
      title: 'Watershed grant roundup - Home',
      summary: 'A roundup of watershed funding opportunities.',
      tags: ['grant'],
      category: 'funding-lead',
      coopName: 'River Coop',
      coopPurpose: 'Share evidence and funding-ready next steps.',
    });

    expect(result).toBeDefined();
    expect(result.draftId).toBe('draft-1');
    expect(result.provider).toBe('heuristic');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns valid RefineResult from heuristic fallback for summary-compression', async () => {
    const result = await bridge.refine({
      draftId: 'draft-2',
      task: 'summary-compression',
      title: 'Long report',
      summary: 'A very long summary that needs compression for the coop feed.',
      tags: [],
      category: 'evidence',
      coopName: 'Forest Coop',
      coopPurpose: 'Coordinate forest stewardship.',
    });

    expect(result).toBeDefined();
    expect(result.provider).toBe('heuristic');
  });

  it('returns valid RefineResult from heuristic fallback for tag-suggestion', async () => {
    const result = await bridge.refine({
      draftId: 'draft-3',
      task: 'tag-suggestion',
      title: 'Watershed restoration update',
      summary: 'Evidence packet for watershed collaboratives.',
      tags: ['watershed'],
      category: 'insight',
      coopName: 'Watershed Coop',
      coopPurpose: 'Track watershed coordination.',
    });

    expect(result).toBeDefined();
    expect(result.provider).toBe('heuristic');
  });

  it('teardown cleans up worker state and notifies listeners', () => {
    const states: Array<{ capability: LocalInferenceCapability }> = [];

    bridge.subscribe((state) => {
      states.push(state);
    });

    bridge.setOptIn(true);
    bridge.teardown();

    const finalState = bridge.getState();
    // teardown removes the worker but preserves opt-in preference,
    // so status is unavailable (opted in, no worker)
    expect(finalState.capability.status).toBe('unavailable');
    expect(finalState.workerReady).toBe(false);
    expect(finalState.initProgress).toBe(0);
    expect(finalState.initMessage).toBe('');

    // Listeners should have been notified
    expect(states.length).toBeGreaterThan(0);
  });

  it('setOptIn(false) returns to disabled state', () => {
    bridge.setOptIn(true);
    bridge.setOptIn(false);

    const state = bridge.getState();
    expect(state.capability.status).toBe('disabled');
    expect(state.capability.userOptIn).toBe(false);
  });

  it('subscribe returns an unsubscribe function', () => {
    const states: Array<{ capability: LocalInferenceCapability }> = [];

    const unsub = bridge.subscribe((state) => {
      states.push(state);
    });

    bridge.setOptIn(true);
    const countAfterOptIn = states.length;

    unsub();
    bridge.teardown();

    // No new notifications after unsubscribe
    expect(states.length).toBe(countAfterOptIn);
  });

  it('cancel clears pending resolves', () => {
    // With no worker (jsdom), cancel should be safe to call
    bridge.cancel();
    const state = bridge.getState();
    expect(state.capability.status).toBe('disabled');
  });
});
