import * as Y from 'yjs';
import type { AgentMemory, ReceiverCapture } from '../../contracts/schema';
import { normalizeLegacyOnchainState } from '../../contracts/schema';
import { nowIso } from '../../utils';
import { hydrateCoopDoc } from '../sync-core';
import { saveAgentMemory } from './db-crud-agent';
import { savePageExtract, saveReviewDraft, saveTabCandidate } from './db-crud-content';
import { savePrivacyIdentity, saveStealthKeyPair } from './db-crud-privacy';
import { persistReceiverCapture } from './db-crud-receiver';
import {
  LOCAL_DATA_RETENTION_MS,
  buildEncryptedLocalPayloadId,
  clearDerivedKeyCache,
  clearWrappingSecretCache,
  getEncryptedLocalPayloadRecord,
  hydrateReceiverCaptureRecord,
  looksRedactedAgentMemory,
  looksRedactedPageExtract,
  looksRedactedPrivacyIdentity,
  looksRedactedReceiverCapture,
  looksRedactedReviewDraft,
  looksRedactedStealthKeyPair,
  looksRedactedTabCandidate,
} from './db-encryption';
import type { CoopDexie } from './db-schema';

export async function clearSensitiveLocalData(db: CoopDexie) {
  clearWrappingSecretCache(db.name);
  clearDerivedKeyCache();
  await db.transaction(
    'rw',
    [
      db.tabCandidates,
      db.pageExtracts,
      db.reviewDrafts,
      db.receiverCaptures,
      db.receiverBlobs,
      db.tabRoutings,
      db.captureRuns,
      db.agentMemories,
      db.knowledgeSourceContents,
      db.privacyIdentities,
      db.stealthKeyPairs,
      db.encryptedLocalPayloads,
    ] as unknown as Parameters<CoopDexie['transaction']>[1],
    async () => {
      await Promise.all([
        db.tabCandidates.clear(),
        db.pageExtracts.clear(),
        db.reviewDrafts.clear(),
        db.receiverCaptures.clear(),
        db.receiverBlobs.clear(),
        db.tabRoutings.clear(),
        db.captureRuns.clear(),
        db.agentMemories.clear(),
        db.knowledgeSourceContents.clear(),
        db.privacyIdentities.clear(),
        db.stealthKeyPairs.clear(),
        db.encryptedLocalPayloads.clear(),
      ]);
    },
  );
}

export async function pruneSensitiveLocalData(db: CoopDexie) {
  const cutoff = new Date(Date.now() - LOCAL_DATA_RETENTION_MS).toISOString();

  const [candidateRows, extractRows, draftRows, captureRows, rawBlobs, payloads] =
    await Promise.all([
      db.tabCandidates.toArray(),
      db.pageExtracts.toArray(),
      db.reviewDrafts.toArray(),
      db.receiverCaptures.toArray(),
      db.receiverBlobs.toArray(),
      db.encryptedLocalPayloads.toArray(),
    ]);

  const extractIdsReferencedByDrafts = new Set(draftRows.map((draft) => draft.extractId));
  const candidateIdsReferencedByExtracts = new Set(
    extractRows.map((extract) => extract.sourceCandidateId),
  );
  const captureIds = new Set(captureRows.map((capture) => capture.id));

  const staleCandidateIds = candidateRows
    .filter(
      (candidate) =>
        candidate.capturedAt < cutoff && !candidateIdsReferencedByExtracts.has(candidate.id),
    )
    .map((candidate) => candidate.id);
  const staleExtractIds = extractRows
    .filter(
      (extract) => extract.createdAt < cutoff && !extractIdsReferencedByDrafts.has(extract.id),
    )
    .map((extract) => extract.id);
  const orphanedBlobIds = rawBlobs
    .filter((record) => !captureIds.has(record.captureId))
    .map((record) => record.captureId);
  const stalePayloadIds = payloads
    .filter((payload) => {
      if (payload.kind === 'receiver-blob') {
        return !captureIds.has(payload.entityId);
      }
      if (payload.kind === 'tab-candidate') {
        return staleCandidateIds.includes(payload.entityId);
      }
      if (payload.kind === 'page-extract') {
        return staleExtractIds.includes(payload.entityId);
      }
      if (payload.expiresAt) {
        return payload.expiresAt < cutoff;
      }
      return false;
    })
    .map((payload) => payload.id);

  await db.transaction(
    'rw',
    db.tabCandidates,
    db.pageExtracts,
    db.receiverBlobs,
    db.encryptedLocalPayloads,
    async () => {
      if (staleCandidateIds.length > 0) {
        await db.tabCandidates.bulkDelete(staleCandidateIds);
      }
      if (staleExtractIds.length > 0) {
        await db.pageExtracts.bulkDelete(staleExtractIds);
      }
      if (orphanedBlobIds.length > 0) {
        await db.receiverBlobs.bulkDelete(orphanedBlobIds);
      }
      if (stalePayloadIds.length > 0) {
        await db.encryptedLocalPayloads.bulkDelete(stalePayloadIds);
      }
    },
  );

  return {
    staleCandidateCount: staleCandidateIds.length,
    staleExtractCount: staleExtractIds.length,
    orphanedBlobCount: orphanedBlobIds.length,
    stalePayloadCount: stalePayloadIds.length,
  };
}

