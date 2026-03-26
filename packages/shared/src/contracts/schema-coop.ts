import z from 'zod';
import {
  archiveReceiptSchema,
  coopArchiveConfigSchema,
  coopMemoryProfileSchema,
  reviewBoardGroupSchema,
} from './schema-archive';
import {
  artifactSchema,
  coopProfileSchema,
  coopSoulSchema,
  ritualDefinitionSchema,
  setupInsightsSchema,
} from './schema-content';
import {
  artifactCategorySchema,
  capabilityStateSchema,
  captureExclusionCategorySchema,
  inviteStatusSchema,
  inviteTypeSchema,
} from './schema-enums';
import { erc8004AgentStateSchema } from './schema-erc8004';
import { greenGoodsGardenStateSchema } from './schema-greengoods';
import { memberSchema } from './schema-identity';
import {
  fvmRegistryStateSchema,
  memberOnchainAccountSchema,
  onchainStateSchema,
} from './schema-onchain';
import { syncRoomBootstrapSchema, syncRoomConfigSchema } from './schema-sync';

// ---------------------------------------------------------------------------
// Invite schemas — kept here alongside inviteCoopBootstrapSnapshotSchema
// to avoid circular dependency (invite → bootstrap → identity → invite).
// ---------------------------------------------------------------------------

// Split so syncRoom stays between memoryProfile and onchainState — invite
// proof verification relies on JSON.stringify key order matching the object
// created by createInviteBootstrapSnapshot (flows.ts).
const baseBootstrapFieldsPre = {
  profile: coopProfileSchema,
  setupInsights: setupInsightsSchema,
  soul: coopSoulSchema,
  rituals: z.array(ritualDefinitionSchema).min(1),
  members: z.array(memberSchema).min(1),
  memberAccounts: z.array(z.lazy(() => memberOnchainAccountSchema)).default([]),
  artifacts: z.array(artifactSchema).default([]),
  reviewBoard: z.array(reviewBoardGroupSchema).default([]),
  archiveReceipts: z.array(archiveReceiptSchema).default([]),
  memoryProfile: coopMemoryProfileSchema,
};

const baseBootstrapFieldsPost = {
  onchainState: onchainStateSchema,
  greenGoods: greenGoodsGardenStateSchema.optional(),
};

const baseBootstrapFields = {
  ...baseBootstrapFieldsPre,
  ...baseBootstrapFieldsPost,
};

export const inviteCoopBootstrapSnapshotSchema = z.object({
  ...baseBootstrapFieldsPre,
  syncRoom: syncRoomBootstrapSchema,
  ...baseBootstrapFieldsPost,
});

export const coopBootstrapSnapshotSchema = z.object({
  ...baseBootstrapFieldsPre,
  syncRoom: syncRoomConfigSchema,
  ...baseBootstrapFieldsPost,
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
  status: inviteStatusSchema.default('active'),
  expiresAt: z.string().datetime(),
  code: z.string().min(1),
  bootstrap: inviteBootstrapSchema,
  createdAt: z.string().datetime(),
  createdBy: z.string().min(1),
  usedByMemberIds: z.array(z.string()).default([]),
  revokedAt: z.string().datetime().optional(),
  revokedBy: z.string().min(1).optional(),
});

export const soundPreferencesSchema = z.object({
  enabled: z.boolean().default(true),
  reducedMotion: z.boolean().default(false),
  reducedSound: z.boolean().default(false),
});

export const hapticEventSchema = z.enum([
  'pairing-confirmed',
  'capture-saved',
  'sync-completed',
  'button-press',
  'error',
]);

export const hapticPreferencesSchema = z.object({
  enabled: z.boolean().default(false),
  reducedMotion: z.boolean().default(false),
});

export const preferredExportMethodSchema = z.enum(['download', 'file-picker']);

export const uiPreferencesSchema = z.object({
  notificationsEnabled: z.boolean().default(true),
  localInferenceOptIn: z.boolean().default(true),
  preferredExportMethod: preferredExportMethodSchema.default('download'),
  heartbeatEnabled: z.boolean().default(true),
  agentCadenceMinutes: z
    .union([z.literal(4), z.literal(8), z.literal(16), z.literal(32), z.literal(64)])
    .default(64),
  excludedCategories: z
    .array(captureExclusionCategorySchema)
    .default(['email', 'banking', 'health']),
  customExcludedDomains: z.array(z.string()).default([]),
  captureOnClose: z.boolean().default(false),
});

export const coopSharedStateSchema = z.object({
  ...baseBootstrapFields,
  invites: z.array(inviteCodeSchema).default([]),
  syncRoom: syncRoomConfigSchema,
  agentIdentity: erc8004AgentStateSchema.optional(),
  archiveConfig: coopArchiveConfigSchema.optional(),
  memberCommitments: z.array(z.string()).default([]),
  fvmState: fvmRegistryStateSchema.optional(),
});

export const localEnhancementAvailabilitySchema = z.object({
  status: capabilityStateSchema,
  reason: z.string(),
  model: z.string().optional(),
});

export const localInferenceStatusSchema = z.enum([
  'disabled',
  'unavailable',
  'loading',
  'ready',
  'running',
  'failed',
]);

export const localInferenceCapabilitySchema = z.object({
  status: localInferenceStatusSchema,
  reason: z.string(),
  model: z.string().optional(),
  hasWebGpu: z.boolean().default(false),
  hasWorker: z.boolean().default(false),
  userOptIn: z.boolean().default(false),
});

export const refineTaskSchema = z.enum([
  'title-refinement',
  'summary-compression',
  'tag-suggestion',
]);

export const refineRequestSchema = z.object({
  draftId: z.string().min(1),
  task: refineTaskSchema,
  title: z.string().min(1),
  summary: z.string(),
  tags: z.array(z.string()).default([]),
  category: artifactCategorySchema,
  coopName: z.string().min(1),
  coopPurpose: z.string().min(1),
});

export const refineResultSchema = z.object({
  draftId: z.string().min(1),
  task: refineTaskSchema,
  refinedTitle: z.string().optional(),
  refinedSummary: z.string().optional(),
  suggestedTags: z.array(z.string()).optional(),
  provider: z.enum(['heuristic', 'local-model']),
  model: z.string().optional(),
  durationMs: z.number().int().nonnegative(),
});

export type InviteBootstrap = z.infer<typeof inviteBootstrapSchema>;
export type InviteCoopBootstrapSnapshot = z.infer<typeof inviteCoopBootstrapSnapshotSchema>;
export type InviteCode = z.infer<typeof inviteCodeSchema>;
export type CoopBootstrapSnapshot = z.infer<typeof coopBootstrapSnapshotSchema>;
export type CoopSharedState = z.infer<typeof coopSharedStateSchema>;
export type SoundPreferences = z.infer<typeof soundPreferencesSchema>;
export type HapticEvent = z.infer<typeof hapticEventSchema>;
export type HapticPreferences = z.infer<typeof hapticPreferencesSchema>;
export type PreferredExportMethod = z.infer<typeof preferredExportMethodSchema>;
export type UiPreferences = z.infer<typeof uiPreferencesSchema>;
export type LocalEnhancementAvailability = z.infer<typeof localEnhancementAvailabilitySchema>;
export type LocalInferenceStatus = z.infer<typeof localInferenceStatusSchema>;
export type LocalInferenceCapability = z.infer<typeof localInferenceCapabilitySchema>;
export type RefineTask = z.infer<typeof refineTaskSchema>;
export type RefineRequest = z.infer<typeof refineRequestSchema>;
export type RefineResult = z.infer<typeof refineResultSchema>;
