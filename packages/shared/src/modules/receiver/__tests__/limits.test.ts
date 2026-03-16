import { describe, expect, it } from 'vitest';
import type { ReceiverCaptureKind } from '../../../contracts/schema';
import {
  RECEIVER_CAPTURE_BYTE_LIMITS,
  assertReceiverCaptureSize,
  assertReceiverEnvelopeAssetSize,
  estimateBase64ByteSize,
  maxBase64LengthForBytes,
} from '../limits';

describe('assertReceiverCaptureSize', () => {
  it.each<ReceiverCaptureKind>(['audio', 'photo', 'file', 'link'])(
    'throws for oversized %s captures',
    (kind) => {
      const limit = RECEIVER_CAPTURE_BYTE_LIMITS[kind];
      expect(() => assertReceiverCaptureSize(kind, limit + 1)).toThrow(/must stay under/);
    },
  );

  it.each<ReceiverCaptureKind>(['audio', 'photo', 'file', 'link'])(
    'passes for %s captures at or under the limit',
    (kind) => {
      const limit = RECEIVER_CAPTURE_BYTE_LIMITS[kind];
      expect(() => assertReceiverCaptureSize(kind, limit)).not.toThrow();
      expect(() => assertReceiverCaptureSize(kind, limit - 1)).not.toThrow();
    },
  );

  it('includes the formatted byte limit in the error message', () => {
    expect(() => assertReceiverCaptureSize('audio', 20 * 1024 * 1024)).toThrow(/12 MB/);
    expect(() => assertReceiverCaptureSize('link', 2 * 1024 * 1024)).toThrow(/1 MB/);
  });
});

describe('assertReceiverEnvelopeAssetSize', () => {
  it('includes the full capitalized kind name in error messages', () => {
    // file limit is 8MB, so 12M base64 chars exceeds it
    const oversizedForFile = 'A'.repeat(12_000_000);
    // audio limit is 12MB, so 18M base64 chars exceeds it
    const oversizedForAudio = 'A'.repeat(18_000_000);

    expect(() => assertReceiverEnvelopeAssetSize('file', oversizedForFile)).toThrow(
      /^File sync payloads/,
    );

    expect(() => assertReceiverEnvelopeAssetSize('audio', oversizedForAudio)).toThrow(
      /^Audio sync payloads/,
    );

    expect(() => assertReceiverEnvelopeAssetSize('photo', oversizedForFile)).toThrow(
      /^Photo sync payloads/,
    );
  });

  it('does not throw for payloads within the limit', () => {
    const smallPayload = btoa('hello world');
    expect(() => assertReceiverEnvelopeAssetSize('link', smallPayload)).not.toThrow();
    expect(() => assertReceiverEnvelopeAssetSize('audio', smallPayload)).not.toThrow();
  });
});

describe('estimateBase64ByteSize', () => {
  it('returns correct byte estimate for a known base64 string', () => {
    // btoa('hello') = 'aGVsbG8=' -> strip padding -> 'aGVsbG8' (7 chars)
    // 7 * 3 / 4 = 5.25 -> floor -> 5 bytes (matches 'hello'.length)
    expect(estimateBase64ByteSize(btoa('hello'))).toBe(5);
  });

  it('returns 0 for an empty string', () => {
    expect(estimateBase64ByteSize('')).toBe(0);
  });

  it('strips trailing padding before computing', () => {
    const withPadding = btoa('ab'); // 'YWI=' has padding
    expect(withPadding).toContain('=');
    expect(estimateBase64ByteSize(withPadding)).toBe(2);
  });

  it('handles strings without padding', () => {
    const noPadding = btoa('abc'); // 'YWJj' has no padding
    expect(noPadding).not.toContain('=');
    expect(estimateBase64ByteSize(noPadding)).toBe(3);
  });
});

describe('maxBase64LengthForBytes', () => {
  it('returns exact base64 length for multiples of 3', () => {
    expect(maxBase64LengthForBytes(3)).toBe(4);
    expect(maxBase64LengthForBytes(6)).toBe(8);
    expect(maxBase64LengthForBytes(9)).toBe(12);
  });

  it('rounds up for non-multiple-of-3 byte sizes', () => {
    // 1 byte -> ceil(1/3) * 4 = 4
    expect(maxBase64LengthForBytes(1)).toBe(4);
    // 4 bytes -> ceil(4/3) * 4 = 8
    expect(maxBase64LengthForBytes(4)).toBe(8);
    // 5 bytes -> ceil(5/3) * 4 = 8
    expect(maxBase64LengthForBytes(5)).toBe(8);
  });

  it('returns 0 for 0 bytes', () => {
    expect(maxBase64LengthForBytes(0)).toBe(0);
  });
});
