import { type CaptureMode, getFvmExplorerTxUrl } from '@coop/shared';
import type { InferenceBridgeState } from '../../runtime/inference-bridge';

export function formatRoundUpTiming(mode: CaptureMode) {
  switch (mode) {
    case '30-min':
      return 'Every 30 min';
    case '60-min':
      return 'Every 60 min';
    default:
      return 'Only when you choose';
  }
}

export function formatSharedWalletMode(mode: string) {
  return mode === 'live' ? 'Live' : 'Practice';
}

export function formatGardenPassMode(mode: string) {
  switch (mode) {
    case 'live':
      return 'Live';
    case 'mock':
      return 'Practice';
    default:
      return 'Off';
  }
}

export function formatSavedProofScope(scope: 'artifact' | 'snapshot') {
  return scope === 'snapshot' ? 'Coop snapshot' : 'Shared find';
}

export function formatSavedProofStatus(status: 'pending' | 'offered' | 'indexed' | 'sealed') {
  switch (status) {
    case 'pending':
      return 'Waiting';
    case 'offered':
      return 'Saved';
    case 'indexed':
      return 'Tracked';
    case 'sealed':
      return 'Deep saved';
  }
}

export function formatSavedProofMode(mode: 'live' | 'mock') {
  return mode === 'live' ? 'Live save' : 'Practice save';
}

export function formatArtifactCategoryLabel(category: string) {
  switch (category) {
    case 'setup-insight':
      return 'Setup insight';
    case 'coop-soul':
      return 'Coop soul';
    case 'ritual':
      return 'Ritual';
    case 'seed-contribution':
      return 'Starter note';
    case 'resource':
      return 'Resource';
    case 'thought':
      return 'Thought';
    case 'insight':
      return 'Insight';
    case 'funding-lead':
      return 'Funding lead';
    case 'evidence':
      return 'Evidence';
    case 'opportunity':
      return 'Opportunity';
    case 'next-step':
      return 'Next step';
    default:
      return category;
  }
}

export function formatReviewStatusLabel(status: string) {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'published':
      return 'Shared';
    case 'reviewed':
      return 'Checked';
    case 'actioned':
      return 'Used';
    default:
      return status;
  }
}

export function formatSaveStatusLabel(status: string) {
  switch (status) {
    case 'not-archived':
      return 'Not saved';
    case 'pending':
      return 'Saving';
    case 'archived':
      return 'Saved';
    default:
      return status;
  }
}

export function getAnchorExplorerUrl(txHash: string, chainKey: string): string {
  if (chainKey === 'arbitrum') {
    return `https://arbiscan.io/tx/${txHash}`;
  }
  return `https://sepolia.arbiscan.io/tx/${txHash}`;
}

export { getFvmExplorerTxUrl };

export function getFilfoxProviderUrl(providerId: string): string {
  return `https://filfox.info/en/address/${providerId}`;
}

export function getFilfoxDealUrl(dealId: string): string {
  return `https://filfox.info/en/deal/${dealId}`;
}

export function truncateCid(cid: string, prefixLen = 8, suffixLen = 6): string {
  if (cid.length <= prefixLen + suffixLen + 3) return cid;
  return `${cid.slice(0, prefixLen)}...${cid.slice(-suffixLen)}`;
}

export function describeLocalHelperState(capability?: InferenceBridgeState['capability'] | null) {
  switch (capability?.status) {
    case 'disabled':
      return 'Quick rules only';
    case 'unavailable':
      return 'Private helper unavailable';
    case 'loading':
      return 'Waking up private helper...';
    case 'ready':
      return capability.model
        ? `Private helper ready (${capability.model})`
        : 'Private helper ready';
    case 'running':
      return 'Private helper is working...';
    case 'failed':
      return capability.reason
        ? `Private helper had trouble: ${capability.reason}`
        : 'Private helper had trouble';
    default:
      return 'Quick rules first';
  }
}
