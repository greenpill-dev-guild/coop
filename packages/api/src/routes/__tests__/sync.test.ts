import { afterEach, describe, expect, it, vi } from 'vitest';
import { sync } from '../sync';

const originalEnv = { ...process.env };

describe('sync routes', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reports y-websocket as relay/cache only when persistence is not configured', async () => {
    Reflect.deleteProperty(process.env, 'YJS_PERSIST_DIR');

    const response = await sync.request('/health');
    const body = await response.json();

    expect(body.yjsPersistence).toEqual({
      enabled: false,
      mode: 'relay-cache-only',
    });
  });

  it('returns degraded ICE config when TURN server env is missing', async () => {
    Reflect.deleteProperty(process.env, 'COOP_TURN_URLS');
    Reflect.deleteProperty(process.env, 'COOP_TURN_SHARED_SECRET');

    const response = await sync.request('/ice');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      iceServers: [],
      expiresAt: null,
      degraded: true,
      reason: 'turn_not_configured',
    });
  });

  it('mints short-lived TURN credentials from server-only env', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-17T12:00:00.000Z'));
    process.env.COOP_TURN_URLS = 'turn:turn.coop.test:3478';
    process.env.COOP_TURN_SHARED_SECRET = 'shared-secret';
    process.env.COOP_TURN_USERNAME_PREFIX = 'test-user';
    process.env.COOP_TURN_TTL_SECONDS = '600';

    const response = await sync.request('/ice');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.degraded).toBe(false);
    expect(body.expiresAt).toBe('2026-05-17T12:10:00.000Z');
    expect(body.iceServers[0]).toMatchObject({
      urls: ['turn:turn.coop.test:3478'],
      username: '1779019800:test-user',
    });
    expect(typeof body.iceServers[0].credential).toBe('string');
  });

  it('rate limits ICE credential minting per client', async () => {
    process.env.COOP_TURN_URLS = 'turn:turn.coop.test:3478';
    process.env.COOP_TURN_SHARED_SECRET = 'shared-secret';

    let response: Response | undefined;
    for (let request = 0; request < 61; request += 1) {
      response = await sync.request('/ice', {
        headers: {
          'x-forwarded-for': '203.0.113.61',
        },
      });
    }

    expect(response?.status).toBe(429);
    expect(await response?.json()).toEqual({ error: 'rate_limited' });
  });
});
