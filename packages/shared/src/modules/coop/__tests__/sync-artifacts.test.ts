import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import type { Artifact } from '../../../contracts/schema';
import { createCoop } from '../flows';
import {
  compactCoopArtifacts,
  createCoopDoc,
  observeArtifacts,
  readCoopState,
  writeCoopState,
} from '../sync';

const defaultSetupInsights = {
  summary: 'A concise but valid setup payload for sync artifact testing.',
  crossCuttingPainPoints: ['Context drifts'],
  crossCuttingOpportunities: ['Shared state stays typed'],
  lenses: [
    {
      lens: 'capital-formation' as const,
      currentState: 'Links are scattered.',
      painPoints: 'Funding context disappears.',
      improvements: 'Route leads into shared state.',
    },
    {
      lens: 'impact-reporting' as const,
      currentState: 'Reporting is rushed.',
      painPoints: 'Evidence gets dropped.',
      improvements: 'Collect evidence incrementally.',
    },
    {
      lens: 'governance-coordination' as const,
      currentState: 'Calls happen weekly.',
      painPoints: 'Actions slip.',
      improvements: 'Review actions through the board.',
    },
    {
      lens: 'knowledge-garden-resources' as const,
      currentState: 'Resources live in tabs.',
      painPoints: 'Research repeats.',
      improvements: 'Persist high-signal references.',
    },
  ],
};

/** Build a valid CoopSharedState via createCoop, optionally replacing artifacts. */
function buildTestState(artifactOverrides?: Partial<Artifact>[]) {
  const { state } = createCoop({
    coopName: 'Test Coop',
    purpose: 'Unit testing per-artifact sync migration.',
    creatorDisplayName: 'Tester',
    captureMode: 'manual',
    seedContribution: 'Testing seed contribution.',
    setupInsights: defaultSetupInsights,
  });

  if (artifactOverrides) {
    state.artifacts = artifactOverrides.map((override, i) => ({
      id: override.id ?? `artifact-${i}`,
      originId: `origin-${i}`,
      targetCoopId: state.profile.id,
      title: `Artifact ${i}`,
      summary: `Summary for artifact ${i}`,
      sources: [{ label: 'test', url: 'https://test.com', domain: 'test.com' }],
      tags: [],
      category: 'insight' as const,
      whyItMatters: 'test relevance',
      suggestedNextStep: 'test next step',
      createdBy: state.members[0].id,
      createdAt: override.createdAt ?? new Date(2026, 0, i + 1).toISOString(),
      reviewStatus: 'published' as const,
      archiveStatus: 'not-archived' as const,
      archiveReceiptIds: [],
      attachments: [],
      ...override,
    }));
  }

  return state;
}

