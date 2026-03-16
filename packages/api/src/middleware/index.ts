import type { Hono } from 'hono';
import { logger } from './logger';

export function applyMiddleware(app: Hono): void {
  app.use('*', logger());
}
