import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const verifier = require('../verify-gemma4-regen-evals.cjs') as {
  buildCases: (options?: { caseLimit?: number }) => Array<{ id: string; variant: string }>;
  resolveEvalConfig: (env?: Record<string, string | undefined>) => {
    evalMode: 'full' | 'smoke';
    caseLimit: number;
    allowNormalization: boolean;
    maxCaseAttempts: number;
    maxTokens: number;
    modelSource: 'remote' | 'local';
    localModelPath: string | null;
  };
  validateBrief: (
    testCase: unknown,
    response: unknown,
    options?: { allowNormalization?: boolean },
  ) => { brief: unknown; failures: string[]; warnings: string[]; normalizations: string[] };
};

function validCanonicalBrief() {
  return {
    targetGroupType: 'Land and watershed stewards',
    actionType: 'Coordinate people',
    publicSummary: 'Gather local stewards for watershed conservation planning',
    privateNotes: [],
    evidenceReferences: [
      'https://regen-evals.example.org/land-watershed/coordinate-people/canonical',
    ],
    coordinatePeople: ['Local watershed group members'],
    preserveEvidence: ['Riparian habitat notes'],
    findSupport: ['Seek local conservation input'],
    shareLearning: ['Share coordination methods'],
    tags: ['santa-ana', 'watershed', 'coordinate'],
    disallowedUnsupportedClaims: [
      'guaranteed funding',
      'official permit approved',
      'all volunteers consented',
      'measured impact confirmed',
    ],
  };
}

function validStressBrief() {
  return {
    ...validCanonicalBrief(),
    privateNotes: ['Private logistics held for member review'],
    evidenceReferences: [
      'https://regen-evals.example.org/land-watershed/coordinate-people/stress-privacy-noise',
    ],
  };
}

describe('verify-gemma4-regen-evals config', () => {
  it('keeps the default full gate at 32 cases', () => {
    const config = verifier.resolveEvalConfig({});

    expect(config.evalMode).toBe('full');
    expect(config.caseLimit).toBe(32);
    expect(config.allowNormalization).toBe(false);
    expect(config.maxCaseAttempts).toBe(4);
    expect(verifier.buildCases({ caseLimit: config.caseLimit })).toHaveLength(32);
  });

  it('supports a one-case browser smoke mode without changing the full default', () => {
    const config = verifier.resolveEvalConfig({ COOP_REGEN_EVAL_MODE: 'smoke' });
    const cases = verifier.buildCases({ caseLimit: config.caseLimit });

    expect(config.evalMode).toBe('smoke');
    expect(config.caseLimit).toBe(1);
    expect(config.maxTokens).toBe(320);
    expect(cases).toHaveLength(1);
    expect(cases[0]?.variant).toBe('canonical');
  });

  it('can target canonical plus stress/privacy/noise smoke cases', () => {
    const config = verifier.resolveEvalConfig({
      COOP_REGEN_EVAL_MODE: 'smoke',
      COOP_REGEN_EVAL_CASES: '2',
    });
    const cases = verifier.buildCases({ caseLimit: config.caseLimit });

    expect(cases.map((testCase) => testCase.variant)).toEqual([
      'canonical',
      'stress-privacy-noise',
    ]);
  });

  it('records opt-in local model source config', () => {
    const config = verifier.resolveEvalConfig({
      COOP_REGEN_EVAL_MODEL_SOURCE: 'local',
      COOP_REGEN_EVAL_LOCAL_MODEL_PATH: ' http://127.0.0.1:8765/models/ ',
    });

    expect(config.modelSource).toBe('local');
    expect(config.localModelPath).toBe('http://127.0.0.1:8765/models/');
  });

  it('records explicit diagnostic opt-in for output normalization', () => {
    const config = verifier.resolveEvalConfig({
      COOP_REGEN_EVAL_ALLOW_NORMALIZATION: '1',
    });

    expect(config.allowNormalization).toBe(true);
  });

  it('fails by default when raw action arrays contain empty string placeholders', () => {
    const testCase = verifier.buildCases({ caseLimit: 1 })[0];
    const validation = verifier.validateBrief(testCase, {
      ok: true,
      output: JSON.stringify({
        ...validCanonicalBrief(),
        coordinatePeople: ['Local watershed group members', ''],
      }),
    });
    const brief = validation.brief as { coordinatePeople?: string[] };

    expect(validation.failures).toContain(
      'Raw model output required no validation normalizations; found 1.',
    );
    expect(validation.warnings).toEqual([]);
    expect(validation.normalizations).toContain(
      'Removed empty or padded string entries from coordinatePeople.',
    );
    expect(brief.coordinatePeople).toEqual(['Local watershed group members']);
  });

  it('allows normalization only for explicit non-gating diagnostics', () => {
    const testCase = verifier.buildCases({ caseLimit: 1 })[0];
    const validation = verifier.validateBrief(
      testCase,
      {
        ok: true,
        output: JSON.stringify({
          ...validCanonicalBrief(),
          coordinatePeople: ['Local watershed group members', ''],
        }),
      },
      { allowNormalization: true },
    );

    expect(validation.failures).toEqual([]);
    expect(validation.normalizations).toContain(
      'Removed empty or padded string entries from coordinatePeople.',
    );
  });

  it('parses the first complete JSON object when Gemma adds trailing text', () => {
    const testCase = verifier.buildCases({ caseLimit: 1 })[0];

    const validation = verifier.validateBrief(testCase, {
      ok: true,
      output: `${JSON.stringify(validCanonicalBrief())}\n}`,
    });

    expect(validation.failures).toEqual([]);
  });

  it('requires canonical briefs to include an empty privateNotes array', () => {
    const testCase = verifier.buildCases({ caseLimit: 1 })[0];

    const validation = verifier.validateBrief(testCase, {
      ok: true,
      output: JSON.stringify({
        ...validCanonicalBrief(),
        privateNotes: undefined,
      }),
    });

    expect(validation.failures).toContain('Expected privateNotes to be an array.');
  });

  it.each([
    ['gate code fragment', 'Use gate code 5521 for the watershed meeting.', '5521'],
    ['phone fragment', 'Call 555-0199 before the watershed meeting.', '555-0199'],
    [
      'private email fragment',
      'Send logistics to private@example.test before meeting.',
      'private@example.test',
    ],
  ])('catches leaked %s in public sections', (_label, leakedText, expectedLeak) => {
    const testCase = verifier.buildCases({ caseLimit: 2 })[1];
    const validation = verifier.validateBrief(testCase, {
      ok: true,
      output: JSON.stringify({
        ...validStressBrief(),
        publicSummary: `${leakedText} Keep santa-ana watershed coordination public.`,
      }),
    });

    const failureText = validation.failures.join('\n');
    expect(failureText).toContain('Private details leaked');
    expect(failureText).toContain(expectedLeak);
  });
});
