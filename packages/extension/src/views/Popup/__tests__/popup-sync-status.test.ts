import { beforeEach, describe, expect, it, vi } from 'vitest';

let popupHealthStatus: typeof import('../helpers').popupHealthStatus;
let popupReviewStatus: typeof import('../helpers').popupReviewStatus;
let popupSyncStatus: typeof import('../helpers').popupSyncStatus;

beforeEach(async () => {
  vi.resetModules();
  vi.doUnmock('../helpers');
  ({ popupHealthStatus, popupReviewStatus, popupSyncStatus } = await import('../helpers'));
});

describe('popupSyncStatus', () => {
  it('defaults to checking while sync summary is still loading', () => {
    expect(popupSyncStatus({})).toEqual({
      label: 'Idle',
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

  it('maps offline sync to local-only visible state without making it look broken', () => {
    expect(
      popupSyncStatus({
        syncLabel: 'Offline',
        syncTone: 'warning',
        syncDetail: 'Browser is offline. Shared sync will resume when the connection returns.',
      }),
    ).toEqual({
      label: 'Local',
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

  it('compresses permission errors into the generic sync error token', () => {
    expect(
      popupSyncStatus({
        syncLabel: 'Permission',
        syncTone: 'error',
        syncDetail: 'Required extension permissions are missing.',
      }),
    ).toEqual({
      label: 'Error',
      detail: 'Required extension permissions are missing.',
      tone: 'error',
    });
  });

  it('shows signaling-ready states as idle in the compact row', () => {
    expect(
      popupSyncStatus({
        syncLabel: 'Healthy',
        syncTone: 'ok',
        syncDetail: 'Signaling connected. Ready when another peer joins.',
      }),
    ).toEqual({
      label: 'Idle',
      detail: 'Signaling connected. Ready when another peer joins.',
      tone: 'ok',
    });
  });

  it('shows peer-connected states as live in the compact row', () => {
    expect(
      popupSyncStatus({
        syncLabel: 'Healthy',
        syncTone: 'ok',
        syncDetail: 'Connected to 2 peers.',
      }),
    ).toEqual({
      label: 'Live',
      detail: 'Connected to 2 peers.',
      tone: 'ok',
    });
  });
});

describe('popupSyncStatus structured sync path', () => {
  it('prefers structured sync over string-based status when sync object is present', () => {
    expect(
      popupSyncStatus({
        syncLabel: 'Healthy',
        syncTone: 'ok',
        syncDetail: 'Peer-ready local-first sync.',
        sync: {
          label: 'Connected',
          detail: 'Live sync with 2 peers.',
          tone: 'ok',
          peerCount: 2,
          websocketConnected: false,
          mode: 'webrtc',
        },
      }),
    ).toEqual({
      label: 'Connected',
      detail: 'Live sync with 2 peers.',
      tone: 'ok',
    });
  });

  it('maps Bridge label to Connected in UI display', () => {
    expect(
      popupSyncStatus({
        syncLabel: 'Healthy',
        syncTone: 'ok',
        syncDetail: 'Peer-ready local-first sync.',
        sync: {
          label: 'Bridge',
          detail: 'WebSocket sync connected. No direct peers.',
          tone: 'ok',
          peerCount: 0,
          websocketConnected: true,
          mode: 'websocket-only',
        },
      }),
    ).toEqual({
      label: 'Connected',
      detail: 'WebSocket sync connected. No direct peers.',
      tone: 'ok',
    });
  });

  it('falls back to string-based logic when sync is undefined', () => {
    expect(
      popupSyncStatus({
        syncLabel: 'Healthy',
        syncTone: 'ok',
        syncDetail: 'Connected to 2 peers.',
      }),
    ).toEqual({
      label: 'Live',
      detail: 'Connected to 2 peers.',
      tone: 'ok',
    });
  });

  it('surfaces structured sync error state', () => {
    expect(
      popupSyncStatus({
        syncLabel: 'Healthy',
        syncTone: 'ok',
        syncDetail: 'Peer-ready local-first sync.',
        sync: {
          label: 'Error',
          detail: 'WebRTC signaling handshake failed',
          tone: 'error',
          peerCount: 0,
          websocketConnected: false,
          mode: 'local-only',
        },
      }),
    ).toEqual({
      label: 'Error',
      detail: 'WebRTC signaling handshake failed',
      tone: 'error',
    });
  });

  it('shows Local label for inactive structured sync', () => {
    expect(
      popupSyncStatus({
        syncLabel: 'Healthy',
        syncTone: 'ok',
        syncDetail: 'Peer-ready local-first sync.',
        sync: {
          label: 'Local',
          detail: 'Sync not active.',
          tone: 'warning',
          peerCount: 0,
          websocketConnected: false,
          mode: 'inactive',
        },
      }),
    ).toEqual({
      label: 'Local',
      detail: 'Sync not active.',
      tone: 'warning',
    });
  });
});

describe('popupReviewStatus', () => {
  it('counts only review-queue items and appends pending action context separately', () => {
    expect(
      popupReviewStatus({
        pendingDrafts: 2,
        routedTabs: 3,
        staleObservationCount: 1,
        pendingActions: 4,
      }),
    ).toEqual({
      label: 'Review',
      value: '6',
      count: 6,
      tone: 'warning',
      detail:
        '6 waiting for review: 2 drafts, 3 signals, 1 stale observation. 4 operator actions are still waiting in Nest.',
    });
  });

  it('stays calm when the review queue is empty but actions remain elsewhere', () => {
    expect(
      popupReviewStatus({
        pendingDrafts: 0,
        routedTabs: 0,
        staleObservationCount: 0,
        pendingActions: 1,
      }),
    ).toEqual({
      label: 'Review',
      value: '0',
      count: 0,
      tone: 'ok',
      detail: 'Nothing is waiting for review. 1 operator action is still waiting in Nest.',
    });
  });
});

describe('popupHealthStatus', () => {
  it('treats permission problems as true blockers', () => {
    expect(
      popupHealthStatus({
        syncStatus: {
          label: 'Error',
          detail:
            'Required extension permissions are missing. Check Coop site access and extension permissions.',
          tone: 'error',
        },
        captureAccessStatus: {
          label: 'This site',
          detail: 'Coop already has site access here.',
          tone: 'ok',
        },
      }),
    ).toEqual({
      label: 'Blocked',
      detail:
        'Required extension permissions are missing. Check Coop site access and extension permissions.',
      tone: 'error',
    });
  });

  it('stays ready when sync is local-only but capture still works', () => {
    expect(
      popupHealthStatus({
        syncStatus: {
          label: 'Local',
          detail:
            'No signaling server connection. Shared sync is currently limited to this browser profile.',
          tone: 'warning',
        },
        captureAccessStatus: {
          label: 'On demand',
          detail:
            'Capture this tab still works from the popup. Coop will ask for broader roundup access only when needed.',
          tone: 'ok',
        },
      }),
    ).toEqual({
      label: 'Ask',
      detail:
        'Capture this tab still works from the popup. Coop will ask for broader roundup access only when needed.',
      tone: 'ok',
    });
  });
});
