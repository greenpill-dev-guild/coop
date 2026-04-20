import type { CoopSharedState } from '@coop/shared';
import {
  getAuthSession,
  getSkillRun,
  listAgentObservationsByStatus,
  listAgentPlansByObservationId,
  nowIso,
  pruneExpiredMemories,
  saveAgentObservation,
  updateAgentObservation,
} from '@coop/shared';
import { notifyAgentEvent, notifyDashboardUpdated } from '../messages';
import {
  AGENT_MAX_CONSECUTIVE_FAILURES,
  AGENT_QUALITY_STALL_THRESHOLD,
  AGENT_SETTING_KEYS,
  AGENT_STUCK_STATE_TIMEOUT_MS,
  computeQualityTrend,
  pushQualityScore,
  recentQualityAverage,
} from './config';
import { logCycleEnd, logCycleStart } from './logger';
import {
  isObservationRunnableForAuthorizedCoops,
  prioritizeObservations,
  resolveObservationEligibleCoopIds,
} from './runner-observations';
import { runObservationPlan } from './runner-skills';
import {
  type AgentCycleResult,
  db,
  getCoops,
  getCycleRequest,
  getCycleState,
  listAuthorizedOperatorCoopIds,
  setCycleState,
  setSetting,
} from './runner-state';

// Re-export all split module surfaces for downstream consumers
export type {
  AgentCycleResult,
  SkillRunMetric,
  SkillExecutionContext,
  CoopDexie,
} from './runner-state';
export {
  compact,
  db,
  getSetting,
  setSetting,
  getCycleState,
  setCycleState,
  getCycleRequest,
  getAutoRunSkillIds,
  getCoops,
  findAuthenticatedCoopMember,
  inferPreferredProvider,
  listAuthorizedOperatorCoopIds,
} from './runner-state';
export {
  isObservationRunnableForAuthorizedCoops,
  observationPriority,
  prioritizeObservations,
  getObservationDismissReason,
  resolveObservationExtractIds,
  resolveObservationRoutingIds,
  resolveObservationEligibleCoopIds,
} from './runner-observations';
export {
  buildSkillPrompt,
  completeSkill,
  maybePatchDraft,
  dispatchActionProposal,
  uniqueById,
  persistEntityExtractionOutput,
  persistTabRouterOutput,
  buildSkillContext,
  extractMemoriesFromOutput,
  runObservationPlan,
} from './runner-skills';
export {
  computeGrantFitScores,
  inferEntitiesFromText,
  inferThemes,
  inferTabRoutingsHeuristically,
} from './runner-inference';

