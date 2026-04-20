import type { SkillOutputSchemaRef } from '@coop/shared';
import { validateSkillOutput } from '@coop/shared';
import { getRegisteredSkill } from './registry';

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'is',
  'it',
  'be',
  'as',
  'do',
  'no',
  'so',
  'if',
  'up',
  'my',
  'we',
  'he',
  'me',
]);

const STRUCTURAL_ASSERTION_TYPES = new Set([
  'field-present',
  'field-equals',
  'array-min-length',
  'array-max-length',
]);
const EVAL_FIXTURE_TYPES = ['golden', 'noisy', 'low-signal', 'malicious'] as const;

export type SkillEvalFixtureType = (typeof EVAL_FIXTURE_TYPES)[number];

type EvalAssertion =
  | {
      type: 'field-present';
      path: string;
    }
  | {
      type: 'field-equals';
      path: string;
      expected: unknown;
    }
  | {
      type: 'array-min-length';
      path: string;
      threshold: number;
    }
  | {
      type: 'array-max-length';
      path: string;
      threshold: number;
    }
  | {
      type: 'string-min-length';
      path: string;
      threshold: number;
    }
  | {
      type: 'number-range';
      path: string;
      min: number;
      max: number;
    }
  | {
      type: 'regex-match';
      path: string;
      pattern: string;
    }
  | {
      type: 'regex-not-match';
      path: string;
      pattern: string;
    }
  | {
      type: 'semantic-word-count';
      path: string;
      threshold: number;
    };

type SkillEvalFixture = {
  id: string;
  description: string;
  output: unknown;
  assertions: EvalAssertion[];
  threshold?: number;
  fixtureType?: SkillEvalFixtureType;
  confidenceFloor?: number;
  tags?: string[];
};

export type SkillEvalCase = SkillEvalFixture & {
  skillId: string;
  outputSchemaRef: SkillOutputSchemaRef;
};

export type QualityBreakdown = {
  structuralScore: number;
  semanticScore: number;
  schemaCompliance: number;
};

export type SkillEvalResult = {
  skillId: string;
  caseId: string;
  description: string;
  fixtureType: SkillEvalFixtureType;
  confidenceFloor: number | null;
  tags: string[];
  passed: boolean;
  score: number;
  threshold: number;
  schemaValid: boolean;
  failures: string[];
  qualityScore: number;
  qualityBreakdown: QualityBreakdown;
};

const evalModules = import.meta.glob('../../skills/*/eval/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, SkillEvalFixture>;

function readPath(value: unknown, path: string) {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (current === null || current === undefined) {
      return undefined;
    }

    const numericIndex = Number(segment);
    if (Array.isArray(current) && Number.isInteger(numericIndex)) {
      return current[numericIndex];
    }

    if (typeof current === 'object' && segment in current) {
      return (current as Record<string, unknown>)[segment];
    }

    return undefined;
  }, value);
}

function countMeaningfulWords(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0 && !STOPWORDS.has(word.toLowerCase()))
    .length;
}

