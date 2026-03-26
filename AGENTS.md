# AGENTS.md

Repository instructions for AI coding agents. Tool-specific config lives in `.claude/` (Claude Code) and `.codex/` (Codex). This file is the shared source of truth.

For full details, see [`CLAUDE.md`](./CLAUDE.md).

## Commands

```bash
bun install                  # Install dependencies
bun dev                      # Start app + extension (concurrent)
bun dev:app                  # Start app only
bun dev:extension            # Start extension only (WXT dev + Chromium)
bun dev:api                  # Start API server (signaling + routes)
bun format && bun lint       # Format (Biome) and lint workspace
bun run test                 # Run all unit tests (vitest)
bun run test:e2e             # Run all Playwright E2E tests
bun build                    # Build everything (shared -> app -> extension)
bun run validate smoke       # Quick confidence run
bun run validate core-loop   # Main extension workflow validation
bun run validate full        # Full local pass before demos or merges
```

**CRITICAL**: Always `bun run test`, never `bun test`. Bun's built-in runner ignores vitest config.

## Architecture

Coop captures scattered knowledge (browser tabs, audio, photos, files, links), refines it into clear opportunities via an in-browser AI agent, and gives groups a shared space to act on what matters. Bun monorepo.

### Product Loop

1. **Capture**: Browser tabs (extension) + audio, photos, files, links (companion PWA)
2. **Refine**: In-browser agent with 16-skill pipeline (WebGPU/WASM, no cloud)
3. **Review**: Drafts land in the Roost for human triage
4. **Share**: Publish to a coop (Safe multisig on Arbitrum, P2P sync via Yjs + y-webrtc, archived to Filecoin via Storacha)

### Key Principles

1. **Browser-First**: Extension is the primary product surface
2. **Local-First**: All data stays local until explicit publish/sync
3. **Passkey-First**: No wallet-extension-first UX; passkey identity
4. **Offline Capable**: Works without internet, syncs when connected
5. **Single Environment**: All packages share root `.env.local` (never create package-specific .env)

### Packages & Build Order

1. **shared** (`@coop/shared`) -- Schemas, flows, sync contracts, all domain modules
2. **app** (`@coop/app`) -- Landing page + receiver PWA shell
3. **extension** (`@coop/extension`) -- MV3 browser extension (popup, sidepanel, background worker)
4. **api** (`@coop/api`) -- Hono + Bun API server (Fly.io deployed)

### Shared Modules

`auth` (passkey identity), `coop` (flow board/review/publish), `storage` (Dexie + Yjs), `archive` (Storacha/Filecoin), `onchain` (Safe/ERC-4337), `receiver` (PWA sync), `privacy` (Semaphore ZK), `stealth` (ERC-5564), `agent` (harness/skills/inference), `operator` (trusted-node), `policy` (action approval), `session` (scoped permissions), `permit` (execution permits), `greengoods` (garden bootstrap), `erc8004` (agent registry), `app` (shell logic).

## Key Patterns

### Always Do

