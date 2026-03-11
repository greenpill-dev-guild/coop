import { z } from 'zod';

export const authModeSchema = z.enum(['passkey', 'wallet', 'embedded']);
export const memberRoleSchema = z.enum(['creator', 'trusted', 'member']);
export const inviteTypeSchema = z.enum(['trusted', 'member']);
export const captureModeSchema = z.enum(['manual', '30-min', '60-min']);
export const extensionIconStateSchema = z.enum([
  'idle',
  'watching',
  'review-needed',
  'error-offline',
]);
export const capabilityStateSchema = z.enum([
  'unavailable',
  'stubbed',
  'ready',
  'executed',
  'failed',
]);
export const ritualLensSchema = z.enum([
  'capital-formation',
  'impact-reporting',
  'governance-coordination',
  'knowledge-garden-resources',
]);
export const artifactCategorySchema = z.enum([
  'setup-insight',
  'coop-soul',
  'ritual',
  'seed-contribution',
  'resource',
  'thought',
  'insight',
  'evidence',
  'opportunity',
  'funding-lead',
  'next-step',
]);
export const reviewStatusSchema = z.enum(['draft', 'published', 'reviewed', 'actioned']);
export const archiveScopeSchema = z.enum(['artifact', 'snapshot']);
export const archiveStatusSchema = z.enum(['not-archived', 'pending', 'archived']);
export const filecoinStatusSchema = z.enum(['pending', 'offered', 'indexed', 'sealed']);
export const soundEventSchema = z.enum(['coop-created', 'artifact-published', 'sound-test']);

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
});

export const ritualDefinitionSchema = z.object({
  weeklyReviewCadence: z.string().min(1),
  namedMoments: z.array(z.string()).min(1),
  facilitatorExpectation: z.string().min(1),
  defaultCapturePosture: z.string().min(1),
});

export const onchainStateSchema = z.object({
  chainId: z.number().int().positive(),
  chainKey: z.enum(['celo', 'celo-sepolia']).default('celo-sepolia'),
  safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  senderAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  safeCapability: capabilityStateSchema,
  statusNote: z.string(),
  deploymentTxHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]+$/)
    .optional(),
  userOperationHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]+$/)
    .optional(),
});

export const syncRoomConfigSchema = z.object({
  coopId: z.string().min(1),
  roomSecret: z.string().min(1),
  roomId: z.string().min(1),
  inviteSigningSecret: z.string().min(1),
  signalingUrls: z.array(z.string().url()).default([]),
});

export const syncRoomBootstrapSchema = z.object({
  coopId: z.string().min(1),
  roomId: z.string().min(1),
  signalingUrls: z.array(z.string().url()).default([]),
});

export const coopProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  purpose: z.string().min(1),
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
});

export const memberSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  role: memberRoleSchema,
  authMode: authModeSchema,
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  joinedAt: z.string().datetime(),
  seedContributionId: z.string().optional(),
  identityWarning: z.string(),
  passkeyCredentialId: z.string().optional(),
});

export const passkeyCredentialSchema = z.object({
  id: z.string().min(1),
  publicKey: z.string().regex(/^0x[a-fA-F0-9]+$/),
  rpId: z.string().min(1),
});

export const authSessionSchema = z.object({
  authMode: authModeSchema,
  displayName: z.string().min(1),
  primaryAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  createdAt: z.string().datetime(),
  identityWarning: z.string(),
  passkey: passkeyCredentialSchema.optional(),
});

export const localPasskeyIdentitySchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  ownerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime(),
  identityWarning: z.string(),
  passkey: passkeyCredentialSchema,
});

export const inviteBootstrapSchema = z.object({
  coopId: z.string().min(1),
  coopDisplayName: z.string().min(1),
  inviteId: z.string().min(1),
  inviteType: inviteTypeSchema,
  expiresAt: z.string().datetime(),
  roomId: z.string().min(1),
  signalingUrls: z.array(z.string().url()).default([]),
  inviteProof: z.string().min(1),
  bootstrapState: z.lazy(() => inviteCoopBootstrapSnapshotSchema).optional(),
});

export const inviteCodeSchema = z.object({
  id: z.string().min(1),
  type: inviteTypeSchema,
  expiresAt: z.string().datetime(),
  code: z.string().min(1),
  bootstrap: inviteBootstrapSchema,
  createdAt: z.string().datetime(),
  createdBy: z.string().min(1),
  usedByMemberIds: z.array(z.string()).default([]),
});

