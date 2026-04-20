import { createId, nowIso } from '@coop/shared';
import { listAgentObservationsByStatus } from '@coop/shared';
import {
  AGENT_LOOP_WAIT_TIMEOUT_MS,
  AGENT_SETTING_KEYS,
  type AgentCycleRequest,
  type AgentCycleState,
} from '../../runtime/agent/config';
import { ensureReceiverSyncOffscreenDocument, getLocalSetting, setLocalSetting } from '../context';
import { db } from '../context';
import { syncAgentObservations } from './agent-reconciliation';

const AGENT_CYCLE_POKE_INTERVAL_MS = 100;
const AGENT_CYCLE_POKE_TIMEOUT_MS = 1_500;

export async function getAgentCycleState() {
  return getLocalSetting<AgentCycleState>(AGENT_SETTING_KEYS.cycleState, {
    running: false,
  });
}

export async function getAgentAutoRunSkillIds() {
  return getLocalSetting<string[]>(AGENT_SETTING_KEYS.autoRunSkillIds, []);
}

export async function requestAgentCycle(
  reason: string,
  force = false,
  options: { waitForRunner?: boolean } = {},
) {
  const request: AgentCycleRequest = {
    id: createId('agent-cycle'),
    requestedAt: nowIso(),
    reason,
    force,
  };
  await setLocalSetting(AGENT_SETTING_KEYS.cycleRequest, request);
  await ensureReceiverSyncOffscreenDocument();
  if (options.waitForRunner) {
    await pokeOffscreenAgentRunner(request);
  } else {
    await pokeOffscreenAgentRunnerOnce(request);
  }
  return request;
}

export async function drainAgentCycles(input: {
  reason: string;
  force?: boolean;
  maxPasses?: number;
  syncBetweenPasses?: boolean;
}) {
  const maxPasses = input.maxPasses ?? 2;
  for (let pass = 0; pass < maxPasses; pass += 1) {
    if (pass > 0 && input.syncBetweenPasses) {
      await syncAgentObservations();
    }
    const pending = await listAgentObservationsByStatus(db, ['pending']);
    if (pending.length === 0 && pass > 0) {
      break;
    }
    const request = await requestAgentCycle(`${input.reason}:pass-${pass + 1}`, input.force, {
      waitForRunner: true,
    });
    await waitForAgentCycle(request);
  }
}

export async function waitForAgentCycle(
  request: AgentCycleRequest,
  timeoutMs = AGENT_LOOP_WAIT_TIMEOUT_MS,
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const state = await getAgentCycleState();
    if (
      state.lastRequestId === request.id &&
      state.lastCompletedAt &&
      state.lastCompletedAt >= request.requestedAt &&
      state.running === false
    ) {
      return state;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return getAgentCycleState();
}

async function pokeOffscreenAgentRunner(request: AgentCycleRequest) {
  const deadline = Date.now() + AGENT_CYCLE_POKE_TIMEOUT_MS;
  let lastError: unknown;

  while (Date.now() <= deadline) {
    try {
      await chrome.runtime.sendMessage({
        type: 'run-agent-cycle-if-pending',
        payload: { reason: request.reason, force: request.force },
      });
    } catch (error) {
      lastError = error;
    }

    const state = await getAgentCycleState();
    const cycleStarted =
      state.lastRequestId === request.id &&
      (state.running === true ||
        (state.lastCompletedAt != null && state.lastCompletedAt >= request.requestedAt));
    if (cycleStarted) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, AGENT_CYCLE_POKE_INTERVAL_MS));
  }

  if (lastError) {
    console.warn('[agent-cycle] Could not poke offscreen agent runner:', lastError);
  }
}

async function pokeOffscreenAgentRunnerOnce(request: AgentCycleRequest) {
  try {
    await chrome.runtime.sendMessage({
      type: 'run-agent-cycle-if-pending',
      payload: { reason: request.reason, force: request.force },
    });
  } catch (error) {
    console.warn('[agent-cycle] Could not poke offscreen agent runner:', error);
  }
}
