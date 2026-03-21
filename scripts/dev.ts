#!/usr/bin/env bun

import { type ChildProcess, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import readline from 'node:readline';
import { loadRootEnv, repoRoot } from './load-root-env';

loadRootEnv();

const LOCAL_HOST = '127.0.0.1';
const APP_PORT = 3001;
const API_PORT = 4444;
const DOCS_PORT = 3003;
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

function formatLog(label: string, line: string) {
  return `[${label}] ${line}`;
}

function pipeOutput(
  label: string,
  stream: NodeJS.ReadableStream | null,
  writer: NodeJS.WriteStream,
) {
  if (!stream) {
    return;
  }

  const rl = readline.createInterface({ input: stream });
  rl.on('line', (line) => {
    writer.write(`${formatLog(label, line)}\n`);
  });
}

function spawnManagedProcess(
  label: string,
  command: string[],
  options: {
    env?: NodeJS.ProcessEnv;
    allowExit?: boolean;
  } = {},
): ManagedProcess {
  const child = spawn(command[0], command.slice(1), {
    cwd: repoRoot,
    env: options.env ?? process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  pipeOutput(label, child.stdout, process.stdout);
  pipeOutput(label, child.stderr, process.stderr);

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
  const appLocalUrl = `http://${LOCAL_HOST}:${APP_PORT}`;
  const apiLocalUrl = `http://${LOCAL_HOST}:${API_PORT}`;
  const docsLocalUrl = `http://${LOCAL_HOST}:${DOCS_PORT}`;

  const state: DevState = {
    version: 1,
    updatedAt: new Date().toISOString(),
    app: {
      localUrl: appLocalUrl,
      status: 'starting',
    },
    api: {
      localUrl: apiLocalUrl,
      websocketUrl: `ws://${LOCAL_HOST}:${API_PORT}`,
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
      distPath: path.join(repoRoot, 'packages/extension/dist'),
      mode: 'watch',
      receiverAppUrl: appLocalUrl,
      signalingUrls: [`ws://${LOCAL_HOST}:${API_PORT}`],
      status: 'starting',
    },
    tunnel: {
      enabled: tunnelMode !== 'off',
      status: tunnelMode === 'off' ? 'disabled' : 'starting',
    },
  };

  writeDevState(state);

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
    String(APP_PORT),
    '--strictPort',
  ]);
  trackManagedProcess(appProcess);

  const apiProcess = spawnManagedProcess('api', ['bun', 'run', '--filter', '@coop/api', 'dev'], {
    env: {
      ...process.env,
      HOST: LOCAL_HOST,
      PORT: String(API_PORT),
    },
  });
  trackManagedProcess(apiProcess);

  if (docsEnabled) {
    const docsProcess = spawnManagedProcess('docs', ['bun', 'run', 'docs:dev']);
    trackManagedProcess(docsProcess);
  }

  await waitForPort(LOCAL_HOST, APP_PORT, 120_000);
  state.app.status = 'ready';
  writeDevState(state);

  await waitForPort(LOCAL_HOST, API_PORT, 120_000);
  state.api.status = 'ready';
  writeDevState(state);

  if (docsEnabled) {
    await waitForPort(LOCAL_HOST, DOCS_PORT, 120_000);
    state.docs.status = 'ready';
    writeDevState(state);
  }

  const cloudflaredInstalled = await commandExists('cloudflared');
  const shouldUseTunnel = tunnelMode !== 'off';

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

  if (shouldUseTunnel && cloudflaredInstalled) {
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
      state.extension.signalingUrls = [state.api.websocketUrl];
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

  const extensionProcess = spawnManagedProcess(
    'extension',
    ['bun', 'run', '--filter', '@coop/extension', 'dev'],
    {
      env: {
        ...process.env,
        VITE_COOP_RECEIVER_APP_URL: state.extension.receiverAppUrl,
        VITE_COOP_SIGNALING_URLS: state.extension.signalingUrls.join(','),
      },
    },
  );
  trackManagedProcess(extensionProcess);

  extensionProcess.child.on('spawn', () => {
    state.extension.status = 'ready';
    writeDevState(state);
  });

  heartbeat.current = setInterval(() => {
    writeDevState(state);
  }, 15_000);

  printSummary(state);
}

main().catch((error) => {
  console.error(`[dev] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
