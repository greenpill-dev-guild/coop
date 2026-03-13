import { describe, expect, it } from 'vitest';
import type { ReceiverCapture } from '../../../contracts/schema';
import {
  isReceiverSyncRetryable,
  markReceiverCaptureSyncFailed,
  queueReceiverCaptureForRetry,
  receiverSyncRetryDelayMs,
  shouldAutoRetryReceiverCapture,
} from '../retry';

const baseCapture: ReceiverCapture = {
  id: 'capture-1',
  deviceId: 'device-1',
  pairingId: 'pairing-1',
  coopId: 'coop-1',
  coopDisplayName: 'River Coop',
  memberId: 'member-1',
  memberDisplayName: 'Mina',
  kind: 'file',
  title: 'field-note.txt',
  note: '',
  fileName: 'field-note.txt',
  mimeType: 'text/plain',
  byteSize: 64,
  createdAt: '2026-03-12T18:00:00.000Z',
  updatedAt: '2026-03-12T18:00:00.000Z',
  syncState: 'queued',
  retryCount: 0,
  intakeStatus: 'private-intake',
};

describe('receiver retry helpers', () => {
  it('marks transient failures with a retry window and allows automatic retry later', () => {
    const failedCapture = markReceiverCaptureSyncFailed(
      baseCapture,
      'Runtime transport timed out before completion.',
      '2026-03-12T18:10:00.000Z',
    );

    expect(failedCapture.syncState).toBe('failed');
    expect(failedCapture.retryCount).toBe(1);
    expect(failedCapture.nextRetryAt).toBe('2026-03-12T18:10:03.000Z');
    expect(isReceiverSyncRetryable(failedCapture.syncError)).toBe(true);
    expect(
      shouldAutoRetryReceiverCapture(failedCapture, Date.parse('2026-03-12T18:10:02.000Z')),
    ).toBe(false);
    expect(
      shouldAutoRetryReceiverCapture(failedCapture, Date.parse('2026-03-12T18:10:03.000Z')),
    ).toBe(true);

    const queuedCapture = queueReceiverCaptureForRetry(failedCapture, '2026-03-12T18:10:04.000Z');
    expect(queuedCapture.syncState).toBe('queued');
    expect(queuedCapture.syncError).toBeUndefined();
    expect(queuedCapture.nextRetryAt).toBeUndefined();
  });

  it('treats inactive or malformed failures as terminal and skips automatic retry', () => {
    const inactiveFailure = markReceiverCaptureSyncFailed(
      baseCapture,
      'This pairing is inactive.',
      '2026-03-12T18:20:00.000Z',
    );
    const malformedFailure = markReceiverCaptureSyncFailed(
      baseCapture,
      'Receiver payload is malformed.',
      '2026-03-12T18:20:00.000Z',
    );

    expect(isReceiverSyncRetryable(inactiveFailure.syncError)).toBe(false);
    expect(isReceiverSyncRetryable(malformedFailure.syncError)).toBe(false);
    expect(inactiveFailure.nextRetryAt).toBeUndefined();
    expect(malformedFailure.nextRetryAt).toBeUndefined();
    expect(shouldAutoRetryReceiverCapture(inactiveFailure)).toBe(false);
    expect(shouldAutoRetryReceiverCapture(malformedFailure)).toBe(false);
    expect(receiverSyncRetryDelayMs(8)).toBe(60_000);
  });
});
