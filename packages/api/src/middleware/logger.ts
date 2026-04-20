import type { MiddlewareHandler } from 'hono';

export function logger(): MiddlewareHandler {
  return async (c, next) => {
    const startedAt = Date.now();
    await next();

    const url = new URL(c.req.url);
    const durationMs = Date.now() - startedAt;
    console.log(`${c.req.method} ${url.pathname} ${c.res.status} ${durationMs}ms`);
  };
}
