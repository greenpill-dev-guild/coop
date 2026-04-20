import type {
  AgentBenchmarkRecord,
  AgentLog,
  AgentMemory,
  AgentObservation,
  AgentPlan,
  AgentTraceRecord,
  CoopKnowledgeSkillOverride,
  KnowledgeSkill,
  SkillRun,
  TabRouting,
} from '../../contracts/schema';
import {
  agentBenchmarkRecordSchema,
  agentMemorySchema,
  agentObservationSchema,
  agentPlanSchema,
  agentTraceRecordSchema,
  skillRunSchema,
  tabRoutingSchema,
} from '../../contracts/schema';
import {
  buildEncryptedLocalPayloadId,
  buildEncryptedLocalPayloadRecord,
  buildRedactedAgentMemory,
  hydrateAgentMemoryRecord,
} from './db-encryption';
import type { CoopDexie } from './db-schema';

// --- Agent persistence ---

export async function saveAgentObservation(db: CoopDexie, observation: AgentObservation) {
  await db.agentObservations.put(agentObservationSchema.parse(observation));
}

export async function saveAgentBenchmarkRecord(db: CoopDexie, record: AgentBenchmarkRecord) {
  await db.agentBenchmarkRecords.put(agentBenchmarkRecordSchema.parse(record));
}

export async function getAgentBenchmarkRecord(db: CoopDexie, benchmarkId: string) {
  return db.agentBenchmarkRecords.get(benchmarkId);
}

export async function listAgentBenchmarkRecords(
  db: CoopDexie,
  options: {
    skillId?: string;
    providerId?: AgentBenchmarkRecord['providerId'];
    limit?: number;
  } = {},
) {
  let records = await db.agentBenchmarkRecords.orderBy('createdAt').reverse().toArray();
  if (options.skillId) {
    records = records.filter((record) => record.skillId === options.skillId);
  }
  if (options.providerId) {
    records = records.filter((record) => record.providerId === options.providerId);
  }
  return typeof options.limit === 'number' ? records.slice(0, options.limit) : records;
}

export async function saveAgentTraceRecord(db: CoopDexie, record: AgentTraceRecord) {
  await db.agentTraceRecords.put(agentTraceRecordSchema.parse(record));
}

export async function getAgentTraceRecord(db: CoopDexie, traceRecordId: string) {
  return db.agentTraceRecords.get(traceRecordId);
}

export async function listAgentTraceRecords(
  db: CoopDexie,
  options: {
    traceId?: string;
    observationId?: string;
    skillId?: string;
    providerId?: AgentTraceRecord['providerId'];
    outcome?: AgentTraceRecord['outcome'];
    limit?: number;
  } = {},
) {
  let records = await db.agentTraceRecords.orderBy('startedAt').reverse().toArray();
  if (options.traceId) {
    records = records.filter((record) => record.traceId === options.traceId);
  }
  if (options.observationId) {
    records = records.filter((record) => record.observationId === options.observationId);
  }
  if (options.skillId) {
    records = records.filter((record) => record.skillId === options.skillId);
  }
  if (options.providerId) {
    records = records.filter((record) => record.providerId === options.providerId);
  }
  if (options.outcome) {
    records = records.filter((record) => record.outcome === options.outcome);
  }
  return typeof options.limit === 'number' ? records.slice(0, options.limit) : records;
}

export async function getAgentObservation(db: CoopDexie, observationId: string) {
  return db.agentObservations.get(observationId);
}

export async function listAgentObservations(db: CoopDexie, limit = 100) {
  return db.agentObservations.orderBy('createdAt').reverse().limit(limit).toArray();
}

export async function findAgentObservationByFingerprint(db: CoopDexie, fingerprint: string) {
  return db.agentObservations.where('fingerprint').equals(fingerprint).first();
}

export async function listAgentObservationsByStatus(
  db: CoopDexie,
  statuses: AgentObservation['status'][],
) {
  const all = await listAgentObservations(db, 500);
  const set = new Set(statuses);
  return all.filter((observation) => set.has(observation.status));
}

export async function saveAgentPlan(db: CoopDexie, plan: AgentPlan) {
  await db.agentPlans.put(agentPlanSchema.parse(plan));
}

export async function getAgentPlan(db: CoopDexie, planId: string) {
  return db.agentPlans.get(planId);
}

export async function listAgentPlans(db: CoopDexie, limit = 100) {
  return db.agentPlans.orderBy('createdAt').reverse().limit(limit).toArray();
}

export async function listAgentPlansByObservationId(db: CoopDexie, observationId: string) {
  return db.agentPlans.where('observationId').equals(observationId).reverse().sortBy('createdAt');
}

export async function saveSkillRun(db: CoopDexie, run: SkillRun) {
  await db.skillRuns.put(skillRunSchema.parse(run));
}

export async function getSkillRun(db: CoopDexie, skillRunId: string) {
  return db.skillRuns.get(skillRunId);
}

export async function listSkillRuns(db: CoopDexie, limit = 200) {
  return db.skillRuns.orderBy('startedAt').reverse().limit(limit).toArray();
}

export async function listSkillRunsByPlanId(db: CoopDexie, planId: string) {
  return db.skillRuns.where('planId').equals(planId).reverse().sortBy('startedAt');
}

