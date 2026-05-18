import { describe, expect, it } from 'vitest';
import { formatSeededEvalFailure, runSeededCoopRecommendationEval } from './seeded-eval-fixtures';

describe('seeded coop recommendation eval', () => {
  it('routes generated signals to the strongest coop recommendation', () => {
    const result = runSeededCoopRecommendationEval();
    const failures = result.caseResults.filter((caseResult) => !caseResult.passed);

    expect(result.caseCount).toBeGreaterThanOrEqual(32);
    expect(
      failures.map((failure) => formatSeededEvalFailure(failure)),
      failures.map((failure) => formatSeededEvalFailure(failure)).join('\n\n'),
    ).toEqual([]);
  });
});
