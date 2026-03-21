import type { AgentObservation, KnowledgeSkill } from '@coop/shared';
import {
  createCoopDb,
  createId,
  hashJson,
  nowIso,
  saveCoopKnowledgeSkillOverride,
  saveKnowledgeSkill,
} from '@coop/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseSkillMd, selectKnowledgeSkills } from '../agent-knowledge';

// --- parseSkillMd ---

describe('parseSkillMd', () => {
  it('parses valid YAML frontmatter and markdown body', () => {
    const raw = `---
name: gas
description: Current Ethereum gas prices and fee estimates
---

# Gas Price Skill

Returns the current gas price from Etherscan.`;

    const result = parseSkillMd(raw);

    expect(result.frontmatter.name).toBe('gas');
    expect(result.frontmatter.description).toBe('Current Ethereum gas prices and fee estimates');
    expect(result.body).toContain('# Gas Price Skill');
    expect(result.body).toContain('Returns the current gas price from Etherscan.');
  });

  it('handles missing frontmatter gracefully', () => {
    const raw = `# Just Markdown

No frontmatter here.`;

    const result = parseSkillMd(raw);

    expect(result.frontmatter.name).toBe('');
    expect(result.frontmatter.description).toBe('');
    expect(result.body).toContain('# Just Markdown');
    expect(result.body).toContain('No frontmatter here.');
  });

  it('handles partial frontmatter with only name', () => {
    const raw = `---
name: weather
---

Check the weather forecast.`;

    const result = parseSkillMd(raw);

    expect(result.frontmatter.name).toBe('weather');
    expect(result.frontmatter.description).toBe('');
    expect(result.body).toContain('Check the weather forecast.');
  });

  it('handles partial frontmatter with only description', () => {
    const raw = `---
description: A helpful skill
---

Body content here.`;

    const result = parseSkillMd(raw);

    expect(result.frontmatter.name).toBe('');
    expect(result.frontmatter.description).toBe('A helpful skill');
    expect(result.body).toContain('Body content here.');
  });

  it('handles empty input', () => {
    const result = parseSkillMd('');

    expect(result.frontmatter.name).toBe('');
    expect(result.frontmatter.description).toBe('');
    expect(result.body).toBe('');
  });

  it('handles frontmatter with no body after it', () => {
    const raw = `---
name: minimal
description: No body
---`;

    const result = parseSkillMd(raw);

    expect(result.frontmatter.name).toBe('minimal');
    expect(result.frontmatter.description).toBe('No body');
    expect(result.body).toBe('');
  });

  it('handles values with colons', () => {
    const raw = `---
name: api-skill
description: Calls API: fetches data from endpoints
---

Body.`;

    const result = parseSkillMd(raw);

    expect(result.frontmatter.name).toBe('api-skill');
    expect(result.frontmatter.description).toBe('Calls API: fetches data from endpoints');
  });
});

// --- selectKnowledgeSkills ---

