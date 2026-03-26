import z from 'zod';
import { capabilityStateSchema, coopChainKeySchema, fvmChainKeySchema } from './schema-enums';

export const legacyOnchainChainKeyMap = {
  celo: 'arbitrum',
  'celo-sepolia': 'sepolia',
} as const satisfies Record<string, z.infer<typeof coopChainKeySchema>>;

export const supportedOnchainChainIds = {
  arbitrum: 42161,
  sepolia: 11155111,
} as const satisfies Record<z.infer<typeof coopChainKeySchema>, number>;

function normalizeLegacyOnchainStatusNote(statusNote: string) {
  return statusNote.replaceAll('Celo Sepolia', 'Sepolia').replace(/\bCelo\b/g, 'Arbitrum');
}

export function normalizeLegacyOnchainState(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const raw = { ...(value as Record<string, unknown>) };
  const rawChainKey = typeof raw.chainKey === 'string' ? raw.chainKey : undefined;
  const normalizedChainKey = rawChainKey
    ? legacyOnchainChainKeyMap[rawChainKey as keyof typeof legacyOnchainChainKeyMap]
    : undefined;

  if (!normalizedChainKey) {
    return raw;
  }

  raw.chainKey = normalizedChainKey;
  raw.chainId = supportedOnchainChainIds[normalizedChainKey];

  if (typeof raw.statusNote === 'string') {
    raw.statusNote = normalizeLegacyOnchainStatusNote(raw.statusNote);
  }

  return raw;
}

export const onchainStateSchema = z
  .object({
    chainId: z.number().int().positive(),
    chainKey: coopChainKeySchema.default('sepolia'),
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
    safeOwners: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)).optional(),
    safeThreshold: z.number().int().positive().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.chainId !== supportedOnchainChainIds[value.chainKey]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['chainId'],
        message: `chainId must match the configured ${value.chainKey} network.`,
      });
    }
  });

export const fvmRegistryStateSchema = z.object({
  chainKey: fvmChainKeySchema,
  chainId: z.number().int().positive(),
  registryAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signerAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  statusNote: z.string(),
});

export const memberAccountTypeSchema = z.enum(['safe', 'kernel', 'smart-account']);

export const memberAccountStatusSchema = z.enum([
  'pending', // Account record created, waiting for local provisioning
  'predicted', // Counterfactual address predicted, not yet deployed
  'deploying', // Deployment transaction submitted
  'active', // Account deployed and ready
  'suspended', // Temporarily disabled
  'recovery', // Recovery flow in progress
  'error', // Provisioning or deployment failed
]);

export const memberOnchainAccountSchema = z.object({
  id: z.string(),
  memberId: z.string(),
  coopId: z.string(),
  accountAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  accountType: memberAccountTypeSchema,
  ownerPasskeyCredentialId: z.string(),
  chainKey: z.enum(['arbitrum', 'sepolia']),
  status: memberAccountStatusSchema,
  statusNote: z.string().default(''),
  deploymentTxHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .optional(),
  userOperationHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  predictedAt: z.string().datetime().optional(),
  deployedAt: z.string().datetime().optional(),
  suspendedAt: z.string().datetime().optional(),
});

export const localMemberSignerBindingSchema = z.object({
  id: z.string().min(1),
  coopId: z.string().min(1),
  memberId: z.string().min(1),
  accountAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  accountType: memberAccountTypeSchema,
  passkeyCredentialId: z.string().min(1),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime(),
  lastError: z.string().optional(),
});

// Authority classification — distinguishes signer roles in the Coop architecture
export const authorityClassSchema = z.enum([
  'safe-owner', // Treasury/governance controller on the Coop Safe
  'session-executor', // Bounded automation via session keys
  'member-account', // Per-user smart account for individual actions
  'semaphore-identity', // Privacy layer for anonymous proofs/signaling
]);

// Authority action mapping — which actions each authority class can perform
export const authorityActionMappingSchema = z.object({
  authorityClass: authorityClassSchema,
  actionClasses: z.array(z.string()),
  description: z.string(),
});

export type OnchainState = z.infer<typeof onchainStateSchema>;
export type FvmRegistryState = z.infer<typeof fvmRegistryStateSchema>;
export type MemberAccountType = z.infer<typeof memberAccountTypeSchema>;
export type MemberAccountStatus = z.infer<typeof memberAccountStatusSchema>;
export type MemberOnchainAccount = z.infer<typeof memberOnchainAccountSchema>;
export type LocalMemberSignerBinding = z.infer<typeof localMemberSignerBindingSchema>;
export type AuthorityClass = z.infer<typeof authorityClassSchema>;
export type AuthorityActionMapping = z.infer<typeof authorityActionMappingSchema>;
