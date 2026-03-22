import { describe, expect, it } from 'vitest';
import { archiveBundleSchema } from '../../../contracts/schema';
import { createCoop } from '../../coop/flows';
import { createArchiveBundle } from '../archive';

function buildSetupInsights() {
  return {
    summary: 'Schema versioning test coop.',
    crossCuttingPainPoints: ['Bundle format may change'],
    crossCuttingOpportunities: ['Self-describing bundles'],
    lenses: [
      {
        lens: 'capital-formation',
        currentState: 'Versioned.',
        painPoints: 'None.',
        improvements: 'Keep versioned.',
      },
      {
        lens: 'impact-reporting',
        currentState: 'Versioned.',
        painPoints: 'None.',
        improvements: 'Keep versioned.',
      },
      {
        lens: 'governance-coordination',
        currentState: 'Versioned.',
        painPoints: 'None.',
        improvements: 'Keep versioned.',
      },
      {
        lens: 'knowledge-garden-resources',
        currentState: 'Versioned.',
        painPoints: 'None.',
        improvements: 'Keep versioned.',
      },
    ],
  } as const;
}

describe('archive bundle schema versioning', () => {
  it('createArchiveBundle produces a bundle with schemaVersion 1', () => {
    const { state } = createCoop({
      coopName: 'Schema Version Coop',
      purpose: 'Test schema versioning.',
      creatorDisplayName: 'Kai',
      captureMode: 'manual',
      seedContribution: 'Version seed.',
      setupInsights: buildSetupInsights(),
    });

    const bundle = createArchiveBundle({
      scope: 'snapshot',
      state,
    });

    expect(bundle.schemaVersion).toBe(1);
  });

  it('createArchiveBundle produces a valid bundle for artifact scope', () => {
    const { state } = createCoop({
      coopName: 'Artifact Schema Version Coop',
      purpose: 'Test artifact bundle versioning.',
      creatorDisplayName: 'Ren',
      captureMode: 'manual',
      seedContribution: 'Artifact seed.',
      setupInsights: buildSetupInsights(),
    });

    const bundle = createArchiveBundle({
      scope: 'artifact',
      state,
      artifactIds: state.artifacts.slice(0, 1).map((a) => a.id),
    });

    expect(bundle.schemaVersion).toBe(1);
    expect(bundle.scope).toBe('artifact');
  });

  it('schema validates a bundle with explicit schemaVersion', () => {
    const result = archiveBundleSchema.safeParse({
      id: 'bundle-test-1',
      scope: 'snapshot',
      targetCoopId: 'coop-123',
      createdAt: '2026-03-14T12:00:00.000Z',
      payload: { coop: { id: 'coop-123', name: 'Test' } },
      schemaVersion: 1,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.schemaVersion).toBe(1);
    }
  });

  it('schema applies default schemaVersion when omitted', () => {
    const result = archiveBundleSchema.safeParse({
      id: 'bundle-test-2',
      scope: 'artifact',
      targetCoopId: 'coop-456',
      createdAt: '2026-03-14T12:00:00.000Z',
      payload: { artifacts: [] },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.schemaVersion).toBe(1);
    }
  });

  it('schema rejects non-positive schemaVersion', () => {
    const zeroResult = archiveBundleSchema.safeParse({
      id: 'bundle-bad-1',
      scope: 'snapshot',
      targetCoopId: 'coop-789',
      createdAt: '2026-03-14T12:00:00.000Z',
      payload: {},
      schemaVersion: 0,
    });
    expect(zeroResult.success).toBe(false);

    const negativeResult = archiveBundleSchema.safeParse({
      id: 'bundle-bad-2',
      scope: 'snapshot',
      targetCoopId: 'coop-789',
      createdAt: '2026-03-14T12:00:00.000Z',
      payload: {},
      schemaVersion: -1,
    });
    expect(negativeResult.success).toBe(false);
  });

  it('schema rejects non-integer schemaVersion', () => {
    const result = archiveBundleSchema.safeParse({
      id: 'bundle-bad-3',
      scope: 'snapshot',
      targetCoopId: 'coop-789',
      createdAt: '2026-03-14T12:00:00.000Z',
      payload: {},
      schemaVersion: 1.5,
    });
    expect(result.success).toBe(false);
  });
});

describe('archive bundle blob content', () => {
  it('includes blobManifest in payload when blobs are provided', () => {
    const { state } = createCoop({
      coopName: 'Blob Coop',
      purpose: 'Test blob bundling.',
      creatorDisplayName: 'Kai',
      captureMode: 'manual',
      seedContribution: 'Blob seed.',
      setupInsights: buildSetupInsights(),
    });

    const blobs = new Map<string, Uint8Array>([
      ['blob-photo-1', new Uint8Array([0xff, 0xd8, 0xff, 0xe0])],
      ['blob-audio-2', new Uint8Array([0x49, 0x44, 0x33])],
    ]);

    const result = createArchiveBundle({
      scope: 'snapshot',
      state,
      blobs,
    });

    const manifest = result.payload.blobManifest as Array<{
      blobId: string;
      byteSize: number;
    }>;
    expect(manifest).toBeDefined();
    expect(manifest).toHaveLength(2);
    expect(manifest).toContainEqual({ blobId: 'blob-photo-1', byteSize: 4 });
    expect(manifest).toContainEqual({ blobId: 'blob-audio-2', byteSize: 3 });
  });

  it('omits blobManifest when no blobs are provided', () => {
    const { state } = createCoop({
      coopName: 'No Blob Coop',
      purpose: 'Test without blobs.',
      creatorDisplayName: 'Ren',
      captureMode: 'manual',
      seedContribution: 'No blob seed.',
      setupInsights: buildSetupInsights(),
    });

    const result = createArchiveBundle({
      scope: 'snapshot',
      state,
    });

    expect(result.payload.blobManifest).toBeUndefined();
  });

  it('omits blobManifest when blobs map is empty', () => {
    const { state } = createCoop({
      coopName: 'Empty Blob Coop',
      purpose: 'Test empty blobs.',
      creatorDisplayName: 'Ren',
      captureMode: 'manual',
      seedContribution: 'Empty blob seed.',
      setupInsights: buildSetupInsights(),
    });

    const result = createArchiveBundle({
      scope: 'snapshot',
      state,
      blobs: new Map(),
    });

    expect(result.payload.blobManifest).toBeUndefined();
  });

  it('returns blobBytes when blobs are provided', () => {
    const { state } = createCoop({
      coopName: 'Blob Bytes Coop',
      purpose: 'Test blob bytes passthrough.',
      creatorDisplayName: 'Kai',
      captureMode: 'manual',
      seedContribution: 'Blob bytes seed.',
      setupInsights: buildSetupInsights(),
    });

    const blobs = new Map<string, Uint8Array>([['blob-1', new Uint8Array([1, 2, 3])]]);

    const result = createArchiveBundle({
      scope: 'artifact',
      state,
      artifactIds: state.artifacts.slice(0, 1).map((a) => a.id),
      blobs,
    });

    expect(result.blobBytes).toBe(blobs);
  });

  it('returns undefined blobBytes when no blobs are provided', () => {
    const { state } = createCoop({
      coopName: 'No Blob Bytes Coop',
      purpose: 'Test no blob bytes.',
      creatorDisplayName: 'Ren',
      captureMode: 'manual',
      seedContribution: 'No blob bytes seed.',
      setupInsights: buildSetupInsights(),
    });

    const result = createArchiveBundle({
      scope: 'snapshot',
      state,
    });

    expect(result.blobBytes).toBeUndefined();
  });
});
