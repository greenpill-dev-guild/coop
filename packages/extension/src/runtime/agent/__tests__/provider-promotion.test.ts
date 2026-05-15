import { afterEach, describe, expect, it, vi } from 'vitest';

const { runAgentProviderReleaseGate } = vi.hoisted(() => ({
  runAgentProviderReleaseGate: vi.fn(),
}));

vi.mock('../release-gates', () => ({
  runAgentProviderReleaseGate,
}));

import { createCoopDb } from '@coop/shared';
import {
  createAgentBenchmarkRecord,
  createAgentProviderPromotionState,
  createAgentTraceRecord,
  saveAgentBenchmarkRecord,
  saveAgentTraceRecord,
} from '@coop/shared';
import { AGENT_SETTING_KEYS } from '../config';
import {
  activateWebLlmProviderPromotion,
  getWebLlmProviderPromotionEvidence,
  getWebLlmProviderPromotionState,
  resolvePreferredProvider,
} from '../provider-promotion';
import { getRegisteredSkill } from '../registry';

describe('provider promotion', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('persists a promotable WebLLM activation after the release gate passes', async () => {
    const db = createCoopDb(`coop-provider-promotion-${crypto.randomUUID()}`);
    try {
      runAgentProviderReleaseGate.mockResolvedValue([
        {
          providerId: 'webllm',
          benchmarked: true,
          traced: true,
          schemaStable: true,
          maliciousPackClean: true,
          fallbackSafe: true,
          promotable: true,
          securityPassRate: 1,
          traceCount: 6,
          failedChecks: [],
          benchmarkRecords: [],
          securityResults: [],
        },
      ]);

      const state = await activateWebLlmProviderPromotion({
        db,
        persistBenchmarks: false,
        persistTraces: false,
      });

      expect(state.providerId).toBe('webllm');
      // opportunity-extractor opted into the gemma4 provider for the
      // hackathon function-calling demo, so the WebLLM promotion sweep no
      // longer claims it as a transformers→webllm upgrade candidate.
      expect(state.evaluatedSkillIds).toEqual(['tab-router']);
      expect(state.promotedSkillIds).toEqual(['tab-router']);
      expect(state.promotable).toBe(true);
      expect(state.benchmarkRecordIds).toEqual([]);
      expect(state.traceRecordIds).toEqual([]);

      const persisted = await getWebLlmProviderPromotionState(db);

      expect(persisted?.providerId).toBe('webllm');
      expect(persisted?.evaluatedSkillIds).toEqual(['tab-router']);
      expect(persisted?.promotedSkillIds).toEqual(['tab-router']);
      expect(persisted?.activatedAt).toBeDefined();
    } finally {
      db.close();
      await db.delete();
    }
  });

  it('only resolves to WebLLM when the feature flag and stored promotion state both allow it', async () => {
    const db = createCoopDb(`coop-provider-promotion-${crypto.randomUUID()}`);
    try {
      runAgentProviderReleaseGate.mockResolvedValue([
        {
          providerId: 'webllm',
          benchmarked: true,
          traced: true,
          schemaStable: true,
          maliciousPackClean: true,
          fallbackSafe: true,
          promotable: true,
          securityPassRate: 1,
          traceCount: 6,
          failedChecks: [],
          benchmarkRecords: [],
          securityResults: [],
        },
      ]);

      const tabRouterManifest = getRegisteredSkill('tab-router')?.manifest;
      const capitalBriefManifest = getRegisteredSkill('capital-formation-brief')?.manifest;

      if (!tabRouterManifest || !capitalBriefManifest) {
        throw new Error('Expected benchmark skill manifests to be registered.');
      }

      expect(
        await resolvePreferredProvider(tabRouterManifest, { db, webLlmPromotionEnabled: true }),
      ).toBe('transformers');

      await activateWebLlmProviderPromotion({
        db,
        persistBenchmarks: false,
        persistTraces: false,
      });

      expect(
        await resolvePreferredProvider(tabRouterManifest, { db, webLlmPromotionEnabled: false }),
      ).toBe('transformers');
      expect(
        await resolvePreferredProvider(tabRouterManifest, { db, webLlmPromotionEnabled: true }),
      ).toBe('webllm');
      expect(
        await resolvePreferredProvider(capitalBriefManifest, { db, webLlmPromotionEnabled: true }),
      ).toBe('webllm');
    } finally {
      db.close();
      await db.delete();
    }
  });

  it('keeps the legacy provider when the gate result is not promotable', async () => {
    const db = createCoopDb(`coop-provider-promotion-${crypto.randomUUID()}`);
    try {
      runAgentProviderReleaseGate.mockResolvedValue([
        {
          providerId: 'webllm',
          benchmarked: true,
          traced: true,
          schemaStable: false,
          maliciousPackClean: false,
          fallbackSafe: true,
          promotable: false,
          securityPassRate: 0.33,
          traceCount: 3,
          failedChecks: ['schema-stable', 'malicious-pack-clean'],
          benchmarkRecords: [],
          securityResults: [],
        },
      ]);

      const manifest = getRegisteredSkill('opportunity-extractor')?.manifest;
      if (!manifest) {
        throw new Error('Expected opportunity-extractor manifest to be registered.');
      }

      const state = await activateWebLlmProviderPromotion({
        db,
        persistBenchmarks: false,
        persistTraces: false,
      });

      expect(state.promotable).toBe(false);
      expect(state.promotedSkillIds).toEqual([]);
      expect(state.activatedAt).toBeUndefined();
      expect(state.failedChecks).toEqual(['schema-stable', 'malicious-pack-clean']);
      // opportunity-extractor's manifest now declares model: 'gemma4', so
      // the legacy fallback for non-promotable WebLLM gates resolves to the
      // newly-declared gemma4 provider rather than dropping back to
      // transformers.
      expect(await resolvePreferredProvider(manifest, { db, webLlmPromotionEnabled: true })).toBe(
        'gemma4',
      );
    } finally {
      db.close();
      await db.delete();
    }
  });

  it('loads stored benchmark and trace evidence for the promoted provider decision', async () => {
    const db = createCoopDb(`coop-provider-promotion-${crypto.randomUUID()}`);
    try {
      const benchmarkRecord = createAgentBenchmarkRecord({
        id: 'agent-benchmark-webllm-tab-router',
        skillId: 'tab-router',
        providerId: 'webllm',
        providerTier: 'p2',
        modelId: 'Qwen2-0.5B-Instruct-q4f16_1-MLC',
        capabilities: {
          structuredJson: 'grammar-constrained',
          workerSafe: true,
          offscreenSafe: true,
          requiresWebGpu: true,
          supportsStreaming: false,
          supportsMultimodal: false,
        },
        fallbackOrder: ['transformers', 'heuristic'],
        outcome: 'completed',
        fixtureResults: [],
        schemaPassRate: 1,
        jsonRepairRate: 0,
        medianLatencyMs: 420,
        coldStartTimeMs: 900,
        confidenceScore: 0.88,
      });
      const traceRecord = createAgentTraceRecord({
        id: 'agent-trace-record-webllm-tab-router',
        traceId: 'agent-release-gate-webllm',
        observationId: 'agent-observation-1',
        skillId: 'tab-router',
        providerId: 'webllm',
        modelId: 'Qwen2-0.5B-Instruct-q4f16_1-MLC',
        promptHash: 'prompt-hash-1',
        contextInventory: ['observation'],
        sourceRisk: 'trusted',
        startedAt: Date.now(),
        durationMs: 420,
        repairSteps: [],
        validationErrors: [],
        outcome: 'completed',
        confidenceScore: 0.88,
        evalScore: 1,
      });

      await saveAgentBenchmarkRecord(db, benchmarkRecord);
      await saveAgentTraceRecord(db, traceRecord);

      runAgentProviderReleaseGate.mockResolvedValue([
        {
          providerId: 'webllm',
          benchmarked: true,
          traced: true,
          schemaStable: true,
          maliciousPackClean: true,
          fallbackSafe: true,
          promotable: true,
          securityPassRate: 1,
          traceCount: 1,
          failedChecks: [],
          benchmarkRecords: [benchmarkRecord],
          securityResults: [
            {
              fixtureId: 'fixture-1',
              skillId: 'tab-router',
              providerId: 'webllm',
              providerOutcome: 'completed',
              passed: true,
              safeFallback: true,
              schemaPassed: true,
              evalScore: 1,
              confidenceScore: 0.88,
              traceRecordId: traceRecord.id,
            },
          ],
        },
      ]);

      await activateWebLlmProviderPromotion({
        db,
      });

      const evidence = await getWebLlmProviderPromotionEvidence(db);
      expect(evidence.benchmarkRecords.map((record) => record.id)).toEqual([benchmarkRecord.id]);
      expect(evidence.traceRecords.map((record) => record.id)).toEqual([traceRecord.id]);
    } finally {
      db.close();
      await db.delete();
    }
  });

  it('ignores stored promotion state when the baseline provider or promoted skills do not match', async () => {
    const db = createCoopDb(`coop-provider-promotion-${crypto.randomUUID()}`);
    try {
      const manifest = getRegisteredSkill('tab-router')?.manifest;
      if (!manifest) {
        throw new Error('Expected tab-router manifest to be registered.');
      }

      await db.settings.put({
        key: AGENT_SETTING_KEYS.webLlmPromotionState,
        value: createAgentProviderPromotionState({
          providerId: 'webllm',
          baselineProviderId: 'heuristic',
          evaluatedSkillIds: ['tab-router'],
          promotedSkillIds: ['capital-formation-brief'],
          benchmarkRecordIds: [],
          traceRecordIds: [],
          benchmarked: true,
          traced: true,
          schemaStable: true,
          maliciousPackClean: true,
          fallbackSafe: true,
          promotable: true,
          securityPassRate: 1,
          failedChecks: [],
          activatedAt: '2026-04-18T22:00:00.000Z',
        }),
      });

      expect(await resolvePreferredProvider(manifest, { db, webLlmPromotionEnabled: true })).toBe(
        'transformers',
      );
    } finally {
      db.close();
      await db.delete();
    }
  });

  it('filters missing benchmark and trace ids out of promotion evidence', async () => {
    const db = createCoopDb(`coop-provider-promotion-${crypto.randomUUID()}`);
    try {
      await db.settings.put({
        key: AGENT_SETTING_KEYS.webLlmPromotionState,
        value: createAgentProviderPromotionState({
          providerId: 'webllm',
          baselineProviderId: 'transformers',
          evaluatedSkillIds: ['tab-router'],
          promotedSkillIds: ['tab-router'],
          benchmarkRecordIds: ['missing-benchmark'],
          traceRecordIds: ['missing-trace'],
          benchmarked: true,
          traced: true,
          schemaStable: true,
          maliciousPackClean: true,
          fallbackSafe: true,
          promotable: true,
          securityPassRate: 1,
          failedChecks: [],
          activatedAt: '2026-04-18T22:00:00.000Z',
        }),
      });

      const evidence = await getWebLlmProviderPromotionEvidence(db);

      expect(evidence).toEqual({
        benchmarkRecords: [],
        traceRecords: [],
      });
    } finally {
      db.close();
      await db.delete();
    }
  });
});