export const tabCandidateSchema = z.object({
  id: z.string().min(1),
  tabId: z.number().int().nonnegative(),
  windowId: z.number().int().nonnegative(),
  url: z.string().min(1),
  canonicalUrl: z.string().min(1),
  title: z.string().min(1),
  domain: z.string().min(1),
  favicon: z.string().optional(),
  excerpt: z.string().optional(),
  tabGroupHint: z.string().optional(),
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
  createdAt: z.string().datetime(),
});

export const artifactOriginSchema = z.object({
  originId: z.string().min(1),
  sourceDraftId: z.string().min(1),
  sourceUrls: z.array(z.string()).min(1),
  createdAt: z.string().datetime(),
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
});

export const archiveReceiptSchema = z.object({
  id: z.string().min(1),
  scope: archiveScopeSchema,
  targetCoopId: z.string().min(1),
  artifactIds: z.array(z.string()).default([]),
  bundleReference: z.string().min(1),
  rootCid: z.string().min(1),
  shardCids: z.array(z.string()).default([]),
  pieceCids: z.array(z.string()).default([]),
  gatewayUrl: z.string().url(),
  uploadedAt: z.string().datetime(),
  filecoinStatus: filecoinStatusSchema,
  delegationIssuer: z.string().min(1),
});

export const archiveBundleSchema = z.object({
  id: z.string().min(1),
  scope: archiveScopeSchema,
  targetCoopId: z.string().min(1),
  createdAt: z.string().datetime(),
  payload: z.record(z.any()),
});

export const archiveDelegationMaterialSchema = z.object({
  spaceDid: z.string().min(1),
  delegationIssuer: z.string().min(1),
  gatewayBaseUrl: z.string().url().default('https://storacha.link'),
  spaceDelegation: z.string().min(1),
  proofs: z.array(z.string()).default([]),
  issuerUrl: z.string().url().optional(),
  expiresAt: z.string().datetime().optional(),
  allowsFilecoinInfo: z.boolean().default(false),
});

export const reviewBoardGroupSchema = z.object({
  id: z.string().min(1),
  groupBy: z.enum(['category', 'member']),
  label: z.string().min(1),
  artifactIds: z.array(z.string()).default([]),
});

export const domainStatSchema = z.object({
  domain: z.string().min(1),
  acceptCount: z.number().int().nonnegative(),
  reviewedCount: z.number().int().nonnegative(),
  lastAcceptedAt: z.string().datetime(),
});

export const tagStatSchema = z.object({
  tag: z.string().min(1),
  acceptCount: z.number().int().nonnegative(),
  lastAcceptedAt: z.string().datetime(),
});

export const categoryStatSchema = z.object({
  category: artifactCategorySchema,
  publishCount: z.number().int().nonnegative(),
  actionedCount: z.number().int().nonnegative(),
});

export const ritualLensWeightSchema = z.object({
  lens: ritualLensSchema,
  weight: z.number().min(0).max(1),
});

export const archiveSignalsSchema = z.object({
  archivedTagCounts: z.record(z.number().int().nonnegative()),
  archivedDomainCounts: z.record(z.number().int().nonnegative()),
});

export const coopMemoryProfileSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().datetime(),
  topDomains: z.array(domainStatSchema).default([]),
  topTags: z.array(tagStatSchema).default([]),
  categoryStats: z.array(categoryStatSchema).default([]),
  ritualLensWeights: z.array(ritualLensWeightSchema).default([]),
  exemplarArtifactIds: z.array(z.string()).default([]),
  archiveSignals: archiveSignalsSchema,
});

export const inviteCoopBootstrapSnapshotSchema = z.object({
  profile: coopProfileSchema,
  setupInsights: setupInsightsSchema,
  soul: coopSoulSchema,
  rituals: z.array(ritualDefinitionSchema).min(1),
  members: z.array(memberSchema).min(1),
  artifacts: z.array(artifactSchema).default([]),
  reviewBoard: z.array(reviewBoardGroupSchema).default([]),
  archiveReceipts: z.array(archiveReceiptSchema).default([]),
  memoryProfile: coopMemoryProfileSchema,
  syncRoom: syncRoomBootstrapSchema,
  onchainState: onchainStateSchema,
});

export const coopBootstrapSnapshotSchema = z.object({
  profile: coopProfileSchema,
  setupInsights: setupInsightsSchema,
  soul: coopSoulSchema,
  rituals: z.array(ritualDefinitionSchema).min(1),
  members: z.array(memberSchema).min(1),
  artifacts: z.array(artifactSchema).default([]),
  reviewBoard: z.array(reviewBoardGroupSchema).default([]),
  archiveReceipts: z.array(archiveReceiptSchema).default([]),
  memoryProfile: coopMemoryProfileSchema,
  syncRoom: syncRoomConfigSchema,
  onchainState: onchainStateSchema,
});

