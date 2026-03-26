import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'wxt';
import { loadRootEnv } from '../../scripts/load-root-env';
import { resolveReceiverBridgeMatches } from './src/build/receiver-matches';

loadRootEnv();

const extensionRoot = path.dirname(fileURLToPath(import.meta.url));
const receiverBridgeMatches = resolveReceiverBridgeMatches(process.env.VITE_COOP_RECEIVER_APP_URL);
const localDevStartUrl = `http://127.0.0.1:${process.env.COOP_DEV_APP_PORT ?? '3001'}`;
const extensionDevServerPort = Number(process.env.COOP_DEV_EXTENSION_PORT ?? '3020');

/**
 * Replaces Vite's modulepreload polyfill with a service-worker-safe no-op.
 * The default polyfill uses document/window APIs that crash MV3 service workers.
 */
function swSafePreloadPlugin() {
  const preloadHelperPattern =
    /const\s+\w+\s*=\s*"modulepreload",\s*\w+\s*=\s*function\([^)]*\)\{return"\/"\+\w+\},\s*\w+\s*=\s*\{\},\s*(\w+)\s*=\s*function\((\w+),\w+,\w+\)\{[\s\S]*?return\s+\w+\.then\(\w+=>\{[\s\S]*?return\s+\2\(\)\.catch\(\w+\)\}\)\};/g;
  const replacePreloadHelpers = (code: string) =>
    code.replace(
      preloadHelperPattern,
      (_match, helperName: string, importerName: string) =>
        `const ${helperName}=(${importerName})=>${importerName}();`,
    );

  return {
    name: 'sw-safe-preload',
    renderChunk(code: string, chunk: { fileName: string }) {
      if (chunk.fileName.includes('preload-helper')) {
        return 'export const _ = (fn) => fn();';
      }
    },
    generateBundle(_options: unknown, bundle: Record<string, { type: string; code?: string }>) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk' || typeof chunk.code !== 'string') {
          continue;
        }

        if (chunk.code.includes('document.getElementsByTagName("link")')) {
          chunk.code = replacePreloadHelpers(chunk.code);
        }
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

/**
 * Replaces protobufjs's browser-incompatible optional require shim with a
 * no-op. The original helper uses eval("require"), which is an unnecessary
 * Chrome Web Store risk in the extension bundle.
 */
function swSafeProtobufInquirePlugin() {
  return {
    name: 'sw-safe-protobuf-inquire',
    transform(code: string, id: string) {
      if (!id.includes('@protobufjs/inquire') || !id.endsWith('index.js')) {
        return;
      }

      return {
        code: `
export default inquire;
export { inquire };

function inquire() {
  return null;
}
`,
        map: null,
      };
    },
  };
}

function applySharedChunking(viteConfig: { build?: { rollupOptions?: { output?: unknown } } }) {
  const output = viteConfig.build?.rollupOptions?.output;
  if (!output || Array.isArray(output)) {
    return;
  }

  output.manualChunks = (id: string) => {
    if (id.includes('@huggingface/transformers')) {
      return 'transformers';
    }
    if (id.includes('@mlc-ai/web-llm')) {
      return 'webllm';
    }
  };
}

export default defineConfig({
  root: extensionRoot,
  browser: 'chrome',
  targetBrowsers: ['chrome'],
  manifestVersion: 3,
  outDir: '.output',
  outDirTemplate: '{{browser}}-mv{{manifestVersion}}',
  alias: {
    '@coop/shared': path.resolve(extensionRoot, '../shared/src/index.ts'),
    '@coop/api': path.resolve(extensionRoot, '../api/config.ts'),
  },
  modules: ['@wxt-dev/module-react'],
  dev: {
    server: {
      host: '127.0.0.1',
      origin: `http://127.0.0.1:${extensionDevServerPort}`,
      port: extensionDevServerPort,
    },
  },
  webExt: {
    disabled: false,
    chromiumProfile: path.resolve(extensionRoot, '.wxt/chrome-data'),
    keepProfileChanges: true,
    startUrls: [localDevStartUrl],
  },
  hooks: {
    'vite:build:extendConfig': (entrypoints, viteConfig) => {
      const shouldUseSharedChunks = entrypoints.some(
        (entrypoint) =>
          entrypoint.type === 'background' ||
          entrypoint.type === 'popup' ||
          entrypoint.type === 'sidepanel' ||
          entrypoint.type === 'unlisted-page',
      );

      if (shouldUseSharedChunks) {
        applySharedChunking(viteConfig);
      }
    },
  },
  manifest: {
    name: 'Coop v1',
    version: '0.1.0',
    description: 'Browser-first shared intelligence for coordinated communities.',
    permissions: [
      'storage',
      'alarms',
      'tabs',
      'scripting',
      'sidePanel',
      'activeTab',
      'offscreen',
      'contextMenus',
      'notifications',
    ],
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    host_permissions: receiverBridgeMatches,
    action: {
      default_title: 'Coop',
    },
    commands: {
      'open-sidepanel': {
        suggested_key: {
          default: 'Alt+Shift+Y',
          mac: 'Command+Shift+Y',
        },
        description: 'Open the Coop sidepanel',
      },
      'round-up-tab': {
        suggested_key: {
          default: 'Alt+Shift+U',
          mac: 'Command+Shift+U',
        },
        description: 'Round up the active tab into Coop',
      },
      'capture-screenshot': {
        suggested_key: {
          default: 'Alt+Shift+S',
          mac: 'Command+Shift+S',
        },
        description: 'Capture the visible tab as a private Coop screenshot',
      },
    },
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
    icons: {
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
  },
  vite: ({ command }) => ({
    plugins: [
      swSafePreloadPlugin(),
      swSafePermissionlessOxPlugin(),
      swSafeProtobufInquirePlugin(),
      ...(process.env.ANALYZE === 'true'
        ? [
            visualizer({
              filename: path.resolve(extensionRoot, '../../stats-extension.html'),
              template: 'treemap',
              gzipSize: true,
              open: false,
            }),
          ]
        : []),
    ],
    build: {
      target: 'es2022',
      sourcemap: command === 'build' ? 'hidden' : undefined,
      rollupOptions: {
        treeshake: {
          moduleSideEffects(id) {
            if (id.includes('/packages/shared/src/')) return false;
            if (id.includes('@semaphore-protocol')) return false;
            if (id.includes('snarkjs')) return false;
            if (id.includes('ffjavascript')) return false;
            if (id.includes('@zk-kit')) return false;
            return true;
          },
        },
        output: {
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            if (assetInfo.name === 'ort-wasm-simd-threaded.jsep.wasm') {
              return 'assets/ort-wasm-simd-threaded.jsep.wasm';
            }
            return 'assets/[name]-[hash][extname]';
          },
        },
      },
    },
  }),
});
