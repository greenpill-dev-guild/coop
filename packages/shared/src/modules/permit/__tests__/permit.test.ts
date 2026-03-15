import { describe, expect, it } from 'vitest';
import type { ExecutionPermit, PermitLogEventType } from '../../../contracts/schema';
import { createReplayGuard, recordExecutedReplayId } from '../../policy/replay';
import { validatePermitForExecution } from '../enforcement';
import { appendPermitLog, createPermitLogEntry, formatPermitLogEventLabel } from '../log';
import {
  computePermitStatus,
  createExecutionPermit,
  formatDelegatedActionLabel,
  formatPermitStatusLabel,
  incrementPermitUsage,
  isPermitUsable,
  refreshPermitStatus,
  revokePermit,
} from '../permit';

const FIXED_NOW = '2026-03-12T00:00:00.000Z';
const FUTURE = '2026-03-14T00:00:00.000Z';
const PAST = '2026-03-10T00:00:00.000Z';

function makePermit(overrides: Partial<ExecutionPermit> = {}): ExecutionPermit {
  return createExecutionPermit({
    coopId: overrides.coopId ?? 'coop-1',
    issuedBy: overrides.issuedBy ?? {
      memberId: 'member-1',
      displayName: 'Alice',
    },
    executor: overrides.executor ?? { label: 'inference-bridge' },
    expiresAt: overrides.expiresAt ?? FUTURE,
    maxUses: overrides.maxUses ?? 10,
    allowedActions: overrides.allowedActions ?? ['archive-artifact'],
    targetAllowlist: overrides.targetAllowlist,
    policyRef: overrides.policyRef,
    createdAt: overrides.createdAt ?? FIXED_NOW,
  });
}

describe('permit lifecycle', () => {
  it('createExecutionPermit creates a valid permit with correct defaults', () => {
    const permit = makePermit();

    expect(permit.id).toMatch(/^permit-/);
    expect(permit.coopId).toBe('coop-1');
    expect(permit.issuedBy).toEqual({ memberId: 'member-1', displayName: 'Alice' });
    expect(permit.executor).toEqual({ label: 'inference-bridge' });
    expect(permit.createdAt).toBe(FIXED_NOW);
    expect(permit.expiresAt).toBe(FUTURE);
    expect(permit.maxUses).toBe(10);
    expect(permit.usedCount).toBe(0);
    expect(permit.allowedActions).toEqual(['archive-artifact']);
    expect(permit.status).toBe('active');
    expect(permit.revokedAt).toBeUndefined();
    expect(permit.targetAllowlist).toBeUndefined();
    expect(permit.policyRef).toBeUndefined();
  });

  it('revokePermit sets revokedAt and status to revoked', () => {
    const permit = makePermit();
    const revoked = revokePermit(permit, FIXED_NOW);

    expect(revoked.revokedAt).toBe(FIXED_NOW);
    expect(revoked.status).toBe('revoked');
    expect(revoked.id).toBe(permit.id);
  });

  it('computePermitStatus returns active for valid permit', () => {
    const permit = makePermit();
    expect(computePermitStatus(permit, FIXED_NOW)).toBe('active');
  });

  it('computePermitStatus returns expired when past expiresAt', () => {
    const permit = makePermit({ expiresAt: PAST });
    expect(computePermitStatus(permit, FIXED_NOW)).toBe('expired');
  });

  it('computePermitStatus returns revoked when revokedAt is set', () => {
    const permit = makePermit();
    const revoked = revokePermit(permit, FIXED_NOW);
    expect(computePermitStatus(revoked, FIXED_NOW)).toBe('revoked');
  });

  it('computePermitStatus returns exhausted when usedCount >= maxUses', () => {
    const permit = makePermit({ maxUses: 1 });
    const used = incrementPermitUsage(permit);
    expect(computePermitStatus(used, FIXED_NOW)).toBe('exhausted');
  });

  it('refreshPermitStatus updates the status field', () => {
    const permit = makePermit({ expiresAt: PAST });
    // The permit was created with status 'active' but its expiresAt is in the past
    expect(permit.status).toBe('active');
    const refreshed = refreshPermitStatus(permit, FIXED_NOW);
    expect(refreshed.status).toBe('expired');
  });

  it('incrementPermitUsage increments usedCount', () => {
    const permit = makePermit({ maxUses: 5 });
    const used = incrementPermitUsage(permit);
    expect(used.usedCount).toBe(1);
    expect(used.status).toBe('active');
  });

  it('incrementPermitUsage sets status to exhausted when limit reached', () => {
    const permit = makePermit({ maxUses: 1 });
    const used = incrementPermitUsage(permit);
    expect(used.usedCount).toBe(1);
    expect(used.status).toBe('exhausted');
  });

  it('isPermitUsable returns true for active permit', () => {
    const permit = makePermit();
    expect(isPermitUsable(permit, FIXED_NOW)).toBe(true);
  });

  it('isPermitUsable returns false for expired permit', () => {
    const permit = makePermit({ expiresAt: PAST });
    expect(isPermitUsable(permit, FIXED_NOW)).toBe(false);
  });

  it('isPermitUsable returns false for revoked permit', () => {
    const permit = revokePermit(makePermit(), FIXED_NOW);
    expect(isPermitUsable(permit, FIXED_NOW)).toBe(false);
  });

  it('isPermitUsable returns false for exhausted permit', () => {
    const permit = incrementPermitUsage(makePermit({ maxUses: 1 }));
    expect(isPermitUsable(permit, FIXED_NOW)).toBe(false);
  });

  it('formatPermitStatusLabel returns correct labels', () => {
    expect(formatPermitStatusLabel('active')).toBe('Active');
    expect(formatPermitStatusLabel('expired')).toBe('Expired');
    expect(formatPermitStatusLabel('revoked')).toBe('Revoked');
    expect(formatPermitStatusLabel('exhausted')).toBe('Exhausted');
  });

  it('formatDelegatedActionLabel returns correct labels', () => {
    expect(formatDelegatedActionLabel('archive-artifact')).toBe('Archive artifact');
    expect(formatDelegatedActionLabel('archive-snapshot')).toBe('Archive snapshot');
    expect(formatDelegatedActionLabel('refresh-archive-status')).toBe('Refresh archive status');
    expect(formatDelegatedActionLabel('publish-ready-draft')).toBe('Publish ready draft');
  });
});

