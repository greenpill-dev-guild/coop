import { describe, expect, it } from 'vitest';
import {
  buildArchiveArtifactPayload,
  buildArchiveSnapshotPayload,
  buildPublishReadyDraftPayload,
  buildRefreshArchiveStatusPayload,
} from '../action-builders-archive';
import {
  buildGreenGoodsAddGardenerPayload,
  buildGreenGoodsCreateAssessmentPayload,
  buildGreenGoodsCreateGardenPayload,
  buildGreenGoodsCreateGardenPoolsPayload,
  buildGreenGoodsMintHypercertPayload,
  buildGreenGoodsRemoveGardenerPayload,
  buildGreenGoodsSetGardenDomainsPayload,
  buildGreenGoodsSubmitImpactReportPayload,
  buildGreenGoodsSubmitWorkApprovalPayload,
  buildGreenGoodsSubmitWorkSubmissionPayload,
  buildGreenGoodsSyncGapAdminsPayload,
  buildGreenGoodsSyncGardenProfilePayload,
} from '../action-builders-greengoods';
import {
  buildSafeAddOwnerPayload,
  buildSafeChangeThresholdPayload,
  buildSafeDeploymentPayload,
  buildSafeRemoveOwnerPayload,
  buildSafeSwapOwnerPayload,
} from '../action-builders-safe';

describe('action-builders-archive', () => {
  describe('buildArchiveArtifactPayload', () => {
    it('returns coopId and artifactId from input', () => {
      const result = buildArchiveArtifactPayload({
        coopId: 'coop-1',
        artifactId: 'artifact-abc',
      });
      expect(result).toEqual({ coopId: 'coop-1', artifactId: 'artifact-abc' });
    });

    it('passes through exact string values without mutation', () => {
      const result = buildArchiveArtifactPayload({
        coopId: '  spaces  ',
        artifactId: 'UPPER-case',
      });
      expect(result.coopId).toBe('  spaces  ');
      expect(result.artifactId).toBe('UPPER-case');
    });
  });

  describe('buildArchiveSnapshotPayload', () => {
    it('returns coopId from input', () => {
      const result = buildArchiveSnapshotPayload({ coopId: 'coop-snap' });
      expect(result).toEqual({ coopId: 'coop-snap' });
    });
  });

  describe('buildRefreshArchiveStatusPayload', () => {
    it('returns coopId and receiptId when provided', () => {
      const result = buildRefreshArchiveStatusPayload({
        coopId: 'coop-r',
        receiptId: 'receipt-123',
      });
      expect(result).toEqual({ coopId: 'coop-r', receiptId: 'receipt-123' });
    });

    it('passes through undefined receiptId when omitted', () => {
      const result = buildRefreshArchiveStatusPayload({ coopId: 'coop-r' });
      expect(result).toEqual({ coopId: 'coop-r', receiptId: undefined });
    });
  });

  describe('buildPublishReadyDraftPayload', () => {
    it('returns draftId and targetCoopIds from input', () => {
      const result = buildPublishReadyDraftPayload({
        draftId: 'draft-1',
        targetCoopIds: ['coop-a', 'coop-b'],
      });
      expect(result).toEqual({
        draftId: 'draft-1',
        targetCoopIds: ['coop-a', 'coop-b'],
      });
    });

    it('preserves an empty targetCoopIds array', () => {
      const result = buildPublishReadyDraftPayload({
        draftId: 'd',
        targetCoopIds: [],
      });
      expect(result.targetCoopIds).toEqual([]);
    });
  });
});

