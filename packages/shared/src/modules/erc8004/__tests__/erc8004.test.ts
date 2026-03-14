import { describe, expect, it } from 'vitest';
import {
  erc8004AgentStateSchema,
  erc8004FeedbackOutputSchema,
  erc8004RegistrationOutputSchema,
} from '../../../contracts/schema';
import type { AgentLog, CoopSharedState } from '../../../contracts/schema';
import {
  buildAgentLogExport,
  buildAgentManifest,
  getErc8004Deployment,
  giveAgentFeedback,
  readAgentFeedbackHistory,
  readAgentReputation,
  registerAgentIdentity,
  updateAgentURI,
} from '../erc8004';

describe('ERC-8004 deployment addresses', () => {
  it('returns arbitrum deployment addresses', () => {
    const deployment = getErc8004Deployment('arbitrum');
    expect(deployment.identityRegistry).toBe('0x8004A169FB4a3325136EB29fA0ceB6D2e539a432');
    expect(deployment.reputationRegistry).toBe('0x8004BAa17C55a88189AE136b182e5fdA19dE9b63');
  });

  it('returns sepolia deployment addresses', () => {
    const deployment = getErc8004Deployment('sepolia');
    expect(deployment.identityRegistry).toBe('0x8004A818BFB912233c491871b3d84c89A494BD9e');
    expect(deployment.reputationRegistry).toBe('0x8004B663056A597Dffe9eCcC1965A193B7388713');
  });
});

describe('registerAgentIdentity', () => {
  it('returns a deterministic mock registration', async () => {
    const result = await registerAgentIdentity({
      mode: 'mock',
      onchainState: {
        chainId: 11155111,
        chainKey: 'sepolia',
        safeAddress: '0x1111111111111111111111111111111111111111',
        safeCapability: 'executed',
      },
      agentURI: 'data:application/json;base64,eyJ0ZXN0IjogdHJ1ZX0=',
      metadata: [{ key: 'name', value: 'Test Agent' }],
      coopId: 'coop-test-123',
    });

    expect(result.agentId).toBeGreaterThan(0);
    expect(result.txHash).toMatch(/^0x/);
    expect(result.detail).toContain('mock');
  });

  it('produces deterministic agentId for same inputs', async () => {
    const input = {
      mode: 'mock' as const,
      onchainState: {
        chainId: 11155111,
        chainKey: 'sepolia' as const,
        safeAddress: '0x1111111111111111111111111111111111111111',
        safeCapability: 'executed' as const,
      },
      agentURI: 'data:application/json;base64,eyJ0ZXN0IjogdHJ1ZX0=',
      metadata: [{ key: 'name', value: 'Test Agent' }],
      coopId: 'coop-test-123',
    };

    const result1 = await registerAgentIdentity(input);
    const result2 = await registerAgentIdentity(input);
    expect(result1.agentId).toBe(result2.agentId);
    expect(result1.txHash).toBe(result2.txHash);
  });
});

describe('updateAgentURI', () => {
  it('returns a mock update result', async () => {
    const result = await updateAgentURI({
      mode: 'mock',
      onchainState: {
        chainId: 11155111,
        chainKey: 'sepolia',
        safeAddress: '0x1111111111111111111111111111111111111111',
        safeCapability: 'executed',
      },
      agentId: 42,
      newURI: 'data:application/json;base64,eyJ1cGRhdGVkIjogdHJ1ZX0=',
    });

    expect(result.txHash).toMatch(/^0x/);
    expect(result.detail).toContain('mock');
  });
});

describe('readAgentReputation', () => {
  it('returns a mock reputation summary', async () => {
    const result = await readAgentReputation({
      mode: 'mock',
      chainKey: 'sepolia',
      agentId: 42,
    });

    expect(result.score).toBeDefined();
    expect(typeof result.score).toBe('number');
    expect(result.feedbackCount).toBeDefined();
    expect(typeof result.feedbackCount).toBe('number');
  });
});

describe('giveAgentFeedback', () => {
  it('returns a mock feedback result', async () => {
    const result = await giveAgentFeedback({
      mode: 'mock',
      onchainState: {
        chainId: 11155111,
        chainKey: 'sepolia',
        safeAddress: '0x1111111111111111111111111111111111111111',
        safeCapability: 'executed',
      },
      targetAgentId: 42,
      value: 1,
      tag1: 'archive-anchor',
      tag2: 'self-attestation',
      comment: 'Anchored coop snapshot',
    });

    expect(result.txHash).toMatch(/^0x/);
    expect(result.detail).toContain('mock');
  });
});

