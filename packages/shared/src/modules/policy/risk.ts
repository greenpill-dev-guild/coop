import type { ActionRiskTag, IntegrationMode, PolicyActionClass } from '../../contracts/schema';

export const actionRiskPriority: readonly ActionRiskTag[] = [
  'live',
  'permission',
  'destructive',
  'publish',
  'archive',
  'sync',
];

const ACTION_RISK_PRIORITY_INDEX = new Map(
  actionRiskPriority.map((tag, index) => [tag, index] as const),
);

const ACTION_RISKS_REQUIRING_ACKNOWLEDGEMENT = new Set<ActionRiskTag>([
  'live',
  'permission',
  'destructive',
]);

const ARCHIVE_ACTION_CLASSES = new Set<PolicyActionClass>(['archive-artifact', 'archive-snapshot']);

const SYNC_ACTION_CLASSES = new Set<PolicyActionClass>([
  'refresh-archive-status',
  'green-goods-sync-garden-profile',
  'green-goods-set-garden-domains',
  'green-goods-sync-gap-admins',
]);

const PERMISSION_ACTION_CLASSES = new Set<PolicyActionClass>([
  'safe-add-owner',
  'green-goods-add-gardener',
  'safe-remove-owner',
  'safe-swap-owner',
  'safe-change-threshold',
  'green-goods-remove-gardener',
]);

const DESTRUCTIVE_ACTION_CLASSES = new Set<PolicyActionClass>([
  'safe-remove-owner',
  'safe-swap-owner',
  'safe-change-threshold',
  'green-goods-remove-gardener',
]);

const ONCHAIN_ACTION_CLASSES = new Set<PolicyActionClass>([
  'safe-deployment',
  'safe-add-owner',
  'safe-remove-owner',
  'safe-swap-owner',
  'safe-change-threshold',
  'green-goods-create-garden',
  'green-goods-sync-garden-profile',
  'green-goods-set-garden-domains',
  'green-goods-create-garden-pools',
  'green-goods-submit-work-approval',
  'green-goods-create-assessment',
  'green-goods-sync-gap-admins',
  'green-goods-mint-hypercert',
  'green-goods-add-gardener',
  'green-goods-remove-gardener',
  'green-goods-submit-work-submission',
  'green-goods-submit-impact-report',
  'erc8004-register-agent',
  'erc8004-give-feedback',
]);

export function sortActionRiskTags(tags: readonly ActionRiskTag[]): ActionRiskTag[] {
  return [...new Set(tags)].sort((left, right) => {
    const leftIndex = ACTION_RISK_PRIORITY_INDEX.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = ACTION_RISK_PRIORITY_INDEX.get(right) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });
}

export function getHighestPriorityActionRiskTag(
  tags: readonly ActionRiskTag[],
): ActionRiskTag | null {
  return sortActionRiskTags(tags)[0] ?? null;
}

export function classifyActionRisks(input: {
  actionClass: PolicyActionClass;
  onchainMode?: IntegrationMode;
}): {
  riskTags: ActionRiskTag[];
  requiresExplicitAcknowledgement: boolean;
} {
  const tags: ActionRiskTag[] = [];

  if (input.actionClass === 'publish-ready-draft') {
    tags.push('publish');
  }
  if (ARCHIVE_ACTION_CLASSES.has(input.actionClass)) {
    tags.push('archive');
  }
  if (SYNC_ACTION_CLASSES.has(input.actionClass)) {
    tags.push('sync');
  }
  if (PERMISSION_ACTION_CLASSES.has(input.actionClass)) {
    tags.push('permission');
  }
  if (DESTRUCTIVE_ACTION_CLASSES.has(input.actionClass)) {
    tags.push('destructive');
  }
  if (input.onchainMode === 'live' && ONCHAIN_ACTION_CLASSES.has(input.actionClass)) {
    tags.push('live');
  }

  const riskTags = sortActionRiskTags(tags);

  return {
    riskTags,
    requiresExplicitAcknowledgement: hasAcknowledgementRisk(riskTags),
  };
}

export function hasAcknowledgementRisk(tags: readonly ActionRiskTag[]) {
  return sortActionRiskTags(tags).some((tag) => ACTION_RISKS_REQUIRING_ACKNOWLEDGEMENT.has(tag));
}

export function collectActionRiskTags(
  items: Array<{ riskTags?: readonly ActionRiskTag[] | undefined } | null | undefined>,
): ActionRiskTag[] {
  return sortActionRiskTags(items.flatMap((item) => item?.riskTags ?? []));
}

export function requiresExplicitAcknowledgementForItems(
  items: Array<
    | {
        riskTags?: readonly ActionRiskTag[] | undefined;
        requiresExplicitAcknowledgement?: boolean | undefined;
      }
    | null
    | undefined
  >,
) {
  return items.some(
    (item) =>
      Boolean(item?.requiresExplicitAcknowledgement) ||
      hasAcknowledgementRisk(item?.riskTags ?? []),
  );
}

export function formatActionRiskTagLabel(tag: ActionRiskTag) {
  switch (tag) {
    case 'publish':
      return 'Publish';
    case 'archive':
      return 'Archive';
    case 'sync':
      return 'Sync';
    case 'permission':
      return 'Permission';
    case 'live':
      return 'Live';
    case 'destructive':
      return 'Destructive';
  }
}

export function formatActionRiskReviewSummary(tags: readonly ActionRiskTag[]): string | null {
  switch (getHighestPriorityActionRiskTag(tags)) {
    case 'live':
      return 'this will affect live external state';
    case 'permission':
      return 'this changes who can act or what they can control';
    case 'destructive':
      return 'this can irreversibly change existing state';
    case 'publish':
      return 'this will move a draft into shared coop space';
    case 'archive':
      return 'this will send material to external archive storage';
    case 'sync':
      return 'this will reconcile state across systems';
    default:
      return null;
  }
}

export function formatActionRiskAcknowledgementLabel(
  tags: readonly ActionRiskTag[],
): string | null {
  const prioritized = sortActionRiskTags(tags);
  const primaryHighRisk = prioritized.find((tag) =>
    ACTION_RISKS_REQUIRING_ACKNOWLEDGEMENT.has(tag),
  );

  switch (primaryHighRisk) {
    case 'live':
      return 'I reviewed the live effect';
    case 'permission':
      return 'I reviewed the permission change';
    case 'destructive':
      return 'I reviewed the irreversible effect';
    default:
      return null;
  }
}
