import { describe, expect, it } from 'vitest';
import {
  buildArchiveArtifactPayload,
  buildArchiveSnapshotPayload,
  buildGreenGoodsCreateAssessmentPayload,
  buildGreenGoodsCreateGardenPayload,
  buildGreenGoodsCreateGardenPoolsPayload,
  buildGreenGoodsSetGardenDomainsPayload,
  buildGreenGoodsSubmitWorkApprovalPayload,
  buildGreenGoodsSyncGapAdminsPayload,
  buildGreenGoodsSyncGardenProfilePayload,
  buildPublishReadyDraftPayload,
  buildRefreshArchiveStatusPayload,
  buildSafeDeploymentPayload,
  buildTypedActionBundle,
  computeTypedDigest,
  createActionBundle,
  isBundleExpired,
  resolveScopedActionPayload,
  validateActionBundle,
} from '../action-bundle';
import { createPolicy } from '../policy';

const FIXED_NOW = '2026-03-12T00:00:00.000Z';
const FUTURE = '2026-03-14T00:00:00.000Z';
const PAST = '2026-03-10T00:00:00.000Z';

function makePolicy(
  overrides: {
    approvalRequired?: boolean;
    expiresAt?: string;
    coopId?: string;
    memberId?: string;
  } = {},
) {
  return createPolicy({
    actionClass: 'archive-artifact',
    approvalRequired: overrides.approvalRequired ?? true,
    expiresAt: overrides.expiresAt,
    coopId: overrides.coopId,
    memberId: overrides.memberId,
    createdAt: FIXED_NOW,
  });
}

function makeBundle(
  overrides: { approvalRequired?: boolean; expiresAt?: string; createdAt?: string } = {},
) {
  const policy = makePolicy({ approvalRequired: overrides.approvalRequired });
  return {
    bundle: createActionBundle({
      actionClass: 'archive-artifact',
      coopId: 'coop-1',
      memberId: 'member-1',
      payload: { coopId: 'coop-1', artifactId: 'art-1' },
      policy,
      expiresAt: overrides.expiresAt ?? FUTURE,
      createdAt: overrides.createdAt ?? FIXED_NOW,
    }),
    policy,
  };
}

