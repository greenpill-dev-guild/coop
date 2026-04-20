import 'fake-indexeddb/auto';
import {
  type AgentProvider,
  type AutoresearchConfig,
  type CoopDexie,
  createAgentObservation,
  createCoopDb,
  createSkillRun,
  saveAgentObservation,
  saveSkillRun,
} from '@coop/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SkillEvalCase } from '../eval';
import { runSkillEvalCase } from '../eval';
import { runExperiment } from '../experiment-loop';
import type { RegisteredSkill } from '../registry';
import { activateVariant, createVariant, getActiveVariant, seedBaseline } from '../variant-engine';

// ---------------------------------------------------------------------------
// Mocks — mirror the patterns from experiment-loop.test.ts
// ---------------------------------------------------------------------------

const { completionQueue, mockCompleteSkill, mockGetRegisteredSkill, mockLoadSkillEvalCases } =
  vi.hoisted(() => ({
    completionQueue: [] as Array<{
      output: unknown;
      provider?: AgentProvider;
      durationMs?: number;
      delayMs?: number;
    }>,
    mockCompleteSkill: vi.fn(async () => {
      const next = completionQueue.shift();
      if (!next) {
        throw new Error('No queued completion available.');
      }
      if (next.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, next.delayMs));
      }
      return {
        provider: next.provider ?? 'transformers',
        durationMs: next.durationMs ?? 5,
        output: next.output,
      };
    }),
    mockGetRegisteredSkill: vi.fn(),
    mockLoadSkillEvalCases: vi.fn(),
  }));

vi.mock('../runner-skills-completion', () => ({
  completeSkill: mockCompleteSkill,
}));

vi.mock('../registry', () => ({
  getRegisteredSkill: mockGetRegisteredSkill,
}));