export async function migrateLegacySensitiveRecords(db: CoopDexie) {
  const [candidateRows, extractRows, draftRows, captureRows, memoryRows, privacyRows, stealthRows] =
    await Promise.all([
      db.tabCandidates.toArray(),
      db.pageExtracts.toArray(),
      db.reviewDrafts.toArray(),
      db.receiverCaptures.toArray(),
      db.agentMemories.toArray(),
      db.privacyIdentities.toArray(),
      db.stealthKeyPairs.toArray(),
    ]);

  let migrated = 0;

  for (const candidate of candidateRows) {
    const payload = await getEncryptedLocalPayloadRecord(db, 'tab-candidate', candidate.id);
    if (!payload && !looksRedactedTabCandidate(candidate)) {
      await saveTabCandidate(db, candidate);
      migrated += 1;
    }
  }

  for (const extract of extractRows) {
    const payload = await getEncryptedLocalPayloadRecord(db, 'page-extract', extract.id);
    if (!payload && !looksRedactedPageExtract(extract)) {
      await savePageExtract(db, extract);
      migrated += 1;
    }
  }

  for (const draft of draftRows) {
    const payload = await getEncryptedLocalPayloadRecord(db, 'review-draft', draft.id);
    if (!payload && !looksRedactedReviewDraft(draft)) {
      await saveReviewDraft(db, draft);
      migrated += 1;
    }
  }

  for (const capture of captureRows) {
    const capturePayload = await getEncryptedLocalPayloadRecord(db, 'receiver-capture', capture.id);
    const blobPayload = await getEncryptedLocalPayloadRecord(db, 'receiver-blob', capture.id);
    if (capturePayload && blobPayload) {
      continue;
    }

    if (!capturePayload && !looksRedactedReceiverCapture(capture)) {
      await persistReceiverCapture(
        db,
        capture,
        (await db.receiverBlobs.get(capture.id))?.blob ?? null,
      );
      migrated += 1;
      continue;
    }

    if (!blobPayload) {
      const blob = (await db.receiverBlobs.get(capture.id))?.blob;
      if (blob) {
        await persistReceiverCapture(
          db,
          (await hydrateReceiverCaptureRecord(db, capture)) ?? capture,
          blob,
        );
        migrated += 1;
      }
    }
  }

  for (const memory of memoryRows) {
    const payload = await getEncryptedLocalPayloadRecord(db, 'agent-memory', memory.id);
    if (!payload && !looksRedactedAgentMemory(memory)) {
      await saveAgentMemory(db, memory);
      migrated += 1;
    }
  }

  for (const record of privacyRows) {
    const payload = await getEncryptedLocalPayloadRecord(db, 'privacy-identity', record.id);
    if (!payload && !looksRedactedPrivacyIdentity(record)) {
      await savePrivacyIdentity(db, record);
      migrated += 1;
    }
  }

  for (const record of stealthRows) {
    const payload = await getEncryptedLocalPayloadRecord(db, 'stealth-key-pair', record.id);
    if (!payload && !looksRedactedStealthKeyPair(record)) {
      await saveStealthKeyPair(db, record);
      migrated += 1;
    }
  }

  return migrated;
}

// --- Legacy chain key migration ---

/**
 * One-time migration: normalizes legacy chain keys (celo → arbitrum,
 * celo-sepolia → sepolia) stored in coop docs. Idempotent — safe to
 * run multiple times; modern keys pass through unchanged.
 */
export async function migrateLegacyChainKeys(db: CoopDexie) {
  const records = await db.coopDocs.toArray();

  for (const record of records) {
    const doc = hydrateCoopDoc(record.encodedState);
    const root = doc.getMap<string>('coop');
    const rawOnchain = root.get('onchainState');
    if (!rawOnchain) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawOnchain);
    } catch {
      continue;
    }

    const normalized = normalizeLegacyOnchainState(parsed);
    if (normalized === parsed) continue;

    // Check if anything actually changed
    const normalizedJson = JSON.stringify(normalized);
    if (normalizedJson === rawOnchain) continue;

    doc.transact(() => {
      root.set('onchainState', normalizedJson);
    });

    await db.coopDocs.put({
      ...record,
      encodedState: Y.encodeStateAsUpdate(doc),
      updatedAt: nowIso(),
    });
  }
}
