import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { makeReviewDraft, makeTabCandidate } from '../../../__tests__/fixtures';
import { buildReadablePageExtract } from '../../coop/pipeline';
import { createReceiverCapture } from '../../receiver/capture';
import {
  type CoopDexie,
  buildEncryptedLocalPayloadId,
  buildEncryptedLocalPayloadRecord,
  clearSensitiveLocalData,
  createCoopDb,
  getEncryptedLocalPayloadRecord,
  migrateLegacySensitiveRecords,
  pruneSensitiveLocalData,
} from '../db';

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

const databases: CoopDexie[] = [];
const NOW = '2026-03-28T00:00:00.000Z';
const STALE = '2025-01-01T00:00:00.000Z';
const FUTURE = '2027-01-01T00:00:00.000Z';

function freshDb(): CoopDexie {
  const db = createCoopDb(`coop-maintenance-${crypto.randomUUID()}`);
  databases.push(db);
  return db;
}

function makeExtract(overrides: Record<string, unknown> = {}) {
  return buildReadablePageExtract({
    candidate: makeTabCandidate({
      id: 'candidate-1',
      capturedAt: STALE,
      title: 'Watershed planning update',
      url: 'https://example.com/watershed',
    }),
    headings: ['Watershed planning'],
    paragraphs: [
      'This is a sufficiently long paragraph about watershed restoration work that passes the readability threshold for extracts.',
    ],
    metaDescription: 'Watershed planning summary',
    previewImageUrl: 'https://example.com/watershed.png',
    ...overrides,
  });
}

function makeAgentMemory(overrides: Record<string, unknown> = {}) {
  return {
    id: `memory-${crypto.randomUUID()}`,
    scope: 'coop',
    coopId: 'coop-1',
    type: 'coop-context',
    domain: 'general',
    content: 'Keep the review grounded in member needs.',
    contentHash: 'hash-memory',
    confidence: 0.8,
    createdAt: NOW,
    ...overrides,
  };
}

afterEach(async () => {
  for (const db of databases) {
    db.close();
    await db.delete();
  }
  databases.length = 0;
});

