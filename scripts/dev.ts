#!/usr/bin/env bun

import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import readline from 'node:readline';
import { loadRootEnv, repoRoot } from './load-root-env';

loadRootEnv();

const LOCAL_HOST = '127.0.0.1';
const DEFAULT_APP_PORT = 3001;
const DEFAULT_API_PORT = 4444;
const DEFAULT_DOCS_PORT = 3003;
const EXTENSION_OUTPUT_DIR = path.join(repoRoot, 'packages/extension/.output/chrome-mv3');
const DEV_STATE_DIR = path.join(repoRoot, 'packages/app/public/__coop_dev__');
const DEV_STATE_PATH = path.join(DEV_STATE_DIR, 'state.json');

type TunnelMode = 'auto' | 'off' | 'required';
type ServiceStatus = 'starting' | 'ready' | 'disabled' | 'error';

type ServiceState = {
  localUrl?: string;
  publicUrl?: string;
  websocketUrl?: string;
  qrUrl?: string;
  status: ServiceStatus;
  reason?: string;
};

type DevState = {
  version: 1;
  updatedAt: string;
  accessToken?: string;
  app: ServiceState;
  api: ServiceState;
  docs: ServiceState;
  extension: {
    distPath: string;
    mode: 'watch';
    receiverAppUrl: string;
    signalingUrls: string[];
    websocketSyncUrl?: string;
    status: ServiceStatus;
  };
  tunnel: {
    enabled: boolean;
    provider?: 'cloudflare';
    status: ServiceStatus;
    reason?: string;
  };
};

type ManagedProcess = {
  label: string;
  child: ChildProcess;
  allowExit?: boolean;
};

function parseTunnelMode(raw: string | undefined): TunnelMode {
  if (raw === 'off' || raw === 'required' || raw === 'auto') {
    return raw;
  }
  return 'auto';
}

function parsePort(raw: string | undefined, fallback: number, label: string) {
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error(`${label} must be a valid TCP port. Received "${raw}".`);
  }
  return parsed;
}

function formatLog(label: string, line: string) {
  return `[${label}] ${line}`;
}

function pipeOutput(
  label: string,
  stream: NodeJS.ReadableStream | null,
  writer: NodeJS.WriteStream,
  onLine?: (line: string) => void,
) {
  if (!stream) {
    return;
  }

  const rl = readline.createInterface({ input: stream });
  rl.on('line', (line) => {
    onLine?.(line);
    writer.write(`${formatLog(label, line)}\n`);
  });
}

function spawnManagedProcess(
  label: string,
  command: string[],
  options: {
    env?: NodeJS.ProcessEnv;
    allowExit?: boolean;
    onLine?: (line: string) => void;
  } = {},
): ManagedProcess {
  const child = spawn(command[0], command.slice(1), {
    cwd: repoRoot,
    env: options.env ?? process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  pipeOutput(label, child.stdout, process.stdout, options.onLine);
  pipeOutput(label, child.stderr, process.stderr, options.onLine);

  return {
    label,
    child,
    allowExit: options.allowExit,
  };
}

function writeDevState(state: DevState) {
  fs.mkdirSync(DEV_STATE_DIR, { recursive: true });
  fs.writeFileSync(
    DEV_STATE_PATH,
    `${JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2)}\n`,
    'utf8',
  );
}

async function waitForPort(host: string, port: number, timeoutMs: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const connected = await new Promise<boolean>((resolve) => {
      const socket = net.connect({ host, port });
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => resolve(false));
    });

    if (connected) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${host}:${port}`);
}

async function waitForHttpReady(url: string, timeoutMs: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        },
      });

      if (response.ok || response.status === 404) {
        await response.arrayBuffer().catch(() => undefined);
        return;
      }
    } catch {
      // Retry until timeout; the service may still be compiling or booting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${url} to return an HTTP response.`);
}

