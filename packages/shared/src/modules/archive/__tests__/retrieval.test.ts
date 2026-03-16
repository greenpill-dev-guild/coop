import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCoop } from '../../coop/flows';
import {
  createArchiveBundle,
  createArchiveReceiptFromUpload,
  retrieveArchiveBundle,
} from '../archive';

function buildSetupInsights() {
  return {
    summary: 'A compact setup payload for retrieval coverage.',
    crossCuttingPainPoints: ['Archived content is hard to verify'],
    crossCuttingOpportunities: ['Gateway retrieval with CID check'],
    lenses: [
      {
        lens: 'capital-formation',
        currentState: 'Funding evidence archived.',
        painPoints: 'No retrieval pathway.',
        improvements: 'Retrieve and verify.',
      },
      {
        lens: 'impact-reporting',
        currentState: 'Evidence is durable.',
        painPoints: 'Retrieval is manual.',
        improvements: 'Automate it.',
      },
      {
        lens: 'governance-coordination',
        currentState: 'Governance artifacts on Filecoin.',
        painPoints: 'No programmatic access.',
        improvements: 'Add gateway retrieval.',
      },
      {
        lens: 'knowledge-garden-resources',
        currentState: 'Resources archived.',
        painPoints: 'No verification.',
        improvements: 'CID verification on retrieval.',
      },
    ],
  } as const;
}

function buildReceipt(gatewayUrl?: string) {
  const created = createCoop({
    coopName: 'Retrieval Test Coop',
    purpose: 'Test gateway retrieval of archived bundles.',
    creatorDisplayName: 'Tester',
    captureMode: 'manual',
    seedContribution: 'I bring retrieval test coverage.',
    setupInsights: buildSetupInsights(),
  });
  const artifact = created.state.artifacts[0];
  if (!artifact) {
    throw new Error('Expected an initial artifact.');
  }

  return createArchiveReceiptFromUpload({
    bundle: createArchiveBundle({
      scope: 'artifact',
      state: created.state,
      artifactIds: [artifact.id],
    }),
    delegationIssuer: 'did:key:issuer',
    delegationMode: 'live',
    allowsFilecoinInfo: true,
    rootCid: 'bafyroot123',
    shardCids: ['bafyshard1'],
    pieceCids: ['bafkpiece1'],
    gatewayUrl: gatewayUrl ?? 'https://storacha.link/ipfs/bafyroot123',
    artifactIds: [artifact.id],
  });
}

describe('retrieveArchiveBundle', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetches and parses valid JSON from gateway', async () => {
    const receipt = buildReceipt();
    const payload = { schemaVersion: 1, coop: { id: 'coop-1', name: 'Test' } };
    const mockResponse = {
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(payload)),
    };
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as Response);

    const result = await retrieveArchiveBundle(receipt);

    expect(result.payload).toEqual(payload);
    expect(result.schemaVersion).toBe(1);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      receipt.gatewayUrl,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('throws when receipt has no gateway URL', async () => {
    const receipt = buildReceipt();
    const noGateway = { ...receipt, gatewayUrl: '' };

    await expect(retrieveArchiveBundle(noGateway)).rejects.toThrow(
      'Archive receipt has no gateway URL.',
    );
  });

  it('throws on non-200 response', async () => {
    const receipt = buildReceipt();
    const mockResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: () => Promise.resolve(''),
    };
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as Response);

    await expect(retrieveArchiveBundle(receipt)).rejects.toThrow(
      'Gateway fetch failed: 404 Not Found',
    );
  });

  it('returns verified: false when CID does not match', async () => {
    const receipt = buildReceipt();
    // The payload will hash to a different CID than bafyroot123
    const payload = { data: 'some content that will not match the rootCid' };
    const mockResponse = {
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(payload)),
    };
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as Response);

    const result = await retrieveArchiveBundle(receipt);

    // CID won't match because bafyroot123 is a fake CID
    expect(result.verified).toBe(false);
    expect(result.payload).toEqual(payload);
  });

  it('extracts schemaVersion from payload', async () => {
    const receipt = buildReceipt();
    const payload = { schemaVersion: 2, artifacts: [] };
    const mockResponse = {
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(payload)),
    };
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as Response);

    const result = await retrieveArchiveBundle(receipt);

    expect(result.schemaVersion).toBe(2);
  });

  it('returns undefined schemaVersion when payload lacks it', async () => {
    const receipt = buildReceipt();
    const payload = { data: 'no schema version here' };
    const mockResponse = {
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(payload)),
    };
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as Response);

    const result = await retrieveArchiveBundle(receipt);

    expect(result.schemaVersion).toBeUndefined();
  });

  it('still returns payload even when verification fails', async () => {
    const receipt = buildReceipt();
    const payload = { important: 'data' };
    const mockResponse = {
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(payload)),
    };
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as Response);

    const result = await retrieveArchiveBundle(receipt);

    // Verification will fail (fake CID) but payload should still be returned
    expect(result.payload).toEqual(payload);
    expect(typeof result.verified).toBe('boolean');
  });
});
