import type { CaptureMode } from '@coop/shared';
import type { PerformanceDiagnosticsResponse } from '../runtime/messages';
import {
  db,
  getAgentRuntimeDiagnostics,
  getCoopSyncRuntime,
  getLocalSetting,
  getReceiverSyncRuntime,
  hasReceiverSyncOffscreenDocument,
  hydrateUiPreferences,
  stateKeys,
} from './context';

async function getActiveAlarms() {
  try {
    const alarms = await chrome.alarms.getAll();
    return alarms.map((alarm) => ({
      name: alarm.name,
      scheduledTime: alarm.scheduledTime,
      periodInMinutes: alarm.periodInMinutes,
    }));
  } catch {
    return [];
  }
}

async function getOffscreenPresence() {
  const supported = Boolean(chrome.offscreen?.createDocument);
  if (!supported) {
    return { supported, present: false };
  }
  return {
    supported,
    present: await hasReceiverSyncOffscreenDocument(chrome.offscreen),
  };
}

async function getTableCounts() {
  const entries = await Promise.all(
    db.tables.map(async (table) => [table.name, await table.count()] as const),
  );
  return Object.fromEntries(entries);
}

async function getGraphSnapshotSummary() {
  const count = await db.graphSnapshots.count();
  const latest = await db.graphSnapshots.orderBy('updatedAt').reverse().first();
  return {
    count,
    latestUpdatedAt: latest?.updatedAt,
  };
}

function compactEvents(
  events: Array<PerformanceDiagnosticsResponse['recentEvents'][number] | null | undefined>,
) {
  return events
    .filter((event): event is PerformanceDiagnosticsResponse['recentEvents'][number] =>
      Boolean(event),
    )
    .sort((left, right) => right.at.localeCompare(left.at))
    .slice(0, 12);
}

export async function getPerformanceDiagnostics(): Promise<PerformanceDiagnosticsResponse> {
  const [
    prefs,
    captureMode,
    alarms,
    offscreen,
    receiverSync,
    coopSync,
    agent,
    tableCounts,
    graphSnapshots,
  ] = await Promise.all([
    hydrateUiPreferences(),
    getLocalSetting<CaptureMode>(stateKeys.captureMode, 'manual'),
    getActiveAlarms(),
    getOffscreenPresence(),
    getReceiverSyncRuntime(),
    getCoopSyncRuntime(),
    getAgentRuntimeDiagnostics(),
    getTableCounts(),
    getGraphSnapshotSummary(),
  ]);

  const manifest = chrome.runtime.getManifest?.();
  return {
    timestamp: new Date().toISOString(),
    extensionVersion: manifest?.version,
    uiPreferences: {
      captureMode,
      agentCadenceMinutes: prefs.agentCadenceMinutes,
      localInferenceOptIn: prefs.localInferenceOptIn,
      heartbeatEnabled: prefs.heartbeatEnabled,
      captureOnClose: prefs.captureOnClose,
    },
    alarms,
    offscreen,
    receiverSync,
    coopSync,
    agent,
    storage: {
      tableCounts,
      graphSnapshots,
    },
    recentEvents: compactEvents([
      receiverSync.lastRefreshedAt
        ? {
            source: 'receiver-sync',
            type: 'refresh',
            at: receiverSync.lastRefreshedAt,
            detail: receiverSync.transport,
          }
        : null,
      receiverSync.lastError
        ? {
            source: 'receiver-sync',
            type: 'error',
            at: receiverSync.lastRefreshedAt ?? new Date().toISOString(),
            detail: receiverSync.lastError,
          }
        : null,
      coopSync.lastRefreshedAt
        ? {
            source: 'coop-sync',
            type: 'refresh',
            at: coopSync.lastRefreshedAt,
            detail: coopSync.mode,
          }
        : null,
      coopSync.lastError
        ? {
            source: 'coop-sync',
            type: 'error',
            at: coopSync.lastRefreshedAt ?? new Date().toISOString(),
            detail: coopSync.lastError,
          }
        : null,
      agent.lastStartedAt
        ? {
            source: 'agent',
            type: agent.running ? 'cycle-started' : 'cycle-last-started',
            at: agent.lastStartedAt,
            detail: agent.lastReason,
          }
        : null,
      agent.lastCompletedAt
        ? {
            source: 'agent',
            type: 'cycle-completed',
            at: agent.lastCompletedAt,
            detail:
              typeof agent.lastDurationMs === 'number' ? `${agent.lastDurationMs}ms` : undefined,
          }
        : null,
    ]),
  };
}
