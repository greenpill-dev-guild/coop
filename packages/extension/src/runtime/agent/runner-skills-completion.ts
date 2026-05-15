import type {
  ActionBundle,
  AgentMemory,
  AgentObservation,
  AgentPlan,
  AgentProvider,
  ArchiveReceipt,
  CoopSharedState,
  EcosystemEntityExtractorOutput,
  EntityExtractionOutput,
  GrantFitScore,
  GrantFitScorerOutput,
  OpportunityCandidate,
  PublishReadinessCheckOutput,
  ReadablePageExtract,
  ReceiverCapture,
  ReviewDraft,
  TabRouterOutput,
  TabRouting,
  ThemeClustererOutput,
} from '@coop/shared';
import {
  buildAgentManifest,
  createGreenGoodsAssessmentOutput,
  createGreenGoodsBootstrapOutput,
  createGreenGoodsGapAdminSyncOutput,
  createGreenGoodsSyncOutput,
  createGreenGoodsWorkApprovalOutput,
  encodeAgentManifestURI,
  getAuthSession,
  greenGoodsAssessmentRequestSchema,
  greenGoodsWorkApprovalRequestSchema,
  saveReviewDraft,
} from '@coop/shared';
import type { RuntimeActionResponse } from '../messages';
import { completeSkillOutput } from './models';
import {
  resolveGreenGoodsGapAdminAddresses,
  resolveGreenGoodsOperatorAddresses,
} from './output-handlers';
import { resolvePreferredProvider } from './provider-promotion';
import { computeOutputConfidence } from './quality';
import { type RegisteredSkill, listRegisteredSkills } from './registry';
import {
  computeGrantFitScores,
  inferEntitiesFromText,
  inferPoleEntitiesFromText,
  inferTabRoutingsHeuristically,
  inferThemes,
} from './runner-inference';
import {
  type PreparedSkillPrompt,
  buildSkillPrompt,
  createHeuristicCapitalFormationBrief,
} from './runner-skills-prompt';
import { db, findAuthenticatedCoopMember, getCoops } from './runner-state';

