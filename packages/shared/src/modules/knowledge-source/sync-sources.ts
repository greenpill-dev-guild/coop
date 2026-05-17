import type * as Y from 'yjs';
import type { KnowledgeSource } from '../../contracts/schema-knowledge';
import { knowledgeSourceSchema } from '../../contracts/schema-knowledge';
import type { CoopDexie } from '../storage/db-schema';

const SOURCES_MAP_KEY = 'knowledge-sources-v1';

/**
 * Write a knowledge source into the Yjs document's shared map.
 */
export function writeSourceToYDoc(doc: Y.Doc, source: KnowledgeSource): void {
  const map = doc.getMap<string>(SOURCES_MAP_KEY);
  map.set(source.id, JSON.stringify(source));
}

/**
 * Remove a knowledge source from the Yjs document's shared map.
 */
export function removeSourceFromYDoc(doc: Y.Doc, sourceId: string): void {
  const map = doc.getMap<string>(SOURCES_MAP_KEY);
  map.delete(sourceId);
}

/**
 * Read all knowledge sources from the Yjs document's shared map.
 */
export function readSourcesFromYDoc(doc: Y.Doc): KnowledgeSource[] {
  const map = doc.getMap<string>(SOURCES_MAP_KEY);
  const sources: KnowledgeSource[] = [];
  for (const value of map.values()) {
    try {
      sources.push(knowledgeSourceSchema.parse(JSON.parse(value)));
    } catch {
      // skip corrupted entries
    }
  }
  return sources;
}

export async function mirrorSourcesFromYDocToDexie(
  db: CoopDexie,
  doc: Y.Doc,
  options: { coopId?: string; pruneMissing?: boolean } = {},
): Promise<KnowledgeSource[]> {
  const sources = readSourcesFromYDoc(doc).filter(
    (source) => !options.coopId || source.coopId === options.coopId,
  );
  if (sources.length > 0 || options.pruneMissing) {
    if (options.pruneMissing) {
      const nextIds = new Set(sources.map((source) => source.id));
      const existing = options.coopId
        ? await db.knowledgeSources.where('coopId').equals(options.coopId).toArray()
        : await db.knowledgeSources.toArray();
      const staleIds = existing
        .map((source) => source.id)
        .filter((sourceId) => !nextIds.has(sourceId));
      if (staleIds.length > 0) {
        await db.knowledgeSources.bulkDelete(staleIds);
      }
    }
    if (sources.length > 0) {
      await db.knowledgeSources.bulkPut(sources);
    }
  }
  return sources;
}

export async function writeSourcesFromDexieToYDoc(
  db: CoopDexie,
  doc: Y.Doc,
  options: { coopId?: string } = {},
): Promise<KnowledgeSource[]> {
  const sources = options.coopId
    ? await db.knowledgeSources.where('coopId').equals(options.coopId).toArray()
    : await db.knowledgeSources.toArray();
  for (const source of sources) {
    writeSourceToYDoc(doc, source);
  }
  return sources;
}

/**
 * Watch for changes to the knowledge sources in the Yjs document.
 * Returns an unsubscribe function.
 */
export function watchSourceChanges(
  doc: Y.Doc,
  callback: (sources: KnowledgeSource[]) => void,
): () => void {
  const map = doc.getMap<string>(SOURCES_MAP_KEY);
  const handler = () => {
    callback(readSourcesFromYDoc(doc));
  };
  map.observe(handler);
  return () => map.unobserve(handler);
}