export const soundPreferencesSchema = z.object({
  enabled: z.boolean().default(false),
  reducedMotion: z.boolean().default(false),
  reducedSound: z.boolean().default(false),
});

export const coopSharedStateSchema = z.object({
  profile: coopProfileSchema,
  setupInsights: setupInsightsSchema,
  soul: coopSoulSchema,
  rituals: z.array(ritualDefinitionSchema).min(1),
  members: z.array(memberSchema).min(1),
  invites: z.array(inviteCodeSchema).default([]),
  artifacts: z.array(artifactSchema).default([]),
  reviewBoard: z.array(reviewBoardGroupSchema).default([]),
  archiveReceipts: z.array(archiveReceiptSchema).default([]),
  memoryProfile: coopMemoryProfileSchema,
  syncRoom: syncRoomConfigSchema,
  onchainState: onchainStateSchema,
});

export const localEnhancementAvailabilitySchema = z.object({
  status: capabilityStateSchema,
  reason: z.string(),
  model: z.string().optional(),
});

export type ArchiveBundle = z.infer<typeof archiveBundleSchema>;
export type ArchiveDelegationMaterial = z.infer<typeof archiveDelegationMaterialSchema>;
export type ArchiveReceipt = z.infer<typeof archiveReceiptSchema>;
export type ArchiveScope = z.infer<typeof archiveScopeSchema>;
export type ArchiveStatus = z.infer<typeof archiveStatusSchema>;
export type Artifact = z.infer<typeof artifactSchema>;
export type ArtifactCategory = z.infer<typeof artifactCategorySchema>;
export type ArtifactOrigin = z.infer<typeof artifactOriginSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type AuthMode = z.infer<typeof authModeSchema>;
export type CapabilityState = z.infer<typeof capabilityStateSchema>;
export type CaptureMode = z.infer<typeof captureModeSchema>;
export type CoopBootstrapSnapshot = z.infer<typeof coopBootstrapSnapshotSchema>;
export type CoopInterpretation = z.infer<typeof coopInterpretationSchema>;
export type CoopMemoryProfile = z.infer<typeof coopMemoryProfileSchema>;
export type CoopProfile = z.infer<typeof coopProfileSchema>;
export type CoopSharedState = z.infer<typeof coopSharedStateSchema>;
export type CoopSoul = z.infer<typeof coopSoulSchema>;
export type ExtensionIconState = z.infer<typeof extensionIconStateSchema>;
export type InviteBootstrap = z.infer<typeof inviteBootstrapSchema>;
export type InviteCoopBootstrapSnapshot = z.infer<typeof inviteCoopBootstrapSnapshotSchema>;
export type InviteCode = z.infer<typeof inviteCodeSchema>;
export type InviteType = z.infer<typeof inviteTypeSchema>;
export type LocalEnhancementAvailability = z.infer<typeof localEnhancementAvailabilitySchema>;
export type LocalPasskeyIdentity = z.infer<typeof localPasskeyIdentitySchema>;
export type Member = z.infer<typeof memberSchema>;
export type MemberRole = z.infer<typeof memberRoleSchema>;
export type OnchainState = z.infer<typeof onchainStateSchema>;
export type PasskeyCredential = z.infer<typeof passkeyCredentialSchema>;
export type ReadablePageExtract = z.infer<typeof readablePageExtractSchema>;
export type ReviewBoardGroup = z.infer<typeof reviewBoardGroupSchema>;
export type ReviewDraft = z.infer<typeof reviewDraftSchema>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type RitualDefinition = z.infer<typeof ritualDefinitionSchema>;
export type RitualLens = z.infer<typeof ritualLensSchema>;
export type SetupInsights = z.infer<typeof setupInsightsSchema>;
export type SoundEvent = z.infer<typeof soundEventSchema>;
export type SoundPreferences = z.infer<typeof soundPreferencesSchema>;
export type SourceReference = z.infer<typeof sourceReferenceSchema>;
export type SyncRoomBootstrap = z.infer<typeof syncRoomBootstrapSchema>;
export type SyncRoomConfig = z.infer<typeof syncRoomConfigSchema>;
export type TabCandidate = z.infer<typeof tabCandidateSchema>;
