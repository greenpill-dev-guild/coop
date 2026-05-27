import type { SignalingMessage as SharedSignalingMessage } from '@coop/shared';

export const MESSAGE_TYPES = ['subscribe', 'unsubscribe', 'publish', 'ping'] as const;
export type MessageType = SharedSignalingMessage['type'];

export type SubscribeMessage = Extract<SharedSignalingMessage, { type: 'subscribe' }>;

export type UnsubscribeMessage = Extract<SharedSignalingMessage, { type: 'unsubscribe' }>;

export type PublishMessage = Extract<SharedSignalingMessage, { type: 'publish' }>;

export type PingMessage = Extract<SharedSignalingMessage, { type: 'ping' }>;

export type SignalingMessage = SubscribeMessage | UnsubscribeMessage | PublishMessage | PingMessage;
