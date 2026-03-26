import z from 'zod';
import { privilegedActionStatusSchema } from './schema-agent';
import {
  archiveDelegationOperationSchema,
  archiveScopeSchema,
  artifactCategorySchema,
  coopChainKeySchema,
  filecoinStatusSchema,
  fvmChainKeySchema,
  integrationModeSchema,
  ritualLensSchema,
} from './schema-enums';
import { privilegedActionTypeSchema } from './schema-policy';

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
  delegation: z
    .object({
      issuer: z.string().min(1),
      issuerUrl: z.string().url().optional(),
      audienceDid: z.string().min(1).optional(),
      mode: integrationModeSchema.default('mock'),
      allowsFilecoinInfo: z.boolean().default(false),
    })
    .optional(),
  followUp: z
    .object({
      refreshCount: z.number().int().nonnegative().default(0),
      lastRefreshRequestedAt: z.string().datetime().optional(),
      lastRefreshedAt: z.string().datetime().optional(),
      lastStatusChangeAt: z.string().datetime().optional(),
      lastError: z.string().min(1).optional(),
    })
    .optional(),
  filecoinInfo: z
    .object({
      pieceCid: z.string().min(1).optional(),
      aggregates: z
        .array(
          z.object({
            aggregate: z.string().min(1),
            inclusionProofAvailable: z.boolean().default(false),
            inclusionProof: z.string().optional(),
          }),
        )
        .default([]),
      deals: z
        .array(
          z.object({
            aggregate: z.string().min(1),
            provider: z.string().min(1).optional(),
            dealId: z.string().min(1).optional(),
          }),
        )
        .default([]),
      lastUpdatedAt: z.string().datetime().optional(),
    })
    .optional(),
  anchorTxHash: z.string().optional(),
  anchorChainKey: coopChainKeySchema.optional(),
  anchorStatus: z.enum(['pending', 'anchored', 'skipped']).default('pending'),
  fvmRegistryTxHash: z.string().optional(),
  fvmChainKey: fvmChainKeySchema.optional(),
});

export const archiveBundleSchema = z.object({
  id: z.string().min(1),
  scope: archiveScopeSchema,
  targetCoopId: z.string().min(1),
  createdAt: z.string().datetime(),
  schemaVersion: z.number().int().positive().default(1),
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

export const archiveDelegationRequestSchema = z.object({
  audienceDid: z.string().min(1),
  coopId: z.string().min(1),
  scope: archiveScopeSchema,
  operation: archiveDelegationOperationSchema.default('upload'),
  artifactIds: z.array(z.string()).default([]),
  actorAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  safeAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  chainKey: coopChainKeySchema.optional(),
  receiptId: z.string().min(1).optional(),
  rootCid: z.string().min(1).optional(),
  pieceCids: z.array(z.string().min(1)).default([]),
});

export const trustedNodeArchiveConfigSchema = z.object({
  agentPrivateKey: z.string().min(1).optional(),
  spaceDid: z.string().min(1),
  delegationIssuer: z.string().min(1),
  gatewayBaseUrl: z.string().url().default('https://storacha.link'),
  spaceDelegation: z.string().min(1),
  proofs: z.array(z.string().min(1)).default([]),
  allowsFilecoinInfo: z.boolean().default(false),
  expirationSeconds: z.number().int().positive().default(600),
});

/** Public archive config — synced via CRDT in CoopSharedState. */
export const coopArchiveConfigSchema = z.object({
  spaceDid: z.string().min(1),
  delegationIssuer: z.string().min(1),
  gatewayBaseUrl: z.string().url().default('https://storacha.link'),
  allowsFilecoinInfo: z.boolean().default(false),
  expirationSeconds: z.number().int().positive().default(600),
});

/** Secret archive config — stored locally in Dexie, never synced. */
export const coopArchiveSecretsSchema = z.object({
  coopId: z.string().min(1),
  agentPrivateKey: z.string().min(1).optional(),
  spaceDelegation: z.string().min(1),
  proofs: z.array(z.string().min(1)).default([]),
});

export const anchorCapabilitySchema = z.object({
  enabled: z.boolean().default(false),
  nodeId: z.string().min(1).default('coop-extension'),
  updatedAt: z.string().datetime(),
  actorAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  actorDisplayName: z.string().min(1).optional(),
  memberId: z.string().min(1).optional(),
  memberDisplayName: z.string().min(1).optional(),
});

export const privilegedActionContextSchema = z.object({
  coopId: z.string().min(1).optional(),
  coopName: z.string().min(1).optional(),
  memberId: z.string().min(1).optional(),
  memberDisplayName: z.string().min(1).optional(),
  actorAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  chainKey: coopChainKeySchema.optional(),
  artifactId: z.string().min(1).optional(),
  receiptId: z.string().min(1).optional(),
  archiveScope: archiveScopeSchema.optional(),
  mode: integrationModeSchema.optional(),
});

export const privilegedActionLogEntrySchema = z.object({
  id: z.string().min(1),
  actionType: privilegedActionTypeSchema,
  status: privilegedActionStatusSchema,
  detail: z.string().min(1),
  createdAt: z.string().datetime(),
  context: privilegedActionContextSchema.default({}),
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

export type ArchiveBundle = z.infer<typeof archiveBundleSchema>;
export type ArchiveDelegationMaterial = z.infer<typeof archiveDelegationMaterialSchema>;
export type ArchiveDelegationRequestInput = z.input<typeof archiveDelegationRequestSchema>;
export type ArchiveDelegationRequest = z.infer<typeof archiveDelegationRequestSchema>;
export type ArchiveReceipt = z.infer<typeof archiveReceiptSchema>;
export type AnchorCapability = z.infer<typeof anchorCapabilitySchema>;
export type PrivilegedActionContext = z.infer<typeof privilegedActionContextSchema>;
export type PrivilegedActionLogEntry = z.infer<typeof privilegedActionLogEntrySchema>;
export type ReviewBoardGroup = z.infer<typeof reviewBoardGroupSchema>;
export type CoopMemoryProfile = z.infer<typeof coopMemoryProfileSchema>;
export type CoopArchiveConfig = z.infer<typeof coopArchiveConfigSchema>;
export type CoopArchiveSecrets = z.infer<typeof coopArchiveSecretsSchema>;
export type TrustedNodeArchiveConfig = z.infer<typeof trustedNodeArchiveConfigSchema>;