vi.mock('../eval', async () => {
  const actual = await vi.importActual<typeof import('../eval')>('../eval');
  return {
    ...actual,
    loadSkillEvalCases: mockLoadSkillEvalCases,
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const databases: CoopDexie[] = [];
const SKILL_ID = 'skill-review-digest';

function freshDb() {
  const db = createCoopDb(`coop-autoresearch-qa-${crypto.randomUUID()}`);
  databases.push(db);
  return db;
}

function expectPresent<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

function buildRegisteredSkill(): RegisteredSkill {
  return {
    manifest: {
      id: SKILL_ID,
      version: '1.0.0',
      description: 'Autoresearch QA test skill.',
      runtime: 'extension-sidepanel',
      model: 'transformers',
      triggers: ['stale-draft'],
      inputSchemaRef: 'agent-observation',
      outputSchemaRef: 'review-digest-output',
      allowedTools: [],
      allowedActionClasses: [],
      requiredCapabilities: [],
      approvalMode: 'advisory',
      timeoutMs: 30_000,
      depends: [],
      provides: [],
      maxTokens: 32,
    },
    instructions: 'Baseline prompt',
    instructionMeta: {
      name: 'Review Digest',
      description: 'Summarize a high-signal draft.',
    },
  };
}

function buildConfig(overrides: Partial<AutoresearchConfig> = {}): AutoresearchConfig {
  return {
    skillId: SKILL_ID,
    enabled: true,
    maxExperimentsPerCycle: 5,
    timeBudgetMs: 60_000,
    qualityFloor: 0.3,
    updatedAt: Date.UTC(2026, 3, 6, 12, 0, 0),
    ...overrides,
  };
}

function makeOutput(input: {
  summary: string;
  whyItMatters: string;
  highlights: string[];
  tags?: string[];
}) {
  return {
    title: 'Digest title',
    summary: input.summary,
    whyItMatters: input.whyItMatters,
    suggestedNextStep: 'Review the digest and share it with the coop.',
    highlights: input.highlights,
    tags: input.tags ?? ['digest'],
  };
}

const BASELINE_OUTPUT = makeOutput({
  summary: 'Short summary.',
  whyItMatters: 'Brief reason.',
  highlights: ['One highlight'],
});

const IMPROVED_OUTPUT = makeOutput({
  summary:
    'This summary is long enough to satisfy the eval fixture and keeps the key funding signal visible.',
  whyItMatters:
    'It explains why the signal matters for the coop and keeps the decision context explicit.',
  highlights: ['First highlight', 'Second highlight'],
});

function buildFixtures(): SkillEvalCase[] {
  return [
    {
      id: 'fixture-length',
      description: 'Summary and rationale should be substantial.',
      skillId: SKILL_ID,
      outputSchemaRef: 'review-digest-output',
      output: IMPROVED_OUTPUT,
      assertions: [
        { type: 'field-present', path: 'title' },
        { type: 'field-present', path: 'suggestedNextStep' },
        { type: 'string-min-length', path: 'summary', threshold: 40 },
        { type: 'string-min-length', path: 'whyItMatters', threshold: 30 },
      ],
    },
    {
      id: 'fixture-highlights',
      description: 'Highlight set should be rich enough for review.',
      skillId: SKILL_ID,
      outputSchemaRef: 'review-digest-output',
      output: IMPROVED_OUTPUT,
      assertions: [
        { type: 'array-min-length', path: 'highlights', threshold: 2 },
        { type: 'semantic-word-count', path: 'summary', threshold: 8 },
      ],
    },
  ];
}

function queueCompletions(
  entries: Array<{
    output: unknown;
    provider?: AgentProvider;
    durationMs?: number;
    delayMs?: number;
  }>,
) {
  completionQueue.length = 0;
  completionQueue.push(...entries);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

afterEach(async () => {
  vi.useRealTimers();
  vi.clearAllMocks();
  completionQueue.length = 0;
  for (const db of databases) {
    db.close();
    await db.delete();
  }
  databases.length = 0;
});

beforeEach(() => {
  mockGetRegisteredSkill.mockReturnValue(buildRegisteredSkill());
  mockLoadSkillEvalCases.mockReturnValue(buildFixtures());
});

// ===========================================================================
// 3. Eval Determinism
// ===========================================================================

describe('QA: eval determinism', () => {
  it('returns identical scores across 10 runs with the same input', () => {
    const testCase: SkillEvalCase = {
      id: 'determinism-fixture',
      description: 'Determinism check.',
      skillId: SKILL_ID,
      outputSchemaRef: 'review-digest-output',
      output: IMPROVED_OUTPUT,
      assertions: [
        { type: 'field-present', path: 'title' },
        { type: 'string-min-length', path: 'summary', threshold: 40 },
        { type: 'array-min-length', path: 'highlights', threshold: 2 },
        { type: 'semantic-word-count', path: 'summary', threshold: 8 },
      ],
    };

    const scores: number[] = [];
    for (let i = 0; i < 10; i++) {
      const result = runSkillEvalCase(testCase);
      scores.push(result.qualityScore);
    }

    const firstScore = expectPresent(scores[0], 'Expected at least one score.');
    for (const score of scores) {
      expect(score).toBe(firstScore);
    }
  });

  it('computes composite quality score as 0.2*schema + 0.3*structural + 0.5*semantic = 1.0 when all pass', () => {
    // Build a case where schema is valid, all structural pass, all semantic pass
    const testCase: SkillEvalCase = {
      id: 'weights-fixture',
      description: 'Composite weight verification.',
      skillId: SKILL_ID,
      outputSchemaRef: 'review-digest-output',
      output: IMPROVED_OUTPUT,
      assertions: [
        // Structural assertions (field-present, array-min-length)
        { type: 'field-present', path: 'title' },
        { type: 'field-present', path: 'suggestedNextStep' },
        { type: 'array-min-length', path: 'highlights', threshold: 2 },
        // Semantic assertions (string-min-length, semantic-word-count)
        { type: 'string-min-length', path: 'summary', threshold: 10 },
        { type: 'semantic-word-count', path: 'summary', threshold: 5 },
      ],
    };

    const result = runSkillEvalCase(testCase);

    // schemaCompliance = 1 (valid output)
    // structuralScore = 3/3 = 1 (all structural pass)
    // semanticScore = 2/2 = 1 (all semantic pass)
    // qualityScore = 0.2*1 + 0.3*1 + 0.5*1 = 1.0
    expect(result.qualityScore).toBe(1.0);
    expect(result.qualityBreakdown.schemaCompliance).toBe(1);
    expect(result.qualityBreakdown.structuralScore).toBe(1);
    expect(result.qualityBreakdown.semanticScore).toBe(1);
  });

  it('computes correct partial scores when some assertions fail', () => {
    const testCase: SkillEvalCase = {
      id: 'partial-fixture',
      description: 'Partial score verification.',
      skillId: SKILL_ID,
      outputSchemaRef: 'review-digest-output',
      output: IMPROVED_OUTPUT,
      assertions: [
        // Structural: 2 of 2 should pass
        { type: 'field-present', path: 'title' },
        { type: 'field-present', path: 'summary' },
        // Semantic: 1 of 2 should pass (the other has impossibly high threshold)
        { type: 'string-min-length', path: 'summary', threshold: 10 },
        { type: 'string-min-length', path: 'summary', threshold: 99999 },
      ],
    };

    const result = runSkillEvalCase(testCase);

    expect(result.qualityBreakdown.schemaCompliance).toBe(1);
    expect(result.qualityBreakdown.structuralScore).toBe(1); // 2/2
    expect(result.qualityBreakdown.semanticScore).toBe(0.5); // 1/2
    // qualityScore = 0.2*1 + 0.3*1 + 0.5*0.5 = 0.75
    expect(result.qualityScore).toBeCloseTo(0.75, 10);
  });

  it('completes scoring within 50ms', () => {
    const testCase: SkillEvalCase = {
      id: 'perf-fixture',
      description: 'Performance check.',
      skillId: SKILL_ID,
      outputSchemaRef: 'review-digest-output',
      output: IMPROVED_OUTPUT,
      assertions: [
        { type: 'field-present', path: 'title' },
        { type: 'field-present', path: 'suggestedNextStep' },
        { type: 'string-min-length', path: 'summary', threshold: 40 },
        { type: 'string-min-length', path: 'whyItMatters', threshold: 30 },
        { type: 'array-min-length', path: 'highlights', threshold: 2 },
        { type: 'semantic-word-count', path: 'summary', threshold: 8 },
      ],
    };

    const start = performance.now();
    for (let i = 0; i < 10; i++) {
      runSkillEvalCase(testCase);
    }
    const elapsed = performance.now() - start;

    // 10 runs should still be under 50ms total (each < 5ms easily)
    expect(elapsed).toBeLessThan(50);
  });
});

// ===========================================================================
// 4. Experiment Loop Invariants
// ===========================================================================

describe('QA: experiment loop invariants', () => {
  it('writes an experiment record to DB regardless of kept outcome', async () => {
    const db = freshDb();
    const fixtures = buildFixtures();
    const baseline = await seedBaseline(db, SKILL_ID, 'Baseline prompt');
    const variant = await createVariant(db, SKILL_ID, 'Variant keep prompt', baseline.id);

    queueCompletions([{ output: BASELINE_OUTPUT }, { output: IMPROVED_OUTPUT }]);

    const record = await runExperiment(db, SKILL_ID, variant, fixtures, buildConfig());

    expect(record.outcome).toBe('kept');
    const stored = await db.experimentRecords.get(record.id);
    expect(stored).toBeDefined();
    expect(stored).toEqual(record);
  });

  it('writes an experiment record to DB regardless of reverted outcome', async () => {
    const db = freshDb();
    const fixtures = buildFixtures();
    const baseline = await seedBaseline(db, SKILL_ID, 'Baseline prompt');
    const variant = await createVariant(db, SKILL_ID, 'Variant revert prompt', baseline.id);

    // baseline scores better than variant
    queueCompletions([{ output: IMPROVED_OUTPUT }, { output: BASELINE_OUTPUT }]);

    const record = await runExperiment(db, SKILL_ID, variant, fixtures, buildConfig());

    expect(record.outcome).toBe('reverted');
    const stored = await db.experimentRecords.get(record.id);
    expect(stored).toBeDefined();
    expect(stored).toEqual(record);
  });

  it('writes an experiment record to DB even on timeout error', async () => {
    const db = freshDb();
    const fixtures = buildFixtures();
    const baseline = await seedBaseline(db, SKILL_ID, 'Baseline prompt');
    const variant = await createVariant(db, SKILL_ID, 'Variant timeout prompt', baseline.id);

    // baseline completion takes too long
    queueCompletions([{ output: BASELINE_OUTPUT, delayMs: 100 }, { output: IMPROVED_OUTPUT }]);

    const record = await runExperiment(
      db,
      SKILL_ID,
      variant,
      fixtures,
      buildConfig({ timeBudgetMs: 10 }),
    );

    expect(record.outcome).toBe('reverted');
    const stored = await db.experimentRecords.get(record.id);
    expect(stored).toBeDefined();
    expect(stored).toEqual(record);
  });

  it('ensures only one variant has isActive=true for the skill after activateVariant', async () => {
    const db = freshDb();
    const baseline = await seedBaseline(db, SKILL_ID, 'Baseline prompt');
    const variant1 = await createVariant(db, SKILL_ID, 'Variant 1 prompt', baseline.id);
    const variant2 = await createVariant(db, SKILL_ID, 'Variant 2 prompt', baseline.id);

    // Activate variant1
    await activateVariant(db, variant1.id);

    let allVariants = await db.skillVariants.where('skillId').equals(SKILL_ID).toArray();
    let activeVariants = allVariants.filter((v) => v.isActive);
    expect(activeVariants).toHaveLength(1);
    expect(expectPresent(activeVariants[0], 'Expected one active variant.').id).toBe(variant1.id);

    // Activate variant2 — variant1 should become inactive
    await activateVariant(db, variant2.id);

    allVariants = await db.skillVariants.where('skillId').equals(SKILL_ID).toArray();
    activeVariants = allVariants.filter((v) => v.isActive);
    expect(activeVariants).toHaveLength(1);
    expect(expectPresent(activeVariants[0], 'Expected one active variant.').id).toBe(variant2.id);
  });

  it('uses a Dexie transaction for activateVariant (verified via single active invariant)', async () => {
    const db = freshDb();
    const baseline = await seedBaseline(db, SKILL_ID, 'Baseline prompt');
    const variants = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        createVariant(db, SKILL_ID, `Variant ${i} prompt`, baseline.id),
      ),
    );

    // Activate each variant sequentially
    for (const variant of variants) {
      await activateVariant(db, variant.id);
    }

    // After all activations, only one should be active
    const allVariants = await db.skillVariants.where('skillId').equals(SKILL_ID).toArray();
    const activeVariants = allVariants.filter((v) => v.isActive);
    expect(activeVariants).toHaveLength(1);
    expect(expectPresent(activeVariants[0], 'Expected one active variant.').id).toBe(
      expectPresent(variants[variants.length - 1], 'Expected at least one variant.').id,
    );
  });

  it('quality floor blocks keeping even when variant score improves over baseline', async () => {
    const db = freshDb();
    const fixtures = buildFixtures();
    const baseline = await seedBaseline(db, SKILL_ID, 'Baseline prompt');
    const variant = await createVariant(db, SKILL_ID, 'Variant floor prompt', baseline.id);

    // variant output is slightly better than baseline, but both are weak
    const weakBaseline = makeOutput({
      summary: 'Short.',
      whyItMatters: 'Thin.',
      highlights: ['One'],
    });
    const slightlyBetter = makeOutput({
      summary: 'This is slightly improved but still not enough to pass the quality floor check.',
      whyItMatters: 'Still too thin to be useful.',
      highlights: ['Only one highlight'],
    });

    queueCompletions([{ output: weakBaseline }, { output: slightlyBetter }]);

    const record = await runExperiment(
      db,
      SKILL_ID,
      variant,
      fixtures,
      buildConfig({ qualityFloor: 0.95 }),
    );

    // Variant should score better than baseline
    expect(record.compositeScore).toBeGreaterThan(record.baselineScore);
    // But still reverted because below quality floor
    expect(record.outcome).toBe('reverted');
    // Baseline should still be active
    const active = await getActiveVariant(db, SKILL_ID);
    expect(active?.id).toBe(baseline.id);
  });

  it('getActiveVariant returns the correct variant after a kept experiment', async () => {
    const db = freshDb();
    const fixtures = buildFixtures();
    const baseline = await seedBaseline(db, SKILL_ID, 'Baseline prompt');
    const variant = await createVariant(db, SKILL_ID, 'Variant kept prompt', baseline.id);

    queueCompletions([{ output: BASELINE_OUTPUT }, { output: IMPROVED_OUTPUT }]);

    const record = await runExperiment(db, SKILL_ID, variant, fixtures, buildConfig());

    expect(record.outcome).toBe('kept');
    const active = await getActiveVariant(db, SKILL_ID);
    const activeVariant = expectPresent(active, 'Expected an active variant.');
    expect(activeVariant.id).toBe(variant.id);
    expect(activeVariant.isActive).toBe(true);
    expect(activeVariant.isBaseline).toBe(true);
  });

  it('getActiveVariant returns baseline after a reverted experiment', async () => {
    const db = freshDb();
    const fixtures = buildFixtures();
    const baseline = await seedBaseline(db, SKILL_ID, 'Baseline prompt');
    const variant = await createVariant(db, SKILL_ID, 'Variant reverted prompt', baseline.id);

    // baseline output better than variant
    queueCompletions([{ output: IMPROVED_OUTPUT }, { output: BASELINE_OUTPUT }]);

    const record = await runExperiment(db, SKILL_ID, variant, fixtures, buildConfig());

    expect(record.outcome).toBe('reverted');
    const active = await getActiveVariant(db, SKILL_ID);
    const activeVariant = expectPresent(active, 'Expected an active baseline variant.');
    expect(activeVariant.id).toBe(baseline.id);
    expect(activeVariant.isActive).toBe(true);
  });
});
