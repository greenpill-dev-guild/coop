import { z } from 'zod';
import {
  type ReceiverCapture,
  type ReceiverPairingRecord,
  type ReceiverSyncEnvelope,
  receiverCaptureSchema,
  receiverSyncEnvelopeSchema,
} from '../../contracts/schema';
import { bytesToBase64Url, createId, nowIso } from '../../utils';
import { assertReceiverPairingRecord, filterUsableReceiverSignalingUrls } from './pairing';

const receiverRelayProtocolSchema = z.object({
  type: z.literal('publish'),
  topic: z.string().min(1),
  frame: z.unknown(),
});

export const receiverSyncRelayCaptureFrameSchema = z.object({
  kind: z.literal('capture'),
  messageId: z.string().min(1),
  sourceClientId: z.string().min(1),
  roomId: z.string().min(1),
  pairingId: z.string().min(1),
  sentAt: z.string().datetime(),
  envelope: receiverSyncEnvelopeSchema,
});

export const receiverSyncRelayAckFrameSchema = z.object({
  kind: z.literal('ack'),
  requestId: z.string().min(1),
  sourceClientId: z.string().min(1),
  roomId: z.string().min(1),
  pairingId: z.string().min(1),
  captureId: z.string().min(1),
  ok: z.boolean(),
  respondedAt: z.string().datetime(),
  capture: receiverCaptureSchema,
  error: z.string().optional(),
  signature: z.string().min(1),
});

export const receiverSyncRelayFrameSchema = z.discriminatedUnion('kind', [
  receiverSyncRelayCaptureFrameSchema,
  receiverSyncRelayAckFrameSchema,
]);

export type ReceiverSyncRelayCaptureFrame = z.infer<typeof receiverSyncRelayCaptureFrameSchema>;
export type ReceiverSyncRelayAckFrame = z.infer<typeof receiverSyncRelayAckFrameSchema>;
export type ReceiverSyncRelayFrame = z.infer<typeof receiverSyncRelayFrameSchema>;

export interface ReceiverSyncRelayConnectionState {
  connected: boolean;
  url?: string;
}

type ReceiverSyncRelayMessageKey = string;

type ReceiverSyncRelayQueuedMessage = {
  topic: string;
  frame: ReceiverSyncRelayFrame;
};

function serializeReceiverSyncRelayAckSignatureInput(
  frame: Omit<ReceiverSyncRelayAckFrame, 'signature'>,
) {
  return JSON.stringify({
    requestId: frame.requestId,
    sourceClientId: frame.sourceClientId,
    roomId: frame.roomId,
    pairingId: frame.pairingId,
    captureId: frame.captureId,
    ok: frame.ok,
    respondedAt: frame.respondedAt,
    error: frame.error ?? null,
    capture: frame.capture,
  });
}

async function signReceiverSyncRelayAck(
  frame: Omit<ReceiverSyncRelayAckFrame, 'signature'>,
  pairSecret: string,
) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Receiver relay signing is unavailable in this runtime.');
  }

  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(pairSecret),
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['sign'],
  );
  const signature = await globalThis.crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(serializeReceiverSyncRelayAckSignatureInput(frame)),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

function relayMessageKey(frame: ReceiverSyncRelayFrame) {
  return frame.kind === 'capture'
    ? `capture:${frame.envelope.capture.id}`
    : `ack:${frame.requestId}:${frame.captureId}`;
}

function reportRelayError(
  onError: ((error: Error) => void) | undefined,
  error: unknown,
  fallbackMessage: string,
) {
  if (!onError) {
    return;
  }

  onError(error instanceof Error ? error : new Error(fallbackMessage));
}

export function buildReceiverSyncRelayTopics(roomId: string) {
  return {
    captureTopic: `coop-receiver-sync/${roomId}/capture`,
    ackTopic: `coop-receiver-sync/${roomId}/ack`,
  } as const;
}

export function resolveReceiverRelayWebSocketUrls(urls: string[] = []) {
  const normalized = filterUsableReceiverSignalingUrls(urls)
    .map((value) => {
      try {
        const url = new URL(value);
        if (url.protocol === 'http:') {
          url.protocol = 'ws:';
        }
        if (url.protocol === 'https:') {
          url.protocol = 'wss:';
        }
        return ['ws:', 'wss:'].includes(url.protocol) ? url.toString() : null;
      } catch {
        return null;
      }
    })
    .filter((value): value is string => Boolean(value));

  return [...new Set(normalized)];
}

