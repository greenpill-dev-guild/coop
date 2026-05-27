---
name: coop-dev-surface
description: Use when working in Coop and needing the local app, receiver PWA, docs, API/signaling server, or extension watcher.
---

# Coop Dev Surface

Inside this repo, use the repo-native command:

```sh
bun install
# configure repo env if needed
bun run dev
```

`bun run dev` runs `scripts/dev.ts`. It starts the app, API/signaling server, docs, extension watcher, optional Cloudflare tunnel, and a dev browser profile when available. It writes runtime state to `packages/app/public/__coop_dev__/state.json`, streams logs, and cleans up child processes on Ctrl-C.

Expected ports:

- `3101`: app / receiver PWA
- `3102`: docs
- `3103`: API / signaling
- `3104`: extension dev server, when bound

Useful native commands:

```sh
bun run dev
bun run dev:stop
bun run dev:app
bun run dev:api
bun run dev:docs
bun run dev:extension
```

For cross-repo orchestration from anywhere, use the global workbench:

```sh
dev launch coop
dev launch coop:app
dev status coop
dev health coop
dev stop coop
```

Do not call `.dev-surfaces/run.mjs`; this repo should not have that wrapper.