describe('permit enforcement', () => {
  function validInput(permit: ExecutionPermit) {
    return {
      permit,
      actionClass: permit.allowedActions[0],
      coopId: permit.coopId,
      replayId: 'replay-unique-1',
      replayGuard: createReplayGuard(),
      executor: permit.executor,
      now: FIXED_NOW,
    } as const;
  }

  it('passes for valid permit', () => {
    const permit = makePermit();
    const result = validatePermitForExecution(validInput(permit));
    expect(result.ok).toBe(true);
  });

  it('rejects revoked permit', () => {
    const permit = revokePermit(makePermit(), FIXED_NOW);
    const result = validatePermitForExecution(validInput(permit));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejectType).toBe('revoked');
      expect(result.reason).toContain('revoked');
    }
  });

  it('rejects expired permit', () => {
    const permit = makePermit({ expiresAt: PAST });
    const result = validatePermitForExecution(validInput(permit));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejectType).toBe('expired');
      expect(result.reason).toContain('expired');
    }
  });

  it('rejects exhausted permit', () => {
    const permit = incrementPermitUsage(makePermit({ maxUses: 1 }));
    const result = validatePermitForExecution(validInput(permit));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejectType).toBe('exhausted');
      expect(result.reason).toContain('usage limit');
    }
  });

  it('rejects wrong coop', () => {
    const permit = makePermit();
    const result = validatePermitForExecution({
      ...validInput(permit),
      coopId: 'coop-wrong',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejectType).toBe('coop-denied');
      expect(result.reason).toContain('not scoped');
    }
  });

  it('rejects disallowed action', () => {
    const permit = makePermit({ allowedActions: ['archive-artifact'] });
    const result = validatePermitForExecution({
      ...validInput(permit),
      actionClass: 'archive-snapshot',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejectType).toBe('action-denied');
      expect(result.reason).toContain('archive-snapshot');
    }
  });

  it('rejects target not in allowlist', () => {
    const permit = makePermit({
      allowedActions: ['archive-artifact'],
      targetAllowlist: { 'archive-artifact': ['target-a', 'target-b'] },
    });
    const result = validatePermitForExecution({
      ...validInput(permit),
      targetIds: ['target-unknown'],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejectType).toBe('target-denied');
      expect(result.reason).toContain('target-unknown');
    }
  });

  it('allows target when no allowlist set', () => {
    const permit = makePermit();
    const result = validatePermitForExecution({
      ...validInput(permit),
      targetIds: ['any-target'],
    });

    expect(result.ok).toBe(true);
  });

  it('allows target when target is in allowlist', () => {
    const permit = makePermit({
      allowedActions: ['archive-artifact'],
      targetAllowlist: { 'archive-artifact': ['target-a', 'target-b'] },
    });
    const result = validatePermitForExecution({
      ...validInput(permit),
      targetIds: ['target-a'],
    });

    expect(result.ok).toBe(true);
  });

  it('rejects targets when the permit has no allowlist entry for the action', () => {
    const permit = makePermit({
      allowedActions: ['publish-ready-draft'],
      targetAllowlist: { 'archive-artifact': ['target-a'] },
    });
    const result = validatePermitForExecution({
      ...validInput(permit),
      actionClass: 'publish-ready-draft',
      targetIds: ['draft-1', 'coop-1'],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejectType).toBe('target-denied');
      expect(result.reason).toContain('draft-1');
    }
  });

  it('rejects executor mismatch when a different runtime tries to use the permit', () => {
    const permit = makePermit({
      executor: { label: 'operator-console', localIdentityId: 'identity-passkey-1' },
    });
    const result = validatePermitForExecution({
      ...validInput(permit),
      executor: { label: 'operator-console', localIdentityId: 'identity-passkey-2' },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejectType).toBe('executor-denied');
      expect(result.reason).toContain('different local passkey identity');
    }
  });

  it('rejects delegated publish when any target falls outside the allowlist', () => {
    const permit = makePermit({
      allowedActions: ['publish-ready-draft'],
      targetAllowlist: { 'publish-ready-draft': ['draft-1', 'coop-1'] },
    });
    const result = validatePermitForExecution({
      ...validInput(permit),
      actionClass: 'publish-ready-draft',
      targetIds: ['draft-1', 'coop-1', 'coop-2'],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejectType).toBe('target-denied');
      expect(result.reason).toContain('coop-2');
    }
  });

  it('rejects replay ID', () => {
    const permit = makePermit();
    const guard = recordExecutedReplayId(createReplayGuard(), 'replay-used');
    const result = validatePermitForExecution({
      ...validInput(permit),
      replayId: 'replay-used',
      replayGuard: guard,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejectType).toBe('replay-rejected');
      expect(result.reason).toContain('replay-used');
    }
  });

  it('rejects blank replay IDs', () => {
    const permit = makePermit();
    const result = validatePermitForExecution({
      ...validInput(permit),
      replayId: '   ',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejectType).toBe('replay-rejected');
      expect(result.reason).toContain('Replay ID is required');
    }
  });
});

