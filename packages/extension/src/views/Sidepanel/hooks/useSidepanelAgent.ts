import { type AgentDashboardResponse, sendRuntimeMessage } from '../../../runtime/messages';
import type { useDashboard } from './useDashboard';

function friendlyAgentError(raw: string | undefined): string {
  if (!raw) return 'Could not run the agent cycle.';
  if (raw.includes('passkey session')) return 'Sign in with your passkey first.';
  if (raw.includes('Select a coop')) return 'Select a coop first.';
  if (raw.includes('limited to creator or trusted')) return 'Only trusted members can run helpers.';
  return raw;
}

export interface SidepanelAgentDeps {
  setMessage: (msg: string) => void;
  setAgentDashboard: (data: AgentDashboardResponse | null) => void;
  loadDashboard: ReturnType<typeof useDashboard>['loadDashboard'];
  loadAgentDashboard: () => Promise<void>;
}

export function useSidepanelAgent(deps: SidepanelAgentDeps) {
  const { setMessage, setAgentDashboard, loadDashboard, loadAgentDashboard } = deps;

  async function handleRunAgentCycle() {
    const response = await sendRuntimeMessage<AgentDashboardResponse>({
      type: 'run-agent-cycle',
    });
    if (!response.ok || !response.data) {
      setMessage(friendlyAgentError(response.error));
      return;
    }
    setAgentDashboard(response.data);
    // Success toast is handled by the AGENT_CYCLE_FINISHED background event
    // in useDashboard, so we don't set a message here.
    await loadDashboard();
  }

  async function handleApproveAgentPlan(planId: string) {
    const response = await sendRuntimeMessage({
      type: 'approve-agent-plan',
      payload: { planId },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not approve the agent plan.');
      return;
    }
    await loadAgentDashboard();
    await loadDashboard();
  }

  async function handleRejectAgentPlan(planId: string) {
    const response = await sendRuntimeMessage({
      type: 'reject-agent-plan',
      payload: { planId },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not reject the agent plan.');
      return;
    }
    await loadAgentDashboard();
  }

  async function handleRetrySkillRun(skillRunId: string) {
    const response = await sendRuntimeMessage<AgentDashboardResponse>({
      type: 'retry-skill-run',
      payload: { skillRunId },
    });
    if (!response.ok || !response.data) {
      setMessage(response.error ?? 'Could not retry the skill run.');
      return;
    }
    setAgentDashboard(response.data);
    await loadDashboard();
  }

  async function handleToggleSkillAutoRun(skillId: string, enabled: boolean) {
    const response = await sendRuntimeMessage<string[]>({
      type: 'set-agent-skill-auto-run',
      payload: { skillId, enabled },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update the auto-run setting.');
      return;
    }
    await loadAgentDashboard();
  }

  return {
    handleRunAgentCycle,
    handleApproveAgentPlan,
    handleRejectAgentPlan,
    handleRetrySkillRun,
    handleToggleSkillAutoRun,
  };
}
