import { describe, expect, it } from 'vitest';
import { sessionCapabilityChanged } from '../session-capability';

function makeCapability(overrides: Record<string, unknown> = {}) {
  return {
    status: 'active' as const,
    updatedAt: '2026-03-12T10:00:00.000Z',
    usedCount: 0,
    lastValidationFailure: undefined,
    statusDetail: 'Ready for use',
    revokedAt: undefined,
    lastUsedAt: undefined,
    moduleInstalledAt: undefined,
    enableSignature: undefined,
    permissionId: undefined,
    ...overrides,
  };
}

describe('sessionCapabilityChanged', () => {
  it('returns false when both capabilities are identical', () => {
    const a = makeCapability();
    const b = makeCapability();
    expect(sessionCapabilityChanged(a, b)).toBe(false);
  });

  it('detects a status change', () => {
    const a = makeCapability({ status: 'active' });
    const b = makeCapability({ status: 'revoked' });
    expect(sessionCapabilityChanged(a, b)).toBe(true);
  });

  it('detects an updatedAt change', () => {
    const a = makeCapability({ updatedAt: '2026-03-12T10:00:00.000Z' });
    const b = makeCapability({ updatedAt: '2026-03-12T11:00:00.000Z' });
    expect(sessionCapabilityChanged(a, b)).toBe(true);
  });

  it('detects a usedCount change', () => {
    const a = makeCapability({ usedCount: 0 });
    const b = makeCapability({ usedCount: 1 });
    expect(sessionCapabilityChanged(a, b)).toBe(true);
  });

  it('detects lastValidationFailure appearing', () => {
    const a = makeCapability({ lastValidationFailure: undefined });
    const b = makeCapability({ lastValidationFailure: 'expired' });
    expect(sessionCapabilityChanged(a, b)).toBe(true);
  });

  it('detects statusDetail change', () => {
    const a = makeCapability({ statusDetail: 'Ready for use' });
    const b = makeCapability({ statusDetail: 'Session exhausted' });
    expect(sessionCapabilityChanged(a, b)).toBe(true);
  });

  it('detects revokedAt appearing', () => {
    const a = makeCapability({ revokedAt: undefined });
    const b = makeCapability({ revokedAt: '2026-03-12T12:00:00.000Z' });
    expect(sessionCapabilityChanged(a, b)).toBe(true);
  });

  it('detects lastUsedAt change', () => {
    const a = makeCapability({ lastUsedAt: undefined });
    const b = makeCapability({ lastUsedAt: '2026-03-12T12:00:00.000Z' });
    expect(sessionCapabilityChanged(a, b)).toBe(true);
  });

  it('detects moduleInstalledAt change', () => {
    const a = makeCapability({ moduleInstalledAt: undefined });
    const b = makeCapability({ moduleInstalledAt: '2026-03-12T12:00:00.000Z' });
    expect(sessionCapabilityChanged(a, b)).toBe(true);
  });

  it('detects enableSignature change', () => {
    const a = makeCapability({ enableSignature: undefined });
    const b = makeCapability({ enableSignature: '0xabc123' });
    expect(sessionCapabilityChanged(a, b)).toBe(true);
  });

  it('detects permissionId change', () => {
    const a = makeCapability({ permissionId: undefined });
    const b = makeCapability({
      permissionId: '0x0000000000000000000000000000000000000000000000000000000000000001',
    });
    expect(sessionCapabilityChanged(a, b)).toBe(true);
  });

  it('treats undefined and null as equivalent for optional fields', () => {
    const base = makeCapability();
    const withNulls = {
      ...makeCapability(),
      lastValidationFailure: null as unknown as undefined,
      revokedAt: null as unknown as string | undefined,
      lastUsedAt: null as unknown as string | undefined,
      enableSignature: null as unknown as string | undefined,
      permissionId: null as unknown as string | undefined,
    };
    expect(sessionCapabilityChanged(base, withNulls)).toBe(false);
  });
});
