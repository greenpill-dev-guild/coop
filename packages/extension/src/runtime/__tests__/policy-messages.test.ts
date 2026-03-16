import { describe, expect, it } from 'vitest';
import type { RuntimeRequest } from '../messages';

describe('policy message types', () => {
  it('accepts get-action-policies message', () => {
    const message: RuntimeRequest = { type: 'get-action-policies' };
    expect(message.type).toBe('get-action-policies');
  });

  it('accepts set-action-policy message', () => {
    const message: RuntimeRequest = {
      type: 'set-action-policy',
      payload: { actionClass: 'archive-artifact', approvalRequired: false },
    };
    expect(message.type).toBe('set-action-policy');
    expect(message.payload.actionClass).toBe('archive-artifact');
    expect(message.payload.approvalRequired).toBe(false);
  });

  it('accepts propose-action message', () => {
    const message: RuntimeRequest = {
      type: 'propose-action',
      payload: {
        actionClass: 'archive-artifact',
        coopId: 'coop-1',
        memberId: 'member-1',
        payload: { coopId: 'coop-1', artifactId: 'art-1' },
      },
    };
    expect(message.type).toBe('propose-action');
    expect(message.payload.actionClass).toBe('archive-artifact');
  });

  it('accepts approve-action message', () => {
    const message: RuntimeRequest = {
      type: 'approve-action',
      payload: { bundleId: 'bundle-1' },
    };
    expect(message.type).toBe('approve-action');
  });

  it('accepts reject-action message', () => {
    const message: RuntimeRequest = {
      type: 'reject-action',
      payload: { bundleId: 'bundle-1' },
    };
    expect(message.type).toBe('reject-action');
  });

  it('accepts execute-action message', () => {
    const message: RuntimeRequest = {
      type: 'execute-action',
      payload: { bundleId: 'bundle-1' },
    };
    expect(message.type).toBe('execute-action');
  });

  it('accepts get-action-queue message', () => {
    const message: RuntimeRequest = { type: 'get-action-queue' };
    expect(message.type).toBe('get-action-queue');
  });

  it('accepts get-action-history message', () => {
    const message: RuntimeRequest = { type: 'get-action-history' };
    expect(message.type).toBe('get-action-history');
  });

  it('accepts issue-permit message', () => {
    const message: RuntimeRequest = {
      type: 'issue-permit',
      payload: {
        coopId: 'coop-1',
        expiresAt: '2026-03-13T00:00:00.000Z',
        maxUses: 10,
        allowedActions: ['archive-artifact', 'archive-snapshot'],
      },
    };
    expect(message.type).toBe('issue-permit');
    expect(message.payload.allowedActions).toHaveLength(2);
  });

  it('accepts revoke-permit message', () => {
    const message: RuntimeRequest = {
      type: 'revoke-permit',
      payload: { permitId: 'permit-1' },
    };
    expect(message.type).toBe('revoke-permit');
  });

  it('accepts execute-with-permit message', () => {
    const message: RuntimeRequest = {
      type: 'execute-with-permit',
      payload: {
        permitId: 'permit-1',
        replayId: 'dreplay-1',
        actionClass: 'archive-artifact',
        coopId: 'coop-1',
        actionPayload: { coopId: 'coop-1', artifactId: 'art-1' },
      },
    };
    expect(message.type).toBe('execute-with-permit');
  });

  it('accepts get-permits message', () => {
    const message: RuntimeRequest = { type: 'get-permits' };
    expect(message.type).toBe('get-permits');
  });

  it('accepts get-permit-log message', () => {
    const message: RuntimeRequest = { type: 'get-permit-log' };
    expect(message.type).toBe('get-permit-log');
  });
});

describe('DashboardResponse operator policy fields', () => {
  it('includes policyActionQueue and policyActionLogEntries in operator type', () => {
    // This test validates the DashboardResponse type has policy fields
    // by checking the type compiles correctly
    const mockOperator: import('../messages').DashboardResponse['operator'] = {
      anchorCapability: null,
      anchorActive: false,
      anchorDetail: '',
      actionLog: [],
      archiveMode: 'mock',
      onchainMode: 'mock',
      liveArchiveAvailable: false,
      liveArchiveDetail: '',
      liveOnchainAvailable: false,
      liveOnchainDetail: '',
      policyActionQueue: [],
      policyActionLogEntries: [],
      permits: [],
      permitLog: [],
    };
    expect(mockOperator.policyActionQueue).toEqual([]);
    expect(mockOperator.policyActionLogEntries).toEqual([]);
    expect(mockOperator.permits).toEqual([]);
    expect(mockOperator.permitLog).toEqual([]);
  });
});
