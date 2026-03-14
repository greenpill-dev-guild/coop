import { describe, expect, it } from 'vitest';
import { coopSharedStateSchema } from '../../../contracts/schema';
import { createCoop } from '../flows';
import { createCoopDoc, readCoopState } from '../sync';

function buildSetupInsights() {
  return {
    summary: 'A compact setup payload for archive config sync tests.',
    crossCuttingPainPoints: ['No per-coop config'],
    crossCuttingOpportunities: ['Per-coop archive ownership'],
    lenses: [
      {
        lens: 'capital-formation' as const,
        currentState: 'Funding is scattered.',
        painPoints: 'No per-coop archive.',
        improvements: 'Split config.',
      },
      {
        lens: 'impact-reporting' as const,
        currentState: 'Evidence is durable.',
        painPoints: 'Single global config.',
        improvements: 'Per-coop secrets.',
      },
      {
        lens: 'governance-coordination' as const,
        currentState: 'Manual follow-up.',
        painPoints: 'Operators lack config.',
        improvements: 'Sync public config.',
      },
      {
        lens: 'knowledge-garden-resources' as const,
        currentState: 'Resources archived.',
        painPoints: 'No separation.',
        improvements: 'Public/secret split.',
      },
    ],
  } as const;
}

function buildState() {
  return createCoop({
    coopName: 'Archive Config Test',
    purpose: 'testing archive config sync',
    creatorDisplayName: 'Tester',
    captureMode: 'manual' as const,
    seedContribution: 'Test seed',
    setupInsights: buildSetupInsights(),
  }).state;
}

describe('archiveConfig in shared keys', () => {
  it('round-trips archiveConfig through Yjs doc when present', () => {
    const state = buildState();

    const stateWithArchive = {
      ...state,
      archiveConfig: {
        spaceDid: 'did:key:z1234',
        delegationIssuer: 'did:key:zIssuer',
        gatewayBaseUrl: 'https://storacha.link',
        allowsFilecoinInfo: false,
        expirationSeconds: 600,
      },
    };

    const doc = createCoopDoc(stateWithArchive);
    const loaded = readCoopState(doc);

    expect(loaded.archiveConfig).toBeDefined();
    expect(loaded.archiveConfig?.spaceDid).toBe('did:key:z1234');
    expect(loaded.archiveConfig?.delegationIssuer).toBe('did:key:zIssuer');
  });

  it('round-trips without archiveConfig (undefined)', () => {
    const state = buildState();

    const doc = createCoopDoc(state);
    const loaded = readCoopState(doc);

    expect(loaded.archiveConfig).toBeUndefined();
  });

  it('validates archiveConfig through coopSharedStateSchema', () => {
    const state = buildState();

    const withConfig = {
      ...state,
      archiveConfig: {
        spaceDid: 'did:key:z1234',
        delegationIssuer: 'did:key:zIssuer',
      },
    };

    const result = coopSharedStateSchema.safeParse(withConfig);
    expect(result.success).toBe(true);
    expect(result.data?.archiveConfig?.gatewayBaseUrl).toBe('https://storacha.link');
  });
});
