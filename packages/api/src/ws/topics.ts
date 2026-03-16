import type { WSContext } from 'hono/ws';

/**
 * Stable identity key for a WSContext.
 *
 * Hono's Bun adapter creates a fresh WSContext wrapper for every event
 * (open, message, close), so object identity differs across calls for the
 * same connection. `ws.raw` points to the underlying Bun ServerWebSocket
 * which *is* stable, so we use it as the Map key.
 */
function wsKey(ws: WSContext): unknown {
  return ws.raw ?? ws;
}

export class TopicRegistry {
  /** topic name -> Map<stable key, WSContext> */
  private topics = new Map<string, Map<unknown, WSContext>>();

  subscribe(ws: WSContext, topicName: string): void {
    let subscribers = this.topics.get(topicName);
    if (!subscribers) {
      subscribers = new Map();
      this.topics.set(topicName, subscribers);
    }
    subscribers.set(wsKey(ws), ws);
  }

  unsubscribe(ws: WSContext, topicName: string): void {
    const subscribers = this.topics.get(topicName);
    if (!subscribers) return;
    subscribers.delete(wsKey(ws));
    if (subscribers.size === 0) {
      this.topics.delete(topicName);
    }
  }

  getSubscribers(topicName: string): Iterable<WSContext> | undefined {
    const subscribers = this.topics.get(topicName);
    return subscribers ? subscribers.values() : undefined;
  }

  getSubscriberCount(topicName: string): number {
    return this.topics.get(topicName)?.size ?? 0;
  }

  removeAll(ws: WSContext, subscribedTopics: Set<string>): void {
    const key = wsKey(ws);
    for (const topicName of subscribedTopics) {
      const subscribers = this.topics.get(topicName);
      if (!subscribers) continue;
      subscribers.delete(key);
      if (subscribers.size === 0) {
        this.topics.delete(topicName);
      }
    }
    subscribedTopics.clear();
  }
}
