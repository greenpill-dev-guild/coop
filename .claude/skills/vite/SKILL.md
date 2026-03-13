---
name: vite
user-invocable: false
description: Vite build tool - plugin configuration, environment variable handling, build optimization, HMR, and dev server setup. Use when configuring Vite, adding plugins, debugging build issues, or optimizing bundle output.
version: "1.0.0"
status: active
packages: ["app", "extension"]
dependencies: []
last_updated: "2026-03-12"
last_verified: "2026-03-12"
---

# Vite Skill

Modern build tool for frontend development with instant server start and lightning-fast HMR.

---

## Activation

When invoked:
- Inspect existing config before proposing changes.
- Keep root `.env` only (no package-level env files).
- Preserve React Compiler and extension build setup unless the request is explicit.

## Part 1: Coop Defaults

- App config: `packages/app/vite.config.ts`
- Extension config: `packages/extension/vite.config.ts`
- Shared defaults: root `.env`

Prefer editing existing config files over introducing new patterns.

## Why Vite for Coop

- **Native ESM**: Instant dev server start (no bundling)
- **Fast HMR**: Sub-50ms hot module replacement
- **Optimized build**: Rollup-based production builds
- **TypeScript native**: First-class support, no config
- **React 19 ready**: Full support for latest React

---

## Configuration (Generic Example)

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": "/src",
    },
  },

  build: {
    target: "esnext",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
        },
      },
    },
  },

  server: {
    port: 3001,
    strictPort: true,
  },
});
```

---

## Environment Variables

### Usage

```typescript
// Access in code (must be prefixed with VITE_)
const chain = import.meta.env.VITE_COOP_CHAIN;
const onchainMode = import.meta.env.VITE_COOP_ONCHAIN_MODE;

// Built-in variables
import.meta.env.MODE      // "development" | "production"
import.meta.env.DEV       // true in dev
import.meta.env.PROD      // true in prod
```

> **Coop Note:** This project uses a **single root `.env`** file. Avoid creating mode-specific or package-specific env files.

---

## Build Optimization

### Code Splitting

```typescript
// Dynamic imports create chunks
const CoopDetails = lazy(() => import("./CoopDetails"));

// Manual chunks
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        "vendor-react": ["react", "react-dom"],
        "vendor-web3": ["viem", "permissionless"],
      },
    },
  },
},
```

### Bundle Analysis

```bash
npx vite-bundle-visualizer
```

---

## Multi-Package Setup

```typescript
// packages/app/vite.config.ts
export default defineConfig({
  resolve: {
    alias: {
      "@coop/shared": path.resolve(__dirname, "../shared/src"),
    },
  },
  optimizeDeps: {
    include: ["@coop/shared"],
  },
});
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Slow initial load | Check `optimizeDeps.include` for missing deps |
| HMR not working | Ensure component has named export |
| Import errors | Check `resolve.alias` configuration |
| Build fails | Run `vite build --debug` for details |
| ENV not available | Ensure `VITE_` prefix on variables |

## Anti-Patterns

- Adding package-level `.env` files instead of using root `.env`
- Replacing existing React/extension config without explicit migration intent
- Using unprefixed env vars in frontend code (`VITE_` required)
- Introducing overlapping aliases that shadow shared package imports
- Optimizing bundle output without profiling evidence

## Related Skills

- `performance` -- Bundle analysis and optimization that Vite enables
- `react` -- React project configuration and HMR patterns
- `data-layer` -- Data-layer and caching strategies
