import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AgentSection } from '../RoostAgentSection';

describe('Roost AgentSection', () => {
  it('switches to judgment framing and gates approval for high-risk plans', async () => {
    const user = userEvent.setup();
    const onApproveAgentPlan = vi.fn();

    render(
      <AgentSection
        summary={{ agentCadenceMinutes: 8 } as never}
        lastCompletedRun={null}
        pendingPlans={[
          {
            id: 'plan-risk',
            goal: 'Rotate Safe ownership',
            confidence: 0.91,
            actionProposals: [
              {
                id: 'proposal-risk',
                riskTags: ['live', 'permission', 'destructive'],
                requiresExplicitAcknowledgement: true,
              },
            ],
          } as never,
        ]}
        recentObservations={[]}
        recentMemories={[]}
        knowledgeTopics={[]}
        knowledgeStats={{ entities: 0, relationships: 0, sources: 0 }}
        decisions={[]}
        onRunAgentCycle={vi.fn(async () => undefined)}
        onApproveAgentPlan={onApproveAgentPlan}
        onRejectAgentPlan={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Needs Judgment' })).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Permission')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(
      screen.getByText(/Needs judgment: this will affect live external state/i),
    ).toBeInTheDocument();

    const approveButton = screen.getByRole('button', { name: 'Approve' });
    expect(approveButton).toBeDisabled();

    await user.click(screen.getByLabelText('I reviewed the irreversible effect'));
    expect(approveButton).toBeEnabled();

    await user.click(approveButton);
    expect(onApproveAgentPlan).toHaveBeenCalledWith('plan-risk');
  });

  it('renders a permanence-specific warning for irreversible public-record plans', async () => {
    const user = userEvent.setup();
    const onApproveAgentPlan = vi.fn();

    render(
      <AgentSection
        summary={{ agentCadenceMinutes: 8 } as never}
        lastCompletedRun={null}
        pendingPlans={[
          {
            id: 'plan-record',
            goal: 'Register the agent publicly',
            confidence: 0.88,
            actionProposals: [
              {
                id: 'proposal-record',
                riskTags: ['permanent-record', 'live'],
                requiresExplicitAcknowledgement: true,
              },
            ],
          } as never,
        ]}
        recentObservations={[]}
        recentMemories={[]}
        knowledgeTopics={[]}
        knowledgeStats={{ entities: 0, relationships: 0, sources: 0 }}
        decisions={[]}
        onRunAgentCycle={vi.fn(async () => undefined)}
        onApproveAgentPlan={onApproveAgentPlan}
        onRejectAgentPlan={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Needs Judgment' })).toBeInTheDocument();
    expect(screen.getByText('Permanent Record')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(
      screen.getByText(/Needs judgment: this will create a permanent public record/i),
    ).toBeInTheDocument();

    const approveButton = screen.getByRole('button', { name: 'Approve' });
    expect(approveButton).toBeDisabled();

    await user.click(screen.getByLabelText('I reviewed the permanent public record'));
    expect(approveButton).toBeEnabled();

    await user.click(approveButton);
    expect(onApproveAgentPlan).toHaveBeenCalledWith('plan-record');
  });

  it('keeps low-risk plans in approval mode without acknowledgement controls', () => {
    render(
      <AgentSection
        summary={{ agentCadenceMinutes: 8 } as never}
        lastCompletedRun={null}
        pendingPlans={[
          {
            id: 'plan-approval',
            goal: 'Publish the reviewed draft',
            confidence: 0.76,
            actionProposals: [
              {
                id: 'proposal-approval',
                riskTags: ['publish'],
                requiresExplicitAcknowledgement: false,
              },
            ],
          } as never,
        ]}
        recentObservations={[]}
        recentMemories={[]}
        knowledgeTopics={[]}
        knowledgeStats={{ entities: 0, relationships: 0, sources: 0 }}
        decisions={[]}
        onRunAgentCycle={vi.fn(async () => undefined)}
        onApproveAgentPlan={vi.fn(async () => undefined)}
        onRejectAgentPlan={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Needs Approval' })).toBeInTheDocument();
    expect(screen.getByText('Publish')).toBeInTheDocument();
    expect(
      screen.getByText(/Approval will move a draft into shared coop space/i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/I reviewed/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
  });
});
