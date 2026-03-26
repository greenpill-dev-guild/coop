import z from 'zod';

export const privacyIdentitySchema = z.object({
  commitment: z.string().min(1),
  publicKey: z.tuple([z.string().min(1), z.string().min(1)]),
  exportedPrivateKey: z.string().min(1),
});

export const privacyGroupSchema = z.object({
  id: z.string().min(1),
  memberCount: z.number().int().nonnegative(),
  merkleRoot: z.string().min(1),
});

export const stealthSchemeIdSchema = z.literal(1);

export const stealthKeysSchema = z.object({
  spendingKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'spending key must be a 32-byte hex string'),
  viewingKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'viewing key must be a 32-byte hex string'),
  spendingPublicKey: z
    .string()
    .regex(/^0x[a-fA-F0-9]+$/, 'spending public key must be a hex string'),
  viewingPublicKey: z.string().regex(/^0x[a-fA-F0-9]+$/, 'viewing public key must be a hex string'),
});

export const stealthMetaAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]+$/, 'stealth meta-address must be a hex string')
  .refine(
    (v) => v.length >= 134,
    'stealth meta-address must encode both spending and viewing public keys',
  );

export const stealthAddressSchema = z.object({
  stealthAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  ephemeralPublicKey: z.string().regex(/^0x[a-fA-F0-9]+$/),
  viewTag: z.string().regex(/^0x[a-fA-F0-9]+$/),
});

export const stealthAnnouncementSchema = z.object({
  schemeId: stealthSchemeIdSchema,
  stealthAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  ephemeralPublicKey: z.string().regex(/^0x[a-fA-F0-9]+$/),
  metadata: z.string().regex(/^0x[a-fA-F0-9]*$/),
});

export const privacyIdentityRecordSchema = z.object({
  id: z.string().min(1),
  coopId: z.string().min(1),
  memberId: z.string().min(1),
  commitment: z.string().min(1),
  publicKey: z.tuple([z.string().min(1), z.string().min(1)]),
  exportedPrivateKey: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const stealthKeyPairRecordSchema = z.object({
  id: z.string().min(1),
  coopId: z.string().min(1),
  spendingKey: z.string().min(1),
  viewingKey: z.string().min(1),
  spendingPublicKey: z.string().min(1),
  viewingPublicKey: z.string().min(1),
  metaAddress: z.string().min(1),
  createdAt: z.string().datetime(),
});

export type PrivacyIdentity = z.infer<typeof privacyIdentitySchema>;
export type PrivacyGroup = z.infer<typeof privacyGroupSchema>;
export type StealthSchemeId = z.infer<typeof stealthSchemeIdSchema>;
export type StealthKeys = z.infer<typeof stealthKeysSchema>;
export type StealthMetaAddress = z.infer<typeof stealthMetaAddressSchema>;
export type StealthAddress = z.infer<typeof stealthAddressSchema>;
export type StealthAnnouncement = z.infer<typeof stealthAnnouncementSchema>;
export type PrivacyIdentityRecord = z.infer<typeof privacyIdentityRecordSchema>;
export type StealthKeyPairRecord = z.infer<typeof stealthKeyPairRecordSchema>;
