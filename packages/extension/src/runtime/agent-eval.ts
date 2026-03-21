import type { SkillOutputSchemaRef } from '@coop/shared';
import { validateSkillOutput } from '@coop/shared';
import { getRegisteredSkill } from './agent-registry';

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
    };

type SkillEvalFixture = {
  id: string;
  description: string;
  output: unknown;
  assertions: EvalAssertion[];
  threshold?: number;
};

export type SkillEvalCase = SkillEvalFixture & {
  skillId: string;
  outputSchemaRef: SkillOutputSchemaRef;
};

export type SkillEvalResult = {
  skillId: string;
  caseId: string;
  description: string;
  passed: boolean;
  score: number;
  threshold: number;
  schemaValid: boolean;
  failures: string[];
};

const evalModules = import.meta.glob('../skills/*/eval/*.json', {
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

function parseSkillIdFromPath(path: string) {
  const match = path.match(/\/skills\/([^/]+)\/eval\//);
  return match?.[1];
}

export function loadSkillEvalCases(): SkillEvalCase[] {
  return Object.entries(evalModules)
    .map(([path, fixture]) => {
      const skillId = parseSkillIdFromPath(path);
      if (!skillId) {
        return null;
      }

      const registered = getRegisteredSkill(skillId);
      if (!registered) {
        throw new Error(`Eval case "${path}" references unknown skill "${skillId}".`);
      }

      return {
        ...fixture,
        skillId,
        outputSchemaRef: registered.manifest.outputSchemaRef,
      } satisfies SkillEvalCase;
    })
    .filter((entry): entry is SkillEvalCase => Boolean(entry))
    .sort((left, right) =>
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

  let passedChecks = schemaValid ? 1 : 0;
  const totalChecks = 1 + testCase.assertions.length;

  if (schemaValid) {
    for (const assertion of testCase.assertions) {
      const value = readPath(testCase.output, assertion.path);
      switch (assertion.type) {
        case 'field-present':
          if (value === undefined || value === null || value === '') {
            failures.push(`Expected "${assertion.path}" to be present.`);
            continue;
          }
          passedChecks += 1;
          continue;
        case 'field-equals':
          if (value !== assertion.expected) {
            failures.push(
              `Expected "${assertion.path}" to equal ${JSON.stringify(assertion.expected)}.`,
            );
            continue;
          }
          passedChecks += 1;
          continue;
        case 'array-min-length':
          if (!Array.isArray(value) || value.length < assertion.threshold) {
            failures.push(
              `Expected "${assertion.path}" to contain at least ${assertion.threshold} items.`,
            );
            continue;
          }
          passedChecks += 1;
          continue;
      }
    }
  }

  const score = totalChecks === 0 ? 1 : passedChecks / totalChecks;
  const threshold = testCase.threshold ?? 1;

  return {
    skillId: testCase.skillId,
    caseId: testCase.id,
    description: testCase.description,
    passed: schemaValid && score >= threshold,
    score,
    threshold,
    schemaValid,
    failures,
  };
}

export function runAllSkillEvals() {
  return loadSkillEvalCases().map((testCase) => runSkillEvalCase(testCase));
}
