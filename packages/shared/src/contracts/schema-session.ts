import z from 'zod';
import { coopChainKeySchema } from './schema-enums';
import { policyActionClassSchema } from './schema-policy';

export const sessionCapableActionClassSchema = z.enum([
  'green-goods-create-garden',
  'green-goods-sync-garden-profile',
  'green-goods-set-garden-domains',
  'green-goods-create-garden-pools',
]);

export const sessionCapabilityStatusSchema = z.enum([
  'active',
  'expired',
  'revoked',
  'exhausted',
  'unusable',
]);

export const sessionCapabilityFailureReasonSchema = z.enum([
  'expired',
  'revoked',
  'exhausted',
  'allowlist-mismatch',
  'action-denied',
  'missing-safe',
  'missing-pimlico',
  'wrong-chain',
  'missing-session-material',
  'unsupported-action',
  'module-unavailable',
]);

export const sessionCapabilityScopeSchema = z.object({
  allowedActions: z.array(sessionCapableActionClassSchema).min(1),
  targetAllowlist: z.record(z.array(z.string())).default({}),
  maxUses: z.number().int().positive(),
  expiresAt: z.string().datetime(),
  chainKey: coopChainKeySchema,
  safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

export const sessionCapabilitySchema = z.object({
  id: z.string().min(1),
  coopId: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  revokedAt: z.string().datetime().optional(),
  lastUsedAt: z.string().datetime().optional(),
  permissionId: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .optional(),
  sessionAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  validatorAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  validatorInitData: z.string().regex(/^0x[a-fA-F0-9]*$/),
  status: sessionCapabilityStatusSchema.default('active'),
  statusDetail: z.string().min(1),
  lastValidationFailure: sessionCapabilityFailureReasonSchema.optional(),
  moduleInstalledAt: z.string().datetime().optional(),
  enableSignature: z
    .string()
    .regex(/^0x[a-fA-F0-9]*$/)
    .optional(),
  scope: sessionCapabilityScopeSchema,
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
  usedCount: z.number().int().nonnegative().default(0),
});

export const sessionCapabilityLogEventTypeSchema = z.enum([
  'session-issued',
  'session-rotated',
  'session-revoked',
  'session-module-installed',
  'session-module-install-failed',
  'session-execution-attempted',
  'session-execution-succeeded',
  'session-execution-failed',
  'session-validation-rejected',
]);

export const sessionCapabilityLogEntrySchema = z.object({
  id: z.string().min(1),
  capabilityId: z.string().min(1),
  coopId: z.string().min(1),
  eventType: sessionCapabilityLogEventTypeSchema,
  detail: z.string().min(1),
  createdAt: z.string().datetime(),
  actionClass: policyActionClassSchema.optional(),
  bundleId: z.string().min(1).optional(),
  replayId: z.string().min(1).optional(),
  reason: sessionCapabilityFailureReasonSchema.optional(),
});

export const encryptedSessionMaterialSchema = z.object({
  capabilityId: z.string().min(1),
  sessionAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
  salt: z.string().optional(),
  algorithm: z.literal('aes-gcm'),
  wrappedAt: z.string().datetime(),
  version: z.literal(1),
});

export const encryptedLocalPayloadKindSchema = z.enum([
  'tab-candidate',
  'page-extract',
  'review-draft',
  'receiver-capture',
  'receiver-blob',
  'agent-memory',
  'coop-blob',
]);

export const encryptedLocalPayloadSchema = z.object({
  id: z.string().min(1),
  kind: encryptedLocalPayloadKindSchema,
  entityId: z.string().min(1),
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
  salt: z.string().min(1),
  algorithm: z.literal('aes-gcm'),
  wrappedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  version: z.literal(1),
});

export type SessionCapableActionClass = z.infer<typeof sessionCapableActionClassSchema>;
export type SessionCapabilityStatus = z.infer<typeof sessionCapabilityStatusSchema>;
export type SessionCapabilityFailureReason = z.infer<typeof sessionCapabilityFailureReasonSchema>;
export type SessionCapabilityScope = z.infer<typeof sessionCapabilityScopeSchema>;
export type SessionCapability = z.infer<typeof sessionCapabilitySchema>;
export type SessionCapabilityLogEventType = z.infer<typeof sessionCapabilityLogEventTypeSchema>;
export type SessionCapabilityLogEntry = z.infer<typeof sessionCapabilityLogEntrySchema>;
export type EncryptedSessionMaterial = z.infer<typeof encryptedSessionMaterialSchema>;
export type EncryptedLocalPayloadKind = z.infer<typeof encryptedLocalPayloadKindSchema>;
export type EncryptedLocalPayload = z.infer<typeof encryptedLocalPayloadSchema>;
