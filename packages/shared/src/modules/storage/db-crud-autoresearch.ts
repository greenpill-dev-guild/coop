import Dexie from 'dexie';
import type { AutoresearchConfig, ExperimentRecord, SkillVariant } from '../../contracts/schema';
import {
  autoresearchConfigSchema,
  experimentRecordSchema,
  skillVariantSchema,
} from '../../contracts/schema';
import type { CoopDexie } from './db-schema';

export async function saveSkillVariant(db: CoopDexie, variant: SkillVariant) {
  await db.skillVariants.put(skillVariantSchema.parse(variant));
}

export async function getSkillVariant(db: CoopDexie, variantId: string) {
  return db.skillVariants.get(variantId);
}

export async function saveExperimentRecord(db: CoopDexie, record: ExperimentRecord) {
  await db.experimentRecords.put(experimentRecordSchema.parse(record));
}

export async function getExperimentRecord(db: CoopDexie, experimentId: string) {
  return db.experimentRecords.get(experimentId);
}

export async function listExperimentRecordsBySkill(db: CoopDexie, skillId: string, limit = 100) {
  return db.experimentRecords
    .where('[skillId+createdAt]')
    .between([skillId, Dexie.minKey], [skillId, Dexie.maxKey])
    .reverse()
    .limit(limit)
    .toArray();
}

export async function saveAutoresearchConfig(db: CoopDexie, config: AutoresearchConfig) {
  await db.autoresearchConfigs.put(autoresearchConfigSchema.parse(config));
}

export async function getAutoresearchConfig(db: CoopDexie, skillId: string) {
  return db.autoresearchConfigs.get(skillId);
}

export async function pruneRevertedExperiments(
  db: CoopDexie,
  olderThanDays = 30,
  now = Date.now(),
) {
  const threshold = now - olderThanDays * 24 * 60 * 60 * 1000;
  const staleIds = (
    await db.experimentRecords
      .where('outcome')
      .equals('reverted')
      .and((record) => record.createdAt < threshold)
      .primaryKeys()
  ).map((id) => String(id));

  if (staleIds.length === 0) {
    return 0;
  }

  await db.experimentRecords.bulkDelete(staleIds);
  return staleIds.length;
}
