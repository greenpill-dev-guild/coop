import type { Express } from 'express';
import { createApp } from './app';
import { config } from './config';

const app: Express = createApp();

app.listen(config.port, () => {
  console.log(`Coop issuer listening on port ${config.port}`);
});

export default app;
