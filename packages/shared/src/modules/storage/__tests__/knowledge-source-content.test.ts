import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type CoopDexie,
  createCoopDb,
  getKnowledgeSourceContent,
  listKnowledgeSourceContents,
  saveKnowledgeSourceContent,
} from '../db';

let db: CoopDexie;

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

beforeEach(() => {
  db = createCoopDb(`test-source-content-${crypto.randomUUID()}`);
});

afterEach(async () => {
  await db.delete();
});

describe('knowledge source content persistence', () => {
  it('stores fetched source bodies locally behind encrypted payload records', async () => {
    const content = await saveKnowledgeSourceContent(db, {
      sourceId: 'ks-1',
      coopId: 'coop-1',
      sourceRef: 'rss:https://example.test/feed#1',
      title: 'Watershed funding update',
      body: 'A regional foundation opened a watershed restoration grant round.',
      metadata: { author: 'Example' },
      fetchedAt: '2026-04-06T00:00:00.000Z',
      createdAt: '2026-04-06T00:00:01.000Z',
    });

    const redacted = await db.knowledgeSourceContents.get(content.id);
    expect(redacted?.body).toBe('Encrypted source content.');
    expect(redacted?.metadata).toEqual({});

    const payload = await db.encryptedLocalPayloads.get(`knowledge-source-content:${content.id}`);
    expect(payload?.kind).toBe('knowledge-source-content');
    expect(payload?.entityId).toBe(content.id);

    const hydrated = await getKnowledgeSourceContent(db, content.id);
    expect(hydrated?.body).toBe(
      'A regional foundation opened a watershed restoration grant round.',
    );
    expect(hydrated?.bodyHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(hydrated?.metadata).toEqual({ author: 'Example' });
  });

  it('lists hydrated source content by source or coop without exposing raw bodies in rows', async () => {
    await saveKnowledgeSourceContent(db, {
      sourceId: 'ks-1',
      coopId: 'coop-1',
      sourceRef: 'github:org/repo',
      title: 'Repository update',
      body: 'Release notes mention a local-first graph memory layer.',
      metadata: {},
      fetchedAt: '2026-04-06T00:00:00.000Z',
    });
    await saveKnowledgeSourceContent(db, {
      sourceId: 'ks-2',
      coopId: 'coop-1',
      sourceRef: 'rss:https://example.test/feed#2',
      title: 'Grant update',
      body: 'A new grant asks for source-backed impact evidence.',
      metadata: {},
      fetchedAt: '2026-04-07T00:00:00.000Z',
    });

    const bySource = await listKnowledgeSourceContents(db, { sourceId: 'ks-1' });
    expect(bySource).toHaveLength(1);
    expect(bySource[0]?.body).toMatch(/local-first graph memory/);

    const byCoop = await listKnowledgeSourceContents(db, { coopId: 'coop-1', limit: 1 });
    expect(byCoop).toHaveLength(1);
    expect(byCoop[0]?.title).toBe('Grant update');

    const rows = await db.knowledgeSourceContents.toArray();
    expect(rows.every((row) => row.body === 'Encrypted source content.')).toBe(true);
  });

  it('persists empty source bodies for metadata-only adapter results', async () => {
    const content = await saveKnowledgeSourceContent(db, {
      sourceId: 'ks-empty',
      coopId: 'coop-1',
      sourceRef: 'github:missing/repo',
      title: 'Missing repository',
      body: '',
      metadata: { error: true },
      fetchedAt: '2026-04-08T00:00:00.000Z',
    });

    const hydrated = await getKnowledgeSourceContent(db, content.id);
    expect(hydrated?.body).toBe('');
    expect(hydrated?.bodyHash).toMatch(/^0x[a-f0-9]{64}$/);
  });
});
