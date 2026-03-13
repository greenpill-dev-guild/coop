import { describe, expect, it } from 'vitest';
import {
  appendPrivilegedActionLog,
  createAnchorCapability,
  createPrivilegedActionLogEntry,
  describeAnchorCapabilityStatus,
  isAnchorCapabilityActive,
} from '../operator';

describe('operator helpers', () => {
  it('treats anchor mode as active only for the matching authenticated member', () => {
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

    expect(
      isAnchorCapabilityActive(capability, {
        primaryAddress: '0x1111111111111111111111111111111111111111',
      }),
    ).toBe(true);
    expect(
      isAnchorCapabilityActive(capability, {
        primaryAddress: '0x2222222222222222222222222222222222222222',
      }),
    ).toBe(false);
    expect(
      describeAnchorCapabilityStatus({
        capability,
        authSession: {
          primaryAddress: '0x2222222222222222222222222222222222222222',
        },
      }).detail,
    ).toContain('different member session');
  });

  it('creates and trims privileged action log entries in reverse chronological order', () => {
    const first = createPrivilegedActionLogEntry({
      actionType: 'archive-upload',
      status: 'attempted',
      detail: 'Attempting live archive upload.',
      createdAt: '2026-03-13T00:00:00.000Z',
    });
    const second = createPrivilegedActionLogEntry({
      actionType: 'archive-upload',
      status: 'succeeded',
      detail: 'Live archive upload completed.',
      createdAt: '2026-03-13T00:01:00.000Z',
    });

    const next = appendPrivilegedActionLog([first], second, 1);

    expect(next).toHaveLength(1);
    expect(next[0]?.detail).toBe('Live archive upload completed.');
  });
});
