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
import {
  collectFeedback,
  computeMemberFeedbackScore,
  runCycle,
  runExperiment,
} from '../experiment-loop';
import type { RegisteredSkill } from '../registry';
import { activateVariant, createVariant, getActiveVariant, seedBaseline } from '../variant-engine';

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

const databases: CoopDexie[] = [];
const SKILL_ID = 'skill-review-digest';

function freshDb() {
  const db = createCoopDb(`coop-experiment-loop-${crypto.randomUUID()}`);
  databases.push(db);
  return db;
}

function getCompletionCallInput(index: number): { skill: { instructions: string } } | undefined {
  return (mockCompleteSkill.mock.calls as unknown[][])[index]?.[0] as
    | { skill: { instructions: string } }
    | undefined;
}

function buildRegisteredSkill(): RegisteredSkill {
  return {
    manifest: {
      id: SKILL_ID,
      version: '1.0.0',
      description: 'Autoresearch test skill.',
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

const FLOOR_OUTPUT = makeOutput({
  summary:
    'This is improved over baseline, but it still misses enough quality checks to stay below the floor.',
  whyItMatters: 'Still too thin.',
  highlights: ['Only one highlight'],
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

describe('experiment loop', () => {
  it('keeps a variant when it beats the baseline and persists the journal record', async () => {
    const db = freshDb();
    const fixtures = buildFixtures();
    const baseline = await seedBaseline(db, SKILL_ID, 'Baseline prompt');
    const variant = await createVariant(db, SKILL_ID, 'Variant keep prompt', baseline.id);

    queueCompletions([{ output: BASELINE_OUTPUT }, { output: IMPROVED_OUTPUT }]);

    const record = await runExperiment(db, SKILL_ID, variant, fixtures, buildConfig());

    expect(record.outcome).toBe('kept');
    expect(record.variantId).toBe(variant.id);
    expect(record.baselineVariantId).toBe(baseline.id);
    expect(record.delta).toBeGreaterThan(0);
    expect(record.fixtureResults).toHaveLength(fixtures.length);
    expect(record.promptDiff).toContain('--- baseline');
    expect(mockCompleteSkill).toHaveBeenCalledTimes(2);
    const baselineInput = getCompletionCallInput(0);
    const variantInput = getCompletionCallInput(1);
    if (!baselineInput || !variantInput) {
      throw new Error('Expected baseline and variant completion calls.');
    }
    expect(baselineInput.skill.instructions).toBe('Baseline prompt');
    expect(variantInput.skill.instructions).toBe('Variant keep prompt');
    await expect(db.experimentRecords.get(record.id)).resolves.toEqual(record);
    await expect(getActiveVariant(db, SKILL_ID)).resolves.toMatchObject({
      id: variant.id,
      isActive: true,
    });
    await expect(db.skillVariants.get(variant.id)).resolves.toMatchObject({
      id: variant.id,
      isActive: true,
      isBaseline: true,
      activatedAt: expect.any(Number),
    });
  });

  it('reverts a variant when it does not outperform the baseline', async () => {
    const db = freshDb();
    const fixtures = buildFixtures();
    const baseline = await seedBaseline(db, SKILL_ID, 'Baseline prompt');
    const variant = await createVariant(db, SKILL_ID, 'Variant revert prompt', baseline.id);

    queueCompletions([{ output: IMPROVED_OUTPUT }, { output: BASELINE_OUTPUT }]);

    const record = await runExperiment(db, SKILL_ID, variant, fixtures, buildConfig());

    expect(record.outcome).toBe('reverted');
    expect(record.delta).toBeLessThanOrEqual(0);
    await expect(getActiveVariant(db, SKILL_ID)).resolves.toMatchObject({
      id: baseline.id,
      isActive: true,
    });
  });

  it('reverts an improved variant when it still falls below the quality floor', async () => {
    const db = freshDb();
    const fixtures = buildFixtures();
    const baseline = await seedBaseline(db, SKILL_ID, 'Baseline prompt');
    const variant = await createVariant(db, SKILL_ID, 'Variant floor prompt', baseline.id);

    queueCompletions([{ output: BASELINE_OUTPUT }, { output: FLOOR_OUTPUT }]);

    const record = await runExperiment(
      db,
      SKILL_ID,
      variant,
      fixtures,
      buildConfig({ qualityFloor: 0.8 }),
    );

    expect(record.outcome).toBe('reverted');
    expect(record.compositeScore).toBeGreaterThan(record.baselineScore);
    expect(record.compositeScore).toBeLessThan(0.8);
    await expect(getActiveVariant(db, SKILL_ID)).resolves.toMatchObject({
      id: baseline.id,
    });
  });

  it('reverts and records the experiment when the run exceeds its time budget', async () => {
    const db = freshDb();
    const fixtures = buildFixtures();
    const baseline = await seedBaseline(db, SKILL_ID, 'Baseline prompt');
    const variant = await createVariant(db, SKILL_ID, 'Variant timeout prompt', baseline.id);

    queueCompletions([{ output: BASELINE_OUTPUT, delayMs: 50 }, { output: IMPROVED_OUTPUT }]);

    const record = await runExperiment(
      db,
      SKILL_ID,
      variant,
      fixtures,
      buildConfig({ timeBudgetMs: 10 }),
    );

    expect(record.outcome).toBe('reverted');
    expect(record.compositeScore).toBe(0);
    expect(record.delta).toBeLessThanOrEqual(0);
    expect(mockCompleteSkill).toHaveBeenCalledTimes(1);
    await expect(db.experimentRecords.get(record.id)).resolves.toEqual(record);
  });

  it('uses the baseline variant for evaluation even when another variant is active', async () => {
    const db = freshDb();
    const fixtures = buildFixtures();
    const baseline = await seedBaseline(db, SKILL_ID, 'Baseline prompt');
    const staleActive = await createVariant(db, SKILL_ID, 'Stale active prompt', baseline.id);
    await activateVariant(db, staleActive.id);
    const challenger = await createVariant(db, SKILL_ID, 'Challenger prompt', baseline.id);

    queueCompletions([{ output: BASELINE_OUTPUT }, { output: IMPROVED_OUTPUT }]);

    const record = await runExperiment(db, SKILL_ID, challenger, fixtures, buildConfig());

    expect(record.baselineVariantId).toBe(baseline.id);
    const baselineInput = getCompletionCallInput(0);
    const variantInput = getCompletionCallInput(1);
    if (!baselineInput || !variantInput) {
      throw new Error('Expected baseline and variant completion calls.');
    }
    expect(baselineInput.skill.instructions).toBe('Baseline prompt');
    expect(variantInput.skill.instructions).toBe('Challenger prompt');
  });

  it('runs a cycle, promotes kept variants to baseline, and reports the best score', async () => {
    const db = freshDb();
    await db.autoresearchConfigs.put(buildConfig({ maxExperimentsPerCycle: 2 }));

    queueCompletions([
      { output: BASELINE_OUTPUT },
      { output: IMPROVED_OUTPUT },
      { output: IMPROVED_OUTPUT },
      { output: BASELINE_OUTPUT },
    ]);

    const summary = await runCycle(db, SKILL_ID, buildConfig({ maxExperimentsPerCycle: 2 }));

    expect(summary).toEqual({
      experimentsRun: 2,
      kept: 1,
      reverted: 1,
      bestScore: expect.any(Number),
    });
    expect(summary.bestScore).toBeGreaterThan(0.9);
    const activeVariant = await getActiveVariant(db, SKILL_ID);
    expect(activeVariant).toMatchObject({
      isActive: true,
      isBaseline: true,
    });
    if (!activeVariant) {
      throw new Error('Expected an active variant after the cycle.');
    }
    // Variant prompt should differ from the original baseline
    expect(activeVariant.promptText).not.toBe('Baseline prompt');
    await expect(db.experimentRecords.count()).resolves.toBe(2);
  });

  it('stops a cycle early after three consecutive reverts', async () => {
    const db = freshDb();
    await db.autoresearchConfigs.put(buildConfig({ maxExperimentsPerCycle: 5 }));

    queueCompletions([
      { output: IMPROVED_OUTPUT },
      { output: BASELINE_OUTPUT },
      { output: IMPROVED_OUTPUT },
      { output: BASELINE_OUTPUT },
      { output: IMPROVED_OUTPUT },
      { output: BASELINE_OUTPUT },
    ]);

    const summary = await runCycle(db, SKILL_ID, buildConfig({ maxExperimentsPerCycle: 5 }));

    expect(summary.experimentsRun).toBe(3);
    expect(summary.kept).toBe(0);
    expect(summary.reverted).toBe(3);
    await expect(db.experimentRecords.count()).resolves.toBe(3);
  });

  it('records member feedback and computes a rolling score for the skill', async () => {
    const db = freshDb();
    const observationIds = [
      createAgentObservation({
        trigger: 'stale-draft',
        title: 'Observation 1',
        summary: 'Autoresearch feedback',
        coopId: 'coop-feedback',
      }),
      createAgentObservation({
        trigger: 'stale-draft',
        title: 'Observation 2',
        summary: 'Autoresearch feedback',
        coopId: 'coop-feedback',
      }),
      createAgentObservation({
        trigger: 'stale-draft',
        title: 'Observation 3',
        summary: 'Autoresearch feedback',
        coopId: 'coop-feedback',
      }),
    ];

    for (const observation of observationIds) {
      await saveAgentObservation(db, observation);
    }

    const runs = observationIds.map((observation, index) =>
      createSkillRun({
        observationId: observation.id,
        planId: `plan-${index + 1}`,
        skill: {
          id: index === 2 ? 'skill-other' : SKILL_ID,
          version: '1.0.0',
          outputSchemaRef: 'review-digest-output',
        },
        provider: 'transformers',
      }),
    );

    for (const run of runs) {
      await saveSkillRun(db, run);
    }

    const [firstRun, secondRun, thirdRun] = runs;
    if (!firstRun || !secondRun || !thirdRun) {
      throw new Error('Expected three skill runs for feedback scoring.');
    }

    await collectFeedback(db, firstRun.id, true);
    await collectFeedback(db, secondRun.id, false);
    await collectFeedback(db, thirdRun.id, true);

    await expect(computeMemberFeedbackScore(db, SKILL_ID)).resolves.toBeCloseTo(0.5, 5);
  });

  it('throws when the skill is not registered', async () => {
    const db = freshDb();
    const baseline = await seedBaseline(db, SKILL_ID, 'Baseline prompt');
    const variant = await createVariant(db, SKILL_ID, 'Variant prompt', baseline.id);

    mockGetRegisteredSkill.mockReturnValue(undefined);

    await expect(
      runExperiment(db, SKILL_ID, variant, buildFixtures(), buildConfig()),
    ).rejects.toThrow(`Skill "${SKILL_ID}" is not registered.`);
  });

  it('returns immediately when autoresearch is disabled for the skill', async () => {
    const db = freshDb();
    await db.autoresearchConfigs.put(buildConfig({ enabled: false }));

    const summary = await runCycle(db, SKILL_ID, buildConfig({ enabled: false }));

    expect(summary).toEqual({
      experimentsRun: 0,
      kept: 0,
      reverted: 0,
      bestScore: 0,
    });
    expect(mockCompleteSkill).not.toHaveBeenCalled();
  });
});