describe('Yjs per-artifact map migration', () => {
  it('write + read round-trip preserves artifacts', () => {
    const state = buildTestState([
      { id: 'a1', title: 'First' },
      { id: 'a2', title: 'Second' },
    ]);

    const doc = new Y.Doc();
    writeCoopState(doc, state);
    const result = readCoopState(doc);

    expect(result.artifacts).toHaveLength(2);
    expect(result.artifacts.map((a) => a.id).sort()).toEqual(['a1', 'a2']);
  });

  it('prefers per-artifact map over old format when both present', () => {
    const state = buildTestState([{ id: 'a1', title: 'NewFormat' }]);
    const doc = new Y.Doc();
    writeCoopState(doc, state);

    // Tamper with old format to have different data
    const root = doc.getMap<string>('coop');
    root.set('artifacts', JSON.stringify([{ ...state.artifacts[0], title: 'OldFormat' }]));

    const result = readCoopState(doc);
    // New format should win because the per-artifact map is populated
    expect(result.artifacts[0].title).toBe('NewFormat');
  });

  it('falls back to old format when per-artifact map is empty', () => {
    const state = buildTestState([{ id: 'a1', title: 'OldOnly' }]);
    const doc = new Y.Doc();

    // Write ONLY the old format (bypass writeCoopState to skip per-artifact map)
    const root = doc.getMap<string>('coop');
    doc.transact(() => {
      root.set('profile', JSON.stringify(state.profile));
      root.set('setupInsights', JSON.stringify(state.setupInsights));
      root.set('soul', JSON.stringify(state.soul));
      root.set('rituals', JSON.stringify(state.rituals));
      root.set('members', JSON.stringify(state.members));
      root.set('invites', JSON.stringify(state.invites));
      root.set('artifacts', JSON.stringify(state.artifacts));
      root.set('reviewBoard', JSON.stringify(state.reviewBoard));
      root.set('archiveReceipts', JSON.stringify(state.archiveReceipts));
      root.set('memoryProfile', JSON.stringify(state.memoryProfile));
      root.set('syncRoom', JSON.stringify(state.syncRoom));
      root.set('onchainState', JSON.stringify(state.onchainState));
      root.set('greenGoods', JSON.stringify(state.greenGoods));
      root.set('archiveConfig', JSON.stringify(state.archiveConfig));
      root.set('memberCommitments', JSON.stringify(state.memberCommitments));
    });

    // Don't write to the per-artifact map — readCoopState should fall back
    const result = readCoopState(doc);
    expect(result.artifacts[0].title).toBe('OldOnly');
  });

  it('removes deleted artifacts from per-artifact map', () => {
    const state = buildTestState([{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }]);
    const doc = new Y.Doc();
    writeCoopState(doc, state);

    // Verify all 3 exist
    const artifactsMap = doc.getMap<string>('coop-artifacts');
    expect(artifactsMap.size).toBe(3);

    // Remove one artifact and rewrite
    state.artifacts = state.artifacts.filter((a) => a.id !== 'a2');
    writeCoopState(doc, state);

    expect(artifactsMap.size).toBe(2);
    expect(artifactsMap.has('a2')).toBe(false);
  });

  it('concurrent publishes to separate docs merge correctly', () => {
    const state = buildTestState([{ id: 'a1', title: 'Original' }]);

    // Create two docs and sync initial state
    const doc1 = new Y.Doc();
    writeCoopState(doc1, state);

    const doc2 = new Y.Doc();
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

    // Each doc adds a different artifact
    const state1 = readCoopState(doc1);
    state1.artifacts.push({
      ...state1.artifacts[0],
      id: 'a2',
      title: 'From Doc1',
    });
    writeCoopState(doc1, state1);

    const state2 = readCoopState(doc2);
    state2.artifacts.push({
      ...state2.artifacts[0],
      id: 'a3',
      title: 'From Doc2',
    });
    writeCoopState(doc2, state2);

    // Merge updates in both directions
    Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2));
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

    // Both docs should see all 3 artifacts from per-artifact map
    const result1 = readCoopState(doc1);
    const result2 = readCoopState(doc2);

    expect(result1.artifacts).toHaveLength(3);
    expect(result2.artifacts).toHaveLength(3);
    expect(result1.artifacts.map((a) => a.id).sort()).toEqual(['a1', 'a2', 'a3']);
  });

  it('v2 per-field Y.Map allows independent field updates without full-artifact clobber', () => {
    const state = buildTestState([{ id: 'a1', title: 'Original', tags: ['alpha'] }]);

    const doc = new Y.Doc();
    writeCoopState(doc, state);

    // Directly update only the 'title' field in the v2 map (simulating a partial write)
    const artifactsV2 = doc.getMap<Y.Map<string>>('coop-artifacts-v2');
    const fieldMap = artifactsV2.get('a1');
    expect(fieldMap).toBeDefined();

    // Update only 'title' — 'tags' remains untouched
    (fieldMap as Y.Map<string>).set('title', JSON.stringify('Updated Title'));

    const result = readCoopState(doc);
    expect(result.artifacts[0].title).toBe('Updated Title');
    expect(result.artifacts[0].tags).toEqual(['alpha']); // unchanged
  });

  it('v2 format is populated by writeCoopState alongside v1', () => {
    const state = buildTestState([{ id: 'a1', title: 'Test' }]);
    const doc = new Y.Doc();
    writeCoopState(doc, state);

    const artifactsV2 = doc.getMap<Y.Map<string>>('coop-artifacts-v2');
    expect(artifactsV2.size).toBe(1);

    const fieldMap = artifactsV2.get('a1');
    expect(fieldMap).toBeDefined();
    expect(JSON.parse((fieldMap as Y.Map<string>).get('title') ?? '')).toBe('Test');
  });

  it('createCoopDoc initialises both old and new format', () => {
    const state = buildTestState([{ id: 'a1' }]);
    const doc = createCoopDoc(state);

    // New format populated
    const artifactsMap = doc.getMap<string>('coop-artifacts');
    expect(artifactsMap.size).toBe(1);
    expect(artifactsMap.has('a1')).toBe(true);

    // Old format also populated (dual-write)
    const root = doc.getMap<string>('coop');
    const oldArtifacts = JSON.parse(root.get('artifacts') ?? '[]');
    expect(oldArtifacts).toHaveLength(1);
  });
});

