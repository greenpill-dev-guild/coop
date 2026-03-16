import { Hono } from 'hono';

const health = new Hono();

health.get('/', (c) => c.json({ status: 'ok' }));

export { health };