describe('action-bundle', () => {
  describe('computeTypedDigest', () => {
    const baseInput = {
      actionClass: 'archive-artifact' as const,
      coopId: 'coop-1',
      memberId: 'member-1',
      replayId: 'replay-1',
      payload: { coopId: 'coop-1', artifactId: 'art-1' },
      createdAt: FIXED_NOW,
      expiresAt: FUTURE,
    };

    it('produces a hex hash', () => {
      const digest = computeTypedDigest(baseInput);
      expect(digest).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it('is deterministic (same input = same output)', () => {
      const a = computeTypedDigest(baseInput);
      const b = computeTypedDigest(baseInput);
      expect(a).toBe(b);
    });

    it('changes with different payload', () => {
      const a = computeTypedDigest(baseInput);
      const b = computeTypedDigest({
        ...baseInput,
        payload: { coopId: 'coop-1', artifactId: 'art-2' },
      });
      expect(a).not.toBe(b);
    });
  });

  describe('createActionBundle', () => {
    it('produces valid bundle with proposed status when approval required', () => {
      const { bundle } = makeBundle({ approvalRequired: true });

      expect(bundle.id).toMatch(/^bundle-/);
      expect(bundle.status).toBe('proposed');
      expect(bundle.actionClass).toBe('archive-artifact');
      expect(bundle.coopId).toBe('coop-1');
      expect(bundle.memberId).toBe('member-1');
      expect(bundle.approvedAt).toBeUndefined();
    });

    it('produces valid bundle with approved status when approval not required', () => {
      const { bundle } = makeBundle({ approvalRequired: false });

      expect(bundle.status).toBe('approved');
      expect(bundle.approvedAt).toBe(FIXED_NOW);
    });

    it('generates unique replayId', () => {
      const { bundle: a } = makeBundle();
      const { bundle: b } = makeBundle();
      expect(a.replayId).not.toBe(b.replayId);
    });

    it('sets 24h default expiry', () => {
      const policy = makePolicy();
      const bundle = createActionBundle({
        actionClass: 'archive-artifact',
        coopId: 'coop-1',
        memberId: 'member-1',
        payload: { coopId: 'coop-1', artifactId: 'art-1' },
        policy,
        createdAt: FIXED_NOW,
      });

      const expectedExpiry = new Date(
        new Date(FIXED_NOW).getTime() + 24 * 60 * 60 * 1000,
      ).toISOString();
      expect(bundle.expiresAt).toBe(expectedExpiry);
    });
  });

  describe('isBundleExpired', () => {
    it('returns false when not expired', () => {
      const { bundle } = makeBundle({ expiresAt: FUTURE });
      expect(isBundleExpired(bundle, FIXED_NOW)).toBe(false);
    });

    it('returns true when expired', () => {
      const { bundle } = makeBundle({ expiresAt: PAST });
      expect(isBundleExpired(bundle, FIXED_NOW)).toBe(true);
    });
  });

  describe('validateActionBundle', () => {
    it('passes for valid bundle + policy', () => {
      const { bundle, policy } = makeBundle({ expiresAt: FUTURE });
      const result = validateActionBundle(bundle, policy, FIXED_NOW);
      expect(result.ok).toBe(true);
    });

    it('fails when bundle expired', () => {
      const { bundle, policy } = makeBundle({ expiresAt: PAST });
      const result = validateActionBundle(bundle, policy, FIXED_NOW);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('expired');
      }
    });

    it('fails when policy expired', () => {
      const policy = makePolicy({ expiresAt: PAST });
      const bundle = createActionBundle({
        actionClass: 'archive-artifact',
        coopId: 'coop-1',
        memberId: 'member-1',
        payload: { coopId: 'coop-1', artifactId: 'art-1' },
        policy,
        expiresAt: FUTURE,
        createdAt: FIXED_NOW,
      });
      const result = validateActionBundle(bundle, policy, FIXED_NOW);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('Policy has expired');
      }
    });

    it('fails when action class mismatch', () => {
      const { bundle } = makeBundle({ expiresAt: FUTURE });
      const differentPolicy = createPolicy({
        actionClass: 'safe-deployment',
        createdAt: FIXED_NOW,
      });
      const result = validateActionBundle(bundle, differentPolicy, FIXED_NOW);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('Action class does not match');
      }
    });

    it('fails when digest is tampered', () => {
      const { bundle, policy } = makeBundle({ expiresAt: FUTURE });
      const tampered = { ...bundle, digest: `0x${'ab'.repeat(32)}` };
      const result = validateActionBundle(tampered, policy, FIXED_NOW);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('digest verification failed');
      }
    });

    it('fails when archive payload coop drifts from the bundle scope', () => {
      const { bundle, policy } = makeBundle({ expiresAt: FUTURE });
      const tamperedPayload = { coopId: 'coop-2', artifactId: 'art-1' };
      const tampered = {
        ...bundle,
        payload: tamperedPayload,
        digest: computeTypedDigest({
          actionClass: bundle.actionClass,
          coopId: bundle.coopId,
          memberId: bundle.memberId,
          replayId: bundle.replayId,
          payload: tamperedPayload,
          createdAt: bundle.createdAt,
          expiresAt: bundle.expiresAt,
        }),
        typedAuthorization: buildTypedActionBundle({
          actionClass: bundle.actionClass,
          coopId: bundle.coopId,
          memberId: bundle.memberId,
          replayId: bundle.replayId,
          payload: tamperedPayload,
          createdAt: bundle.createdAt,
          expiresAt: bundle.expiresAt,
        }),
      };
      const result = validateActionBundle(tampered, policy, FIXED_NOW);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('does not match scoped coop');
      }
    });

    it('fails when delegated publish omits the scoped coop from targets', () => {
      const policy = createPolicy({
        actionClass: 'publish-ready-draft',
        approvalRequired: true,
        createdAt: FIXED_NOW,
      });
      const bundle = createActionBundle({
        actionClass: 'publish-ready-draft',
        coopId: 'coop-1',
        memberId: 'member-1',
        payload: {
          draftId: 'draft-1',
          targetCoopIds: ['coop-2'],
        },
        policy,
        expiresAt: FUTURE,
        createdAt: FIXED_NOW,
      });

      const result = validateActionBundle(bundle, policy, FIXED_NOW);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('scoped coop');
      }
    });

    it('passes for a valid Green Goods create-garden bundle', () => {
      const policy = createPolicy({
        actionClass: 'green-goods-create-garden',
        approvalRequired: true,
        createdAt: FIXED_NOW,
      });
      const bundle = createActionBundle({
        actionClass: 'green-goods-create-garden',
        coopId: 'coop-1',
        memberId: 'member-1',
        payload: buildGreenGoodsCreateGardenPayload({
          coopId: 'coop-1',
          name: 'Watershed Commons',
          description: 'Bioregional coordination garden.',
          weightScheme: 'linear',
          domains: ['agro', 'edu'],
          operatorAddresses: ['0x1111111111111111111111111111111111111111'],
          gardenerAddresses: ['0x1111111111111111111111111111111111111111'],
        }),
        policy,
        expiresAt: FUTURE,
        createdAt: FIXED_NOW,
      });

      expect(validateActionBundle(bundle, policy, FIXED_NOW)).toEqual({ ok: true });
    });

    it('fails when Green Goods garden domains are invalid', () => {
      const policy = createPolicy({
        actionClass: 'green-goods-set-garden-domains',
        approvalRequired: true,
        createdAt: FIXED_NOW,
      });
      const bundle = createActionBundle({
        actionClass: 'green-goods-set-garden-domains',
        coopId: 'coop-1',
        memberId: 'member-1',
        payload: buildGreenGoodsSetGardenDomainsPayload({
          coopId: 'coop-1',
          gardenAddress: '0x1111111111111111111111111111111111111111',
          domains: ['agro', 'invalid-domain'],
        }),
        policy,
        expiresAt: FUTURE,
        createdAt: FIXED_NOW,
      });

      const result = validateActionBundle(bundle, policy, FIXED_NOW);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('invalid "domains"');
      }
    });

    it('passes for a valid Green Goods work approval bundle', () => {
      const policy = createPolicy({
        actionClass: 'green-goods-submit-work-approval',
        approvalRequired: true,
        createdAt: FIXED_NOW,
      });
      const bundle = createActionBundle({
        actionClass: 'green-goods-submit-work-approval',
        coopId: 'coop-1',
        memberId: 'member-1',
        payload: buildGreenGoodsSubmitWorkApprovalPayload({
          coopId: 'coop-1',
          gardenAddress: '0x1111111111111111111111111111111111111111',
          actionUid: 42,
          workUid: `0x${'ab'.repeat(32)}`,
          approved: true,
          feedback: 'Verified from field notes.',
          confidence: 100,
          verificationMethod: 1,
          reviewNotesCid: 'bafy-notes',
        }),
        policy,
        expiresAt: FUTURE,
        createdAt: FIXED_NOW,
      });

      expect(validateActionBundle(bundle, policy, FIXED_NOW)).toEqual({ ok: true });
    });

    it('passes for a valid Green Goods assessment bundle', () => {
      const policy = createPolicy({
        actionClass: 'green-goods-create-assessment',
        approvalRequired: true,
        createdAt: FIXED_NOW,
      });
      const bundle = createActionBundle({
        actionClass: 'green-goods-create-assessment',
        coopId: 'coop-1',
        memberId: 'member-1',
        payload: buildGreenGoodsCreateAssessmentPayload({
          coopId: 'coop-1',
          gardenAddress: '0x1111111111111111111111111111111111111111',
          title: 'Quarterly agro assessment',
          description: 'Watershed and soil regeneration review.',
          assessmentConfigCid: 'bafy-assessment-config',
          domain: 'agro',
          startDate: 1_710_000_000,
          endDate: 1_710_086_400,
          location: 'Watershed Commons',
        }),
        policy,
        expiresAt: FUTURE,
        createdAt: FIXED_NOW,
      });

      expect(validateActionBundle(bundle, policy, FIXED_NOW)).toEqual({ ok: true });
    });

    it('passes for a valid Green Goods GAP admin sync bundle', () => {
      const policy = createPolicy({
        actionClass: 'green-goods-sync-gap-admins',
        approvalRequired: true,
        createdAt: FIXED_NOW,
      });
      const bundle = createActionBundle({
        actionClass: 'green-goods-sync-gap-admins',
        coopId: 'coop-1',
        memberId: 'member-1',
        payload: buildGreenGoodsSyncGapAdminsPayload({
          coopId: 'coop-1',
          gardenAddress: '0x1111111111111111111111111111111111111111',
          addAdmins: ['0x2222222222222222222222222222222222222222'],
          removeAdmins: ['0x3333333333333333333333333333333333333333'],
        }),
        policy,
        expiresAt: FUTURE,
        createdAt: FIXED_NOW,
      });

      expect(validateActionBundle(bundle, policy, FIXED_NOW)).toEqual({ ok: true });
    });
  });

  describe('payload builders', () => {
    it('buildArchiveArtifactPayload produces correct shape', () => {
      const payload = buildArchiveArtifactPayload({
        coopId: 'coop-1',
        artifactId: 'art-1',
      });
      expect(payload).toEqual({ coopId: 'coop-1', artifactId: 'art-1' });
    });

    it('buildArchiveSnapshotPayload produces correct shape', () => {
      const payload = buildArchiveSnapshotPayload({ coopId: 'coop-1' });
      expect(payload).toEqual({ coopId: 'coop-1' });
    });

    it('buildRefreshArchiveStatusPayload produces correct shape', () => {
      const payload = buildRefreshArchiveStatusPayload({
        coopId: 'coop-1',
        receiptId: 'receipt-1',
      });
      expect(payload).toEqual({ coopId: 'coop-1', receiptId: 'receipt-1' });
    });

    it('buildPublishReadyDraftPayload produces correct shape', () => {
      const payload = buildPublishReadyDraftPayload({
        draftId: 'draft-1',
        targetCoopIds: ['coop-1', 'coop-2'],
      });
      expect(payload).toEqual({
        draftId: 'draft-1',
        targetCoopIds: ['coop-1', 'coop-2'],
      });
    });

    it('buildSafeDeploymentPayload produces correct shape', () => {
      const payload = buildSafeDeploymentPayload({ coopSeed: 'seed-abc' });
      expect(payload).toEqual({ coopSeed: 'seed-abc' });
    });

    it('buildGreenGoodsCreateGardenPayload produces correct shape', () => {
      const payload = buildGreenGoodsCreateGardenPayload({
        coopId: 'coop-1',
        name: 'Watershed Commons',
        description: 'Bioregional coordination garden.',
        weightScheme: 'linear',
        domains: ['agro'],
      });
      expect(payload).toEqual({
        coopId: 'coop-1',
        name: 'Watershed Commons',
        slug: undefined,
        description: 'Bioregional coordination garden.',
        location: undefined,
        bannerImage: undefined,
        metadata: undefined,
        openJoining: false,
        maxGardeners: 0,
        weightScheme: 'linear',
        domains: ['agro'],
        operatorAddresses: [],
        gardenerAddresses: [],
      });
    });

    it('buildGreenGoodsSubmitWorkApprovalPayload produces correct shape', () => {
      const payload = buildGreenGoodsSubmitWorkApprovalPayload({
        coopId: 'coop-1',
        gardenAddress: '0x1111111111111111111111111111111111111111',
        actionUid: 42,
        workUid: `0x${'ab'.repeat(32)}`,
        approved: true,
        confidence: 100,
        verificationMethod: 1,
      });
      expect(payload).toEqual({
        coopId: 'coop-1',
        gardenAddress: '0x1111111111111111111111111111111111111111',
        actionUid: 42,
        workUid: `0x${'ab'.repeat(32)}`,
        approved: true,
        feedback: '',
        confidence: 100,
        verificationMethod: 1,
        reviewNotesCid: '',
      });
    });

    it('buildGreenGoodsCreateAssessmentPayload produces correct shape', () => {
      const payload = buildGreenGoodsCreateAssessmentPayload({
        coopId: 'coop-1',
        gardenAddress: '0x1111111111111111111111111111111111111111',
        title: 'Quarterly agro assessment',
        description: 'Watershed and soil regeneration review.',
        assessmentConfigCid: 'bafy-assessment-config',
        domain: 'agro',
        startDate: 1_710_000_000,
        endDate: 1_710_086_400,
      });
      expect(payload).toEqual({
        coopId: 'coop-1',
        gardenAddress: '0x1111111111111111111111111111111111111111',
        title: 'Quarterly agro assessment',
        description: 'Watershed and soil regeneration review.',
        assessmentConfigCid: 'bafy-assessment-config',
        domain: 'agro',
        startDate: 1_710_000_000,
        endDate: 1_710_086_400,
        location: '',
      });
    });

    it('buildGreenGoodsSyncGapAdminsPayload produces correct shape', () => {
      const payload = buildGreenGoodsSyncGapAdminsPayload({
        coopId: 'coop-1',
        gardenAddress: '0x1111111111111111111111111111111111111111',
        addAdmins: ['0x2222222222222222222222222222222222222222'],
      });
      expect(payload).toEqual({
        coopId: 'coop-1',
        gardenAddress: '0x1111111111111111111111111111111111111111',
        addAdmins: ['0x2222222222222222222222222222222222222222'],
        removeAdmins: [],
      });
    });

    it('buildGreenGoodsSyncGardenProfilePayload produces correct shape with defaults', () => {
      const payload = buildGreenGoodsSyncGardenProfilePayload({
        coopId: 'coop-1',
        gardenAddress: '0x1111111111111111111111111111111111111111',
        name: 'Test Garden',
        description: 'A garden description.',
      });
      expect(payload).toEqual({
        coopId: 'coop-1',
        gardenAddress: '0x1111111111111111111111111111111111111111',
        name: 'Test Garden',
        description: 'A garden description.',
        location: undefined,
        bannerImage: undefined,
        metadata: undefined,
        openJoining: false,
        maxGardeners: 0,
      });
    });

    it('buildGreenGoodsSyncGardenProfilePayload produces correct shape with all options', () => {
      const payload = buildGreenGoodsSyncGardenProfilePayload({
        coopId: 'coop-1',
        gardenAddress: '0x1111111111111111111111111111111111111111',
        name: 'Test Garden',
        description: 'A garden description.',
        location: 'Ecuador',
        bannerImage: 'https://example.com/img.png',
        metadata: 'extra',
        openJoining: true,
        maxGardeners: 50,
      });
      expect(payload).toEqual({
        coopId: 'coop-1',
        gardenAddress: '0x1111111111111111111111111111111111111111',
        name: 'Test Garden',
        description: 'A garden description.',
        location: 'Ecuador',
        bannerImage: 'https://example.com/img.png',
        metadata: 'extra',
        openJoining: true,
        maxGardeners: 50,
      });
    });

    it('buildGreenGoodsCreateGardenPoolsPayload produces correct shape', () => {
      const payload = buildGreenGoodsCreateGardenPoolsPayload({
        coopId: 'coop-1',
        gardenAddress: '0x1111111111111111111111111111111111111111',
      });
      expect(payload).toEqual({
        coopId: 'coop-1',
        gardenAddress: '0x1111111111111111111111111111111111111111',
      });
    });

    it('buildGreenGoodsSetGardenDomainsPayload produces correct shape', () => {
      const payload = buildGreenGoodsSetGardenDomainsPayload({
        coopId: 'coop-1',
        gardenAddress: '0x1111111111111111111111111111111111111111',
        domains: ['solar', 'waste'],
      });
      expect(payload).toEqual({
        coopId: 'coop-1',
        gardenAddress: '0x1111111111111111111111111111111111111111',
        domains: ['solar', 'waste'],
      });
    });

    it('buildGreenGoodsCreateGardenPayload with all optional fields', () => {
      const payload = buildGreenGoodsCreateGardenPayload({
        coopId: 'coop-1',
        name: 'Full Garden',
        slug: 'full-garden',
        description: 'All fields set.',
        location: 'Costa Rica',
        bannerImage: 'https://example.com/banner.png',
        metadata: 'meta',
        openJoining: true,
        maxGardeners: 25,
        weightScheme: 'exponential',
        domains: ['solar', 'edu'],
        operatorAddresses: ['0x1111111111111111111111111111111111111111'],
        gardenerAddresses: ['0x2222222222222222222222222222222222222222'],
      });
      expect(payload).toEqual({
        coopId: 'coop-1',
        name: 'Full Garden',
        slug: 'full-garden',
        description: 'All fields set.',
        location: 'Costa Rica',
        bannerImage: 'https://example.com/banner.png',
        metadata: 'meta',
        openJoining: true,
        maxGardeners: 25,
        weightScheme: 'exponential',
        domains: ['solar', 'edu'],
        operatorAddresses: ['0x1111111111111111111111111111111111111111'],
        gardenerAddresses: ['0x2222222222222222222222222222222222222222'],
      });
    });
  });

  describe('resolveScopedActionPayload', () => {
    describe('archive-artifact', () => {
      it('resolves valid payload', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'archive-artifact',
          payload: { coopId: 'coop-1', artifactId: 'art-1' },
        });
        expect(result).toEqual({
          ok: true,
          coopId: 'coop-1',
          normalizedPayload: { coopId: 'coop-1', artifactId: 'art-1' },
          targetIds: ['art-1'],
        });
      });

      it('fails when coopId is missing', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'archive-artifact',
          payload: { artifactId: 'art-1' },
        });
        expect(result).toEqual({ ok: false, reason: 'Action payload is missing "coopId".' });
      });

      it('fails when artifactId is missing', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'archive-artifact',
          payload: { coopId: 'coop-1' },
        });
        expect(result).toEqual({ ok: false, reason: 'Action payload is missing "artifactId".' });
      });

      it('fails when coopId is empty string', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'archive-artifact',
          payload: { coopId: '  ', artifactId: 'art-1' },
        });
        expect(result).toEqual({ ok: false, reason: 'Action payload is missing "coopId".' });
      });

      it('fails when expectedCoopId does not match', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'archive-artifact',
          payload: { coopId: 'coop-2', artifactId: 'art-1' },
          expectedCoopId: 'coop-1',
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('does not match scoped coop');
        }
      });

      it('passes when expectedCoopId matches', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'archive-artifact',
          payload: { coopId: 'coop-1', artifactId: 'art-1' },
          expectedCoopId: 'coop-1',
        });
        expect(result.ok).toBe(true);
      });
    });

    describe('archive-snapshot', () => {
      it('resolves valid payload', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'archive-snapshot',
          payload: { coopId: 'coop-1' },
        });
        expect(result).toEqual({
          ok: true,
          coopId: 'coop-1',
          normalizedPayload: { coopId: 'coop-1' },
          targetIds: [],
        });
      });

      it('fails when coopId missing', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'archive-snapshot',
          payload: {},
        });
        expect(result).toEqual({ ok: false, reason: 'Action payload is missing "coopId".' });
      });

      it('fails when expectedCoopId does not match', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'archive-snapshot',
          payload: { coopId: 'coop-2' },
          expectedCoopId: 'coop-1',
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('does not match scoped coop');
        }
      });
    });

    describe('refresh-archive-status', () => {
      it('resolves valid payload without receiptId', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'refresh-archive-status',
          payload: { coopId: 'coop-1' },
        });
        expect(result).toEqual({
          ok: true,
          coopId: 'coop-1',
          normalizedPayload: { coopId: 'coop-1', receiptId: undefined },
          targetIds: [],
        });
      });

      it('resolves valid payload with receiptId', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'refresh-archive-status',
          payload: { coopId: 'coop-1', receiptId: 'receipt-1' },
        });
        expect(result).toEqual({
          ok: true,
          coopId: 'coop-1',
          normalizedPayload: { coopId: 'coop-1', receiptId: 'receipt-1' },
          targetIds: ['receipt-1'],
        });
      });

      it('fails when receiptId is invalid (empty string)', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'refresh-archive-status',
          payload: { coopId: 'coop-1', receiptId: '' },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('invalid "receiptId"');
        }
      });

      it('fails when coopId missing', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'refresh-archive-status',
          payload: {},
        });
        expect(result).toEqual({ ok: false, reason: 'Action payload is missing "coopId".' });
      });
    });

    describe('publish-ready-draft', () => {
      it('resolves valid payload', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'publish-ready-draft',
          payload: { draftId: 'draft-1', targetCoopIds: ['coop-1', 'coop-2'] },
        });
        expect(result).toEqual({
          ok: true,
          coopId: undefined,
          normalizedPayload: { draftId: 'draft-1', targetCoopIds: ['coop-1', 'coop-2'] },
          targetIds: ['draft-1', 'coop-1', 'coop-2'],
        });
      });

      it('fails when draftId missing', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'publish-ready-draft',
          payload: { targetCoopIds: ['coop-1'] },
        });
        expect(result).toEqual({ ok: false, reason: 'Action payload is missing "draftId".' });
      });

      it('fails when targetCoopIds is not an array', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'publish-ready-draft',
          payload: { draftId: 'draft-1', targetCoopIds: 'coop-1' },
        });
        expect(result).toEqual({
          ok: false,
          reason: 'Action payload is missing "targetCoopIds".',
        });
      });

      it('fails when targetCoopIds is empty', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'publish-ready-draft',
          payload: { draftId: 'draft-1', targetCoopIds: [] },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('invalid "targetCoopIds"');
        }
      });

      it('fails when expectedCoopId is not in targetCoopIds', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'publish-ready-draft',
          payload: { draftId: 'draft-1', targetCoopIds: ['coop-2'] },
          expectedCoopId: 'coop-1',
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('scoped coop');
        }
      });

      it('passes when expectedCoopId is in targetCoopIds', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'publish-ready-draft',
          payload: { draftId: 'draft-1', targetCoopIds: ['coop-1', 'coop-2'] },
          expectedCoopId: 'coop-1',
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.coopId).toBe('coop-1');
        }
      });

      it('deduplicates targetCoopIds', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'publish-ready-draft',
          payload: { draftId: 'draft-1', targetCoopIds: ['coop-1', 'coop-1'] },
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.normalizedPayload.targetCoopIds).toEqual(['coop-1']);
        }
      });
    });

    describe('safe-deployment', () => {
      it('resolves valid payload', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'safe-deployment',
          payload: { coopSeed: 'seed-abc' },
        });
        expect(result).toEqual({
          ok: true,
          normalizedPayload: { coopSeed: 'seed-abc' },
          targetIds: ['seed-abc'],
        });
      });

      it('fails when coopSeed missing', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'safe-deployment',
          payload: {},
        });
        expect(result).toEqual({ ok: false, reason: 'Action payload is missing "coopSeed".' });
      });
    });

    describe('green-goods-create-garden', () => {
      const validPayload = {
        coopId: 'coop-1',
        name: 'Test',
        description: 'A garden',
        weightScheme: 'linear',
        domains: ['agro'],
      };

      it('resolves a valid minimal payload', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-garden',
          payload: validPayload,
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.coopId).toBe('coop-1');
          expect(result.normalizedPayload.name).toBe('Test');
          expect(result.normalizedPayload.weightScheme).toBe('linear');
          expect(result.normalizedPayload.domains).toEqual(['agro']);
          expect(result.normalizedPayload.openJoining).toBe(false);
          expect(result.normalizedPayload.maxGardeners).toBe(0);
          expect(result.normalizedPayload.location).toBe('');
          expect(result.normalizedPayload.bannerImage).toBe('');
          expect(result.normalizedPayload.metadata).toBe('');
          expect(result.normalizedPayload.operatorAddresses).toEqual([]);
          expect(result.normalizedPayload.gardenerAddresses).toEqual([]);
        }
      });

      it('fails when name is missing', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-garden',
          payload: { ...validPayload, name: undefined },
        });
        expect(result).toEqual({ ok: false, reason: 'Action payload is missing "name".' });
      });

      it('fails with invalid weightScheme', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-garden',
          payload: { ...validPayload, weightScheme: 'quadratic' },
        });
        expect(result).toEqual({
          ok: false,
          reason: 'Action payload has an invalid "weightScheme".',
        });
      });

      it('fails with invalid domain', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-garden',
          payload: { ...validPayload, domains: ['forestry'] },
        });
        expect(result).toEqual({
          ok: false,
          reason: 'Action payload has an invalid "domains".',
        });
      });

      it('fails when description is missing', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-garden',
          payload: { ...validPayload, description: undefined },
        });
        expect(result).toEqual({
          ok: false,
          reason: 'Action payload is missing "description".',
        });
      });

      it('fails when slug is invalid (empty string)', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-garden',
          payload: { ...validPayload, slug: '' },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('invalid "slug"');
        }
      });

      it('fails when openJoining is not boolean', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-garden',
          payload: { ...validPayload, openJoining: 'yes' },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('invalid "openJoining"');
        }
      });

      it('fails when maxGardeners is negative', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-garden',
          payload: { ...validPayload, maxGardeners: -1 },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('invalid "maxGardeners"');
        }
      });

      it('fails when maxGardeners is not an integer', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-garden',
          payload: { ...validPayload, maxGardeners: 3.5 },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('invalid "maxGardeners"');
        }
      });

      it('fails when operatorAddresses contains invalid address', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-garden',
          payload: { ...validPayload, operatorAddresses: ['not-an-address'] },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('invalid "operatorAddresses"');
        }
      });

      it('fails when gardenerAddresses contains invalid address', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-garden',
          payload: { ...validPayload, gardenerAddresses: ['0xINVALID'] },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('invalid "gardenerAddresses"');
        }
      });

      it('resolves payload with all optional fields set', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-garden',
          payload: {
            ...validPayload,
            slug: 'test-garden',
            location: 'Costa Rica',
            bannerImage: 'https://example.com/img.png',
            metadata: 'extra-meta',
            openJoining: true,
            maxGardeners: 10,
            operatorAddresses: ['0x1111111111111111111111111111111111111111'],
            gardenerAddresses: ['0x2222222222222222222222222222222222222222'],
          },
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.normalizedPayload.slug).toBe('test-garden');
          expect(result.normalizedPayload.location).toBe('Costa Rica');
          expect(result.normalizedPayload.bannerImage).toBe('https://example.com/img.png');
          expect(result.normalizedPayload.metadata).toBe('extra-meta');
          expect(result.normalizedPayload.openJoining).toBe(true);
          expect(result.normalizedPayload.maxGardeners).toBe(10);
          expect(result.targetIds).toEqual(['Test', 'agro']);
        }
      });
    });

    describe('green-goods-sync-garden-profile', () => {
      const validAddr = '0x1111111111111111111111111111111111111111';

      it('resolves valid payload', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-sync-garden-profile',
          payload: {
            coopId: 'coop-1',
            gardenAddress: validAddr,
            name: 'Garden',
            description: 'Desc',
          },
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.coopId).toBe('coop-1');
          expect(result.normalizedPayload.gardenAddress).toBe(validAddr);
          expect(result.normalizedPayload.openJoining).toBe(false);
          expect(result.normalizedPayload.maxGardeners).toBe(0);
          expect(result.normalizedPayload.location).toBe('');
          expect(result.normalizedPayload.bannerImage).toBe('');
          expect(result.normalizedPayload.metadata).toBe('');
          expect(result.targetIds).toEqual([validAddr]);
        }
      });

      it('fails when gardenAddress is not a valid address', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-sync-garden-profile',
          payload: {
            coopId: 'coop-1',
            gardenAddress: 'not-hex',
            name: 'Garden',
            description: 'Desc',
          },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('invalid "gardenAddress"');
        }
      });

      it('fails when name is missing', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-sync-garden-profile',
          payload: {
            coopId: 'coop-1',
            gardenAddress: validAddr,
            description: 'Desc',
          },
        });
        expect(result).toEqual({ ok: false, reason: 'Action payload is missing "name".' });
      });

      it('fails when description is missing', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-sync-garden-profile',
          payload: {
            coopId: 'coop-1',
            gardenAddress: validAddr,
            name: 'Garden',
          },
        });
        expect(result).toEqual({
          ok: false,
          reason: 'Action payload is missing "description".',
        });
      });

      it('resolves with all optional fields populated', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-sync-garden-profile',
          payload: {
            coopId: 'coop-1',
            gardenAddress: validAddr,
            name: 'Full Garden',
            description: 'Full description',
            location: 'Ecuador',
            bannerImage: 'img.png',
            metadata: 'meta',
            openJoining: true,
            maxGardeners: 25,
          },
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.normalizedPayload.location).toBe('Ecuador');
          expect(result.normalizedPayload.bannerImage).toBe('img.png');
          expect(result.normalizedPayload.metadata).toBe('meta');
          expect(result.normalizedPayload.openJoining).toBe(true);
          expect(result.normalizedPayload.maxGardeners).toBe(25);
        }
      });

      it('fails when maxGardeners is not a valid integer', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-sync-garden-profile',
          payload: {
            coopId: 'coop-1',
            gardenAddress: validAddr,
            name: 'Garden',
            description: 'Desc',
            maxGardeners: 'ten',
          },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('invalid "maxGardeners"');
        }
      });

      it('fails when metadata is invalid (empty string)', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-sync-garden-profile',
          payload: {
            coopId: 'coop-1',
            gardenAddress: validAddr,
            name: 'Garden',
            description: 'Desc',
            metadata: '',
          },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('invalid "metadata"');
        }
      });

      it('fails when openJoining is not boolean', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-sync-garden-profile',
          payload: {
            coopId: 'coop-1',
            gardenAddress: validAddr,
            name: 'Garden',
            description: 'Desc',
            openJoining: 'true',
          },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('invalid "openJoining"');
        }
      });
    });

    describe('green-goods-set-garden-domains', () => {
      const validAddr = '0x1111111111111111111111111111111111111111';

      it('fails when coopId is missing', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-set-garden-domains',
          payload: {
            gardenAddress: validAddr,
            domains: ['solar'],
          },
        });
        expect(result).toEqual({ ok: false, reason: 'Action payload is missing "coopId".' });
      });

      it('resolves valid payload', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-set-garden-domains',
          payload: {
            coopId: 'coop-1',
            gardenAddress: validAddr,
            domains: ['solar', 'waste'],
          },
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.coopId).toBe('coop-1');
          expect(result.targetIds).toEqual([validAddr, 'solar', 'waste']);
        }
      });

      it('fails with invalid gardenAddress', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-set-garden-domains',
          payload: {
            coopId: 'coop-1',
            gardenAddress: '0xshort',
            domains: ['solar'],
          },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('invalid "gardenAddress"');
        }
      });

      it('fails with invalid domain value', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-set-garden-domains',
          payload: {
            coopId: 'coop-1',
            gardenAddress: validAddr,
            domains: ['solar', 'forestry'],
          },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('invalid "domains"');
        }
      });

      it('fails when expectedCoopId does not match', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-set-garden-domains',
          payload: {
            coopId: 'coop-2',
            gardenAddress: validAddr,
            domains: ['solar'],
          },
          expectedCoopId: 'coop-1',
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('does not match scoped coop');
        }
      });
    });

    describe('green-goods-create-garden-pools', () => {
      const validAddr = '0x1111111111111111111111111111111111111111';

      it('resolves valid payload', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-garden-pools',
          payload: {
            coopId: 'coop-1',
            gardenAddress: validAddr,
          },
        });
        expect(result).toEqual({
          ok: true,
          coopId: 'coop-1',
          normalizedPayload: { coopId: 'coop-1', gardenAddress: validAddr },
          targetIds: [validAddr],
        });
      });

      it('fails when coopId is missing', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-garden-pools',
          payload: { gardenAddress: validAddr },
        });
        expect(result).toEqual({ ok: false, reason: 'Action payload is missing "coopId".' });
      });

      it('fails when gardenAddress is missing', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-garden-pools',
          payload: { coopId: 'coop-1' },
        });
        expect(result).toEqual({
          ok: false,
          reason: 'Action payload is missing "gardenAddress".',
        });
      });

      it('fails when gardenAddress is not a valid address', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-garden-pools',
          payload: { coopId: 'coop-1', gardenAddress: 'invalid' },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('invalid "gardenAddress"');
        }
      });

      it('fails when expectedCoopId does not match', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-garden-pools',
          payload: { coopId: 'coop-2', gardenAddress: validAddr },
          expectedCoopId: 'coop-1',
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('does not match scoped coop');
        }
      });
    });

    describe('green-goods-submit-work-approval', () => {
      const validAddr = '0x1111111111111111111111111111111111111111';
      const validWorkUid = `0x${'ab'.repeat(32)}`;
      const validPayload = {
        coopId: 'coop-1',
        gardenAddress: validAddr,
        actionUid: 42,
        workUid: validWorkUid,
        approved: true,
        confidence: 100,
        verificationMethod: 1,
      };

      it('resolves valid payload with defaults', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-submit-work-approval',
          payload: validPayload,
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.normalizedPayload.feedback).toBe('');
          expect(result.normalizedPayload.reviewNotesCid).toBe('');
          expect(result.targetIds).toEqual([validAddr, validWorkUid]);
        }
      });

      it('fails when coopId is missing', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-submit-work-approval',
          payload: { ...validPayload, coopId: undefined },
        });
        expect(result).toEqual({ ok: false, reason: 'Action payload is missing "coopId".' });
      });

      it('fails when expectedCoopId does not match', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-submit-work-approval',
          payload: validPayload,
          expectedCoopId: 'coop-999',
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('does not match scoped coop');
        }
      });

      it('fails when actionUid is missing', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-submit-work-approval',
          payload: { ...validPayload, actionUid: undefined },
        });
        expect(result).toEqual({
          ok: false,
          reason: 'Action payload is missing "actionUid".',
        });
      });

      it('fails when workUid is not valid bytes32', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-submit-work-approval',
          payload: { ...validPayload, workUid: '0xshort' },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('invalid "workUid"');
        }
      });

      it('fails when approved is missing', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-submit-work-approval',
          payload: { ...validPayload, approved: undefined },
        });
        expect(result).toEqual({
          ok: false,
          reason: 'Action payload is missing "approved".',
        });
      });

      it('fails when approved is not boolean', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-submit-work-approval',
          payload: { ...validPayload, approved: 'yes' },
        });
        expect(result).toEqual({
          ok: false,
          reason: 'Action payload is missing "approved".',
        });
      });

      it('fails when confidence exceeds 255 (byte overflow)', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-submit-work-approval',
          payload: { ...validPayload, confidence: 256 },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('invalid "confidence"');
        }
      });

      it('fails when verificationMethod exceeds 255', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-submit-work-approval',
          payload: { ...validPayload, verificationMethod: 300 },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('invalid "verificationMethod"');
        }
      });

      it('fails when confidence is negative', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-submit-work-approval',
          payload: { ...validPayload, confidence: -1 },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('"confidence"');
        }
      });

      it('fails when gardenAddress is missing', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-submit-work-approval',
          payload: { ...validPayload, gardenAddress: undefined },
        });
        expect(result).toEqual({
          ok: false,
          reason: 'Action payload is missing "gardenAddress".',
        });
      });

      it('fails when feedback is empty string', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-submit-work-approval',
          payload: { ...validPayload, feedback: '' },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('invalid "feedback"');
        }
      });

      it('fails when reviewNotesCid is empty string', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-submit-work-approval',
          payload: { ...validPayload, reviewNotesCid: '' },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('invalid "reviewNotesCid"');
        }
      });

      it('resolves payload with optional feedback and reviewNotesCid', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-submit-work-approval',
          payload: {
            ...validPayload,
            feedback: 'Looks good',
            reviewNotesCid: 'bafy-abc',
          },
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.normalizedPayload.feedback).toBe('Looks good');
          expect(result.normalizedPayload.reviewNotesCid).toBe('bafy-abc');
        }
      });
    });

    describe('green-goods-create-assessment', () => {
      const validAddr = '0x1111111111111111111111111111111111111111';
      const validPayload = {
        coopId: 'coop-1',
        gardenAddress: validAddr,
        title: 'Assessment',
        description: 'Desc',
        assessmentConfigCid: 'bafy-config',
        domain: 'solar',
        startDate: 1_000_000,
        endDate: 2_000_000,
      };

      it('resolves valid payload', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-assessment',
          payload: validPayload,
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.coopId).toBe('coop-1');
          expect(result.normalizedPayload.location).toBe('');
          expect(result.targetIds).toEqual([validAddr, 'Assessment', 'bafy-config']);
        }
      });

      it('fails when coopId is missing', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-assessment',
          payload: { ...validPayload, coopId: undefined },
        });
        expect(result).toEqual({ ok: false, reason: 'Action payload is missing "coopId".' });
      });

      it('fails when expectedCoopId does not match', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-assessment',
          payload: validPayload,
          expectedCoopId: 'coop-999',
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('does not match scoped coop');
        }
      });

      it('fails with invalid domain', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-assessment',
          payload: { ...validPayload, domain: 'forestry' },
        });
        expect(result).toEqual({
          ok: false,
          reason: 'Action payload has an invalid "domain".',
        });
      });

      it('fails when endDate < startDate', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-assessment',
          payload: { ...validPayload, startDate: 2_000_000, endDate: 1_000_000 },
        });
        expect(result).toEqual({
          ok: false,
          reason: 'Action payload has an invalid "endDate".',
        });
      });

      it('fails when title is missing', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-assessment',
          payload: { ...validPayload, title: undefined },
        });
        expect(result).toEqual({ ok: false, reason: 'Action payload is missing "title".' });
      });

      it('fails when description is missing', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-assessment',
          payload: { ...validPayload, description: undefined },
        });
        expect(result).toEqual({
          ok: false,
          reason: 'Action payload is missing "description".',
        });
      });

      it('fails when domain is missing', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-assessment',
          payload: { ...validPayload, domain: undefined },
        });
        expect(result).toEqual({
          ok: false,
          reason: 'Action payload is missing "domain".',
        });
      });

      it('fails when assessmentConfigCid is missing', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-assessment',
          payload: { ...validPayload, assessmentConfigCid: undefined },
        });
        expect(result).toEqual({
          ok: false,
          reason: 'Action payload is missing "assessmentConfigCid".',
        });
      });

      it('fails when gardenAddress is invalid', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-assessment',
          payload: { ...validPayload, gardenAddress: '0xBAD' },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('invalid "gardenAddress"');
        }
      });

      it('fails when startDate is not an integer', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-assessment',
          payload: { ...validPayload, startDate: 'yesterday' },
        });
        expect(result).toEqual({
          ok: false,
          reason: 'Action payload is missing "startDate".',
        });
      });

      it('resolves with optional location', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-assessment',
          payload: { ...validPayload, location: 'Ecuador' },
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.normalizedPayload.location).toBe('Ecuador');
        }
      });

      it('succeeds when startDate equals endDate', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-assessment',
          payload: { ...validPayload, startDate: 1_000_000, endDate: 1_000_000 },
        });
        expect(result.ok).toBe(true);
      });

      it('fails when endDate is missing', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-assessment',
          payload: { ...validPayload, endDate: undefined },
        });
        expect(result).toEqual({
          ok: false,
          reason: 'Action payload is missing "endDate".',
        });
      });

      it('fails when location is invalid (empty string)', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-create-assessment',
          payload: { ...validPayload, location: '' },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('invalid "location"');
        }
      });
    });

    describe('green-goods-sync-gap-admins', () => {
      const validAddr = '0x1111111111111111111111111111111111111111';

      it('resolves valid payload with add and remove', () => {
        const addAddr = '0x2222222222222222222222222222222222222222';
        const removeAddr = '0x3333333333333333333333333333333333333333';
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-sync-gap-admins',
          payload: {
            coopId: 'coop-1',
            gardenAddress: validAddr,
            addAdmins: [addAddr],
            removeAdmins: [removeAddr],
          },
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.targetIds).toEqual([validAddr, addAddr, removeAddr]);
        }
      });

      it('resolves payload with no addAdmins or removeAdmins', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-sync-gap-admins',
          payload: {
            coopId: 'coop-1',
            gardenAddress: validAddr,
          },
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.normalizedPayload.addAdmins).toEqual([]);
          expect(result.normalizedPayload.removeAdmins).toEqual([]);
          expect(result.targetIds).toEqual([validAddr]);
        }
      });

      it('fails when addAdmins contains invalid address', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-sync-gap-admins',
          payload: {
            coopId: 'coop-1',
            gardenAddress: validAddr,
            addAdmins: ['not-an-address'],
          },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('invalid "addAdmins"');
        }
      });

      it('fails when removeAdmins contains invalid address', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-sync-gap-admins',
          payload: {
            coopId: 'coop-1',
            gardenAddress: validAddr,
            removeAdmins: ['0xNOT_HEX_40_CHARS'],
          },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('invalid "removeAdmins"');
        }
      });

      it('fails with invalid gardenAddress', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-sync-gap-admins',
          payload: {
            coopId: 'coop-1',
            gardenAddress: 'bad',
          },
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('invalid "gardenAddress"');
        }
      });

      it('fails when coopId is missing', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-sync-gap-admins',
          payload: {
            gardenAddress: validAddr,
          },
        });
        expect(result).toEqual({ ok: false, reason: 'Action payload is missing "coopId".' });
      });

      it('fails when expectedCoopId does not match', () => {
        const result = resolveScopedActionPayload({
          actionClass: 'green-goods-sync-gap-admins',
          payload: {
            coopId: 'coop-2',
            gardenAddress: validAddr,
          },
          expectedCoopId: 'coop-1',
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('does not match scoped coop');
        }
      });
    });
  });

  describe('buildTypedActionBundle', () => {
    it('includes EIP-712 domain, types, primaryType, message, and digest', () => {
      const result = buildTypedActionBundle({
        actionClass: 'archive-artifact',
        coopId: 'coop-1',
        memberId: 'member-1',
        replayId: 'replay-1',
        payload: { coopId: 'coop-1', artifactId: 'art-1' },
        createdAt: FIXED_NOW,
        expiresAt: FUTURE,
      });

      expect(result.domain.name).toBe('Coop Action Bundle');
      expect(result.domain.version).toBe('1');
      expect(result.domain.chainId).toBe(11155111);
      expect(result.primaryType).toBe('CoopActionBundle');
      expect(result.message.actionClass).toBe('archive-artifact');
      expect(result.message.coopId).toBe('coop-1');
      expect(result.message.chainKey).toBe('sepolia');
      expect(result.digest).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it('uses custom chainId and chainKey when provided', () => {
      const result = buildTypedActionBundle({
        actionClass: 'archive-artifact',
        coopId: 'coop-1',
        memberId: 'member-1',
        replayId: 'replay-1',
        payload: { coopId: 'coop-1', artifactId: 'art-1' },
        createdAt: FIXED_NOW,
        expiresAt: FUTURE,
        chainId: 42161,
        chainKey: 'arbitrum',
        safeAddress: '0x1111111111111111111111111111111111111111',
      });

      expect(result.domain.chainId).toBe(42161);
      expect(result.message.chainKey).toBe('arbitrum');
      expect(result.message.safeAddress).toBe('0x1111111111111111111111111111111111111111');
      expect(result.domain.verifyingContract).toBe('0x1111111111111111111111111111111111111111');
    });
  });

  describe('createActionBundle (advanced)', () => {
    it('passes custom chainId through to typedAuthorization', () => {
      const policy = makePolicy();
      const bundle = createActionBundle({
        actionClass: 'archive-artifact',
        coopId: 'coop-1',
        memberId: 'member-1',
        payload: { coopId: 'coop-1', artifactId: 'art-1' },
        policy,
        createdAt: FIXED_NOW,
        expiresAt: FUTURE,
        chainId: 42161,
        chainKey: 'arbitrum',
        safeAddress: '0x1111111111111111111111111111111111111111',
      });

      expect(bundle.typedAuthorization?.domain.chainId).toBe(42161);
      expect(bundle.typedAuthorization?.message.chainKey).toBe('arbitrum');
      expect(bundle.typedAuthorization?.message.safeAddress).toBe(
        '0x1111111111111111111111111111111111111111',
      );
    });
  });

  describe('validateActionBundle (advanced)', () => {
    it('fails when policy has coopId constraint that does not match bundle', () => {
      const policy = createPolicy({
        actionClass: 'archive-artifact',
        approvalRequired: true,
        coopId: 'coop-999',
        createdAt: FIXED_NOW,
      });
      const bundle = createActionBundle({
        actionClass: 'archive-artifact',
        coopId: 'coop-1',
        memberId: 'member-1',
        payload: { coopId: 'coop-1', artifactId: 'art-1' },
        policy,
        expiresAt: FUTURE,
        createdAt: FIXED_NOW,
      });
      const result = validateActionBundle(bundle, policy, FIXED_NOW);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('Bundle coop does not match policy constraint');
      }
    });

    it('fails when policy has memberId constraint that does not match bundle', () => {
      const policy = createPolicy({
        actionClass: 'archive-artifact',
        approvalRequired: true,
        memberId: 'member-999',
        createdAt: FIXED_NOW,
      });
      const bundle = createActionBundle({
        actionClass: 'archive-artifact',
        coopId: 'coop-1',
        memberId: 'member-1',
        payload: { coopId: 'coop-1', artifactId: 'art-1' },
        policy,
        expiresAt: FUTURE,
        createdAt: FIXED_NOW,
      });
      const result = validateActionBundle(bundle, policy, FIXED_NOW);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('Bundle member does not match policy constraint');
      }
    });

    it('fails when typedAuthorization fields are tampered', () => {
      const { bundle, policy } = makeBundle({ expiresAt: FUTURE });
      const auth = bundle.typedAuthorization;
      if (!auth) throw new Error('Expected typedAuthorization');
      const tampered = {
        ...bundle,
        typedAuthorization: {
          ...auth,
          domain: {
            ...auth.domain,
            name: 'Tampered Name',
          },
        },
      };
      const result = validateActionBundle(tampered, policy, FIXED_NOW);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('Typed authorization verification failed');
      }
    });

    it('fails when typedAuthorization chainId is tampered', () => {
      const { bundle, policy } = makeBundle({ expiresAt: FUTURE });
      const auth = bundle.typedAuthorization;
      if (!auth) throw new Error('Expected typedAuthorization');
      const tampered = {
        ...bundle,
        typedAuthorization: {
          ...auth,
          domain: {
            ...auth.domain,
            chainId: 99999,
          },
        },
      };
      const result = validateActionBundle(tampered, policy, FIXED_NOW);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('verification failed');
      }
    });

    it('fails when typedAuthorization message fields are tampered', () => {
      const { bundle, policy } = makeBundle({ expiresAt: FUTURE });
      const auth = bundle.typedAuthorization;
      if (!auth) throw new Error('Expected typedAuthorization');
      const tampered = {
        ...bundle,
        typedAuthorization: {
          ...auth,
          message: {
            ...auth.message,
            coopId: 'tampered-coop',
          },
        },
      };
      const result = validateActionBundle(tampered, policy, FIXED_NOW);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('verification failed');
      }
    });

    it('passes for valid archive-snapshot bundle', () => {
      const policy = createPolicy({
        actionClass: 'archive-snapshot',
        approvalRequired: false,
        createdAt: FIXED_NOW,
      });
      const bundle = createActionBundle({
        actionClass: 'archive-snapshot',
        coopId: 'coop-1',
        memberId: 'member-1',
        payload: buildArchiveSnapshotPayload({ coopId: 'coop-1' }),
        policy,
        expiresAt: FUTURE,
        createdAt: FIXED_NOW,
      });
      expect(validateActionBundle(bundle, policy, FIXED_NOW)).toEqual({ ok: true });
    });

    it('passes for valid refresh-archive-status bundle', () => {
      const policy = createPolicy({
        actionClass: 'refresh-archive-status',
        approvalRequired: false,
        createdAt: FIXED_NOW,
      });
      const bundle = createActionBundle({
        actionClass: 'refresh-archive-status',
        coopId: 'coop-1',
        memberId: 'member-1',
        payload: buildRefreshArchiveStatusPayload({ coopId: 'coop-1', receiptId: 'r-1' }),
        policy,
        expiresAt: FUTURE,
        createdAt: FIXED_NOW,
      });
      expect(validateActionBundle(bundle, policy, FIXED_NOW)).toEqual({ ok: true });
    });

    it('passes for valid safe-deployment bundle', () => {
      const policy = createPolicy({
        actionClass: 'safe-deployment',
        approvalRequired: false,
        createdAt: FIXED_NOW,
      });
      const bundle = createActionBundle({
        actionClass: 'safe-deployment',
        coopId: 'coop-1',
        memberId: 'member-1',
        payload: buildSafeDeploymentPayload({ coopSeed: 'seed-abc' }),
        policy,
        expiresAt: FUTURE,
        createdAt: FIXED_NOW,
      });
      expect(validateActionBundle(bundle, policy, FIXED_NOW)).toEqual({ ok: true });
    });

    it('passes for valid green-goods-sync-garden-profile bundle', () => {
      const policy = createPolicy({
        actionClass: 'green-goods-sync-garden-profile',
        approvalRequired: true,
        createdAt: FIXED_NOW,
      });
      const bundle = createActionBundle({
        actionClass: 'green-goods-sync-garden-profile',
        coopId: 'coop-1',
        memberId: 'member-1',
        payload: buildGreenGoodsSyncGardenProfilePayload({
          coopId: 'coop-1',
          gardenAddress: '0x1111111111111111111111111111111111111111',
          name: 'Garden',
          description: 'Desc',
        }),
        policy,
        expiresAt: FUTURE,
        createdAt: FIXED_NOW,
      });
      expect(validateActionBundle(bundle, policy, FIXED_NOW)).toEqual({ ok: true });
    });

    it('passes for valid green-goods-create-garden-pools bundle', () => {
      const policy = createPolicy({
        actionClass: 'green-goods-create-garden-pools',
        approvalRequired: true,
        createdAt: FIXED_NOW,
      });
      const bundle = createActionBundle({
        actionClass: 'green-goods-create-garden-pools',
        coopId: 'coop-1',
        memberId: 'member-1',
        payload: buildGreenGoodsCreateGardenPoolsPayload({
          coopId: 'coop-1',
          gardenAddress: '0x1111111111111111111111111111111111111111',
        }),
        policy,
        expiresAt: FUTURE,
        createdAt: FIXED_NOW,
      });
      expect(validateActionBundle(bundle, policy, FIXED_NOW)).toEqual({ ok: true });
    });

    it('passes for valid publish-ready-draft bundle', () => {
      const policy = createPolicy({
        actionClass: 'publish-ready-draft',
        approvalRequired: false,
        createdAt: FIXED_NOW,
      });
      const bundle = createActionBundle({
        actionClass: 'publish-ready-draft',
        coopId: 'coop-1',
        memberId: 'member-1',
        payload: buildPublishReadyDraftPayload({
          draftId: 'draft-1',
          targetCoopIds: ['coop-1'],
        }),
        policy,
        expiresAt: FUTURE,
        createdAt: FIXED_NOW,
      });
      expect(validateActionBundle(bundle, policy, FIXED_NOW)).toEqual({ ok: true });
    });
  });
});