describe('action-builders-safe', () => {
  describe('buildSafeDeploymentPayload', () => {
    it('returns coopSeed from input', () => {
      const result = buildSafeDeploymentPayload({ coopSeed: 'seed-xyz' });
      expect(result).toEqual({ coopSeed: 'seed-xyz' });
    });
  });

  describe('buildSafeAddOwnerPayload', () => {
    it('returns coopId, ownerAddress, and newThreshold', () => {
      const result = buildSafeAddOwnerPayload({
        coopId: 'coop-1',
        ownerAddress: '0xabc',
        newThreshold: 2,
      });
      expect(result).toEqual({
        coopId: 'coop-1',
        ownerAddress: '0xabc',
        newThreshold: 2,
      });
    });
  });

  describe('buildSafeRemoveOwnerPayload', () => {
    it('returns coopId, ownerAddress, and newThreshold', () => {
      const result = buildSafeRemoveOwnerPayload({
        coopId: 'coop-1',
        ownerAddress: '0xdef',
        newThreshold: 1,
      });
      expect(result).toEqual({
        coopId: 'coop-1',
        ownerAddress: '0xdef',
        newThreshold: 1,
      });
    });
  });

  describe('buildSafeSwapOwnerPayload', () => {
    it('returns coopId, oldOwnerAddress, and newOwnerAddress', () => {
      const result = buildSafeSwapOwnerPayload({
        coopId: 'coop-1',
        oldOwnerAddress: '0xold',
        newOwnerAddress: '0xnew',
      });
      expect(result).toEqual({
        coopId: 'coop-1',
        oldOwnerAddress: '0xold',
        newOwnerAddress: '0xnew',
      });
    });
  });

  describe('buildSafeChangeThresholdPayload', () => {
    it('returns coopId and newThreshold', () => {
      const result = buildSafeChangeThresholdPayload({
        coopId: 'coop-1',
        newThreshold: 3,
      });
      expect(result).toEqual({ coopId: 'coop-1', newThreshold: 3 });
    });
  });
});