export function createReceiverSyncRelayCaptureFrame(input: {
  envelope: ReceiverSyncEnvelope;
  pairing: ReceiverPairingRecord;
  sourceClientId?: string;
  sentAt?: string;
  messageId?: string;
}) {
  const pairing = assertReceiverPairingRecord(input.pairing);
  return receiverSyncRelayCaptureFrameSchema.parse({
    kind: 'capture',
    messageId: input.messageId ?? createId('receiver-relay'),
    sourceClientId: input.sourceClientId ?? createId('receiver-relay-client'),
    roomId: pairing.roomId,
    pairingId: pairing.pairingId,
    sentAt: input.sentAt ?? nowIso(),
    envelope: input.envelope,
  });
}

export async function createReceiverSyncRelayAck(input: {
  pairing: ReceiverPairingRecord;
  requestId: string;
  capture: ReceiverCapture;
  ok: boolean;
  error?: string;
  sourceClientId?: string;
  respondedAt?: string;
}) {
  const pairing = assertReceiverPairingRecord(input.pairing);
  const unsigned = receiverSyncRelayAckFrameSchema.omit({ signature: true }).parse({
    kind: 'ack',
    requestId: input.requestId,
    sourceClientId: input.sourceClientId ?? createId('receiver-relay-client'),
    roomId: pairing.roomId,
    pairingId: pairing.pairingId,
    captureId: input.capture.id,
    ok: input.ok,
    respondedAt: input.respondedAt ?? nowIso(),
    capture: input.capture,
    error: input.error,
  });

  return receiverSyncRelayAckFrameSchema.parse({
    ...unsigned,
    signature: await signReceiverSyncRelayAck(unsigned, pairing.pairSecret),
  });
}

export async function assertReceiverSyncRelayAck(
  frame: unknown,
  pairing: ReceiverPairingRecord,
  nowMs = Date.now(),
) {
  const validatedPairing = assertReceiverPairingRecord(pairing, nowMs);
  const parsed = receiverSyncRelayAckFrameSchema.parse(frame);

  if (parsed.pairingId !== validatedPairing.pairingId) {
    throw new Error('Receiver relay ack does not match this pairing.');
  }

  if (parsed.roomId !== validatedPairing.roomId) {
    throw new Error('Receiver relay ack room does not match this pairing.');
  }

  if (parsed.capture.id !== parsed.captureId) {
    throw new Error('Receiver relay ack does not match this capture.');
  }

  if (parsed.capture.pairingId && parsed.capture.pairingId !== validatedPairing.pairingId) {
    throw new Error('Receiver relay ack capture does not match this pairing.');
  }

  if (parsed.capture.coopId && parsed.capture.coopId !== validatedPairing.coopId) {
    throw new Error('Receiver relay ack capture does not match this coop.');
  }

  if (parsed.capture.memberId && parsed.capture.memberId !== validatedPairing.memberId) {
    throw new Error('Receiver relay ack capture does not match this member.');
  }

  const expectedSignature = await signReceiverSyncRelayAck(
    {
      kind: parsed.kind,
      requestId: parsed.requestId,
      sourceClientId: parsed.sourceClientId,
      roomId: parsed.roomId,
      pairingId: parsed.pairingId,
      captureId: parsed.captureId,
      ok: parsed.ok,
      respondedAt: parsed.respondedAt,
      capture: parsed.capture,
      error: parsed.error,
    },
    validatedPairing.pairSecret,
  );
  if (expectedSignature !== parsed.signature) {
    throw new Error('Receiver relay ack integrity check failed.');
  }

  return parsed;
}

