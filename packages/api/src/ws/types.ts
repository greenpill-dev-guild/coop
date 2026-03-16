export const MESSAGE_TYPES = ['subscribe', 'unsubscribe', 'publish', 'ping'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export interface SubscribeMessage {
  type: 'subscribe';
  topics: unknown[];
}

export interface UnsubscribeMessage {
  type: 'unsubscribe';
  topics: unknown[];
}

export interface PublishMessage {
  type: 'publish';
  topic: string;
  [key: string]: unknown;
}

export interface PingMessage {
  type: 'ping';
}

export type SignalingMessage = SubscribeMessage | UnsubscribeMessage | PublishMessage | PingMessage;
