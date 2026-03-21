import { describe, expect, it } from 'vitest';
import { loadSkillEvalCases, runAllSkillEvals } from '../agent-eval';

describe('skill eval harness', () => {
  it('loads representative eval fixtures for key skills', () => {
    const testCases = loadSkillEvalCases();

    expect(testCases.length).toBeGreaterThanOrEqual(5);
    expect(testCases.map((testCase) => testCase.skillId)).toEqual(
      expect.arrayContaining([
        'opportunity-extractor',
        'grant-fit-scorer',
        'capital-formation-brief',
        'publish-readiness-check',
        'review-digest',
      ]),
    );
  });

  it('passes all structural skill evals', () => {
    const results = runAllSkillEvals();
    const failures = results.filter((result) => !result.passed);

    expect(failures).toEqual([]);
  });
});