export async function completeSkill<T>(input: {
  skill: RegisteredSkill;
  observation: AgentObservation;
  coop?: CoopSharedState;
  availableCoops?: CoopSharedState[];
  draft?: ReviewDraft | null;
  capture?: ReceiverCapture | null;
  receipt?: ArchiveReceipt | null;
  candidates: OpportunityCandidate[];
  scores: GrantFitScore[];
  extracts: ReadablePageExtract[];
  relatedDrafts: ReviewDraft[];
  relatedArtifacts: CoopSharedState['artifacts'];
  relatedRoutings: TabRouting[];
  memories: AgentMemory[];
  graphContext?: string;
  preparedPrompt?: PreparedSkillPrompt;
  preferredProvider?: AgentProvider;
  signal?: AbortSignal;
}): Promise<{ provider: AgentProvider; model?: string; output: T; durationMs: number }> {
  const { manifest } = input.skill;
  const prepared = input.preparedPrompt ?? (await buildSkillPrompt(input));
  const preferredProvider = input.preferredProvider ?? (await resolvePreferredProvider(manifest));
  // Surface multimodal attachments from the observation payload to the
  // gemma4 path. The runner already validates payload as a record; the
  // agent observation pipeline puts captured screenshot URLs and recorded
  // audio Blob URLs here for the demo arc.
  const observationPayload = (input.observation.payload ?? {}) as Record<string, unknown>;
  const imageUrl =
    typeof observationPayload.imageUrl === 'string' ? observationPayload.imageUrl : undefined;
  const audioUrl =
    typeof observationPayload.audioUrl === 'string' ? observationPayload.audioUrl : undefined;
  const audioSamplingRate =
    typeof observationPayload.audioSamplingRate === 'number'
      ? observationPayload.audioSamplingRate
      : undefined;
  const result = await completeSkillOutput<T>({
    preferredProvider,
    schemaRef: manifest.outputSchemaRef,
    system: prepared.system,
    prompt: prepared.prompt,
    heuristicContext: prepared.heuristicContext,
    maxTokens: manifest.maxTokens,
    imageUrl,
    audioUrl,
    audioSamplingRate,
    signal: input.signal,
  });

  if (
    manifest.outputSchemaRef === 'tab-router-output' &&
    ((result.output as TabRouterOutput).routings?.length ?? 0) === 0
  ) {
    return {
      provider: 'heuristic',
      model: result.model,
      durationMs: result.durationMs,
      output: inferTabRoutingsHeuristically({
        observation: input.observation,
        extracts: input.extracts,
        coops: input.coop ? [input.coop] : (input.availableCoops ?? (await getCoops())),
      }) as T,
    };
  }

  if (
    manifest.outputSchemaRef === 'grant-fit-scorer-output' &&
    ((result.output as GrantFitScorerOutput).scores?.length ?? 0) === 0
  ) {
    return {
      provider: 'heuristic',
      model: result.model,
      durationMs: result.durationMs,
      output: {
        scores: computeGrantFitScores(input.candidates, input.coop),
      } as T,
    };
  }

  if (
    manifest.outputSchemaRef === 'ecosystem-entity-extractor-output' &&
    ((result.output as EcosystemEntityExtractorOutput).entities?.length ?? 0) === 0
  ) {
    return {
      provider: 'heuristic',
      model: result.model,
      durationMs: result.durationMs,
      output: inferEntitiesFromText(prepared.heuristicContext) as T,
    };
  }

  if (
    manifest.outputSchemaRef === 'entity-extraction-output' &&
    ((result.output as EntityExtractionOutput).entities?.length ?? 0) === 0
  ) {
    return {
      provider: 'heuristic',
      model: result.model,
      durationMs: result.durationMs,
      output: inferPoleEntitiesFromText(prepared.heuristicContext) as T,
    };
  }

  if (
    manifest.outputSchemaRef === 'theme-clusterer-output' &&
    ((result.output as ThemeClustererOutput).themes?.length ?? 0) === 0
  ) {
    return {
      provider: 'heuristic',
      model: result.model,
      durationMs: result.durationMs,
      output: inferThemes({
        relatedDrafts: input.relatedDrafts,
        relatedArtifacts: input.relatedArtifacts,
        observation: input.observation,
      }) as T,
    };
  }

  if (
    manifest.outputSchemaRef === 'capital-formation-brief-output' &&
    typeof manifest.qualityThreshold === 'number'
  ) {
    const confidence = computeOutputConfidence(
      manifest.outputSchemaRef,
      result.output,
      result.provider,
    );
    if (confidence < manifest.qualityThreshold) {
      return {
        provider: 'heuristic',
        model: result.model,
        durationMs: result.durationMs,
        output: createHeuristicCapitalFormationBrief({
          observation: input.observation,
          coop: input.coop,
          candidates: input.candidates,
          scores: input.scores,
        }) as T,
      };
    }
  }

  if (
    manifest.outputSchemaRef === 'green-goods-garden-bootstrap-output' &&
    input.coop?.greenGoods
  ) {
    return {
      provider: 'heuristic',
      model: result.model,
      durationMs: result.durationMs,
      output: createGreenGoodsBootstrapOutput({
        coopName: input.coop.profile.name,
        purpose: input.coop.profile.purpose,
        garden: input.coop.greenGoods,
      }) as T,
    };
  }

  if (manifest.outputSchemaRef === 'green-goods-garden-sync-output' && input.coop?.greenGoods) {
    return {
      provider: 'heuristic',
      model: result.model,
      durationMs: result.durationMs,
      output: createGreenGoodsSyncOutput({
        coopName: input.coop.profile.name,
        purpose: input.coop.profile.purpose,
        garden: input.coop.greenGoods,
      }) as T,
    };
  }

  if (
    manifest.outputSchemaRef === 'green-goods-work-approval-output' &&
    input.coop?.greenGoods?.gardenAddress
  ) {
    return {
      provider: 'heuristic',
      model: result.model,
      durationMs: result.durationMs,
      output: createGreenGoodsWorkApprovalOutput({
        request: greenGoodsWorkApprovalRequestSchema.parse(input.observation.payload),
      }) as T,
    };
  }

  if (
    manifest.outputSchemaRef === 'green-goods-assessment-output' &&
    input.coop?.greenGoods?.gardenAddress
  ) {
    return {
      provider: 'heuristic',
      model: result.model,
      durationMs: result.durationMs,
      output: createGreenGoodsAssessmentOutput({
        request: greenGoodsAssessmentRequestSchema.parse(input.observation.payload),
      }) as T,
    };
  }

  if (
    manifest.outputSchemaRef === 'green-goods-gap-admin-sync-output' &&
    input.coop?.greenGoods?.gardenAddress
  ) {
    return {
      provider: 'heuristic',
      model: result.model,
      durationMs: result.durationMs,
      output: createGreenGoodsGapAdminSyncOutput({
        desiredAdmins: resolveGreenGoodsOperatorAddresses(input.coop) as `0x${string}`[],
        currentAdmins: resolveGreenGoodsGapAdminAddresses(input.coop) as `0x${string}`[],
      }) as T,
    };
  }

  if (manifest.outputSchemaRef === 'erc8004-registration-output' && input.coop) {
    const agentManifest = buildAgentManifest({
      coop: input.coop,
      skills: listRegisteredSkills().map((entry) => entry.manifest.id),
      agentId: input.coop.agentIdentity?.agentId,
    });
    return {
      provider: 'heuristic',
      model: result.model,
      durationMs: result.durationMs,
      output: {
        agentURI: encodeAgentManifestURI(agentManifest),
        metadata: [
          { key: 'coopId', value: input.coop.profile.id },
          { key: 'coopName', value: input.coop.profile.name },
          { key: 'safeAddress', value: input.coop.onchainState.safeAddress },
        ],
        rationale:
          'Register the coop as an ERC-8004 agent so Coop can publish a deterministic onchain identity and receive reputation feedback.',
      } as T,
    };
  }

  if (manifest.outputSchemaRef === 'erc8004-feedback-output') {
    const payload = input.observation.payload as {
      reason?: string;
      rootCid?: string;
      targetAgentId?: number;
    };
    const targetAgentId =
      typeof payload.targetAgentId === 'number' && payload.targetAgentId > 0
        ? payload.targetAgentId
        : input.coop?.agentIdentity?.agentId;
    if (targetAgentId) {
      const reason = payload.reason ?? 'coop-feedback';
      const rootedReason =
        payload.rootCid && reason === 'archive-anchor'
          ? `Archive anchor for ${payload.rootCid} succeeded and warrants a positive self-attestation.`
          : 'A successful coop action warrants positive ERC-8004 feedback.';
      return {
        provider: 'heuristic',
        model: result.model,
        durationMs: result.durationMs,
        output: {
          targetAgentId,
          value: 1,
          tag1: reason === 'archive-anchor' ? 'archive' : 'coop',
          tag2: reason === 'archive-anchor' ? 'self-attestation' : 'feedback',
          rationale: rootedReason,
        } as T,
      };
    }
  }

  return result;
}

