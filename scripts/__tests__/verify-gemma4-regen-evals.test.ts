import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const verifier = require('../verify-gemma4-regen-evals.cjs') as {
  buildCases: (options?: { caseLimit?: number }) => Array<{ id: string; variant: string }>;
  resolveEvalConfig: (env?: Record<string, string | undefined>) => {
    evalMode: 'full' | 'smoke';
    caseLimit: number;
    maxTokens: number;
    modelSource: 'remote' | 'local';
    localModelPath: string | null;
  };
  validateBrief: (
    testCase: unknown,
    response: unknown,
  ) => { brief: unknown; failures: string[]; warnings: string[]; normalizations: string[] };
};

describe('verify-gemma4-regen-evals config', () => {
  it('keeps the default full gate at 32 cases', () => {
    const config = verifier.resolveEvalConfig({});

    expect(config.evalMode).toBe('full');
    expect(config.caseLimit).toBe(32);
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

  it('normalizes action arrays with empty string placeholders before validation', () => {
    const testCase = verifier.buildCases({ caseLimit: 1 })[0];
    const validation = verifier.validateBrief(testCase, {
      ok: true,
      output: JSON.stringify({
        targetGroupType: 'Land and watershed stewards',
        actionType: 'Coordinate people',
        publicSummary: 'Gather local stewards for watershed conservation planning',
        privateNotes: [],
        evidenceReferences: [
          'https://regen-evals.example.org/land-watershed/coordinate-people/canonical',
        ],
        coordinatePeople: ['Local watershed group members', ''],
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
      }),
    });
    const brief = validation.brief as { coordinatePeople?: string[] };

    expect(validation.failures).toEqual([]);
    expect(validation.warnings).toEqual([]);
    expect(validation.failures).not.toContain(
      'Expected coordinatePeople to be a non-empty string array.',
    );
    expect(validation.normalizations).toContain(
      'Removed empty or padded string entries from coordinatePeople.',
    );
    expect(brief.coordinatePeople).toEqual(['Local watershed group members']);
  });

  it('parses the first complete JSON object when Gemma adds trailing text', () => {
    const testCase = verifier.buildCases({ caseLimit: 1 })[0];
    const validBrief = {
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

    const validation = verifier.validateBrief(testCase, {
      ok: true,
      output: `${JSON.stringify(validBrief)}\n}`,
    });

    expect(validation.failures).toEqual([]);
  });

  it('requires canonical briefs to include an empty privateNotes array', () => {
    const testCase = verifier.buildCases({ caseLimit: 1 })[0];

    const validation = verifier.validateBrief(testCase, {
      ok: true,
      output: JSON.stringify({
        targetGroupType: 'Land and watershed stewards',
        actionType: 'Coordinate people',
        publicSummary: 'Gather local stewards for watershed conservation planning',
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
      }),
    });

    expect(validation.failures).toContain('Expected privateNotes to be an array.');
  });
});
