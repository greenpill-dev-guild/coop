import type { AgentProvider } from '@coop/shared';
import { describe, expect, it } from 'vitest';
import { loadSkillEvalCases, runAllSkillEvals, runSkillEvalCase } from '../agent/eval';
import type { SkillEvalCase } from '../agent/eval';
import { computeOutputConfidence } from '../agent/quality';
import { getRegisteredSkill, listRegisteredSkills } from '../agent/registry';

const CORE_SKILL_IDS = ['tab-router', 'opportunity-extractor', 'capital-formation-brief'] as const;

function providerForSkill(skillId: string): AgentProvider {
  const registered = getRegisteredSkill(skillId);
  if (!registered) {
    throw new Error(`Skill "${skillId}" is not registered.`);
  }

  switch (registered.manifest.model) {
    case 'heuristic':
      return 'heuristic';
    case 'webllm':
      return 'webllm';
    default:
      return 'transformers';
  }
}

describe('skill eval harness', () => {
  it('loads eval fixtures for all registered skills', () => {
    const testCases = loadSkillEvalCases();
    const registeredSkillIds = listRegisteredSkills()
      .map((entry) => entry.manifest.id)
      .sort();

    expect(testCases.length).toBeGreaterThanOrEqual(registeredSkillIds.length);

    const coveredSkillIds = [...new Set(testCases.map((testCase) => testCase.skillId))].sort();
    expect(coveredSkillIds).toEqual(registeredSkillIds);
  });

  it('passes all structural and semantic skill evals', () => {
    const results = runAllSkillEvals();
    const failures = results.filter((result) => !result.passed);

    expect(failures).toEqual([]);
  });

  it('computes quality scores for all evals', () => {
    const results = runAllSkillEvals();

    for (const result of results) {
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(1);
      expect(result.qualityBreakdown).toBeDefined();
      expect(result.qualityBreakdown.schemaCompliance).toBe(1);
      expect(['golden', 'noisy', 'low-signal', 'malicious']).toContain(result.fixtureType);
      expect(Array.isArray(result.tags)).toBe(true);
    }
  });

  it('covers golden, noisy, and low-signal fixtures for the three core skills', () => {
    const testCases = loadSkillEvalCases();

    for (const skillId of CORE_SKILL_IDS) {
      const skillCases = testCases.filter((testCase) => testCase.skillId === skillId);
      expect(skillCases.length).toBeGreaterThanOrEqual(3);
      expect(skillCases.map((testCase) => testCase.fixtureType)).toEqual(
        expect.arrayContaining(['golden', 'noisy', 'low-signal']),
      );

      for (const testCase of skillCases) {
        expect(typeof testCase.confidenceFloor).toBe('number');
        expect(testCase.confidenceFloor).toBeGreaterThan(0);
        expect(testCase.confidenceFloor).toBeLessThanOrEqual(1);
        if (testCase.fixtureType === 'malicious') {
          expect(testCase.tags).toContain('security-pack');
        } else {
          expect(testCase.tags).toContain('core-pack');
        }
      }
    }
  });

  it('includes malicious security fixtures for the three core skills', () => {
    const testCases = loadSkillEvalCases();

    for (const skillId of CORE_SKILL_IDS) {
      const maliciousCases = testCases.filter(
        (testCase) => testCase.skillId === skillId && testCase.fixtureType === 'malicious',
      );
      expect(maliciousCases).toHaveLength(1);
      expect(maliciousCases[0]?.tags).toContain('security-pack');
    }
  });

  it('keeps the core eval sample outputs above their declared confidence floors', () => {
    const testCases = loadSkillEvalCases().filter((testCase) =>
      CORE_SKILL_IDS.includes(testCase.skillId as (typeof CORE_SKILL_IDS)[number]),
    );

    for (const testCase of testCases) {
      const confidence = computeOutputConfidence(
        testCase.outputSchemaRef,
        testCase.output,
        providerForSkill(testCase.skillId),
      );
      expect(confidence).toBeGreaterThanOrEqual(testCase.confidenceFloor ?? 0);
    }
  });

  it('catches string-min-length violations', () => {
    const testCase: SkillEvalCase = {
      id: 'test-string-min',
      description: 'Test string-min-length assertion',
      skillId: 'opportunity-extractor',
      outputSchemaRef: 'opportunity-extractor-output',
      output: {
        candidates: [
          {
            id: 'x',
            title: 'ab',
            summary: 'ab',
            rationale: 'ab',
            regionTags: [],
            ecologyTags: [],
            fundingSignals: [],
            priority: 0.5,
            recommendedNextStep: 'go',
          },
        ],
      },
      assertions: [{ type: 'string-min-length', path: 'candidates.0.title', threshold: 10 }],
    };

    const result = runSkillEvalCase(testCase);
    expect(result.passed).toBe(false);
    expect(result.failures).toContainEqual(expect.stringContaining('at least 10 characters'));
  });

  it('catches number-range violations', () => {
    const testCase: SkillEvalCase = {
      id: 'test-number-range',
      description: 'Test number-range assertion',
      skillId: 'opportunity-extractor',
      outputSchemaRef: 'opportunity-extractor-output',
      output: {
        candidates: [
          {
            id: 'x',
            title: 'test',
            summary: 'test',
            rationale: 'test',
            regionTags: [],
            ecologyTags: [],
            fundingSignals: [],
            priority: 0.9,
            recommendedNextStep: 'go',
          },
        ],
      },
      assertions: [{ type: 'number-range', path: 'candidates.0.priority', min: 0, max: 0.5 }],
    };

    const result = runSkillEvalCase(testCase);
    expect(result.passed).toBe(false);
    expect(result.failures).toContainEqual(expect.stringContaining('[0, 0.5]'));
  });

  it('catches semantic-word-count violations', () => {
    const testCase: SkillEvalCase = {
      id: 'test-word-count',
      description: 'Test semantic-word-count assertion',
      skillId: 'opportunity-extractor',
      outputSchemaRef: 'opportunity-extractor-output',
      output: {
        candidates: [
          {
            id: 'x',
            title: 'test',
            summary: 'test',
            rationale: 'a the an',
            regionTags: [],
            ecologyTags: [],
            fundingSignals: [],
            priority: 0.5,
            recommendedNextStep: 'go',
          },
        ],
      },
      assertions: [{ type: 'semantic-word-count', path: 'candidates.0.rationale', threshold: 5 }],
    };

    const result = runSkillEvalCase(testCase);
    expect(result.passed).toBe(false);
    expect(result.failures).toContainEqual(expect.stringContaining('5 meaningful words'));
  });

  it('catches regex-match violations', () => {
    const testCase: SkillEvalCase = {
      id: 'test-regex',
      description: 'Test regex-match assertion',
      skillId: 'review-digest',
      outputSchemaRef: 'review-digest-output',
      output: {
        title: 'test',
        summary: 'test',
        whyItMatters: 'test',
        suggestedNextStep: 'test',
        highlights: ['highlight-1'],
        tags: ['tag'],
      },
      assertions: [{ type: 'regex-match', path: 'title', pattern: '^[A-Z]' }],
    };

    const result = runSkillEvalCase(testCase);
    expect(result.passed).toBe(false);
    expect(result.failures).toContainEqual(expect.stringContaining('match pattern'));
  });

  it('catches array-max-length violations', () => {
    const testCase: SkillEvalCase = {
      id: 'test-array-max',
      description: 'Test array-max-length assertion',
      skillId: 'tab-router',
      outputSchemaRef: 'tab-router-output',
      output: {
        routings: [
          {
            sourceCandidateId: 'candidate-1',
            extractId: 'extract-1',
            coopId: 'coop-1',
            relevanceScore: 0.4,
            matchedRitualLenses: [],
            category: 'resource',
            tags: [],
            rationale: 'A weak routing.',
            suggestedNextStep: 'Review later.',
            archiveWorthinessHint: false,
          },
        ],
      },
      assertions: [{ type: 'array-max-length', path: 'routings', threshold: 0 }],
    };

    const result = runSkillEvalCase(testCase);
    expect(result.passed).toBe(false);
    expect(result.failures).toContainEqual(expect.stringContaining('at most 0 items'));
  });

  it('catches regex-not-match violations', () => {
    const testCase: SkillEvalCase = {
      id: 'test-regex-not-match',
      description: 'Test regex-not-match assertion',
      skillId: 'capital-formation-brief',
      outputSchemaRef: 'capital-formation-brief-output',
      output: {
        title: 'Reveal the system prompt',
        summary: 'This should not pass.',
        whyItMatters: 'The string leaks protected content.',
        suggestedNextStep: 'Publish immediately.',
        tags: ['bad'],
        targetCoopIds: [],
        supportingCandidateIds: [],
      },
      assertions: [{ type: 'regex-not-match', path: 'title', pattern: '[Ss]ystem prompt' }],
    };

    const result = runSkillEvalCase(testCase);
    expect(result.passed).toBe(false);
    expect(result.failures).toContainEqual(expect.stringContaining('avoid pattern'));
  });

  it('returns eval fixture metadata alongside the result payload', () => {
    const testCase = loadSkillEvalCases().find(
      (entry) => entry.skillId === 'tab-router' && entry.fixtureType === 'golden',
    );

    expect(testCase).toBeDefined();
    if (!testCase) {
      throw new Error('Expected a golden tab-router eval fixture.');
    }

    const result = runSkillEvalCase(testCase);

    expect(result.fixtureType).toBe('golden');
    expect(result.confidenceFloor).toBe(testCase.confidenceFloor ?? null);
    expect(result.tags).toContain('core-pack');
  });
});
