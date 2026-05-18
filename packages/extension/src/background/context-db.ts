import {
  type CoopSharedState,
  type GreenGoodsGardenState,
  createCoopDb,
  hydrateCoopDoc,
  readCoopState,
  saveCoopState,
} from '@coop/shared';

// ---- State Keys & Alarm Names ----
// These live here (at the bottom of the dependency graph) so every other
// context-* module can import them without circular references.

export const stateKeys = {
  activeCoopId: 'active-coop-id',
  agentOnboarding: 'agent-onboarding',
  captureMode: 'capture-mode',
  notificationIntentRegistry: 'notification-intent-registry',
  notificationRegistry: 'notification-registry',
  coopSyncRuntime: 'coop-sync-runtime',
  receiverSyncRuntime: 'receiver-sync-runtime',
  runtimeHealth: 'runtime-health',
  sidepanelIntent: 'sidepanel-intent',
  sidepanelState: 'sidepanel-state',
  sessionWrappingSecret: 'session-wrapping-secret',
};

export const alarmNames = {
  capture: 'coop-capture',
  agentCadence: 'agent-proactive-cycle',
  agentHeartbeat: 'agent-heartbeat',
  archiveStatusPoll: 'archive-status-poll',
  onboardingFollowUpPrefix: 'agent-onboarding-followup:',
  knowledgeLint: 'knowledge-lint',
} as const;

// ---- Database Instance ----

export const db = createCoopDb('coop-extension');

let dbReadyPromise: Promise<void> | null = null;

function isPrimaryKeyUpgradeError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === 'UpgradeError' &&
    /changing primary key|Not yet support for changing primary key/i.test(error.message)
  );
}

/**
 * Ensures the Dexie database is open and compatible with the current schema.
 * If the schema has changed in a way that breaks primary keys (common after
 * extension updates), the database is deleted and recreated automatically.
 */
export async function ensureDbReady(): Promise<void> {
  if (dbReadyPromise) {
    await dbReadyPromise;
    return;
  }

  dbReadyPromise = (async () => {
    try {
      if (!db.isOpen()) {
        await db.open();
      }
      return;
    } catch (error) {
      if (!isPrimaryKeyUpgradeError(error)) {
        throw error;
      }
    }

    console.warn(
      '[coop-extension] IndexedDB schema is incompatible with this build. Resetting local db.',
    );
    try {
      db.close();
    } catch {
      // already closed or never opened
    }
    await db.delete();
    await db.open();
  })().finally(() => {
    dbReadyPromise = null;
  });

  await dbReadyPromise;
}

// ---- Settings Helpers ----

export async function setLocalSetting(key: string, value: unknown) {
  await db.settings.put({ key, value });
}

export async function getLocalSetting<T>(key: string, fallback: T): Promise<T> {
  const record = await db.settings.get(key);
  return (record?.value as T | undefined) ?? fallback;
}

// ---- Coop Persistence ----

export async function getCoops() {
  const docs = await db.coopDocs.toArray();
  return docs.map((record) => readCoopState(hydrateCoopDoc(record.encodedState)));
}

export async function saveState(state: CoopSharedState) {
  await saveCoopState(db, state);
  try {
    chrome.runtime.sendMessage({
      type: 'refresh-coop-sync-bindings',
      payload: { reason: 'save-state', force: true },
    });
  } catch {
    // Offscreen sync may not be awake yet; its heartbeat will catch up.
  }
}

export async function updateCoopGreenGoodsState(input: {
  coopId: string;
  apply(current: GreenGoodsGardenState | undefined, coop: CoopSharedState): GreenGoodsGardenState;
}) {
  const coops = await getCoops();
  const coop = coops.find((candidate) => candidate.profile.id === input.coopId);
  if (!coop) {
    throw new Error('Coop not found.');
  }

  const nextState = {
    ...coop,
    greenGoods: input.apply(coop.greenGoods, coop),
  } satisfies CoopSharedState;
  await saveState(nextState);
  return nextState;
}
