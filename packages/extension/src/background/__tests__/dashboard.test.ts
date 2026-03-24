import { describe, expect, it } from 'vitest';
import { describeActionIndicator, summarizeSyncStatus } from '../dashboard';

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
      syncLabel: 'Local',
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

  it('returns "No coop" when coopCount is zero', () => {
    const result = summarizeSyncStatus({
      coopCount: 0,
      runtimeHealth: {
        offline: false,
        missingPermission: false,
        syncError: false,
      },
    });
    expect(result.syncLabel).toBe('No coop');
    expect(result.syncTone).toBe('warning');
    expect(result.syncDetail).toMatch(/Create or join a coop/);
  });

  it('returns "Needs attention" for generic sync errors', () => {
    const result = summarizeSyncStatus({
      coopCount: 1,
      runtimeHealth: {
        offline: false,
        missingPermission: false,
        syncError: true,
        lastSyncError: 'WebRTC connection failed unexpectedly.',
      },
    });
    expect(result.syncLabel).toBe('Needs attention');
    expect(result.syncTone).toBe('error');
    expect(result.syncDetail).toBe('WebRTC connection failed unexpectedly.');
  });

  it('returns "Permission" error when sync error mentions permission', () => {
    const result = summarizeSyncStatus({
      coopCount: 1,
      runtimeHealth: {
        offline: false,
        missingPermission: false,
        syncError: true,
        lastSyncError: 'Missing permission to access storage.',
      },
    });
    expect(result.syncLabel).toBe('Permission');
    expect(result.syncTone).toBe('error');
  });

  it('returns "Syncing" with pending outbox count', () => {
    const result = summarizeSyncStatus({
      coopCount: 1,
      runtimeHealth: {
        offline: false,
        missingPermission: false,
        syncError: false,
      },
      pendingOutboxCount: 3,
    });
    expect(result.syncLabel).toBe('Syncing');
    expect(result.syncTone).toBe('ok');
    expect(result.syncDetail).toBe('3 changes pending sync.');
  });

  it('uses singular "change" for single pending outbox item', () => {
    const result = summarizeSyncStatus({
      coopCount: 1,
      runtimeHealth: {
        offline: false,
        missingPermission: false,
        syncError: false,
      },
      pendingOutboxCount: 1,
    });
    expect(result.syncDetail).toBe('1 change pending sync.');
  });

  it('defaults pendingOutboxCount to 0 when omitted', () => {
    const result = summarizeSyncStatus({
      coopCount: 1,
      runtimeHealth: {
        offline: false,
        missingPermission: false,
        syncError: false,
      },
    });
    expect(result.syncLabel).toBe('Healthy');
    expect(result.syncTone).toBe('ok');
  });

  it('uses lastCaptureError as detail when present and syncError is false', () => {
    const result = summarizeSyncStatus({
      coopCount: 1,
      runtimeHealth: {
        offline: false,
        missingPermission: false,
        syncError: false,
        lastCaptureError: 'Tab capture timed out.',
      },
    });
    // lastCaptureError triggers the error path only when syncError or lastCaptureError is truthy
    // syncError is false but lastCaptureError is truthy so the error branch fires
    expect(result.syncTone).toBe('error');
    expect(result.syncDetail).toBe('Tab capture timed out.');
  });

  it('prefers lastSyncError over lastCaptureError for syncDetail', () => {
    const result = summarizeSyncStatus({
      coopCount: 1,
      runtimeHealth: {
        offline: false,
        missingPermission: false,
        syncError: true,
        lastSyncError: 'Signaling handshake failed.',
        lastCaptureError: 'Tab capture timed out.',
      },
    });
    expect(result.syncDetail).toBe('Signaling handshake failed.');
  });

  it('falls back to generic detail when no sync/capture error messages', () => {
    const result = summarizeSyncStatus({
      coopCount: 1,
      runtimeHealth: {
        offline: false,
        missingPermission: false,
        syncError: true,
      },
    });
    expect(result.syncLabel).toBe('Needs attention');
    expect(result.syncDetail).toMatch(/Runtime needs attention/);
  });

  it('prioritizes no-coop over offline', () => {
    const result = summarizeSyncStatus({
      coopCount: 0,
      runtimeHealth: {
        offline: true,
        missingPermission: false,
        syncError: false,
      },
    });
    // coopCount === 0 is checked first
    expect(result.syncLabel).toBe('No coop');
  });

  it('prioritizes offline over sync errors', () => {
    const result = summarizeSyncStatus({
      coopCount: 1,
      runtimeHealth: {
        offline: true,
        missingPermission: false,
        syncError: true,
        lastSyncError: 'Something broke.',
      },
    });
    expect(result.syncLabel).toBe('Offline');
    expect(result.syncTone).toBe('warning');
  });

  it('shows attention count as badge text when items are pending', () => {
    const result = describeActionIndicator({
      iconState: 'attention',
      pendingAttentionCount: 5,
      syncDetail: 'Peer-ready local-first sync.',
    });
    expect(result.badgeText).toBe('5');
    expect(result.badgeColor).toBe('#fd8a01');
    expect(result.title).toBe('Coop: 5 waiting for review');
  });

  it('shows empty badge text for ready state', () => {
    const result = describeActionIndicator({
      iconState: 'ready',
      pendingAttentionCount: 0,
      syncDetail: 'Peer-ready local-first sync.',
    });
    expect(result.badgeText).toBe('');
    expect(result.title).toBe('Coop');
  });

  it('caps badge text at 99+ for large counts', () => {
    const result = describeActionIndicator({
      iconState: 'attention',
      pendingAttentionCount: 150,
      syncDetail: 'Peer-ready local-first sync.',
    });
    expect(result.badgeText).toBe('99+');
  });

  it('shows exact count at boundary value of 99', () => {
    const result = describeActionIndicator({
      iconState: 'attention',
      pendingAttentionCount: 99,
      syncDetail: 'Peer-ready local-first sync.',
    });
    expect(result.badgeText).toBe('99');
  });

  it('shows processing title for working state', () => {
    const result = describeActionIndicator({
      iconState: 'working',
      pendingAttentionCount: 0,
      syncDetail: 'Peer-ready local-first sync.',
    });
    expect(result.badgeText).toBe('');
    expect(result.badgeColor).toBe('#3b82f6');
    expect(result.title).toBe('Coop: Processing');
  });

  it('shows error detail for blocked state', () => {
    const result = describeActionIndicator({
      iconState: 'blocked',
      pendingAttentionCount: 0,
      syncDetail: 'Missing required permissions.',
    });
    expect(result.badgeText).toBe('');
    expect(result.badgeColor).toBe('#a63b20');
    expect(result.title).toBe('Coop: Missing required permissions.');
  });
});
