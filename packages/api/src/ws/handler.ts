import type { WSContext, WSMessageReceive } from 'hono/ws';
import type { TopicRegistry } from './topics';
import type { MessageType } from './types';
import { rawKey } from './ws-utils';

const decoder = new TextDecoder();

/** Maximum publish messages allowed per connection within the sliding window. */
export const MAX_PUBLISH_PER_WINDOW = 60;

/** Sliding window duration in milliseconds for publish rate limiting. */
export const PUBLISH_WINDOW_MS = 10_000;

/**
 * Safely send a JSON message to a WebSocket connection.
 * Checks readyState before sending; closes on failure.
 */
function send(ws: WSContext, message: Record<string, unknown>): void {
  const readyState = ws.readyState;
  // 0 = CONNECTING, 1 = OPEN
  if (readyState !== 0 && readyState !== 1) {
    ws.close();
    return;
  }
  try {
    ws.send(JSON.stringify(message));
  } catch {
    ws.close();
  }
}

export function createWSHandlers(registry: TopicRegistry) {
  /**
   * Per-connection subscribed topics, keyed on the raw Bun ServerWebSocket.
   * Scoped to this handler instance so tests get isolated state.
   */
  const connectionTopics = new Map<object, Set<string>>();

  /** Per-connection publish timestamps for sliding-window rate limiting. */
  const publishTimestamps = new Map<object, number[]>();

  /** Connections that have begun closing — reject late messages. */
  const closedConnections = new WeakSet<object>();
  const authorizedTopics = new WeakMap<object, string>();

  function getSubscribedTopics(ws: WSContext): Set<string> {
    const key = rawKey(ws);
    let topics = connectionTopics.get(key);
    if (!topics) {
      topics = new Set();
      connectionTopics.set(key, topics);
    }
    return topics;
  }

  function cleanup(ws: WSContext): void {
    const key = rawKey(ws);
    const subscribedTopics = connectionTopics.get(key);
    if (subscribedTopics) {
      registry.removeAll(ws, subscribedTopics);
      connectionTopics.delete(key);
    }
    publishTimestamps.delete(key);
    closedConnections.add(key);
  }

  return {
    authorizeConnection(ws: WSContext, topicName: string): void {
      authorizedTopics.set(rawKey(ws), topicName);
    },

    onOpen(_evt: Event, ws: WSContext): void {
      getSubscribedTopics(ws);
    },

    onMessage(evt: MessageEvent<WSMessageReceive>, ws: WSContext): void {
      // Reject messages on connections that have begun closing
      if (closedConnections.has(rawKey(ws))) {
        return;
      }

      let message: Record<string, unknown>;
      try {
        const raw =
          typeof evt.data === 'string' ? evt.data : decoder.decode(evt.data as ArrayBuffer);
        message = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        console.warn('[ws] malformed JSON from client, dropping');
        return;
      }

      if (!message?.type) {
        return;
      }

      const subscribedTopics = getSubscribedTopics(ws);
      const authorizedTopic = authorizedTopics.get(rawKey(ws));
      const type = message.type as MessageType;

      switch (type) {
        case 'subscribe': {
          const topics = (message.topics as unknown[]) ?? [];
          for (const topicName of topics) {
            if (typeof topicName !== 'string') {
              continue;
            }
            if (authorizedTopic && topicName !== authorizedTopic) {
              continue;
            }
            registry.subscribe(ws, topicName);
            subscribedTopics.add(topicName);
          }
          break;
        }

        case 'unsubscribe': {
          const topics = (message.topics as unknown[]) ?? [];
          for (const topicName of topics) {
            if (typeof topicName !== 'string') {
              continue;
            }
            if (authorizedTopic && topicName !== authorizedTopic) {
              continue;
            }
            registry.unsubscribe(ws, topicName);
            subscribedTopics.delete(topicName);
          }
          break;
        }

        case 'publish': {
          if (typeof message.topic !== 'string' || !message.topic) {
            break;
          }
          const topicName = message.topic;

          if (authorizedTopic && topicName !== authorizedTopic) {
            break;
          }

          // Topic authorization: must be subscribed to the topic to publish
          if (!subscribedTopics.has(topicName)) {
            break;
          }

          // Sliding-window rate limiting
          const key = rawKey(ws);
          const now = Date.now();
          let timestamps = publishTimestamps.get(key);
          if (!timestamps) {
            timestamps = [];
            publishTimestamps.set(key, timestamps);
          }
          // Evict entries older than the window
          const cutoff = now - PUBLISH_WINDOW_MS;
          while (timestamps.length > 0 && (timestamps[0] as number) <= cutoff) {
            timestamps.shift();
          }
          if (timestamps.length >= MAX_PUBLISH_PER_WINDOW) {
            break;
          }
          timestamps.push(now);

          const subscribers = registry.getSubscribers(topicName);
          if (!subscribers) break;

          for (const receiver of subscribers) {
            send(receiver, {
              ...message,
              clients: registry.getSubscriberCount(topicName),
            });
          }
          break;
        }

        case 'ping': {
          send(ws, { type: 'pong' });
          break;
        }
      }
    },

    onClose(_evt: CloseEvent, ws: WSContext): void {
      cleanup(ws);
    },

    onError(_evt: Event, ws: WSContext): void {
      console.warn('[ws] connection error');
      cleanup(ws);
      try {
        ws.close();
      } catch {
        // already closed
      }
    },
  };
}
