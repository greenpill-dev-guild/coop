import { describe, expect, it } from 'vitest';
import type { ActionBundle, ActionLogEntry, ActionLogEventType } from '../../../contracts/schema';
import { createActionBundle } from '../action-bundle';
import {
  appendActionLog,
  createActionLogEntry,
  formatActionClassLabel,
  formatActionLogEventLabel,
} from '../log';
import { createPolicy } from '../policy';

const FIXED_NOW = '2026-03-12T00:00:00.000Z';
const FUTURE = '2026-03-14T00:00:00.000Z';

function makeBundle(): ActionBundle {
  const policy = createPolicy({
    actionClass: 'archive-artifact',
    approvalRequired: false,
    createdAt: FIXED_NOW,
  });
  return createActionBundle({
    actionClass: 'archive-artifact',
    coopId: 'coop-1',
    memberId: 'member-1',
    payload: { coopId: 'coop-1', artifactId: 'art-1' },
    policy,
    expiresAt: FUTURE,
    createdAt: FIXED_NOW,
  });
}

function makeLogEntry(overrides: Partial<ActionLogEntry> = {}): ActionLogEntry {
  const bundle = makeBundle();
  return createActionLogEntry({
    bundle,
    eventType: 'proposal-created',
    detail: 'Test entry',
    createdAt: overrides.createdAt ?? FIXED_NOW,
    ...('bundleId' in overrides ? {} : {}),
  });
}

