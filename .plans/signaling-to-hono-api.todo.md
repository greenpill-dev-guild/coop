# Signaling → Hono API Migration

**Branch**: `refactor/signaling-hono-api`
**Status**: ACTIVE
**Created**: 2026-03-15
**Last Updated**: 2026-03-15

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Hono + Bun adapter | First-class Bun support, native WebSocket via `Bun.serve()`, fast, lightweight |
| 2 | Keep WebSocket on root path `/` | Backward compat — y-webrtc and receiver relay connect to `wss://signal.coop.town` (root path). No client changes needed |
| 3 | Health check at `GET /health` | Frees `/` for WebSocket; REST routes live under explicit paths |
| 4 | `GET /` non-WS fallback returns `"okay"` | Backward compat with monitoring/probes that hit root via plain HTTP |
| 5 | Bun `idleTimeout` replaces manual heartbeat | Eliminates manual 30s ping interval + pong tracking. Bun handles WS-level ping/pong natively |
| 6 | Keep application-level `ping`→`pong` | y-webrtc clients send JSON `{ type: "ping" }` — must respond with `{ type: "pong" }` |
| 7 | Full TypeScript — strict, no `.mjs` | Every server file is `.ts` with strict mode. Typed message schemas, typed env config, typed WebSocket data |
| 8 | Bun Dockerfile | `oven/bun:1-alpine` replaces `node:20-alpine`. Matches dev runtime |
| 9 | `config.ts` stays at package root | No changes to exports or import paths. `@coop/shared` and `@coop/extension` imports unchanged |
| 10 | Scalable `src/` layout | Separated `app.ts` factory, `routes/`, `ws/`, `middleware/`, `lib/` — adding a feature = new file + one mount line |
| 11 | `app.ts` separated from `index.ts` | App factory is importable without starting `Bun.serve()` — enables direct Hono app testing without subprocess spawning |
| 12 | `TopicRegistry` class | Encapsulates topic state with typed interface. Replaceable (e.g., Redis adapter) without touching handlers |

## Requirements Coverage

| Requirement | Planned Step | Status |
|-------------|--------------|--------|
| Replace Node HTTP with Hono | Step 3 | |
| WebSocket relay identical protocol | Step 4 | |
| y-webrtc clients work unchanged | Step 4, validated Step 9 | |
| Receiver relay works unchanged | Step 4, validated Step 9 | |
| Scalable API route structure | Step 3, 5 | |
| Full TypeScript (strict) | Step 2-5 | |
| Bun runtime | Step 1, 7 | |
| Bun Dockerfile | Step 7 | |
| Tests pass or adapted | Step 8 | |
| Config exports unchanged | Step 6 | |
| Fly.io deployment works | Step 7 | |

## CLAUDE.md Compliance

- [x] Module boundary respected — signaling is its own package
- [x] Barrel imports — config.ts exports unchanged
- [x] Single root .env only
- [x] No deep path imports introduced

## Target Folder Structure

```
packages/signaling/
  src/
    index.ts                # Entry point — Bun.serve(), graceful shutdown
    app.ts                  # Hono app factory — importable without starting server
    routes/
      index.ts              # Route barrel — mounts all route groups
      health.ts             # GET /health
    ws/
      index.ts              # WebSocket upgrade route (Hono upgradeWebSocket)
      handler.ts            # onMessage / onClose / onOpen handlers
      topics.ts             # TopicRegistry class — in-memory pub/sub state
      types.ts              # SignalingMessage, WSData, MessageType interfaces
    middleware/
      index.ts              # Middleware barrel — apply all to app
      logger.ts             # Structured request logger (Hono middleware)
    lib/
      env.ts                # Typed env config — port, host, parsed + validated
  config.ts                 # UNCHANGED — external package exports (signaling URLs, ICE)
  tsconfig.json             # Strict TypeScript config
  package.json              # Hono dep, bun scripts
  Dockerfile                # oven/bun:1-alpine
  fly.toml                  # Unchanged
  __tests__/
    server.test.ts           # Adapted for bun subprocess
    config.test.ts           # Unchanged
```

### How to add a new feature

1. Create `src/routes/my-feature.ts` exporting a `new Hono()` sub-app
2. Add one line in `src/routes/index.ts`: `app.route('/my-feature', myFeatureRoute)`
3. If it needs middleware, add to `src/middleware/`
4. If it needs shared types, add to `src/ws/types.ts` or create `src/lib/types.ts`

