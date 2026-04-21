import type { ActionBundle, ActionRiskTag, AgentPlan } from '@coop/shared';
import {
  collectActionRiskTags,
  formatActionRiskAcknowledgementLabel,
  formatActionRiskReviewSummary,
  formatActionRiskTagLabel,
  hasAcknowledgementRisk,
  requiresExplicitAcknowledgementForItems,
} from '@coop/shared';
import type { ReactNode } from 'react';

export type JudgmentCueState = {
  riskTags: ActionRiskTag[];
  visibleTags: ActionRiskTag[];
  overflowCount: number;
  helperLine: string | null;
  acknowledgementLabel: string | null;
  requiresAcknowledgement: boolean;
};

function splitRiskBadges(tags: readonly ActionRiskTag[], visibleCount = 2) {
  return {
    visibleTags: tags.slice(0, visibleCount),
    overflowCount: Math.max(0, tags.length - visibleCount),
  };
}

function formatReviewHelperLine(tags: readonly ActionRiskTag[]) {
  const summary = formatActionRiskReviewSummary(tags);
  if (!summary) {
    return null;
  }

  if (hasAcknowledgementRisk(tags)) {
    return `Needs judgment: ${summary}`;
  }

  return summary.startsWith('this will ')
    ? `Approval will ${summary.slice('this will '.length)}`
    : `${summary[0]?.toUpperCase() ?? ''}${summary.slice(1)}`;
}

function formatAcknowledgementLabel(tags: readonly ActionRiskTag[]) {
  return formatActionRiskAcknowledgementLabel(tags);
}

function buildJudgmentCueState(
  riskTags: ActionRiskTag[],
  requiresExplicitAcknowledgement: boolean,
): JudgmentCueState {
  const riskBadges = splitRiskBadges(riskTags);
  const acknowledgementLabel = formatAcknowledgementLabel(riskTags);

  return {
    riskTags,
    visibleTags: riskBadges.visibleTags,
    overflowCount: riskBadges.overflowCount,
    helperLine: formatReviewHelperLine(riskTags),
    acknowledgementLabel,
    requiresAcknowledgement: requiresExplicitAcknowledgement && Boolean(acknowledgementLabel),
  };
}

export function getPlanRiskTags(plan: AgentPlan): ActionRiskTag[] {
  return collectActionRiskTags(plan.actionProposals);
}

export function getBundleRiskTags(bundle: ActionBundle): ActionRiskTag[] {
  return collectActionRiskTags([bundle]);
}

export function planNeedsJudgment(plan: AgentPlan) {
  return hasAcknowledgementRisk(getPlanRiskTags(plan));
}

export function getPlanJudgmentCue(plan: AgentPlan): JudgmentCueState {
  return buildJudgmentCueState(
    getPlanRiskTags(plan),
    requiresExplicitAcknowledgementForItems(plan.actionProposals),
  );
}

export function getBundleJudgmentCue(bundle: ActionBundle): JudgmentCueState {
  return buildJudgmentCueState(
    getBundleRiskTags(bundle),
    requiresExplicitAcknowledgementForItems([bundle]),
  );
}

export function getRiskBadgeLabel(tag: ActionRiskTag) {
  return formatActionRiskTagLabel(tag);
}

export function renderRiskBadges(
  scopeId: string,
  cue: Pick<JudgmentCueState, 'riskTags' | 'visibleTags' | 'overflowCount'>,
): ReactNode {
  if (cue.riskTags.length === 0) {
    return null;
  }

  return (
    <>
      {cue.visibleTags.map((tag) => (
        <span className="badge" key={`${scopeId}-${tag}`}>
          {getRiskBadgeLabel(tag)}
        </span>
      ))}
      {cue.overflowCount > 0 ? (
        <span className="badge badge--neutral">+{cue.overflowCount}</span>
      ) : null}
    </>
  );
}

export function renderAcknowledgementControl({
  checked,
  cue,
  onToggle,
}: {
  checked: boolean;
  cue: Pick<JudgmentCueState, 'requiresAcknowledgement' | 'acknowledgementLabel'>;
  onToggle: () => void;
}): ReactNode {
  if (!cue.requiresAcknowledgement || !cue.acknowledgementLabel) {
    return null;
  }

  return (
    <label className="helper-text">
      <input checked={checked} onChange={() => onToggle()} type="checkbox" />{' '}
      {cue.acknowledgementLabel}
    </label>
  );
}
