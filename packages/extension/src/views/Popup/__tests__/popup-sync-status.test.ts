import { describe, expect, it } from 'vitest';
import { popupSyncStatus } from '../helpers';

describe('popupSyncStatus', () => {
  it('defaults to checking while sync summary is still loading', () => {
    expect(popupSyncStatus({})).toEqual({
      label: 'Checking',
      detail: 'Checking sync status.',
      tone: 'ok',
    });
  });

  it('maps signaling-only degradation to a local warning badge', () => {
    expect(
      popupSyncStatus({
        syncLabel: 'Healthy',
        syncTone: 'warning',
        syncDetail:
          'No signaling server connection. Shared sync is currently limited to this browser profile.',
      }),
    ).toEqual({
      label: 'Local',
      detail:
        'No signaling server connection. Shared sync is currently limited to this browser profile.',
      tone: 'warning',
    });
  });

  it('preserves explicit offline warnings', () => {
    expect(
      popupSyncStatus({
        syncLabel: 'Offline',
        syncTone: 'warning',
        syncDetail: 'Browser is offline. Shared sync will resume when the connection returns.',
      }),
    ).toEqual({
      label: 'Offline',
      detail: 'Browser is offline. Shared sync will resume when the connection returns.',
      tone: 'warning',
    });
  });

  it('surfaces dashboard errors as blocking error state', () => {
    expect(
      popupSyncStatus({
        syncLabel: 'Needs attention',
        syncTone: 'error',
        syncDetail: 'WebRTC connection failed unexpectedly.',
      }),
    ).toEqual({
      label: 'Error',
      detail: 'WebRTC connection failed unexpectedly.',
      tone: 'error',
    });
  });

  it('normalizes healthy states to a healthy badge', () => {
    expect(
      popupSyncStatus({
        syncLabel: 'Healthy',
        syncTone: 'ok',
        syncDetail: 'Peer-ready local-first sync.',
      }),
    ).toEqual({
      label: 'Healthy',
      detail: 'Peer-ready local-first sync.',
      tone: 'ok',
    });
  });
});