## Impact Analysis

### Files to Create

| File | Purpose |
|------|---------|
| `src/index.ts` | Entry point — `Bun.serve()`, signal handlers, startup log |
| `src/app.ts` | Hono app factory — creates app, applies middleware, mounts routes + WS |
| `src/routes/index.ts` | Route barrel — mounts all sub-routers |
| `src/routes/health.ts` | `GET /health` → JSON status + uptime |
| `src/ws/index.ts` | WebSocket upgrade route using `createBunWebSocket` |
| `src/ws/handler.ts` | `onMessage`, `onClose`, `onOpen` — ported from `server.mjs` |
| `src/ws/topics.ts` | `TopicRegistry` class wrapping `Map<string, Set<WSContext>>` |
| `src/ws/types.ts` | `SignalingMessage`, `MessageType` union, `WSData` interface |
| `src/middleware/index.ts` | Middleware barrel |
| `src/middleware/logger.ts` | Structured request logger |
| `src/lib/env.ts` | Typed env: `{ port: number; host: string }` with defaults + validation |
| `tsconfig.json` | Strict TS config for signaling package |

### Files to Modify

| File | Change |
|------|--------|
| `package.json` | Add `hono`, update scripts, move `ws` to devDeps |
| `Dockerfile` | Switch to `oven/bun:1-alpine` |
| `.gitignore` | Remove generated `config.js`/`.d.ts` entries |
| `.dockerignore` | Update for `src/` layout |
| `__tests__/server.test.ts` | Spawn `bun` instead of `node`, new entry path |

### Files to Delete

| File | Reason |
|------|--------|
| `server.mjs` | Replaced by `src/index.ts` |
| `config.js` | Generated file, no longer needed |
| `config.d.ts` | Generated file |
| `config.d.ts.map` | Generated file |

### Files NOT Touched

- `packages/shared/src/modules/coop/sync.ts`
- `packages/shared/src/modules/receiver/relay.ts`
- `packages/shared/src/modules/receiver/pairing.ts`
- `packages/extension/src/runtime/config.ts`
- `packages/extension/src/background/context.ts`

## Test Strategy

- **Unit tests**: `config.test.ts` unchanged
- **Integration tests**: `server.test.ts` adapted — spawn `bun run src/index.ts`, same WS protocol assertions
- **Manual validation**: Connect y-webrtc and receiver relay to local dev server

---

## Implementation Steps

### Step 1: Branch, dependencies, scripts

**Files**: `packages/signaling/package.json`

- Create branch `refactor/signaling-hono-api`
- Add dependency: `hono`
- Add devDependencies: `typescript`, `@types/bun`
- Move `ws` from dependencies to devDependencies (only used by tests)
- Update scripts:
  ```json
  {
    "start": "bun run src/index.ts",
    "dev": "bun --watch src/index.ts"
  }
  ```
- Keep `exports` field pointing to `./config.ts`

**Verify**: `bun install` succeeds

---

### Step 2: TypeScript config and directory scaffolding

**Files**: `tsconfig.json`, `src/` directory tree

- Create `tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "target": "ESNext",
      "module": "ESNext",
      "moduleResolution": "bundler",
      "strict": true,
      "noUncheckedIndexedAccess": true,
      "exactOptionalPropertyTypes": false,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "outDir": "dist",
      "rootDir": ".",
      "types": ["bun-types"]
    },
    "include": ["src/**/*.ts", "config.ts"]
  }
  ```
- Create directory structure: `src/`, `src/routes/`, `src/ws/`, `src/middleware/`, `src/lib/`

**Verify**: directories exist

---

### Step 3: Typed foundations — env, types, topic registry

**Files**: `src/lib/env.ts`, `src/ws/types.ts`, `src/ws/topics.ts`

#### `src/lib/env.ts` — Typed environment config