describe('readAgentFeedbackHistory', () => {
  it('returns a mock feedback list', async () => {
    const result = await readAgentFeedbackHistory({
      mode: 'mock',
      chainKey: 'sepolia',
      agentId: 42,
    });

    expect(Array.isArray(result.feedbacks)).toBe(true);
  });
});

describe('buildAgentManifest', () => {
  it('builds a valid agent manifest from coop state', () => {
    const coop = {
      profile: {
        id: 'coop-test-1',
        name: 'Watershed Coop',
        purpose: 'Coordinate watershed regeneration.',
        spaceType: 'community' as const,
        createdAt: '2026-03-13T00:00:00.000Z',
        safeAddress: '0x1111111111111111111111111111111111111111',
        active: true,
        createdBy: 'member-1',
        captureMode: 'manual' as const,
      },
      onchainState: {
        chainId: 42161,
        chainKey: 'arbitrum' as const,
        safeAddress: '0x1111111111111111111111111111111111111111',
        safeCapability: 'executed' as const,
        statusNote: 'Test Safe deployed.',
      },
    } satisfies Pick<CoopSharedState, 'profile' | 'onchainState'>;
    const manifest = buildAgentManifest({
      coop,
      skills: ['opportunity-extractor', 'grant-fit-scorer'],
      agentId: 123,
    });

    expect(manifest.type).toBe('https://eips.ethereum.org/EIPS/eip-8004#registration-v1');
    expect(manifest.name).toBe('Coop: Watershed Coop');
    expect(manifest.description).toBe('Coordinate watershed regeneration.');
    expect(manifest.active).toBe(true);
    expect(manifest.skills).toEqual(['opportunity-extractor', 'grant-fit-scorer']);
    expect(manifest.operator.safeAddress).toBe('0x1111111111111111111111111111111111111111');
    expect(manifest.operator.chainId).toBe(42161);
    expect(manifest.registrations).toEqual([
      {
        agentId: 123,
        agentRegistry: 'eip155:42161:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
      },
    ]);
    expect(manifest.capabilities).toContain('tab-capture');
    expect(manifest.guardrails.approvalRequired).toBe(true);
  });
});

describe('buildAgentLogExport', () => {
  it('transforms AgentLog[] into DevSpot agent_log.json format', () => {
    const logs: AgentLog[] = [
      {
        id: 'log-1',
        traceId: 'trace-abc',
        spanType: 'cycle',
        level: 'info',
        message: 'Agent cycle completed',
        data: { cycleId: 'c1' },
        timestamp: '2026-03-13T10:00:00.000Z',
      },
      {
        id: 'log-2',
        traceId: 'trace-abc',
        spanType: 'skill',
        skillId: 'opportunity-extractor',
        level: 'info',
        message: 'Skill run finished',
        timestamp: '2026-03-13T10:01:00.000Z',
      },
    ];

    const exported = buildAgentLogExport({
      logs,
      coopName: 'Watershed Coop',
      agentId: 123,
    });

    expect(exported.version).toBe('1.0');
    expect(exported.agentName).toBe('Coop: Watershed Coop');
    expect(exported.agentId).toBe(123);
    expect(exported.entries).toHaveLength(2);
    expect(exported.entries[0].traceId).toBe('trace-abc');
    expect(exported.entries[0].spanType).toBe('cycle');
    expect(exported.entries[1].data).toEqual({});
  });
});

describe('ERC-8004 schemas', () => {
  it('validates erc8004AgentStateSchema', () => {
    const state = erc8004AgentStateSchema.parse({
      enabled: true,
      status: 'registered',
      agentId: 42,
      agentURI: 'data:application/json;base64,test',
      feedbackCount: 3,
    });
    expect(state.enabled).toBe(true);
    expect(state.status).toBe('registered');
    expect(state.agentId).toBe(42);
  });

  it('applies defaults for disabled state', () => {
    const state = erc8004AgentStateSchema.parse({
      status: 'disabled',
    });
    expect(state.enabled).toBe(false);
    expect(state.feedbackCount).toBe(0);
  });

  it('validates erc8004RegistrationOutputSchema', () => {
    const output = erc8004RegistrationOutputSchema.parse({
      agentURI: 'data:application/json;base64,test',
      metadata: [{ key: 'name', value: 'Test Agent' }],
      rationale: 'Register agent for archive anchoring.',
    });
    expect(output.agentURI).toContain('data:');
    expect(output.metadata).toHaveLength(1);
  });

  it('validates erc8004FeedbackOutputSchema', () => {
    const output = erc8004FeedbackOutputSchema.parse({
      targetAgentId: 42,
      value: 1,
      tag1: 'archive-anchor',
      tag2: 'self-attestation',
      rationale: 'Anchored coop snapshot.',
    });
    expect(output.targetAgentId).toBe(42);
    expect(output.value).toBe(1);
  });
});
