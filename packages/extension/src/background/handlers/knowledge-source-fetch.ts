import {
  appendLogEntry,
  encodeCoopDoc,
  hydrateCoopDoc,
  listKnowledgeSources,
  nowIso,
  saveKnowledgeSourceContent,
  updateKnowledgeSourceMeta,
  writeSourceToYDoc,
} from '@coop/shared';
import { fetchStructuredContentForSource } from '../../runtime/agent/adapters';
import type { RuntimeActionResponse, RuntimeRequest } from '../../runtime/messages';
import { db } from '../context';
import { emitSourceContentObservation } from './agent-observation-emitters';

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

type RefreshRequest = Extract<RuntimeRequest, { type: 'refresh-knowledge-source' }>;

async function updateSharedSourceRegistryDoc(
  coopId: string,
  mutate: (doc: ReturnType<typeof hydrateCoopDoc>) => void,
) {
  const coopDocs = db.coopDocs;
  if (!coopDocs?.get || !coopDocs?.put) {
    return;
  }
  const record = await coopDocs.get(coopId);
  if (!record) {
    return;
  }

  const doc = hydrateCoopDoc(record.encodedState);
  try {
    mutate(doc);
    await coopDocs.put({
      id: coopId,
      encodedState: encodeCoopDoc(doc),
      updatedAt: nowIso(),
    });
  } finally {
    doc.destroy();
  }
}

export async function handleRefreshKnowledgeSource(
  message: RefreshRequest,
): Promise<RuntimeActionResponse> {
  try {
    const sources = await listKnowledgeSources(db, {
      coopId: message.payload.coopId,
      active: true,
    });

    let refreshedCount = 0;

    for (const source of sources) {
      try {
        const contents = await fetchStructuredContentForSource({ db, source });
        const fetchedAt = nowIso();
        const entityCount = Math.max(source.entityCount, contents.length);
        const persistedContents = [];

        for (const content of contents) {
          const persisted = await saveKnowledgeSourceContent(db, {
            sourceId: source.id,
            coopId: source.coopId,
            sourceRef: content.sourceRef,
            title: content.title,
            body: content.body,
            metadata: content.metadata,
            fetchedAt: content.fetchedAt,
          });
          persistedContents.push({ content, persisted });
        }

        await updateKnowledgeSourceMeta(db, source.id, {
          lastFetchedAt: fetchedAt,
          entityCount,
        });
        const nextSource = { ...source, lastFetchedAt: fetchedAt, entityCount };
        await updateSharedSourceRegistryDoc(source.coopId, (doc) => {
          writeSourceToYDoc(doc, nextSource);
          appendLogEntry(doc, {
            type: 'ingest',
            timestamp: fetchedAt,
            summary: `Knowledge source refreshed: ${source.label}`,
            sourceId: source.id,
            entityCount: contents.length,
          });
        });

        for (const { content, persisted } of persistedContents) {
          await emitSourceContentObservation({
            sourceId: source.id,
            sourceLabel: source.label,
            contentId: persisted.id,
            contentTitle: content.title,
            sourceRef: content.sourceRef,
            coopId: source.coopId,
          });
        }

        refreshedCount++;
      } catch (err) {
        console.warn(`[knowledge-source-fetch] Failed to refresh ${source.id}:`, err);
      }
    }

    return { ok: true, data: { refreshedCount } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to refresh sources',
    };
  }
}