export async function maybePatchDraft(
  draft: ReviewDraft | null | undefined,
  output: PublishReadinessCheckOutput,
) {
  if (!draft) {
    return null;
  }
  if (Object.keys(output.proposedPatch ?? {}).length === 0) {
    return draft;
  }
  const patched: ReviewDraft = {
    ...draft,
    ...output.proposedPatch,
  };
  await saveReviewDraft(db, patched);
  return patched;
}

export async function resolveActionMemberId(coopId: string) {
  const [coops, authSession] = await Promise.all([getCoops(), getAuthSession(db)]);
  const coop = coops.find((candidate) => candidate.profile.id === coopId);
  return coop ? findAuthenticatedCoopMember(coop, authSession)?.id : undefined;
}

export async function dispatchActionProposal(input: {
  plan: AgentPlan;
  proposal: AgentPlan['actionProposals'][number];
  autoExecute: boolean;
}) {
  const memberId = input.proposal.memberId ?? (await resolveActionMemberId(input.proposal.coopId));
  if (!memberId) {
    return { ok: false, error: 'No authenticated coop member is available to execute this plan.' };
  }

  const proposalResponse = (await chrome.runtime.sendMessage({
    type: 'propose-action',
    payload: {
      actionClass: input.proposal.actionClass,
      coopId: input.proposal.coopId,
      memberId,
      payload: input.proposal.payload,
    },
  })) as RuntimeActionResponse<ActionBundle>;

  if (!proposalResponse.ok || !proposalResponse.data) {
    return { ok: false, error: proposalResponse.error ?? 'Could not create action bundle.' };
  }

  if (!input.autoExecute || proposalResponse.data.status !== 'approved') {
    return { ok: true, executed: false };
  }

  const executeResponse = (await chrome.runtime.sendMessage({
    type: 'execute-action',
    payload: { bundleId: proposalResponse.data.id },
  })) as RuntimeActionResponse<ActionBundle>;

  if (!executeResponse.ok) {
    return { ok: false, error: executeResponse.error ?? 'Could not execute action bundle.' };
  }

  return { ok: true, executed: true };
}

export function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    unique.push(item);
  }
  return unique;
}
