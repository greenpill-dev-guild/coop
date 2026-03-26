import z from 'zod';

export const authModeSchema = z.enum(['passkey', 'wallet', 'embedded']);
export const memberRoleSchema = z.enum(['creator', 'trusted', 'member']);
export const inviteTypeSchema = z.enum(['trusted', 'member']);
export const inviteStatusSchema = z.enum(['active', 'revoked']);
export const captureModeSchema = z.enum([
  'manual',
  '5-min',
  '10-min',
  '15-min',
  '30-min',
  '60-min',
]);
export const captureExclusionCategorySchema = z.enum(['email', 'banking', 'health', 'social-dm']);
export const coopSpaceTypeSchema = z.enum([
  'community',
  'project',
  'friends',
  'family',
  'personal',
]);
export const integrationModeSchema = z.enum(['live', 'mock']);
export const sessionModeSchema = z.enum(['off', 'mock', 'live']);
export const extensionIconStateSchema = z.enum([
  'setup',
  'ready',
  'working',
  'attention',
  'blocked',
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
export const archiveDelegationOperationSchema = z.enum(['upload', 'follow-up']);
export const soundEventSchema = z.enum([
  'coop-created',
  'artifact-published',
  'review-digest-ready',
  'action-awaiting-review',
  'capture-complete',
  'sound-test',
]);
export const coopChainKeySchema = z.enum(['arbitrum', 'sepolia']);
export const fvmChainKeySchema = z.enum(['filecoin', 'filecoin-calibration']);
export const providerModeSchema = z.enum(['standard', 'kohaku']);

export type ProviderMode = z.infer<typeof providerModeSchema>;
export type AuthMode = z.infer<typeof authModeSchema>;
export type MemberRole = z.infer<typeof memberRoleSchema>;
export type InviteType = z.infer<typeof inviteTypeSchema>;
export type InviteStatus = z.infer<typeof inviteStatusSchema>;
export type CaptureMode = z.infer<typeof captureModeSchema>;
export type CaptureExclusionCategory = z.infer<typeof captureExclusionCategorySchema>;
export type CoopSpaceType = z.infer<typeof coopSpaceTypeSchema>;
export type IntegrationMode = z.infer<typeof integrationModeSchema>;
export type SessionMode = z.infer<typeof sessionModeSchema>;
export type ExtensionIconState = z.infer<typeof extensionIconStateSchema>;
export type CapabilityState = z.infer<typeof capabilityStateSchema>;
export type RitualLens = z.infer<typeof ritualLensSchema>;
export type ArtifactCategory = z.infer<typeof artifactCategorySchema>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type ArchiveScope = z.infer<typeof archiveScopeSchema>;
export type ArchiveStatus = z.infer<typeof archiveStatusSchema>;
export type ArchiveDelegationOperation = z.infer<typeof archiveDelegationOperationSchema>;
export type SoundEvent = z.infer<typeof soundEventSchema>;
export type CoopChainKey = z.infer<typeof coopChainKeySchema>;
export type FvmChainKey = z.infer<typeof fvmChainKeySchema>;
