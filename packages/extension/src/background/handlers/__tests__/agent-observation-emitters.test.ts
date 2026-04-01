import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindAgentObservationByFingerprint, mockSaveAgentObservation, mockRequestAgentCycle } =
  vi.hoisted(() => ({
    mockFindAgentObservationByFingerprint: vi.fn(),
    mockSaveAgentObservation: vi.fn(),
    mockRequestAgentCycle: vi.fn(),
  }));

vi.mock('../../context', () => ({
  db: { agentObservations: {} },
}));

vi.mock('../agent-cycle-helpers', () => ({
  requestAgentCycle: mockRequestAgentCycle,
}));

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared')>();
  return {
    ...actual,
    findAgentObservationByFingerprint: mockFindAgentObservationByFingerprint,
    saveAgentObservation: mockSaveAgentObservation,
  };
});

const { emitRoundupBatchObservation } = await import('../agent-observation-emitters');

describe('emitRoundupBatchObservation', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const savedByFingerprint = new Map<string, unknown>();
    mockFindAgentObservationByFingerprint.mockImplementation(async (_db, fingerprint: string) =>
      savedByFingerprint.get(fingerprint),
    );
    mockSaveAgentObservation.mockImplementation(
      async (_db, observation: { fingerprint: string }) => {
        savedByFingerprint.set(observation.fingerprint, observation);
      },
    );
    mockRequestAgentCycle.mockResolvedValue(undefined);
  });

  it('includes candidate ids in the saved payload', async () => {
    await emitRoundupBatchObservation({
      extractIds: ['extract-1'],
      candidateIds: ['candidate-1'],
      eligibleCoopIds: ['coop-1'],
    });

    expect(mockSaveAgentObservation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        payload: expect.objectContaining({
          extractIds: ['extract-1'],
          candidateIds: ['candidate-1'],
          eligibleCoopIds: ['coop-1'],
        }),
      }),
    );
  });

  it('treats a recapture with the same extract but a new candidate id as a fresh observation', async () => {
    await emitRoundupBatchObservation({
      extractIds: ['extract-1'],
      candidateIds: ['candidate-1'],
      eligibleCoopIds: ['coop-1'],
    });

    await emitRoundupBatchObservation({
      extractIds: ['extract-1'],
      candidateIds: ['candidate-2'],
      eligibleCoopIds: ['coop-1'],
    });

    expect(mockSaveAgentObservation).toHaveBeenCalledTimes(2);
    expect(mockRequestAgentCycle).toHaveBeenCalledTimes(2);
  });

  it('returns null when extractIds is empty', async () => {
    const result = await emitRoundupBatchObservation({
      extractIds: [],
      candidateIds: ['candidate-1'],
      eligibleCoopIds: ['coop-1'],
    });

    expect(result).toBeNull();
    expect(mockSaveAgentObservation).not.toHaveBeenCalled();
  });

  it('returns null when eligibleCoopIds is empty', async () => {
    const result = await emitRoundupBatchObservation({
      extractIds: ['extract-1'],
      candidateIds: ['candidate-1'],
      eligibleCoopIds: [],
    });

    expect(result).toBeNull();
    expect(mockSaveAgentObservation).not.toHaveBeenCalled();
  });

  it('deduplicates via fingerprint — same inputs produce same observation', async () => {
    const first = await emitRoundupBatchObservation({
      extractIds: ['extract-1'],
      candidateIds: ['candidate-1'],
      eligibleCoopIds: ['coop-1'],
    });

    const second = await emitRoundupBatchObservation({
      extractIds: ['extract-1'],
      candidateIds: ['candidate-1'],
      eligibleCoopIds: ['coop-1'],
    });

    // First call saves, second finds existing — only 1 save
    expect(mockSaveAgentObservation).toHaveBeenCalledTimes(1);
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
  });

  it('produces unique fingerprints for different extract sets', async () => {
    await emitRoundupBatchObservation({
      extractIds: ['extract-1'],
      candidateIds: ['candidate-1'],
      eligibleCoopIds: ['coop-1'],
    });

    await emitRoundupBatchObservation({
      extractIds: ['extract-2'],
      candidateIds: ['candidate-1'],
      eligibleCoopIds: ['coop-1'],
    });

    // Different extract ids produce different fingerprints → both saved
    expect(mockSaveAgentObservation).toHaveBeenCalledTimes(2);
  });
});
