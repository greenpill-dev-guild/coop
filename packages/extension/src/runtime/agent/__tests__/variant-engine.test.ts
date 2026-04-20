import 'fake-indexeddb/auto';
import { type CoopDexie, createCoopDb } from '@coop/shared';
import { afterEach, describe, expect, it } from 'vitest';
import {
  activateVariant,
  createVariant,
  generateDiff,
  getActiveVariant,
  getBaselineVariant,
  getVariantLineage,
  revertToBaseline,
  seedBaseline,
} from '../variant-engine';

const databases: CoopDexie[] = [];

function freshDb() {
  const db = createCoopDb(`coop-variant-engine-${crypto.randomUUID()}`);
  databases.push(db);
  return db;
}

async function sha256Hex(text: string) {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

afterEach(async () => {
  for (const db of databases) {
    db.close();
    await db.delete();
  }
  databases.length = 0;
});

describe('variant engine', () => {
  it('creates a variant with a deterministic content hash', async () => {
    const db = freshDb();
    const promptText = 'Summarize the signal with explicit funding context.';

    const variant = await createVariant(db, 'skill-opportunity-extractor', promptText);

    expect(variant.promptText).toBe(promptText);
    expect(variant.promptHash).toBe(await sha256Hex(promptText));
    await expect(db.skillVariants.get(variant.id)).resolves.toEqual(variant);
  });

  it('returns the existing variant when the prompt hash already exists for the skill', async () => {
    const db = freshDb();
    const promptText = 'Use a crisp synthesis and a clear next step.';

    const first = await createVariant(db, 'skill-review-digest', promptText);
    const second = await createVariant(db, 'skill-review-digest', promptText);

    expect(second).toEqual(first);
    await expect(db.skillVariants.count()).resolves.toBe(1);
  });

  it('returns the active baseline when no experiment variant is active', async () => {
    const db = freshDb();
    const baseline = await seedBaseline(db, 'skill-review-digest', 'Baseline review prompt');
    await createVariant(db, 'skill-review-digest', 'Candidate prompt', baseline.id);

    await expect(getActiveVariant(db, 'skill-review-digest')).resolves.toEqual(baseline);
  });

  it('returns the baseline even when another variant is currently active', async () => {
    const db = freshDb();
    const baseline = await seedBaseline(db, 'skill-review-digest', 'Baseline review prompt');
    const variant = await createVariant(db, 'skill-review-digest', 'Candidate prompt', baseline.id);
    await activateVariant(db, variant.id);

    await expect(getBaselineVariant(db, 'skill-review-digest')).resolves.toEqual(
      expect.objectContaining({
        id: baseline.id,
        isBaseline: true,
      }),
    );
  });

  it('activates a variant and deactivates the previous one', async () => {
    const db = freshDb();
    const baseline = await seedBaseline(db, 'skill-review-digest', 'Baseline review prompt');
    const variant = await createVariant(db, 'skill-review-digest', 'Candidate prompt', baseline.id);

    const activated = await activateVariant(db, variant.id);

    expect(activated.id).toBe(variant.id);
    expect(activated.isActive).toBe(true);
    expect(activated.activatedAt).not.toBeNull();
    await expect(db.skillVariants.get(baseline.id)).resolves.toMatchObject({
      id: baseline.id,
      isActive: false,
    });
    await expect(getActiveVariant(db, 'skill-review-digest')).resolves.toMatchObject({
      id: variant.id,
      isActive: true,
    });
  });

  it('reverts a skill back to its baseline variant', async () => {
    const db = freshDb();
    const baseline = await seedBaseline(db, 'skill-review-digest', 'Baseline review prompt');
    const variant = await createVariant(db, 'skill-review-digest', 'Candidate prompt', baseline.id);
    await activateVariant(db, variant.id);

    const reverted = await revertToBaseline(db, 'skill-review-digest');

    expect(reverted.id).toBe(baseline.id);
    expect(reverted.isActive).toBe(true);
    await expect(db.skillVariants.get(variant.id)).resolves.toMatchObject({
      id: variant.id,
      isActive: false,
    });
  });

  it('returns lineage from the current variant back to the baseline', async () => {
    const db = freshDb();
    const baseline = await seedBaseline(db, 'skill-review-digest', 'Baseline review prompt');
    const child = await createVariant(db, 'skill-review-digest', 'Child prompt', baseline.id);
    const grandchild = await createVariant(
      db,
      'skill-review-digest',
      'Grandchild prompt',
      child.id,
    );

    const lineage = await getVariantLineage(db, grandchild.id);

    expect(lineage.map((variant) => variant.id)).toEqual([grandchild.id, child.id, baseline.id]);
  });

  it('generates a simple unified diff between prompt texts', () => {
    const diff = generateDiff(
      ['Line one', 'Line two'].join('\n'),
      ['Line one', 'Line two updated', 'Line three'].join('\n'),
    );

    expect(diff).toContain('--- baseline');
    expect(diff).toContain('+++ variant');
    expect(diff).toContain('-Line two');
    expect(diff).toContain('+Line two updated');
    expect(diff).toContain('+Line three');
  });

  it('seeds an initial baseline as active and baseline-marked', async () => {
    const db = freshDb();

    const baseline = await seedBaseline(db, 'skill-opportunity-extractor', 'Baseline prompt');

    expect(baseline.isBaseline).toBe(true);
    expect(baseline.isActive).toBe(true);
    expect(baseline.parentVariantId).toBeNull();
    expect(baseline.activatedAt).toBe(baseline.createdAt);
    await expect(getActiveVariant(db, 'skill-opportunity-extractor')).resolves.toEqual(baseline);
  });

  it('throws when activating a variant that does not exist', async () => {
    const db = freshDb();

    await expect(activateVariant(db, 'nonexistent-id')).rejects.toThrow(
      'Variant "nonexistent-id" was not found.',
    );
  });

  it('throws when reverting to baseline for a skill with no baseline', async () => {
    const db = freshDb();

    await expect(revertToBaseline(db, 'skill-no-baseline')).rejects.toThrow(
      'No baseline variant exists for skill "skill-no-baseline".',
    );
  });

  it('returns the existing baseline when seedBaseline is called twice', async () => {
    const db = freshDb();

    const first = await seedBaseline(db, 'skill-review-digest', 'Baseline prompt');
    const second = await seedBaseline(db, 'skill-review-digest', 'Different prompt');

    expect(second.id).toBe(first.id);
    expect(second.promptText).toBe('Baseline prompt');
    await expect(db.skillVariants.count()).resolves.toBe(1);
  });
});
