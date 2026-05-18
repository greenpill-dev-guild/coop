import z from 'zod';

export const webAuthnRotationSignatureSchema = z.object({
  authenticatorData: z.string().regex(/^0x[a-fA-F0-9]+$/),
  clientDataJSON: z.string().min(1),
  challengeIndex: z.number().int().nonnegative(),
  typeIndex: z.number().int().nonnegative(),
  userVerificationRequired: z.boolean(),
});

export const syncRoomRotationProofSchema = z.object({
  kind: z.literal('coop-sync-room-rotation-proof-v1'),
  coopId: z.string().min(1),
  previousRoomId: z.string().min(1),
  roomId: z.string().min(1),
  roomEpoch: z.number().int().nonnegative(),
  previousRoomIds: z.array(z.string().min(1)).default([]),
  rotatedAt: z.string().datetime().optional(),
  rotatedBy: z.string().min(1).optional(),
  signerMemberId: z.string().min(1),
  signerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signerPasskeyCredentialId: z.string().min(1),
  signerPasskeyPublicKey: z.string().regex(/^0x[a-fA-F0-9]+$/),
  signerPasskeyRpId: z.string().min(1),
  challenge: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/),
  webauthn: webAuthnRotationSignatureSchema,
  createdAt: z.string().datetime(),
});

export const syncRoomConfigSchema = z.object({
  coopId: z.string().min(1),
  roomSecret: z.string().min(1),
  roomId: z.string().min(1),
  inviteSigningSecret: z.string().min(1),
  signalingUrls: z.array(z.string().url()).default([]),
  roomEpoch: z.number().int().nonnegative().optional(),
  previousRoomIds: z.array(z.string().min(1)).default([]),
  rotatedAt: z.string().datetime().optional(),
  rotatedBy: z.string().min(1).optional(),
  rotationProof: syncRoomRotationProofSchema.optional(),
});

export const syncRoomBootstrapSchema = z.object({
  coopId: z.string().min(1),
  roomId: z.string().min(1),
  roomSecret: z.string().min(1).optional(),
  signalingUrls: z.array(z.string().url()).default([]),
});

export const inviteHandoffRoomSchema = z.object({
  inviteId: z.string().min(1),
  roomId: z.string().min(1),
  roomSecret: z.string().min(1),
  signalingUrls: z.array(z.string().url()).default([]),
});

export const inviteHandoffRequestSchema = z.object({
  requestId: z.string().min(1),
  coopId: z.string().min(1),
  inviteId: z.string().min(1),
  memberId: z.string().min(1),
  memberDisplayName: z.string().min(1),
  publicKeyJwk: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
});

export const inviteHandoffResponseSchema = z.object({
  requestId: z.string().min(1),
  coopId: z.string().min(1),
  inviteId: z.string().min(1),
  memberId: z.string().min(1),
  roomId: z.string().min(1),
  signalingUrls: z.array(z.string().url()).default([]),
  encryptedPayloadBase64: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const inviteHandoffPayloadSchema = z.object({
  requestId: z.string().min(1),
  coopId: z.string().min(1),
  inviteId: z.string().min(1),
  recipientMemberId: z.string().min(1),
  roomEpoch: z.number().int().nonnegative().default(1),
  roomId: z.string().min(1),
  roomSecret: z.string().min(1),
  inviteSigningSecret: z.string().min(1),
  signalingUrls: z.array(z.string().url()).default([]),
  rotationProof: syncRoomRotationProofSchema.optional(),
  bootstrapSnapshot: z.unknown().optional(),
  createdAt: z.string().datetime(),
});

export const roomRotationAnnouncementSchema = z.object({
  announcementId: z.string().min(1),
  coopId: z.string().min(1),
  previousRoomId: z.string().min(1),
  roomId: z.string().min(1),
  roomEpoch: z.number().int().nonnegative().default(1),
  previousRoomIds: z.array(z.string().min(1)).default([]),
  signalingUrls: z.array(z.string().url()).default([]),
  rotatedAt: z.string().datetime().optional(),
  rotatedBy: z.string().min(1).optional(),
  rotationProof: syncRoomRotationProofSchema.optional(),
  createdAt: z.string().datetime(),
  proof: z.string().min(1),
});

export type SyncRoomRotationProof = z.infer<typeof syncRoomRotationProofSchema>;
export type SyncRoomBootstrap = z.infer<typeof syncRoomBootstrapSchema>;
export type SyncRoomConfig = z.infer<typeof syncRoomConfigSchema>;
export type InviteHandoffRoom = z.infer<typeof inviteHandoffRoomSchema>;
export type InviteHandoffRequest = z.infer<typeof inviteHandoffRequestSchema>;
export type InviteHandoffResponse = z.infer<typeof inviteHandoffResponseSchema>;
export type InviteHandoffPayload = z.infer<typeof inviteHandoffPayloadSchema>;
export type RoomRotationAnnouncement = z.infer<typeof roomRotationAnnouncementSchema>;
