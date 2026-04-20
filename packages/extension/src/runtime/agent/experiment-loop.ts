import {
  type AgentMemory,
  type AutoresearchConfig,
  type CoopDexie,
  type ExperimentRecord,
  type SkillVariant,
  createAgentMemory,
  createAgentObservation,
  experimentRecordSchema,
  getAgentObservation,
  getAutoresearchConfig,
  getSkillRun,
  listAgentMemories,
  saveExperimentRecord,
  skillVariantSchema,
} from '@coop/shared';
import { type SkillEvalCase, loadSkillEvalCases, runSkillEvalCase } from './eval';
import { agentLog } from './logger';
import { computeOutputConfidence } from './quality';
import { type RegisteredSkill, getRegisteredSkill } from './registry';
import { completeSkill } from './runner-skills-completion';
import {
  activateVariant,
  createVariant,
  generateDiff,
  getBaselineVariant,
  revertToBaseline,
  seedBaseline,
} from './variant-engine';
import { generateVariantPrompt } from './variant-generation';

// --- Pause/resume state (ephemeral, per-skill) ---
const pausedSkills = new Set<string>();

export function pauseCycle(skillId: string) {
  pausedSkills.add(skillId);
}

export function resumeCycle(skillId: string) {
  pausedSkills.delete(skillId);
}

