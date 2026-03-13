export const AGENT_SETTING_KEYS = {
  autoRunSkillIds: 'agent-auto-run-skill-ids',
  cycleRequest: 'agent-cycle-request',
  cycleState: 'agent-cycle-state',
} as const;

// Passive pipeline relevance scores for strong funding/opportunity pages currently
// cluster around the low 0.20s, so the agent trigger threshold needs to track
// that calibrated range instead of assuming a near-1.0 confidence scale.
export const AGENT_HIGH_CONFIDENCE_THRESHOLD = 0.24;
export const AGENT_LOOP_POLL_INTERVAL_MS = 1500;
export const AGENT_LOOP_WAIT_TIMEOUT_MS = 7000;

export type AgentCycleRequest = {
  id: string;
  requestedAt: string;
  reason: string;
  force?: boolean;
};

export type AgentCycleState = {
  running: boolean;
  lastStartedAt?: string;
  lastCompletedAt?: string;
  lastError?: string;
  lastRequestId?: string;
  lastRequestAt?: string;
};