describe('action-builders-greengoods', () => {
  describe('buildGreenGoodsCreateGardenPayload', () => {
    it('returns all required fields with default optionals', () => {
      const result = buildGreenGoodsCreateGardenPayload({
        coopId: 'coop-1',
        name: 'Test Garden',
        description: 'A garden',
        weightScheme: 'linear',
        domains: ['solar', 'agro'],
      });
      expect(result).toMatchObject({
        coopId: 'coop-1',
        name: 'Test Garden',
        description: 'A garden',
        weightScheme: 'linear',
        domains: ['solar', 'agro'],
        openJoining: false,
        maxGardeners: 0,
      });
    });

    it('defaults openJoining to false when omitted', () => {
      const result = buildGreenGoodsCreateGardenPayload({
        coopId: 'c',
        name: 'n',
        description: 'd',
        weightScheme: 'exponential',
        domains: ['edu'],
      });
      expect(result.openJoining).toBe(false);
    });

    it('defaults maxGardeners to 0 when omitted', () => {
      const result = buildGreenGoodsCreateGardenPayload({
        coopId: 'c',
        name: 'n',
        description: 'd',
        weightScheme: 'power',
        domains: ['waste'],
      });
      expect(result.maxGardeners).toBe(0);
    });

    it('uses provided optional values instead of defaults', () => {
      const result = buildGreenGoodsCreateGardenPayload({
        coopId: 'c',
        name: 'n',
        description: 'd',
        weightScheme: 'linear',
        domains: ['solar'],
        openJoining: true,
        maxGardeners: 10,
        slug: 'my-garden',
        location: 'Lagos',
        bannerImage: 'https://img.example/banner.png',
        metadata: '{"custom":true}',
      });
      expect(result.openJoining).toBe(true);
      expect(result.maxGardeners).toBe(10);
      expect(result.slug).toBe('my-garden');
      expect(result.location).toBe('Lagos');
      expect(result.bannerImage).toBe('https://img.example/banner.png');
      expect(result.metadata).toBe('{"custom":true}');
    });

    it('omits operatorAddresses and gardenerAddresses when arrays are empty', () => {
      const result = buildGreenGoodsCreateGardenPayload({
        coopId: 'c',
        name: 'n',
        description: 'd',
        weightScheme: 'linear',
        domains: ['solar'],
        operatorAddresses: [],
        gardenerAddresses: [],
      });
      expect(result).not.toHaveProperty('operatorAddresses');
      expect(result).not.toHaveProperty('gardenerAddresses');
    });

    it('includes operatorAddresses and gardenerAddresses when populated', () => {
      const result = buildGreenGoodsCreateGardenPayload({
        coopId: 'c',
        name: 'n',
        description: 'd',
        weightScheme: 'linear',
        domains: ['solar'],
        operatorAddresses: ['0xop1'],
        gardenerAddresses: ['0xg1', '0xg2'],
      });
      expect(result.operatorAddresses).toEqual(['0xop1']);
      expect(result.gardenerAddresses).toEqual(['0xg1', '0xg2']);
    });
  });

  describe('buildGreenGoodsSyncGardenProfilePayload', () => {
    it('returns required fields with default optionals', () => {
      const result = buildGreenGoodsSyncGardenProfilePayload({
        coopId: 'c',
        gardenAddress: '0xgarden',
        name: 'Garden',
        description: 'Desc',
      });
      expect(result).toMatchObject({
        coopId: 'c',
        gardenAddress: '0xgarden',
        name: 'Garden',
        description: 'Desc',
        openJoining: false,
        maxGardeners: 0,
      });
    });

    it('defaults openJoining to false and maxGardeners to 0', () => {
      const result = buildGreenGoodsSyncGardenProfilePayload({
        coopId: 'c',
        gardenAddress: '0x1',
        name: 'n',
        description: 'd',
      });
      expect(result.openJoining).toBe(false);
      expect(result.maxGardeners).toBe(0);
    });
  });

  describe('buildGreenGoodsSetGardenDomainsPayload', () => {
    it('returns coopId, gardenAddress, and domains', () => {
      const result = buildGreenGoodsSetGardenDomainsPayload({
        coopId: 'c',
        gardenAddress: '0xg',
        domains: ['solar', 'waste'],
      });
      expect(result).toEqual({
        coopId: 'c',
        gardenAddress: '0xg',
        domains: ['solar', 'waste'],
      });
    });
  });

  describe('buildGreenGoodsCreateGardenPoolsPayload', () => {
    it('returns coopId and gardenAddress', () => {
      const result = buildGreenGoodsCreateGardenPoolsPayload({
        coopId: 'c',
        gardenAddress: '0xg',
      });
      expect(result).toEqual({ coopId: 'c', gardenAddress: '0xg' });
    });
  });

  describe('buildGreenGoodsSubmitWorkApprovalPayload', () => {
    it('returns all fields with default optionals', () => {
      const result = buildGreenGoodsSubmitWorkApprovalPayload({
        coopId: 'c',
        gardenAddress: '0xg',
        actionUid: 1,
        workUid: 'work-1',
        approved: true,
        confidence: 80,
        verificationMethod: 2,
      });
      expect(result).toMatchObject({
        coopId: 'c',
        gardenAddress: '0xg',
        actionUid: 1,
        workUid: 'work-1',
        approved: true,
        feedback: '',
        confidence: 80,
        verificationMethod: 2,
        reviewNotesCid: '',
      });
    });

    it('defaults feedback to empty string when omitted', () => {
      const result = buildGreenGoodsSubmitWorkApprovalPayload({
        coopId: 'c',
        gardenAddress: '0xg',
        actionUid: 1,
        workUid: 'w',
        approved: false,
        confidence: 50,
        verificationMethod: 1,
      });
      expect(result.feedback).toBe('');
    });

    it('defaults reviewNotesCid to empty string when omitted', () => {
      const result = buildGreenGoodsSubmitWorkApprovalPayload({
        coopId: 'c',
        gardenAddress: '0xg',
        actionUid: 1,
        workUid: 'w',
        approved: true,
        confidence: 90,
        verificationMethod: 0,
      });
      expect(result.reviewNotesCid).toBe('');
    });

    it('uses provided feedback and reviewNotesCid', () => {
      const result = buildGreenGoodsSubmitWorkApprovalPayload({
        coopId: 'c',
        gardenAddress: '0xg',
        actionUid: 1,
        workUid: 'w',
        approved: true,
        feedback: 'Good work',
        confidence: 95,
        verificationMethod: 3,
        reviewNotesCid: 'bafyNotes',
      });
      expect(result.feedback).toBe('Good work');
      expect(result.reviewNotesCid).toBe('bafyNotes');
    });
  });

  describe('buildGreenGoodsCreateAssessmentPayload', () => {
    it('returns all required fields when location is omitted', () => {
      const result = buildGreenGoodsCreateAssessmentPayload({
        coopId: 'c',
        gardenAddress: '0xg',
        title: 'Assessment 1',
        description: 'Desc',
        assessmentConfigCid: 'bafyConfig',
        domain: 'solar',
        startDate: 1000,
        endDate: 2000,
      });
      expect(result).toMatchObject({
        coopId: 'c',
        gardenAddress: '0xg',
        title: 'Assessment 1',
        description: 'Desc',
        assessmentConfigCid: 'bafyConfig',
        domain: 'solar',
        startDate: 1000,
        endDate: 2000,
      });
    });

    it('leaves location absent or empty when omitted', () => {
      const result = buildGreenGoodsCreateAssessmentPayload({
        coopId: 'c',
        gardenAddress: '0xg',
        title: 't',
        description: 'd',
        assessmentConfigCid: 'cid',
        domain: 'edu',
        startDate: 0,
        endDate: 1,
      });
      // Builder may return undefined or '' depending on normalization strategy
      expect(result.location === undefined || result.location === '').toBe(true);
    });

    it('uses provided location', () => {
      const result = buildGreenGoodsCreateAssessmentPayload({
        coopId: 'c',
        gardenAddress: '0xg',
        title: 't',
        description: 'd',
        assessmentConfigCid: 'cid',
        domain: 'waste',
        startDate: 0,
        endDate: 1,
        location: 'Accra',
      });
      expect(result.location).toBe('Accra');
    });
  });

  describe('buildGreenGoodsSyncGapAdminsPayload', () => {
    it('defaults addAdmins and removeAdmins to empty arrays', () => {
      const result = buildGreenGoodsSyncGapAdminsPayload({
        coopId: 'c',
        gardenAddress: '0xg',
      });
      expect(result.addAdmins).toEqual([]);
      expect(result.removeAdmins).toEqual([]);
    });

    it('uses provided admin arrays', () => {
      const result = buildGreenGoodsSyncGapAdminsPayload({
        coopId: 'c',
        gardenAddress: '0xg',
        addAdmins: ['0xnew1'],
        removeAdmins: ['0xold1'],
      });
      expect(result.addAdmins).toEqual(['0xnew1']);
      expect(result.removeAdmins).toEqual(['0xold1']);
    });
  });

  describe('buildGreenGoodsMintHypercertPayload', () => {
    const minimalAttestation = {
      uid: 'att-1',
      workUid: 'work-1',
      title: 'Work Title',
      gardenerAddress: '0xgardener',
      createdAt: 1000,
      approvedAt: 2000,
    };

    const minimalInput = {
      coopId: 'c',
      gardenAddress: '0xgarden',
      title: 'Hypercert Title',
      description: 'Hypercert Desc',
      allowlist: [{ address: '0xaddr1', units: 100 }],
      attestations: [minimalAttestation],
    };

    it('returns all fields with defaults for omitted optionals', () => {
      const result = buildGreenGoodsMintHypercertPayload(minimalInput);
      expect(result).toMatchObject({
        coopId: 'c',
        gardenAddress: '0xgarden',
        title: 'Hypercert Title',
        description: 'Hypercert Desc',
        workScopes: [],
        impactScopes: ['all'],
        sdgs: [],
        capitals: [],
        outcomes: { predefined: {}, custom: {} },
        rationale: 'Mint a Green Goods Hypercert package.',
      });
    });

    it('defaults impactScopes to ["all"]', () => {
      const result = buildGreenGoodsMintHypercertPayload(minimalInput);
      expect(result.impactScopes).toEqual(['all']);
    });

    it('defaults rationale to the standard message', () => {
      const result = buildGreenGoodsMintHypercertPayload(minimalInput);
      expect(result.rationale).toBe('Mint a Green Goods Hypercert package.');
    });

    it('defaults outcomes to { predefined: {}, custom: {} }', () => {
      const result = buildGreenGoodsMintHypercertPayload(minimalInput);
      expect(result.outcomes).toEqual({ predefined: {}, custom: {} });
    });

    it('uses provided optional values', () => {
      const result = buildGreenGoodsMintHypercertPayload({
        ...minimalInput,
        workScopes: ['composting'],
        impactScopes: ['carbon'],
        rationale: 'Custom rationale',
        sdgs: [13, 15],
        capitals: ['living', 'social'],
        domain: 'agro',
      });
      expect(result.workScopes).toEqual(['composting']);
      expect(result.impactScopes).toEqual(['carbon']);
      expect(result.rationale).toBe('Custom rationale');
      expect(result.sdgs).toEqual([13, 15]);
      expect(result.capitals).toEqual(['living', 'social']);
      expect(result.domain).toBe('agro');
    });

    it('normalizes attestation optional fields', () => {
      const result = buildGreenGoodsMintHypercertPayload(minimalInput);
      const att = (result.attestations as Array<Record<string, unknown>>)[0];
      expect(att.workScope).toEqual([]);
      expect(att.mediaUrls).toEqual([]);
    });

    it('preserves provided attestation optional fields', () => {
      const result = buildGreenGoodsMintHypercertPayload({
        ...minimalInput,
        attestations: [
          {
            ...minimalAttestation,
            workScope: ['planting'],
            mediaUrls: ['https://img.example/photo.jpg'],
            gardenerName: 'Alice',
            domain: 'agro',
            feedback: 'Excellent',
            actionType: 'maintenance',
          },
        ],
      });
      const att = (result.attestations as Array<Record<string, unknown>>)[0];
      expect(att.workScope).toEqual(['planting']);
      expect(att.mediaUrls).toEqual(['https://img.example/photo.jpg']);
      expect(att.gardenerName).toBe('Alice');
      expect(att.domain).toBe('agro');
      expect(att.feedback).toBe('Excellent');
      expect(att.actionType).toBe('maintenance');
    });
  });

  describe('buildGreenGoodsAddGardenerPayload', () => {
    it('returns all four required fields', () => {
      const result = buildGreenGoodsAddGardenerPayload({
        coopId: 'c',
        memberId: 'm1',
        gardenAddress: '0xg',
        gardenerAddress: '0xgardener',
      });
      expect(result).toEqual({
        coopId: 'c',
        memberId: 'm1',
        gardenAddress: '0xg',
        gardenerAddress: '0xgardener',
      });
    });
  });

  describe('buildGreenGoodsRemoveGardenerPayload', () => {
    it('returns all four required fields', () => {
      const result = buildGreenGoodsRemoveGardenerPayload({
        coopId: 'c',
        memberId: 'm1',
        gardenAddress: '0xg',
        gardenerAddress: '0xgardener',
      });
      expect(result).toEqual({
        coopId: 'c',
        memberId: 'm1',
        gardenAddress: '0xg',
        gardenerAddress: '0xgardener',
      });
    });
  });

  describe('buildGreenGoodsSubmitWorkSubmissionPayload', () => {
    it('returns all fields with default optionals', () => {
      const result = buildGreenGoodsSubmitWorkSubmissionPayload({
        coopId: 'c',
        gardenAddress: '0xg',
        actionUid: 5,
        title: 'Work Title',
        metadataCid: 'bafyMeta',
      });
      expect(result).toMatchObject({
        coopId: 'c',
        gardenAddress: '0xg',
        actionUid: 5,
        title: 'Work Title',
        feedback: '',
        metadataCid: 'bafyMeta',
        mediaCids: [],
      });
    });

    it('defaults feedback to empty string when omitted', () => {
      const result = buildGreenGoodsSubmitWorkSubmissionPayload({
        coopId: 'c',
        gardenAddress: '0xg',
        actionUid: 1,
        title: 't',
        metadataCid: 'cid',
      });
      expect(result.feedback).toBe('');
    });

    it('defaults mediaCids to empty array when omitted', () => {
      const result = buildGreenGoodsSubmitWorkSubmissionPayload({
        coopId: 'c',
        gardenAddress: '0xg',
        actionUid: 1,
        title: 't',
        metadataCid: 'cid',
      });
      expect(result.mediaCids).toEqual([]);
    });

    it('uses provided feedback and mediaCids', () => {
      const result = buildGreenGoodsSubmitWorkSubmissionPayload({
        coopId: 'c',
        gardenAddress: '0xg',
        actionUid: 1,
        title: 't',
        feedback: 'Notes here',
        metadataCid: 'cid',
        mediaCids: ['cid1', 'cid2'],
      });
      expect(result.feedback).toBe('Notes here');
      expect(result.mediaCids).toEqual(['cid1', 'cid2']);
    });
  });

  describe('buildGreenGoodsSubmitImpactReportPayload', () => {
    it('returns all required fields as-is', () => {
      const result = buildGreenGoodsSubmitImpactReportPayload({
        coopId: 'c',
        gardenAddress: '0xg',
        title: 'Report',
        description: 'Impact desc',
        domain: 'solar',
        reportCid: 'bafyReport',
        metricsSummary: '10 tons CO2 offset',
        reportingPeriodStart: 1000,
        reportingPeriodEnd: 2000,
        submittedBy: '0xsubmitter',
      });
      expect(result).toEqual({
        coopId: 'c',
        gardenAddress: '0xg',
        title: 'Report',
        description: 'Impact desc',
        domain: 'solar',
        reportCid: 'bafyReport',
        metricsSummary: '10 tons CO2 offset',
        reportingPeriodStart: 1000,
        reportingPeriodEnd: 2000,
        submittedBy: '0xsubmitter',
      });
    });
  });
});