export function isCyclePaused(skillId: string) {
  return pausedSkills.has(skillId);
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildExperimentId() {
  return `experiment-${crypto.randomUUID()}`;
}

function buildExperimentObservation(skillId: string, fixtures: SkillEvalCase[]) {
  return createAgentObservation({
    trigger: 'stale-draft',
    title: `Autoresearch experiment for ${skillId}`,
    summary:
      fixtures.map((fixture) => fixture.description).join(' ') ||
      `Autoresearch evaluation for ${skillId}.`,
    payload: {
      autoresearch: true,
      skillId,
      fixtureIds: fixtures.map((fixture) => fixture.id),
    },
  });
}

function cloneRegisteredSkillWithPrompt(
  skill: RegisteredSkill,
  promptText: string,
): RegisteredSkill {
  return {
    ...skill,
    instructions: promptText,
  };
}

async function withExperimentBudget<T>(run: (signal: AbortSignal) => Promise<T>, budgetMs: number) {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const abortError = new Error(`Autoresearch experiment exceeded ${budgetMs}ms.`);

  const timeout = new Promise<never>((_, reject) => {
    controller.signal.addEventListener(
      'abort',
      () =>
        reject(controller.signal.reason instanceof Error ? controller.signal.reason : abortError),
      { once: true },
    );
  });

  timeoutId = setTimeout(() => controller.abort(abortError), budgetMs);

  try {
    return await Promise.race([run(controller.signal), timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function listFeedbackWindow(db: CoopDexie, skillId: string) {
  const memories = (await listAgentMemories(db))
    .filter(
      (memory): memory is AgentMemory & { sourceSkillRunId: string } =>
        memory.type === 'user-feedback' && typeof memory.sourceSkillRunId === 'string',
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const feedbackWindow: AgentMemory[] = [];
  const skillRunCache = new Map<string, Awaited<ReturnType<typeof getSkillRun>>>();

  for (const memory of memories) {
    const cached =
      skillRunCache.get(memory.sourceSkillRunId) ??
      (await getSkillRun(db, memory.sourceSkillRunId));
    skillRunCache.set(memory.sourceSkillRunId, cached);
    if (cached?.skillId !== skillId) {
      continue;
    }
    feedbackWindow.push(memory);
    if (feedbackWindow.length >= 20) {
      break;
    }
  }

  return feedbackWindow;
}

async function scoreOutput(
  skillId: string,
  fixtures: SkillEvalCase[],
  output: unknown,
  provider: Parameters<typeof computeOutputConfidence>[2],
  feedbackScore: number | null,
) {
  const registered = getRegisteredSkill(skillId);
  if (!registered) {
    throw new Error(`Skill "${skillId}" is not registered.`);
  }

  const fixtureResults = fixtures.map((fixture) =>
    runSkillEvalCase({
      ...fixture,
      skillId,
      outputSchemaRef: registered.manifest.outputSchemaRef,
      output,
    }),
  );
  // Spec weights: 0.2 schema + 0.3 structural + 0.3 semantic + 0.2 feedback/confidence
  const avgSchema = average(fixtureResults.map((r) => r.qualityBreakdown.schemaCompliance));
  const avgStructural = average(fixtureResults.map((r) => r.qualityBreakdown.structuralScore));
  const avgSemantic = average(fixtureResults.map((r) => r.qualityBreakdown.semanticScore));
  const lastTerm =
    typeof feedbackScore === 'number'
      ? feedbackScore
      : computeOutputConfidence(registered.manifest.outputSchemaRef, output, provider);
  const compositeScore = 0.2 * avgSchema + 0.3 * avgStructural + 0.3 * avgSemantic + 0.2 * lastTerm;

  return {
    compositeScore,
    fixtureResults: fixtureResults.map((result) => ({
      fixtureId: result.caseId,
      score: result.qualityScore,
      passed: result.passed,
    })),
  };
}

async function promoteVariantToBaseline(db: CoopDexie, skillId: string, variantId: string) {
  await db.transaction('rw', db.skillVariants, async () => {
    const variants = await db.skillVariants.where('skillId').equals(skillId).toArray();
    const nextBaseline = variants.find((v) => v.id === variantId);
    if (!nextBaseline) {
      throw new Error(`Variant "${variantId}" does not exist for skill "${skillId}".`);
    }
    // Demote the old baseline
    const oldBaseline = variants.find((v) => v.isBaseline && v.id !== variantId);
    if (oldBaseline) {
      await db.skillVariants.put(
        skillVariantSchema.parse({ ...oldBaseline, isBaseline: false, isActive: false }),
      );
    }
    // Deactivate any other active variants
    for (const v of variants.filter(
      (v) => v.isActive && v.id !== variantId && v.id !== oldBaseline?.id,
    )) {
      await db.skillVariants.put(skillVariantSchema.parse({ ...v, isActive: false }));
    }
    // Promote the new baseline
    await db.skillVariants.put(
      skillVariantSchema.parse({ ...nextBaseline, isBaseline: true, isActive: true }),
    );
  });
}

async function updateVariantScore(
  db: CoopDexie,
  variant: SkillVariant,
  compositeScore: number,
  extra: Partial<SkillVariant> = {},
) {
  const current = await db.skillVariants.get(variant.id);
  if (!current) {
    throw new Error(`Variant "${variant.id}" was not found.`);
  }
  const updated = skillVariantSchema.parse({
    ...current,
    ...extra,
    compositeScore,
  });
  await db.skillVariants.put(updated);
  return updated;
}

export async function collectFeedback(db: CoopDexie, skillRunId: string, approved: boolean) {
  const run = await getSkillRun(db, skillRunId);
  if (!run) {
    throw new Error(`Skill run "${skillRunId}" was not found.`);
  }

  const observation = await getAgentObservation(db, run.observationId);
  const coopId = observation?.coopId ?? `autoresearch:${run.skillId}`;

  return createAgentMemory(db, {
    coopId,
    type: 'user-feedback',
    domain: 'autoresearch',
    content: approved
      ? `Member approved skill run ${skillRunId} for ${run.skillId}.`
      : `Member rejected skill run ${skillRunId} for ${run.skillId}.`,
    confidence: approved ? 1 : 0,
    sourceSkillRunId: skillRunId,
  });
}

export async function computeMemberFeedbackScore(db: CoopDexie, skillId: string) {
  const feedbackWindow = await listFeedbackWindow(db, skillId);
  if (feedbackWindow.length === 0) {
    return 0.5;
  }
  return average(feedbackWindow.map((memory) => memory.confidence));
}

export async function runExperiment(
  db: CoopDexie,
  skillId: string,
  variant: SkillVariant,
  fixtures: SkillEvalCase[],
  config: AutoresearchConfig,
) {
  const registeredSkill = getRegisteredSkill(skillId);
  if (!registeredSkill) {
    throw new Error(`Skill "${skillId}" is not registered.`);
  }

  const startedAt = Date.now();
  let outcome: ExperimentRecord['outcome'] = 'reverted';
  let errorMessage: string | undefined;
  let compositeScore = 0;
  let baselineScoreValue = 0;
  let fixtureResults: ExperimentRecord['fixtureResults'] = [];
  let baselineVariantId = variant.parentVariantId ?? variant.id;
  let promptDiff = generateDiff('', variant.promptText);

  try {
    const { baselineScore, hydratedBaseline, scoredVariant } = await withExperimentBudget(
      async (signal) => {
        const baselineVariant =
          (await getBaselineVariant(db, skillId)) ??
          (await seedBaseline(db, skillId, registeredSkill.instructions));
        const feedbackWindow = await listFeedbackWindow(db, skillId);
        const feedbackScore =
          feedbackWindow.length >= 5
            ? average(feedbackWindow.map((memory) => memory.confidence))
            : null;
        const observation = buildExperimentObservation(skillId, fixtures);
        const baselineSkill = cloneRegisteredSkillWithPrompt(
          registeredSkill,
          baselineVariant.promptText,
        );
        const variantSkill = cloneRegisteredSkillWithPrompt(registeredSkill, variant.promptText);

        const baselineCompletion = await completeSkill({
          skill: baselineSkill,
          observation,
          candidates: [],
          scores: [],
          extracts: [],
          relatedDrafts: [],
          relatedArtifacts: [],
          relatedRoutings: [],
          memories: [],
          signal,
        });

        const baselineScore = await scoreOutput(
          skillId,
          fixtures,
          baselineCompletion.output,
          baselineCompletion.provider,
          feedbackScore,
        );
        const hydratedBaseline = await updateVariantScore(
          db,
          baselineVariant,
          baselineScore.compositeScore,
        );

        await activateVariant(db, variant.id);

        const variantCompletion = await completeSkill({
          skill: variantSkill,
          observation,
          candidates: [],
          scores: [],
          extracts: [],
          relatedDrafts: [],
          relatedArtifacts: [],
          relatedRoutings: [],
          memories: [],
          signal,
        });

        const scoredVariant = await scoreOutput(
          skillId,
          fixtures,
          variantCompletion.output,
          variantCompletion.provider,
          feedbackScore,
        );

        return {
          baselineScore,
          hydratedBaseline,
          scoredVariant,
        };
      },
      config.timeBudgetMs,
    );

    baselineScoreValue = baselineScore.compositeScore;
    baselineVariantId = hydratedBaseline.id;
    promptDiff = generateDiff(hydratedBaseline.promptText, variant.promptText);
    compositeScore = scoredVariant.compositeScore;
    fixtureResults = scoredVariant.fixtureResults;
    await updateVariantScore(db, variant, compositeScore, { isActive: true });

    if (compositeScore > baselineScore.compositeScore && compositeScore >= config.qualityFloor) {
      outcome = 'kept';
      await promoteVariantToBaseline(db, skillId, variant.id);
    } else {
      await revertToBaseline(db, skillId);
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
    const baselineVariant =
      (await getBaselineVariant(db, skillId)) ??
      (await seedBaseline(db, skillId, registeredSkill.instructions));
    baselineVariantId = baselineVariant.id;
    promptDiff = generateDiff(baselineVariant.promptText, variant.promptText);
    baselineScoreValue = baselineVariant.compositeScore ?? baselineScoreValue;
    await revertToBaseline(db, skillId);
  }

  const finishedAt = Date.now();
  const record = experimentRecordSchema.parse({
    id: buildExperimentId(),
    skillId,
    variantId: variant.id,
    baselineVariantId,
    promptDiff,
    compositeScore,
    baselineScore: baselineScoreValue,
    delta: compositeScore - baselineScoreValue,
    fixtureResults,
    outcome,
    duration: finishedAt - startedAt,
    createdAt: finishedAt,
  });

  await saveExperimentRecord(db, record);
  agentLog({
    spanType: 'experiment',
    level: outcome === 'kept' ? 'info' : 'warn',
    message: `Experiment ${outcome}: ${skillId} (${(compositeScore * 100).toFixed(1)}%, delta ${(record.delta * 100).toFixed(1)}%, ${finishedAt - startedAt}ms)`,
    skillId,
    data: {
      experimentId: record.id,
      outcome,
      compositeScore,
      delta: record.delta,
      duration: record.duration,
      errorMessage,
    },
  }).catch(() => {});
  return record;
}

export async function runCycle(db: CoopDexie, skillId: string, config: AutoresearchConfig) {
  const registeredSkill = getRegisteredSkill(skillId);
  if (!registeredSkill) {
    throw new Error(`Skill "${skillId}" is not registered.`);
  }

  const storedConfig = await getAutoresearchConfig(db, skillId);
  const resolvedConfig = storedConfig ?? config;
  if (!resolvedConfig.enabled) {
    return {
      experimentsRun: 0,
      kept: 0,
      reverted: 0,
      bestScore: 0,
    };
  }

  agentLog({
    spanType: 'experiment',
    level: 'info',
    message: `Autoresearch cycle starting for ${skillId} (max ${resolvedConfig.maxExperimentsPerCycle} experiments, floor ${(resolvedConfig.qualityFloor * 100).toFixed(0)}%)`,
    skillId,
  }).catch(() => {});

  const fixtures = loadSkillEvalCases().filter((fixture) => fixture.skillId === skillId);
  const baseline =
    (await getBaselineVariant(db, skillId)) ??
    (await seedBaseline(db, skillId, registeredSkill.instructions));

  let currentBaseline = baseline;
  let experimentsRun = 0;
  let kept = 0;
  let reverted = 0;
  let consecutiveReverts = 0;
  let bestScore = 0;

  for (let index = 0; index < resolvedConfig.maxExperimentsPerCycle; index += 1) {
    if (pausedSkills.has(skillId)) {
      agentLog({
        spanType: 'experiment',
        level: 'info',
        message: `Autoresearch cycle paused for ${skillId} after ${experimentsRun} experiments`,
        skillId,
      }).catch(() => {});
      break;
    }
    const variantPrompt = generateVariantPrompt(currentBaseline.promptText, index);
    const variant = await createVariant(db, skillId, variantPrompt, currentBaseline.id);
    const record = await runExperiment(db, skillId, variant, fixtures, resolvedConfig);

    experimentsRun += 1;
    bestScore = Math.max(bestScore, record.baselineScore, record.compositeScore);

    if (record.outcome === 'kept') {
      kept += 1;
      consecutiveReverts = 0;
      currentBaseline = (await getBaselineVariant(db, skillId)) ?? currentBaseline;
    } else {
      reverted += 1;
      consecutiveReverts += 1;
      currentBaseline = (await getBaselineVariant(db, skillId)) ?? currentBaseline;
      if (consecutiveReverts >= 3) {
        break;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const summary = { experimentsRun, kept, reverted, bestScore };
  agentLog({
    spanType: 'experiment',
    level: kept > 0 ? 'info' : 'warn',
    message: `Autoresearch cycle complete for ${skillId}: ${experimentsRun} run, ${kept} kept, ${reverted} reverted, best ${(bestScore * 100).toFixed(1)}%`,
    skillId,
    data: summary,
  }).catch(() => {});
  return summary;
}
