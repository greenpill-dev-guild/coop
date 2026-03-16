export interface ServerEnv {
  port: number;
  host: string;
}

export function loadEnv(): ServerEnv {
  const rawPort = process.env.PORT?.trim();
  const port = Number(rawPort || 4444);
  if (Number.isNaN(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${process.env.PORT}`);
  }
  return {
    port,
    host: process.env.HOST?.trim() || '127.0.0.1',
  };
}
