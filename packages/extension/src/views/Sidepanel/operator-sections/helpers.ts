import type {
  ActionBundle,
  ActionLogEntry,
  AgentPlan,
  IntegrationMode,
  PrivilegedActionLogEntry,
  SessionCapabilityLogEntry,
  SessionCapableActionClass,
  SessionMode,
  SkillRun,
} from '@coop/shared';
import type { AgentDashboardKnowledgeSkill } from '../../../runtime/messages';

/* ------------------------------------------------------------------ */
/*  Shared formatting helpers                                          */
/* ------------------------------------------------------------------ */

export function formatActionLabel(entry: PrivilegedActionLogEntry) {
  switch (entry.actionType) {
    case 'anchor-mode-toggle':
      return 'Trusted mode';
    case 'archive-upload':
      return 'Saved proof upload';
    case 'archive-follow-up-refresh':
      return 'Saved proof check';
    case 'safe-deployment':
      return 'Safe deployment';
    case 'green-goods-transaction':
      return 'Green Goods transaction';
  }
}

export function formatActionStatus(status: PrivilegedActionLogEntry['status']) {
  switch (status) {
    case 'attempted':
      return 'in-flight';
    case 'succeeded':
      return 'ok';
    case 'failed':
      return 'failed';
  }
}

export function formatProviderLabel(provider: SkillRun['provider'] | AgentPlan['provider']) {
  switch (provider) {
    case 'heuristic':
      return 'quick rules';
    case 'transformers':
      return 'transformers.js';
    case 'webllm':
      return 'WebLLM';
  }
}

export function formatModeLabel(mode: IntegrationMode) {
  return mode === 'live' ? 'Live' : 'Practice';
}

export function formatGardenPassMode(mode: SessionMode) {
  switch (mode) {
    case 'live':
      return 'Live';
    case 'mock':
      return 'Practice';
    default:
      return 'Off';
  }
}

export function formatSessionLogEventLabel(eventType: SessionCapabilityLogEntry['eventType']) {
  switch (eventType) {
    case 'session-issued':
      return 'Issued';
    case 'session-rotated':
      return 'Rotated';
    case 'session-revoked':
      return 'Revoked';
    case 'session-module-installed':
      return 'Installed';
    case 'session-module-install-failed':
      return 'Install failed';
    case 'session-execution-attempted':
      return 'Execution attempted';
    case 'session-execution-succeeded':
      return 'Executed';
    case 'session-execution-failed':
      return 'Execution failed';
    case 'session-validation-rejected':
      return 'Validation rejected';
  }
}

export function defaultSessionActions(gardenAddress?: string): SessionCapableActionClass[] {
  return gardenAddress
    ? [
        'green-goods-sync-garden-profile',
        'green-goods-set-garden-domains',
        'green-goods-create-garden-pools',
      ]
    : ['green-goods-create-garden'];
}

export function isGardenerActionClass(
  actionClass: ActionBundle['actionClass'] | ActionLogEntry['actionClass'],
) {
  return (
    actionClass === 'green-goods-add-gardener' || actionClass === 'green-goods-remove-gardener'
  );
}

export function readPayloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function formatKnowledgeSkillFreshness(
  freshness: AgentDashboardKnowledgeSkill['freshness'],
) {
  switch (freshness) {
    case 'fresh':
      return 'fresh';
    case 'stale':
      return 'stale';
    case 'never-fetched':
      return 'never fetched';
  }
}
