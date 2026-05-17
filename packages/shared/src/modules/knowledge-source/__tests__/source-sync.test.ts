import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createCoopDb } from '../../storage/db';
import {
  mirrorSourcesFromYDocToDexie,
  readSourcesFromYDoc,
  removeSourceFromYDoc,
  watchSourceChanges,
  writeSourceToYDoc,
  writeSourcesFromDexieToYDoc,
} from '../sync-sources';
import { makeKnowledgeSource } from './fixtures';

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

function createTestDoc() {
  return new Y.Doc();
}

function syncTwoDocs(doc1: Y.Doc, doc2: Y.Doc) {
  const state1 = Y.encodeStateAsUpdate(doc1);
  const state2 = Y.encodeStateAsUpdate(doc2);
  Y.applyUpdate(doc1, state2);
  Y.applyUpdate(doc2, state1);
}

describe('source Yjs sync', () => {
  const docs: Y.Doc[] = [];

  afterEach(() => {
    for (const doc of docs) doc.destroy();
    docs.length = 0;
  });

  it('writes a source to Y.Map and reads it back', () => {
    const doc = createTestDoc();
    docs.push(doc);

    const source = makeKnowledgeSource({ id: 'sync-1', type: 'youtube', identifier: 'channel-1' });
    writeSourceToYDoc(doc, source);

    const sources = readSourcesFromYDoc(doc);
    expect(sources).toHaveLength(1);
    expect(sources[0].id).toBe('sync-1');
    expect(sources[0].type).toBe('youtube');
    expect(sources[0].identifier).toBe('channel-1');
  });

  it('concurrent add from two Y.Docs merges without data loss', () => {
    const doc1 = createTestDoc();
    const doc2 = createTestDoc();
    docs.push(doc1, doc2);

    const source1 = makeKnowledgeSource({ id: 'a', type: 'youtube' });
    const source2 = makeKnowledgeSource({ id: 'b', type: 'github' });

    writeSourceToYDoc(doc1, source1);
    writeSourceToYDoc(doc2, source2);

    syncTwoDocs(doc1, doc2);

    const fromDoc1 = readSourcesFromYDoc(doc1);
    const fromDoc2 = readSourcesFromYDoc(doc2);

    expect(fromDoc1).toHaveLength(2);
    expect(fromDoc2).toHaveLength(2);

    const ids1 = fromDoc1.map((s) => s.id).sort();
    const ids2 = fromDoc2.map((s) => s.id).sort();
    expect(ids1).toEqual(['a', 'b']);
    expect(ids2).toEqual(['a', 'b']);
  });

  it('remove propagates between two Y.Docs', () => {
    const doc1 = createTestDoc();
    const doc2 = createTestDoc();
    docs.push(doc1, doc2);

    const source = makeKnowledgeSource({ id: 'to-remove', type: 'rss' });
    writeSourceToYDoc(doc1, source);
    syncTwoDocs(doc1, doc2);

    expect(readSourcesFromYDoc(doc2)).toHaveLength(1);

    removeSourceFromYDoc(doc1, 'to-remove');
    syncTwoDocs(doc1, doc2);

    expect(readSourcesFromYDoc(doc2)).toHaveLength(0);
  });

  it('offline add syncs when Y.Docs reconnect', () => {
    const doc1 = createTestDoc();
    const doc2 = createTestDoc();
    docs.push(doc1, doc2);

    // Initial sync
    syncTwoDocs(doc1, doc2);

    // Both add offline
    const offlineSource1 = makeKnowledgeSource({ id: 'offline-1', type: 'npm' });
    const offlineSource2 = makeKnowledgeSource({ id: 'offline-2', type: 'reddit' });
    writeSourceToYDoc(doc1, offlineSource1);
    writeSourceToYDoc(doc2, offlineSource2);

    // Reconnect
    syncTwoDocs(doc1, doc2);

    const sources = readSourcesFromYDoc(doc1);
    expect(sources).toHaveLength(2);
    const ids = sources.map((s) => s.id).sort();
    expect(ids).toEqual(['offline-1', 'offline-2']);
  });

  it('watchSourceChanges fires callback on add', () => {
    const doc = createTestDoc();
    docs.push(doc);

    const events: string[] = [];
    const unsub = watchSourceChanges(doc, (sources) => {
      events.push(sources.map((s) => s.id).join(','));
    });

    const source = makeKnowledgeSource({ id: 'watch-1', type: 'wikipedia' });
    writeSourceToYDoc(doc, source);

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[events.length - 1]).toContain('watch-1');

    unsub();
  });

  it('round-trips the shared source registry between Dexie and Yjs', async () => {
    const db = createCoopDb(`test-source-sync-${crypto.randomUUID()}`);
    const doc = createTestDoc();
    docs.push(doc);
    try {
      await db.knowledgeSources.put(
        makeKnowledgeSource({
          id: 'dexie-source',
          coopId: 'coop-1',
          type: 'github',
          identifier: 'greenpill/coop',
          label: 'Coop repo',
        }),
      );

      const written = await writeSourcesFromDexieToYDoc(db, doc, { coopId: 'coop-1' });
      expect(written).toHaveLength(1);
      expect(readSourcesFromYDoc(doc).map((source) => source.id)).toEqual(['dexie-source']);

      await db.knowledgeSources.clear();
      const mirrored = await mirrorSourcesFromYDocToDexie(db, doc, { coopId: 'coop-1' });
      expect(mirrored).toHaveLength(1);
      expect((await db.knowledgeSources.get('dexie-source'))?.label).toBe('Coop repo');
    } finally {
      await db.delete();
    }
  });

  it('round-trips source active state and fetch metadata through Dexie and Yjs helpers', async () => {
    const db = createCoopDb(`test-source-sync-metadata-${crypto.randomUUID()}`);
    const doc = createTestDoc();
    docs.push(doc);
    try {
      await db.knowledgeSources.put(
        makeKnowledgeSource({
          id: 'metadata-source',
          coopId: 'coop-1',
          type: 'rss',
          identifier: 'https://example.test/feed.xml',
          label: 'Example feed',
          active: false,
          lastFetchedAt: '2026-05-16T12:00:00.000Z',
          entityCount: 7,
        }),
      );

      await writeSourcesFromDexieToYDoc(db, doc, { coopId: 'coop-1' });
      const [fromDoc] = readSourcesFromYDoc(doc);
      expect(fromDoc).toMatchObject({
        id: 'metadata-source',
        active: false,
        lastFetchedAt: '2026-05-16T12:00:00.000Z',
        entityCount: 7,
      });

      await db.knowledgeSources.clear();
      await mirrorSourcesFromYDocToDexie(db, doc, { coopId: 'coop-1' });

      const mirrored = await db.knowledgeSources.get('metadata-source');
      expect(mirrored).toMatchObject({
        active: false,
        lastFetchedAt: '2026-05-16T12:00:00.000Z',
        entityCount: 7,
      });
    } finally {
      await db.delete();
    }
  });

  it('prunes local sources missing from an incoming shared registry when requested', async () => {
    const db = createCoopDb(`test-source-sync-prune-${crypto.randomUUID()}`);
    const doc = createTestDoc();
    docs.push(doc);
    try {
      await db.knowledgeSources.bulkPut([
        makeKnowledgeSource({
          id: 'keep-source',
          coopId: 'coop-1',
          type: 'github',
          identifier: 'greenpill/coop',
          label: 'Coop repo',
        }),
        makeKnowledgeSource({
          id: 'remove-source',
          coopId: 'coop-1',
          type: 'rss',
          identifier: 'example.test/feed',
          label: 'Old feed',
        }),
      ]);
      writeSourceToYDoc(
        doc,
        makeKnowledgeSource({
          id: 'keep-source',
          coopId: 'coop-1',
          type: 'github',
          identifier: 'greenpill/coop',
          label: 'Coop repo',
        }),
      );

      await mirrorSourcesFromYDocToDexie(db, doc, { coopId: 'coop-1', pruneMissing: true });

      expect(await db.knowledgeSources.get('keep-source')).toBeDefined();
      expect(await db.knowledgeSources.get('remove-source')).toBeUndefined();
    } finally {
      await db.delete();
    }
  });
});