// --- Tab routing persistence ---

export async function saveTabRouting(db: CoopDexie, routing: TabRouting) {
  const parsed = tabRoutingSchema.parse(routing);
  const existing = await db.tabRoutings
    .where('[extractId+coopId]')
    .equals([parsed.extractId, parsed.coopId])
    .first();
  await db.tabRoutings.put({
    ...parsed,
    id: existing?.id ?? parsed.id,
    createdAt: existing?.createdAt ?? parsed.createdAt,
  });
}

export async function getTabRoutingByExtractAndCoop(
  db: CoopDexie,
  extractId: string,
  coopId: string,
) {
  return db.tabRoutings.where('[extractId+coopId]').equals([extractId, coopId]).first();
}

export async function listTabRoutings(
  db: CoopDexie,
  options: {
    coopId?: string;
    extractId?: string;
    sourceCandidateId?: string;
    status?: TabRouting['status'][];
    limit?: number;
  } = {},
) {
  let results = await db.tabRoutings.orderBy('updatedAt').reverse().toArray();
  if (options.coopId) {
    results = results.filter((routing) => routing.coopId === options.coopId);
  }
  if (options.extractId) {
    results = results.filter((routing) => routing.extractId === options.extractId);
  }
  if (options.sourceCandidateId) {
    results = results.filter((routing) => routing.sourceCandidateId === options.sourceCandidateId);
  }
  if (options.status?.length) {
    const allowed = new Set(options.status);
    results = results.filter((routing) => allowed.has(routing.status));
  }
  return typeof options.limit === 'number' ? results.slice(0, options.limit) : results;
}

// --- Knowledge skills ---

export async function saveKnowledgeSkill(db: CoopDexie, skill: KnowledgeSkill) {
  await db.knowledgeSkills.put(skill);
}

export async function getKnowledgeSkill(db: CoopDexie, skillId: string) {
  return db.knowledgeSkills.get(skillId);
}

export async function listKnowledgeSkills(db: CoopDexie) {
  return db.knowledgeSkills.toArray();
}

export async function deleteKnowledgeSkill(db: CoopDexie, skillId: string) {
  await db.knowledgeSkills.delete(skillId);
}

export async function saveCoopKnowledgeSkillOverride(
  db: CoopDexie,
  override: CoopKnowledgeSkillOverride,
) {
  await db.coopKnowledgeSkillOverrides.put(override);
}

export async function deleteCoopKnowledgeSkillOverride(db: CoopDexie, overrideId: string) {
  await db.coopKnowledgeSkillOverrides.delete(overrideId);
}

export async function listCoopKnowledgeSkillOverrides(db: CoopDexie, coopId: string) {
  return db.coopKnowledgeSkillOverrides.where('coopId').equals(coopId).toArray();
}

// --- Agent logs ---

export async function saveAgentLog(db: CoopDexie, log: AgentLog) {
  await db.agentLogs.put(log);
}

export async function listAgentLogsByTraceId(db: CoopDexie, traceId: string) {
  return db.agentLogs.where('traceId').equals(traceId).sortBy('timestamp');
}

export async function listRecentAgentLogs(db: CoopDexie, limit = 200) {
  return db.agentLogs.orderBy('timestamp').reverse().limit(limit).toArray();
}

// --- Agent memory persistence ---

export async function saveAgentMemory(db: CoopDexie, memory: AgentMemory) {
  const payload = await buildEncryptedLocalPayloadRecord({
    db,
    kind: 'agent-memory',
    entityId: memory.id,
    bytes: new TextEncoder().encode(JSON.stringify(agentMemorySchema.parse(memory))),
  });

  await db.transaction('rw', db.agentMemories, db.encryptedLocalPayloads, async () => {
    await db.agentMemories.put(buildRedactedAgentMemory(memory));
    await db.encryptedLocalPayloads.put(payload);
  });
}

export async function getAgentMemory(db: CoopDexie, memoryId: string) {
  return hydrateAgentMemoryRecord(db, await db.agentMemories.get(memoryId));
}

export async function listAgentMemories(db: CoopDexie) {
  const memories = await db.agentMemories.orderBy('createdAt').reverse().toArray();
  const hydrated = await Promise.all(
    memories.map((memory) => hydrateAgentMemoryRecord(db, memory)),
  );
  return hydrated.filter((memory): memory is AgentMemory => Boolean(memory));
}

export async function deleteAgentMemories(db: CoopDexie, ids: string[]) {
  if (ids.length === 0) {
    return;
  }

  await db.transaction('rw', db.agentMemories, db.encryptedLocalPayloads, async () => {
    await db.agentMemories.bulkDelete(ids);
    await db.encryptedLocalPayloads.bulkDelete(
      ids.map((id) => buildEncryptedLocalPayloadId('agent-memory', id)),
    );
  });
}

export async function purgeQuarantinedKnowledgeSkills(db: CoopDexie) {
  await db.transaction('rw', db.knowledgeSkills, db.coopKnowledgeSkillOverrides, async () => {
    await db.knowledgeSkills.clear();
    await db.coopKnowledgeSkillOverrides.clear();
  });
}