describe('log', () => {
  describe('createActionLogEntry', () => {
    it('creates a valid entry with correct fields from bundle', () => {
      const bundle = makeBundle();
      const entry = createActionLogEntry({
        bundle,
        eventType: 'proposal-created',
        detail: 'Proposed archive-artifact',
        createdAt: FIXED_NOW,
      });

      expect(entry.id).toMatch(/^alog-/);
      expect(entry.bundleId).toBe(bundle.id);
      expect(entry.eventType).toBe('proposal-created');
      expect(entry.actionClass).toBe('archive-artifact');
      expect(entry.detail).toBe('Proposed archive-artifact');
      expect(entry.createdAt).toBe(FIXED_NOW);
      expect(entry.coopId).toBe('coop-1');
      expect(entry.memberId).toBe('member-1');
    });

    it('generates unique ids for each entry', () => {
      const bundle = makeBundle();
      const a = createActionLogEntry({
        bundle,
        eventType: 'proposal-created',
        detail: 'First',
        createdAt: FIXED_NOW,
      });
      const b = createActionLogEntry({
        bundle,
        eventType: 'proposal-created',
        detail: 'Second',
        createdAt: FIXED_NOW,
      });

      expect(a.id).not.toBe(b.id);
    });

    it('defaults createdAt to current time when not provided', () => {
      const bundle = makeBundle();
      const before = new Date().toISOString();

      const entry = createActionLogEntry({
        bundle,
        eventType: 'execution-started',
        detail: 'Executing',
      });

      const after = new Date().toISOString();

      expect(entry.createdAt >= before).toBe(true);
      expect(entry.createdAt <= after).toBe(true);
    });

    it('uses provided createdAt when given', () => {
      const bundle = makeBundle();
      const customTime = '2025-01-01T12:00:00.000Z';

      const entry = createActionLogEntry({
        bundle,
        eventType: 'execution-succeeded',
        detail: 'Done',
        createdAt: customTime,
      });

      expect(entry.createdAt).toBe(customTime);
    });

    it('maps each event type correctly', () => {
      const bundle = makeBundle();
      const eventTypes: ActionLogEventType[] = [
        'proposal-created',
        'proposal-approved',
        'proposal-rejected',
        'execution-started',
        'execution-succeeded',
        'execution-failed',
        'replay-rejected',
        'expiry-rejected',
      ];

      for (const eventType of eventTypes) {
        const entry = createActionLogEntry({
          bundle,
          eventType,
          detail: `Testing ${eventType}`,
          createdAt: FIXED_NOW,
        });
        expect(entry.eventType).toBe(eventType);
      }
    });

    it('carries actionClass from the bundle', () => {
      const policy = createPolicy({
        actionClass: 'safe-deployment',
        approvalRequired: false,
        createdAt: FIXED_NOW,
      });
      const bundle = createActionBundle({
        actionClass: 'safe-deployment',
        coopId: 'coop-1',
        memberId: 'member-1',
        payload: { coopSeed: 'seed-abc' },
        policy,
        expiresAt: FUTURE,
        createdAt: FIXED_NOW,
      });

      const entry = createActionLogEntry({
        bundle,
        eventType: 'proposal-created',
        detail: 'Safe deployment proposed',
        createdAt: FIXED_NOW,
      });

      expect(entry.actionClass).toBe('safe-deployment');
    });
  });

  describe('appendActionLog', () => {
    it('appends to an empty log', () => {
      const entry = makeLogEntry();
      const result = appendActionLog([], entry);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(entry);
    });

    it('prepends newer entries (sorts descending by date)', () => {
      const older = makeLogEntry({ createdAt: '2026-03-10T00:00:00.000Z' } as ActionLogEntry);
      const bundle = makeBundle();
      const newer = createActionLogEntry({
        bundle,
        eventType: 'execution-succeeded',
        detail: 'Executed',
        createdAt: '2026-03-12T00:00:00.000Z',
      });

      const result = appendActionLog([older], newer);

      expect(result).toHaveLength(2);
      expect(result[0]?.createdAt).toBe('2026-03-12T00:00:00.000Z');
      expect(result[1]?.createdAt).toBe('2026-03-10T00:00:00.000Z');
    });

    it('inserts entry in sorted position when between existing dates', () => {
      const bundle = makeBundle();
      const earliest = createActionLogEntry({
        bundle,
        eventType: 'proposal-created',
        detail: 'First',
        createdAt: '2026-03-01T00:00:00.000Z',
      });
      const latest = createActionLogEntry({
        bundle,
        eventType: 'execution-succeeded',
        detail: 'Last',
        createdAt: '2026-03-20T00:00:00.000Z',
      });
      const middle = createActionLogEntry({
        bundle,
        eventType: 'proposal-approved',
        detail: 'Middle',
        createdAt: '2026-03-10T00:00:00.000Z',
      });

      const result = appendActionLog([latest, earliest], middle);

      expect(result).toHaveLength(3);
      expect(result[0]?.createdAt).toBe('2026-03-20T00:00:00.000Z');
      expect(result[1]?.createdAt).toBe('2026-03-10T00:00:00.000Z');
      expect(result[2]?.createdAt).toBe('2026-03-01T00:00:00.000Z');
    });

    it('respects the default limit of 100', () => {
      const bundle = makeBundle();
      const existing: ActionLogEntry[] = [];

      for (let i = 0; i < 100; i++) {
        const ts = new Date(Date.UTC(2026, 0, 1, i)).toISOString();
        existing.push(
          createActionLogEntry({
            bundle,
            eventType: 'proposal-created',
            detail: `Entry ${i}`,
            createdAt: ts,
          }),
        );
      }

      const newEntry = createActionLogEntry({
        bundle,
        eventType: 'execution-succeeded',
        detail: 'Newest entry',
        createdAt: '2026-12-31T00:00:00.000Z',
      });

      const result = appendActionLog(existing, newEntry);

      expect(result).toHaveLength(100);
      expect(result[0]?.detail).toBe('Newest entry');
    });

    it('respects a custom limit', () => {
      const bundle = makeBundle();
      const existing: ActionLogEntry[] = [];

      for (let i = 0; i < 5; i++) {
        existing.push(
          createActionLogEntry({
            bundle,
            eventType: 'proposal-created',
            detail: `Entry ${i}`,
            createdAt: `2026-03-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
          }),
        );
      }

      const newEntry = createActionLogEntry({
        bundle,
        eventType: 'execution-succeeded',
        detail: 'Newest',
        createdAt: '2026-03-15T00:00:00.000Z',
      });

      const result = appendActionLog(existing, newEntry, 3);

      expect(result).toHaveLength(3);
      // Should keep only the 3 most recent (newest first)
      expect(result[0]?.createdAt).toBe('2026-03-15T00:00:00.000Z');
    });

    it('does not mutate the original entries array', () => {
      const entry = makeLogEntry();
      const original: ActionLogEntry[] = [];
      appendActionLog(original, entry);

      expect(original).toHaveLength(0);
    });

    it('trims oldest entries when exceeding limit', () => {
      const bundle = makeBundle();
      const entry1 = createActionLogEntry({
        bundle,
        eventType: 'proposal-created',
        detail: 'Old',
        createdAt: '2026-03-01T00:00:00.000Z',
      });
      const entry2 = createActionLogEntry({
        bundle,
        eventType: 'proposal-approved',
        detail: 'Medium',
        createdAt: '2026-03-10T00:00:00.000Z',
      });
      const entry3 = createActionLogEntry({
        bundle,
        eventType: 'execution-succeeded',
        detail: 'New',
        createdAt: '2026-03-20T00:00:00.000Z',
      });

      const result = appendActionLog([entry2, entry1], entry3, 2);

      expect(result).toHaveLength(2);
      expect(result[0]?.detail).toBe('New');
      expect(result[1]?.detail).toBe('Medium');
      // Oldest entry (entry1) should be trimmed
    });
  });

  describe('formatActionLogEventLabel', () => {
    it.each([
      ['proposal-created', 'Proposed'],
      ['proposal-approved', 'Approved'],
      ['proposal-rejected', 'Rejected'],
      ['execution-started', 'Executing'],
      ['execution-succeeded', 'Executed'],
      ['execution-failed', 'Failed'],
      ['replay-rejected', 'Replay rejected'],
      ['expiry-rejected', 'Expired'],
    ] as const)('maps %s to %s', (eventType, expected) => {
      expect(formatActionLogEventLabel(eventType)).toBe(expected);
    });
  });

  describe('formatActionClassLabel', () => {
    it.each([
      ['archive-artifact', 'Archive artifact'],
      ['archive-snapshot', 'Archive snapshot'],
      ['refresh-archive-status', 'Refresh archive status'],
      ['publish-ready-draft', 'Publish ready draft'],
      ['safe-deployment', 'Safe deployment'],
      ['green-goods-create-garden', 'Green Goods create garden'],
      ['green-goods-sync-garden-profile', 'Green Goods sync garden profile'],
      ['green-goods-set-garden-domains', 'Green Goods set garden domains'],
      ['green-goods-create-garden-pools', 'Green Goods create garden pools'],
      ['green-goods-submit-work-approval', 'Green Goods submit work approval'],
      ['green-goods-create-assessment', 'Green Goods create assessment'],
      ['green-goods-sync-gap-admins', 'Green Goods sync GAP admins'],
    ] as const)('maps %s to %s', (actionClass, expected) => {
      expect(formatActionClassLabel(actionClass)).toBe(expected);
    });
  });
});
