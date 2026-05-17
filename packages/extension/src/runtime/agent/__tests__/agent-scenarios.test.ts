import { describe, expect, it } from 'vitest';
import {
  REQUIRED_SKILL_EVAL_SCENARIO_IDS,
  loadSkillEvalScenarios,
  runAllSkillEvalScenarios,
} from '../eval-scenarios';
import { getRegisteredSkill } from '../registry';

describe('skill eval input/output scenarios', () => {
  it('loads the required core and memory-adjacent scenario pack', () => {
    const scenarios = loadSkillEvalScenarios();
    const coveredSkillIds = new Set(scenarios.map((scenario) => scenario.skillId));

    for (const skillId of REQUIRED_SKILL_EVAL_SCENARIO_IDS) {
      expect(coveredSkillIds.has(skillId)).toBe(true);
    }
  });

  it('keeps scenario ids unique and registered', () => {
    const scenarios = loadSkillEvalScenarios();
    const ids = scenarios.map((scenario) => scenario.id);

    expect(new Set(ids).size).toBe(ids.length);

    for (const scenario of scenarios) {
      expect(getRegisteredSkill(scenario.skillId)).toBeDefined();
      expect(scenario.tags).toContain('scenario-pack');
    }
  });

  it('passes deterministic scenario output, prompt, confidence, and memory checks', async () => {
    const results = await runAllSkillEvalScenarios();
    const failures = results.filter((result) => !result.passed);

    expect(
      failures.map((failure) => ({
        id: failure.scenarioId,
        skillId: failure.skillId,
        failures: failure.failures,
      })),
    ).toEqual([]);
  });

  it('includes malicious/noisy prompt-injection coverage', async () => {
    const scenarios = loadSkillEvalScenarios();
    const malicious = scenarios.filter((scenario) => scenario.fixtureType === 'malicious');

    expect(malicious).toHaveLength(1);
    expect(malicious[0]?.tags).toContain('security-pack');

    const [result] = await runAllSkillEvalScenarios(malicious);
    expect(result?.passed).toBe(true);
    expect(result?.promptFailures).toEqual([]);
    expect(result?.memoryEntries.at(0)?.content).not.toMatch(/system prompt|IGNORE/);
  });

  it('distinguishes memory-writing and non-memory-writing skills', async () => {
    const results = await runAllSkillEvalScenarios();
    const bySkill = new Map(results.map((result) => [result.skillId, result]));

    for (const skillId of [
      'tab-router',
      'opportunity-extractor',
      'capital-formation-brief',
      'memory-insight-synthesizer',
      'theme-clusterer',
    ]) {
      expect(bySkill.get(skillId)?.memoryEntries.length).toBeGreaterThan(0);
    }

    for (const skillId of ['entity-extractor', 'ecosystem-entity-extractor', 'knowledge-lint']) {
      expect(bySkill.get(skillId)?.memoryEntries).toHaveLength(0);
    }
  });
});
