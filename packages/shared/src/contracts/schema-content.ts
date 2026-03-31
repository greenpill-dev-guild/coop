import z from 'zod';
import { archiveWorthinessSchema } from './schema-agent';
import { archiveBlobEncryptionSchema } from './schema-archive';
import { membershipProofSchema } from './schema-crypto';
import {
  archiveStatusSchema,
  artifactCategorySchema,
  captureExclusionCategorySchema,
  captureModeSchema,
  coopSpaceTypeSchema,
  reviewStatusSchema,
  ritualLensSchema,
} from './schema-enums';
import { receiverCaptureKindSchema } from './schema-receiver';

export const setupLensResponseSchema = z.object({
  lens: ritualLensSchema,
  currentState: z.string().min(1),
  painPoints: z.string().min(1),
  improvements: z.string().min(1),
});

export const setupInsightsSchema = z.object({
  summary: z.string().min(16),
  lenses: z.array(setupLensResponseSchema).length(4),
  crossCuttingPainPoints: z.array(z.string()).default([]),
  crossCuttingOpportunities: z.array(z.string()).default([]),
});

export const coopSoulSchema = z.object({
  purposeStatement: z.string().min(1),
  toneAndWorkingStyle: z.string().min(1),
  usefulSignalDefinition: z.string().min(1),
  artifactFocus: z.array(z.string()).min(1),
  whyThisCoopExists: z.string().min(1),
  agentPersona: z.string().optional(),
  vocabularyTerms: z.array(z.string()).default([]),
  prohibitedTopics: z.array(z.string()).default([]),
  confidenceThreshold: z.number().min(0).max(1).default(0.72),
});

export const ritualDefinitionSchema = z.object({
  weeklyReviewCadence: z.string().min(1),
  namedMoments: z.array(z.string()).min(1),
  facilitatorExpectation: z.string().min(1),
  defaultCapturePosture: z.string().min(1),
});

export const coopProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  purpose: z.string().min(1),
  spaceType: coopSpaceTypeSchema.default('community'),
  createdAt: z.string().datetime(),
  createdBy: z.string().min(1),
  captureMode: captureModeSchema,
  safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  active: z.boolean().default(true),
});

export const sourceReferenceSchema = z.object({
  label: z.string().min(1),
  url: z.string().min(1),
  domain: z.string().min(1),
  faviconUrl: z.string().optional(),
  socialPreviewImageUrl: z.string().optional(),
});

export const tabCandidateSchema = z.object({
  id: z.string().min(1),
  tabId: z.number().int().nonnegative(),
  windowId: z.number().int().nonnegative(),
  url: z.string().min(1),
  canonicalUrl: z.string().min(1),
  canonicalUrlHash: z.string().optional(),
  title: z.string().min(1),
  domain: z.string().min(1),
  favicon: z.string().optional(),
  excerpt: z.string().optional(),
  tabGroupHint: z.string().optional(),
  captureRunId: z.string().optional(),
  capturedAt: z.string().datetime(),
});

export const readablePageExtractSchema = z.object({
  id: z.string().min(1),
  sourceCandidateId: z.string().min(1),
  canonicalUrl: z.string().min(1),
  cleanedTitle: z.string().min(1),
  domain: z.string().min(1),
  metaDescription: z.string().optional(),
  topHeadings: z.array(z.string()).default([]),
  leadParagraphs: z.array(z.string()).default([]),
  salientTextBlocks: z.array(z.string()).default([]),
  textHash: z.string().min(1),
  faviconUrl: z.string().optional(),
  socialPreviewImageUrl: z.string().optional(),
  previewImageUrl: z.string().optional(),
  createdAt: z.string().datetime(),
});

export const coopInterpretationSchema = z.object({
  id: z.string().min(1),
  targetCoopId: z.string().min(1),
  relevanceScore: z.number().min(0).max(1),
  matchedRitualLenses: z.array(ritualLensSchema).default([]),
  categoryCandidates: z.array(artifactCategorySchema).min(1),
  tagCandidates: z.array(z.string()).default([]),
  rationale: z.string().min(1),
  suggestedNextStep: z.string().min(1),
  archiveWorthinessHint: z.boolean(),
});

export const reviewDraftWorkflowStageSchema = z.enum(['candidate', 'ready']);

