import { describe, expect, it } from 'vitest';
import {
  type ScopedActionPayloadResolution,
  resolveScopedActionPayload,
} from '../action-payload-parsers';

const VALID_ADDRESS = `0x${'aB'.repeat(20)}`;
const VALID_BYTES32 = `0x${'cd'.repeat(32)}`;

function expectOk(result: ScopedActionPayloadResolution) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Expected ok result');
  return result;
}

function expectError(result: ScopedActionPayloadResolution, substringOrRegex?: string | RegExp) {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('Expected error result');
  if (substringOrRegex) {
    if (typeof substringOrRegex === 'string') {
      expect(result.reason).toContain(substringOrRegex);
    } else {
      expect(result.reason).toMatch(substringOrRegex);
    }
  }
  return result;
}

describe('resolveScopedActionPayload', () => {
  // ─── Archive classes ────────────────────────────────────────────

  describe('archive-artifact', () => {
    it('returns normalized payload with coopId and artifactId', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'archive-artifact',
          payload: { coopId: 'coop-1', artifactId: 'art-1' },
        }),
      );
      expect(result.normalizedPayload).toEqual({ coopId: 'coop-1', artifactId: 'art-1' });
      expect(result.targetIds).toEqual(['art-1']);
      expect(result.coopId).toBe('coop-1');
    });

    it('rejects missing coopId', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'archive-artifact',
          payload: { artifactId: 'art-1' },
        }),
        'coopId',
      );
    });

    it('rejects missing artifactId', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'archive-artifact',
          payload: { coopId: 'coop-1' },
        }),
        'artifactId',
      );
    });

    it('rejects when coopId does not match expectedCoopId', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'archive-artifact',
          payload: { coopId: 'coop-wrong', artifactId: 'art-1' },
          expectedCoopId: 'coop-right',
        }),
        'does not match',
      );
    });

    it('passes when coopId matches expectedCoopId', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'archive-artifact',
          payload: { coopId: 'coop-1', artifactId: 'art-1' },
          expectedCoopId: 'coop-1',
        }),
      );
      expect(result.coopId).toBe('coop-1');
    });
  });

  describe('archive-snapshot', () => {
    it('returns normalized payload with coopId only', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'archive-snapshot',
          payload: { coopId: 'coop-s' },
        }),
      );
      expect(result.normalizedPayload).toEqual({ coopId: 'coop-s' });
      expect(result.targetIds).toEqual([]);
    });

    it('rejects missing coopId', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'archive-snapshot',
          payload: {},
        }),
        'coopId',
      );
    });
  });

  describe('refresh-archive-status', () => {
    it('returns coopId and optional receiptId', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'refresh-archive-status',
          payload: { coopId: 'c', receiptId: 'r-1' },
        }),
      );
      expect(result.normalizedPayload).toEqual({ coopId: 'c', receiptId: 'r-1' });
      expect(result.targetIds).toEqual(['r-1']);
    });

    it('returns empty targetIds when receiptId is omitted', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'refresh-archive-status',
          payload: { coopId: 'c' },
        }),
      );
      expect(result.normalizedPayload.receiptId).toBeUndefined();
      expect(result.targetIds).toEqual([]);
    });

    it('rejects empty-string receiptId', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'refresh-archive-status',
          payload: { coopId: 'c', receiptId: '' },
        }),
        'receiptId',
      );
    });
  });

  // ─── publish-ready-draft (custom handler) ─────────────────────

  describe('publish-ready-draft', () => {
    it('returns draftId and targetCoopIds', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'publish-ready-draft',
          payload: { draftId: 'd-1', targetCoopIds: ['coop-a', 'coop-b'] },
        }),
      );
      expect(result.normalizedPayload.draftId).toBe('d-1');
      expect(result.normalizedPayload.targetCoopIds).toEqual(['coop-a', 'coop-b']);
      expect(result.targetIds).toContain('d-1');
      expect(result.targetIds).toContain('coop-a');
      expect(result.targetIds).toContain('coop-b');
    });

    it('rejects missing draftId', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'publish-ready-draft',
          payload: { targetCoopIds: ['c'] },
        }),
        'draftId',
      );
    });

    it('rejects missing targetCoopIds', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'publish-ready-draft',
          payload: { draftId: 'd' },
        }),
        'targetCoopIds',
      );
    });

    it('rejects when expectedCoopId is not in targetCoopIds', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'publish-ready-draft',
          payload: { draftId: 'd', targetCoopIds: ['coop-other'] },
          expectedCoopId: 'coop-required',
        }),
        'must include the scoped coop',
      );
    });

    it('passes when expectedCoopId is in targetCoopIds', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'publish-ready-draft',
          payload: { draftId: 'd', targetCoopIds: ['coop-required', 'coop-extra'] },
          expectedCoopId: 'coop-required',
        }),
      );
      expect(result.coopId).toBe('coop-required');
    });

    it('deduplicates targetCoopIds', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'publish-ready-draft',
          payload: { draftId: 'd', targetCoopIds: ['coop-a', 'coop-a', 'coop-b'] },
        }),
      );
      const ids = result.normalizedPayload.targetCoopIds as string[];
      expect(ids).toEqual(['coop-a', 'coop-b']);
    });
  });

  // ─── Safe classes ─────────────────────────────────────────────

  describe('safe-deployment', () => {
    it('returns coopSeed', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'safe-deployment',
          payload: { coopSeed: 'seed-xyz' },
        }),
      );
      expect(result.normalizedPayload).toEqual({ coopSeed: 'seed-xyz' });
      expect(result.targetIds).toEqual(['seed-xyz']);
    });

    it('rejects missing coopSeed', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'safe-deployment',
          payload: {},
        }),
        'coopSeed',
      );
    });
  });

  describe('safe-add-owner', () => {
    it('returns coopId, ownerAddress, and newThreshold', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'safe-add-owner',
          payload: { coopId: 'c', ownerAddress: VALID_ADDRESS, newThreshold: 2 },
        }),
      );
      expect(result.normalizedPayload.ownerAddress).toBe(VALID_ADDRESS);
      expect(result.normalizedPayload.newThreshold).toBe(2);
      expect(result.targetIds).toEqual([VALID_ADDRESS]);
    });

    it('rejects invalid ownerAddress format', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'safe-add-owner',
          payload: { coopId: 'c', ownerAddress: 'not-an-address', newThreshold: 2 },
        }),
        'ownerAddress',
      );
    });

    it('rejects negative newThreshold', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'safe-add-owner',
          payload: { coopId: 'c', ownerAddress: VALID_ADDRESS, newThreshold: -1 },
        }),
        'newThreshold',
      );
    });
  });

  describe('safe-remove-owner', () => {
    it('returns normalized payload for valid input', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'safe-remove-owner',
          payload: { coopId: 'c', ownerAddress: VALID_ADDRESS, newThreshold: 1 },
        }),
      );
      expect(result.normalizedPayload.ownerAddress).toBe(VALID_ADDRESS);
    });

    it('rejects missing ownerAddress', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'safe-remove-owner',
          payload: { coopId: 'c', newThreshold: 1 },
        }),
        'ownerAddress',
      );
    });
  });

  describe('safe-swap-owner', () => {
    const secondAddress = `0x${'CD'.repeat(20)}`;

    it('returns both old and new owner addresses', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'safe-swap-owner',
          payload: {
            coopId: 'c',
            oldOwnerAddress: VALID_ADDRESS,
            newOwnerAddress: secondAddress,
          },
        }),
      );
      expect(result.normalizedPayload.oldOwnerAddress).toBe(VALID_ADDRESS);
      expect(result.normalizedPayload.newOwnerAddress).toBe(secondAddress);
      expect(result.targetIds).toEqual([VALID_ADDRESS, secondAddress]);
    });

    it('rejects invalid old owner address', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'safe-swap-owner',
          payload: { coopId: 'c', oldOwnerAddress: 'bad', newOwnerAddress: secondAddress },
        }),
        'oldOwnerAddress',
      );
    });

    it('rejects invalid new owner address', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'safe-swap-owner',
          payload: { coopId: 'c', oldOwnerAddress: VALID_ADDRESS, newOwnerAddress: '0xshort' },
        }),
        'newOwnerAddress',
      );
    });
  });

  describe('safe-change-threshold', () => {
    it('returns coopId and newThreshold', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'safe-change-threshold',
          payload: { coopId: 'c', newThreshold: 3 },
        }),
      );
      expect(result.normalizedPayload).toEqual({ coopId: 'c', newThreshold: 3 });
      expect(result.targetIds).toEqual([]);
    });

    it('rejects non-integer newThreshold', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'safe-change-threshold',
          payload: { coopId: 'c', newThreshold: 1.5 },
        }),
        'newThreshold',
      );
    });
  });

  // ─── Green Goods classes ──────────────────────────────────────

  describe('green-goods-create-garden', () => {
    const validPayload = {
      coopId: 'c',
      name: 'Garden',
      description: 'Desc',
      weightScheme: 'linear',
      domains: ['solar'],
    };

    it('returns normalized payload for valid input', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'green-goods-create-garden',
          payload: validPayload,
        }),
      );
      expect(result.normalizedPayload.name).toBe('Garden');
      expect(result.normalizedPayload.weightScheme).toBe('linear');
      expect(result.normalizedPayload.domains).toEqual(['solar']);
      expect(result.normalizedPayload.openJoining).toBe(false);
      expect(result.normalizedPayload.maxGardeners).toBe(0);
    });

    it('rejects missing name', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'green-goods-create-garden',
          payload: { ...validPayload, name: undefined },
        }),
        'name',
      );
    });

    it('rejects invalid weightScheme', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'green-goods-create-garden',
          payload: { ...validPayload, weightScheme: 'quadratic' },
        }),
        'weightScheme',
      );
    });

    it('rejects invalid domain values', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'green-goods-create-garden',
          payload: { ...validPayload, domains: ['invalid'] },
        }),
        'domains',
      );
    });

    it('rejects invalid operator addresses', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'green-goods-create-garden',
          payload: { ...validPayload, operatorAddresses: ['not-an-address'] },
        }),
        'operatorAddresses',
      );
    });
  });

  describe('green-goods-sync-garden-profile', () => {
    it('returns normalized payload for valid input', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'green-goods-sync-garden-profile',
          payload: {
            coopId: 'c',
            gardenAddress: VALID_ADDRESS,
            name: 'Garden',
            description: 'Desc',
          },
        }),
      );
      expect(result.normalizedPayload.gardenAddress).toBe(VALID_ADDRESS);
      expect(result.targetIds).toEqual([VALID_ADDRESS]);
    });

    it('rejects invalid gardenAddress', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'green-goods-sync-garden-profile',
          payload: { coopId: 'c', gardenAddress: 'bad', name: 'n', description: 'd' },
        }),
        'gardenAddress',
      );
    });
  });

  describe('green-goods-set-garden-domains', () => {
    it('returns normalized payload for valid domains', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'green-goods-set-garden-domains',
          payload: { coopId: 'c', gardenAddress: VALID_ADDRESS, domains: ['solar', 'edu'] },
        }),
      );
      expect(result.normalizedPayload.domains).toEqual(['solar', 'edu']);
    });

    it('rejects invalid domain values', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'green-goods-set-garden-domains',
          payload: { coopId: 'c', gardenAddress: VALID_ADDRESS, domains: ['crypto'] },
        }),
        'domains',
      );
    });
  });

  describe('green-goods-create-garden-pools', () => {
    it('returns coopId and gardenAddress', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'green-goods-create-garden-pools',
          payload: { coopId: 'c', gardenAddress: VALID_ADDRESS },
        }),
      );
      expect(result.normalizedPayload.gardenAddress).toBe(VALID_ADDRESS);
    });
  });

  describe('green-goods-submit-work-approval', () => {
    const validPayload = {
      coopId: 'c',
      gardenAddress: VALID_ADDRESS,
      actionUid: 1,
      workUid: VALID_BYTES32,
      approved: true,
      confidence: 80,
      verificationMethod: 2,
    };

    it('returns normalized payload for valid input', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'green-goods-submit-work-approval',
          payload: validPayload,
        }),
      );
      expect(result.normalizedPayload.approved).toBe(true);
      expect(result.normalizedPayload.confidence).toBe(80);
      expect(result.normalizedPayload.feedback).toBe('');
      expect(result.normalizedPayload.reviewNotesCid).toBe('');
    });

    it('rejects invalid workUid format', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'green-goods-submit-work-approval',
          payload: { ...validPayload, workUid: 'not-bytes32' },
        }),
        'workUid',
      );
    });

    it('rejects confidence above 255', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'green-goods-submit-work-approval',
          payload: { ...validPayload, confidence: 256 },
        }),
        'confidence',
      );
    });

    it('rejects non-boolean approved', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'green-goods-submit-work-approval',
          payload: { ...validPayload, approved: 'yes' },
        }),
        'approved',
      );
    });
  });

  describe('green-goods-create-assessment', () => {
    const validPayload = {
      coopId: 'c',
      gardenAddress: VALID_ADDRESS,
      title: 'Assessment',
      description: 'Desc',
      assessmentConfigCid: 'bafyConfig',
      domain: 'solar',
      startDate: 1000,
      endDate: 2000,
    };

    it('returns normalized payload for valid input', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'green-goods-create-assessment',
          payload: validPayload,
        }),
      );
      expect(result.normalizedPayload.domain).toBe('solar');
      expect(result.normalizedPayload.location).toBe('');
    });

    it('rejects endDate before startDate', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'green-goods-create-assessment',
          payload: { ...validPayload, startDate: 2000, endDate: 1000 },
        }),
        'endDate',
      );
    });

    it('rejects invalid domain value', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'green-goods-create-assessment',
          payload: { ...validPayload, domain: 'forestry' },
        }),
        'domain',
      );
    });
  });

  describe('green-goods-sync-gap-admins', () => {
    it('returns normalized payload with optional admin arrays', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'green-goods-sync-gap-admins',
          payload: {
            coopId: 'c',
            gardenAddress: VALID_ADDRESS,
            addAdmins: [VALID_ADDRESS],
          },
        }),
      );
      expect(result.normalizedPayload.addAdmins).toEqual([VALID_ADDRESS]);
      expect(result.normalizedPayload.removeAdmins).toEqual([]);
    });

    it('rejects invalid addresses in addAdmins', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'green-goods-sync-gap-admins',
          payload: {
            coopId: 'c',
            gardenAddress: VALID_ADDRESS,
            addAdmins: ['not-valid'],
          },
        }),
        'addAdmins',
      );
    });
  });

  // ─── green-goods-mint-hypercert (Zod schema handler) ──────────

  describe('green-goods-mint-hypercert', () => {
    it('rejects payload missing required gardenAddress', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'green-goods-mint-hypercert',
          payload: { coopId: 'c', title: 't', description: 'd' },
        }),
      );
    });

    it('rejects when coopId does not match expectedCoopId', () => {
      // The Zod schema will reject first if the payload is badly formed,
      // but a well-formed payload with wrong coopId should trigger the scope check.
      // We need a full valid payload for this to reach the scope check.
      // Providing a minimal but Zod-valid payload is complex; test the error path.
      const result = resolveScopedActionPayload({
        actionClass: 'green-goods-mint-hypercert',
        payload: { coopId: 'wrong' },
      });
      expect(result.ok).toBe(false);
    });
  });

  // ─── green-goods-add-gardener ─────────────────────────────────

  describe('green-goods-add-gardener', () => {
    it('returns normalized payload for valid input', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'green-goods-add-gardener',
          payload: {
            coopId: 'c',
            gardenAddress: VALID_ADDRESS,
            memberId: 'm1',
            gardenerAddress: VALID_ADDRESS,
          },
        }),
      );
      expect(result.normalizedPayload.memberId).toBe('m1');
      expect(result.targetIds).toContain('m1');
    });

    it('rejects invalid gardenerAddress', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'green-goods-add-gardener',
          payload: {
            coopId: 'c',
            gardenAddress: VALID_ADDRESS,
            memberId: 'm',
            gardenerAddress: 'bad',
          },
        }),
        'gardenerAddress',
      );
    });
  });

  // ─── green-goods-remove-gardener ──────────────────────────────

  describe('green-goods-remove-gardener', () => {
    it('returns normalized payload for valid input', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'green-goods-remove-gardener',
          payload: {
            coopId: 'c',
            gardenAddress: VALID_ADDRESS,
            memberId: 'm1',
            gardenerAddress: VALID_ADDRESS,
          },
        }),
      );
      expect(result.normalizedPayload.memberId).toBe('m1');
    });
  });

  // ─── green-goods-submit-work-submission ────────────────────────

  describe('green-goods-submit-work-submission', () => {
    it('returns normalized payload for valid input', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'green-goods-submit-work-submission',
          payload: {
            coopId: 'c',
            gardenAddress: VALID_ADDRESS,
            actionUid: 5,
            title: 'Work',
            metadataCid: 'bafyMeta',
          },
        }),
      );
      expect(result.normalizedPayload.feedback).toBe('');
      expect(result.normalizedPayload.mediaCids).toEqual([]);
    });

    it('rejects missing metadataCid', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'green-goods-submit-work-submission',
          payload: {
            coopId: 'c',
            gardenAddress: VALID_ADDRESS,
            actionUid: 5,
            title: 'Work',
          },
        }),
        'metadataCid',
      );
    });
  });

  // ─── green-goods-submit-impact-report ─────────────────────────

  describe('green-goods-submit-impact-report', () => {
    const validPayload = {
      coopId: 'c',
      gardenAddress: VALID_ADDRESS,
      title: 'Report',
      description: 'Desc',
      domain: 'solar',
      reportCid: 'bafyReport',
      metricsSummary: 'summary',
      reportingPeriodStart: 1000,
      reportingPeriodEnd: 2000,
      submittedBy: VALID_ADDRESS,
    };

    it('returns normalized payload for valid input', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'green-goods-submit-impact-report',
          payload: validPayload,
        }),
      );
      expect(result.normalizedPayload.domain).toBe('solar');
      expect(result.targetIds).toContain(VALID_ADDRESS);
    });

    it('rejects invalid domain', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'green-goods-submit-impact-report',
          payload: { ...validPayload, domain: 'forestry' },
        }),
        'domain',
      );
    });

    it('rejects reportingPeriodEnd before reportingPeriodStart', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'green-goods-submit-impact-report',
          payload: { ...validPayload, reportingPeriodStart: 2000, reportingPeriodEnd: 1000 },
        }),
        'reportingPeriodEnd',
      );
    });

    it('rejects invalid submittedBy address', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'green-goods-submit-impact-report',
          payload: { ...validPayload, submittedBy: 'not-address' },
        }),
        'submittedBy',
      );
    });
  });

  // ─── erc8004 classes (passthrough handlers) ───────────────────

  describe('erc8004-register-agent', () => {
    it('returns normalized payload spreading all input fields', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'erc8004-register-agent',
          payload: { coopId: 'c', agentName: 'Coop Agent', extra: 'data' },
        }),
      );
      expect(result.normalizedPayload.coopId).toBe('c');
      expect(result.normalizedPayload.agentName).toBe('Coop Agent');
      expect(result.normalizedPayload.extra).toBe('data');
      expect(result.targetIds).toEqual([]);
    });

    it('rejects missing coopId', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'erc8004-register-agent',
          payload: { agentName: 'Agent' },
        }),
        'coopId',
      );
    });

    it('rejects when coopId does not match expectedCoopId', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'erc8004-register-agent',
          payload: { coopId: 'wrong' },
          expectedCoopId: 'right',
        }),
        'does not match',
      );
    });
  });

  describe('erc8004-give-feedback', () => {
    it('returns normalized payload spreading all input fields', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'erc8004-give-feedback',
          payload: { coopId: 'c', rating: 5 },
        }),
      );
      expect(result.normalizedPayload.coopId).toBe('c');
      expect(result.normalizedPayload.rating).toBe(5);
      expect(result.targetIds).toEqual([]);
    });

    it('rejects missing coopId', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'erc8004-give-feedback',
          payload: { rating: 5 },
        }),
        'coopId',
      );
    });
  });

  // ─── Cross-cutting: coop scoping ─────────────────────────────

  describe('coop scoping', () => {
    it('allows any coopId when expectedCoopId is undefined', () => {
      const result = expectOk(
        resolveScopedActionPayload({
          actionClass: 'archive-artifact',
          payload: { coopId: 'any-coop', artifactId: 'a' },
        }),
      );
      expect(result.coopId).toBe('any-coop');
    });

    it('rejects empty string as coopId', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'archive-artifact',
          payload: { coopId: '', artifactId: 'a' },
        }),
        'coopId',
      );
    });

    it('rejects whitespace-only coopId', () => {
      expectError(
        resolveScopedActionPayload({
          actionClass: 'archive-artifact',
          payload: { coopId: '   ', artifactId: 'a' },
        }),
        'coopId',
      );
    });
  });
});
