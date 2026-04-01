#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { loadRootEnv, repoRoot } from './load-root-env';

loadRootEnv();

const DEFAULT_APP_PORT = 3001;
const DEFAULT_API_PORT = 4444;
const DEFAULT_DOCS_PORT = 3003;
const DEFAULT_EXTENSION_PORT = 3020;
const DEV_STATE_PATH = path.join(repoRoot, 'packages/app/public/__coop_dev__/state.json');

function parsePort(raw: string | undefined, fallback: number) {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 && value <= 65_535 ? value : fallback;
}

function readDevState() {
  if (!fs.existsSync(DEV_STATE_PATH)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(DEV_STATE_PATH, 'utf8')) as {
      processes?: {
        coordinatorPid?: number;
        managed?: Array<{ label?: string; pid?: number }>;
      };
    };
  } catch {
    return null;
  }
}

function listListeningPids(port: number) {
  const result = spawnSync('lsof', [`-tiTCP:${String(port)}`, '-sTCP:LISTEN'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  if (result.status !== 0 || !result.stdout.trim()) {
    return [] as number[];
  }

  return result.stdout
    .trim()
    .split(/\s+/u)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function pidExists(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killPids(pids: number[], signal: NodeJS.Signals) {
  const killed: number[] = [];
  for (const pid of new Set(pids)) {
    if (!Number.isInteger(pid) || pid <= 0) {
      continue;
    }

    try {
      process.kill(pid, signal);
      killed.push(pid);
    } catch {
      // ignore already-dead or inaccessible processes
    }
  }
  return killed;
}

function listPatternPids(pattern: string) {
  const result = spawnSync('pgrep', ['-f', pattern], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  if (result.status !== 0 || !result.stdout.trim()) {
    return [] as number[];
  }

  return result.stdout
    .trim()
    .split(/\s+/u)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
}

async function main() {
  const appPort = parsePort(process.env.COOP_DEV_APP_PORT, DEFAULT_APP_PORT);
  const apiPort = parsePort(process.env.COOP_DEV_API_PORT, DEFAULT_API_PORT);
  const docsPort = parsePort(process.env.COOP_DEV_DOCS_PORT, DEFAULT_DOCS_PORT);
  const extensionPort = parsePort(process.env.COOP_DEV_EXTENSION_PORT, DEFAULT_EXTENSION_PORT);
  const state = readDevState();

  const trackedPids = [
    state?.processes?.coordinatorPid,
    ...(state?.processes?.managed ?? []).map((entry) => entry.pid),
  ].filter((value): value is number => Number.isInteger(value));

  const portPids = [
    ...listListeningPids(appPort),
    ...listListeningPids(apiPort),
    ...listListeningPids(docsPort),
    ...listListeningPids(extensionPort),
  ];

  const patternPids = [
    ...listPatternPids(`${repoRoot}/packages/extension/node_modules/.bin/wxt`),
    ...listPatternPids('cloudflared tunnel run coop-api'),
    ...listPatternPids('cloudflared tunnel --url http://127.0.0.1:3001'),
    ...listPatternPids('cloudflared tunnel --url http://127.0.0.1:4444'),
  ];

  const targets = [...new Set([...trackedPids, ...portPids, ...patternPids])];
  if (targets.length === 0) {
    try {
      fs.rmSync(DEV_STATE_PATH, { force: true });
    } catch {
      // ignore cleanup errors
    }
    console.log('[dev:stop] No matching Coop dev processes found.');
    return;
  }

  const terminated = killPids(targets, 'SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 750));

  const remaining = targets.filter((pid) => pidExists(pid));
  const forceKilled = remaining.length > 0 ? killPids(remaining, 'SIGKILL') : [];

  try {
    fs.rmSync(DEV_STATE_PATH, { force: true });
  } catch {
    // ignore cleanup errors
  }

  const summary = {
    sigterm: terminated,
    sigkill: forceKilled,
  };
  console.log(`[dev:stop] Stopped Coop dev processes: ${JSON.stringify(summary)}`);
}

main().catch((error) => {
  console.error(`[dev:stop] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