export function connectReceiverSyncRelay(input: {
  roomId: string;
  signalingUrls?: string[];
  onCapture?: (frame: ReceiverSyncRelayCaptureFrame) => void | Promise<void>;
  onAck?: (frame: ReceiverSyncRelayAckFrame) => void | Promise<void>;
  onStatusChange?: (state: ReceiverSyncRelayConnectionState) => void;
  onError?: (error: Error) => void;
  reconnectDelayMs?: number;
}) {
  const urls = resolveReceiverRelayWebSocketUrls(input.signalingUrls);
  const topics = buildReceiverSyncRelayTopics(input.roomId);
  const subscribedTopics = [
    input.onCapture ? topics.captureTopic : null,
    input.onAck ? topics.ackTopic : null,
  ].flatMap((value) => (value ? [value] : []));

  if (typeof WebSocket === 'undefined' || urls.length === 0 || subscribedTopics.length === 0) {
    return {
      configured: false,
      connected: false,
      currentUrl: undefined,
      publishCapture(_frame: ReceiverSyncRelayCaptureFrame) {
        return false;
      },
      publishAck(_frame: ReceiverSyncRelayAckFrame) {
        return false;
      },
      disconnect() {},
    };
  }

  const queuedMessages = new Map<ReceiverSyncRelayMessageKey, ReceiverSyncRelayQueuedMessage>();
  const reconnectDelayMs = input.reconnectDelayMs ?? 1_200;
  const maxReconnectAttempts = 15;
  let socket: WebSocket | null = null;
  let currentUrlIndex = 0;
  let currentUrl: string | undefined;
  let disposed = false;
  let reconnectTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let connected = false;
  let reconnectAttempts = 0;

  const emitStatus = () => {
    input.onStatusChange?.({
      connected,
      url: currentUrl,
    });
  };

  const flushQueue = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    for (const [key, message] of queuedMessages.entries()) {
      try {
        socket.send(
          JSON.stringify({
            type: 'publish',
            topic: message.topic,
            frame: message.frame,
          }),
        );
        queuedMessages.delete(key);
      } catch (error) {
        reportRelayError(input.onError, error, 'Receiver relay publish failed.');
        try {
          socket.close();
        } catch {
          // Ignore close errors while reconnecting.
        }
        break;
      }
    }
  };

  const scheduleReconnect = () => {
    if (disposed || reconnectTimer || urls.length === 0) {
      return;
    }

    if (reconnectAttempts >= maxReconnectAttempts) {
      reportRelayError(
        input.onError,
        new Error('Relay exhausted all reconnection attempts'),
        'Relay exhausted all reconnection attempts',
      );
      return;
    }

    const backoff =
      Math.min(reconnectDelayMs * 1.5 ** reconnectAttempts, 30_000) + Math.random() * 500;
    reconnectAttempts++;

    reconnectTimer = globalThis.setTimeout(() => {
      reconnectTimer = undefined;
      currentUrlIndex = (currentUrlIndex + 1) % urls.length;
      connect();
    }, backoff);
  };

  const connect = () => {
    if (disposed || socket || urls.length === 0) {
      return;
    }

    currentUrl = urls[currentUrlIndex];

    try {
      socket = new WebSocket(currentUrl);
    } catch (error) {
      reportRelayError(input.onError, error, 'Receiver relay connection failed.');
      scheduleReconnect();
      return;
    }

    socket.addEventListener('open', () => {
      connected = true;
      reconnectAttempts = 0;
      emitStatus();

      try {
        socket?.send(
          JSON.stringify({
            type: 'subscribe',
            topics: subscribedTopics,
          }),
        );
      } catch (error) {
        reportRelayError(input.onError, error, 'Receiver relay subscription failed.');
      }

      flushQueue();
    });

    socket.addEventListener('message', (event) => {
      let rawData: unknown;
      try {
        rawData =
          typeof event.data === 'string'
            ? JSON.parse(event.data)
            : JSON.parse(String(event.data ?? ''));
      } catch {
        return;
      }

      const parsedMessage = receiverRelayProtocolSchema.safeParse(rawData);
      if (!parsedMessage.success) {
        return;
      }

      if (parsedMessage.data.topic === topics.captureTopic) {
        const frame = receiverSyncRelayCaptureFrameSchema.safeParse(parsedMessage.data.frame);
        if (frame.success) {
          void input.onCapture?.(frame.data);
        }
        return;
      }

      if (parsedMessage.data.topic === topics.ackTopic) {
        const frame = receiverSyncRelayAckFrameSchema.safeParse(parsedMessage.data.frame);
        if (frame.success) {
          void input.onAck?.(frame.data);
        }
      }
    });

    const handleSocketClosed = () => {
      socket = null;
      connected = false;
      emitStatus();
      scheduleReconnect();
    };

    socket.addEventListener('close', handleSocketClosed);
    socket.addEventListener('error', () => {
      reportRelayError(input.onError, new Error('Receiver relay socket error.'), '');
    });
  };

  const queueMessage = (topic: string, frame: ReceiverSyncRelayFrame) => {
    queuedMessages.set(relayMessageKey(frame), {
      topic,
      frame,
    });
    connect();
    flushQueue();
    return true;
  };

  connect();

  return {
    configured: true,
    get connected() {
      return connected;
    },
    get currentUrl() {
      return currentUrl;
    },
    publishCapture(frame: ReceiverSyncRelayCaptureFrame) {
      return queueMessage(topics.captureTopic, frame);
    },
    publishAck(frame: ReceiverSyncRelayAckFrame) {
      return queueMessage(topics.ackTopic, frame);
    },
    disconnect() {
      disposed = true;
      if (reconnectTimer) {
        globalThis.clearTimeout(reconnectTimer);
      }
      reconnectTimer = undefined;
      connected = false;
      emitStatus();

      if (socket) {
        try {
          socket.close();
        } catch {
          // Ignore close errors during shutdown.
        }
      }
      socket = null;
      queuedMessages.clear();
    },
  };
}
