#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  resolveExtensionArchivePath,
  resolveExtensionArchivesDir,
  resolveExtensionBuildDir,
} from '../packages/extension/src/build/artifacts';
import { repoRoot } from './load-root-env';

const args = process.argv.slice(2);
const profile = args[0];

if (!profile) {
  console.error('Usage: bun run ./scripts/package-extension.ts <profile> [--filename <name.zip>]');
  process.exit(1);
}

const allowedProfiles = new Set(['public-release', 'operator-live', 'local-live-sepolia']);
if (!allowedProfiles.has(profile)) {
  console.error(
    `Unsupported profile "${profile}". Expected one of: ${Array.from(allowedProfiles).join(', ')}.`,
  );
  process.exit(1);
}

let filename: string | null = null;
for (let index = 1; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--filename') {
    filename = args[index + 1] ?? null;
    if (!filename) {
      console.error('Expected a filename after --filename.');
      process.exit(1);
    }
    index += 1;
    continue;
  }

  console.error(`Unknown argument "${arg}".`);
  process.exit(1);
}

if (filename && (path.basename(filename) !== filename || !filename.endsWith('.zip'))) {
  console.error(
    'Custom archive filenames must be plain .zip filenames without directory segments.',
  );
  process.exit(1);
}

const buildDir = resolveExtensionBuildDir(repoRoot);
const archivesDir = resolveExtensionArchivesDir(repoRoot);
const timestamp = new Date().toISOString().replaceAll(':', '-');
const archivePath = resolveExtensionArchivePath(
  repoRoot,
  filename ?? `coop-extension-${profile}-${timestamp}.zip`,
);

function run(command: string[], cwd = repoRoot) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const zipCheck = spawnSync('sh', ['-lc', 'command -v zip'], {
  cwd: repoRoot,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
});

if (zipCheck.status !== 0) {
  console.error('The `zip` command is required to package the extension archive.');
  process.exit(1);
}

run(['bun', 'run', `build:extension:${profile}`]);

if (!fs.existsSync(path.join(buildDir, 'manifest.json'))) {
  console.error(`Expected extension build output at ${buildDir}, but manifest.json was not found.`);
  process.exit(1);
}

fs.mkdirSync(archivesDir, { recursive: true });
fs.rmSync(archivePath, { force: true });
run(['zip', '-qr', archivePath, '.'], buildDir);

console.log(`[package:extension] Created ${path.relative(repoRoot, archivePath)}`);