```typescript
export interface ServerEnv {
  port: number;
  host: string;
}

export function loadEnv(): ServerEnv {
  const port = Number(process.env.PORT ?? 4444);
  if (Number.isNaN(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${process.env.PORT}`);
  }
  return {
    port,
    host: process.env.HOST ?? '127.0.0.1',
  };
}
```

#### `src/ws/types.ts` — Message schemas

```typescript
export const MESSAGE_TYPES = ['subscribe', 'unsubscribe', 'publish', 'ping'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export interface SubscribeMessage {
  type: 'subscribe';
  topics: unknown[];
}

export interface UnsubscribeMessage {
  type: 'unsubscribe';
  topics: unknown[];
}

export interface PublishMessage {
  type: 'publish';
  topic: string;
  [key: string]: unknown;
}

export interface PingMessage {
  type: 'ping';
}

export type SignalingMessage =
  | SubscribeMessage
  | UnsubscribeMessage
  | PublishMessage
  | PingMessage;

/** Per-connection state stored on ws.data */
export interface WSData {
  subscribedTopics: Set<string>;
}
```

#### `src/ws/topics.ts` — TopicRegistry class

```typescript
import type { WSContext } from 'hono/ws';

export class TopicRegistry {
  private topics = new Map<string, Set<WSContext>>();

  subscribe(ws: WSContext, topicName: string): void { ... }
  unsubscribe(ws: WSContext, topicName: string): void { ... }
  publish(topic: string, message: Record<string, unknown>, sender?: WSContext): void { ... }
  removeAll(ws: WSContext, subscribedTopics: Set<string>): void { ... }
  getSubscriberCount(topic: string): number { ... }
}
```

Encapsulates the `Map<string, Set>` from `server.mjs`. Same logic, typed interface. Could be swapped for a Redis-backed implementation later without touching handlers.

**Verify**: `bunx tsc --noEmit` passes

---

### Step 4: WebSocket handler and upgrade route

**Files**: `src/ws/handler.ts`, `src/ws/index.ts`

#### `src/ws/handler.ts` — Message handlers

Port logic from `server.mjs` lines 34-123 into typed functions:

```typescript
import type { WSContext } from 'hono/ws';
import type { TopicRegistry } from './topics';
import type { SignalingMessage, WSData } from './types';

export function createWSHandlers(registry: TopicRegistry) {
  return {
    onOpen(evt: Event, ws: WSContext) {
      // Initialize per-connection state
    },
    onMessage(evt: MessageEvent, ws: WSContext) {
      // Parse JSON, validate type field, dispatch to registry
      // Malformed JSON → log warning, drop
      // Missing type → silently ignore
    },
    onClose(evt: CloseEvent, ws: WSContext) {
      // registry.removeAll(ws, subscribedTopics)
    },
  };
}
```

Key behaviors preserved exactly:
- `subscribe`: iterate `message.topics`, skip non-string entries, add to registry
- `unsubscribe`: iterate `message.topics`, remove from registry
- `publish`: broadcast to all subscribers with `clients` count appended
- `ping`: respond with `{ type: 'pong' }`
- Close: remove connection from all subscribed topics

#### `src/ws/index.ts` — WebSocket upgrade route

```typescript
import { createBunWebSocket } from 'hono/bun';
import type { Hono } from 'hono';
import { TopicRegistry } from './topics';
import { createWSHandlers } from './handler';

const registry = new TopicRegistry();
const { upgradeWebSocket, websocket } = createBunWebSocket();

export { websocket };

export function mountWebSocket(app: Hono) {
  const handlers = createWSHandlers(registry);
  app.get('/', upgradeWebSocket((c) => handlers));
}
```

Exports `websocket` (needed by `Bun.serve()`) and `mountWebSocket` (called from app factory).

**Verify**: `bunx tsc --noEmit` passes

---

### Step 5: Routes, middleware, and app factory

**Files**: `src/routes/health.ts`, `src/routes/index.ts`, `src/middleware/logger.ts`, `src/middleware/index.ts`, `src/app.ts`

#### `src/routes/health.ts`

```typescript
import { Hono } from 'hono';

const health = new Hono();

health.get('/', (c) =>
  c.json({ status: 'ok', uptime: process.uptime() })
);

export { health };
```

#### `src/routes/index.ts` — Route barrel

```typescript
import type { Hono } from 'hono';
import { health } from './health';

export function mountRoutes(app: Hono) {
  app.route('/health', health);

  // Non-WS GET / fallback (monitoring probes)
  // This runs only when no WebSocket upgrade header is present
  app.get('/', (c) => c.text('okay'));
}
```

Adding a new route = create file + add one `app.route()` line here.

#### `src/middleware/logger.ts`

```typescript
import { logger } from 'hono/logger';

export { logger };
```

Uses Hono's built-in logger. Swap for custom structured logging later without touching routes.

#### `src/middleware/index.ts` — Middleware barrel

```typescript
import type { Hono } from 'hono';
import { logger } from './logger';

export function applyMiddleware(app: Hono) {
  app.use('*', logger());
}
```

#### `src/app.ts` — App factory

```typescript
import { Hono } from 'hono';
import { applyMiddleware } from './middleware';
import { mountRoutes } from './routes';
import { mountWebSocket, websocket } from './ws';

export function createApp() {
  const app = new Hono();

  applyMiddleware(app);
  mountWebSocket(app);   // Must come before mountRoutes so WS upgrade takes priority
  mountRoutes(app);

  return { app, websocket };
}
```

Separated from `Bun.serve()` so the app is directly testable (e.g., `app.request('/health')` in unit tests) without spawning a subprocess.

**Verify**: `bunx tsc --noEmit` passes

---

### Step 6: Entry point and config.ts

**Files**: `src/index.ts`, `config.ts`, `.gitignore`

#### `src/index.ts` — Server entry

```typescript
import { createApp } from './app';
import { loadEnv } from './lib/env';

const { port, host } = loadEnv();
const { app, websocket } = createApp();

const server = Bun.serve({
  fetch: app.fetch,
  websocket,
  port,
  hostname: host,
});

console.log(`Coop signaling server listening on http://${host}:${port}`);

function shutdown() {
  console.log('Shutting down signaling server…');
  server.stop();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

#### `config.ts` — No changes

File stays at package root. Package `exports` field still points to `./config.ts`.

#### `.gitignore` — Remove generated file entries

Remove `config.js`, `config.d.ts`, `config.d.ts.map` lines. These won't be generated anymore.

**Verify**: `bun run src/index.ts` starts, `curl localhost:4444/health` returns JSON, `curl localhost:4444/` returns `"okay"`

---

### Step 7: Dockerfile and deployment

**Files**: `Dockerfile`, `.dockerignore`

#### Dockerfile

```dockerfile
FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --production
COPY src/ src/
COPY config.ts ./
EXPOSE 8080
ENV HOST=0.0.0.0
ENV PORT=8080
CMD ["bun", "run", "src/index.ts"]
```

#### .dockerignore

```
node_modules
__tests__
*.test.ts
.gitignore
fly.toml
tsconfig.json
dist
coverage
```

`fly.toml` — No changes (port 8080, same env vars, same concurrency limits).

**Verify**: `docker build -t coop-signaling packages/signaling` succeeds

---

### Step 8: Update tests

**Files**: `__tests__/server.test.ts`

Changes:
- `SERVER_FILE` → `path.join(SERVER_DIR, 'src', 'index.ts')`
- Spawn: `spawn('bun', ['run', SERVER_FILE], ...)` instead of `spawn('node', [SERVER_FILE], ...)`
- All 13 test cases remain identical — same WebSocket protocol, same assertions
- HTTP health test: update to also check `GET /health` returns JSON
- `config.test.ts` — Zero changes

**Verify**: `bun run test -- --filter signaling` — all tests pass

---

### Step 9: Delete old files and full validation

**Delete**:
- `packages/signaling/server.mjs`
- `packages/signaling/config.js`
- `packages/signaling/config.d.ts`
- `packages/signaling/config.d.ts.map`

**Validate**:
```bash
bun format && bun lint && bun run test && bun build
```

- Verify no downstream breakage in shared/extension
- Manual smoke: start `bun dev:signaling`, connect extension

**Verify**: `bun run validate smoke` passes

---

## Validation Checklist

- [ ] TypeScript strict passes (`bunx tsc --noEmit` in signaling)
- [ ] All signaling tests pass (`bun run test -- --filter signaling`)
- [ ] Workspace build succeeds (`bun build`)
- [ ] Lint + format pass (`bun format && bun lint`)
- [ ] Docker build succeeds
- [ ] `GET /health` returns `{ "status": "ok", "uptime": ... }`
- [ ] `GET /` returns `"okay"` (non-WS request)
- [ ] WebSocket connects on `/` and pub/sub works
- [ ] Extension connects to `ws://127.0.0.1:4444` and syncs
- [ ] No changes to `@coop/shared` or `@coop/extension` imports
