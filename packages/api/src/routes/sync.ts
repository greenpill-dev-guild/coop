import { createHmac } from 'node:crypto';
import { Hono } from 'hono';

const sync = new Hono();

const ICE_RATE_LIMIT_WINDOW_MS = 60_000;
const ICE_RATE_LIMIT_MAX = 60;
const iceRateLimits = new Map<string, { count: number; resetAt: number }>();

function getClientKey(c: { req: { header(name: string): string | undefined } }) {
  return (
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

function checkIceRateLimit(clientKey: string, now = Date.now()) {
  const current = iceRateLimits.get(clientKey);
  if (!current || current.resetAt <= now) {
    iceRateLimits.set(clientKey, { count: 1, resetAt: now + ICE_RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (current.count >= ICE_RATE_LIMIT_MAX) {
    return false;
  }

  current.count += 1;
  return true;
}

function parseTurnUrls(raw?: string) {
  return raw
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

sync.get('/health', (c) =>
  c.json({
    status: 'ok',
    yjsPersistence: {
      enabled: Boolean(process.env.YJS_PERSIST_DIR?.trim()),
      mode: process.env.YJS_PERSIST_DIR?.trim() ? 'file-cache' : 'relay-cache-only',
    },
  }),
);

sync.get('/ice', (c) => {
  const clientKey = getClientKey(c);
  if (!checkIceRateLimit(clientKey)) {
    return c.json({ error: 'rate_limited' }, 429);
  }

  const urls = parseTurnUrls(process.env.COOP_TURN_URLS);
  const sharedSecret = process.env.COOP_TURN_SHARED_SECRET?.trim();
  if (!urls?.length || !sharedSecret) {
    return c.json({
      iceServers: [],
      expiresAt: null,
      degraded: true,
      reason: 'turn_not_configured',
    });
  }

  const ttlSeconds = Number(process.env.COOP_TURN_TTL_SECONDS ?? 3600);
  const safeTtlSeconds = Number.isFinite(ttlSeconds)
    ? Math.min(Math.max(Math.floor(ttlSeconds), 300), 86_400)
    : 3600;
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + safeTtlSeconds;
  const usernamePrefix = process.env.COOP_TURN_USERNAME_PREFIX?.trim() || 'coop';
  const username = `${expiresAtSeconds}:${usernamePrefix}`;
  const credential = createHmac('sha1', sharedSecret).update(username).digest('base64');

  return c.json({
    iceServers: [
      {
        urls,
        username,
        credential,
      },
    ],
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
    degraded: false,
  });
});

export { sync };
