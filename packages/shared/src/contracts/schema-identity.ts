import z from 'zod';
import { authModeSchema, memberRoleSchema } from './schema-enums';

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

export type Member = z.infer<typeof memberSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type PasskeyCredential = z.infer<typeof passkeyCredentialSchema>;
export type LocalPasskeyIdentity = z.infer<typeof localPasskeyIdentitySchema>;
