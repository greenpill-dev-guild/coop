import type {
  AgentBenchmarkRecord,
  AgentProvider,
  AgentRuntimeProviderId,
  CoopDexie,
} from '@coop/shared';
import { createId } from '@coop/shared';
import {
  type AgentBenchmarkFixture,
  BENCHMARK_SKILL_IDS,
  type BenchmarkSkillId,
  loadAgentSecurityBenchmarkFixtures,
} from './benchmark-fixtures';
import { runAgentProviderBenchmarks } from './benchmarks';
import { loadSkillEvalCases, runEvalSuite } from './eval';
import { executeRuntimeProviderSkill, getAgentRuntimeProviderContract } from './provider-contracts';
import { computeOutputConfidence } from './quality';
import { getRegisteredSkill } from './registry';
import { buildSkillPrompt } from './runner-skills-prompt';
import { db as runtimeDb } from './runner-state';
import { hashTraceValue, persistAgentSkillTrace } from './trace-records';

type SecurityEvalCase = ReturnType<typeof loadSkillEvalCases>[number];

export type AgentProviderSecurityFixtureResult = {
  fixtureId: string;
  skillId: BenchmarkSkillId;
  providerId: AgentRuntimeProviderId;
  providerOutcome: 'completed' | 'failed' | 'unavailable';
  passed: boolean;
  safeFallback: boolean;
  schemaPassed: boolean;
  evalScore: number | null;
  confidenceScore: number | null;
  fallbackProviderId?: AgentRuntimeProviderId;
  failureReason?: string;
  unavailableReason?: string;
  traceRecordId?: string;
};

export type AgentProviderReleaseGateResult = {
  providerId: AgentRuntimeProviderId;
  modelId?: string;
  benchmarked: boolean;
  traced: boolean;
  schemaStable: boolean;
  maliciousPackClean: boolean;
  fallbackSafe: boolean;
  promotable: boolean;
  securityPassRate: number;
  traceCount: number;
  failedChecks: string[];
  benchmarkRecords: AgentBenchmarkRecord[];
  securityResults: AgentProviderSecurityFixtureResult[];
};

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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

function getMaliciousEvalCases(skillId: BenchmarkSkillId): SecurityEvalCase[] {
  return loadSkillEvalCases().filter(
    (testCase) => testCase.skillId === skillId && testCase.fixtureType === 'malicious',
  );
}

function benchmarkRecordHasGracefulFallback(record: AgentBenchmarkRecord) {
  return record.fixtureResults.every(
    (fixtureResult) =>
      fixtureResult.outcome === 'completed' ||
      (fixtureResult.outcome === 'unavailable' &&
        typeof fixtureResult.fallbackProviderId === 'string'),
  );
}

