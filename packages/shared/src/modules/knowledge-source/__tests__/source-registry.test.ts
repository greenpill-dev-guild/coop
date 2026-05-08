import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRelationship, initGraphStore, upsertEntity } from '../../graph';
import { type CoopDexie, createCoopDb } from '../../storage/db';
import {
  createKnowledgeSource,
  listKnowledgeSources,
  removeKnowledgeSource,
  updateKnowledgeSourceMeta,
} from '../knowledge-source';
import { GITHUB_SOURCE, RSS_SOURCE, YOUTUBE_SOURCE, makeKnowledgeSource } from './fixtures';

let db: CoopDexie;

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

beforeEach(async () => {
  db = createCoopDb(`test-ks-registry-${crypto.randomUUID()}`);
});

afterEach(async () => {
  await db.delete();
});

describe('createKnowledgeSource', () => {
  it('stores a source with correct schema fields', async () => {
    const source = await createKnowledgeSource(db, {
      type: 'youtube',
      identifier: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
      label: 'Google Developers',
      coopId: 'coop-1',
      addedBy: 'member-1',
    });

    expect(source.id).toMatch(/^ks-/);
    expect(source.type).toBe('youtube');
    expect(source.identifier).toBe('UC_x5XG1OV2P6uZZ5FSM9Ttw');
    expect(source.label).toBe('Google Developers');
    expect(source.coopId).toBe('coop-1');
    expect(source.addedBy).toBe('member-1');
    expect(source.addedAt).toBeTruthy();
    expect(source.lastFetchedAt).toBeNull();
    expect(source.entityCount).toBe(0);
    expect(source.active).toBe(true);

    const stored = await db.knowledgeSources.get(source.id);
    expect(stored).toBeDefined();
    expect(stored?.identifier).toBe('UC_x5XG1OV2P6uZZ5FSM9Ttw');
  });

  it('rejects duplicate identifier for same coop', async () => {
    await createKnowledgeSource(db, {
      type: 'youtube',
      identifier: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
      label: 'Google Developers',
      coopId: 'coop-1',
      addedBy: 'member-1',
    });

    await expect(
      createKnowledgeSource(db, {
        type: 'youtube',
        identifier: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
        label: 'Google Developers Duplicate',
        coopId: 'coop-1',
        addedBy: 'member-2',
      }),
    ).rejects.toThrow(/duplicate/i);
  });

  it('allows same identifier in different coops', async () => {
    await createKnowledgeSource(db, {
      type: 'github',
      identifier: 'anthropics/claude-code',
      label: 'Claude Code',
      coopId: 'coop-1',
      addedBy: 'member-1',
    });

    const second = await createKnowledgeSource(db, {
      type: 'github',
      identifier: 'anthropics/claude-code',
      label: 'Claude Code',
      coopId: 'coop-2',
      addedBy: 'member-2',
    });

    expect(second.coopId).toBe('coop-2');
  });
});

describe('removeKnowledgeSource', () => {
  it('deletes a source by id', async () => {
    const source = await createKnowledgeSource(db, {
      type: 'rss',
      identifier: 'https://example.com/feed.xml',
      label: 'Example Blog',
      coopId: 'coop-1',
      addedBy: 'member-1',
    });

    await removeKnowledgeSource(db, source.id);
    const stored = await db.knowledgeSources.get(source.id);
    expect(stored).toBeUndefined();
  });

  it('marks ingested graph entities stale when removing a source with graph context', async () => {
    const source = await createKnowledgeSource(db, {
      type: 'github',
      identifier: 'greenpill/coop',
      label: 'Coop',
      coopId: 'coop-1',
      addedBy: 'member-1',
    });
    const graphStore = initGraphStore();
    upsertEntity(graphStore, {
      id: 'entity-from-source',
      name: 'Coop Repo',
      type: 'organization',
      description: 'Repo entity',
      sourceRef: 'github:greenpill/coop',
    });
    upsertEntity(graphStore, {
      id: 'entity-other',
      name: 'Other',
      type: 'object',
      description: 'Other entity',
      sourceRef: 'rss:https://example.com/feed.xml',
    });
    createRelationship(graphStore, {
      from: 'entity-from-source',
      to: 'entity-other',
      type: 'mentions',
      confidence: 0.8,
      t_valid: '2026-01-01T00:00:00.000Z',
      t_invalid: null,
      provenance: 'github:greenpill/coop',
    });

    const result = await removeKnowledgeSource(db, source.id, {
      graphStore,
      staleAt: '2026-05-08T00:00:00.000Z',
    });

    expect(result).toEqual({ staleEntityCount: 1, invalidatedRelationshipCount: 1 });
    expect(graphStore.entities.get('entity-from-source')?.stale).toBe(true);
    expect(graphStore.entities.get('entity-other')?.stale).toBeUndefined();
    expect(graphStore.relationships[0].t_invalid).toBe('2026-05-08T00:00:00.000Z');
  });
});

describe('listKnowledgeSources', () => {
  beforeEach(async () => {
    // Insert sources across coops and types
    await db.knowledgeSources.bulkPut([
      makeKnowledgeSource({ id: 'a', type: 'youtube', coopId: 'coop-1', active: true }),
      makeKnowledgeSource({ id: 'b', type: 'github', coopId: 'coop-1', active: true }),
      makeKnowledgeSource({ id: 'c', type: 'rss', coopId: 'coop-1', active: false }),
      makeKnowledgeSource({ id: 'd', type: 'youtube', coopId: 'coop-2', active: true }),
    ]);
  });

  it('filters by coopId', async () => {
    const sources = await listKnowledgeSources(db, { coopId: 'coop-1' });
    expect(sources).toHaveLength(3);
    expect(sources.every((s) => s.coopId === 'coop-1')).toBe(true);
  });

  it('filters by type', async () => {
    const sources = await listKnowledgeSources(db, { type: 'youtube' });
    expect(sources).toHaveLength(2);
    expect(sources.every((s) => s.type === 'youtube')).toBe(true);
  });

  it('filters by active status', async () => {
    const sources = await listKnowledgeSources(db, { coopId: 'coop-1', active: true });
    expect(sources).toHaveLength(2);
    expect(sources.every((s) => s.active === true)).toBe(true);
  });

  it('returns all sources when no filters given', async () => {
    const sources = await listKnowledgeSources(db, {});
    expect(sources).toHaveLength(4);
  });
});

describe('updateKnowledgeSourceMeta', () => {
  it('updates lastFetchedAt and entityCount', async () => {
    const source = await createKnowledgeSource(db, {
      type: 'npm',
      identifier: 'viem',
      label: 'viem',
      coopId: 'coop-1',
      addedBy: 'member-1',
    });

    const now = '2026-04-06T12:00:00.000Z';
    await updateKnowledgeSourceMeta(db, source.id, {
      lastFetchedAt: now,
      entityCount: 42,
    });

    const updated = await db.knowledgeSources.get(source.id);
    expect(updated?.lastFetchedAt).toBe(now);
    expect(updated?.entityCount).toBe(42);
  });
});