function createWaiter(description: string, timeoutMs: number) {
  let settled = false;
  let resolvePromise!: () => void;
  let rejectPromise!: (error: Error) => void;

  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = () => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      resolve();
    };

    rejectPromise = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      reject(error);
    };
  });

  const timeout = setTimeout(() => {
    rejectPromise(new Error(`Timed out waiting for ${description}.`));
  }, timeoutMs);

  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
  };
}

async function isPortAvailable(host: string, port: number) {
  return new Promise<boolean>((resolve, reject) => {
    const server = net.createServer();
    let settled = false;

    const finish = (available: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(available);
    };

    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        finish(false);
        return;
      }
      reject(error);
    });

    server.listen(port, host, () => {
      server.close(() => finish(true));
    });
  });
}

function describeListeningProcess(port: number) {
  const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fpct'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  if (result.status !== 0 || !result.stdout.trim()) {
    return undefined;
  }

  const details = {
    pid: undefined as string | undefined,
    command: undefined as string | undefined,
    name: undefined as string | undefined,
  };

  for (const line of result.stdout.trim().split('\n')) {
    if (line.startsWith('p')) {
      details.pid = line.slice(1);
      continue;
    }
    if (line.startsWith('c')) {
      details.command = line.slice(1);
      continue;
    }
    if (line.startsWith('t')) {
      details.name = line.slice(1);
    }
  }

  return details;
}

async function assertPortAvailable(host: string, port: number, label: string) {
  if (await isPortAvailable(host, port)) {
    return;
  }

  const owner = describeListeningProcess(port);
  const ownerMessage =
    owner?.pid || owner?.command
      ? ` Currently owned by PID ${owner.pid ?? 'unknown'}${owner.command ? ` (${owner.command})` : ''}.`
      : '';

  throw new Error(
    `${label} port ${port} is already in use on ${host}.${ownerMessage} Stop the existing process or change the port before running bun dev.`,
  );
}

function generateAccessToken() {
  return randomBytes(6).toString('base64url').replace(/[-_]/g, '').slice(0, 8).toUpperCase();
}

