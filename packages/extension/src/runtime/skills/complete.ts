import type {
  AgentMemory,
  AgentObservation,
  AgentProvider,
  ArchiveReceipt,
  CapitalFormationBriefOutput,
  CoopSharedState,
  EcosystemEntityExtractorOutput,
  EntityExtractionOutput,
  GrantFitScore,
  GrantFitScorerOutput,
  OpportunityCandidate,
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
  greenGoodsAssessmentRequestSchema,
  greenGoodsWorkApprovalRequestSchema,
} from '@coop/shared';
import { completeSkillOutput } from '../agent/models';
import {
  resolveGreenGoodsGapAdminAddresses,
  resolveGreenGoodsOperatorAddresses,
} from '../agent/output-handlers';
import { resolvePreferredProvider } from '../agent/provider-promotion';
import { computeOutputConfidence } from '../agent/quality';
import { type RegisteredSkill, listRegisteredSkills } from '../agent/registry';
import {
  computeGrantFitScores,
  inferEntitiesFromText,
  inferPoleEntitiesFromText,
  inferTabRoutingsHeuristically,
  inferThemes,
} from '../agent/runner-inference';
import { getCoops } from '../agent/runner-state';
import { buildSkillPrompt } from './prompt';

function createHeuristicCapitalFormationBrief(input: {
  observation: AgentObservation;
  coop?: CoopSharedState;
  candidates: OpportunityCandidate[];
  scores: GrantFitScore[];
}): CapitalFormationBriefOutput {
  const topScore = input.scores.reduce<GrantFitScore | null>((best, score) => {
    if (!best) {
      return score;
    }
    return score.score > best.score ? score : best;
  }, null);
  const topCandidate =
    input.candidates.find((candidate) => candidate.id === topScore?.candidateId) ??
    input.candidates[0] ??
    null;
  const coopName = input.coop?.profile.name ?? 'this coop';
  const title =
    topCandidate?.title?.trim() ||
    input.observation.title.trim() ||
    'Potential capital formation opportunity';
  const summary =
    topCandidate?.summary?.trim() ||
    input.observation.summary.trim() ||
    'This source may inform a capital formation opportunity for the coop.';
  const scoreReasons = topScore?.reasons.filter((reason) => reason.trim().length > 0) ?? [];
  const whyItMatters =
    scoreReasons.length > 0
      ? `This signal aligns with ${coopName} because ${scoreReasons.slice(0, 2).join(' and ')}.`
      : topCandidate?.rationale?.trim() ||
        `This signal appears relevant to ${coopName} and could support funding readiness.`;
  const suggestedNextStep =
    topCandidate?.recommendedNextStep?.trim() ||
    'Review the signal, tighten the thesis, and decide whether to route it into a funding brief.';
  const tags = Array.from(
    new Set(
      [
        'funding',
        'opportunity',
        ...(topCandidate?.ecologyTags ?? []),
        ...(topCandidate?.regionTags ?? []),
      ]
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    ),
  ).slice(0, 5);

  return {
    title,
    summary,
    whyItMatters,
    suggestedNextStep,
    tags: tags.length >= 2 ? tags : ['funding', 'opportunity'],
    targetCoopIds: input.coop ? [input.coop.profile.id] : [],
    supportingCandidateIds: topCandidate?.id ? [topCandidate.id] : [],
  };
}

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
  preferredProvider?: AgentProvider;
}): Promise<{ provider: AgentProvider; model?: string; output: T; durationMs: number }> {
  const { manifest } = input.skill;
  const prepared = await buildSkillPrompt(input);
  const preferredProvider = input.preferredProvider ?? (await resolvePreferredProvider(manifest));
  const result = await completeSkillOutput<T>({
    preferredProvider,
    schemaRef: manifest.outputSchemaRef,
    system: prepared.system,
    prompt: prepared.prompt,
    heuristicContext: prepared.heuristicContext,
    maxTokens: manifest.maxTokens,
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
