const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..', '..');
const extensionDir = path.join(rootDir, 'packages/extension/dist');

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

  execSync(
    'VITE_COOP_ONCHAIN_MODE=mock VITE_COOP_ARCHIVE_MODE=mock VITE_COOP_SIGNALING_URLS=ws://127.0.0.1:4444 bun run --filter @coop/extension build',
    {
      cwd: rootDir,
      stdio: 'inherit',
      env,
    },
  );
}

module.exports = {
  ensureExtensionBuilt,
  extensionDir,
  rootDir,
};
