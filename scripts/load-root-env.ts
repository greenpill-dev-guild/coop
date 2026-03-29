import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const envProfilesDir = path.join(repoRoot, 'config', 'env', 'profiles');

function parseEnvFile(contents: string): [string, string][] {
  const entries: [string, string][] = [];

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const normalizedLine = line.startsWith('export ') ? line.slice(7).trim() : line;
    const separatorIndex = normalizedLine.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }

    let value = normalizedLine.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      const commentIndex = value.indexOf(' #');
      if (commentIndex >= 0) {
        value = value.slice(0, commentIndex).trimEnd();
      }
    }

    entries.push([key, value]);
  }

  return entries;
}

function readEnvFile(fullPath: string) {
  if (!fs.existsSync(fullPath)) {
    return [] as [string, string][];
  }

  return parseEnvFile(fs.readFileSync(fullPath, 'utf8'));
}

export function resolveEnvProfilePath(profile: string) {
  if (!/^[a-z0-9-]+$/u.test(profile)) {
    throw new Error(
      `Invalid COOP_ENV_PROFILE "${profile}". Use lowercase letters, numbers, and hyphens only.`,
    );
  }

  return path.join(envProfilesDir, `${profile}.env`);
}

export function resolveRootEnv(profile = process.env.COOP_ENV_PROFILE) {
  const merged = new Map<string, string>();

  for (const relativePath of ['.env', '.env.local']) {
    const fullPath = path.join(repoRoot, relativePath);
    for (const [key, value] of readEnvFile(fullPath)) {
      merged.set(key, value);
    }
  }

  if (profile) {
    const profilePath = resolveEnvProfilePath(profile);
    if (!fs.existsSync(profilePath)) {
      throw new Error(
        `Unknown env profile "${profile}". Expected a file at ${path.relative(repoRoot, profilePath)}.`,
      );
    }

    for (const [key, value] of readEnvFile(profilePath)) {
      merged.set(key, value);
    }
  }

  return Object.fromEntries(merged);
}

export function loadRootEnv(profile = process.env.COOP_ENV_PROFILE): void {
  const inheritedKeys = new Set(Object.keys(process.env));
  const resolvedEnv = resolveRootEnv(profile);
  for (const [key, value] of Object.entries(resolvedEnv)) {
    if (!inheritedKeys.has(key)) {
      process.env[key] = value;
    }
  }

  if (profile && !inheritedKeys.has('COOP_ENV_PROFILE')) {
    process.env.COOP_ENV_PROFILE = profile;
  }
}
