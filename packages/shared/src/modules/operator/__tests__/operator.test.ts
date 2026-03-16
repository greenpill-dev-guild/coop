import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrivilegedActionLogEntry } from '../../../contracts/schema';
import {
  appendPrivilegedActionLog,
  createAnchorCapability,
  createPrivilegedActionLogEntry,
  describeAnchorCapabilityStatus,
  isAnchorCapabilityActive,
} from '../operator';

const ADDR_1 = '0x1111111111111111111111111111111111111111';
const ADDR_2 = '0x2222222222222222222222222222222222222222';
const ADDR_LOWER = '0xab3f6a89c9f73128d29c2c34f1e6b0e93e3e8d01';
const ADDR_CHECKSUMMED = '0xAb3F6A89c9F73128D29c2C34f1E6b0e93E3e8D01';
const FIXED_TIME = '2026-03-13T00:00:00.000Z';

describe('createAnchorCapability', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates with all fields populated', () => {
    const cap = createAnchorCapability({
      enabled: true,
      authSession: { displayName: 'Ari', primaryAddress: ADDR_1 },
      memberId: 'member-1',
      memberDisplayName: 'Ari',
      updatedAt: FIXED_TIME,
      nodeId: 'my-node',
    });

    expect(cap).toMatchObject({
      enabled: true,
      nodeId: 'my-node',
      updatedAt: FIXED_TIME,
      actorAddress: ADDR_1,
      actorDisplayName: 'Ari',
      memberId: 'member-1',
      memberDisplayName: 'Ari',
    });
  });

  it('creates with enabled=false', () => {
    const cap = createAnchorCapability({
      enabled: false,
      updatedAt: FIXED_TIME,
    });

    expect(cap.enabled).toBe(false);
  });

  it('creates with no authSession (undefined)', () => {
    const cap = createAnchorCapability({
      enabled: true,
      updatedAt: FIXED_TIME,
    });

    expect(cap.actorAddress).toBeUndefined();
    expect(cap.actorDisplayName).toBeUndefined();
  });

  it('creates with authSession explicitly null', () => {
    const cap = createAnchorCapability({
      enabled: true,
      authSession: null,
      updatedAt: FIXED_TIME,
    });

    expect(cap.actorAddress).toBeUndefined();
    expect(cap.actorDisplayName).toBeUndefined();
  });

  it('creates with no memberId', () => {
    const cap = createAnchorCapability({
      enabled: true,
      authSession: { displayName: 'Ari', primaryAddress: ADDR_1 },
      updatedAt: FIXED_TIME,
    });

    expect(cap.memberId).toBeUndefined();
    expect(cap.memberDisplayName).toBeUndefined();
    expect(cap.actorAddress).toBe(ADDR_1);
  });

  it('uses default nodeId "coop-extension" when not provided', () => {
    const cap = createAnchorCapability({
      enabled: true,
      updatedAt: FIXED_TIME,
    });

    expect(cap.nodeId).toBe('coop-extension');
  });

  it('uses provided nodeId when given', () => {
    const cap = createAnchorCapability({
      enabled: true,
      nodeId: 'custom-node',
      updatedAt: FIXED_TIME,
    });

    expect(cap.nodeId).toBe('custom-node');
  });

  it('uses current time when updatedAt not provided', () => {
    const cap = createAnchorCapability({ enabled: true });

    expect(cap.updatedAt).toBe('2026-03-14T12:00:00.000Z');
  });
});

describe('isAnchorCapabilityActive', () => {
  const activeCapability = createAnchorCapability({
    enabled: true,
    authSession: { displayName: 'Ari', primaryAddress: ADDR_1 },
    updatedAt: FIXED_TIME,
  });

  const disabledCapability = createAnchorCapability({
    enabled: false,
    authSession: { displayName: 'Ari', primaryAddress: ADDR_1 },
    updatedAt: FIXED_TIME,
  });

  const noAddressCapability = createAnchorCapability({
    enabled: true,
    updatedAt: FIXED_TIME,
  });

  it('returns false when capability is null', () => {
    expect(isAnchorCapabilityActive(null, { primaryAddress: ADDR_1 })).toBe(false);
  });

  it('returns false when capability is undefined', () => {
    expect(isAnchorCapabilityActive(undefined, { primaryAddress: ADDR_1 })).toBe(false);
  });

  it('returns false when capability is disabled', () => {
    expect(isAnchorCapabilityActive(disabledCapability, { primaryAddress: ADDR_1 })).toBe(false);
  });

  it('returns false when capability has no actorAddress', () => {
    expect(isAnchorCapabilityActive(noAddressCapability, { primaryAddress: ADDR_1 })).toBe(false);
  });

  it('returns false when authSession is null', () => {
    expect(isAnchorCapabilityActive(activeCapability, null)).toBe(false);
  });

  it('returns false when authSession is undefined', () => {
    expect(isAnchorCapabilityActive(activeCapability, undefined)).toBe(false);
  });

  it('returns true when addresses match', () => {
    expect(isAnchorCapabilityActive(activeCapability, { primaryAddress: ADDR_1 })).toBe(true);
  });

  it('returns false when addresses differ', () => {
    expect(isAnchorCapabilityActive(activeCapability, { primaryAddress: ADDR_2 })).toBe(false);
  });

  it('matches addresses case-insensitively (EIP-55 checksum vs lowercase)', () => {
    const capWithLower = createAnchorCapability({
      enabled: true,
      authSession: { displayName: 'Ari', primaryAddress: ADDR_LOWER },
      updatedAt: FIXED_TIME,
    });

    expect(isAnchorCapabilityActive(capWithLower, { primaryAddress: ADDR_CHECKSUMMED })).toBe(true);

    const capWithChecksum = createAnchorCapability({
      enabled: true,
      authSession: { displayName: 'Ari', primaryAddress: ADDR_CHECKSUMMED },
      updatedAt: FIXED_TIME,
    });

    expect(isAnchorCapabilityActive(capWithChecksum, { primaryAddress: ADDR_LOWER })).toBe(true);
  });
});