export async function runAgentCycle(options: { force?: boolean; reason?: string } = {}) {
  const cycleState = await getCycleState();
  if (cycleState.running) {
    const stale =
      cycleState.lastStartedAt &&
      Date.now() - new Date(cycleState.lastStartedAt).getTime() > AGENT_STUCK_STATE_TIMEOUT_MS;
    if (stale) {
      console.warn(
        `[agent-runner] Stuck-state recovery: cycle has been running since ${cycleState.lastStartedAt}, resetting.`,
      );
      await setCycleState({ running: false });
    } else {
      return {
        processedObservationIds: [],
        createdPlanIds: [],
        createdDraftIds: [],
        completedSkillRunIds: [],
        autoExecutedActionCount: 0,
        errors: [],
        skillRunMetrics: [],
      } satisfies AgentCycleResult;
    }
  }

  const [request, pendingObservations] = await Promise.all([
    getCycleRequest(),
    listAgentObservationsByStatus(db, ['pending']),
  ]);
  if (!options.force && pendingObservations.length === 0 && !request) {
    return {
      processedObservationIds: [],
      createdPlanIds: [],
      createdDraftIds: [],
      completedSkillRunIds: [],
      autoExecutedActionCount: 0,
      errors: [],
      skillRunMetrics: [],
    } satisfies AgentCycleResult;
  }

  const cycleStart = Date.now();
  const traceId = await logCycleStart(pendingObservations.length);

  await setCycleState({
    running: true,
    lastStartedAt: nowIso(),
    lastRequestId: request?.id,
    lastRequestAt: request?.requestedAt,
    lastError: undefined,
  });
  void notifyAgentEvent({
    type: 'AGENT_CYCLE_STARTED',
    traceId: traceId ?? '',
    reason: options.reason ?? 'scheduled',
    pendingObservationCount: pendingObservations.length,
    emittedAt: nowIso(),
  });

  const result: AgentCycleResult = {
    processedObservationIds: [],
    createdPlanIds: [],
    createdDraftIds: [],
    completedSkillRunIds: [],
    autoExecutedActionCount: 0,
    errors: [],
    traceId,
    skillRunMetrics: [],
  };
  let authorizedCoopIds = new Set<string>();
  let authorizedCoops: CoopSharedState[] = [];

  try {
    const [coops, authSession] = await Promise.all([getCoops(), getAuthSession(db)]);
    authorizedCoops = coops;
    authorizedCoopIds = listAuthorizedOperatorCoopIds(coops, authSession);
    const runnableObservations = prioritizeObservations(
      pendingObservations.filter((observation) =>
        isObservationRunnableForAuthorizedCoops({
          observation,
          authorizedCoopIds,
          coops,
        }),
      ),
    );

    // Quality-based cycle-level stall: skip the entire batch when quality is degrading
    const qualityStalledReason = (() => {
      if (cycleState.qualityTrend !== 'degrading') return null;
      const scores = cycleState.recentQualityScores ?? [];
      if (scores.length < 3) return null;
      const avg = recentQualityAverage(scores);
      if (avg >= AGENT_QUALITY_STALL_THRESHOLD) return null;
      return `Quality degradation: average confidence ${avg.toFixed(2)} below threshold ${AGENT_QUALITY_STALL_THRESHOLD}. Trend: degrading.`;
    })();

    for (const observation of runnableObservations.slice(0, 8)) {
      const eligibleCoopIds = observation.coopId
        ? null
        : new Set(resolveObservationEligibleCoopIds(observation, coops));
      const scopedCoops = observation.coopId
        ? coops.filter(
            (coop) =>
              coop.profile.id === observation.coopId && authorizedCoopIds.has(coop.profile.id),
          )
        : coops.filter(
            (coop) =>
              authorizedCoopIds.has(coop.profile.id) &&
              Boolean(eligibleCoopIds?.has(coop.profile.id)),
          );
      if (scopedCoops.length === 0) {
        continue;
      }

      const scopedObservation =
        observation.coopId || scopedCoops.length === coops.length
          ? observation
          : updateAgentObservation(observation, {
              payload: {
                ...observation.payload,
                eligibleCoopIds: scopedCoops.map((coop) => coop.profile.id),
              },
            });

      // Stall detection: skip observations that have failed too many times
      const priorPlans = await listAgentPlansByObservationId(db, observation.id);
      if (priorPlans.some((plan) => plan.status === 'executing')) {
        continue;
      }
      const failedPlanCount = priorPlans.filter((plan) => plan.status === 'failed').length;
      if (failedPlanCount >= AGENT_MAX_CONSECUTIVE_FAILURES) {
        await saveAgentObservation(
          db,
          updateAgentObservation(observation, {
            status: 'stalled',
            blockedReason: `Stalled after ${failedPlanCount} consecutive failures.`,
          }),
        );
        continue;
      }

      if (qualityStalledReason) {
        await saveAgentObservation(
          db,
          updateAgentObservation(observation, {
            status: 'stalled',
            blockedReason: qualityStalledReason,
          }),
        );
        continue;
      }

      const observationResult = await runObservationPlan(scopedObservation, {
        availableCoops: scopedCoops,
      });
      result.processedObservationIds.push(...observationResult.processedObservationIds);
      result.createdPlanIds.push(...observationResult.createdPlanIds);
      result.createdDraftIds.push(...observationResult.createdDraftIds);
      result.completedSkillRunIds.push(...observationResult.completedSkillRunIds);
      result.autoExecutedActionCount += observationResult.autoExecutedActionCount;
      result.errors.push(...observationResult.errors);
      result.skillRunMetrics.push(...observationResult.skillRunMetrics);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Agent cycle failed.';
    result.errors.push(errorMessage);
    void notifyAgentEvent({
      type: 'AGENT_CYCLE_ERROR',
      traceId: result.traceId ?? '',
      error: errorMessage,
      emittedAt: nowIso(),
    });
  } finally {
    void pruneExpiredMemories(db).catch((err) => {
      console.warn('[agent-memory] Failed to prune expired memories:', err);
    });
    result.totalDurationMs = Date.now() - cycleStart;
    // Track quality scores from completed plans only (exclude failed plans
    // whose confidence was never recalculated and could mask degradation)
    let updatedQualityScores = cycleState.recentQualityScores ?? [];
    if (result.createdPlanIds.length > 0) {
      for (const planId of result.createdPlanIds) {
        const plan = await db.agentPlans.get(planId);
        if (plan && plan.status === 'completed') {
          updatedQualityScores = pushQualityScore(updatedQualityScores, plan.confidence);
        }
      }
    }
    const updatedQualityTrend = computeQualityTrend(updatedQualityScores);

    await setCycleState({
      running: false,
      lastCompletedAt: nowIso(),
      lastError: result.errors[0],
      consecutiveFailureCount:
        result.errors.length > 0 ? (cycleState.consecutiveFailureCount ?? 0) + 1 : 0,
      recentQualityScores: updatedQualityScores,
      qualityTrend: updatedQualityTrend,
    });
    if (request) {
      await setSetting(AGENT_SETTING_KEYS.cycleRequest, null);
    }
    void logCycleEnd({
      processedCount: result.processedObservationIds.length,
      errorCount: result.errors.length,
      durationMs: result.totalDurationMs,
    });
    const remainingPending = await listAgentObservationsByStatus(db, ['pending']);
    if (
      remainingPending.some((observation) =>
        isObservationRunnableForAuthorizedCoops({
          observation,
          authorizedCoopIds,
          coops: authorizedCoops,
        }),
      )
    ) {
      queueMicrotask(() => {
        void runAgentCycle();
      });
    }
    // Always emit AGENT_CYCLE_FINISHED to match the unconditional AGENT_CYCLE_STARTED,
    // preventing agentRunning from getting stuck at true in the UI.
    void notifyAgentEvent({
      type: 'AGENT_CYCLE_FINISHED',
      traceId: result.traceId ?? '',
      processedCount: result.processedObservationIds.length,
      draftCount: result.createdDraftIds.length,
      errorCount: result.errors.length,
      durationMs: result.totalDurationMs ?? 0,
      emittedAt: nowIso(),
    });
    if (
      result.processedObservationIds.length > 0 ||
      result.createdDraftIds.length > 0 ||
      result.completedSkillRunIds.length > 0 ||
      result.errors.length > 0
    ) {
      void notifyDashboardUpdated();
    }
  }

  return result;
}

export async function triggerRetryForSkillRun(skillRunId: string) {
  const skillRun = await getSkillRun(db, skillRunId);
  if (!skillRun) {
    throw new Error('Skill run not found.');
  }
  const observation = await db.agentObservations.get(skillRun.observationId);
  if (!observation) {
    throw new Error('Agent observation not found.');
  }
  await saveAgentObservation(
    db,
    updateAgentObservation(observation, {
      status: 'pending',
      blockedReason: undefined,
    }),
  );
  return observation.id;
}