async function commandExists(command: string) {
  return new Promise<boolean>((resolve) => {
    const child = spawn('sh', ['-c', `command -v ${command}`], {
      cwd: repoRoot,
      stdio: 'ignore',
    });
    child.on('exit', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

async function startCloudflareTunnel(label: string, url: string) {
  const child = spawn('cloudflared', ['tunnel', '--url', url, '--no-autoupdate'], {
    cwd: repoRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let resolved = false;

  const publicUrl = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${label} tunnel URL.`));
    }, 60_000);

    const onLine = (line: string) => {
      const match = line.match(/https:\/\/[-a-z0-9]+\.trycloudflare\.com/iu);
      if (!match) {
        return;
      }

      resolved = true;
      clearTimeout(timeout);
      resolve(match[0]);
    };

    if (!child.stdout || !child.stderr) {
      clearTimeout(timeout);
      reject(new Error(`${label} tunnel started without readable stdio.`));
      return;
    }

    const stdoutRl = readline.createInterface({ input: child.stdout });
    const stderrRl = readline.createInterface({ input: child.stderr });

    stdoutRl.on('line', (line) => {
      process.stdout.write(`${formatLog(label, line)}\n`);
      onLine(line);
    });
    stderrRl.on('line', (line) => {
      process.stderr.write(`${formatLog(label, line)}\n`);
      onLine(line);
    });

    child.once('exit', (code, signal) => {
      if (resolved) {
        return;
      }
      clearTimeout(timeout);
      reject(
        new Error(
          `${label} tunnel exited before publishing a URL (code=${code ?? 'null'} signal=${signal ?? 'null'})`,
        ),
      );
    });
    child.once('error', reject);
  });

  return {
    publicUrl,
    process: {
      label,
      child,
    } satisfies ManagedProcess,
  };
}

function toWebsocketUrl(httpUrl: string) {
  const next = new URL(httpUrl);
  next.protocol = next.protocol === 'https:' ? 'wss:' : 'ws:';
  return next.toString();
}

function printSummary(state: DevState) {
  console.log('\n[dev] Coop dev environment is ready.');
  console.log(`[dev] app:      ${state.app.localUrl}`);
  if (state.app.publicUrl) {
    console.log(`[dev] app(public): ${state.app.publicUrl}`);
  }
  console.log(`[dev] api:      ${state.api.localUrl}`);
  if (state.api.websocketUrl) {
    console.log(`[dev] signal:   ${state.api.websocketUrl}`);
  }
  if (state.docs.status !== 'disabled') {
    console.log(`[dev] docs:     ${state.docs.localUrl}`);
  }
  console.log(`[dev] access:   ${state.accessToken ?? 'disabled'}`);
  console.log(`[dev] state:    ${path.relative(repoRoot, DEV_STATE_PATH)}`);
  console.log(`[dev] extension dist: ${state.extension.distPath}`);
}

async function main() {
  const tunnelMode = parseTunnelMode(process.env.COOP_DEV_TUNNEL);
  const docsEnabled = process.env.COOP_DEV_DOCS !== 'off';
  const appPort = parsePort(process.env.COOP_DEV_APP_PORT, DEFAULT_APP_PORT, 'COOP_DEV_APP_PORT');
  const apiPort = parsePort(process.env.COOP_DEV_API_PORT, DEFAULT_API_PORT, 'COOP_DEV_API_PORT');
  const docsPort = parsePort(
    process.env.COOP_DEV_DOCS_PORT,
    DEFAULT_DOCS_PORT,
    'COOP_DEV_DOCS_PORT',
  );
  const appLocalUrl = `http://${LOCAL_HOST}:${appPort}`;
  const apiLocalUrl = `http://${LOCAL_HOST}:${apiPort}`;
  const docsLocalUrl = `http://${LOCAL_HOST}:${docsPort}`;

  const state: DevState = {
    version: 1,
    updatedAt: new Date().toISOString(),
    app: {
      localUrl: appLocalUrl,
      status: 'starting',
    },
    api: {
      localUrl: apiLocalUrl,
      websocketUrl: `ws://${LOCAL_HOST}:${apiPort}`,
      status: 'starting',
    },
    docs: docsEnabled
      ? {
          localUrl: docsLocalUrl,
          status: 'starting',
        }
      : {
          localUrl: docsLocalUrl,
          status: 'disabled',
          reason: 'Disabled with COOP_DEV_DOCS=off.',
        },
    extension: {
      distPath: EXTENSION_OUTPUT_DIR,
      mode: 'watch',
      receiverAppUrl: appLocalUrl,
      signalingUrls: [`ws://${LOCAL_HOST}:${apiPort}`, 'wss://api.coop.town'],
      websocketSyncUrl: `ws://${LOCAL_HOST}:${apiPort}/yws`,
      status: 'starting',
    },
    tunnel: {
      enabled: tunnelMode !== 'off',
      status: tunnelMode === 'off' ? 'disabled' : 'starting',
    },
  };

  writeDevState(state);

  await assertPortAvailable(LOCAL_HOST, appPort, 'App');
  await assertPortAvailable(LOCAL_HOST, apiPort, 'API');
  if (docsEnabled) {
    await assertPortAvailable(LOCAL_HOST, docsPort, 'Docs');
  }

  const managed: ManagedProcess[] = [];
  let shuttingDown = false;
  const heartbeat = {
    current: undefined as NodeJS.Timeout | undefined,
  };

  const shutdown = (exitCode = 0) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    if (heartbeat.current) {
      clearInterval(heartbeat.current);
    }

    try {
      fs.rmSync(DEV_STATE_PATH, { force: true });
    } catch {
      // ignore cleanup errors
    }

    for (const entry of managed) {
      if (entry.child.exitCode === null && !entry.child.killed) {
        entry.child.kill('SIGTERM');
      }
    }

    setTimeout(() => {
      for (const entry of managed) {
        if (entry.child.exitCode === null && !entry.child.killed) {
          entry.child.kill('SIGKILL');
        }
      }
      process.exit(exitCode);
    }, 750).unref();
  };

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));

  const trackManagedProcess = (entry: ManagedProcess) => {
    managed.push(entry);
    entry.child.on('exit', (code, signal) => {
      if (shuttingDown || entry.allowExit) {
        return;
      }
      const descriptor = `${entry.label} exited (code=${code ?? 'null'} signal=${signal ?? 'null'})`;
      console.error(`[dev] ${descriptor}`);
      shutdown(code === 0 ? 1 : (code ?? 1));
    });
    entry.child.on('error', (error) => {
      console.error(`[dev] Failed to start ${entry.label}: ${error.message}`);
      shutdown(1);
    });
  };

  const appProcess = spawnManagedProcess('app', [
    'bun',
    'run',
    '--filter',
    '@coop/app',
    'dev',
    '--host',
    LOCAL_HOST,
    '--port',
    String(appPort),
    '--strictPort',
  ]);
  trackManagedProcess(appProcess);

  const apiProcess = spawnManagedProcess('api', ['bun', 'run', '--filter', '@coop/api', 'dev'], {
    env: {
      ...process.env,
      HOST: LOCAL_HOST,
      PORT: String(apiPort),
    },
  });
  trackManagedProcess(apiProcess);

  if (docsEnabled) {
    const docsProcess = spawnManagedProcess('docs', ['bun', 'run', 'docs:dev']);
    trackManagedProcess(docsProcess);
  }

  await waitForPort(LOCAL_HOST, appPort, 120_000);
  await waitForHttpReady(appLocalUrl, 120_000);
  state.app.status = 'ready';
  writeDevState(state);

  await waitForPort(LOCAL_HOST, apiPort, 120_000);
  await waitForHttpReady(apiLocalUrl, 120_000);
  state.api.status = 'ready';
  writeDevState(state);

  if (docsEnabled) {
    await waitForPort(LOCAL_HOST, docsPort, 120_000);
    await waitForHttpReady(docsLocalUrl, 120_000);
    state.docs.status = 'ready';
    writeDevState(state);
  }

  const cloudflaredInstalled = await commandExists('cloudflared');
  const shouldUseTunnel = tunnelMode !== 'off';
  const namedTunnelName = process.env.COOP_TUNNEL_NAME;
  const apiTunnelHostname = process.env.COOP_TUNNEL_API_HOSTNAME;
  const appTunnelHostname = process.env.COOP_TUNNEL_APP_HOSTNAME;
  const useNamedTunnel = !!(namedTunnelName && apiTunnelHostname);

  if (shouldUseTunnel && !cloudflaredInstalled) {
    const reason = 'cloudflared is not installed; continuing with local-only receiver URLs.';
    if (tunnelMode === 'required') {
      throw new Error(reason);
    }
    state.tunnel = {
      enabled: false,
      provider: 'cloudflare',
      status: 'disabled',
      reason,
    };
  }

  if (shouldUseTunnel && cloudflaredInstalled && useNamedTunnel) {
    // Named tunnel mode: uses pre-configured `cloudflared tunnel` with custom domain
    state.tunnel = {
      enabled: true,
      provider: 'cloudflare',
      status: 'starting',
    };
    state.accessToken = generateAccessToken();
    writeDevState(state);

    try {
      const tunnelProcess = spawnManagedProcess('tunnel', [
        'cloudflared',
        'tunnel',
        'run',
        namedTunnelName,
      ]);
      trackManagedProcess(tunnelProcess);

      // Named tunnel is ready once the process spawns — URLs are known from config
      state.api.publicUrl = `https://${apiTunnelHostname}`;
      state.api.websocketUrl = `wss://${apiTunnelHostname}`;

      if (appTunnelHostname) {
        state.app.publicUrl = `https://${appTunnelHostname}`;
        state.app.qrUrl = `https://${appTunnelHostname}/?coop-dev-token=${encodeURIComponent(
          state.accessToken,
        )}`;
        state.extension.receiverAppUrl = state.app.publicUrl;
      }

      // Dev tunnel first, production fallback
      state.extension.signalingUrls = [state.api.websocketUrl, 'wss://api.coop.town'];
      state.extension.websocketSyncUrl = `${state.api.websocketUrl}/yws`;
      state.tunnel.status = 'ready';
      writeDevState(state);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (tunnelMode === 'required') {
        throw error;
      }
      state.tunnel = {
        enabled: false,
        provider: 'cloudflare',
        status: 'error',
        reason,
      };
      state.accessToken = undefined;
      writeDevState(state);
    }
  } else if (shouldUseTunnel && cloudflaredInstalled) {
    // Quick tunnel mode: ad-hoc *.trycloudflare.com URLs
    state.tunnel = {
      enabled: true,
      provider: 'cloudflare',
      status: 'starting',
    };
    state.accessToken = generateAccessToken();
    writeDevState(state);

    try {
      const [appTunnel, apiTunnel] = await Promise.all([
        startCloudflareTunnel('tunnel:app', appLocalUrl),
        startCloudflareTunnel('tunnel:api', apiLocalUrl),
      ]);

      trackManagedProcess(appTunnel.process);
      trackManagedProcess(apiTunnel.process);

      state.app.publicUrl = appTunnel.publicUrl;
      state.api.publicUrl = apiTunnel.publicUrl;
      state.api.websocketUrl = toWebsocketUrl(apiTunnel.publicUrl);
      state.app.qrUrl = `${appTunnel.publicUrl.replace(/\/$/, '')}/?coop-dev-token=${encodeURIComponent(
        state.accessToken,
      )}`;
      state.tunnel.status = 'ready';
      state.extension.receiverAppUrl = state.app.publicUrl;
      // Quick tunnel first, production fallback
      state.extension.signalingUrls = [state.api.websocketUrl, 'wss://api.coop.town'];
      state.extension.websocketSyncUrl = `${state.api.websocketUrl}/yws`;
      writeDevState(state);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (tunnelMode === 'required') {
        throw error;
      }
      state.tunnel = {
        enabled: false,
        provider: 'cloudflare',
        status: 'error',
        reason,
      };
      state.accessToken = undefined;
      writeDevState(state);
    }
  }

  const extensionReady = createWaiter(
    'the extension watcher to finish its initial WXT build',
    240_000,
  );

  const extensionProcess = spawnManagedProcess('extension', ['bun', 'run', 'dev:extension'], {
    env: {
      ...process.env,
      VITE_COOP_RECEIVER_APP_URL: state.extension.receiverAppUrl,
      VITE_COOP_SIGNALING_URLS: state.extension.signalingUrls.join(','),
      VITE_COOP_WEBSOCKET_SYNC_URL: state.extension.websocketSyncUrl ?? '',
    },
    onLine: (line) => {
      if (/✔ Built extension in/.test(line)) {
        extensionReady.resolve();
        return;
      }

      if (/✖ Command failed/.test(line) || /error:\s+script "dev"/i.test(line)) {
        extensionReady.reject(new Error(`Extension dev failed before readiness: ${line}`));
      }
    },
  });
  trackManagedProcess(extensionProcess);
  extensionProcess.child.once('exit', (code, signal) => {
    extensionReady.reject(
      new Error(
        `Extension dev exited before readiness (code=${code ?? 'null'} signal=${signal ?? 'null'}).`,
      ),
    );
  });
  await extensionReady.promise;
  state.extension.status = 'ready';
  writeDevState(state);

  heartbeat.current = setInterval(() => {
    writeDevState(state);
  }, 15_000);

  printSummary(state);
}

main().catch((error) => {
  console.error(`[dev] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
