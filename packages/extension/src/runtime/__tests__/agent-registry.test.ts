import { describe, expect, it } from 'vitest';
import { getRegisteredSkill, listRegisteredSkills } from '../agent-registry';

describe('agent skill registry', () => {
  it('loads bundled skills with manifests and instructions', () => {
    const skills = listRegisteredSkills();

    expect(skills.length).toBeGreaterThanOrEqual(10);
    expect(skills.map((entry) => entry.manifest.id)).toEqual(
      expect.arrayContaining([
        'opportunity-extractor',
        'grant-fit-scorer',
        'capital-formation-brief',
        'review-digest',
        'ecosystem-entity-extractor',
        'theme-clusterer',
        'publish-readiness-check',
        'green-goods-work-approval',
        'green-goods-assessment',
        'green-goods-gap-admin-sync',
      ]),
    );
    for (const entry of skills) {
      expect(entry.manifest.inputSchemaRef).toBe('agent-observation');
      expect(entry.instructions.length).toBeGreaterThan(16);
    }
  });

  it('returns a skill by id', () => {
    const skill = getRegisteredSkill('review-digest');

    expect(skill?.manifest.outputSchemaRef).toBe('review-digest-output');
    expect(skill?.instructions).toContain('Synthesize');
  });
});