describe('observeArtifacts', () => {
  it('calls callback when artifacts change', () => {
    const state = buildTestState([{ id: 'a1' }]);
    const doc = new Y.Doc();
    writeCoopState(doc, state);

    const callback = vi.fn();
    const unsubscribe = observeArtifacts(doc, callback);

    // Add an artifact through writeCoopState so all formats are updated
    const nextState = readCoopState(doc);
    nextState.artifacts.push({
      ...nextState.artifacts[0],
      id: 'a2',
      title: 'New Artifact',
    });
    writeCoopState(doc, nextState);

    expect(callback).toHaveBeenCalled();
    const lastArtifacts = callback.mock.calls.at(-1)?.[0];
    expect(lastArtifacts).toHaveLength(2);

    unsubscribe();
  });

  it('stops calling after unsubscribe', () => {
    const state = buildTestState([]);
    const doc = new Y.Doc();
    writeCoopState(doc, state);

    const callback = vi.fn();
    const unsubscribe = observeArtifacts(doc, callback);
    unsubscribe();

    // Modify after unsubscribe
    const artifactsMap = doc.getMap<string>('coop-artifacts');
    artifactsMap.set(
      'a1',
      JSON.stringify({
        id: 'a1',
        originId: 'o1',
        targetCoopId: 'coop-1',
        title: 'Ghost',
        summary: 'Should not trigger',
        sources: [{ label: 'x', url: 'https://x.com', domain: 'x.com' }],
        tags: [],
        category: 'insight',
        whyItMatters: 'x',
        suggestedNextStep: 'x',
        createdBy: 'member-1',
        createdAt: new Date().toISOString(),
        reviewStatus: 'published',
        archiveStatus: 'not-archived',
        archiveReceiptIds: [],
        attachments: [],
      }),
    );

    expect(callback).not.toHaveBeenCalled();
  });

  it('delivers correct artifacts when entries are deleted', () => {
    const state = buildTestState([{ id: 'a1' }, { id: 'a2' }]);
    const doc = new Y.Doc();
    writeCoopState(doc, state);

    const callback = vi.fn();
    const unsubscribe = observeArtifacts(doc, callback);

    // Remove via writeCoopState so all formats are consistent
    const nextState = readCoopState(doc);
    nextState.artifacts = nextState.artifacts.filter((a) => a.id !== 'a1');
    writeCoopState(doc, nextState);

    expect(callback).toHaveBeenCalled();
    const lastCall = callback.mock.calls.at(-1)?.[0];
    expect(lastCall).toHaveLength(1);
    expect(lastCall[0].id).toBe('a2');

    unsubscribe();
  });
});

