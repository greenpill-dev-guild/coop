import type {
  AgentBenchmarkRecord,
  AgentProvider,
  AgentTraceRecord,
  CoopDexie,
  SkillManifest,
} from '@coop/shared';
import {
  createAgentProviderPromotionState,
  getAgentBenchmarkRecord,
  getAgentTraceRecord,
  nowIso,
  validateAgentProviderPromotionState,
} from '@coop/shared';
import { resolveConfiguredWebLlmPromotionEnabled } from '../config';
import { BENCHMARK_SKILL_IDS, type BenchmarkSkillId } from './benchmark-fixtures';
import { AGENT_SETTING_KEYS } from './config';
import { getRegisteredSkill } from './registry';
import { runAgentProviderReleaseGate } from './release-gates';
import { getSetting, inferPreferredProvider, db as runtimeDb, setSetting } from './runner-state';

const WEBLLM_PROMOTION_ENABLED = resolveConfiguredWebLlmPromotionEnabled(
  import.meta.env.VITE_COOP_ENABLE_WEBLLM_PROMOTION,
);

function getDefaultWebLlmPromotedSkillIds(): BenchmarkSkillId[] {
  return BENCHMARK_SKILL_IDS.filter((skillId) => {
    const manifest = getRegisteredSkill(skillId)?.manifest;
    return manifest ? inferPreferredProvider(manifest) === 'transformers' : false;
  });
}

export async function getWebLlmProviderPromotionState(db: CoopDexie = runtimeDb) {
  const stored = await getSetting<unknown | null>(
    AGENT_SETTING_KEYS.webLlmPromotionState,
    null,
    db,
  );
  return stored ? validateAgentProviderPromotionState(stored) : null;
}

export async function getWebLlmProviderPromotionEvidence(db: CoopDexie = runtimeDb): Promise<{
  benchmarkRecords: AgentBenchmarkRecord[];
  traceRecords: AgentTraceRecord[];
}> {
  const state = await getWebLlmProviderPromotionState(db);
  if (!state) {
    return {
      benchmarkRecords: [],
      traceRecords: [],
    };
  }

  const [benchmarkRecords, traceRecords] = await Promise.all([
    Promise.all(state.benchmarkRecordIds.map((recordId) => getAgentBenchmarkRecord(db, recordId))),
    Promise.all(state.traceRecordIds.map((recordId) => getAgentTraceRecord(db, recordId))),
  ]);

  return {
    benchmarkRecords: benchmarkRecords.filter((record): record is AgentBenchmarkRecord =>
      Boolean(record),
    ),
    traceRecords: traceRecords.filter((record): record is AgentTraceRecord => Boolean(record)),
  };
}

export async function activateWebLlmProviderPromotion(
  input: {
    db?: CoopDexie;
    skillIds?: BenchmarkSkillId[];
    persistBenchmarks?: boolean;
    persistTraces?: boolean;
  } = {},
) {
  const db = input.db ?? runtimeDb;
  const skillIds = input.skillIds ?? getDefaultWebLlmPromotedSkillIds();
  const [gateResult] = await runAgentProviderReleaseGate({
    db,
    providerIds: ['webllm'],
    skillIds,
    persistBenchmarks: input.persistBenchmarks,
    persistTraces: input.persistTraces,
  });

  if (!gateResult) {
    throw new Error('WebLLM release gate did not return a result.');
  }

  const timestamp = nowIso();
  const benchmarkPersistenceEnabled = input.persistBenchmarks ?? true;
  const tracePersistenceEnabled = input.persistTraces ?? true;
  const state = createAgentProviderPromotionState({
    providerId: 'webllm',
    baselineProviderId: 'transformers',
    evaluatedSkillIds: [...skillIds],
    promotedSkillIds: gateResult.promotable ? [...skillIds] : [],
    benchmarkRecordIds: benchmarkPersistenceEnabled
      ? gateResult.benchmarkRecords.map((record) => record.id)
      : [],
    traceRecordIds: tracePersistenceEnabled
      ? gateResult.securityResults.flatMap((result) =>
          typeof result.traceRecordId === 'string' ? [result.traceRecordId] : [],
        )
      : [],
    benchmarked: gateResult.benchmarked,
    traced: gateResult.traced,
    schemaStable: gateResult.schemaStable,
    maliciousPackClean: gateResult.maliciousPackClean,
    fallbackSafe: gateResult.fallbackSafe,
    promotable: gateResult.promotable,
    securityPassRate: gateResult.securityPassRate,
    failedChecks: gateResult.failedChecks,
    evaluatedAt: timestamp,
    activatedAt: gateResult.promotable ? timestamp : undefined,
  });

  await setSetting(AGENT_SETTING_KEYS.webLlmPromotionState, state, db);
  return state;
}

export async function resolvePreferredProvider(
  manifest: SkillManifest,
  input: {
    db?: CoopDexie;
    webLlmPromotionEnabled?: boolean;
  } = {},
): Promise<AgentProvider> {
  const fallbackProvider = inferPreferredProvider(manifest);
  if (fallbackProvider !== 'transformers') {
    return fallbackProvider;
  }

  const webLlmPromotionEnabled = input.webLlmPromotionEnabled ?? WEBLLM_PROMOTION_ENABLED;
  if (!webLlmPromotionEnabled) {
    return fallbackProvider;
  }

  const state = await getWebLlmProviderPromotionState(input.db);
  if (
    state?.promotable &&
    state.providerId === 'webllm' &&
    state.baselineProviderId === 'transformers' &&
    state.promotedSkillIds.includes(manifest.id)
  ) {
    return 'webllm';
  }

  return fallbackProvider;
}
