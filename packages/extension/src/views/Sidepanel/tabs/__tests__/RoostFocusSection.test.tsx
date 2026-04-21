import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FocusSection } from '../RoostFocusSection';

describe('Roost FocusSection', () => {
  it('keeps publish-only plans in lightweight approval framing', () => {
    render(
      <FocusSection
        summary={{ pendingDrafts: 0, staleObservationCount: 0 } as never}
        pendingPlans={
          [
            {
              id: 'plan-publish-1',
              actionProposals: [
                {
                  id: 'proposal-publish-1',
                  riskTags: ['publish'],
                  requiresExplicitAcknowledgement: false,
                },
              ],
            },
            {
              id: 'plan-publish-2',
              actionProposals: [
                {
                  id: 'proposal-publish-2',
                  riskTags: ['publish'],
                  requiresExplicitAcknowledgement: false,
                },
              ],
            },
          ] as never
        }
        recentArtifacts={[]}
        onOpenSynthesisSegment={vi.fn()}
        onRunAgentCycle={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByText('2 agent plans need approval')).toBeInTheDocument();
    expect(screen.queryByText('2 agent plans need judgment')).toBeNull();
  });

  it('keeps judgment framing for mixed high-risk plans', () => {
    render(
      <FocusSection
        summary={{ pendingDrafts: 0, staleObservationCount: 0 } as never}
        pendingPlans={
          [
            {
              id: 'plan-risk-1',
              actionProposals: [
                {
                  id: 'proposal-risk-1',
                  riskTags: ['publish', 'live'],
                  requiresExplicitAcknowledgement: true,
                },
              ],
            },
            {
              id: 'plan-risk-2',
              actionProposals: [
                {
                  id: 'proposal-risk-2',
                  riskTags: ['permission', 'destructive'],
                  requiresExplicitAcknowledgement: true,
                },
              ],
            },
          ] as never
        }
        recentArtifacts={[]}
        onOpenSynthesisSegment={vi.fn()}
        onRunAgentCycle={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByText('2 agent plans need judgment')).toBeInTheDocument();
    expect(screen.queryByText('2 agent plans need approval')).toBeNull();
  });
});
