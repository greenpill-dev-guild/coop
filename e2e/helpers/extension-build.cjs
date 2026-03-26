const { execSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..', '..');
const extensionDir = path.join(rootDir, 'packages/extension/.output/chrome-mv3');
const buildCacheDir = path.join(
  os.tmpdir(),
  'coop-e2e-extension-build',
  crypto.createHash('sha1').update(rootDir).digest('hex'),
);
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
    `http://127.0.0.1:${env.COOP_PLAYWRIGHT_APP_PORT || env.COOP_DEV_APP_PORT || '3001'}`
  );
}

function resolveSignalingUrl(env) {
  return (
    env.COOP_PLAYWRIGHT_SIGNALING_URL ||
    `ws://127.0.0.1:${env.COOP_PLAYWRIGHT_API_PORT || env.COOP_DEV_API_PORT || '4444'}`
  );
}

function buildEnvForVisuals(env) {
  return {
    ...env,
    VITE_COOP_ONCHAIN_MODE: 'mock',
    VITE_COOP_ARCHIVE_MODE: 'mock',
    VITE_COOP_RECEIVER_APP_URL: resolveAppBaseUrl(env),
    VITE_COOP_SIGNALING_URLS: resolveSignalingUrl(env),
  };
}

function buildSignature(env) {
  return JSON.stringify({
    archiveMode: env.VITE_COOP_ARCHIVE_MODE,
    onchainMode: env.VITE_COOP_ONCHAIN_MODE,
    receiverAppUrl: env.VITE_COOP_RECEIVER_APP_URL,
    signalingUrls: env.VITE_COOP_SIGNALING_URLS,
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

function hasMatchingBuild(signature, minBuiltAtMs) {
  const manifestPath = path.join(extensionDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return false;
  }

  const stamp = readBuildStamp();
  if (stamp?.signature !== signature) {
    return false;
  }

  return fs.statSync(manifestPath).mtimeMs >= minBuiltAtMs;
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
