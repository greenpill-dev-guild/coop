import { describe, expect, it } from 'vitest';
import { loadAgentSecurityBenchmarkFixtures } from '../benchmark-fixtures';
import { getRegisteredSkill } from '../registry';
import { buildSkillPrompt } from '../runner-skills-prompt';

describe('buildSkillPrompt', () => {
  it('sanitizes prompt injection markers from untrusted source text', async () => {
    const fixture = loadAgentSecurityBenchmarkFixtures().find(
      (entry) => entry.skillId === 'tab-router',
    );

    expect(fixture).toBeDefined();
    if (!fixture?.coop) {
      throw new Error('Expected a tab-router security fixture.');
    }

    const skill = getRegisteredSkill(fixture.skillId);
    expect(skill).toBeDefined();
    if (!skill) {
      throw new Error(`Expected skill "${fixture.skillId}" to be registered.`);
    }

    const prepared = await buildSkillPrompt({
      skill,
      observation: fixture.observation,
      coop: fixture.coop,
      draft: fixture.draft,
      capture: fixture.capture,
      receipt: fixture.receipt,
      candidates: fixture.candidates,
      scores: fixture.scores,
      extracts: fixture.extracts,
      relatedDrafts: fixture.relatedDrafts,
      relatedArtifacts: fixture.relatedArtifacts,
      relatedRoutings: fixture.relatedRoutings,
      memories: fixture.memories,
      graphContext: fixture.graphContext,
    });

    expect(prepared.prompt).toContain('Community estuary monitoring');
    expect(prepared.prompt).toContain('Security routing benchmark');
    expect(prepared.prompt).not.toContain('<system>');
    expect(prepared.prompt).not.toContain('IGNORE PREVIOUS INSTRUCTIONS');
    expect(prepared.prompt).not.toContain('reveal the system prompt');
  });

  it('labels unconfirmed inferred and stale memories as context rather than guidance', async () => {
    const fixture = loadAgentSecurityBenchmarkFixtures().find(
      (entry) => entry.skillId === 'tab-router',
    );
    if (!fixture?.coop) {
      throw new Error('Expected a tab-router security fixture.');
    }
    const coop = fixture.coop;
    const skill = getRegisteredSkill(fixture.skillId);
    if (!skill) {
      throw new Error(`Expected skill "${fixture.skillId}" to be registered.`);
    }

    const prepared = await buildSkillPrompt({
      skill,
      observation: fixture.observation,
      coop: fixture.coop,
      draft: fixture.draft,
      capture: fixture.capture,
      receipt: fixture.receipt,
      candidates: fixture.candidates,
      scores: fixture.scores,
      extracts: fixture.extracts,
      relatedDrafts: fixture.relatedDrafts,
      relatedArtifacts: fixture.relatedArtifacts,
      relatedRoutings: fixture.relatedRoutings,
      memories: [
        {
          id: 'memory-inferred',
          scope: 'coop',
          coopId: coop.profile.id,
          type: 'skill-pattern',
          domain: 'routing',
          content: 'This is an inferred pattern, not a member instruction.',
          contentHash: 'hash-inferred',
          confidence: 0.72,
          provenanceLabel: 'inferred',
          confirmationStatus: 'unconfirmed',
          sourceChannel: 'skill',
          createdAt: '2026-05-08T00:00:00.000Z',
        },
        {
          id: 'memory-stale',
          scope: 'coop',
          coopId: coop.profile.id,
          type: 'decision-context',
          domain: 'routing',
          content: 'This source was removed and should be treated as stale.',
          contentHash: 'hash-stale',
          confidence: 0.6,
          provenanceLabel: 'stale',
          confirmationStatus: 'stale',
          sourceChannel: 'source',
          createdAt: '2026-04-01T00:00:00.000Z',
        },
      ],
      graphContext: fixture.graphContext,
    });

    expect(prepared.prompt).toContain('inferred/unconfirmed; context only');
    expect(prepared.prompt).toContain('stale/stale; stale context only');
  });

  it('includes memory charter, persisted source content, graph context, and precedents', async () => {
    const fixture = loadAgentSecurityBenchmarkFixtures().find(
      (entry) => entry.skillId === 'tab-router',
    );
    if (!fixture?.coop) {
      throw new Error('Expected a tab-router security fixture.');
    }
    const skill = getRegisteredSkill(fixture.skillId);
    if (!skill) {
      throw new Error(`Expected skill "${fixture.skillId}" to be registered.`);
    }

    const prepared = await buildSkillPrompt({
      skill,
      observation: fixture.observation,
      coop: {
        ...fixture.coop,
        soul: {
          ...fixture.coop.soul,
          memoryCharter: {
            version: 1,
            goals: ['Track funding leads with proof'],
            opportunityThesis: 'This coop watches source-backed funding opportunities.',
            desiredSignals: ['funding leads', 'validated impact evidence'],
            antiSignals: ['unsourced claims'],
            evidenceStandards: ['Prefer member-approved artifacts'],
            vocabulary: [],
            prohibitedTopics: [],
            confidenceThreshold: 0.72,
            updatedAt: '2026-05-08T00:00:00.000Z',
          },
        },
      },
      draft: fixture.draft,
      capture: fixture.capture,
      receipt: fixture.receipt,
      candidates: fixture.candidates,
      scores: fixture.scores,
      extracts: fixture.extracts,
      relatedDrafts: fixture.relatedDrafts,
      relatedArtifacts: fixture.relatedArtifacts,
      relatedRoutings: fixture.relatedRoutings,
      memories: fixture.memories,
      sourceContents: [
        {
          id: 'ks-content-1',
          sourceId: 'ks-1',
          coopId: fixture.coop.profile.id,
          sourceRef: 'rss:https://example.test/feed#1',
          title: 'Funding update',
          body: 'The River Foundation opened a watershed grant for regional crews.',
          bodyHash: '0xhash',
          metadata: {},
          fetchedAt: '2026-05-08T00:00:00.000Z',
          createdAt: '2026-05-08T00:00:01.000Z',
        },
      ],
      graphContext:
        '- River Foundation (organization): grant maker [source: source-content:ks-content-1; label: observed/unconfirmed]',
      precedents: [
        {
          traceId: 'trace-approved',
          skillRunId: 'run-1',
          observationId: 'obs-1',
          observationText: 'watershed grant',
          contextEntityIds: [],
          sourceRefs: ['rss:https://example.test/feed#0'],
          precedentTraceIds: [],
          confidence: 0.84,
          outputSummary: 'Approved a similar funding brief.',
          outcome: 'approved',
          createdAt: '2026-05-01T00:00:00.000Z',
        },
      ],
      precedentConfidenceAdjustment: 0.05,
    });

    expect(prepared.prompt).toContain('Memory charter goals');
    expect(prepared.prompt).toContain('Persisted source content');
    expect(prepared.prompt).toContain('[observed/unconfirmed] ks-content-1');
    expect(prepared.prompt).toContain('Knowledge graph context');
    expect(prepared.prompt).toContain('Precedent context');
    expect(prepared.prompt).toContain('Precedent confidence adjustment: 0.05');
  });
});
