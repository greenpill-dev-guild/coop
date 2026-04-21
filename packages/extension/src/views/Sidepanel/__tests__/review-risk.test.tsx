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
  it('keeps publish/archive plans in passive approval mode without requiring acknowledgement', () => {
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

    expect(planNeedsJudgment(plan)).toBe(false);
    expect(cue.visibleTags).toEqual(['publish', 'archive']);
    expect(cue.overflowCount).toBe(0);
    expect(cue.helperLine).toBe('Approval will move a draft into shared coop space');
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

  it('keeps sync-only plans in passive approval mode without requiring acknowledgement', () => {
    const plan = {
      id: 'plan-sync',
      actionProposals: [
        {
          id: 'proposal-sync',
          riskTags: ['sync'],
          requiresExplicitAcknowledgement: false,
        },
      ],
    } as never;

    const cue = getPlanJudgmentCue(plan);

    expect(planNeedsJudgment(plan)).toBe(false);
    expect(cue.visibleTags).toEqual(['sync']);
    expect(cue.overflowCount).toBe(0);
    expect(cue.helperLine).toBe('Approval will reconcile state across systems');
    expect(cue.requiresAcknowledgement).toBe(false);

    render(
      <div>
        {renderRiskBadges('plan-sync', cue)}
        {renderAcknowledgementControl({
          checked: false,
          cue,
          onToggle: vi.fn(),
        })}
      </div>,
    );

    expect(screen.getByText('Sync')).toBeInTheDocument();
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

  it('uses irreversible acknowledgement copy for permission-destructive bundles', () => {
    const bundle = {
      id: 'bundle-irreversible',
      riskTags: ['permission', 'destructive'],
      requiresExplicitAcknowledgement: true,
    } as never;

    const cue = getBundleJudgmentCue(bundle);

    expect(cue.visibleTags).toEqual(['permission', 'destructive']);
    expect(cue.overflowCount).toBe(0);
    expect(cue.helperLine).toBe(
      'Needs judgment: this changes who can act or what they can control',
    );
    expect(cue.requiresAcknowledgement).toBe(true);
    expect(cue.acknowledgementLabel).toBe('I reviewed the irreversible effect');

    render(
      <div>
        {renderRiskBadges('bundle-irreversible', cue)}
        {renderAcknowledgementControl({
          checked: false,
          cue,
          onToggle: vi.fn(),
        })}
      </div>,
    );

    expect(screen.getByText('Permission')).toBeInTheDocument();
    expect(screen.getByText('Destructive')).toBeInTheDocument();
    expect(screen.getByLabelText('I reviewed the irreversible effect')).toBeInTheDocument();
  });

  it('shows permanence helper copy and acknowledgement controls for permanent public records', () => {
    const bundle = {
      id: 'bundle-record',
      riskTags: ['permanent-record', 'live'],
      requiresExplicitAcknowledgement: true,
    } as never;

    const cue = getBundleJudgmentCue(bundle);

    expect(cue.visibleTags).toEqual(['permanent-record', 'live']);
    expect(cue.overflowCount).toBe(0);
    expect(cue.helperLine).toBe('Needs judgment: this will create a permanent public record');
    expect(cue.requiresAcknowledgement).toBe(true);
    expect(cue.acknowledgementLabel).toBe('I reviewed the permanent public record');

    render(
      <div>
        {renderRiskBadges('bundle-record', cue)}
        {renderAcknowledgementControl({
          checked: false,
          cue,
          onToggle: vi.fn(),
        })}
      </div>,
    );

    expect(screen.getByText('Permanent Record')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByLabelText('I reviewed the permanent public record')).toBeInTheDocument();
  });
});
