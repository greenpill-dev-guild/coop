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
export const AGENT_MAX_CONSECUTIVE_FAILURES = 3;
export const AGENT_SKILL_TIMEOUT_MS = 30_000;
export const AGENT_QUALITY_STALL_THRESHOLD = 0.3;
export const AGENT_QUALITY_WINDOW_SIZE = 10;
export const AGENT_STUCK_STATE_TIMEOUT_MS = 5 * 60 * 1000;

export type AgentCycleRequest = {
  id: string;
  requestedAt: string;
  reason: string;
  force?: boolean;
};

export type QualityTrend = 'stable' | 'degrading' | 'recovering';

export type AgentCycleState = {
  running: boolean;
  lastStartedAt?: string;
  lastCompletedAt?: string;
  lastError?: string;
  lastRequestId?: string;
  lastRequestAt?: string;
  consecutiveFailureCount?: number;
  recentQualityScores?: number[];
  qualityTrend?: QualityTrend;
};

export function computeQualityTrend(scores: number[]): QualityTrend {
  if (scores.length < 3) return 'stable';

  const recent = scores.slice(-3);
  const earlier = scores.slice(-6, -3);
  if (earlier.length === 0) return 'stable';

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;

  if (recentAvg < earlierAvg - 0.15) return 'degrading';
  if (recentAvg > earlierAvg + 0.1) return 'recovering';
  return 'stable';
}

export function recentQualityAverage(scores: number[], window = 3): number {
  if (scores.length === 0) return 1;
  const recent = scores.slice(-window);
  return recent.reduce((a, b) => a + b, 0) / recent.length;
}

export function pushQualityScore(
  scores: number[],
  newScore: number,
  windowSize = AGENT_QUALITY_WINDOW_SIZE,
): number[] {
  const updated = [...scores, newScore];
  return updated.length > windowSize ? updated.slice(-windowSize) : updated;
}
