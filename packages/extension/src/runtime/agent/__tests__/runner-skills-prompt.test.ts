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
    if (!fixture) {
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
});