- Import from `@coop/shared` barrel only: `import { x } from '@coop/shared'`
- Internal deps use `workspace:*` (never `workspace:^`)
- All env vars require `VITE_` prefix for frontend access
- Env vars are baked at build time -- rebuild after `.env.local` changes
- Pin exact versions: viem, permissionless, react, dexie, yjs
- Use ranges for dev deps: vitest `^`, typescript `~`, @types/* `^`
- Surface all errors to the user -- never swallow errors
- Check existing components before creating new ones (see UI Component Reuse below)
- Read code before answering questions about it
- Verify changes build before reporting done

### Never Do

- Create package-specific `.env` files (single root `.env.local` only)
- Use deep import paths (`@coop/shared/modules/auth/...`)
- Use `bun test` (always `bun run test`)
- Define domain logic in extension/app (put it in `@coop/shared`)
- Access Dexie directly from views (use runtime messages)
- Use `setInterval` in background worker (use `chrome.alarms`)
- Use `window` in service worker context
- Skip HMAC validation on receiver sync envelopes
- Introduce overlapping Vite resolve aliases

### Verification Tiers

Not every change needs a full build. Choose the lightest tier that covers your change:

| Tier | Command | When to use |
|------|---------|-------------|
| typecheck | `bun run validate typecheck` | Single-package, no shared export changes |
| quick | `bun run validate quick` | Typecheck + lint, formatting/type fixes |
| smoke | `bun run validate smoke` | Cross-package changes, shared module edits |
| build | `bun build` | CSS tokens, new shared exports, pre-commit |
| core-loop | `bun run validate core-loop` | UI workflow changes needing E2E |

### UI Component Reuse

Before creating new UI elements, check `packages/extension/src/views/shared/` and `packages/extension/src/global.css`. Existing: Tooltip, NotificationBanner, ThemePicker, icon buttons (`.popup-icon-button`), cards (`.panel-card`, `.draft-card`), badges (`.badge`, `.state-pill`), skeleton loaders (`.skeleton`), design tokens (`shared/src/styles/tokens.css`).

### Onchain Integration

Safe + ERC-4337 + passkey auth. Chain set by `VITE_COOP_CHAIN` (default: `sepolia`, production: `arbitrum`). Modes: `VITE_COOP_ONCHAIN_MODE` (mock|live), `VITE_COOP_ARCHIVE_MODE` (mock|live).

### Local Persistence

Dexie for structured data, Yjs for CRDT sync, y-webrtc for peer transport.

## Environment

Single `.env.local` at root. Essential vars:
- `VITE_COOP_CHAIN`: `sepolia` or `arbitrum`
- `VITE_COOP_ONCHAIN_MODE`: `mock` (default) or `live`
- `VITE_COOP_ARCHIVE_MODE`: `mock` (default) or `live`
- `VITE_COOP_SESSION_MODE`: `mock`, `live`, or `off` (default)
- `VITE_COOP_SIGNALING_URLS`: Comma-separated (default: `wss://api.coop.town`)
- `VITE_COOP_RECEIVER_APP_URL`: Receiver PWA URL (default: `http://127.0.0.1:3001`)

Full reference: `docs/builder/environment.md`

## Git Workflow

**Branches**: `type/description` (e.g., `feature/receiver-pwa`, `fix/sync-race`)

**Commits**: Conventional Commits with scope: `type(scope): description`
- Types: feat, fix, refactor, chore, docs, test, perf, ci
- Scopes: shared, extension, app, claude

**Validation before committing**: `bun format && bun lint && bun run test && bun build`

## Domain Knowledge

Read the relevant skill file before working in that area:

| Domain | Skill File |
|--------|-----------|
| Code review (6-pass protocol) | `.claude/skills/review/SKILL.md` |
| Testing (TDD, Vitest, Playwright) | `.claude/skills/testing/SKILL.md` |
| React (components, state, hooks) | `.claude/skills/react/SKILL.md` |
| Web3 (Safe, ERC-4337, passkeys) | `.claude/skills/web3/SKILL.md` |
| Security (XSS, keys, MV3 APIs) | `.claude/skills/security/SKILL.md` |
| Data layer (Dexie, Yjs, CRDTs) | `.claude/skills/data-layer/SKILL.md` |
| Error handling patterns | `.claude/skills/error-handling-patterns/SKILL.md` |
| UI/Accessibility (WCAG 2.1 AA) | `.claude/skills/ui-compliance/SKILL.md` |
| Architecture (Clean, Hexagonal, DDD) | `.claude/skills/architecture/SKILL.md` |
| Performance (bundle, profiling) | `.claude/skills/performance/SKILL.md` |
| Planning workflows | `.claude/skills/plan/SKILL.md` |
| Debugging (root cause analysis) | `.claude/skills/debug/SKILL.md` |
| Codebase audit (dead code, health) | `.claude/skills/audit/SKILL.md` |
| Commit organization | `.claude/skills/commit/SKILL.md` |

## Package Context

Detailed architecture documentation per package:

| Package | Context File |
|---------|-------------|
| Extension (MV3, surfaces, handlers) | `.claude/context/extension.md` |
| Shared (modules, boundaries) | `.claude/context/shared.md` |
| App (landing, receiver PWA) | `.claude/context/app.md` |
| Product (flows, journeys) | `.claude/context/product.md` |

## Package Rules

Constraints and conventions per domain:

| Domain | Rules File |
|--------|-----------|
| Tests | `.claude/rules/tests.md` |
| Extension (MV3) | `.claude/rules/extension.md` |
| Shared modules | `.claude/rules/shared.md` |
| Onchain | `.claude/rules/onchain.md` |
| Styles/tokens | `.claude/rules/styles.md` |
| Sync & storage | `.claude/rules/sync-and-storage.md` |
| Schemas | `.claude/rules/schemas.md` |

## Infrastructure

| URL | Purpose |
|-----|---------|
| `wss://api.coop.town` | Fly.io production signaling |
| `wss://api.coop.town/yws` | Fly.io Yjs document sync |
| `https://coop.town` | Vercel PWA (landing + receiver) |
| `https://docs.coop.town` | Vercel docs |
