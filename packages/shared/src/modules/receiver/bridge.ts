import z from 'zod';
import { receiverCaptureSchema, receiverSyncEnvelopeSchema } from '../../contracts/schema';

export const RECEIVER_BRIDGE_APP_SOURCE = 'coop-receiver-app';
export const RECEIVER_BRIDGE_EXTENSION_SOURCE = 'coop-receiver-extension';

export const receiverBridgeRequestSchema = z.discriminatedUnion('type', [
  z.object({
    source: z.literal(RECEIVER_BRIDGE_APP_SOURCE),
    type: z.literal('ping'),
    requestId: z.string().min(1),
  }),
  z.object({
    source: z.literal(RECEIVER_BRIDGE_APP_SOURCE),
    type: z.literal('ingest'),
    requestId: z.string().min(1),
    envelope: receiverSyncEnvelopeSchema,
  }),
]);

export const receiverBridgeResponseSchema = z.object({
  source: z.literal(RECEIVER_BRIDGE_EXTENSION_SOURCE),
  requestId: z.string().min(1),
  ok: z.boolean(),
  data: receiverCaptureSchema.optional(),
  error: z.string().optional(),
});

export type ReceiverBridgeRequest = z.infer<typeof receiverBridgeRequestSchema>;
export type ReceiverBridgeResponse = z.infer<typeof receiverBridgeResponseSchema>;
