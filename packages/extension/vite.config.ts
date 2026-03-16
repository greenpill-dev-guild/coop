import fs from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

function resolveReceiverBridgeMatches(rawReceiverAppUrl?: string) {
  const defaults = ['http://127.0.0.1/*', 'http://localhost/*'];
  if (!rawReceiverAppUrl) {
    return defaults;
  }

  try {
    const url = new URL(rawReceiverAppUrl);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return [...new Set([...defaults, `${url.origin}/*`])];
    }
  } catch {
    return defaults;
  }

  return defaults;
}

function receiverManifestPlugin(rawReceiverAppUrl?: string) {
  let outDir = '';

  return {
    name: 'coop-receiver-manifest',
    configResolved(config: { build: { outDir: string }; root: string }) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    writeBundle() {
      if (!outDir) {
        return;
      }

      const manifestPath = path.join(outDir, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        return;
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        content_scripts?: Array<Record<string, unknown>>;
      };
      const matches = resolveReceiverBridgeMatches(rawReceiverAppUrl);

      manifest.content_scripts = (manifest.content_scripts ?? []).map((entry) => {
        const scripts = Array.isArray(entry.js) ? entry.js : [];
        if (!scripts.includes('receiver-bridge.js')) {
          return entry;
        }

        return {
          ...entry,
          matches,
        };
      });

      fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    },
  };
}

/**
 * Replaces Vite's modulepreload polyfill with a service-worker-safe no-op.
 * The default polyfill uses document/window APIs that crash MV3 service workers.
 */
function swSafePreloadPlugin() {
  return {
    name: 'sw-safe-preload',
    renderChunk(code: string, chunk: { fileName: string }) {
      if (chunk.fileName.includes('preload-helper')) {
        return 'export const _ = (fn) => fn();';
      }
    },
  };
}

/**
 * Replaces permissionless's top-level dynamic `import("ox")` with a static import.
 *
 * permissionless@0.3.x treats `ox` as an optional peer dep and probes for it
 * via a bare top-level `import("ox")` wrapped in try/catch. This crashes in
 * Chrome MV3 service workers where `import()` is unconditionally forbidden.
 * Since `ox` IS installed in this project (bundled statically), we can safely
 * replace the dynamic probe with a static import.
 */
function swSafePermissionlessOxPlugin() {
  return {
    name: 'sw-safe-permissionless-ox',
    transform(code: string, id: string) {
      if (!id.includes('permissionless') || !id.endsWith('utils/ox.js')) return;
      return {
        code: `
import * as ox from "ox";
export async function getOxModule() { return ox; }
export function hasOxModule() { return true; }
export async function getOxExports() {
  return {
    Base64: ox.Base64,
    Hex: ox.Hex,
    PublicKey: ox.PublicKey,
    Signature: ox.Signature,
    WebAuthnP256: ox.WebAuthnP256,
  };
}
`,
        map: null,
      };
    },
  };
}

export default defineConfig(({ mode }) => {
  const envDir = path.resolve(__dirname, '../..');
  const env = loadEnv(mode, envDir, '');

  return {
    plugins: [
      react(),
      receiverManifestPlugin(env.VITE_COOP_RECEIVER_APP_URL),
      swSafePreloadPlugin(),
      swSafePermissionlessOxPlugin(),
    ],
    envDir,
    publicDir: 'public',
    resolve: {
      alias: {
        '@coop/shared': path.resolve(__dirname, '../shared/src/index.ts'),
        '@coop/api': path.resolve(__dirname, '../api/config.ts'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: 'hidden',
      target: 'es2022',
      rollupOptions: {
        input: {
          sidepanel: path.resolve(__dirname, 'sidepanel.html'),
          popup: path.resolve(__dirname, 'popup.html'),
          offscreen: path.resolve(__dirname, 'offscreen.html'),
          background: path.resolve(__dirname, 'src/background.ts'),
          'inference-worker': path.resolve(__dirname, 'src/runtime/inference-worker.ts'),
          'agent-webllm-worker': path.resolve(__dirname, 'src/runtime/agent-webllm-worker.ts'),
        },
        treeshake: {
          moduleSideEffects(id) {
            // Mark shared source and Semaphore-related packages as side-effect-free
            // so Rollup can drop unused proof/WASM code from the background SW.
            if (id.includes('/packages/shared/src/')) return false;
            if (id.includes('@semaphore-protocol')) return false;
            if (id.includes('snarkjs')) return false;
            if (id.includes('ffjavascript')) return false;
            if (id.includes('@zk-kit')) return false;
            return true;
          },
        },
        output: {
          entryFileNames: (chunkInfo) => {
            if (chunkInfo.name === 'background') return 'background.js';
            if (chunkInfo.name === 'inference-worker') return 'inference-worker.js';
            if (chunkInfo.name === 'agent-webllm-worker') return 'agent-webllm-worker.js';
            return 'assets/[name].js';
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
          manualChunks(id) {
            if (id.includes('@huggingface/transformers')) {
              return 'transformers';
            }
            if (id.includes('@mlc-ai/web-llm')) {
              return 'webllm';
            }
          },
        },
      },
    },
  };
});
