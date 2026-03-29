#!/usr/bin/env bun

import { spawn } from 'node:child_process';
import { repoRoot, resolveRootEnv } from './load-root-env';

function printUsage() {
  console.error(
    'Usage: bun run ./scripts/run-with-env-profile.ts <profile> -- <command> [args...]',
  );
}

const args = process.argv.slice(2);
const separatorIndex = args.indexOf('--');
const profile = args[0];

if (!profile || separatorIndex < 0) {
  printUsage();
  process.exit(1);
}

const command = args.slice(separatorIndex + 1);
if (command.length === 0) {
  printUsage();
  process.exit(1);
}

const resolvedEnv = resolveRootEnv(profile);
const bunOptions = process.env.BUN_OPTIONS?.trim();
const child = spawn(command[0]!, command.slice(1), {
  cwd: repoRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    ...resolvedEnv,
    BUN_OPTIONS: bunOptions ? `${bunOptions} --no-env-file` : '--no-env-file',
    COOP_ENV_PROFILE: profile,
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