describe('db-maintenance', () => {
  it('clears sensitive local tables in one pass', async () => {
    const db = freshDb();
    const candidate = makeTabCandidate({ id: 'candidate-clear', capturedAt: NOW });
    const extract = {
      ...makeExtract(),
      id: 'extract-clear',
      sourceCandidateId: candidate.id,
      createdAt: NOW,
    };
    const draft = makeReviewDraft({ id: 'draft-clear', extractId: extract.id, createdAt: NOW });
    const capture = createReceiverCapture({
      deviceId: 'device-clear',
      kind: 'file',
      blob: new Blob(['hello'], { type: 'text/plain' }),
      title: 'Local file',
    });
    const memory = makeAgentMemory({ id: 'memory-clear' });

    await db.tabCandidates.add(candidate);
    await db.pageExtracts.add(extract);
    await db.reviewDrafts.add(draft);
    await db.receiverCaptures.add(capture);
    await db.receiverBlobs.add({ captureId: capture.id, blob: new Blob(['hello']) });
    await db.tabRoutings.add({
      id: 'routing-clear',
      coopId: 'coop-1',
      extractId: extract.id,
      status: 'routed',
      reason: 'test',
      confidence: 0.9,
      createdAt: NOW,
      updatedAt: NOW,
    } as never);
    await db.captureRuns.add({
      id: 'run-clear',
      status: 'complete',
      startedAt: NOW,
      completedAt: NOW,
      candidateIds: [candidate.id],
    } as never);
    await db.agentMemories.add(memory as never);
    await db.encryptedLocalPayloads.put(
      await buildEncryptedLocalPayloadRecord({
        db,
        kind: 'tab-candidate',
        entityId: candidate.id,
        bytes: new TextEncoder().encode(JSON.stringify(candidate)),
      }),
    );

    await clearSensitiveLocalData(db);

    await expect(db.tabCandidates.count()).resolves.toBe(0);
    await expect(db.pageExtracts.count()).resolves.toBe(0);
    await expect(db.reviewDrafts.count()).resolves.toBe(0);
    await expect(db.receiverCaptures.count()).resolves.toBe(0);
    await expect(db.receiverBlobs.count()).resolves.toBe(0);
    await expect(db.tabRoutings.count()).resolves.toBe(0);
    await expect(db.captureRuns.count()).resolves.toBe(0);
    await expect(db.agentMemories.count()).resolves.toBe(0);
    await expect(db.encryptedLocalPayloads.count()).resolves.toBe(0);
  });

  it('prunes stale content, orphaned blobs, and expired payloads while preserving referenced rows', async () => {
    const db = freshDb();
    const staleCandidate = makeTabCandidate({ id: 'candidate-stale', capturedAt: STALE });
    const referencedCandidate = makeTabCandidate({ id: 'candidate-live', capturedAt: STALE });
    const staleExtract = {
      ...makeExtract(),
      id: 'extract-stale',
      sourceCandidateId: staleCandidate.id,
      createdAt: STALE,
    };
    const referencedExtract = {
      ...makeExtract(),
      id: 'extract-live',
      sourceCandidateId: referencedCandidate.id,
      createdAt: STALE,
    };
    const draft = makeReviewDraft({
      id: 'draft-live',
      extractId: referencedExtract.id,
      createdAt: NOW,
    });
    const activeCapture = createReceiverCapture({
      deviceId: 'device-active',
      kind: 'file',
      blob: new Blob(['active'], { type: 'text/plain' }),
      title: 'Active capture',
    });

    await db.tabCandidates.bulkAdd([staleCandidate, referencedCandidate]);
    await db.pageExtracts.bulkAdd([staleExtract as never, referencedExtract as never]);
    await db.reviewDrafts.add(draft);
    await db.receiverCaptures.add(activeCapture);
    await db.receiverBlobs.bulkAdd([
      { captureId: activeCapture.id, blob: new Blob(['active']) },
      { captureId: 'orphaned-capture', blob: new Blob(['orphan']) },
    ]);
    await db.encryptedLocalPayloads.bulkAdd([
      await buildEncryptedLocalPayloadRecord({
        db,
        kind: 'tab-candidate',
        entityId: staleCandidate.id,
        bytes: new TextEncoder().encode(JSON.stringify(staleCandidate)),
      }),
      await buildEncryptedLocalPayloadRecord({
        db,
        kind: 'page-extract',
        entityId: staleExtract.id,
        bytes: new TextEncoder().encode(JSON.stringify(staleExtract)),
      }),
      await buildEncryptedLocalPayloadRecord({
        db,
        kind: 'receiver-blob',
        entityId: 'orphaned-capture',
        bytes: new Uint8Array([1, 2, 3]),
      }),
      await buildEncryptedLocalPayloadRecord({
        db,
        kind: 'review-draft',
        entityId: 'draft-expired',
        bytes: new TextEncoder().encode(JSON.stringify(draft)),
        expiresAt: STALE,
      }),
      await buildEncryptedLocalPayloadRecord({
        db,
        kind: 'tab-candidate',
        entityId: referencedCandidate.id,
        bytes: new TextEncoder().encode(JSON.stringify(referencedCandidate)),
        expiresAt: FUTURE,
      }),
    ]);

    const result = await pruneSensitiveLocalData(db);

    expect(result).toEqual({
      staleCandidateCount: 0,
      staleExtractCount: 1,
      orphanedBlobCount: 1,
      stalePayloadCount: 3,
    });
    await expect(db.tabCandidates.get(staleCandidate.id)).resolves.toBeDefined();
    await expect(db.tabCandidates.get(referencedCandidate.id)).resolves.toBeDefined();
    await expect(db.pageExtracts.get(staleExtract.id)).resolves.toBeUndefined();
    await expect(db.pageExtracts.get(referencedExtract.id)).resolves.toBeDefined();
    await expect(db.receiverBlobs.get('orphaned-capture')).resolves.toBeUndefined();
    await expect(
      db.encryptedLocalPayloads.get(
        buildEncryptedLocalPayloadId('tab-candidate', referencedCandidate.id),
      ),
    ).resolves.toBeDefined();
  });

  it('migrates legacy plaintext records and missing capture blob payloads into encrypted storage', async () => {
    const db = freshDb();
    const candidate = makeTabCandidate({ id: 'candidate-migrate', capturedAt: NOW });
    const extract = {
      ...makeExtract(),
      id: 'extract-migrate',
      sourceCandidateId: candidate.id,
      createdAt: NOW,
    };
    const draft = makeReviewDraft({ id: 'draft-migrate', extractId: extract.id, createdAt: NOW });
    const legacyCapture = createReceiverCapture({
      deviceId: 'device-legacy',
      kind: 'file',
      blob: new Blob(['legacy-capture'], { type: 'text/plain' }),
      title: 'Legacy capture',
    });
    const blobOnlyCapture = createReceiverCapture({
      deviceId: 'device-blob-only',
      kind: 'audio',
      blob: new Blob(['blob-only'], { type: 'audio/webm' }),
      title: 'Blob only',
    });
    const memory = makeAgentMemory({ id: 'memory-migrate' });

    await db.tabCandidates.add(candidate);
    await db.pageExtracts.add(extract as never);
    await db.reviewDrafts.add(draft);
    await db.receiverCaptures.bulkAdd([legacyCapture, blobOnlyCapture]);
    await db.receiverBlobs.bulkAdd([
      { captureId: legacyCapture.id, blob: new Blob(['legacy-capture'], { type: 'text/plain' }) },
      { captureId: blobOnlyCapture.id, blob: new Blob(['blob-only'], { type: 'audio/webm' }) },
    ]);
    await db.agentMemories.add(memory as never);
    await db.encryptedLocalPayloads.put(
      await buildEncryptedLocalPayloadRecord({
        db,
        kind: 'receiver-capture',
        entityId: blobOnlyCapture.id,
        bytes: new TextEncoder().encode(JSON.stringify(blobOnlyCapture)),
      }),
    );

    const migrated = await migrateLegacySensitiveRecords(db);

    expect(migrated).toBe(6);
    await expect(
      getEncryptedLocalPayloadRecord(db, 'tab-candidate', candidate.id),
    ).resolves.toBeDefined();
    await expect(
      getEncryptedLocalPayloadRecord(db, 'page-extract', extract.id),
    ).resolves.toBeDefined();
    await expect(
      getEncryptedLocalPayloadRecord(db, 'review-draft', draft.id),
    ).resolves.toBeDefined();
    await expect(
      getEncryptedLocalPayloadRecord(db, 'receiver-capture', legacyCapture.id),
    ).resolves.toBeDefined();
    await expect(
      getEncryptedLocalPayloadRecord(db, 'receiver-capture', blobOnlyCapture.id),
    ).resolves.toBeDefined();
    await expect(
      getEncryptedLocalPayloadRecord(db, 'agent-memory', memory.id),
    ).resolves.toBeDefined();

    const blobPayload = await getEncryptedLocalPayloadRecord(
      db,
      'receiver-blob',
      blobOnlyCapture.id,
    );
    const rawBlobRow = await db.receiverBlobs.get(blobOnlyCapture.id);
    expect(blobPayload ?? rawBlobRow).toBeDefined();
  });
});