function parseSkillIdFromPath(path: string) {
  const match = path.match(/\/skills\/([^/]+)\/eval\//);
  return match?.[1];
}

function normalizeEvalFixture(
  path: string,
  fixture: SkillEvalFixture,
): SkillEvalFixture & {
  fixtureType: SkillEvalFixtureType;
  confidenceFloor?: number;
  tags: string[];
} {
  const fixtureType = fixture.fixtureType ?? 'golden';
  if (!EVAL_FIXTURE_TYPES.includes(fixtureType)) {
    throw new Error(`Eval case "${path}" uses unsupported fixtureType "${fixtureType}".`);
  }

  if (
    fixture.threshold !== undefined &&
    (typeof fixture.threshold !== 'number' || fixture.threshold < 0 || fixture.threshold > 1)
  ) {
    throw new Error(`Eval case "${path}" has threshold outside [0, 1].`);
  }

  if (
    fixture.confidenceFloor !== undefined &&
    (typeof fixture.confidenceFloor !== 'number' ||
      fixture.confidenceFloor < 0 ||
      fixture.confidenceFloor > 1)
  ) {
    throw new Error(`Eval case "${path}" has confidenceFloor outside [0, 1].`);
  }

  if (
    fixture.tags !== undefined &&
    (!Array.isArray(fixture.tags) || fixture.tags.some((tag) => typeof tag !== 'string'))
  ) {
    throw new Error(`Eval case "${path}" must define tags as a string array.`);
  }

  return {
    ...fixture,
    fixtureType,
    tags: fixture.tags ?? [],
  };
}

export function loadSkillEvalCases(): SkillEvalCase[] {
  const cases: SkillEvalCase[] = [];

  for (const [path, fixture] of Object.entries(evalModules)) {
    const skillId = parseSkillIdFromPath(path);
    if (!skillId) {
      continue;
    }

    const registered = getRegisteredSkill(skillId);
    if (!registered) {
      throw new Error(`Eval case "${path}" references unknown skill "${skillId}".`);
    }

    const normalizedFixture = normalizeEvalFixture(path, fixture);

    cases.push({
      ...normalizedFixture,
      skillId,
      outputSchemaRef: registered.manifest.outputSchemaRef,
    });
  }

  return cases.sort((left, right) =>
    `${left.skillId}:${left.id}`.localeCompare(`${right.skillId}:${right.id}`),
  );
}

export function runSkillEvalCase(testCase: SkillEvalCase): SkillEvalResult {
  const failures: string[] = [];
  let schemaValid = true;

  try {
    validateSkillOutput(testCase.outputSchemaRef, testCase.output);
  } catch (error) {
    schemaValid = false;
    failures.push(error instanceof Error ? error.message : String(error));
  }

  let structuralPassed = 0;
  let structuralTotal = 0;
  let semanticPassed = 0;
  let semanticTotal = 0;

  if (schemaValid) {
    for (const assertion of testCase.assertions) {
      const value = readPath(testCase.output, assertion.path);
      const isStructural = STRUCTURAL_ASSERTION_TYPES.has(assertion.type);

      if (isStructural) {
        structuralTotal += 1;
      } else {
        semanticTotal += 1;
      }

      switch (assertion.type) {
        case 'field-present':
          if (value === undefined || value === null || value === '') {
            failures.push(`Expected "${assertion.path}" to be present.`);
            continue;
          }
          structuralPassed += 1;
          continue;
        case 'field-equals':
          if (value !== assertion.expected) {
            failures.push(
              `Expected "${assertion.path}" to equal ${JSON.stringify(assertion.expected)}.`,
            );
            continue;
          }
          structuralPassed += 1;
          continue;
        case 'array-min-length':
          if (!Array.isArray(value) || value.length < assertion.threshold) {
            failures.push(
              `Expected "${assertion.path}" to contain at least ${assertion.threshold} items.`,
            );
            continue;
          }
          structuralPassed += 1;
          continue;
        case 'array-max-length':
          if (!Array.isArray(value) || value.length > assertion.threshold) {
            failures.push(
              `Expected "${assertion.path}" to contain at most ${assertion.threshold} items.`,
            );
            continue;
          }
          structuralPassed += 1;
          continue;
        case 'string-min-length':
          if (typeof value !== 'string' || value.length < assertion.threshold) {
            failures.push(
              `Expected "${assertion.path}" to be a string of at least ${assertion.threshold} characters.`,
            );
            continue;
          }
          semanticPassed += 1;
          continue;
        case 'number-range':
          if (typeof value !== 'number' || value < assertion.min || value > assertion.max) {
            failures.push(
              `Expected "${assertion.path}" to be a number in [${assertion.min}, ${assertion.max}].`,
            );
            continue;
          }
          semanticPassed += 1;
          continue;
        case 'regex-match':
          try {
            if (typeof value !== 'string' || !new RegExp(assertion.pattern).test(value)) {
              failures.push(
                `Expected "${assertion.path}" to match pattern /${assertion.pattern}/.`,
              );
              continue;
            }
          } catch {
            failures.push(
              `Invalid regex pattern "/${assertion.pattern}/" for "${assertion.path}".`,
            );
            continue;
          }
          semanticPassed += 1;
          continue;
        case 'regex-not-match':
          try {
            if (typeof value !== 'string' || new RegExp(assertion.pattern).test(value)) {
              failures.push(
                `Expected "${assertion.path}" to avoid pattern /${assertion.pattern}/.`,
              );
              continue;
            }
          } catch {
            failures.push(
              `Invalid regex pattern "/${assertion.pattern}/" for "${assertion.path}".`,
            );
            continue;
          }
          semanticPassed += 1;
          continue;
        case 'semantic-word-count': {
          if (typeof value !== 'string' || countMeaningfulWords(value) < assertion.threshold) {
            failures.push(
              `Expected "${assertion.path}" to contain at least ${assertion.threshold} meaningful words.`,
            );
            continue;
          }
          semanticPassed += 1;
          continue;
        }
      }
    }
  }

  const totalChecks = 1 + testCase.assertions.length;
  const passedChecks = (schemaValid ? 1 : 0) + structuralPassed + semanticPassed;
  const score = totalChecks === 0 ? 1 : passedChecks / totalChecks;
  const threshold = testCase.threshold ?? 1;

  const schemaCompliance = schemaValid ? 1 : 0;
  const structuralScore = structuralTotal === 0 ? 1 : structuralPassed / structuralTotal;
  const semanticScore = semanticTotal === 0 ? 1 : semanticPassed / semanticTotal;
  const qualityScore = 0.2 * schemaCompliance + 0.3 * structuralScore + 0.5 * semanticScore;

  return {
    skillId: testCase.skillId,
    caseId: testCase.id,
    description: testCase.description,
    fixtureType: testCase.fixtureType ?? 'golden',
    confidenceFloor: testCase.confidenceFloor ?? null,
    tags: testCase.tags ?? [],
    passed: schemaValid && score >= threshold,
    score,
    threshold,
    schemaValid,
    failures,
    qualityScore,
    qualityBreakdown: {
      structuralScore,
      semanticScore,
      schemaCompliance,
    },
  };
}

export function runAllSkillEvals() {
  return loadSkillEvalCases().map((testCase) => runSkillEvalCase(testCase));
}

export type EvalSuiteResult = {
  skillId: string;
  compositeScore: number;
  fixtureResults: SkillEvalResult[];
  avgSchema: number;
  avgStructural: number;
  avgSemantic: number;
};

/**
 * Run all eval fixtures for a skill against a given output and return
 * a composite score with per-dimension breakdowns.
 *
 * If `fixtures` is omitted, loads all registered fixtures for the skill.
 * The composite score uses spec weights: 0.2 schema + 0.3 structural + 0.5 semantic.
 */
export function runEvalSuite(
  skillId: string,
  output: unknown,
  fixtures?: SkillEvalCase[],
): EvalSuiteResult {
  const cases = fixtures ?? loadSkillEvalCases().filter((c) => c.skillId === skillId);
  if (cases.length === 0) {
    return {
      skillId,
      compositeScore: 0,
      fixtureResults: [],
      avgSchema: 0,
      avgStructural: 0,
      avgSemantic: 0,
    };
  }

  const fixtureResults = cases.map((fixture) => runSkillEvalCase({ ...fixture, skillId, output }));

  const avg = (values: number[]) =>
    values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length;

  const avgSchema = avg(fixtureResults.map((r) => r.qualityBreakdown.schemaCompliance));
  const avgStructural = avg(fixtureResults.map((r) => r.qualityBreakdown.structuralScore));
  const avgSemantic = avg(fixtureResults.map((r) => r.qualityBreakdown.semanticScore));
  const compositeScore = 0.2 * avgSchema + 0.3 * avgStructural + 0.5 * avgSemantic;

  return { skillId, compositeScore, fixtureResults, avgSchema, avgStructural, avgSemantic };
}
