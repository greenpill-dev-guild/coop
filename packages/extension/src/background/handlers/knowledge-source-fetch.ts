import { listKnowledgeSources, nowIso, updateKnowledgeSourceMeta } from '@coop/shared';
import { fetchStructuredContentForSource } from '../../runtime/agent/adapters';
import type { RuntimeActionResponse, RuntimeRequest } from '../../runtime/messages';
import { db } from '../context';
import { emitSourceContentObservation } from './agent-observation-emitters';

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

type RefreshRequest = Extract<RuntimeRequest, { type: 'refresh-knowledge-source' }>;

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
        await updateKnowledgeSourceMeta(db, source.id, {
          lastFetchedAt: nowIso(),
          entityCount: Math.max(source.entityCount, contents.length),
        });

        for (const content of contents) {
          await emitSourceContentObservation({
            sourceId: source.id,
            sourceLabel: source.label,
            contentTitle: content.title,
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
