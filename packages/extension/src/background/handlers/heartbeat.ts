import {
  buildAgentObservationFingerprint,
  createAgentObservation,
  deduplicateMemories,
  enforceMemoryLimit,
  findAgentObservationByFingerprint,
  pruneExpiredMemories,
  saveAgentObservation,
} from '@coop/shared';
import { db, getCoops, uiPreferences } from '../context';

// --- Constants ---

const STALE_DRAFT_THRESHOLD_MS = 48 * 60 * 60 * 1000;
const UNREVIEWED_OBSERVATION_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const STALE_SKILL_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

// --- Heartbeat Handler ---

/**
 * Periodic heartbeat handler that runs lightweight DB checks
 * for stale drafts, unreviewed observations, and knowledge skill freshness.
 * No inference or content scripts -- just housekeeping queries.
 */
export async function handleAgentHeartbeat(): Promise<void> {
  if (!uiPreferences.heartbeatEnabled) {
    return;
  }

  const now = Date.now();

  // 1. Stale drafts: ready drafts older than 48h
  await checkStaleDrafts(now);

  // 2. Unreviewed observations: pending observations older than 24h
  await checkUnreviewedObservations(now);

  // 3. Knowledge skill freshness: skills not fetched in 7 days
  await checkStaleKnowledgeSkills(now);

  // 4. Memory maintenance: prune expired, enforce limits
  await maintainAgentMemories();
}

// --- Stale Drafts ---

async function checkStaleDrafts(now: number): Promise<void> {
  const drafts = await db.reviewDrafts.where('workflowStage').equals('ready').toArray();
  const threshold = now - STALE_DRAFT_THRESHOLD_MS;

  for (const draft of drafts) {
    const createdAtMs = new Date(draft.createdAt).getTime();
    if (createdAtMs > threshold) {
      continue;
    }

    const observation = createAgentObservation({
      trigger: 'stale-draft',
      title: `Stale draft: ${draft.title}`,
      summary: `Review draft "${draft.title}" has been in ready state for over 48 hours.`,
      coopId: draft.suggestedTargetCoopIds[0],
      draftId: draft.id,
      payload: {
        workflowStage: draft.workflowStage,
        category: draft.category,
        confidence: draft.confidence,
      },
    });

    const existing = await findAgentObservationByFingerprint(db, observation.fingerprint);
    if (existing) {
      continue;
    }

    await saveAgentObservation(db, observation);
  }
}

// --- Unreviewed Observations ---

async function checkUnreviewedObservations(now: number): Promise<void> {
  const observations = await db.agentObservations.where('status').equals('pending').toArray();
  const threshold = now - UNREVIEWED_OBSERVATION_THRESHOLD_MS;

  for (const observation of observations) {
    const createdAtMs = new Date(observation.createdAt).getTime();
    if (createdAtMs > threshold) {
      continue;
    }

    console.warn('[heartbeat] unreviewed agent observation older than 24h', {
      id: observation.id,
      trigger: observation.trigger,
      createdAt: observation.createdAt,
    });
  }
}

// --- Agent Memory Maintenance ---

async function maintainAgentMemories(): Promise<void> {
  await pruneExpiredMemories(db);

  const coops = await getCoops();
  for (const coop of coops) {
    await deduplicateMemories(db, coop.profile.id);
    await enforceMemoryLimit(db, coop.profile.id);
  }
}

// --- Knowledge Skill Freshness ---

async function checkStaleKnowledgeSkills(now: number): Promise<void> {
  const skills = await db.knowledgeSkills.toArray();
  const threshold = now - STALE_SKILL_THRESHOLD_MS;

  for (const skill of skills) {
    if (!skill.fetchedAt) {
      continue;
    }

    const fetchedAtMs = new Date(skill.fetchedAt).getTime();
    if (fetchedAtMs > threshold) {
      continue;
    }

    console.warn('[heartbeat] stale knowledge skill not fetched in over 7 days', {
      id: skill.id,
      name: skill.name,
      fetchedAt: skill.fetchedAt,
    });
  }
}
