import z from 'zod';
import { coopChainKeySchema } from './schema-enums';

export const privilegedActionTypeSchema = z.enum([
  'anchor-mode-toggle',
  'archive-upload',
  'archive-follow-up-refresh',
  'archive-anchor',
  'safe-deployment',
  'safe-add-owner',
  'green-goods-transaction',
  'erc8004-registration',
  'erc8004-feedback',
  'fvm-register-archive',
]);

export const policyActionClassSchema = z.enum([
  'archive-artifact',
  'archive-snapshot',
  'refresh-archive-status',
  'publish-ready-draft',
  'safe-deployment',
  'safe-add-owner',
  'safe-remove-owner',
  'safe-swap-owner',
  'safe-change-threshold',
  'green-goods-create-garden',
  'green-goods-sync-garden-profile',
  'green-goods-set-garden-domains',
  'green-goods-create-garden-pools',
  'green-goods-submit-work-approval',
  'green-goods-create-assessment',
  'green-goods-sync-gap-admins',
  'green-goods-add-gardener',
  'green-goods-remove-gardener',
  'green-goods-submit-work-submission',
  'green-goods-submit-impact-report',
  'erc8004-register-agent',
  'erc8004-give-feedback',
]);

export const actionPolicySchema = z.object({
  id: z.string().min(1),
  actionClass: policyActionClassSchema,
  approvalRequired: z.boolean().default(true),
  expiresAt: z.string().datetime().optional(),
  replayProtection: z.boolean().default(true),
  coopId: z.string().min(1).optional(),
  memberId: z.string().min(1).optional(),
  targetConstraints: z.record(z.string()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const actionBundleStatusSchema = z.enum([
  'proposed',
  'approved',
  'rejected',
  'executed',
  'failed',
  'expired',
]);

export const typedActionBundleFieldSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
});

export const typedActionBundleSchema = z.object({
  domain: z.object({
    name: z.string().min(1),
    version: z.string().min(1),
    chainId: z.number().int().positive(),
    verifyingContract: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  }),
  primaryType: z.literal('CoopActionBundle'),
  types: z.object({
    CoopActionBundle: z.array(typedActionBundleFieldSchema).min(1),
  }),
  message: z.object({
    actionClass: policyActionClassSchema,
    coopId: z.string().min(1),
    memberId: z.string().min(1),
    replayId: z.string().min(1),
    payloadHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    chainKey: coopChainKeySchema,
    safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  }),
  digest: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

export const actionBundleSchema = z.object({
  id: z.string().min(1),
  replayId: z.string().min(1),
  actionClass: policyActionClassSchema,
  coopId: z.string().min(1),
  memberId: z.string().min(1),
  payload: z.record(z.any()),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  policyId: z.string().min(1),
  status: actionBundleStatusSchema,
  digest: z.string().min(1),
  typedAuthorization: typedActionBundleSchema.optional(),
  approvedAt: z.string().datetime().optional(),
  rejectedAt: z.string().datetime().optional(),
  executedAt: z.string().datetime().optional(),
  failedAt: z.string().datetime().optional(),
  failureReason: z.string().optional(),
});

export const actionLogEventTypeSchema = z.enum([
  'proposal-created',
  'proposal-approved',
  'proposal-rejected',
  'execution-started',
  'execution-succeeded',
  'execution-failed',
  'replay-rejected',
  'expiry-rejected',
]);

export const actionLogEntrySchema = z.object({
  id: z.string().min(1),
  bundleId: z.string().min(1),
  eventType: actionLogEventTypeSchema,
  actionClass: policyActionClassSchema,
  detail: z.string().min(1),
  createdAt: z.string().datetime(),
  coopId: z.string().min(1).optional(),
  memberId: z.string().min(1).optional(),
});

export const delegatedActionClassSchema = z.enum([
  'archive-artifact',
  'archive-snapshot',
  'refresh-archive-status',
  'publish-ready-draft',
]);

export const permitStatusSchema = z.enum(['active', 'expired', 'revoked', 'exhausted']);

export const permitLogEventTypeSchema = z.enum([
  'permit-issued',
  'permit-revoked',
  'permit-expired',
  'delegated-execution-attempted',
  'delegated-execution-succeeded',
  'delegated-execution-failed',
  'delegated-replay-rejected',
  'delegated-exhausted-rejected',
]);

export const executionPermitSchema = z.object({
  id: z.string().min(1),
  coopId: z.string().min(1),
  issuedBy: z.object({
    memberId: z.string().min(1),
    displayName: z.string().min(1),
    address: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .optional(),
  }),
  executor: z.object({
    label: z.string().min(1),
    localIdentityId: z.string().min(1).optional(),
  }),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().optional(),
  maxUses: z.number().int().positive(),
  usedCount: z.number().int().nonnegative().default(0),
  allowedActions: z.array(delegatedActionClassSchema).min(1),
  targetAllowlist: z.record(z.array(z.string())).optional(),
  policyRef: z.string().min(1).optional(),
  status: permitStatusSchema.default('active'),
});

export const permitLogEntrySchema = z.object({
  id: z.string().min(1),
  permitId: z.string().min(1),
  eventType: permitLogEventTypeSchema,
  actionClass: delegatedActionClassSchema.optional(),
  detail: z.string().min(1),
  createdAt: z.string().datetime(),
  coopId: z.string().min(1).optional(),
  replayId: z.string().min(1).optional(),
});

export type PrivilegedActionType = z.infer<typeof privilegedActionTypeSchema>;
export type PolicyActionClass = z.infer<typeof policyActionClassSchema>;
export type ActionPolicy = z.infer<typeof actionPolicySchema>;
export type ActionBundleStatus = z.infer<typeof actionBundleStatusSchema>;
export type TypedActionBundle = z.infer<typeof typedActionBundleSchema>;
export type ActionBundle = z.infer<typeof actionBundleSchema>;
export type ActionLogEventType = z.infer<typeof actionLogEventTypeSchema>;
export type ActionLogEntry = z.infer<typeof actionLogEntrySchema>;
export type DelegatedActionClass = z.infer<typeof delegatedActionClassSchema>;
export type PermitStatus = z.infer<typeof permitStatusSchema>;
export type PermitLogEventType = z.infer<typeof permitLogEventTypeSchema>;
export type ExecutionPermit = z.infer<typeof executionPermitSchema>;
export type PermitLogEntry = z.infer<typeof permitLogEntrySchema>;
