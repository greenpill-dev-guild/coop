import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AGENT_SETTING_KEYS } from '../../../runtime/agent/config';

const mockEnsureReceiverSyncOffscreenDocument = vi.fn();
const mockGetLocalSetting = vi.fn();
const mockSetLocalSetting = vi.fn();
const mockSendMessage = vi.fn();

vi.mock('@coop/shared', () => ({
  createId: vi.fn(() => 'agent-cycle-1'),
  listAgentObservationsByStatus: vi.fn().mockResolvedValue([]),
  nowIso: vi.fn(() => '2026-04-11T18:00:00.000Z'),
}));

vi.mock('../../context', () => ({
  db: {},
  ensureReceiverSyncOffscreenDocument: mockEnsureReceiverSyncOffscreenDocument,
  getLocalSetting: mockGetLocalSetting,
  setLocalSetting: mockSetLocalSetting,
}));

vi.mock('../agent-reconciliation', () => ({
  syncAgentObservations: vi.fn(),
}));

const { requestAgentCycle } = await import('../agent-cycle-helpers');

describe('agent-cycle-helpers', () => {
  beforeEach(() => {
    Object.assign(globalThis, {
      chrome: {
        runtime: {
          sendMessage: mockSendMessage,
        },
      },
    });
    mockEnsureReceiverSyncOffscreenDocument.mockResolvedValue(undefined);
    mockSetLocalSetting.mockResolvedValue(undefined);
    mockSendMessage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    Reflect.deleteProperty(globalThis, 'chrome');
  });

  it('retries the offscreen wake until the agent cycle starts', async () => {
    let wakeAttempts = 0;
    mockSendMessage.mockImplementation(async () => {
      wakeAttempts += 1;
      return undefined;
    });
    mockGetLocalSetting.mockImplementation(async (key: string, fallback: unknown) => {
      if (key === AGENT_SETTING_KEYS.cycleState) {
        if (wakeAttempts >= 3) {
          return {
            running: true,
            lastRequestId: 'agent-cycle-1',
          };
        }
        return {
          running: false,
        };
      }
      return fallback;
    });

    const request = await requestAgentCycle('manual-capture', true, {
      waitForRunner: true,
    });

    expect(request).toEqual({
      id: 'agent-cycle-1',
      requestedAt: '2026-04-11T18:00:00.000Z',
      reason: 'manual-capture',
      force: true,
    });
    expect(mockSetLocalSetting).toHaveBeenCalledWith(AGENT_SETTING_KEYS.cycleRequest, request);
    expect(mockEnsureReceiverSyncOffscreenDocument).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledTimes(3);
    expect(mockSendMessage).toHaveBeenLastCalledWith({
      type: 'run-agent-cycle-if-pending',
      payload: {
        reason: 'manual-capture',
        force: true,
      },
    });
  });

  it('uses a single non-blocking poke for default requestAgentCycle calls', async () => {
    mockGetLocalSetting.mockResolvedValue({ running: false });

    const request = await requestAgentCycle('background-refresh', false);

    expect(request).toEqual({
      id: 'agent-cycle-1',
      requestedAt: '2026-04-11T18:00:00.000Z',
      reason: 'background-refresh',
      force: false,
    });
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'run-agent-cycle-if-pending',
      payload: {
        reason: 'background-refresh',
        force: false,
      },
    });
    expect(mockGetLocalSetting).not.toHaveBeenCalled();
  });
});
