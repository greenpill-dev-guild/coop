import z from 'zod';
import { archiveWorthinessSchema } from './schema-agent';

export const receiverCaptureKindSchema = z.enum(['audio', 'photo', 'file', 'link']);
export const receiverCaptureSyncStateSchema = z.enum(['local-only', 'queued', 'synced', 'failed']);
export const receiverIntakeStatusSchema = z.enum([
  'private-intake',
  'candidate',
  'draft',
  'published',
  'archived',
]);

export const receiverDeviceIdentitySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  createdAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
});

export const receiverPairingPayloadSchema = z.object({
  version: z.literal(1),
  pairingId: z.string().min(1),
  coopId: z.string().min(1),
  coopDisplayName: z.string().min(1),
  memberId: z.string().min(1),
  memberDisplayName: z.string().min(1),
  pairSecret: z.string().min(1),
  roomId: z.string().min(1).optional(),
  signalingUrls: z.array(z.string().url()).default([]),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export const receiverPairingRecordSchema = receiverPairingPayloadSchema.extend({
  roomId: z.string().min(1),
  acceptedAt: z.string().datetime().optional(),
  lastSyncedAt: z.string().datetime().optional(),
  pairingCode: z.string().min(1).optional(),
  deepLink: z.string().url().optional(),
  active: z.boolean().default(true),
});

export const receiverCaptureSchema = z.object({
  id: z.string().min(1),
  deviceId: z.string().min(1),
  pairingId: z.string().min(1).optional(),
  coopId: z.string().min(1).optional(),
  coopDisplayName: z.string().min(1).optional(),
  memberId: z.string().min(1).optional(),
  memberDisplayName: z.string().min(1).optional(),
  kind: receiverCaptureKindSchema,
  title: z.string().min(1),
  note: z.string().default(''),
  sourceUrl: z.string().url().optional(),
  fileName: z.string().optional(),
  mimeType: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  syncState: receiverCaptureSyncStateSchema,
  syncError: z.string().optional(),
  syncedAt: z.string().datetime().optional(),
  lastSyncAttemptAt: z.string().datetime().optional(),
  nextRetryAt: z.string().datetime().optional(),
  retryCount: z.number().int().nonnegative().default(0),
  intakeStatus: receiverIntakeStatusSchema.default('private-intake'),
  linkedDraftId: z.string().min(1).optional(),
  archivedAt: z.string().datetime().optional(),
  publishedAt: z.string().datetime().optional(),
  archiveWorthiness: archiveWorthinessSchema.optional(),
});

export const receiverSyncAssetSchema = z.object({
  captureId: z.string().min(1),
  mimeType: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  fileName: z.string().optional(),
  dataBase64: z.string().min(1),
});

export const receiverSyncAuthSchema = z.object({
  version: z.literal(1),
  algorithm: z.literal('hmac-sha256'),
  pairingId: z.string().min(1),
  signedAt: z.string().datetime(),
  signature: z.string().min(1),
});

export const receiverSyncEnvelopeSchema = z.object({
  capture: receiverCaptureSchema,
  asset: receiverSyncAssetSchema,
  auth: receiverSyncAuthSchema,
});

export type ReceiverCapture = z.infer<typeof receiverCaptureSchema>;
export type ReceiverCaptureKind = z.infer<typeof receiverCaptureKindSchema>;
export type ReceiverIntakeStatus = z.infer<typeof receiverIntakeStatusSchema>;
export type ReceiverCaptureSyncState = z.infer<typeof receiverCaptureSyncStateSchema>;
export type ReceiverDeviceIdentity = z.infer<typeof receiverDeviceIdentitySchema>;
export type ReceiverPairingPayload = z.infer<typeof receiverPairingPayloadSchema>;
export type ReceiverPairingRecord = z.infer<typeof receiverPairingRecordSchema>;
export type ReceiverSyncAsset = z.infer<typeof receiverSyncAssetSchema>;
export type ReceiverSyncAuth = z.infer<typeof receiverSyncAuthSchema>;
export type ReceiverSyncEnvelope = z.infer<typeof receiverSyncEnvelopeSchema>;
