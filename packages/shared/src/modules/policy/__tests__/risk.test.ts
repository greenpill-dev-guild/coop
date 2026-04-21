import { describe, expect, it } from 'vitest';
import {
  classifyActionRisks,
  collectActionRiskTags,
  formatActionRiskAcknowledgementLabel,
  formatActionRiskReviewSummary,
  formatActionRiskTagLabel,
  requiresExplicitAcknowledgementForItems,
} from '../risk';

describe('action risk classifier', () => {
  it('returns publish-only risk for publish-ready drafts', () => {
    expect(
      classifyActionRisks({ actionClass: 'publish-ready-draft', onchainMode: 'mock' }),
    ).toEqual({
      riskTags: ['publish'],
      requiresExplicitAcknowledgement: false,
    });
  });

  it('returns archive-only risk for archive actions', () => {
    expect(classifyActionRisks({ actionClass: 'archive-artifact', onchainMode: 'live' })).toEqual({
      riskTags: ['archive'],
      requiresExplicitAcknowledgement: false,
    });
  });

  it('returns sync-only risk for sync actions in mock mode', () => {
    expect(
      classifyActionRisks({ actionClass: 'green-goods-sync-gap-admins', onchainMode: 'mock' }),
    ).toEqual({
      riskTags: ['sync'],
      requiresExplicitAcknowledgement: false,
    });
  });

  it('adds live risk to onchain actions only when onchain mode is live', () => {
    expect(
      classifyActionRisks({ actionClass: 'green-goods-sync-gap-admins', onchainMode: 'live' }),
    ).toEqual({
      riskTags: ['live', 'sync'],
      requiresExplicitAcknowledgement: true,
    });
  });

  it('returns permission risk for permission-changing actions', () => {
    expect(classifyActionRisks({ actionClass: 'safe-add-owner', onchainMode: 'mock' })).toEqual({
      riskTags: ['permission'],
      requiresExplicitAcknowledgement: true,
    });
  });

  it('returns permission and destructive risk for irreversible permission changes', () => {
    const permissionDestructiveActionClasses = [
      'safe-remove-owner',
      'safe-swap-owner',
      'safe-change-threshold',
      'green-goods-remove-gardener',
    ] as const;

    for (const actionClass of permissionDestructiveActionClasses) {
      const mockRisk = classifyActionRisks({ actionClass, onchainMode: 'mock' });
      expect(mockRisk).toEqual({
        riskTags: ['permission', 'destructive'],
        requiresExplicitAcknowledgement: true,
      });
      expect(formatActionRiskAcknowledgementLabel(mockRisk.riskTags)).toBe(
        'I reviewed the irreversible effect',
      );

      const liveRisk = classifyActionRisks({ actionClass, onchainMode: 'live' });
      expect(liveRisk).toEqual({
        riskTags: ['live', 'permission', 'destructive'],
        requiresExplicitAcknowledgement: true,
      });
      expect(formatActionRiskAcknowledgementLabel(liveRisk.riskTags)).toBe(
        'I reviewed the irreversible effect',
      );
    }
  });

  it('adds permanent-record risk to irreversible public-record actions in live mode only', () => {
    const permanentRecordActionClasses = [
      'green-goods-create-garden',
      'green-goods-create-garden-pools',
      'green-goods-create-assessment',
      'green-goods-mint-hypercert',
      'green-goods-submit-work-submission',
      'green-goods-submit-impact-report',
      'erc8004-register-agent',
      'erc8004-give-feedback',
    ] as const;

    for (const actionClass of permanentRecordActionClasses) {
      expect(classifyActionRisks({ actionClass, onchainMode: 'live' })).toEqual({
        riskTags: ['permanent-record', 'live'],
        requiresExplicitAcknowledgement: true,
      });

      expect(classifyActionRisks({ actionClass, onchainMode: 'mock' })).toEqual({
        riskTags: [],
        requiresExplicitAcknowledgement: false,
      });
    }
  });
});

describe('action risk formatters', () => {
  it('formats the deterministic review summaries', () => {
    expect(formatActionRiskReviewSummary(['permanent-record', 'live'])).toBe(
      'this will create a permanent public record',
    );
    expect(formatActionRiskReviewSummary(['live', 'sync'])).toBe(
      'this will affect live external state',
    );
    expect(formatActionRiskReviewSummary(['permission'])).toBe(
      'this changes who can act or what they can control',
    );
    expect(formatActionRiskReviewSummary(['destructive'])).toBe(
      'this can irreversibly change existing state',
    );
    expect(formatActionRiskReviewSummary(['publish'])).toBe(
      'this will move a draft into shared coop space',
    );
    expect(formatActionRiskReviewSummary(['archive'])).toBe(
      'this will send material to external archive storage',
    );
    expect(formatActionRiskReviewSummary(['sync'])).toBe(
      'this will reconcile state across systems',
    );
  });

  it('formats acknowledgement labels for the high-risk tags only', () => {
    expect(formatActionRiskAcknowledgementLabel(['permanent-record', 'live'])).toBe(
      'I reviewed the permanent public record',
    );
    expect(formatActionRiskAcknowledgementLabel(['permanent-record', 'live', 'destructive'])).toBe(
      'I reviewed the permanent public record',
    );
    expect(formatActionRiskAcknowledgementLabel(['live', 'sync'])).toBe(
      'I reviewed the live effect',
    );
    expect(formatActionRiskAcknowledgementLabel(['permission'])).toBe(
      'I reviewed the permission change',
    );
    expect(formatActionRiskAcknowledgementLabel(['permission', 'destructive'])).toBe(
      'I reviewed the irreversible effect',
    );
    expect(formatActionRiskAcknowledgementLabel(['destructive'])).toBe(
      'I reviewed the irreversible effect',
    );
    expect(formatActionRiskAcknowledgementLabel(['publish'])).toBeNull();
  });

  it('formats the permanence badge label', () => {
    expect(formatActionRiskTagLabel('permanent-record')).toBe('Permanent Record');
  });

  it('collects and orders risk tags deterministically across multiple items', () => {
    expect(
      collectActionRiskTags([
        { riskTags: ['sync', 'archive'] },
        null,
        { riskTags: ['permanent-record'] },
        { riskTags: ['permission', 'archive'] },
        { riskTags: ['live'] },
      ]),
    ).toEqual(['permanent-record', 'live', 'permission', 'archive', 'sync']);
  });

  it('requires acknowledgement when an item explicitly requests it or carries a high-risk tag', () => {
    expect(
      requiresExplicitAcknowledgementForItems([
        { riskTags: ['publish'] },
        { requiresExplicitAcknowledgement: true },
      ]),
    ).toBe(true);
    expect(
      requiresExplicitAcknowledgementForItems([
        { riskTags: ['permission'] },
        { riskTags: ['archive'] },
      ]),
    ).toBe(true);
    expect(
      requiresExplicitAcknowledgementForItems([
        { riskTags: ['publish'] },
        { riskTags: ['archive'] },
      ]),
    ).toBe(false);
  });
});
