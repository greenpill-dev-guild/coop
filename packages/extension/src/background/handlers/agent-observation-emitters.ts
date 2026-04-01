import {
  type AgentObservation,
  type ReviewDraft,
  createAgentObservation,
  findAgentObservationByFingerprint,
  sanitizeTextForInference,
  saveAgentObservation,
} from '@coop/shared';
import { AGENT_HIGH_CONFIDENCE_THRESHOLD } from '../../runtime/agent-config';
import { db } from '../context';
import { requestAgentCycle } from './agent-cycle-helpers';

export async function emitAgentObservationIfMissing(
  input: Parameters<typeof createAgentObservation>[0],
  options: { requestCycle?: boolean } = {},
): Promise<AgentObservation> {
  const observation = createAgentObservation(input);
  const existing = await findAgentObservationByFingerprint(db, observation.fingerprint);
  if (existing) {
    return existing;
  }
  await saveAgentObservation(db, observation);
  if (options.requestCycle ?? true) {
    await requestAgentCycle(`observation:${observation.trigger}`);
  }
  return observation;
}

export async function emitRoundupBatchObservation(input: {
  extractIds: string[];
  eligibleCoopIds: string[];
  candidateIds?: string[];
}) {
  const extractIds = [...new Set(input.extractIds.filter((value) => typeof value === 'string'))];
  const candidateIds = [
    ...new Set((input.candidateIds ?? []).filter((value) => typeof value === 'string')),
  ];

  if (extractIds.length === 0 || input.eligibleCoopIds.length === 0) {
    return null;
  }

  return emitAgentObservationIfMissing({
    trigger: 'roundup-batch-ready',
    title: 'Captured tabs ready for routing',
    summary: `Route ${extractIds.length} freshly captured tab extracts into local coop contexts.`,
    payload: {
      extractIds,
      candidateIds,
      eligibleCoopIds: input.eligibleCoopIds,
    },
  });
}

export async function emitAudioTranscriptObservation(input: {
  captureId: string;
  coopId?: string;
  transcriptText: string;
  durationSeconds?: number;
}) {
  const sanitizedTranscript = sanitizeTextForInference(input.transcriptText).trim();
  if (!sanitizedTranscript) {
    return null;
  }

  const TRANSCRIPT_PREVIEW_LIMIT = 200;
  const preview = sanitizedTranscript.slice(0, TRANSCRIPT_PREVIEW_LIMIT);
  const ellipsis = sanitizedTranscript.length > TRANSCRIPT_PREVIEW_LIMIT ? '…' : '';

  // Store only a truncated preview in the payload — the full transcript
  // is already persisted as a CoopBlob (kind: 'audio-transcript').
  const PAYLOAD_TEXT_LIMIT = 2000;

  return emitAgentObservationIfMissing({
    trigger: 'audio-transcript-ready',
    title: 'Voice note transcribed',
    summary: `Transcribed audio capture: \u201C${preview}${ellipsis}\u201D`,
    captureId: input.captureId,
    coopId: input.coopId,
    payload: {
      captureId: input.captureId,
      transcriptText: sanitizedTranscript.slice(0, PAYLOAD_TEXT_LIMIT),
      durationSeconds: input.durationSeconds,
    },
  });
}

export async function syncHighConfidenceDraftObservations(drafts: ReviewDraft[]) {
  const candidates = drafts.filter((draft) => draft.confidence >= AGENT_HIGH_CONFIDENCE_THRESHOLD);
  for (const draft of candidates) {
    await emitAgentObservationIfMissing({
      trigger: 'high-confidence-draft',
      title: `High-confidence draft: ${draft.title}`,
      summary: draft.summary,
      coopId: draft.suggestedTargetCoopIds[0],
      draftId: draft.id,
      extractId: draft.extractId,
      payload: {
        confidence: draft.confidence,
        category: draft.category,
        workflowStage: draft.workflowStage,
      },
    });
  }
}
