import type { ReceiverCapture } from '../../contracts/schema';
import { nowIso } from '../../utils';

const retryableErrorPatterns = [
  /network/i,
  /offline/i,
  /timed out/i,
  /before completion/i,
  /extension bridge sync failed/i,
  /runtime/i,
  /transport/i,
];

const terminalErrorPatterns = [
  /malformed/i,
  /invalid/i,
  /integrity/i,
  /does not match/i,
  /expired/i,
  /inactive/i,
  /no usable signaling/i,
  /not queued/i,
  /unknown to this extension/i,
  /conflicts with an existing intake item/i,
  /older pairing/i,
];

export function isReceiverSyncRetryable(errorMessage?: string) {
  if (!errorMessage) {
    return true;
  }

  if (terminalErrorPatterns.some((pattern) => pattern.test(errorMessage))) {
    return false;
  }

  if (retryableErrorPatterns.some((pattern) => pattern.test(errorMessage))) {
    return true;
  }

  return true;
}

export function receiverSyncRetryDelayMs(retryCount = 0) {
  return Math.min(60_000, 1_500 * 2 ** Math.max(0, retryCount));
}

export function markReceiverCaptureSyncFailed(
  capture: ReceiverCapture,
  errorMessage: string,
  attemptedAt = nowIso(),
) {
  const nextRetryCount = (capture.retryCount ?? 0) + 1;
  const retryable = isReceiverSyncRetryable(errorMessage);

  return {
    ...capture,
    syncState: 'failed' as const,
    syncError: errorMessage,
    lastSyncAttemptAt: attemptedAt,
    nextRetryAt: retryable
      ? new Date(
          Date.parse(attemptedAt) + receiverSyncRetryDelayMs((capture.retryCount ?? 0) + 1),
        ).toISOString()
      : undefined,
    retryCount: nextRetryCount,
    updatedAt: attemptedAt,
  };
}

export function queueReceiverCaptureForRetry(capture: ReceiverCapture, queuedAt = nowIso()) {
  return {
    ...capture,
    syncState: 'queued' as const,
    syncError: undefined,
    nextRetryAt: undefined,
    updatedAt: queuedAt,
  };
}

export function shouldAutoRetryReceiverCapture(capture: ReceiverCapture, nowMs = Date.now()) {
  if (capture.syncState !== 'failed') {
    return false;
  }

  if (!isReceiverSyncRetryable(capture.syncError)) {
    return false;
  }

  if (!capture.nextRetryAt) {
    return true;
  }

  return Date.parse(capture.nextRetryAt) <= nowMs;
}
