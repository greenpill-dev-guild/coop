import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  getBundleJudgmentCue,
  getPlanJudgmentCue,
  planNeedsJudgment,
  renderAcknowledgementControl,
  renderRiskBadges,
} from '../review-risk';

describe('review risk helpers', () => {
  it('keeps publish/archive plans in judgment mode without requiring acknowledgement', () => {
    const plan = {
      id: 'plan-review',
      actionProposals: [
        {
          id: 'proposal-review',
          riskTags: ['publish', 'archive'],
          requiresExplicitAcknowledgement: false,
        },
      ],
    } as never;

    const cue = getPlanJudgmentCue(plan);

    expect(planNeedsJudgment(plan)).toBe(true);
    expect(cue.visibleTags).toEqual(['publish', 'archive']);
    expect(cue.overflowCount).toBe(0);
    expect(cue.helperLine).toBe('Needs judgment: this will move a draft into shared coop space');
    expect(cue.requiresAcknowledgement).toBe(false);

    render(
      <div>
        {renderRiskBadges('plan-review', cue)}
        {renderAcknowledgementControl({
          checked: false,
          cue,
          onToggle: vi.fn(),
        })}
      </div>,
    );

    expect(screen.getByText('Publish')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('shows acknowledgement controls and overflow badges for high-risk bundles', () => {
    const bundle = {
      id: 'bundle-risk',
      riskTags: ['live', 'permission', 'sync'],
      requiresExplicitAcknowledgement: true,
    } as never;

    const cue = getBundleJudgmentCue(bundle);

    expect(cue.visibleTags).toEqual(['live', 'permission']);
    expect(cue.overflowCount).toBe(1);
    expect(cue.requiresAcknowledgement).toBe(true);
    expect(cue.acknowledgementLabel).toBe('I reviewed the live effect');

    render(
      <div>
        {renderRiskBadges('bundle-risk', cue)}
        {renderAcknowledgementControl({
          checked: false,
          cue,
          onToggle: vi.fn(),
        })}
      </div>,
    );

    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Permission')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.getByLabelText('I reviewed the live effect')).toBeInTheDocument();
  });
});