describe('compactCoopArtifacts', () => {
  it('compacts artifacts beyond the count limit', () => {
    // Create 5 artifacts, limit to 3
    const artifacts = Array.from({ length: 5 }, (_, i) => ({
      id: `a${i}`,
      createdAt: new Date(2026, 0, i + 1).toISOString(), // a0=Jan1 ... a4=Jan5
    }));
    const state = buildTestState(artifacts);
    const doc = new Y.Doc();
    writeCoopState(doc, state);

    const result = compactCoopArtifacts({
      doc,
      state,
      maxLiveArtifacts: 3,
      maxAgeDays: 9999, // don't trigger age limit
    });

    // Newest 3 kept (a4, a3, a2), oldest 2 archived (a0, a1)
    expect(result.archivedIds).toHaveLength(2);
    expect(result.remainingCount).toBe(3);
    expect(result.archivedIds.sort()).toEqual(['a0', 'a1']);

    // Verify doc state
    const afterState = readCoopState(doc);
    expect(afterState.artifacts).toHaveLength(3);
  });

  it('compacts artifacts beyond age limit', () => {
    const now = new Date();
    const old = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000); // 100 days ago

    const state = buildTestState([
      { id: 'old', createdAt: old.toISOString() },
      { id: 'new', createdAt: now.toISOString() },
    ]);
    const doc = new Y.Doc();
    writeCoopState(doc, state);

    const result = compactCoopArtifacts({
      doc,
      state,
      maxLiveArtifacts: 999,
      maxAgeDays: 90,
    });

    expect(result.archivedIds).toEqual(['old']);
    expect(result.remainingCount).toBe(1);
  });

  it('returns empty when all artifacts within limits', () => {
    const state = buildTestState([{ id: 'a1', createdAt: new Date().toISOString() }]);
    const doc = new Y.Doc();
    writeCoopState(doc, state);

    const result = compactCoopArtifacts({ doc, state });

    expect(result.archivedIds).toHaveLength(0);
    expect(result.remainingCount).toBe(1);
  });

  it('never evicts artifacts below count limit', () => {
    const state = buildTestState([
      { id: 'a1', createdAt: new Date().toISOString() },
      { id: 'a2', createdAt: new Date().toISOString() },
    ]);
    const doc = new Y.Doc();
    writeCoopState(doc, state);

    const result = compactCoopArtifacts({
      doc,
      state,
      maxLiveArtifacts: 200,
    });

    expect(result.archivedIds).toHaveLength(0);
  });

  it('removes compacted entries from the per-artifact Y.Map', () => {
    const artifacts = Array.from({ length: 4 }, (_, i) => ({
      id: `a${i}`,
      createdAt: new Date(2026, 0, i + 1).toISOString(),
    }));
    const state = buildTestState(artifacts);
    const doc = new Y.Doc();
    writeCoopState(doc, state);

    compactCoopArtifacts({ doc, state, maxLiveArtifacts: 2, maxAgeDays: 9999 });

    const artifactsMap = doc.getMap<string>('coop-artifacts');
    expect(artifactsMap.size).toBe(2);
    expect(artifactsMap.has('a0')).toBe(false);
    expect(artifactsMap.has('a1')).toBe(false);
    expect(artifactsMap.has('a2')).toBe(true);
    expect(artifactsMap.has('a3')).toBe(true);
  });

  it('applies both age and count limits simultaneously', () => {
    const now = new Date();
    const ancient = new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000);
    const recent = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

    // 4 artifacts: 2 ancient, 2 recent. Limit to 3 by count, 30 days by age.
    const state = buildTestState([
      { id: 'ancient-1', createdAt: ancient.toISOString() },
      { id: 'ancient-2', createdAt: new Date(ancient.getTime() + 1000).toISOString() },
      { id: 'recent-1', createdAt: recent.toISOString() },
      { id: 'recent-2', createdAt: now.toISOString() },
    ]);
    const doc = new Y.Doc();
    writeCoopState(doc, state);

    const result = compactCoopArtifacts({
      doc,
      state,
      maxLiveArtifacts: 3,
      maxAgeDays: 30,
    });

    // Both ancient artifacts evicted by age; count limit alone would keep 3
    expect(result.archivedIds.sort()).toEqual(['ancient-1', 'ancient-2']);
    expect(result.remainingCount).toBe(2);
  });
});