async function runSecurityFixture(input: {
  db: CoopDexie;
  traceId: string;
  fixture: AgentBenchmarkFixture;
  providerId: AgentRuntimeProviderId;
  persistTraces: boolean;
}): Promise<AgentProviderSecurityFixtureResult> {
  const contract = getAgentRuntimeProviderContract(input.providerId);
  if (!contract) {
    throw new Error(`Unknown runtime provider "${input.providerId}".`);
  }

  const skill = getRegisteredSkill(input.fixture.skillId);
  if (!skill) {
    throw new Error(`Unknown benchmark skill "${input.fixture.skillId}".`);
  }

  const maliciousCases = getMaliciousEvalCases(input.fixture.skillId);
  if (maliciousCases.length === 0) {
    throw new Error(`Missing malicious eval fixtures for "${input.fixture.skillId}".`);
  }

  const prepared = await buildSkillPrompt({
    skill,
    observation: input.fixture.observation,
    coop: input.fixture.coop,
    draft: input.fixture.draft,
    capture: input.fixture.capture,
    receipt: input.fixture.receipt,
    candidates: input.fixture.candidates,
    scores: input.fixture.scores,
    extracts: input.fixture.extracts,
    relatedDrafts: input.fixture.relatedDrafts,
    relatedArtifacts: input.fixture.relatedArtifacts,
    relatedRoutings: input.fixture.relatedRoutings,
    memories: input.fixture.memories,
    graphContext: input.fixture.graphContext,
  });

  const promptHash = await hashTraceValue(`${prepared.system}\n\n${prepared.prompt}`);
  const startedAt = Date.now();
  const result = await executeRuntimeProviderSkill({
    providerId: input.providerId,
    schemaRef: skill.manifest.outputSchemaRef,
    system: prepared.system,
    prompt: prepared.prompt,
    heuristicContext: prepared.heuristicContext,
    maxTokens: skill.manifest.maxTokens,
  });

  if (result.outcome === 'completed') {
    const securityEval = runEvalSuite(input.fixture.skillId, result.output, maliciousCases);
    const passed = securityEval.fixtureResults.every((fixtureResult) => fixtureResult.passed);
    const confidenceScore = computeOutputConfidence(
      skill.manifest.outputSchemaRef,
      result.output,
      toConfidenceProvider(input.providerId),
    );
    const traceRecord = input.persistTraces
      ? await persistAgentSkillTrace({
          db: input.db,
          traceId: input.traceId,
          observationId: input.fixture.observation.id,
          skillId: input.fixture.skillId,
          providerId: input.providerId,
          modelId: result.modelId ?? contract.defaultModelId,
          promptHash,
          preparedPrompt: prepared,
          context: {
            observation: input.fixture.observation,
            coop: input.fixture.coop,
            draft: input.fixture.draft,
            capture: input.fixture.capture,
            receipt: input.fixture.receipt,
            candidates: input.fixture.candidates,
            scores: input.fixture.scores,
            extracts: input.fixture.extracts,
            relatedDrafts: input.fixture.relatedDrafts,
            relatedArtifacts: input.fixture.relatedArtifacts,
            relatedRoutings: input.fixture.relatedRoutings,
            memories: input.fixture.memories,
            graphContext: input.fixture.graphContext,
          },
          startedAt,
          durationMs: result.durationMs,
          output: result.output,
          repairSteps: result.jsonRepaired ? ['json-repaired'] : [],
          validationErrors: passed
            ? []
            : securityEval.fixtureResults.flatMap((fixtureResult) => fixtureResult.failures),
          confidenceScore,
          evalScore: securityEval.compositeScore,
          outcome: passed ? 'completed' : 'rejected',
        })
      : null;

    return {
      fixtureId: input.fixture.id,
      skillId: input.fixture.skillId,
      providerId: input.providerId,
      providerOutcome: 'completed',
      passed,
      safeFallback: true,
      schemaPassed: true,
      evalScore: securityEval.compositeScore,
      confidenceScore,
      traceRecordId: traceRecord?.id,
    };
  }

  if (result.outcome === 'unavailable') {
    const passed = typeof result.fallbackProviderId === 'string';
    const traceRecord = input.persistTraces
      ? await persistAgentSkillTrace({
          db: input.db,
          traceId: input.traceId,
          observationId: input.fixture.observation.id,
          skillId: input.fixture.skillId,
          providerId: input.providerId,
          modelId: result.modelId ?? contract.defaultModelId,
          promptHash,
          preparedPrompt: prepared,
          context: {
            observation: input.fixture.observation,
            coop: input.fixture.coop,
            draft: input.fixture.draft,
            capture: input.fixture.capture,
            receipt: input.fixture.receipt,
            candidates: input.fixture.candidates,
            scores: input.fixture.scores,
            extracts: input.fixture.extracts,
            relatedDrafts: input.fixture.relatedDrafts,
            relatedArtifacts: input.fixture.relatedArtifacts,
            relatedRoutings: input.fixture.relatedRoutings,
            memories: input.fixture.memories,
            graphContext: input.fixture.graphContext,
          },
          startedAt,
          durationMs: result.durationMs,
          repairSteps: [],
          validationErrors: [result.unavailableReason],
          outcome: 'fallback',
        })
      : null;

    return {
      fixtureId: input.fixture.id,
      skillId: input.fixture.skillId,
      providerId: input.providerId,
      providerOutcome: 'unavailable',
      passed,
      safeFallback: passed,
      schemaPassed: false,
      evalScore: null,
      confidenceScore: null,
      fallbackProviderId: result.fallbackProviderId,
      unavailableReason: result.unavailableReason,
      traceRecordId: traceRecord?.id,
    };
  }

  const traceRecord = input.persistTraces
    ? await persistAgentSkillTrace({
        db: input.db,
        traceId: input.traceId,
        observationId: input.fixture.observation.id,
        skillId: input.fixture.skillId,
        providerId: input.providerId,
        modelId: result.modelId ?? contract.defaultModelId,
        promptHash,
        preparedPrompt: prepared,
        context: {
          observation: input.fixture.observation,
          coop: input.fixture.coop,
          draft: input.fixture.draft,
          capture: input.fixture.capture,
          receipt: input.fixture.receipt,
          candidates: input.fixture.candidates,
          scores: input.fixture.scores,
          extracts: input.fixture.extracts,
          relatedDrafts: input.fixture.relatedDrafts,
          relatedArtifacts: input.fixture.relatedArtifacts,
          relatedRoutings: input.fixture.relatedRoutings,
          memories: input.fixture.memories,
          graphContext: input.fixture.graphContext,
        },
        startedAt,
        durationMs: result.durationMs,
        repairSteps: result.jsonRepaired ? ['json-repaired'] : [],
        validationErrors: [result.failureReason],
        outcome: 'failed',
      })
    : null;

  return {
    fixtureId: input.fixture.id,
    skillId: input.fixture.skillId,
    providerId: input.providerId,
    providerOutcome: 'failed',
    passed: false,
    safeFallback: false,
    schemaPassed: false,
    evalScore: null,
    confidenceScore: null,
    failureReason: result.failureReason,
    traceRecordId: traceRecord?.id,
  };
}

