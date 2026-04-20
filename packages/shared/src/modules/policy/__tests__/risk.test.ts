import { describe, expect, it } from 'vitest';
import {
  classifyActionRisks,
  collectActionRiskTags,
  formatActionRiskAcknowledgementLabel,
  formatActionRiskReviewSummary,
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
    expect(
      classifyActionRisks({ actionClass: 'green-goods-remove-gardener', onchainMode: 'mock' }),
    ).toEqual({
      riskTags: ['permission', 'destructive'],
      requiresExplicitAcknowledgement: true,
    });
  });
});

describe('action risk formatters', () => {
  it('formats the deterministic review summaries', () => {
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
    expect(formatActionRiskAcknowledgementLabel(['live', 'sync'])).toBe(
      'I reviewed the live effect',
    );
    expect(formatActionRiskAcknowledgementLabel(['permission'])).toBe(
      'I reviewed the permission change',
    );
    expect(formatActionRiskAcknowledgementLabel(['destructive'])).toBe(
      'I reviewed the irreversible effect',
    );
    expect(formatActionRiskAcknowledgementLabel(['publish'])).toBeNull();
  });

  it('collects and orders risk tags deterministically across multiple items', () => {
    expect(
      collectActionRiskTags([
        { riskTags: ['sync', 'archive'] },
        null,
        { riskTags: ['permission', 'archive'] },
        { riskTags: ['live'] },
      ]),
    ).toEqual(['live', 'permission', 'archive', 'sync']);
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
