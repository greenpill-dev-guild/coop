import type {
  AgentBenchmarkFixtureResult,
  AgentBenchmarkRecord,
  AgentProvider,
  AgentRuntimeProviderId,
  CoopDexie,
} from '@coop/shared';
import { createAgentBenchmarkRecord, saveAgentBenchmarkRecord } from '@coop/shared';
import {
  BENCHMARK_SKILL_IDS,
  type BenchmarkSkillId,
  loadAgentBenchmarkFixtures,
} from './benchmark-fixtures';
import { teardownAgentModels } from './models';
import {
  executeRuntimeProviderSkill,
  getAgentRuntimeProviderContract,
  listAgentRuntimeProviderContracts,
} from './provider-contracts';
import { computeOutputConfidence } from './quality';
import { getRegisteredSkill } from './registry';
import { buildSkillPrompt } from './runner-skills-prompt';
import { db as runtimeDb } from './runner-state';

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? null;
  }
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function toConfidenceProvider(providerId: AgentRuntimeProviderId): AgentProvider {
  if (providerId === 'heuristic') {
    return 'heuristic';
  }
  if (providerId === 'webllm') {
    return 'webllm';
  }
  return 'transformers';
}

function summarizeBenchmarkOutcome(
  results: AgentBenchmarkFixtureResult[],
): AgentBenchmarkRecord['outcome'] {
  if (results.length > 0 && results.every((result) => result.outcome === 'unavailable')) {
    return 'unavailable';
  }
  if (results.every((result) => result.outcome === 'completed' && result.schemaPassed)) {
    return 'completed';
  }
  return 'completed-with-failures';
}

async function runBenchmarkForSkillProvider(input: {
  db: CoopDexie;
  skillId: BenchmarkSkillId;
  providerId: AgentRuntimeProviderId;
  fixtures: ReturnType<typeof loadAgentBenchmarkFixtures>;
  persist: boolean;
}) {
  const contract = getAgentRuntimeProviderContract(input.providerId);
  if (!contract) {
    throw new Error(`Unknown runtime provider "${input.providerId}".`);
  }

  const skill = getRegisteredSkill(input.skillId);
  if (!skill) {
    throw new Error(`Unknown benchmark skill "${input.skillId}".`);
  }

  const fixtures = input.fixtures.filter((fixture) => fixture.skillId === input.skillId);
  teardownAgentModels();

  const fixtureResults: AgentBenchmarkFixtureResult[] = [];
  let modelId = contract.defaultModelId;

  for (const fixture of fixtures) {
    const prepared = await buildSkillPrompt({
      skill,
      observation: fixture.observation,
      coop: fixture.coop,
      draft: fixture.draft,
      capture: fixture.capture,
      receipt: fixture.receipt,
      candidates: fixture.candidates,
      scores: fixture.scores,
      extracts: fixture.extracts,
      relatedDrafts: fixture.relatedDrafts,
      relatedArtifacts: fixture.relatedArtifacts,
      relatedRoutings: fixture.relatedRoutings,
      memories: fixture.memories,
      graphContext: fixture.graphContext,
    });

    const result = await executeRuntimeProviderSkill({
      providerId: input.providerId,
      schemaRef: skill.manifest.outputSchemaRef,
      system: prepared.system,
      prompt: prepared.prompt,
      heuristicContext: prepared.heuristicContext,
      maxTokens: skill.manifest.maxTokens,
    });

    modelId = result.modelId ?? modelId;

    if (result.outcome === 'completed') {
      fixtureResults.push({
        fixtureId: fixture.id,
        outcome: 'completed',
        schemaPassed: true,
        jsonRepaired: result.jsonRepaired,
        latencyMs: result.durationMs,
        coldStartMs: result.coldStartMs,
        confidenceScore: computeOutputConfidence(
          skill.manifest.outputSchemaRef,
          result.output,
          toConfidenceProvider(input.providerId),
        ),
      });
      continue;
    }

    if (result.outcome === 'failed') {
      fixtureResults.push({
        fixtureId: fixture.id,
        outcome: 'failed',
        schemaPassed: false,
        jsonRepaired: result.jsonRepaired,
        latencyMs: result.durationMs,
        coldStartMs: result.coldStartMs,
        confidenceScore: null,
        failureReason: result.failureReason,
      });
      continue;
    }

    fixtureResults.push({
      fixtureId: fixture.id,
      outcome: 'unavailable',
      schemaPassed: false,
      jsonRepaired: false,
      latencyMs: 0,
      coldStartMs: result.coldStartMs,
      confidenceScore: null,
      unavailableReason: result.unavailableReason,
      fallbackProviderId: result.fallbackProviderId,
    });
  }

  const completedResults = fixtureResults.filter((result) => result.outcome === 'completed');
  const schemaPassRate =
    fixtureResults.length === 0
      ? 0
      : fixtureResults.filter((result) => result.schemaPassed).length / fixtureResults.length;
  const jsonRepairRate =
    fixtureResults.length === 0
      ? 0
      : fixtureResults.filter((result) => result.jsonRepaired).length / fixtureResults.length;
  const record = createAgentBenchmarkRecord({
    skillId: input.skillId,
    providerId: input.providerId,
    providerTier: contract.tier,
    modelId,
    capabilities: contract.capabilities,
    fallbackOrder: contract.fallbackOrder,
    outcome: summarizeBenchmarkOutcome(fixtureResults),
    fixtureResults,
    schemaPassRate,
    jsonRepairRate,
    medianLatencyMs: median(completedResults.map((result) => result.latencyMs)),
    coldStartTimeMs:
      fixtureResults.find((result) => result.coldStartMs !== null)?.coldStartMs ?? null,
    confidenceScore: average(
      completedResults
        .map((result) => result.confidenceScore)
        .filter((score): score is number => typeof score === 'number'),
    ),
    unavailableReason: fixtureResults.find((result) => typeof result.unavailableReason === 'string')
      ?.unavailableReason,
    fallbackProviderId: fixtureResults.find(
      (result) => typeof result.fallbackProviderId === 'string',
    )?.fallbackProviderId,
    fallbackReason:
      fixtureResults.find((result) => typeof result.unavailableReason === 'string')
        ?.unavailableReason ??
      fixtureResults.find((result) => typeof result.failureReason === 'string')?.failureReason,
  });

  if (input.persist) {
    await saveAgentBenchmarkRecord(input.db, record);
  }

  return record;
}

export async function runAgentProviderBenchmarks(
  input: {
    db?: CoopDexie;
    providerIds?: AgentRuntimeProviderId[];
    skillIds?: BenchmarkSkillId[];
    persist?: boolean;
  } = {},
) {
  const db = input.db ?? runtimeDb;
  const providerIds =
    input.providerIds ?? listAgentRuntimeProviderContracts().map((contract) => contract.id);
  const skillIds = input.skillIds ?? [...BENCHMARK_SKILL_IDS];
  const persist = input.persist ?? true;
  const fixtures = loadAgentBenchmarkFixtures();
  const records: AgentBenchmarkRecord[] = [];

  for (const skillId of skillIds) {
    for (const providerId of providerIds) {
      records.push(
        await runBenchmarkForSkillProvider({
          db,
          skillId,
          providerId,
          fixtures,
          persist,
        }),
      );
    }
  }

  return records;
}