export async function runAgentProviderReleaseGate(
  input: {
    db?: CoopDexie;
    providerIds?: AgentRuntimeProviderId[];
    skillIds?: BenchmarkSkillId[];
    persistBenchmarks?: boolean;
    persistTraces?: boolean;
  } = {},
) {
  const db = input.db ?? runtimeDb;
  const providerIds =
    input.providerIds ??
    (
      ['heuristic', 'transformers', 'webllm', 'chrome-prompt-api'] as AgentRuntimeProviderId[]
    ).filter((providerId) => Boolean(getAgentRuntimeProviderContract(providerId)));
  const skillIds = input.skillIds ?? [...BENCHMARK_SKILL_IDS];
  const persistBenchmarks = input.persistBenchmarks ?? true;
  const persistTraces = input.persistTraces ?? true;

  const benchmarkRecords = await runAgentProviderBenchmarks({
    db,
    providerIds,
    skillIds,
    persist: persistBenchmarks,
  });
  const securityFixtures = loadAgentSecurityBenchmarkFixtures().filter((fixture) =>
    skillIds.includes(fixture.skillId),
  );
  const gateResults: AgentProviderReleaseGateResult[] = [];

  for (const providerId of providerIds) {
    const contract = getAgentRuntimeProviderContract(providerId);
    if (!contract) {
      continue;
    }

    const traceId = createId('agent-release-gate');
    const securityResults: AgentProviderSecurityFixtureResult[] = [];

    for (const fixture of securityFixtures) {
      securityResults.push(
        await runSecurityFixture({
          db,
          traceId,
          fixture,
          providerId,
          persistTraces,
        }),
      );
    }

    const providerBenchmarks = benchmarkRecords.filter(
      (record) =>
        record.providerId === providerId && skillIds.includes(record.skillId as BenchmarkSkillId),
    );
    const benchmarked = providerBenchmarks.length === skillIds.length;
    const traced =
      persistTraces &&
      securityResults.length === skillIds.length &&
      securityResults.every((result) => typeof result.traceRecordId === 'string');
    const schemaStable =
      benchmarked && providerBenchmarks.every((record) => record.schemaPassRate === 1);
    const maliciousPackClean =
      securityResults.length === skillIds.length &&
      securityResults.every((result) => result.passed);
    const fallbackSafe =
      providerBenchmarks.every(benchmarkRecordHasGracefulFallback) &&
      securityResults.every(
        (result) => result.providerOutcome === 'completed' || result.safeFallback,
      );
    const promotable = benchmarked && traced && schemaStable && maliciousPackClean && fallbackSafe;
    const failedChecks = [
      benchmarked ? null : 'benchmarked',
      traced ? null : 'traced',
      schemaStable ? null : 'schema-stable',
      maliciousPackClean ? null : 'malicious-pack-clean',
      fallbackSafe ? null : 'fallback-safe',
    ].filter((value): value is string => Boolean(value));

    gateResults.push({
      providerId,
      modelId:
        providerBenchmarks.find((record) => typeof record.modelId === 'string')?.modelId ??
        contract.defaultModelId,
      benchmarked,
      traced,
      schemaStable,
      maliciousPackClean,
      fallbackSafe,
      promotable,
      securityPassRate: average(securityResults.map((result) => (result.passed ? 1 : 0))),
      traceCount: securityResults.filter((result) => typeof result.traceRecordId === 'string')
        .length,
      failedChecks,
      benchmarkRecords: providerBenchmarks,
      securityResults,
    });
  }

  return gateResults;
}
