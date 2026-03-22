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
