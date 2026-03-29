import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AgentObservationsSection from '../operator-sections/AgentObservationsSection';

describe('AgentObservationsSection', () => {
  it('renders empty states when nothing has run yet', () => {
    render(
      <AgentObservationsSection
        agentObservations={[]}
        agentPlans={[]}
        skillRuns={[]}
        onApprovePlan={vi.fn()}
        onRejectPlan={vi.fn()}
        onRetrySkillRun={vi.fn()}
      />,
    );

    expect(screen.getByText('No helper notes yet.')).toBeInTheDocument();
    expect(screen.getByText('No helper plans yet.')).toBeInTheDocument();
    expect(screen.getByText('No helper runs recorded.')).toBeInTheDocument();
  });

  it('renders observations, plans, and failed runs with actions', async () => {
    const user = userEvent.setup();
    const onApprovePlan = vi.fn();
    const onRejectPlan = vi.fn();
    const onRetrySkillRun = vi.fn();

    render(
      <AgentObservationsSection
        agentObservations={[
          {
            id: 'obs-1',
            trigger: 'cadence',
            status: 'blocked',
            coopId: 'coop-1',
            title: 'Need a better summary',
            summary: 'The helper needs more context.',
            blockedReason: 'Missing ritual',
          } as never,
        ]}
        agentPlans={[
          {
            id: 'plan-1',
            status: 'pending',
            provider: 'heuristic',
            actionProposals: [{ id: 'proposal-1' }],
            goal: 'Prepare next ritual',
            rationale: 'The coop has enough signal.',
          } as never,
        ]}
        skillRuns={[
          {
            id: 'run-1',
            skillId: 'setup-insights',
            status: 'failed',
            provider: 'transformers',
            outputSchemaRef: 'schema://setup-insights',
            startedAt: '2026-03-28T00:00:00.000Z',
            error: 'Model timeout',
          } as never,
        ]}
        onApprovePlan={onApprovePlan}
        onRejectPlan={onRejectPlan}
        onRetrySkillRun={onRetrySkillRun}
      />,
    );

    expect(screen.getByText('Need a better summary')).toBeInTheDocument();
    expect(screen.getByText(/The helper needs more context\..*Missing ritual/)).toBeInTheDocument();
    expect(screen.getByText('Prepare next ritual')).toBeInTheDocument();
    expect(screen.getByText('quick rules')).toBeInTheDocument();
    expect(screen.getByText('schema://setup-insights')).toBeInTheDocument();
    expect(screen.getByText(/Started .*Model timeout/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Approve plan' }));
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onApprovePlan).toHaveBeenCalledWith('plan-1');
    expect(onRejectPlan).toHaveBeenCalledWith('plan-1');
    expect(onRetrySkillRun).toHaveBeenCalledWith('run-1');
  });
});
