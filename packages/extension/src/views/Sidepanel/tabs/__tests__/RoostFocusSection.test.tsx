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

    expect(screen.getByText('2 prepared actions need your review')).toBeInTheDocument();
    expect(screen.queryByText('2 prepared actions need your judgment')).toBeNull();
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

    expect(screen.getByText('2 prepared actions need your judgment')).toBeInTheDocument();
    expect(screen.queryByText('2 prepared actions need your review')).toBeNull();
  });

  it('uses plain fresh-look copy for stale helper work', () => {
    render(
      <FocusSection
        summary={{ pendingDrafts: 0, staleObservationCount: 1 } as never}
        pendingPlans={[]}
        recentArtifacts={[]}
        onOpenSynthesisSegment={vi.fn()}
        onRunAgentCycle={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByText('1 item needs a fresh look')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh suggestions' })).toBeInTheDocument();
    expect(screen.queryByText(/stale observation/i)).toBeNull();
    expect(screen.queryByText(/run agent/i)).toBeNull();
  });
});
