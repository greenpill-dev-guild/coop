const { execSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..', '..');
const buildCacheDir = path.join(
  os.tmpdir(),
  'coop-e2e-extension-build',
  crypto.createHash('sha1').update(rootDir).digest('hex'),
);
const builtExtensionDirCandidates = [
  path.join(rootDir, 'packages/extension/dist/chrome-mv3'),
  path.join(rootDir, 'packages/extension/.output/chrome-mv3'),
];
const extensionDir = path.join(buildCacheDir, 'chrome-mv3');
const buildLockDir = path.join(buildCacheDir, 'lock');
const buildStampPath = path.join(buildCacheDir, 'stamp.json');
const buildLockTimeoutMs = 5 * 60 * 1000;
const buildPollIntervalMs = 250;
const extensionBuildInputs = [
  path.join(rootDir, 'packages/extension/src'),
  path.join(rootDir, 'packages/extension/entrypoints'),
  path.join(rootDir, 'packages/extension/public'),
  path.join(rootDir, 'packages/extension/package.json'),
  path.join(rootDir, 'packages/extension/tsconfig.json'),
  path.join(rootDir, 'packages/extension/wxt.config.ts'),
  path.join(rootDir, 'packages/shared/src'),
  path.join(rootDir, 'packages/shared/package.json'),
  path.join(rootDir, 'bun.lock'),
  path.join(rootDir, 'tsconfig.base.json'),
];

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function resolveAppBaseUrl(env) {
  return (
    env.COOP_PLAYWRIGHT_BASE_URL ||
    `http://127.0.0.1:${env.COOP_PLAYWRIGHT_APP_PORT || env.COOP_DEV_APP_PORT || '3101'}`
  );
}

function resolveSignalingUrl(env) {
  return (
    env.COOP_PLAYWRIGHT_SIGNALING_URL ||
    `ws://127.0.0.1:${env.COOP_PLAYWRIGHT_API_PORT || env.COOP_DEV_API_PORT || '3103'}`
  );
}

function buildEnvForVisuals(env) {
  const useRequestedViteModes = env.COOP_E2E_USE_VITE_MODES === '1';
  return {
    ...env,
    VITE_COOP_ONCHAIN_MODE: useRequestedViteModes ? env.VITE_COOP_ONCHAIN_MODE || 'mock' : 'mock',
    VITE_COOP_ARCHIVE_MODE: useRequestedViteModes ? env.VITE_COOP_ARCHIVE_MODE || 'mock' : 'mock',
    VITE_COOP_SESSION_MODE: useRequestedViteModes ? env.VITE_COOP_SESSION_MODE || 'off' : 'off',
    VITE_COOP_RECEIVER_APP_URL: resolveAppBaseUrl(env),
    VITE_COOP_SIGNALING_URLS: resolveSignalingUrl(env),
  };
}

function buildSignature(env) {
  const viteEnv = Object.fromEntries(
    Object.entries(env)
      .filter(([key]) => key.startsWith('VITE_'))
      .sort(([left], [right]) => left.localeCompare(right)),
  );

  return JSON.stringify({
    viteEnv,
  });
}

function readBuildStamp() {
  try {
    return JSON.parse(fs.readFileSync(buildStampPath, 'utf8'));
  } catch {
    return null;
  }
}

function latestMtimeMs(entryPath) {
  if (!fs.existsSync(entryPath)) {
    return 0;
  }

  const stats = fs.statSync(entryPath);
  if (!stats.isDirectory()) {
    return stats.mtimeMs;
  }

  let latest = stats.mtimeMs;
  for (const child of fs.readdirSync(entryPath)) {
    latest = Math.max(latest, latestMtimeMs(path.join(entryPath, child)));
  }
  return latest;
}

function latestInputMtimeMs() {
  return extensionBuildInputs.reduce((latest, entryPath) => {
    return Math.max(latest, latestMtimeMs(entryPath));
  }, 0);
}

function resolveBuiltExtensionDir() {
  return (
    builtExtensionDirCandidates.find((candidate) =>
      fs.existsSync(path.join(candidate, 'manifest.json')),
    ) ?? builtExtensionDirCandidates[0]
  );
}

function latestBuiltOutputMtimeMs() {
  const builtExtensionDir = resolveBuiltExtensionDir();
  return latestMtimeMs(builtExtensionDir);
}

function copyBuildToCache() {
  const builtExtensionDir = resolveBuiltExtensionDir();
  const manifestPath = path.join(builtExtensionDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Expected ${manifestPath} to exist after building the extension.`);
  }

  fs.rmSync(extensionDir, { recursive: true, force: true });
  fs.cpSync(builtExtensionDir, extensionDir, { recursive: true });
}

function hasMatchingBuild(signature, minBuiltAtMs) {
  const manifestPath = path.join(extensionDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return false;
  }

  const stamp = readBuildStamp();
  if (stamp?.signature !== signature) {
    return false;
  }

  const cachedBuildMtimeMs = fs.statSync(manifestPath).mtimeMs;
  return cachedBuildMtimeMs >= minBuiltAtMs && cachedBuildMtimeMs >= latestBuiltOutputMtimeMs();
}

function removeStaleLockIfNeeded() {
  try {
    const stats = fs.statSync(buildLockDir);
    if (Date.now() - stats.mtimeMs > buildLockTimeoutMs) {
      fs.rmSync(buildLockDir, { recursive: true, force: true });
    }
  } catch {
    // Lock does not exist or cannot be inspected; ignore and retry.
  }
}

function acquireBuildLock(signature, minBuiltAtMs) {
  const start = Date.now();

  for (;;) {
    if (hasMatchingBuild(signature, minBuiltAtMs)) {
      return false;
    }

    try {
      fs.mkdirSync(buildLockDir);
      fs.writeFileSync(
        path.join(buildLockDir, 'owner.json'),
        JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }),
      );
      return true;
    } catch (error) {
      if (error?.code !== 'EEXIST') {
        throw error;
      }
    }

    removeStaleLockIfNeeded();

    if (Date.now() - start > buildLockTimeoutMs) {
      throw new Error(`Timed out waiting for extension build lock after ${buildLockTimeoutMs}ms.`);
    }

    sleepMs(buildPollIntervalMs);
  }
}

function ensureExtensionBuilt(env = process.env) {
  if (process.env.COOP_E2E_USE_EXISTING_EXTENSION === '1') {
    const manifestPath = path.join(extensionDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(
        `COOP_E2E_USE_EXISTING_EXTENSION=1 was set, but ${manifestPath} does not exist yet.`,
      );
    }
    return;
  }

  fs.mkdirSync(buildCacheDir, { recursive: true });

  const buildEnv = buildEnvForVisuals(env);
  const signature = buildSignature(buildEnv);
  const minBuiltAtMs = latestInputMtimeMs();

  if (hasMatchingBuild(signature, minBuiltAtMs)) {
    return;
  }

  const ownsLock = acquireBuildLock(signature, minBuiltAtMs);
  if (!ownsLock) {
    return;
  }

  try {
    if (!hasMatchingBuild(signature, minBuiltAtMs)) {
      execSync('bun run build', {
        cwd: path.join(rootDir, 'packages/extension'),
        stdio: 'inherit',
        env: buildEnv,
      });
      copyBuildToCache();
      fs.writeFileSync(
        buildStampPath,
        JSON.stringify({ builtAt: new Date().toISOString(), signature }, null, 2),
      );
    }
  } finally {
    fs.rmSync(buildLockDir, { recursive: true, force: true });
  }
}

module.exports = {
  ensureExtensionBuilt,
  extensionDir,
  rootDir,
};