export const reviewDraftProvenanceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('tab'),
    interpretationId: z.string().min(1),
    extractId: z.string().min(1),
    sourceCandidateId: z.string().min(1),
  }),
  z.object({
    type: z.literal('agent'),
    observationId: z.string().min(1),
    planId: z.string().min(1),
    skillRunId: z.string().min(1),
    skillId: z.string().min(1),
  }),
  z.object({
    type: z.literal('receiver'),
    captureId: z.string().min(1),
    pairingId: z.string().min(1).optional(),
    coopId: z.string().min(1).optional(),
    memberId: z.string().min(1).optional(),
    receiverKind: receiverCaptureKindSchema,
    seedMethod: z.enum(['metadata-only', 'transcript-enriched']),
  }),
]);

export const blobKindSchema = z.enum(['image', 'audio-source', 'audio-transcript', 'file']);
export const blobOriginSchema = z.enum(['self', 'peer', 'gateway']);

export const artifactAttachmentSchema = z.object({
  blobId: z.string().min(1),
  mimeType: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  kind: blobKindSchema,
  archiveCid: z.string().min(1).optional(),
  archiveEncryption: archiveBlobEncryptionSchema.optional(),
  thumbnailDataUrl: z.string().optional(),
});

export const reviewDraftSchema = z.object({
  id: z.string().min(1),
  interpretationId: z.string().min(1),
  extractId: z.string().min(1),
  sourceCandidateId: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  sources: z.array(sourceReferenceSchema).min(1),
  tags: z.array(z.string()).default([]),
  category: artifactCategorySchema,
  whyItMatters: z.string().min(1),
  suggestedNextStep: z.string().min(1),
  suggestedTargetCoopIds: z.array(z.string()).min(1),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
  previewImageUrl: z.string().optional(),
  status: z.literal('draft').default('draft'),
  workflowStage: reviewDraftWorkflowStageSchema.default('ready'),
  archiveWorthiness: archiveWorthinessSchema.optional(),
  attachments: z.array(artifactAttachmentSchema).default([]),
  provenance: reviewDraftProvenanceSchema,
  createdAt: z.string().datetime(),
});

export const artifactOriginSchema = z.object({
  originId: z.string().min(1),
  sourceDraftId: z.string().min(1),
  sourceUrls: z.array(z.string()).min(1),
  createdAt: z.string().datetime(),
});

export const coopBlobRecordSchema = z.object({
  blobId: z.string().min(1),
  sourceEntityId: z.string().min(1),
  coopId: z.string().min(1),
  mimeType: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  kind: blobKindSchema,
  origin: blobOriginSchema,
  archiveCid: z.string().min(1).optional(),
  archiveEncryption: archiveBlobEncryptionSchema.optional(),
  createdAt: z.string().datetime(),
  accessedAt: z.string().datetime(),
});

export const artifactSchema = z.object({
  id: z.string().min(1),
  originId: z.string().min(1),
  targetCoopId: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  sources: z.array(sourceReferenceSchema).min(1),
  tags: z.array(z.string()).default([]),
  category: artifactCategorySchema,
  whyItMatters: z.string().min(1),
  suggestedNextStep: z.string().min(1),
  previewImageUrl: z.string().optional(),
  createdBy: z.string().min(1),
  createdAt: z.string().datetime(),
  reviewStatus: reviewStatusSchema,
  archiveStatus: archiveStatusSchema,
  archiveReceiptIds: z.array(z.string()).default([]),
  archiveWorthiness: archiveWorthinessSchema.optional(),
  attachments: z.array(artifactAttachmentSchema).default([]),
  membershipProof: membershipProofSchema.optional(),
});

export type SetupInsights = z.infer<typeof setupInsightsSchema>;
export type CoopSoul = z.infer<typeof coopSoulSchema>;
export type RitualDefinition = z.infer<typeof ritualDefinitionSchema>;
export type CoopProfile = z.infer<typeof coopProfileSchema>;
export type SourceReference = z.infer<typeof sourceReferenceSchema>;
export type TabCandidate = z.infer<typeof tabCandidateSchema>;
export type ReadablePageExtract = z.infer<typeof readablePageExtractSchema>;
export type CoopInterpretation = z.infer<typeof coopInterpretationSchema>;
export type ReviewDraftWorkflowStage = z.infer<typeof reviewDraftWorkflowStageSchema>;
export type ReviewDraftProvenance = z.infer<typeof reviewDraftProvenanceSchema>;
export type BlobKind = z.infer<typeof blobKindSchema>;
export type BlobOrigin = z.infer<typeof blobOriginSchema>;
export type ArtifactAttachment = z.infer<typeof artifactAttachmentSchema>;
export type ReviewDraft = z.infer<typeof reviewDraftSchema>;
export type ArtifactOrigin = z.infer<typeof artifactOriginSchema>;
export type CoopBlobRecord = z.infer<typeof coopBlobRecordSchema>;
export type Artifact = z.infer<typeof artifactSchema>;
