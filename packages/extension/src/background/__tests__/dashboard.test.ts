import { describe, expect, it } from 'vitest';
import { summarizeSyncStatus } from '../dashboard';

describe('summarizeSyncStatus', () => {
  it('returns a healthy sync summary when runtime health is clear', () => {
    expect(
      summarizeSyncStatus({
        coopCount: 1,
        runtimeHealth: {
          offline: false,
          missingPermission: false,
          syncError: false,
        },
      }),
    ).toEqual({
      syncState: 'Peer-ready local-first sync',
      syncLabel: 'Healthy',
      syncDetail: 'Peer-ready local-first sync.',
      syncTone: 'ok',
    });
  });

  it('surfaces local-only sync when signaling is unavailable', () => {
    expect(
      summarizeSyncStatus({
        coopCount: 1,
        runtimeHealth: {
          offline: false,
          missingPermission: false,
          syncError: true,
          lastSyncError:
            'No signaling server connection. Shared sync is currently limited to this browser profile.',
        },
      }),
    ).toEqual({
      syncState:
        'No signaling server connection. Shared sync is currently limited to this browser profile.',
      syncLabel: 'Local only',
      syncDetail:
        'No signaling server connection. Shared sync is currently limited to this browser profile.',
      syncTone: 'warning',
    });
  });

  it('prioritizes offline state over generic sync messaging', () => {
    expect(
      summarizeSyncStatus({
        coopCount: 1,
        runtimeHealth: {
          offline: true,
          missingPermission: false,
          syncError: false,
        },
      }),
    ).toEqual({
      syncState: 'Browser is offline. Shared sync will resume when the connection returns.',
      syncLabel: 'Offline',
      syncDetail: 'Browser is offline. Shared sync will resume when the connection returns.',
      syncTone: 'warning',
    });
  });
});