describe('describeAnchorCapabilityStatus', () => {
  it('returns disabled status when capability is null', () => {
    const status = describeAnchorCapabilityStatus({
      capability: null,
      authSession: { primaryAddress: ADDR_1 },
    });

    expect(status.enabled).toBe(false);
    expect(status.active).toBe(false);
    expect(status.detail).toContain('Anchor mode is off');
  });

  it('returns disabled status when capability is undefined', () => {
    const status = describeAnchorCapabilityStatus({
      capability: undefined,
    });

    expect(status.enabled).toBe(false);
    expect(status.active).toBe(false);
  });

  it('returns disabled status when capability.enabled is false', () => {
    const cap = createAnchorCapability({
      enabled: false,
      authSession: { displayName: 'Ari', primaryAddress: ADDR_1 },
      updatedAt: FIXED_TIME,
    });

    const status = describeAnchorCapabilityStatus({
      capability: cap,
      authSession: { primaryAddress: ADDR_1 },
    });

    expect(status.enabled).toBe(false);
    expect(status.active).toBe(false);
    expect(status.detail).toContain('Anchor mode is off');
  });

  it('returns active status when addresses match', () => {
    const cap = createAnchorCapability({
      enabled: true,
      authSession: { displayName: 'Ari', primaryAddress: ADDR_1 },
      updatedAt: FIXED_TIME,
    });

    const status = describeAnchorCapabilityStatus({
      capability: cap,
      authSession: { primaryAddress: ADDR_1 },
    });

    expect(status.enabled).toBe(true);
    expect(status.active).toBe(true);
    expect(status.detail).toContain('active for this authenticated member');
  });

  it('returns inactive status when addresses do not match (different session)', () => {
    const cap = createAnchorCapability({
      enabled: true,
      authSession: { displayName: 'Ari', primaryAddress: ADDR_1 },
      updatedAt: FIXED_TIME,
    });

    const status = describeAnchorCapabilityStatus({
      capability: cap,
      authSession: { primaryAddress: ADDR_2 },
    });

    expect(status.enabled).toBe(true);
    expect(status.active).toBe(false);
    expect(status.detail).toContain('different member session');
  });

  it('returns inactive when enabled but no actorAddress (no auth session at creation)', () => {
    const cap = createAnchorCapability({
      enabled: true,
      updatedAt: FIXED_TIME,
    });

    const status = describeAnchorCapabilityStatus({
      capability: cap,
      authSession: { primaryAddress: ADDR_1 },
    });

    expect(status.enabled).toBe(true);
    expect(status.active).toBe(false);
    expect(status.detail).toContain('different member session');
  });

  it('returns active with case-mismatched addresses', () => {
    const cap = createAnchorCapability({
      enabled: true,
      authSession: { displayName: 'Ari', primaryAddress: ADDR_LOWER },
      updatedAt: FIXED_TIME,
    });

    const status = describeAnchorCapabilityStatus({
      capability: cap,
      authSession: { primaryAddress: ADDR_CHECKSUMMED },
    });

    expect(status.enabled).toBe(true);
    expect(status.active).toBe(true);
    expect(status.detail).toContain('active for this authenticated member');
  });
});