describe('permit audit logging', () => {
  it('createPermitLogEntry creates valid entry', () => {
    const entry = createPermitLogEntry({
      permitId: 'permit-1',
      eventType: 'delegated-execution-succeeded',
      detail: 'Archived artifact successfully',
      actionClass: 'archive-artifact',
      coopId: 'coop-1',
      replayId: 'replay-1',
      createdAt: FIXED_NOW,
    });

    expect(entry.id).toMatch(/^plog-/);
    expect(entry.permitId).toBe('permit-1');
    expect(entry.eventType).toBe('delegated-execution-succeeded');
    expect(entry.detail).toBe('Archived artifact successfully');
    expect(entry.actionClass).toBe('archive-artifact');
    expect(entry.coopId).toBe('coop-1');
    expect(entry.replayId).toBe('replay-1');
    expect(entry.createdAt).toBe(FIXED_NOW);
  });

  it('appendPermitLog prepends and limits', () => {
    const existing = Array.from({ length: 5 }, (_, i) =>
      createPermitLogEntry({
        permitId: 'permit-1',
        eventType: 'delegated-execution-succeeded',
        detail: `Entry ${i}`,
        createdAt: `2026-03-0${i + 1}T00:00:00.000Z`,
      }),
    );

    const newEntry = createPermitLogEntry({
      permitId: 'permit-1',
      eventType: 'permit-revoked',
      detail: 'Revoked by admin',
      createdAt: FIXED_NOW,
    });

    const result = appendPermitLog(existing, newEntry, 4);

    expect(result).toHaveLength(4);
    // Most recent first (FIXED_NOW = 2026-03-12, then 2026-03-05, 2026-03-04, 2026-03-03)
    expect(result[0].createdAt).toBe(FIXED_NOW);
    expect(result[0].eventType).toBe('permit-revoked');
  });

  it('formatPermitLogEventLabel returns correct labels for all event types', () => {
    const expected: Record<PermitLogEventType, string> = {
      'permit-issued': 'Issued',
      'permit-revoked': 'Revoked',
      'permit-expired': 'Expired',
      'delegated-execution-attempted': 'Attempted',
      'delegated-execution-succeeded': 'Succeeded',
      'delegated-execution-failed': 'Failed',
      'delegated-replay-rejected': 'Replay rejected',
      'delegated-exhausted-rejected': 'Exhausted',
    };

    for (const [eventType, label] of Object.entries(expected)) {
      expect(formatPermitLogEventLabel(eventType as PermitLogEventType)).toBe(label);
    }
  });
});

describe('delegated publish respects ready-stage', () => {
  it('publish-ready-draft action class is present in the allowed set', () => {
    const permit = makePermit({
      allowedActions: ['publish-ready-draft', 'archive-artifact'],
    });

    expect(permit.allowedActions).toContain('publish-ready-draft');

    const result = validatePermitForExecution({
      permit,
      actionClass: 'publish-ready-draft',
      coopId: permit.coopId,
      replayId: 'replay-publish-1',
      replayGuard: createReplayGuard(),
      executor: permit.executor,
      now: FIXED_NOW,
    });

    expect(result.ok).toBe(true);
  });
});
