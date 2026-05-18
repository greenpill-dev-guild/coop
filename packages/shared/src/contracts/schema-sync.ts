import z from 'zod';

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
  bootstrapSnapshot: z.unknown().optional(),
  createdAt: z.string().datetime(),
});

export type SyncRoomBootstrap = z.infer<typeof syncRoomBootstrapSchema>;
export type SyncRoomConfig = z.infer<typeof syncRoomConfigSchema>;
export type InviteHandoffRoom = z.infer<typeof inviteHandoffRoomSchema>;
export type InviteHandoffRequest = z.infer<typeof inviteHandoffRequestSchema>;
export type InviteHandoffResponse = z.infer<typeof inviteHandoffResponseSchema>;
export type InviteHandoffPayload = z.infer<typeof inviteHandoffPayloadSchema>;