describe('createPrivilegedActionLogEntry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates with required fields', () => {
    const entry = createPrivilegedActionLogEntry({
      actionType: 'archive-upload',
      status: 'attempted',
      detail: 'Attempting upload.',
      createdAt: FIXED_TIME,
    });

    expect(entry.id).toMatch(/^action-/);
    expect(entry.actionType).toBe('archive-upload');
    expect(entry.status).toBe('attempted');
    expect(entry.detail).toBe('Attempting upload.');
    expect(entry.createdAt).toBe(FIXED_TIME);
  });

  it('uses provided createdAt when given', () => {
    const entry = createPrivilegedActionLogEntry({
      actionType: 'safe-deployment',
      status: 'succeeded',
      detail: 'Safe deployed.',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(entry.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('uses current time when createdAt not provided', () => {
    const entry = createPrivilegedActionLogEntry({
      actionType: 'archive-upload',
      status: 'attempted',
      detail: 'Attempting upload.',
    });

    expect(entry.createdAt).toBe('2026-03-14T12:00:00.000Z');
  });

  it('includes context when provided', () => {
    const entry = createPrivilegedActionLogEntry({
      actionType: 'archive-upload',
      status: 'succeeded',
      detail: 'Upload complete.',
      createdAt: FIXED_TIME,
      context: {
        coopId: 'coop-123',
        coopName: 'Test Coop',
        actorAddress: ADDR_1,
      },
    });

    expect(entry.context).toMatchObject({
      coopId: 'coop-123',
      coopName: 'Test Coop',
      actorAddress: ADDR_1,
    });
  });

  it('uses empty context when not provided', () => {
    const entry = createPrivilegedActionLogEntry({
      actionType: 'archive-upload',
      status: 'attempted',
      detail: 'Attempting upload.',
      createdAt: FIXED_TIME,
    });

    expect(entry.context).toEqual({});
  });
});

describe('appendPrivilegedActionLog', () => {
  function makeEntry(createdAt: string, detail: string): PrivilegedActionLogEntry {
    return createPrivilegedActionLogEntry({
      actionType: 'archive-upload',
      status: 'attempted',
      detail,
      createdAt,
    });
  }

  it('appends and maintains reverse chronological order', () => {
    const older = makeEntry('2026-03-13T00:00:00.000Z', 'First');
    const newer = makeEntry('2026-03-13T01:00:00.000Z', 'Second');
    const newest = makeEntry('2026-03-13T02:00:00.000Z', 'Third');

    const log = appendPrivilegedActionLog([newer, older], newest);

    expect(log).toHaveLength(3);
    expect(log[0]?.detail).toBe('Third');
    expect(log[1]?.detail).toBe('Second');
    expect(log[2]?.detail).toBe('First');
  });

  it('trims to custom limit', () => {
    const e1 = makeEntry('2026-03-13T00:00:00.000Z', 'One');
    const e2 = makeEntry('2026-03-13T01:00:00.000Z', 'Two');
    const e3 = makeEntry('2026-03-13T02:00:00.000Z', 'Three');

    const log = appendPrivilegedActionLog([e1, e2], e3, 2);

    expect(log).toHaveLength(2);
    expect(log[0]?.detail).toBe('Three');
    expect(log[1]?.detail).toBe('Two');
  });

  it('uses default limit of 50', () => {
    const entries: PrivilegedActionLogEntry[] = [];
    for (let i = 0; i < 50; i++) {
      const minute = String(i).padStart(2, '0');
      entries.push(makeEntry(`2026-03-13T00:${minute}:00.000Z`, `Entry ${i}`));
    }
    const extra = makeEntry('2026-03-14T00:00:00.000Z', 'Entry 50');

    const log = appendPrivilegedActionLog(entries, extra);

    expect(log).toHaveLength(50);
    expect(log[0]?.detail).toBe('Entry 50');
  });

  it('works with empty initial array', () => {
    const entry = makeEntry('2026-03-13T00:00:00.000Z', 'First');

    const log = appendPrivilegedActionLog([], entry);

    expect(log).toHaveLength(1);
    expect(log[0]?.detail).toBe('First');
  });

  it('most recent entry appears first', () => {
    const older = makeEntry('2026-01-01T00:00:00.000Z', 'Old');
    const newer = makeEntry('2026-12-31T23:59:59.000Z', 'New');

    const log = appendPrivilegedActionLog([older], newer);

    expect(log[0]?.detail).toBe('New');
    expect(log[1]?.detail).toBe('Old');
  });

  it('does not mutate the original entries array', () => {
    const e1 = makeEntry('2026-03-13T00:00:00.000Z', 'One');
    const e2 = makeEntry('2026-03-13T01:00:00.000Z', 'Two');
    const original = [e1, e2];
    const originalCopy = [...original];

    appendPrivilegedActionLog(original, makeEntry('2026-03-13T02:00:00.000Z', 'Three'));

    expect(original).toEqual(originalCopy);
    expect(original).toHaveLength(2);
  });

  it('handles entries with identical timestamps', () => {
    const a = makeEntry('2026-03-13T00:00:00.000Z', 'A');
    const b = makeEntry('2026-03-13T00:00:00.000Z', 'B');

    const log = appendPrivilegedActionLog([a], b);

    expect(log).toHaveLength(2);
    expect(log.map((e) => e.detail)).toContain('A');
    expect(log.map((e) => e.detail)).toContain('B');
  });

  it('returns empty array when limit is 0', () => {
    const entry = makeEntry('2026-03-13T00:00:00.000Z', 'Only');

    const log = appendPrivilegedActionLog([], entry, 0);

    expect(log).toHaveLength(0);
  });

  it('keeps only newest entry when limit is 1', () => {
    const older = makeEntry('2026-03-13T00:00:00.000Z', 'Old');
    const newer = makeEntry('2026-03-13T01:00:00.000Z', 'New');

    const log = appendPrivilegedActionLog([older], newer, 1);

    expect(log).toHaveLength(1);
    expect(log[0]?.detail).toBe('New');
  });
});
