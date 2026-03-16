import type { AgentLog, AgentLogLevel, AgentLogSpanType } from '@coop/shared';
import { createCoopDb, createId, nowIso, saveAgentLog } from '@coop/shared';

const db = createCoopDb('coop-extension');

let activeTraceId: string | null = null;

export function startTrace(): string {
  activeTraceId = createId('agent-trace');
  return activeTraceId;
}

export function getActiveTraceId(): string {
  return activeTraceId ?? createId('agent-trace');
}

export async function agentLog(input: {
  spanType: AgentLogSpanType;
  level: AgentLogLevel;
  message: string;
  skillId?: string;
  observationId?: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  const log: AgentLog = {
    id: createId('agent-log'),
    traceId: getActiveTraceId(),
    spanType: input.spanType,
    skillId: input.skillId,
    observationId: input.observationId,
    level: input.level,
    message: input.message,
    data: input.data,
    timestamp: nowIso(),
  };

  try {
    await saveAgentLog(db, log);
  } catch {
    // Logging should never break the agent cycle
  }
}

export async function logCycleStart(observationCount: number): Promise<string> {
  const traceId = startTrace();
  await agentLog({
    spanType: 'cycle',
    level: 'info',
    message: `Agent cycle started with ${observationCount} pending observations.`,
    data: { observationCount },
  });
  return traceId;
}

export async function logCycleEnd(input: {
  processedCount: number;
  errorCount: number;
  durationMs: number;
}): Promise<void> {
  await agentLog({
    spanType: 'cycle',
    level: input.errorCount > 0 ? 'warn' : 'info',
    message: `Agent cycle completed: ${input.processedCount} processed, ${input.errorCount} errors.`,
    data: {
      processedCount: input.processedCount,
      errorCount: input.errorCount,
      durationMs: input.durationMs,
    },
  });
  activeTraceId = null;
}

export async function logObservationStart(input: {
  observationId: string;
  trigger: string;
}): Promise<void> {
  await agentLog({
    spanType: 'observation',
    level: 'info',
    message: `Processing observation: ${input.trigger}`,
    observationId: input.observationId,
    data: { trigger: input.trigger },
  });
}

export async function logObservationDismissed(input: {
  observationId: string;
  reason: string;
}): Promise<void> {
  await agentLog({
    spanType: 'observation',
    level: 'info',
    message: `Observation dismissed: ${input.reason}`,
    observationId: input.observationId,
    data: { reason: input.reason },
  });
}

export async function logSkillStart(input: {
  skillId: string;
  observationId: string;
  provider: string;
}): Promise<void> {
  await agentLog({
    spanType: 'skill',
    level: 'info',
    message: `Skill started: ${input.skillId} (${input.provider})`,
    skillId: input.skillId,
    observationId: input.observationId,
    data: { provider: input.provider },
  });
}

export async function logSkillComplete(input: {
  skillId: string;
  observationId: string;
  provider: string;
  model?: string;
  durationMs: number;
  retryCount?: number;
  skipped?: boolean;
}): Promise<void> {
  await agentLog({
    spanType: 'skill',
    level: 'info',
    message: input.skipped
      ? `Skill skipped: ${input.skillId}`
      : `Skill completed: ${input.skillId} in ${input.durationMs}ms`,
    skillId: input.skillId,
    observationId: input.observationId,
    data: {
      provider: input.provider,
      model: input.model,
      durationMs: input.durationMs,
      retryCount: input.retryCount ?? 0,
      skipped: input.skipped ?? false,
    },
  });
}

export async function logSkillFailed(input: {
  skillId: string;
  observationId: string;
  error: string;
}): Promise<void> {
  await agentLog({
    spanType: 'skill',
    level: 'error',
    message: `Skill failed: ${input.skillId} — ${input.error}`,
    skillId: input.skillId,
    observationId: input.observationId,
    data: { error: input.error },
  });
}

export async function logActionDispatch(input: {
  observationId: string;
  actionClass: string;
  autoExecute: boolean;
  success: boolean;
  error?: string;
}): Promise<void> {
  await agentLog({
    spanType: 'action',
    level: input.success ? 'info' : 'error',
    message: input.success
      ? `Action dispatched: ${input.actionClass}${input.autoExecute ? ' (auto-executed)' : ''}`
      : `Action failed: ${input.actionClass} — ${input.error}`,
    observationId: input.observationId,
    data: {
      actionClass: input.actionClass,
      autoExecute: input.autoExecute,
      success: input.success,
      error: input.error,
    },
  });
}