describe('selectKnowledgeSkills', () => {
  const dbName = `test-agent-knowledge-${Date.now()}`;
  let db: ReturnType<typeof createCoopDb>;

  let skillCounter = 0;

  function makeSkill(overrides: Partial<KnowledgeSkill>): KnowledgeSkill {
    skillCounter++;
    return {
      id: overrides.id ?? createId('knowledge-skill'),
      url: overrides.url ?? `https://example.com/skill-${skillCounter}/SKILL.md`,
      name: overrides.name ?? 'test-skill',
      description: overrides.description ?? 'A test skill',
      domain: overrides.domain ?? 'general',
      content: overrides.content ?? '# Test skill content',
      contentHash: overrides.contentHash ?? hashJson('test'),
      fetchedAt: overrides.fetchedAt ?? nowIso(),
      enabled: overrides.enabled ?? true,
      triggerPatterns: overrides.triggerPatterns ?? [],
    };
  }

  function makeObservation(overrides: Partial<AgentObservation> = {}): AgentObservation {
    return {
      id: overrides.id ?? 'obs-1',
      trigger: overrides.trigger ?? 'tab-capture',
      status: overrides.status ?? 'pending',
      title: overrides.title ?? 'New tab captured',
      summary: overrides.summary ?? 'User opened a page about Ethereum gas fees',
      coopId: overrides.coopId,
      draftId: overrides.draftId,
      extractId: overrides.extractId,
      receiptId: overrides.receiptId,
      captureId: overrides.captureId,
      artifactId: overrides.artifactId,
      fingerprint: overrides.fingerprint ?? 'fp-1',
      payload: overrides.payload ?? {},
      createdAt: overrides.createdAt ?? nowIso(),
      updatedAt: overrides.updatedAt ?? nowIso(),
    };
  }

  beforeEach(() => {
    skillCounter = 0;
    db = createCoopDb(dbName);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('returns enabled skills that match observation by trigger patterns', async () => {
    const gasSkill = makeSkill({
      id: 'skill-gas',
      name: 'gas',
      triggerPatterns: ['gas', 'ethereum', 'fee'],
      enabled: true,
    });
    const weatherSkill = makeSkill({
      id: 'skill-weather',
      name: 'weather',
      triggerPatterns: ['weather', 'forecast'],
      enabled: true,
    });
    await saveKnowledgeSkill(db, gasSkill);
    await saveKnowledgeSkill(db, weatherSkill);

    const obs = makeObservation({
      title: 'Ethereum gas tracker',
      summary: 'Page about current gas fees on Ethereum',
    });

    const result = await selectKnowledgeSkills(obs, undefined, db);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].id).toBe('skill-gas');
    // Weather skill should not match gas-related observation
    const weatherInResult = result.find((s) => s.id === 'skill-weather');
    expect(weatherInResult).toBeUndefined();
  });

  it('excludes disabled skills', async () => {
    const disabledSkill = makeSkill({
      id: 'skill-disabled',
      name: 'disabled',
      triggerPatterns: ['gas', 'ethereum'],
      enabled: false,
    });
    await saveKnowledgeSkill(db, disabledSkill);

    const obs = makeObservation({
      title: 'Ethereum gas fees',
      summary: 'Gas fee data',
    });

    const result = await selectKnowledgeSkills(obs, undefined, db);

    expect(result).toHaveLength(0);
  });

  it('applies per-coop overrides to disable a globally enabled skill', async () => {
    const skill = makeSkill({
      id: 'skill-override',
      name: 'gas',
      triggerPatterns: ['gas'],
      enabled: true,
    });
    await saveKnowledgeSkill(db, skill);
    await saveCoopKnowledgeSkillOverride(db, {
      id: 'override-1',
      coopId: 'coop-1',
      knowledgeSkillId: 'skill-override',
      enabled: false,
    });

    const obs = makeObservation({
      title: 'Gas prices',
      summary: 'gas fee tracker',
    });

    const result = await selectKnowledgeSkills(obs, 'coop-1', db);

    expect(result).toHaveLength(0);
  });

  it('applies per-coop overrides to enable a globally disabled skill', async () => {
    const skill = makeSkill({
      id: 'skill-reenable',
      name: 'gas',
      triggerPatterns: ['gas'],
      enabled: false,
    });
    await saveKnowledgeSkill(db, skill);
    await saveCoopKnowledgeSkillOverride(db, {
      id: 'override-2',
      coopId: 'coop-2',
      knowledgeSkillId: 'skill-reenable',
      enabled: true,
    });

    const obs = makeObservation({
      title: 'Gas prices',
      summary: 'gas fee tracker',
    });

    const result = await selectKnowledgeSkills(obs, 'coop-2', db);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].id).toBe('skill-reenable');
  });

  it('uses per-coop trigger-pattern overrides without leaking them across coops', async () => {
    const skill = makeSkill({
      id: 'skill-salmon',
      name: 'watershed-playbook',
      triggerPatterns: ['river'],
      enabled: true,
    });
    await saveKnowledgeSkill(db, skill);
    await saveCoopKnowledgeSkillOverride(db, {
      id: 'override-3',
      coopId: 'coop-1',
      knowledgeSkillId: 'skill-salmon',
      enabled: true,
      triggerPatterns: ['salmon'],
    });

    const obs = makeObservation({
      title: 'Salmon restoration briefing',
      summary: 'Field notes on watershed recovery',
    });

    const coopOverrideResult = await selectKnowledgeSkills(obs, 'coop-1', db);
    const otherCoopResult = await selectKnowledgeSkills(obs, 'coop-2', db);

    expect(coopOverrideResult.map((entry) => entry.id)).toContain('skill-salmon');
    expect(otherCoopResult.map((entry) => entry.id)).not.toContain('skill-salmon');
  });

  it('returns at most 3 skills', async () => {
    const skills = Array.from({ length: 5 }, (_, i) =>
      makeSkill({
        id: `skill-${i}`,
        name: `skill-${i}`,
        triggerPatterns: ['common'],
        enabled: true,
      }),
    );
    for (const s of skills) {
      await saveKnowledgeSkill(db, s);
    }

    const obs = makeObservation({
      title: 'common topic',
      summary: 'a common summary',
    });

    const result = await selectKnowledgeSkills(obs, undefined, db);

    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('returns empty array when no skills exist', async () => {
    const obs = makeObservation();
    const result = await selectKnowledgeSkills(obs, undefined, db);
    expect(result).toEqual([]);
  });
});
