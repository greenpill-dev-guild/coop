import { describe, expect, it } from 'vitest';
import {
  iceConfigErrorSchema,
  iceConfigResponseSchema,
  signalingMessageSchema,
  signalingPublishMessageSchema,
  signalingSubscribeMessageSchema,
} from '../schema-sync';

describe('sync contract schemas', () => {
  it('parses degraded and live ICE config responses', () => {
    expect(
      iceConfigResponseSchema.parse({
        iceServers: [],
        expiresAt: null,
        degraded: true,
        reason: 'turn_not_configured',
      }),
    ).toEqual({
      iceServers: [],
      expiresAt: null,
      degraded: true,
      reason: 'turn_not_configured',
    });

    expect(
      iceConfigResponseSchema.parse({
        iceServers: [
          {
            urls: ['turn:turn.coop.test:3478'],
            username: '1779019800:test-user',
            credential: 'secret',
          },
        ],
        expiresAt: '2026-05-17T12:10:00.000Z',
        degraded: false,
      }).iceServers[0]?.urls,
    ).toEqual(['turn:turn.coop.test:3478']);
  });

  it('parses the ICE rate-limit error shape', () => {
    expect(iceConfigErrorSchema.parse({ error: 'rate_limited' })).toEqual({
      error: 'rate_limited',
    });
  });

  it('normalizes subscribe topics to an array and leaves item filtering to handlers', () => {
    expect(
      signalingSubscribeMessageSchema.parse({
        type: 'subscribe',
        topics: ['room', 42, null],
      }),
    ).toEqual({
      type: 'subscribe',
      topics: ['room', 42, null],
    });

    expect(signalingSubscribeMessageSchema.parse({ type: 'subscribe', topics: 'room' })).toEqual({
      type: 'subscribe',
      topics: [],
    });
  });

  it('preserves publish passthrough fields while requiring a topic', () => {
    expect(
      signalingPublishMessageSchema.parse({
        type: 'publish',
        topic: 'room',
        payload: 'hello',
      }),
    ).toEqual({
      type: 'publish',
      topic: 'room',
      payload: 'hello',
    });

    expect(signalingMessageSchema.safeParse({ type: 'publish', payload: 'missing' }).success).toBe(
      false,
    );
  });
});
