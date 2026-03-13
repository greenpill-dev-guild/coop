import { createAnchorCapability } from '@coop/shared';
import { describe, expect, it } from 'vitest';
import {
  describeArchiveLiveFailure,
  describePrivilegedFeatureAvailability,
  requireAnchorModeForFeature,
} from '../operator';

describe('operator runtime helpers', () => {
  const capability = createAnchorCapability({
    enabled: true,
    authSession: {
      displayName: 'Ari',
      primaryAddress: '0x1111111111111111111111111111111111111111',
    },
    memberId: 'member-1',
    memberDisplayName: 'Ari',
    updatedAt: '2026-03-13T00:00:00.000Z',
  });

  it('gates live onchain and archive actions behind anchor mode', () => {
    expect(() =>
      requireAnchorModeForFeature({
        capability: null,
        authSession: {
          primaryAddress: '0x1111111111111111111111111111111111111111',
        },
        feature: 'live archive uploads',
      }),
    ).toThrow('Anchor mode is off');

    expect(() =>
      requireAnchorModeForFeature({
        capability,
        authSession: {
          primaryAddress: '0x2222222222222222222222222222222222222222',
        },
        feature: 'live Safe deployments',
      }),
    ).toThrow('Anchor mode is inactive');

    expect(() =>
      requireAnchorModeForFeature({
        capability,
        authSession: {
          primaryAddress: '0x1111111111111111111111111111111111111111',
        },
        feature: 'archive follow-up jobs',
      }),
    ).not.toThrow();
  });

  it('describes live feature availability without hiding mock mode', () => {
    expect(
      describePrivilegedFeatureAvailability({
        mode: 'mock',
        capability: null,
        authSession: null,
        liveLabel: 'archive uploads',
      }).detail,
    ).toContain('Mock');
    expect(
      describePrivilegedFeatureAvailability({
        mode: 'live',
        capability: null,
        authSession: null,
        liveLabel: 'archive uploads',
      }).detail,
    ).toContain('unavailable because anchor mode is off');
  });

  it('maps live archive failure states to operator-friendly errors', () => {
    expect(describeArchiveLiveFailure(new Error('Archive issuer is unavailable.'))).toBe(
      'Archive issuer unavailable or delegation rejected.',
    );
    expect(
      describeArchiveLiveFailure(new Error('Issuer returned malformed delegation material.')),
    ).toBe('Archive issuer returned malformed delegation material.');
    expect(describeArchiveLiveFailure(new Error('upload failed with 500 from Storacha'))).toBe(
      'Archive upload failed after delegation was issued.',
    );
  });
});
